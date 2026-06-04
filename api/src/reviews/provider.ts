// Reviews provider abstraction.
//
// SwipeHire's "swipe up for reviews" feature blends two sources:
//   1. In-app reviews written by SwipeHire users (stored in the `reviews` table).
//   2. External reviews pulled from a third-party provider (e.g. Glassdoor).
//
// External providers are pluggable behind this interface so the rest of the app
// never has to know where a review came from. Today only a Glassdoor adapter
// exists, and it stays dormant until partner credentials are configured.

export type ExternalReview = {
  source: "glassdoor";
  externalId: string;
  rating: number; // 1–5
  title: string | null;
  body: string | null;
  pros: string | null;
  cons: string | null;
  authorTitle: string | null;
  createdAt: string | null; // ISO date
};

export type ReviewLookup = {
  companyName: string;
  /** Provider-specific employer id, if we have one stored (e.g. Glassdoor employer id). */
  glassdoorId?: string | null;
  website?: string | null;
};

export interface ReviewProvider {
  readonly name: string;
  /** Whether this provider is configured and usable right now. */
  isConfigured(): boolean;
  /** Fetch external reviews for a company. Must never throw — return [] on failure. */
  fetch(lookup: ReviewLookup): Promise<ExternalReview[]>;
}
