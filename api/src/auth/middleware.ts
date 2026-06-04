import type { Request, Response, NextFunction } from "express";
import { verifyAccessToken } from "./tokens.js";

// Extend Express's Request type to include our userId
declare global {
  namespace Express {
    interface Request {
      userId?: string;
    }
  }
}

// Convenience alias for handlers behind requireAuth, where `userId` is set.
export type AuthedRequest = Request;

export function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    res.status(401).json({ error: "Missing or invalid Authorization header" });
    return;
  }

  const token = header.slice("Bearer ".length);

  try {
    const { userId } = verifyAccessToken(token);
    req.userId = userId;
    next();
  } catch {
    res.status(401).json({ error: "Invalid or expired token" });
  }
}
