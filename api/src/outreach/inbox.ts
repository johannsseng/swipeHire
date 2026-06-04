// Resolves a NON-PERSONAL company inbox to route outreach to.
//
// Privacy-first: we don't store or scrape personal recruiter emails. Outreach
// goes to a company role inbox instead. Resolution order:
//   1. A manually-set address on the company (admin override), if present.
//   2. careers@<company-domain>, derived from the company website.
//   3. Nothing — the UI then shows a copy-only draft + the apply link.

export type CompanyInbox = {
  email: string | null;
  label: string | null; // human label for the UI
  kind: "manual" | "careers" | null;
};

function domainOf(website: string | null | undefined): string | null {
  if (!website) return null;
  let s = website.trim().toLowerCase();
  if (!/^https?:\/\//.test(s)) s = `https://${s}`;
  try {
    const host = new URL(s).hostname.replace(/^www\./, "");
    return host && host.includes(".") ? host : null;
  } catch {
    return null;
  }
}

export function resolveCompanyInbox(company: {
  recruiterEmail: string | null;
  recruiterName?: string | null;
  website: string | null;
}): CompanyInbox {
  if (company.recruiterEmail) {
    return {
      email: company.recruiterEmail,
      label: company.recruiterName ?? "Hiring contact",
      kind: "manual",
    };
  }
  const domain = domainOf(company.website);
  if (domain) {
    return { email: `careers@${domain}`, label: "Company careers inbox", kind: "careers" };
  }
  return { email: null, label: null, kind: null };
}
