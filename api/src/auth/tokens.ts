import jwt, { type SignOptions } from "jsonwebtoken";

const ACCESS_SECRET = process.env["JWT_SECRET"];
const REFRESH_SECRET = process.env["JWT_REFRESH_SECRET"];
const ACCESS_TTL = process.env["JWT_ACCESS_TTL"] ?? "15m";
const REFRESH_TTL = process.env["JWT_REFRESH_TTL"] ?? "30d";

if (!ACCESS_SECRET || !REFRESH_SECRET) {
  throw new Error("JWT_SECRET and JWT_REFRESH_SECRET must be set");
}

export type TokenPayload = {
  userId: string;
  type: "access" | "refresh";
};

export function signAccessToken(userId: string): string {
  return jwt.sign({ userId, type: "access" }, ACCESS_SECRET, {
    expiresIn: ACCESS_TTL,
  } as SignOptions);
}

export function signRefreshToken(userId: string): string {
  return jwt.sign({ userId, type: "refresh" }, REFRESH_SECRET, {
    expiresIn: REFRESH_TTL,
  } as SignOptions);
}

export function verifyAccessToken(token: string): TokenPayload {
  const payload = jwt.verify(token, ACCESS_SECRET) as TokenPayload;
  if (payload.type !== "access") {
    throw new Error("Wrong token type");
  }
  return payload;
}

export function verifyRefreshToken(token: string): TokenPayload {
  const payload = jwt.verify(token, REFRESH_SECRET) as TokenPayload;
  if (payload.type !== "refresh") {
    throw new Error("Wrong token type");
  }
  return payload;
}

export function issueTokenPair(userId: string): {
  accessToken: string;
  refreshToken: string;
} {
  return {
    accessToken: signAccessToken(userId),
    refreshToken: signRefreshToken(userId),
  };
}
