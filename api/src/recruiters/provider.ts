// Recruiter-contact provider abstraction.
//
// The outreach feature needs a recruiter email on each company. Rather than
// hardcode one data source, contacts come from a pluggable provider so you can
// swap Hunter.io for Apollo/PDL/etc. without touching the rest of the app.
// Providers stay dormant until their API key is configured.

export type RecruiterContact = {
  name: string | null;
  title: string | null;
  email: string;
  /** 0–100 confidence if the provider supplies it (e.g. Hunter's score). */
  confidence: number | null;
  source: string; // provider name, for auditing
};

export interface RecruiterProvider {
  readonly name: string;
  isConfigured(): boolean;
  /** Find the best recruiting contact for a company domain. Never throws. */
  findByDomain(domain: string): Promise<RecruiterContact | null>;
}
