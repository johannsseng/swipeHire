import { prisma } from "./db.js";
import { fetchGlassdoorReviews, glassdoorApiConfigured } from "./adapters/reviewsRapidApi.js";

// Background review sync. Pulls employer reviews from the Real-Time Glassdoor
// Data API (via RapidAPI) for each active company and upserts them into the
// shared `reviews` table (source = glassdoor). Kept OUT of the API request path
// so a slow fetch never blocks the app — the API just serves what's persisted.
//
// Run with:  pnpm sync:reviews   (in worker/)  ·  pnpm reviews:prod   (in CI/host)

// Skip a company if we already pulled its Glassdoor reviews recently — keeps
// request volume (and cost) down. Override with REVIEWS_REFRESH_DAYS.
const REFRESH_DAYS = Number(process.env["REVIEWS_REFRESH_DAYS"] ?? "7");

async function hasFreshReviews(companyId: string): Promise<boolean> {
  if (REFRESH_DAYS <= 0) return false;
  const cutoff = new Date(Date.now() - REFRESH_DAYS * 24 * 60 * 60 * 1000);
  const recent = await prisma.review.findFirst({
    where: { companyId, source: "glassdoor", updatedAt: { gte: cutoff } },
    select: { id: true },
  });
  return recent !== null;
}

async function syncCompanyReviews(company: {
  id: string;
  name: string;
  glassdoorId: string | null;
  logoUrl: string | null;
}): Promise<number> {
  if (await hasFreshReviews(company.id)) {
    console.log("  ↳ fresh, skipping");
    return 0;
  }

  const { companyId, logoUrl, reviews } = await fetchGlassdoorReviews({
    companyName: company.name,
    glassdoorId: company.glassdoorId,
  });

  // Cache the resolved Glassdoor company id (and logo, if we don't have one)
  // so future runs skip the search call.
  const companyPatch: { glassdoorId?: string; logoUrl?: string } = {};
  if (companyId && companyId !== company.glassdoorId) companyPatch.glassdoorId = companyId;
  if (logoUrl && !company.logoUrl) companyPatch.logoUrl = logoUrl;
  if (Object.keys(companyPatch).length) {
    await prisma.company.update({ where: { id: company.id }, data: companyPatch });
  }

  let upserts = 0;
  for (const r of reviews) {
    await prisma.review.upsert({
      where: { source_externalId: { source: "glassdoor", externalId: r.externalId } },
      create: {
        companyId: company.id,
        userId: null,
        source: "glassdoor",
        rating: r.rating,
        title: r.title,
        body: r.body,
        pros: r.pros,
        cons: r.cons,
        authorTitle: r.authorTitle,
        externalId: r.externalId,
        ...(r.createdAt ? { createdAt: r.createdAt } : {}),
      },
      update: {
        rating: r.rating,
        title: r.title,
        body: r.body,
        pros: r.pros,
        cons: r.cons,
        authorTitle: r.authorTitle,
      },
    });
    upserts++;
  }
  return upserts;
}

async function main() {
  if (!glassdoorApiConfigured()) {
    console.error("Glassdoor reviews API not configured. Set RAPIDAPI_KEY to enable.");
    process.exit(1);
  }

  const companies = await prisma.company.findMany({
    where: { active: true },
    select: { id: true, name: true, glassdoorId: true, logoUrl: true },
  });

  console.log(`Fetching reviews for ${companies.length} companies...\n`);
  let total = 0;
  for (const company of companies) {
    console.log(`→ ${company.name}`);
    const n = await syncCompanyReviews(company);
    console.log(`  ✓ ${n} reviews`);
    total += n;
    // Stay within the API rate limit.
    await new Promise((r) => setTimeout(r, 500));
  }

  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`✓ ${total} reviews upserted across ${companies.length} companies`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
