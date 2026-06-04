import type { RecruiterContact, RecruiterProvider } from "./provider.js";

// Hunter.io adapter (https://hunter.io/api-documentation/v2#domain-search).
//
// Uses Domain Search to find emails at a company domain, then prefers a
// recruiting/HR/people contact. Falls back to a generic role inbox
// (jobs@, careers@, recruiting@) when no named recruiter is found.
//
// Configure with HUNTER_API_KEY. Without it, isConfigured() is false and the
// app simply relies on manually-set recruiter contacts.

const API_KEY = process.env["HUNTER_API_KEY"];
const BASE = "https://api.hunter.io/v2/domain-search";

const RECRUITER_HINTS = [
  "recruit",
  "talent",
  "people",
  "human resources",
  "hr ",
  "staffing",
  "sourcer",
  "hiring",
];

export class HunterProvider implements RecruiterProvider {
  readonly name = "hunter";

  isConfigured(): boolean {
    return Boolean(API_KEY);
  }

  async findByDomain(domain: string): Promise<RecruiterContact | null> {
    if (!this.isConfigured()) return null;
    try {
      const url = `${BASE}?domain=${encodeURIComponent(domain)}&limit=50&api_key=${API_KEY}`;
      const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
      if (!res.ok) return null;

      const json: any = await res.json();
      const emails: any[] = json?.data?.emails ?? [];
      if (emails.length === 0) return null;

      const best = pickRecruiter(emails);
      if (!best?.value) return null;

      const name = [best.first_name, best.last_name].filter(Boolean).join(" ").trim();
      return {
        name: name || null,
        title: best.position ?? null,
        email: best.value,
        confidence: typeof best.confidence === "number" ? best.confidence : null,
        source: this.name,
      };
    } catch {
      return null;
    }
  }
}

function pickRecruiter(emails: any[]): any | null {
  const scored = emails
    .filter((e) => e?.value)
    .map((e) => {
      const hay = `${e.position ?? ""} ${e.department ?? ""}`.toLowerCase();
      const isRecruiter = RECRUITER_HINTS.some((h) => hay.includes(h));
      const isHr = (e.department ?? "").toLowerCase() === "hr";
      const isGenericRole =
        e.type === "generic" && /^(jobs|careers|recruiting|talent|hr)@/i.test(e.value);
      let score = 0;
      if (isRecruiter) score += 5;
      if (isHr) score += 3;
      if (e.type === "personal") score += 2;
      if (isGenericRole) score += 1;
      score += (e.confidence ?? 0) / 100;
      return { e, score };
    })
    .sort((a, b) => b.score - a.score);

  return scored[0]?.score > 0 ? scored[0].e : null;
}

export const hunterProvider = new HunterProvider();
