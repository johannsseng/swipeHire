import type { ExternalReview, ReviewLookup, ReviewProvider } from "./provider.js";

// Glassdoor reviews adapter.
//
// IMPORTANT: Glassdoor closed its public Employer Reviews API to new partners
// years ago. There is no self-serve key. This adapter therefore stays dormant
// unless BOTH env vars below are present (i.e. you have negotiated partner
// access). When they are absent, isConfigured() returns false and the rest of
// the app simply shows in-app reviews only — no errors, no empty UI states.
//
// The request shape below follows Glassdoor's legacy partner API so that the
// day you get credentials you only need to set the env vars. Adjust field
// mapping to match whatever contract your partner agreement specifies.

const PARTNER_ID = process.env["GLASSDOOR_PARTNER_ID"];
const API_KEY = process.env["GLASSDOOR_API_KEY"];
const BASE_URL =
  process.env["GLASSDOOR_API_URL"] ?? "https://api.glassdoor.com/api/api.htm";

export class GlassdoorProvider implements ReviewProvider {
  readonly name = "glassdoor";

  isConfigured(): boolean {
    return Boolean(PARTNER_ID && API_KEY);
  }

  async fetch(lookup: ReviewLookup): Promise<ExternalReview[]> {
    if (!this.isConfigured()) return [];

    try {
      const params = new URLSearchParams({
        "v": "1",
        "format": "json",
        "t.p": PARTNER_ID!,
        "t.k": API_KEY!,
        "action": "employers",
        "q": lookup.companyName,
      });
      if (lookup.glassdoorId) params.set("employerId", lookup.glassdoorId);

      const res = await fetch(`${BASE_URL}?${params.toString()}`, {
        headers: { "User-Agent": "SwipeHire/1.0" },
        signal: AbortSignal.timeout(5000),
      });
      if (!res.ok) return [];

      const data: any = await res.json();
      const employer = data?.response?.employers?.[0];
      if (!employer) return [];

      const featured = employer.featuredReview;
      const reviews: ExternalReview[] = [];

      if (featured) {
        reviews.push(mapReview(featured, employer.id));
      }

      return reviews;
    } catch {
      // Never let an external outage break the reviews endpoint.
      return [];
    }
  }
}

function mapReview(r: any, employerId: string | number): ExternalReview {
  return {
    source: "glassdoor",
    externalId: String(r.id ?? `${employerId}:${r.reviewDateTime ?? ""}`),
    rating: clampRating(Number(r.overall ?? r.overallRating ?? 0)),
    title: r.headline ?? null,
    body: r.summary ?? null,
    pros: r.pros ?? null,
    cons: r.cons ?? null,
    authorTitle: r.jobTitle ?? null,
    createdAt: r.reviewDateTime ?? null,
  };
}

function clampRating(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(5, Math.round(n)));
}

export const glassdoorProvider = new GlassdoorProvider();
