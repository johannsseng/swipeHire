// Glassdoor reviews via the "Real-Time Glassdoor Data" API (OpenWeb Ninja),
// consumed through RapidAPI. Glassdoor's own API is enterprise-only, so this
// third-party service does the scraping and returns clean JSON.
//
// Configure (worker only):
//   RAPIDAPI_KEY            — your RapidAPI key
//   RAPIDAPI_GLASSDOOR_HOST — defaults to real-time-glassdoor-data.p.rapidapi.com
//   GLASSDOOR_REVIEWS_MAX   — optional cap per company (default 20)
//
// Flow: resolve a Glassdoor company_id (cached on Company.glassdoorId after the
// first lookup), then pull that company's reviews. Returns [] when unconfigured
// or on any error — a feed outage must never break the sync.

const RAPIDAPI_KEY = process.env["RAPIDAPI_KEY"];
const HOST = process.env["RAPIDAPI_GLASSDOOR_HOST"] ?? "real-time-glassdoor-data.p.rapidapi.com";
const MAX = Number(process.env["GLASSDOOR_REVIEWS_MAX"] ?? "20");

export type ScrapedReview = {
  externalId: string;
  rating: number; // 1–5
  title: string | null;
  body: string | null;
  pros: string | null;
  cons: string | null;
  authorTitle: string | null;
  createdAt: Date | null;
};

export function glassdoorApiConfigured(): boolean {
  return Boolean(RAPIDAPI_KEY);
}

function headers() {
  return { "X-RapidAPI-Key": RAPIDAPI_KEY as string, "X-RapidAPI-Host": HOST };
}

async function getJson(path: string): Promise<any | null> {
  try {
    const res = await fetch(`https://${HOST}${path}`, {
      headers: headers(),
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) {
      console.warn(`  ✗ glassdoor ${res.status} for ${path}`);
      return null;
    }
    return await res.json();
  } catch (err) {
    console.warn(`  ✗ glassdoor error: ${err instanceof Error ? err.message : String(err)}`);
    return null;
  }
}

async function resolveCompany(
  name: string
): Promise<{ id: string; logo: string | null } | null> {
  const json = await getJson(`/company-search?query=${encodeURIComponent(name)}`);
  const arr: any[] = json?.data ?? json?.results ?? (Array.isArray(json) ? json : []);
  const first = arr?.[0];
  if (first?.company_id == null) return null;
  return {
    id: String(first.company_id),
    logo: str(first.logo ?? first.company_logo ?? first.logo_url),
  };
}

export async function fetchGlassdoorReviews(input: {
  companyName: string;
  glassdoorId?: string | null;
}): Promise<{ companyId: string | null; logoUrl: string | null; reviews: ScrapedReview[] }> {
  if (!glassdoorApiConfigured()) return { companyId: null, logoUrl: null, reviews: [] };

  let logoUrl: string | null = null;
  let companyId = input.glassdoorId ?? null;
  if (!companyId) {
    const resolved = await resolveCompany(input.companyName);
    companyId = resolved?.id ?? null;
    logoUrl = resolved?.logo ?? null;
  }
  if (!companyId) return { companyId: null, logoUrl: null, reviews: [] };

  const json = await getJson(
    `/company-reviews?company_id=${encodeURIComponent(companyId)}` +
      `&page=1&sort=POPULAR&language=en&domain=www.glassdoor.com`
  );
  const data = json?.data ?? json;
  const raw: any[] = data?.reviews ?? [];

  const reviews = raw
    .map(mapReview)
    .filter((r): r is ScrapedReview => r !== null)
    .slice(0, MAX);

  return { companyId, logoUrl, reviews };
}

function mapReview(r: any): ScrapedReview | null {
  const rating = clampRating(Number(r.rating));
  if (!rating) return null;
  return {
    externalId: String(r.review_id ?? r.review_link ?? `${r.job_title ?? ""}:${r.review_datetime ?? ""}`),
    rating,
    title: str(r.summary),
    body: str(r.advice_to_management),
    pros: str(r.pros),
    cons: str(r.cons),
    authorTitle: str(r.job_title),
    createdAt: r.review_datetime ? safeDate(r.review_datetime) : null,
  };
}

function clampRating(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(5, Math.round(n)));
}

function str(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t.length ? t : null;
}

function safeDate(v: unknown): Date | null {
  const d = new Date(v as string);
  return isNaN(d.getTime()) ? null : d;
}
