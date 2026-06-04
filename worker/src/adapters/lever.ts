import { z } from "zod";

// Lever public postings API — same idea as Greenhouse's board API.
// https://api.lever.co/v0/postings/{site}?mode=json

const leverPostingSchema = z
  .object({
    id: z.string(),
    text: z.string(), // job title
    hostedUrl: z.string(),
    createdAt: z.number(),
    description: z.string().optional().default(""),
    descriptionPlain: z.string().optional().default(""),
    categories: z
      .object({
        location: z.string().nullable().optional(),
        commitment: z.string().nullable().optional(),
      })
      .partial()
      .optional(),
    workplaceType: z.string().nullable().optional(),
  })
  .passthrough();

export type LeverPosting = z.infer<typeof leverPostingSchema>;

export async function fetchLeverJobs(site: string): Promise<LeverPosting[]> {
  const res = await fetch(`https://api.lever.co/v0/postings/${site}?mode=json`);
  if (!res.ok) {
    throw new Error(`Lever ${site}: ${res.status} ${res.statusText}`);
  }
  const json = await res.json();
  if (!Array.isArray(json)) throw new Error(`Lever ${site}: unexpected response shape`);

  // Validate per-posting and skip malformed entries rather than failing the board.
  return json
    .map((p) => leverPostingSchema.safeParse(p))
    .filter((r): r is { success: true; data: LeverPosting } => r.success)
    .map((r) => r.data);
}
