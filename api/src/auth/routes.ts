import { Router, type Request, type Response } from "express";
import { prisma } from "../db.js";
import { hashPassword, verifyPassword } from "./passwords.js";
import { issueTokenPair, verifyRefreshToken } from "./tokens.js";
import { registerSchema, loginSchema, refreshSchema } from "./schemas.js";

export const authRouter = Router();

authRouter.post("/register", async (req: Request, res: Response) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid input", details: parsed.error.flatten() });
  }
  const { email, password } = parsed.data;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return res.status(409).json({ error: "Email already registered" });
  }

  const passwordHash = await hashPassword(password);

  const user = await prisma.user.create({
    data: {
      email,
      passwordHash,
      profile: { create: {} },
    },
    select: { id: true, email: true, verifiedTier: true, createdAt: true },
  });

  const tokens = issueTokenPair(user.id);
  return res.status(201).json({ user, ...tokens });
});

authRouter.post("/login", async (req: Request, res: Response) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid input" });
  }
  const { email, password } = parsed.data;

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    return res.status(401).json({ error: "Invalid email or password" });
  }

  const tokens = issueTokenPair(user.id);
  return res.json({
    user: {
      id: user.id,
      email: user.email,
      verifiedTier: user.verifiedTier,
      createdAt: user.createdAt,
    },
    ...tokens,
  });
});

authRouter.post("/refresh", async (req: Request, res: Response) => {
  const parsed = refreshSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid input" });
  }

  try {
    const { userId } = verifyRefreshToken(parsed.data.refreshToken);
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });
    if (!user) {
      return res.status(401).json({ error: "Invalid refresh token" });
    }
    const tokens = issueTokenPair(user.id);
    return res.json(tokens);
  } catch {
    return res.status(401).json({ error: "Invalid refresh token" });
  }
});
