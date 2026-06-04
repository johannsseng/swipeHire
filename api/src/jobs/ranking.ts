// SmartFeed — two-layer job ranking, no ML infra required.
//
//   Layer 1 — RESUME SCANNER: keywords extracted from the user's resume are
//   matched against each job's title and description. This is the base
//   relevance signal and works from the moment a resume is on file.
//
//   Layer 2 — SWIPE LEARNER: lightweight keyword/company/remote preferences
//   learned from swipe history refine (and can override) the base layer as
//   the user uses the app.
//
//   Plus quality (company rating, disclosed salary) and freshness signals.
//
// Pure functions only — unit-tested in ranking.test.ts.

const STOPWORDS = new Set([
  "the", "and", "for", "with", "you", "are", "our", "your", "this", "that",
  "will", "have", "from", "about", "who", "what", "all", "can", "job", "role",
  "team", "work", "new", "years", "experience", "skills", "ability",
  "remote", // handled as a dedicated signal, not a keyword
]);

export function tokenize(text: string | null | undefined): string[] {
  if (!text) return [];
  return text
    .toLowerCase()
    .replace(/[^a-z0-9+#\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length >= 3 && !STOPWORDS.has(t));
}

// ─── Layer 1: resume scanner ────────────────────────────────────────────────

export type ResumeKeywords = Record<string, number>;

/**
 * Distill pasted resume text into weighted keywords. Frequency is dampened
 * (log scale) so "javascript ×12" doesn't drown out everything else.
 */
export function buildResumeKeywords(resumeText: string | null | undefined): ResumeKeywords {
  const counts = new Map<string, number>();
  for (const t of tokenize(resumeText)) {
    counts.set(t, (counts.get(t) ?? 0) + 1);
  }
  const keywords: ResumeKeywords = {};
  for (const [token, count] of counts) {
    keywords[token] = Math.round((1 + Math.log(count)) * 100) / 100;
  }
  return keywords;
}

function resumeMatchScore(
  keywords: ResumeKeywords,
  job: { title: string; descriptionText?: string | null }
): number {
  const entries = Object.keys(keywords);
  if (entries.length === 0) return 0;

  let score = 0;
  // Title hits are the strongest resume signal.
  for (const t of new Set(tokenize(job.title))) {
    if (keywords[t]) score += keywords[t] * 2;
  }
  // Description hits: count distinct overlapping keywords, capped so long
  // generic descriptions don't run away with it.
  const desc = job.descriptionText?.slice(0, 1500);
  if (desc) {
    let hits = 0;
    for (const t of new Set(tokenize(desc))) {
      if (keywords[t]) hits += 1;
    }
    score += Math.min(hits, 12) * 0.35;
  }
  return score;
}

// ─── Layer 2: swipe learner ─────────────────────────────────────────────────

export type SwipeSignal = {
  direction: "left" | "right";
  title: string;
  companyId: string;
  remote: boolean;
};

export type Taste = {
  tokenWeights: Map<string, number>;
  companyWeights: Map<string, number>;
  /** -1 (avoids remote) .. +1 (prefers remote). 0 until enough signal. */
  remoteAffinity: number;
};

export function buildTaste(swipes: SwipeSignal[], profileText?: string | null): Taste {
  const tokenWeights = new Map<string, number>();
  const companyWeights = new Map<string, number>();
  let saves = 0;
  let remoteSaves = 0;

  for (const s of swipes) {
    // Saves teach us more than passes; passes still push gently away.
    const w = s.direction === "right" ? 1 : -0.4;
    for (const t of new Set(tokenize(s.title))) {
      tokenWeights.set(t, (tokenWeights.get(t) ?? 0) + w);
    }
    companyWeights.set(
      s.companyId,
      (companyWeights.get(s.companyId) ?? 0) + (s.direction === "right" ? 2 : -1)
    );
    if (s.direction === "right") {
      saves++;
      if (s.remote) remoteSaves++;
    }
  }

  // Headline/bio keywords act as a soft prior for brand-new swipers.
  for (const t of new Set(tokenize(profileText))) {
    tokenWeights.set(t, (tokenWeights.get(t) ?? 0) + 0.7);
  }

  const remoteAffinity = saves >= 3 ? (remoteSaves / saves - 0.5) * 2 : 0;
  return { tokenWeights, companyWeights, remoteAffinity };
}

// ─── Combined score ─────────────────────────────────────────────────────────

export type ScorableJob = {
  title: string;
  companyId: string;
  remote: boolean;
  postedAt: Date | null;
  descriptionText?: string | null;
};

export function scoreJob(
  job: ScorableJob,
  signals: {
    resume?: ResumeKeywords;
    taste?: Taste;
    rating?: { avg: number; count: number };
    hasSalary?: boolean;
  }
): number {
  let score = 0;

  // Layer 1 — resume scanner.
  if (signals.resume) score += resumeMatchScore(signals.resume, job);

  // Layer 2 — swipe learner.
  const taste = signals.taste;
  if (taste) {
    for (const t of new Set(tokenize(job.title))) {
      score += (taste.tokenWeights.get(t) ?? 0) * 1.5;
    }
    score += taste.companyWeights.get(job.companyId) ?? 0;
    score += (job.remote ? 1 : -1) * taste.remoteAffinity * 1.2;
  }

  // Quality: company rating (centered at 3★) and disclosed salary.
  if (signals.rating && signals.rating.count > 0) {
    score += (signals.rating.avg - 3) * 0.8;
  }
  if (signals.hasSalary) score += 0.5;

  // Freshness: linear boost fading to zero over three weeks.
  if (job.postedAt) {
    const days = (Date.now() - job.postedAt.getTime()) / 86_400_000;
    score += Math.max(0, (21 - days) / 21) * 1.5;
  }

  return score;
}
