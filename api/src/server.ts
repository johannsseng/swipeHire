import express, {
  type Express,
  type Request,
  type Response,
  type NextFunction,
} from "express";
import cors from "cors";
import helmet from "helmet";
import { config } from "./config.js";
import { rateLimit } from "./middleware/rateLimit.js";
import { authRouter } from "./auth/routes.js";
import { usersRouter } from "./users/routes.js";
import { jobsRouter } from "./jobs/routes.js";
import { swipesRouter } from "./swipes/routes.js";
import { companiesRouter } from "./companies/routes.js";

export function createServer(): Express {
  const app = express();

  if (config.isProd) {
    // Trust the first proxy hop so req.ip reflects the real client (rate limiting).
    app.set("trust proxy", 1);
  }

  app.use(helmet());

  // In production, lock CORS to an explicit allowlist if one is configured.
  const corsOptions =
    config.isProd && config.allowedOrigins.length
      ? { origin: config.allowedOrigins, credentials: true }
      : { origin: true, credentials: true };
  app.use(cors(corsOptions));

  app.use(express.json({ limit: "1mb" }));

  app.get("/health", (_req, res) => {
    res.json({ ok: true, timestamp: new Date().toISOString() });
  });

  // Throttle auth endpoints to slow credential stuffing / brute force.
  app.use("/auth", rateLimit({ windowMs: 15 * 60 * 1000, max: 50 }), authRouter);
  app.use("/jobs", jobsRouter);
  app.use("/swipes", swipesRouter);
  app.use("/companies", companiesRouter);
  app.use(usersRouter); // mounted at root so routes are /me, /me/profile

  // 404 for unmatched routes.
  app.use((_req, res) => {
    res.status(404).json({ error: "Not found" });
  });

  // Central error handler — never leak stack traces to clients.
  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    console.error("Unhandled error:", err);
    if (res.headersSent) return;
    res.status(500).json({ error: "Internal server error" });
  });

  return app;
}
