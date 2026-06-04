import { prisma } from "../db.js";
import { hunterProvider } from "./hunter.js";
import type { RecruiterProvider } from "./provider.js";

const provider: RecruiterProvider = hunterProvider;

export function recruiterEnrichmentConfigured(): boolean {
  return provider.isConfigured();
}

/** Pull a hostname out of a website URL or bare domain. */
export function normalizeDomain(input: string | null | undefined): string | null {
  if (!input) return null;
  let s = input.trim().toLowerCase();
  if (!/^https?:\/\//.test(s)) s = `https://${s}`;
  try {
    const host = new URL(s).hostname.replace(/^www\./, "");
    return host || null;
  } catch {
    return null;
  }
}

export type EnrichResult =
  | { ok: true; updated: boolean; email: string | null }
  | { ok: false; reason: string };

const ENRICH_RETRY_DAYS = 30;

export type RecruiterContactFields = {
  recruiterName: string | null;
  recruiterEmail: string | null;
  recruiterTitle: string | null;
};

/**
 * Lazy auto-enrichment: if a company has no recruiter contact, try Hunter once
 * (per ENRICH_RETRY_DAYS) and persist whatever it finds. Returns the freshest
 * contact fields either way, so callers can resolve the outreach inbox without
 * re-querying. Quota-friendly: at most one Hunter call per company per month,
 * skipped entirely when Hunter isn't configured or there's no domain.
 */
export async function ensureRecruiterContact(company: {
  id: string;
  website: string | null;
  recruiterName: string | null;
  recruiterEmail: string | null;
  recruiterTitle: string | null;
  recruiterEnrichedAt: Date | null;
}): Promise<RecruiterContactFields> {
  const current: RecruiterContactFields = {
    recruiterName: company.recruiterName,
    recruiterEmail: company.recruiterEmail,
    recruiterTitle: company.recruiterTitle,
  };

  if (company.recruiterEmail) return current; // already have a contact
  if (!provider.isConfigured()) return current;

  const domain = normalizeDomain(company.website);
  if (!domain) return current;

  const triedRecently =
    company.recruiterEnrichedAt &&
    Date.now() - company.recruiterEnrichedAt.getTime() < ENRICH_RETRY_DAYS * 86_400_000;
  if (triedRecently) return current;

  const contact = await provider.findByDomain(domain);
  await prisma.company.update({
    where: { id: company.id },
    data: {
      recruiterEnrichedAt: new Date(),
      ...(contact
        ? {
            recruiterName: contact.name,
            recruiterEmail: contact.email,
            recruiterTitle: contact.title,
          }
        : {}),
    },
  });

  return contact
    ? { recruiterName: contact.name, recruiterEmail: contact.email, recruiterTitle: contact.title }
    : current;
}

/**
 * Find and persist a recruiter contact for a company using the configured
 * provider. `domainOverride` lets an admin supply the domain when the company
 * record has no website.
 */
export async function enrichCompanyRecruiter(
  companyId: string,
  domainOverride?: string
): Promise<EnrichResult> {
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { id: true, website: true, recruiterEmail: true },
  });
  if (!company) return { ok: false, reason: "Company not found" };

  if (!provider.isConfigured()) {
    return { ok: false, reason: `${provider.name} not configured (set HUNTER_API_KEY)` };
  }

  const domain = normalizeDomain(domainOverride ?? company.website);
  if (!domain) {
    return { ok: false, reason: "No company domain available — provide one to enrich" };
  }

  const contact = await provider.findByDomain(domain);
  if (!contact) {
    return { ok: true, updated: false, email: company.recruiterEmail };
  }

  await prisma.company.update({
    where: { id: companyId },
    data: {
      recruiterName: contact.name,
      recruiterEmail: contact.email,
      recruiterTitle: contact.title,
    },
  });

  return { ok: true, updated: true, email: contact.email };
}
