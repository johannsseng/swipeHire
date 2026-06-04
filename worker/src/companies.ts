// Seed companies for the job sync, across both public board APIs.
//
// A wrong/renamed board token is harmless: the sync logs "✗ fetch failed" for
// that company, records Company.syncError, and moves on. Prune failures freely.

export type SeedSource = "greenhouse" | "lever";

export type SeedCompany = {
  name: string;
  boardToken: string;
  source: SeedSource;
};

const greenhouse = (name: string, boardToken: string): SeedCompany => ({
  name,
  boardToken,
  source: "greenhouse",
});
const lever = (name: string, boardToken: string): SeedCompany => ({
  name,
  boardToken,
  source: "lever",
});

export const SEED_COMPANIES: SeedCompany[] = [
  // ── Greenhouse (original set) ──────────────────────────────────────────────
  greenhouse("Stripe", "stripe"),
  greenhouse("Anthropic", "anthropic"),
  greenhouse("Vercel", "vercel"),
  greenhouse("Airbnb", "airbnb"),
  greenhouse("Cloudflare", "cloudflare"),
  greenhouse("Robinhood", "robinhood"),
  greenhouse("Discord", "discord"),
  greenhouse("Notion", "notion"),
  greenhouse("OpenAI", "openai"),
  greenhouse("Figma", "figma"),
  greenhouse("Linear", "linear"),
  greenhouse("Plaid", "plaid"),
  greenhouse("Brex", "brex"),
  greenhouse("Ramp", "ramp"),
  greenhouse("Mercury", "mercury"),
  greenhouse("Retool", "retool"),
  greenhouse("Scale", "scaleai"),
  greenhouse("Webflow", "webflow"),
  greenhouse("Coinbase", "coinbase"),
  greenhouse("Reddit", "reddit"),

  // ── Greenhouse (expansion) ─────────────────────────────────────────────────
  greenhouse("Databricks", "databricks"),
  greenhouse("GitLab", "gitlab"),
  greenhouse("Instacart", "instacart"),
  greenhouse("DoorDash", "doordashusa"),
  greenhouse("Pinterest", "pinterest"),
  greenhouse("Lyft", "lyft"),
  greenhouse("Affirm", "affirm"),
  greenhouse("Flexport", "flexport"),
  greenhouse("Samsara", "samsara"),
  greenhouse("Gusto", "gusto"),
  greenhouse("Airtable", "airtable"),
  greenhouse("Asana", "asana"),
  greenhouse("Twitch", "twitch"),
  greenhouse("Duolingo", "duolingo"),
  greenhouse("MongoDB", "mongodb"),
  greenhouse("Elastic", "elastic"),
  greenhouse("HashiCorp", "hashicorp"),
  greenhouse("Datadog", "datadog"),
  greenhouse("Okta", "okta"),
  greenhouse("Cockroach Labs", "cockroachlabs"),
  greenhouse("Grammarly", "grammarly"),
  greenhouse("Chime", "chime"),
  greenhouse("Faire", "faire"),
  greenhouse("Checkr", "checkr"),
  greenhouse("Lattice", "lattice"),
  greenhouse("Calendly", "calendly"),
  greenhouse("Postman", "postman"),
  greenhouse("Intercom", "intercom"),
  greenhouse("Amplitude", "amplitude"),
  greenhouse("Netlify", "netlify"),
  greenhouse("Vanta", "vanta"),
  greenhouse("Carta", "carta"),
  greenhouse("Klaviyo", "klaviyo"),
  greenhouse("Strava", "strava"),
  greenhouse("Roblox", "roblox"),
  greenhouse("Squarespace", "squarespace"),
  greenhouse("Dropbox", "dropbox"),
  greenhouse("Benchling", "benchling"),
  greenhouse("Rippling", "rippling"),
  greenhouse("Zscaler", "zscaler"),

  // ── Lever ──────────────────────────────────────────────────────────────────
  lever("Palantir", "palantir"),
  lever("Anduril", "anduril"),
  lever("Zoox", "zoox"),
  lever("Kraken", "kraken"),
  lever("Mistral AI", "mistral"),
  lever("Whatnot", "whatnot"),
  lever("Veho", "veho"),
  lever("Shield AI", "shieldai"),
  lever("Voleon", "voleon"),
  lever("Attentive", "attentive"),
];
