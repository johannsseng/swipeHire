import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db.js";
import { requireAuth, type AuthedRequest } from "../auth/middleware.js";

export const jobsRouter = Router();

const feedQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(20),
  cursor: z.string().uuid().optional(),
});

jobsRouter.get("/feed", requireAuth, async (req: AuthedRequest, res) => {
  const parse = feedQuerySchema.safeParse(req.query);
  if (!parse.success) {
    return res.status(400).json({ error: parse.error.flatten() });
  }
  const { limit, cursor } = parse.data;
  const userId = req.userId!;

  const swipedJobIds = await prisma.swipe.findMany({
    where: { userId },
    select: { jobId: true },
  });
  const excludeIds = swipedJobIds.map((s) => s.jobId);

  const jobs = await prisma.job.findMany({
    where: {
      active: true,
      id: { notIn: excludeIds.length ? excludeIds : undefined },
    },
    orderBy: { postedAt: "desc" },
    take: limit + 1,
    ...(cursor && { cursor: { id: cursor }, skip: 1 }),
    include: {
      company: {
        select: { name: true, logoUrl: true },
      },
    },
  });

  const hasMore = jobs.length > limit;
  const items = hasMore ? jobs.slice(0, limit) : jobs;
  const nextCursor = hasMore ? items[items.length - 1].id : null;

  res.json({
    items: items.map((j) => ({
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
    })),
    nextCursor,
  });
});

jobsRouter.get("/:id", requireAuth, async (req: AuthedRequest, res) => {
  const job = await prisma.job.findUnique({
    where: { id: req.params.id },
    include: {
      company: {
        select: { name: true, logoUrl: true, website: true },
      },
    },
  });
  if (!job) return res.status(404).json({ error: "Job not found" });

  res.json({
    id: job.id,
    title: job.title,
    company: job.company.name,
    companyLogoUrl: job.company.logoUrl,
    companyWebsite: job.company.website,
    location: job.location,
    remote: job.remote,
    employmentType: job.employmentType,
    descriptionHtml: job.descriptionHtml,
    applyUrl: job.applyUrl,
    applyMethod: job.applyMethod,
    postedAt: job.postedAt,
  });
});