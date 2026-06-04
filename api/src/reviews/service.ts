import { prisma } from "../db.js";
import { glassdoorProvider } from "./glassdoor.js";
import type { ReviewProvider } from "./provider.js";

// Registered external providers. Add more here as they come online.
const providers: ReviewProvider[] = [glassdoorProvider];

export type ReviewDTO = {
  id: string;
  source: "in_app" | "glassdoor";
  rating: number;
  title: string | null;
  body: string | null;
  pros: string | null;
  cons: string | null;
  authorTitle: string | null;
  createdAt: string | null;
  isMine: boolean;
};

export type ReviewSummary = {
  averageRating: number | null;
  count: number;
  distribution: Record<1 | 2 | 3 | 4 | 5, number>;
  providers: string[]; // which external providers contributed
};

/**
 * Pull external reviews from every configured provider and persist them
 * (idempotently) so they unify with in-app reviews. Failures are swallowed —
 * a provider outage must never break the reviews endpoint.
 */
async function syncExternal(company: {
  id: string;
  name: string;
  glassdoorId: string | null;
  website: string | null;
}): Promise<string[]> {
  const active = providers.filter((p) => p.isConfigured());
  if (active.length === 0) return [];

  const contributed: string[] = [];

  await Promise.all(
    active.map(async (provider) => {
      const external = await provider.fetch({
        companyName: company.name,
        glassdoorId: company.glassdoorId,
        website: company.website,
      });
      if (external.length === 0) return;
      contributed.push(provider.name);

      for (const r of external) {
        await prisma.review.upsert({
          where: { source_externalId: { source: r.source, externalId: r.externalId } },
          create: {
            companyId: company.id,
            userId: null,
            source: r.source,
            rating: r.rating,
            title: r.title,
            body: r.body,
            pros: r.pros,
            cons: r.cons,
            authorTitle: r.authorTitle,
            externalId: r.externalId,
          },
          update: {
            rating: r.rating,
            title: r.title,
            body: r.body,
            pros: r.pros,
            cons: r.cons,
          },
        });
      }
    })
  );

  return contributed;
}

export async function getCompanyReviews(
  companyId: string,
  viewerUserId: string
): Promise<{ summary: ReviewSummary; reviews: ReviewDTO[] }> {
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { id: true, name: true, glassdoorId: true, website: true },
  });
  if (!company) {
    throw Object.assign(new Error("Company not found"), { status: 404 });
  }

  const providerNames = await syncExternal(company);

  const rows = await prisma.review.findMany({
    where: { companyId },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  const distribution: Record<1 | 2 | 3 | 4 | 5, number> = {
    1: 0,
    2: 0,
    3: 0,
    4: 0,
    5: 0,
  };
  let sum = 0;
  for (const r of rows) {
    const bucket = Math.max(1, Math.min(5, r.rating)) as 1 | 2 | 3 | 4 | 5;
    distribution[bucket] += 1;
    sum += r.rating;
  }

  const summary: ReviewSummary = {
    averageRating: rows.length ? Math.round((sum / rows.length) * 10) / 10 : null,
    count: rows.length,
    distribution,
    providers: providerNames,
  };

  const reviews: ReviewDTO[] = rows.map((r) => ({
    id: r.id,
    source: r.source,
    rating: r.rating,
    title: r.title,
    body: r.body,
    pros: r.pros,
    cons: r.cons,
    authorTitle: r.authorTitle,
    createdAt: r.createdAt ? r.createdAt.toISOString() : null,
    isMine: r.userId === viewerUserId,
  }));

  return { summary, reviews };
}
