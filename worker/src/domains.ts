import { prisma } from "./db.js";

// Domain backfill — proactively fills in each company's website (and logo)
// BEFORE any user opens it, so:
//   • the careers@<domain> outreach fallback works instantly for every company
//   • Hunter's lazy recruiter lookup has a domain to search the moment it's needed
//
// Uses Clearbit's free company-autocomplete endpoint (no API key, no quota).
// Companies it can't confidently match are skipped and logged — set those few
// by hand in the app's Admin tab.
//
// Run with:  pnpm enrich:domains   (in worker/)
// In production this is chained after the nightly job sync (see render.yaml).

type ClearbitSuggestion = { name: string; domain: string; logo: string | null };

async function lookupDomain(name: string): Promise<ClearbitSuggestion | null> {
  try {
    const res = await fetch(
      `https://autocomplete.clearbit.com/v1/companies/suggest?query=${encodeURIComponent(name)}`,
      { signal: AbortSignal.timeout(8000) }
    );
    if (!res.ok) return null;
    const suggestions: ClearbitSuggestion[] = await res.json();
    if (!Array.isArray(suggestions) || suggestions.length === 0) return null;

    // Prefer an exact (case-insensitive) name match; otherwise take the top
    // suggestion only if the names are reasonably similar.
    const lower = name.trim().toLowerCase();
    const exact = suggestions.find((s) => s.name?.trim().toLowerCase() === lower);
    if (exact?.domain) return exact;

    const first = suggestions[0];
    if (!first?.domain) return null;
    const firstLower = first.name?.trim().toLowerCase() ?? "";
    const similar = firstLower.includes(lower) || lower.includes(firstLower);
    return similar ? first : null;
  } catch {
    return null;
  }
}

async function main() {
  const companies = await prisma.company.findMany({
    where: { active: true, website: null },
    select: { id: true, name: true, logoUrl: true },
    orderBy: { name: "asc" },
  });

  if (companies.length === 0) {
    console.log("All active companies already have a website on file. Nothing to do.");
    return;
  }

  console.log(`Backfilling domains for ${companies.length} companies...\n`);
  let filled = 0;
  const misses: string[] = [];

  for (const company of companies) {
    const match = await lookupDomain(company.name);
    if (match?.domain) {
      await prisma.company.update({
        where: { id: company.id },
        data: {
          website: `https://${match.domain}`,
          ...(match.logo && !company.logoUrl ? { logoUrl: match.logo } : {}),
        },
      });
      console.log(`✓ ${company.name} → ${match.domain}`);
      filled++;
    } else {
      console.log(`– ${company.name}: no confident match (set manually in Admin)`);
      misses.push(company.name);
    }
    // Be polite to the free endpoint.
    await new Promise((r) => setTimeout(r, 300));
  }

  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`✓ ${filled}/${companies.length} domains filled`);
  if (misses.length) {
    console.log(`– needs manual entry: ${misses.join(", ")}`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
