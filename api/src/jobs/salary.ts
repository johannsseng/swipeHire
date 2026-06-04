// Best-effort salary extraction from a job description.
//
// Job boards rarely expose structured pay data, but many descriptions include a
// pay range in the text. This pulls the first plausible range/figure so the UI
// can show *something* instead of always "Not disclosed". Returns null when no
// confident match is found. (For authoritative data, populate structured salary
// fields from the sync worker instead.)

const RANGE = String.raw`\$\s?\d{1,3}(?:,\d{3})*(?:\.\d+)?\s?[kK]?`;

const patterns: RegExp[] = [
  // $120,000 - $160,000  /  $120k–$160k  (range)
  new RegExp(`${RANGE}\\s?(?:-|–|—|to)\\s?${RANGE}(?:\\s?(?:per|/)\\s?(?:year|yr|hour|hr|month|mo))?`, "i"),
  // USD 120,000 — 160,000
  new RegExp(`USD\\s?\\d{1,3}(?:,\\d{3})*\\s?(?:-|–|—|to)\\s?\\d{1,3}(?:,\\d{3})*`, "i"),
  // single figure with a period: $150,000 per year  /  $45/hour
  new RegExp(`${RANGE}\\s?(?:per|/)\\s?(?:year|yr|hour|hr|month|mo)`, "i"),
];

export function extractSalary(text: string | null | undefined): string | null {
  if (!text) return null;
  // Strip HTML tags and collapse whitespace.
  const clean = text.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
  for (const re of patterns) {
    const m = clean.match(re);
    if (m) return m[0].trim();
  }
  return null;
}
