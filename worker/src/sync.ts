import { prisma } from "./db.js";
import { fetchGreenhouseJobs, stripHtml } from "./adapters/greenhouse.js";
import { SEED_COMPANIES } from "./companies.js";

async function ensureCompany(name: string, boardToken: string) {
  return prisma.company.upsert({
    where: {
      source_boardToken: { source: "greenhouse", boardToken },
    },
    update: { name, active: true },
    create: { name, source: "greenhouse", boardToken, active: true },
  });
}

async function syncCompany(name: string, boardToken: string) {
  console.log(`→ ${name} (${boardToken})`);
  const company = await ensureCompany(name, boardToken);

  let jobs;
  try {
    jobs = await fetchGreenhouseJobs(boardToken);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`  ✗ fetch failed: ${msg}`);
    await prisma.company.update({
      where: { id: company.id },
      data: { syncError: msg, lastSyncedAt: new Date() },
    });
    return { name, ok: false, count: 0 };
  }

  let inserted = 0;
  for (const job of jobs) {
    const descriptionText = stripHtml(job.content);
    await prisma.job.upsert({
      where: {
        source_sourceId: { source: "greenhouse", sourceId: String(job.id) },
      },
      update: {
        title: job.title,
        location: job.location?.name ?? null,
        descriptionHtml: job.content,
        descriptionText,
        applyUrl: job.absolute_url,
        active: true,
        raw: job as object,
      },
      create: {
        companyId: company.id,
        source: "greenhouse",
        sourceId: String(job.id),
        title: job.title,
        location: job.location?.name ?? null,
        descriptionHtml: job.content,
        descriptionText,
        applyUrl: job.absolute_url,
        applyMethod: "deeplink",
        postedAt: new Date(job.updated_at),
        active: true,
        raw: job as object,
      },
    });
    inserted++;
  }

  await prisma.company.update({
    where: { id: company.id },
    data: { lastSyncedAt: new Date(), syncError: null },
  });

  console.log(`  ✓ ${inserted} jobs`);
  return { name, ok: true, count: inserted };
}

async function main() {
  console.log(`Syncing ${SEED_COMPANIES.length} companies from Greenhouse...\n`);
  const results = [];
  for (const { name, boardToken } of SEED_COMPANIES) {
    const result = await syncCompany(name, boardToken);
    results.push(result);
    // gentle rate limiting — Greenhouse doesn't care but it's polite
    await new Promise((r) => setTimeout(r, 250));
  }

  const ok = results.filter((r) => r.ok);
  const failed = results.filter((r) => !r.ok);
  const total = ok.reduce((sum, r) => sum + r.count, 0);

  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`✓ ${ok.length} companies synced, ${total} jobs total`);
  if (failed.length) {
    console.log(`✗ ${failed.length} companies failed:`);
    failed.forEach((r) => console.log(`  - ${r.name}`));
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });