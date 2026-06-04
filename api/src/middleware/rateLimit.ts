import type { Request, Response, NextFunction } from "express";

// Lightweight in-memory rate limiter (no external dependency). Good enough for a
// single API instance to blunt brute-force and abuse. For multi-instance
// deployments, swap the Map for a shared Redis store (REDIS_URL is available).

type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();

// Occasional cleanup so the Map doesn't grow without bound.
let lastSweep = Date.now();
function sweep(now: number) {
  if (now - lastSweep < 60_000) return;
  lastSweep = now;
  for (const [key, b] of buckets) {
    if (now > b.resetAt) buckets.delete(key);
  }
}

export function rateLimit(opts: { windowMs: number; max: number; message?: string }) {
  const { windowMs, max, message = "Too many requests. Please slow down." } = opts;
  return (req: Request, res: Response, next: NextFunction) => {
    const now = Date.now();
    sweep(now);
    const key = `${req.ip ?? "unknown"}:${req.path}`;
    const bucket = buckets.get(key);

    if (!bucket || now > bucket.resetAt) {
      buckets.set(key, { count: 1, resetAt: now + windowMs });
      return next();
    }

    bucket.count += 1;
    if (bucket.count > max) {
      const retryAfter = Math.ceil((bucket.resetAt - now) / 1000);
      res.setHeader("Retry-After", String(retryAfter));
      return res.status(429).json({ error: message });
    }
    next();
  };
}
