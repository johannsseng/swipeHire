import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db.js";
import { requireAuth, type AuthedRequest } from "../auth/middleware.js";
import { getCompanyReviews } from "../reviews/service.js";
import { buildDraft } from "../outreach/draft.js";
import { mailer } from "../outreach/mailer.js";
import { resolveCompanyInbox } from "../outreach/inbox.js";
import { ensureRecruiterContact } from "../recruiters/service.js";
import { extractSalary } from "./salary.js";
import { cleanDescriptionHtml } from "./html.js";
import { buildTaste, scoreJob, type ResumeKeywords } from "./ranking.js";

export const jobsRouter = Router();

const feedQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(20),
  // Offset into the scored ranking (SmartFeed orders by relevance, not date).
  cursor: z.coerce.number().int().min(0).optional(),
});

// How many fresh candidates we score per request.
const FEED_POOL_SIZE = 300;

jobsRouter.get("/feed", requireAuth, async (req: AuthedRequest, res) => {
  const parse = feedQuerySchema.safeParse(req.query);
  if (!parse.success) {
    return res.status(400).json({ error: parse.error.flatten() });
  }
  const { limit } = parse.data;
  const offset = parse.data.cursor ?? 0;
  const userId = req.userId!;

  // Swipe history: used both to exclude seen jobs and to learn taste (layer 2).
  const swipes = await prisma.swipe.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    select: {
      jobId: true,
      direction: true,
      job: { select: { title: true, companyId: true, remote: true } },
    },
  });
  const excludeIds = swipes.map((s) => s.jobId);

  // Profile: resume keywords (layer 1) + headline/bio prior.
  const profile = await prisma.profile.findUnique({
    where: { userId },
    select: { headline: true, bio: true, resumeParsed: true },
  });
  const resumeKeywords =
    (profile?.resumeParsed as any)?.keywords && typeof (profile?.resumeParsed as any).keywords === "object"
      ? ((profile!.resumeParsed as any).keywords as ResumeKeywords)
      : undefined;
  const taste = buildTaste(
    swipes.slice(0, 300).map((s) => ({
      direction: s.direction,
      title: s.job.title,
      companyId: s.job.companyId,
      remote: s.job.remote,
    })),
    `${profile?.headline ?? ""} ${profile?.bio ?? ""}`
  );

  // Candidate pool: newest unseen jobs, scored and re-ordered by relevance.
  const pool = await prisma.job.findMany({
    where: {
      active: true,
      id: { notIn: excludeIds.length ? excludeIds : undefined },
    },
    orderBy: { postedAt: "desc" },
    take: FEED_POOL_SIZE,
    include: { company: { select: { name: true, logoUrl: true } } },
  });

  const ratings = await companyRatings(pool.map((j) => j.companyId));

  const scored = pool
    .map((j) => ({
      job: j,
      score: scoreJob(
        {
          title: j.title,
          companyId: j.companyId,
          remote: j.remote,
          postedAt: j.postedAt,
          descriptionText: j.descriptionText,
        },
        {
          resume: resumeKeywords,
          taste,
          rating: ratings.get(j.companyId),
          hasSalary: Boolean(extractSalary(j.descriptionText?.slice(0, 2000))),
        }
      ),
    }))
    .sort(
      (a, b) =>
        b.score - a.score ||
        (b.job.postedAt?.getTime() ?? 0) - (a.job.postedAt?.getTime() ?? 0)
    );

  const page = scored.slice(offset, offset + limit);
  const nextCursor = offset + limit < scored.length ? String(offset + limit) : null;

  res.json({
    items: page.map(({ job: j }) => ({
      id: j.id,
      title: j.title,
      company: j.company.name,
      companyLogoUrl: j.company.logoUrl,
      companyRating: ratings.get(j.companyId)?.avg ?? null,
      companyReviewCount: ratings.get(j.companyId)?.count ?? 0,
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

// Average review rating per company, for the given company ids.
async function companyRatings(
  companyIds: string[]
): Promise<Map<string, { avg: number; count: number }>> {
  const unique = [...new Set(companyIds)];
  if (unique.length === 0) return new Map();
  const grouped = await prisma.review.groupBy({
    by: ["companyId"],
    where: { companyId: { in: unique } },
    _avg: { rating: true },
    _count: { _all: true },
  });
  return new Map(
    grouped.map((g: any) => [
      g.companyId,
      { avg: Math.round((g._avg.rating ?? 0) * 10) / 10, count: g._count._all },
    ])
  );
}

jobsRouter.get("/saved", requireAuth, async (req: AuthedRequest, res) => {
  const userId = req.userId!;

  const swipes = await prisma.swipe.findMany({
    where: { userId, direction: "right" },
    orderBy: { createdAt: "desc" },
    include: {
      job: {
        include: {
          company: { select: { name: true, logoUrl: true } },
        },
      },
    },
  });

  const ratings = await companyRatings(swipes.map((s) => s.job.companyId));

  const items = swipes.map((s) => ({
    id: s.job.id,
    title: s.job.title,
    company: s.job.company.name,
    companyLogoUrl: s.job.company.logoUrl,
    companyRating: ratings.get(s.job.companyId)?.avg ?? null,
    companyReviewCount: ratings.get(s.job.companyId)?.count ?? 0,
    location: s.job.location,
    applyUrl: s.job.applyUrl,
    descriptionHtml: cleanDescriptionHtml(s.job.descriptionHtml),
    salary: extractSalary(s.job.descriptionText ?? s.job.descriptionHtml),
    trackStatus: s.trackStatus,
    savedAt: s.createdAt,
  }));

  res.json({ items });
});

// ─── Reviews (swipe up) ──────────────────────────────────────────────────────

jobsRouter.get("/:id/reviews", requireAuth, async (req: AuthedRequest, res) => {
  const userId = req.userId!;
  const job = await prisma.job.findUnique({
    where: { id: req.params.id },
    select: { companyId: true, company: { select: { name: true, logoUrl: true } } },
  });
  if (!job) return res.status(404).json({ error: "Job not found" });

  try {
    const { summary, reviews } = await getCompanyReviews(job.companyId, userId);
    res.json({
      company: { name: job.company.name, logoUrl: job.company.logoUrl },
      summary,
      reviews,
    });
  } catch (err: any) {
    res.status(err?.status ?? 500).json({ error: err?.message ?? "Failed to load reviews" });
  }
});

const reviewSchema = z.object({
  rating: z.coerce.number().int().min(1).max(5),
  title: z.string().max(120).optional(),
  body: z.string().max(4000).optional(),
  pros: z.string().max(2000).optional(),
  cons: z.string().max(2000).optional(),
  authorTitle: z.string().max(120).optional(),
});

jobsRouter.post("/:id/reviews", requireAuth, async (req: AuthedRequest, res) => {
  const userId = req.userId!;
  const parse = reviewSchema.safeParse(req.body);
  if (!parse.success) {
    return res.status(400).json({ error: parse.error.flatten() });
  }

  const job = await prisma.job.findUnique({
    where: { id: req.params.id },
    select: { companyId: true },
  });
  if (!job) return res.status(404).json({ error: "Job not found" });

  const data = parse.data;
  const review = await prisma.review.upsert({
    where: { userId_companyId: { userId, companyId: job.companyId } },
    create: {
      companyId: job.companyId,
      userId,
      source: "in_app",
      rating: data.rating,
      title: data.title ?? null,
      body: data.body ?? null,
      pros: data.pros ?? null,
      cons: data.cons ?? null,
      authorTitle: data.authorTitle ?? null,
    },
    update: {
      rating: data.rating,
      title: data.title ?? null,
      body: data.body ?? null,
      pros: data.pros ?? null,
      cons: data.cons ?? null,
      authorTitle: data.authorTitle ?? null,
    },
  });

  res.status(201).json({ ok: true, review });
});

// ─── Recruiter outreach ──────────────────────────────────────────────────────

async function loadOutreachContext(jobId: string, userId: string) {
  const job = await prisma.job.findUnique({
    where: { id: jobId },
    include: {
      company: {
        select: {
          name: true,
          recruiterName: true,
          recruiterEmail: true,
          recruiterTitle: true,
          recruiterEnrichedAt: true,
          website: true,
        },
      },
    },
  });
  if (!job) return { ok: false as const, status: 404, message: "Job not found" };

  // Hunter first (auto-found real contact), careers@domain as fallback.
  const contact = await ensureRecruiterContact({
    id: job.companyId,
    website: job.company.website,
    recruiterName: job.company.recruiterName,
    recruiterEmail: job.company.recruiterEmail,
    recruiterTitle: job.company.recruiterTitle,
    recruiterEnrichedAt: job.company.recruiterEnrichedAt,
  });
  const inbox = resolveCompanyInbox({
    recruiterEmail: contact.recruiterEmail,
    recruiterName: contact.recruiterName,
    website: job.company.website,
  });

  const profile = await prisma.profile.findUnique({
    where: { userId },
    select: { fullName: true, headline: true, links: true },
  });

  const draft = buildDraft({
    applicantName: profile?.fullName ?? null,
    applicantHeadline: profile?.headline ?? null,
    applicantLinks: (profile?.links as any) ?? null,
    jobTitle: job.title,
    companyName: job.company.name,
    // Only greet a named person for a real contact; role inboxes get a
    // generic, company-addressed greeting.
    recruiterName: inbox.kind === "manual" ? contact.recruiterName : null,
  });

  return { ok: true as const, job, inbox, draft };
}

// Preview the generated draft (without sending) so the UI can show/edit it.
jobsRouter.get("/:id/outreach/draft", requireAuth, async (req: AuthedRequest, res) => {
  const userId = req.userId!;
  const ctx = await loadOutreachContext(req.params.id, userId);
  if (!ctx.ok) return res.status(ctx.status).json({ error: ctx.message });

  res.json({
    recruiter: {
      name: ctx.inbox.label,
      email: ctx.inbox.email,
    },
    inboxKind: ctx.inbox.kind, // "manual" | "careers" | null
    applyUrl: ctx.job.applyUrl,
    canSend: Boolean(ctx.inbox.email) && mailer.isConfigured(),
    sendingConfigured: mailer.isConfigured(),
    draft: ctx.draft,
  });
});

const outreachSchema = z.object({
  subject: z.string().min(1).max(200).optional(),
  body: z.string().min(1).max(8000).optional(),
});

// Draft + send a recruiter outreach email.
jobsRouter.post("/:id/outreach", requireAuth, async (req: AuthedRequest, res) => {
  const userId = req.userId!;
  const parse = outreachSchema.safeParse(req.body ?? {});
  if (!parse.success) {
    return res.status(400).json({ error: parse.error.flatten() });
  }

  const ctx = await loadOutreachContext(req.params.id, userId);
  if (!ctx.ok) return res.status(ctx.status).json({ error: ctx.message });

  const recruiterEmail = ctx.inbox.email;
  if (!recruiterEmail) {
    return res.status(422).json({
      error: "No company inbox available — add a website/domain or set a contact for this company",
    });
  }

  const subject = parse.data.subject ?? ctx.draft.subject;
  const body = parse.data.body ?? ctx.draft.body;

  // Use the authenticated user's email as the reply-to so recruiters can respond.
  const me = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true },
  });

  const result = mailer.isConfigured()
    ? await mailer.send({ to: recruiterEmail, replyTo: me?.email, subject, text: body })
    : ({ ok: false, error: "Email sending not configured" } as const);

  const outreach = await prisma.outreach.create({
    data: {
      userId,
      jobId: ctx.job.id,
      recruiterEmail,
      subject,
      body,
      status: result.ok ? "sent" : mailer.isConfigured() ? "failed" : "draft",
      providerId: result.ok ? result.providerId : null,
      sentAt: result.ok ? new Date() : null,
      error: result.ok ? null : result.error,
    },
  });

  if (!result.ok && mailer.isConfigured()) {
    return res.status(502).json({ ok: false, outreach, error: result.error });
  }

  res.status(result.ok ? 200 : 202).json({
    ok: result.ok,
    sent: result.ok,
    outreach,
    // When sending isn't configured we still persisted the draft.
    note: result.ok ? undefined : "Saved as draft — configure RESEND_API_KEY to send.",
  });
});

jobsRouter.get("/:id", requireAuth, async (req: AuthedRequest, res) => {
  const job = await prisma.job.findUnique({
    where: { id: req.params.id },
    include: {
      company: {
        select: {
          name: true,
          logoUrl: true,
          website: true,
          recruiterName: true,
          recruiterEmail: true,
          recruiterTitle: true,
          recruiterEnrichedAt: true,
        },
      },
    },
  });
  if (!job) return res.status(404).json({ error: "Job not found" });

  const contact = await ensureRecruiterContact({
    id: job.companyId,
    website: job.company.website,
    recruiterName: job.company.recruiterName,
    recruiterEmail: job.company.recruiterEmail,
    recruiterTitle: job.company.recruiterTitle,
    recruiterEnrichedAt: job.company.recruiterEnrichedAt,
  });
  const inbox = resolveCompanyInbox({
    recruiterEmail: contact.recruiterEmail,
    recruiterName: contact.recruiterName,
    website: job.company.website,
  });

  res.json({
    id: job.id,
    title: job.title,
    company: job.company.name,
    companyLogoUrl: job.company.logoUrl,
    companyWebsite: job.company.website,
    location: job.location,
    remote: job.remote,
    employmentType: job.employmentType,
    descriptionHtml: cleanDescriptionHtml(job.descriptionHtml),
    salary: extractSalary(job.descriptionText ?? job.descriptionHtml),
    recruiter: {
      name: inbox.label,
      title: inbox.kind === "careers" ? "Careers inbox" : contact.recruiterTitle,
      email: inbox.email,
    },
    applyUrl: job.applyUrl,
    applyMethod: job.applyMethod,
    postedAt: job.postedAt,
  });
});