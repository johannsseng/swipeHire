import * as SecureStore from "expo-secure-store";

const API_BASE = process.env.EXPO_PUBLIC_API_URL;
if (!API_BASE) {
  throw new Error(
    "EXPO_PUBLIC_API_URL is not set. Check mobile/.env.local"
  );
}

const ACCESS_KEY = "swipehire_access";
const REFRESH_KEY = "swipehire_refresh";

export async function setTokens(access: string, refresh: string) {
  await SecureStore.setItemAsync(ACCESS_KEY, access);
  await SecureStore.setItemAsync(REFRESH_KEY, refresh);
}

export async function getAccessToken() {
  return SecureStore.getItemAsync(ACCESS_KEY);
}

export async function clearTokens() {
  await SecureStore.deleteItemAsync(ACCESS_KEY);
  await SecureStore.deleteItemAsync(REFRESH_KEY);
}

async function request<T>(
  path: string,
  opts: { method?: string; body?: unknown; auth?: boolean } = {}
): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (opts.auth) {
    const token = await getAccessToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }
  const res = await fetch(`${API_BASE}${path}`, {
    method: opts.method ?? "GET",
    headers,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Network error" }));
    throw new Error(err.error ?? `HTTP ${res.status}`);
  }
  return res.json();
}

export type User = {
  id: string;
  email: string;
  verifiedTier: string;
};

type AuthResponse = {
  user: User;
  accessToken: string;
  refreshToken: string;
};

export const api = {
  register: (email: string, password: string) =>
    request<AuthResponse>("/auth/register", {
      method: "POST",
      body: { email, password },
    }),
  login: (email: string, password: string) =>
    request<AuthResponse>("/auth/login", {
      method: "POST",
      body: { email, password },
    }),
  me: () => request<User>("/me", { auth: true }),
};