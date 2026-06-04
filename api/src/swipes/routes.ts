import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db.js";
import { requireAuth, type AuthedRequest } from "../auth/middleware.js";

export const swipesRouter = Router();

const swipeSchema = z.object({
  jobId: z.string().uuid(),
  direction: z.enum(["left", "right"]),
});

swipesRouter.post("/", requireAuth, async (req: AuthedRequest, res) => {
  const parse = swipeSchema.safeParse(req.body);
  if (!parse.success) {
    return res.status(400).json({ error: parse.error.flatten() });
  }
  const { jobId, direction } = parse.data;
  const userId = req.userId!;

  const job = await prisma.job.findUnique({ where: { id: jobId } });
  if (!job) return res.status(404).json({ error: "Job not found" });

  const swipe = await prisma.swipe.upsert({
    where: { userId_jobId: { userId, jobId } },
    update: { direction: direction === "right" ? "right" : "left" },
    create: {
      userId,
      jobId,
      direction: direction === "right" ? "right" : "left",
    },
  });

  res.json({ ok: true, swipe });
});

// Undo the most recent swipe (any direction). Returns the job that was
// "un-swiped" so the client can drop it back onto the deck.
swipesRouter.post("/undo", requireAuth, async (req: AuthedRequest, res) => {
  const userId = req.userId!;

  const last = await prisma.swipe.findFirst({
    where: { userId },
    orderBy: { createdAt: "desc" },
    include: {
      job: {
        include: { company: { select: { name: true, logoUrl: true } } },
      },
    },
  });

  if (!last) return res.status(404).json({ error: "Nothing to undo" });

  await prisma.swipe.delete({ where: { id: last.id } });

  const j = last.job;
  res.json({
    ok: true,
    job: {
      id: j.id,
      title: j.title,
      company: j.company.name,
      companyLogoUrl: j.company.logoUrl,
      location: j.location,
      remote: j.remote,
      employmentType: j.employmentType,
      descriptionText: j.descriptionText?.slice(0, 500),
      applyUrl: j.applyUrl,
      postedAt: j.postedAt,
    },
  });
});

const trackStatusSchema = z.object({
  status: z.enum(["saved", "applied", "screening", "interview", "accepted", "rejected"]),
});

// Update the application-pipeline stage of a saved job.
swipesRouter.patch("/:jobId/status", requireAuth, async (req: AuthedRequest, res) => {
  const parse = trackStatusSchema.safeParse(req.body);
  if (!parse.success) {
    return res.status(400).json({ error: parse.error.flatten() });
  }
  const userId = req.userId!;
  const jobId = req.params.jobId;

  const swipe = await prisma.swipe.findUnique({
    where: { userId_jobId: { userId, jobId } },
  });
  if (!swipe || swipe.direction !== "right") {
    return res.status(404).json({ error: "Job is not in your saved list" });
  }

  const updated = await prisma.swipe.update({
    where: { id: swipe.id },
    data: { trackStatus: parse.data.status, trackUpdatedAt: new Date() },
    select: { jobId: true, trackStatus: true, trackUpdatedAt: true },
  });

  res.json({ ok: true, ...updated });
});

// Remove a swipe for a specific job — used to "unsave" a saved (right-swiped)
// job, or to clear any prior swipe so it can resurface in the feed.
swipesRouter.delete("/:jobId", requireAuth, async (req: AuthedRequest, res) => {
  const userId = req.userId!;
  const jobId = req.params.jobId;

  const existing = await prisma.swipe.findUnique({
    where: { userId_jobId: { userId, jobId } },
  });
  if (!existing) return res.status(404).json({ error: "Swipe not found" });

  await prisma.swipe.delete({ where: { id: existing.id } });
  res.json({ ok: true });
});