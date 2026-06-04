import { z } from "zod";

// Validate environment configuration at startup. Failing fast with a clear
// message beats discovering a missing secret on the first request in production.

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  API_PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  JWT_SECRET: z.string().min(16, "JWT_SECRET must be at least 16 chars"),
  JWT_REFRESH_SECRET: z.string().min(16, "JWT_REFRESH_SECRET must be at least 16 chars"),
  // Comma-separated list of allowed browser origins (production CORS).
  ALLOWED_ORIGINS: z.string().optional(),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  console.error("❌ Invalid environment configuration:");
  for (const [key, errs] of Object.entries(parsed.error.flatten().fieldErrors)) {
    console.error(`   - ${key}: ${(errs ?? []).join(", ")}`);
  }
  process.exit(1);
}

const env = parsed.data;

export const config = {
  ...env,
  isProd: env.NODE_ENV === "production",
  allowedOrigins:
    env.ALLOWED_ORIGINS?.split(",").map((s) => s.trim()).filter(Boolean) ?? [],
};
