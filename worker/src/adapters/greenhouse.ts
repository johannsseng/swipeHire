import { z } from "zod";

const greenhouseJobSchema = z.object({
  id: z.number(),
  title: z.string(),
  absolute_url: z.string().url(),
  content: z.string(),
  location: z.object({ name: z.string() }).nullable().optional(),
  departments: z
    .array(z.object({ name: z.string() }))
    .nullable()
    .optional(),
  updated_at: z.string(),
});

const greenhouseResponseSchema = z.object({
  jobs: z.array(greenhouseJobSchema),
});

export type GreenhouseJob = z.infer<typeof greenhouseJobSchema>;

export async function fetchGreenhouseJobs(
  boardToken: string
): Promise<GreenhouseJob[]> {
  const url = `https://boards-api.greenhouse.io/v1/boards/${boardToken}/jobs?content=true`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(
      `Greenhouse ${boardToken}: ${res.status} ${res.statusText}`
    );
  }
  const json = await res.json();
  const parsed = greenhouseResponseSchema.parse(json);
  return parsed.jobs;
}

export function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}