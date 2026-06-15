import { storageSet, storageGet, storageDelete } from "./storage";

const API_BASE = process.env.EXPO_PUBLIC_API_URL;
if (!API_BASE) {
  throw new Error(
    "EXPO_PUBLIC_API_URL is not set. Check mobile/.env.local"
  );
}

const ACCESS_KEY = "swipehire_access";
const REFRESH_KEY = "swipehire_refresh";

export async function setTokens(access: string, refresh: string) {
  await storageSet(ACCESS_KEY, access);
  await storageSet(REFRESH_KEY, refresh);
}

export async function getAccessToken() {
  return storageGet(ACCESS_KEY);
}

export async function getRefreshToken() {
  return storageGet(REFRESH_KEY);
}

export async function clearTokens() {
  await storageDelete(ACCESS_KEY);
  await storageDelete(REFRESH_KEY);
}

// Called when refresh fails and the session is truly dead, so the app can
// return the user to the login screen.
let onUnauthorized: (() => void) | null = null;
export function setUnauthorizedHandler(fn: (() => void) | null) {
  onUnauthorized = fn;
}

// Single-flight refresh: if many requests 401 at once, only one hits /auth/refresh.
let refreshing: Promise<boolean> | null = null;

async function refreshTokens(): Promise<boolean> {
  if (!refreshing) {
    refreshing = (async () => {
      const refreshToken = await getRefreshToken();
      if (!refreshToken) return false;
      try {
        const res = await fetch(`${API_BASE}/auth/refresh`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ refreshToken }),
        });
        if (!res.ok) return false;
        const data = await res.json();
        if (!data?.accessToken || !data?.refreshToken) return false;
        await setTokens(data.accessToken, data.refreshToken);
        return true;
      } catch {
        return false;
      }
    })().finally(() => {
      refreshing = null;
    });
  }
  return refreshing;
}

async function request<T>(
  path: string,
  opts: { method?: string; body?: unknown; auth?: boolean } = {},
  retried = false
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

  // Access token expired → transparently refresh once and retry.
  if (res.status === 401 && opts.auth && !retried) {
    const ok = await refreshTokens();
    if (ok) return request<T>(path, opts, true);
    await clearTokens();
    onUnauthorized?.();
    throw new Error("Session expired. Please log in again.");
  }

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
  role?: string;
};

export type AdminCompany = {
  id: string;
  name: string;
  website: string | null;
  recruiterEmail: string | null;
  recruiterName: string | null;
  inbox: { email: string | null; kind: "manual" | "careers" | null; label: string | null };
};

type AuthResponse = {
  user: User;
  accessToken: string;
  refreshToken: string;
};

export type Job = {
  id: string;
  title: string;
  company: string;
  companyLogoUrl: string | null;
  companyRating: number | null;
  companyReviewCount: number;
  location: string | null;
  remote: boolean | null;
  employmentType: string | null;
  descriptionHtml: string | null;
  descriptionText: string | null;
  applyUrl: string;
  postedAt: string;
};

export type TrackStatus =
  | "saved"
  | "applied"
  | "screening"
  | "interview"
  | "accepted"
  | "rejected";

export type SavedJob = {
  id: string;
  title: string;
  company: string;
  companyLogoUrl: string | null;
  companyRating: number | null;
  companyReviewCount: number;
  location: string | null;
  applyUrl: string;
  descriptionHtml: string | null;
  salary: string | null;
  trackStatus: TrackStatus;
  savedAt: string;
};

export type JobDetail = {
  id: string;
  title: string;
  company: string;
  companyLogoUrl: string | null;
  companyWebsite: string | null;
  location: string | null;
  remote: boolean | null;
  employmentType: string | null;
  descriptionHtml: string | null;
  salary: string | null;
  recruiter: { name: string | null; title: string | null; email: string | null };
  applyUrl: string;
  applyMethod: string | null;
  postedAt: string | null;
};

type FeedResponse = {
  items: Job[];
  nextCursor: string | null;
};

export type Review = {
  id: string;
  source: "in_app" | "glassdoor";
  rating: number;
  title: string | null;
  body: string | null;
  pros: string | null;
  cons: string | null;
  authorTitle: string | null;
  createdAt: string | null;
  isMine: boolean;
};

export type ReviewSummary = {
  averageRating: number | null;
  count: number;
  distribution: Record<"1" | "2" | "3" | "4" | "5", number>;
  providers: string[];
};

export type ReviewsResponse = {
  company: { name: string; logoUrl: string | null };
  summary: ReviewSummary;
  reviews: Review[];
};

export type OutreachDraft = {
  recruiter: { name: string | null; email: string | null };
  canSend: boolean;
  sendingConfigured: boolean;
  draft: { subject: string; body: string };
};

export type OutreachResult = {
  ok: boolean;
  sent: boolean;
  note?: string;
  error?: string;
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
  getResume: () =>
    request<{ hasResume: boolean; keywordCount: number; updatedAt: string | null }>(
      "/me/resume",
      { auth: true }
    ),
  saveResume: (resumeText: string) =>
    request<{ ok: boolean; keywordCount: number }>("/me/resume", {
      method: "PUT",
      body: { resumeText },
      auth: true,
    }),
  updateEmail: (currentPassword: string, newEmail: string) =>
    request<{ ok: boolean; user: User }>("/me/email", {
      method: "PATCH",
      body: { currentPassword, newEmail },
      auth: true,
    }),
  updatePassword: (currentPassword: string, newPassword: string) =>
    request<{ ok: boolean }>("/me/password", {
      method: "PATCH",
      body: { currentPassword, newPassword },
      auth: true,
    }),
  deleteAccount: () =>
    request<{ ok: boolean }>("/me", { method: "DELETE", auth: true }),
  getFeed: (cursor?: string) =>
    request<FeedResponse>(
      `/jobs/feed?limit=20${cursor ? `&cursor=${cursor}` : ""}`,
      { auth: true }
    ),
  swipe: (jobId: string, direction: "left" | "right") =>
    request<{ ok: boolean }>("/swipes", {
      method: "POST",
      body: { jobId, direction },
      auth: true,
    }),
  // Undo the most recent swipe; returns the job so it can be re-added to the deck.
  undoSwipe: () =>
    request<{ ok: boolean; job: Job }>("/swipes/undo", {
      method: "POST",
      auth: true,
    }),
  // Update the pipeline stage of a saved job (applied, interview, …).
  setTrackStatus: (jobId: string, status: TrackStatus) =>
    request<{ ok: boolean }>(`/swipes/${jobId}/status`, {
      method: "PATCH",
      body: { status },
      auth: true,
    }),
  // Remove a swipe for a specific job (used to unsave a saved job).
  unsave: (jobId: string) =>
    request<{ ok: boolean }>(`/swipes/${jobId}`, {
      method: "DELETE",
      auth: true,
    }),
  getSaved: () =>
    request<{ items: SavedJob[] }>("/jobs/saved", { auth: true }),
  getJob: (jobId: string) =>
    request<JobDetail>(`/jobs/${jobId}`, { auth: true }),
  getReviews: (jobId: string) =>
    request<ReviewsResponse>(`/jobs/${jobId}/reviews`, { auth: true }),
  submitReview: (
    jobId: string,
    review: {
      rating: number;
      title?: string;
      body?: string;
      pros?: string;
      cons?: string;
      authorTitle?: string;
    }
  ) =>
    request<{ ok: boolean }>(`/jobs/${jobId}/reviews`, {
      method: "POST",
      body: review,
      auth: true,
    }),
  getOutreachDraft: (jobId: string) =>
    request<OutreachDraft>(`/jobs/${jobId}/outreach/draft`, { auth: true }),
  sendOutreach: (jobId: string, payload?: { subject?: string; body?: string }) =>
    request<OutreachResult>(`/jobs/${jobId}/outreach`, {
      method: "POST",
      body: payload ?? {},
      auth: true,
    }),

  // ─── Admin ───────────────────────────────────────────────────────────────
  adminListCompanies: () =>
    request<{ items: AdminCompany[] }>("/companies", { auth: true }),
  adminSetCompany: (
    id: string,
    payload: { website?: string; email?: string; name?: string; title?: string }
  ) =>
    request<{ ok: boolean; company: AdminCompany }>(`/companies/${id}/recruiter`, {
      method: "POST",
      body: payload,
      auth: true,
    }),
};