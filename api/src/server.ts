import express, { type Express } from "express";
import cors from "cors";
import helmet from "helmet";
import { authRouter } from "./auth/routes.js";
import { usersRouter } from "./users/routes.js";
import { jobsRouter } from "./jobs/routes.js";

export function createServer(): Express {
  const app = express();

  app.use(helmet());
  app.use(cors({ origin: true, credentials: true }));
  app.use(express.json({ limit: "1mb" }));

  app.get("/health", (_req, res) => {
    res.json({ ok: true, timestamp: new Date().toISOString() });
  });

  app.use("/auth", authRouter);
  app.use("/jobs", jobsRouter);
  app.use(usersRouter); // mounted at root so routes are /me, /me/profile

  return app;
}
