import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { prisma } from "../db.js";
import { requireAuth } from "../auth/middleware.js";

export const usersRouter = Router();

usersRouter.use(requireAuth);

usersRouter.get("/me", async (req: Request, res: Response) => {
  const user = await prisma.user.findUnique({
    where: { id: req.userId! },
    select: {
      id: true,
      email: true,
      verifiedTier: true,
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
