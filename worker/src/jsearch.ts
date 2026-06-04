import { prisma } from "./db.js";

// JSearch (OpenWeb Ninja, via RapidAPI) — aggregated postings from LinkedIn,
// Indeed, ZipRecruiter, Glassdoor, and more, fetched by search query. Adds
// breadth beyond the Greenhouse/Lever company boards.
//
// Configure:
//   RAPIDAPI_KEY     — same key as the reviews API (subscribe to JSearch on RapidAPI)
//   JSEARCH_QUERIES  — comma-separated searches (default below)
//   JSEARCH_HOST     — defaults to jsearch.p.rapidapi.com
//
// Each query costs ~1 request. Run with:  pnpm sync:jsearch   (in worker/)

const RAPIDAPI_KEY = process.env["RAPIDAPI_KEY"];
const HOST = process.env["JSEARCH_HOST"] ?? "jsearch.p.rapidapi.com";
const QUERIES = (
  process.env["JSEARCH_QUERIES"] ??
  "software engineer in united states, product designer remote, data analyst remote"
)
  .split(",")
  .map((q) => q.trim())
  .filter(Boolean);

function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60);
}

function mapEmploymentType(t: unknown): "full_time" | "contract" | "intern" | null {
  if (typeof t !== "string") return null;
  if (/full/i.test(t)) return "full_time";
  if (/contract/i.test(t)) return "contract";
  if (/intern/i.test(t)) return "intern";
  return null;
}

async function searchJobs(query: string): Promise<any[]> {
  const url = `https://${HOST}/search?query=${encodeURIComponent(query)}&page=1&num_pages=1`;
  const res = await fetch(url, {
    headers: { "X-RapidAPI-Key": RAPIDAPI_KEY as string, "X-RapidAPI-Host": HOST },
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) throw new Error(`JSearch ${res.status} for "${query}"`);
  const json: any = await res.json();
  return Array.isArray(json?.data) ? json.data : [];
}

async function upsertResult(r: any): Promise<boolean> {
  const employer = typeof r.employer_name === "string" ? r.employer_name.trim() : "";
  const jobId = r.job_id ? String(r.job_id) : null;
  const title = typeof r.job_title === "string" ? r.job_title.trim() : "";
  const applyUrl = typeof r.job_apply_link === "string" ? r.job_apply_link : null;
  if (!employer || !jobId || !title || !applyUrl) return false;

  const company = await prisma.company.upsert({
    where: {
      source_boardToken: { source: "manual", boardToken: `jsearch:${slugify(employer)}` },
    },
    update: {
      name: employer,
      active: true,
      ...(r.employer_logo ? { logoUrl: r.employer_logo } : {}),
    },
    create: {
      name: employer,
      source: "manual",
      boardToken: `jsearch:${slugify(employer)}`,
      logoUrl: r.employer_logo ?? null,
      active: true,
    },
  });

  const location =
    [r.job_city, r.job_state, r.job_country].filter(Boolean).join(", ") || null;
  const postedAt = r.job_posted_at_datetime_utc ? new Date(r.job_posted_at_datetime_utc) : null;

  await prisma.job.upsert({
    where: { source_sourceId: { source: "manual", sourceId: `jsearch:${jobId}` } },
    update: {
      title,
      location,
      remote: Boolean(r.job_is_remote),
      employmentType: mapEmploymentType(r.job_employment_type),
      descriptionText: typeof r.job_description === "string" ? r.job_description : null,
      applyUrl,
      active: true,
      raw: r,
    },
    create: {
      companyId: company.id,
      source: "manual",
      sourceId: `jsearch:${jobId}`,
      title,
      location,
      remote: Boolean(r.job_is_remote),
      employmentType: mapEmploymentType(r.job_employment_type),
      descriptionHtml: null,
      descriptionText: typeof r.job_description === "string" ? r.job_description : null,
      applyUrl,
      applyMethod: "deeplink",
      postedAt: postedAt && !isNaN(postedAt.getTime()) ? postedAt : null,
      active: true,
      raw: r,
    },
  });
  return true;
}

async function main() {
  if (!RAPIDAPI_KEY) {
    console.error("JSearch not configured. Set RAPIDAPI_KEY (and subscribe to JSearch on RapidAPI).");
    process.exit(1);
  }

  console.log(`JSearch: ${QUERIES.length} quer${QUERIES.length === 1 ? "y" : "ies"}...\n`);
  let total = 0;
  for (const query of QUERIES) {
    console.log(`→ "${query}"`);
    try {
      const results = await searchJobs(query);
      let added = 0;
      for (const r of results) {
        if (await upsertResult(r)) added++;
      }
      console.log(`  ✓ ${added} jobs`);
      total += added;
    } catch (err) {
      console.warn(`  ✗ ${err instanceof Error ? err.message : String(err)}`);
    }
    await new Promise((r) => setTimeout(r, 1000));
  }

  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`✓ ${total} aggregated jobs upserted`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
