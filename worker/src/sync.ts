import { prisma } from "./db.js";
import { fetchGreenhouseJobs, stripHtml, type GreenhouseJob } from "./adapters/greenhouse.js";
import { fetchLeverJobs, type LeverPosting } from "./adapters/lever.js";
import { SEED_COMPANIES, type SeedCompany } from "./companies.js";

// Source-agnostic job shape — each adapter normalizes into this.
type NormalizedJob = {
  sourceId: string;
  title: string;
  location: string | null;
  remote: boolean;
  employmentType: "full_time" | "contract" | "intern" | null;
  descriptionHtml: string | null;
  descriptionText: string | null;
  applyUrl: string;
  postedAt: Date | null;
  raw: object;
};

function normalizeGreenhouse(job: GreenhouseJob): NormalizedJob {
  const location = job.location?.name ?? null;
  return {
    sourceId: String(job.id),
    title: job.title,
    location,
    remote: /remote/i.test(location ?? ""),
    employmentType: null,
    descriptionHtml: job.content,
    descriptionText: stripHtml(job.content),
    applyUrl: job.absolute_url,
    postedAt: new Date(job.updated_at),
    raw: job as object,
  };
}

function mapCommitment(commitment: string | null | undefined): NormalizedJob["employmentType"] {
  if (!commitment) return null;
  if (/full[\s-]?time/i.test(commitment)) return "full_time";
  if (/contract|temp/i.test(commitment)) return "contract";
  if (/intern/i.test(commitment)) return "intern";
  return null;
}

function normalizeLever(p: LeverPosting): NormalizedJob {
  return {
    sourceId: p.id,
    title: p.text,
    location: p.categories?.location ?? null,
    remote: p.workplaceType === "remote",
    employmentType: mapCommitment(p.categories?.commitment),
    descriptionHtml: p.description || null,
    descriptionText: p.descriptionPlain || stripHtml(p.description ?? ""),
    applyUrl: p.hostedUrl,
    postedAt: new Date(p.createdAt),
    raw: p as object,
  };
}

async function fetchJobsFor(seed: SeedCompany): Promise<NormalizedJob[]> {
  if (seed.source === "lever") {
    return (await fetchLeverJobs(seed.boardToken)).map(normalizeLever);
  }
  return (await fetchGreenhouseJobs(seed.boardToken)).map(normalizeGreenhouse);
}

async function ensureCompany(seed: SeedCompany) {
  return prisma.company.upsert({
    where: {
      source_boardToken: { source: seed.source, boardToken: seed.boardToken },
    },
    update: { name: seed.name, active: true },
    create: { name: seed.name, source: seed.source, boardToken: seed.boardToken, active: true },
  });
}

async function syncCompany(seed: SeedCompany) {
  console.log(`→ ${seed.name} (${seed.source}/${seed.boardToken})`);
  const company = await ensureCompany(seed);

  let jobs: NormalizedJob[];
  try {
    jobs = await fetchJobsFor(seed);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`  ✗ fetch failed: ${msg}`);
    await prisma.company.update({
      where: { id: company.id },
      data: { syncError: msg, lastSyncedAt: new Date() },
    });
    return { name: seed.name, ok: false, count: 0 };
  }

  let inserted = 0;
  for (const job of jobs) {
    await prisma.job.upsert({
      where: {
        source_sourceId: { source: seed.source, sourceId: job.sourceId },
      },
      update: {
        title: job.title,
        location: job.location,
        remote: job.remote,
        employmentType: job.employmentType,
        descriptionHtml: job.descriptionHtml,
        descriptionText: job.descriptionText,
        applyUrl: job.applyUrl,
        active: true,
        raw: job.raw,
      },
      create: {
        companyId: company.id,
        source: seed.source,
        sourceId: job.sourceId,
        title: job.title,
        location: job.location,
        remote: job.remote,
        employmentType: job.employmentType,
        descriptionHtml: job.descriptionHtml,
        descriptionText: job.descriptionText,
        applyUrl: job.applyUrl,
        applyMethod: "deeplink",
        postedAt: job.postedAt,
        active: true,
        raw: job.raw,
      },
    });
    inserted++;
  }

  await prisma.company.update({
    where: { id: company.id },
    data: { lastSyncedAt: new Date(), syncError: null },
  });

  console.log(`  ✓ ${inserted} jobs`);
  return { name: seed.name, ok: true, count: inserted };
}

async function main() {
  console.log(`Syncing ${SEED_COMPANIES.length} companies (Greenhouse + Lever)...\n`);
  const results = [];
  for (const seed of SEED_COMPANIES) {
    const result = await syncCompany(seed);
    results.push(result);
    // gentle rate limiting — these APIs don't mind, but it's polite
    await new Promise((r) => setTimeout(r, 250));
  }

  const ok = results.filter((r) => r.ok);
  const failed = results.filter((r) => !r.ok);
  const total = ok.reduce((sum, r) => sum + r.count, 0);

  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`✓ ${ok.length} companies synced, ${total} jobs total`);
  if (failed.length) {
    console.log(`✗ ${failed.length} companies failed (bad/renamed board tokens are safe to prune):`);
    failed.forEach((r) => console.log(`  - ${r.name}`));
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
