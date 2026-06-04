import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { prisma } from "../db.js";
import { requireAuth } from "../auth/middleware.js";
import { hashPassword, verifyPassword } from "../auth/passwords.js";
import { buildResumeKeywords } from "../jobs/ranking.js";

export const usersRouter = Router();

usersRouter.use(requireAuth);

usersRouter.get("/me", async (req: Request, res: Response) => {
  const user = await prisma.user.findUnique({
    where: { id: req.userId! },
    select: {
      id: true,
      email: true,
      verifiedTier: true,
      role: true,
      createdAt: true,
      profile: {
        select: {
          fullName: true,
          headline: true,
          bio: true,
          location: true,
          links: true,
        },
      },
    },
  });

  if (!user) {
    return res.status(404).json({ error: "User not found" });
  }

  return res.json(user);
});

const profileUpdateSchema = z.object({
  fullName: z.string().min(1).max(120).optional(),
  headline: z.string().max(200).optional(),
  bio: z.string().max(2000).optional(),
  location: z.string().max(120).optional(),
  links: z
    .object({
      linkedin: z.string().url().optional(),
      github: z.string().url().optional(),
      portfolio: z.string().url().optional(),
    })
    .optional(),
});

usersRouter.patch("/me/profile", async (req: Request, res: Response) => {
  const parsed = profileUpdateSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid input", details: parsed.error.flatten() });
  }

  const profile = await prisma.profile.update({
    where: { userId: req.userId! },
    data: parsed.data,
  });

  return res.json(profile);
});

const resumeSchema = z.object({
  resumeText: z.string().min(50).max(20_000),
});

// Save resume text and extract the keyword profile that powers SmartFeed's
// scanner layer. Paste-based for now — no file parsing dependencies.
usersRouter.put("/me/resume", async (req: Request, res: Response) => {
  const parsed = resumeSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Resume text must be 50–20,000 characters" });
  }

  const keywords = buildResumeKeywords(parsed.data.resumeText);
  await prisma.profile.update({
    where: { userId: req.userId! },
    data: {
      resumeParsed: {
        text: parsed.data.resumeText,
        keywords,
        updatedAt: new Date().toISOString(),
      },
    },
  });

  return res.json({ ok: true, keywordCount: Object.keys(keywords).length });
});

usersRouter.get("/me/resume", async (req: Request, res: Response) => {
  const profile = await prisma.profile.findUnique({
    where: { userId: req.userId! },
    select: { resumeParsed: true },
  });
  const parsed: any = profile?.resumeParsed;
  return res.json({
    hasResume: Boolean(parsed?.keywords),
    keywordCount: parsed?.keywords ? Object.keys(parsed.keywords).length : 0,
    updatedAt: parsed?.updatedAt ?? null,
  });
});

const emailChangeSchema = z.object({
  currentPassword: z.string().min(1),
  newEmail: z.string().email().toLowerCase().trim(),
});

// Change email — requires the current password, and the new email must be free.
usersRouter.patch("/me/email", async (req: Request, res: Response) => {
  const parsed = emailChangeSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid input" });
  }
  const { currentPassword, newEmail } = parsed.data;

  const user = await prisma.user.findUnique({ where: { id: req.userId! } });
  if (!user || !(await verifyPassword(currentPassword, user.passwordHash))) {
    return res.status(401).json({ error: "Current password is incorrect" });
  }
  if (newEmail === user.email) {
    return res.status(400).json({ error: "That's already your email" });
  }
  const taken = await prisma.user.findUnique({ where: { email: newEmail } });
  if (taken) {
    return res.status(409).json({ error: "That email is already in use" });
  }

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: { email: newEmail, emailVerified: false },
    select: { id: true, email: true, verifiedTier: true, role: true },
  });
  return res.json({ ok: true, user: updated });
});

const passwordChangeSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8).max(72),
});

// Change password — requires the current password.
usersRouter.patch("/me/password", async (req: Request, res: Response) => {
  const parsed = passwordChangeSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Password must be 8–72 characters" });
  }
  const { currentPassword, newPassword } = parsed.data;

  const user = await prisma.user.findUnique({ where: { id: req.userId! } });
  if (!user || !(await verifyPassword(currentPassword, user.passwordHash))) {
    return res.status(401).json({ error: "Current password is incorrect" });
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash: await hashPassword(newPassword) },
  });
  return res.json({ ok: true });
});

// Permanently delete the authenticated user and all their data.
// Required by the App Store; cascades remove profile, swipes, applications,
// verifications, and outreaches (reviews are detached, not deleted).
usersRouter.delete("/me", async (req: Request, res: Response) => {
  await prisma.user.delete({ where: { id: req.userId! } });
  return res.json({ ok: true });
});
