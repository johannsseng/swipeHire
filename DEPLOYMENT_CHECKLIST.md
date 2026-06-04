# SwipeHire — Pre-Deployment Checklist

A go-live readiness list for the API, mobile app, and job-sync worker. Items
marked **[x]** are already done in the codebase. Items marked **[ ]** are
actions you need to take (mostly infrastructure, secrets, and hosting that can't
be done from inside the repo).

---

## 1. Security

- [x] Passwords hashed with bcrypt (`auth/passwords.ts`)
- [x] JWT access/refresh split with type checking (`auth/tokens.ts`)
- [x] Automatic access-token refresh on the client (`lib/api.ts`)
- [x] `helmet` security headers enabled
- [x] Request body size capped (1 MB)
- [x] Rate limiting on `/auth` endpoints (`middleware/rateLimit.ts`)
- [x] Central error handler — no stack traces leaked to clients
- [x] Startup env validation, fail-fast on missing secrets (`config.ts`)
- [x] CORS allowlist via `ALLOWED_ORIGINS` in production
- [ ] **Rotate all secrets** (`JWT_SECRET`, `JWT_REFRESH_SECRET`, DB password) before launch; never reuse dev values
- [ ] **Store secrets in a manager** (Doppler, AWS Secrets Manager, Render/Fly secrets) — not in `.env` committed anywhere
- [ ] Move rate limiting to a shared store (Redis) if running more than one API instance
- [ ] Add token revocation / logout-all (e.g. a `tokenVersion` on `User`) so stolen refresh tokens can be invalidated
- [ ] Enforce HTTPS everywhere (TLS termination at the proxy/load balancer)
- [ ] Run `pnpm audit` / `npm audit` and patch high-severity advisories

## 2. Configuration & Secrets

- [x] `.env.example` documents every variable
- [x] Optional integrations (Resend, Glassdoor) degrade gracefully when unset
- [ ] Set production `DATABASE_URL` (Neon prod branch, not dev)
- [ ] Set `NODE_ENV=production`
- [ ] Set `ALLOWED_ORIGINS` to your real web/app origins
- [ ] Set `RESEND_API_KEY` + `OUTREACH_FROM_EMAIL` (verify the sending domain in Resend) to enable recruiter outreach
- [ ] Confirm `JWT_ACCESS_TTL` (15m) and `JWT_REFRESH_TTL` (30d) match your security posture

## 3. Database (Neon / Postgres)

- [x] Prisma schema is the source of truth; client generated
- [x] Schema synced via `pnpm db:push`
- [ ] Switch to **migrations** for production (`prisma migrate deploy`) instead of `db:push`, so schema changes are versioned and reversible
- [ ] Use a dedicated **production Neon branch** with its own credentials
- [ ] Configure automated backups / point-in-time recovery
- [ ] Add a least-privilege DB role for the API (not the Neon owner)
- [ ] Load-test key queries; confirm indexes cover the feed, saved, and reviews paths
- [ ] Set a sane Prisma connection pool limit for serverless (Neon pooler / `?pgbouncer=true`)

## 4. API

- [x] `/health` endpoint for liveness checks
- [x] 404 + error middleware
- [x] Input validation with zod on all write routes
- [ ] Put the API behind a reverse proxy / managed host (Render, Fly, Railway, ECS)
- [ ] Configure structured logging (pino) + log shipping
- [ ] Add graceful shutdown (drain connections on SIGTERM)
- [ ] Set up CI to run `pnpm typecheck` + `pnpm lint` + tests on every PR
- [ ] Resolve or explicitly accept the pre-existing strict-`tsc` findings (Express 5 param typing, jwt overloads) — currently the app runs via `tsx` transpile-only

## 5. Mobile App

- [x] Tokens stored in `expo-secure-store` (not AsyncStorage)
- [x] Auto-refresh + auto-logout on dead session
- [x] Descriptions render cleanly (HTML entities decoded server-side)
- [ ] Set the production `EXPO_PUBLIC_API_URL` (HTTPS) in the build profile
- [ ] Configure EAS Build + app signing (iOS provisioning, Android keystore)
- [ ] Add app icons/splash for all sizes; set version + build numbers
- [ ] Add a crash/error reporter (Sentry)
- [ ] Test on physical iOS + Android devices, not just the simulator
- [ ] App Store / Play Store listings, privacy nutrition labels, screenshots
- [ ] Replace deprecated `SafeAreaView` from `react-native` with `react-native-safe-area-context` (warning in Metro logs)

## 6. Data & Sync Worker

- [x] Greenhouse adapter with HTML stripping for plain-text search
- [ ] Schedule the worker (cron / scheduled job) instead of manual runs — both `sync` (jobs) and `sync:reviews` (managed scraper)
- [x] Outreach routes to a **company inbox** (`careers@<domain>`) — no personal data stored or scraped (`outreach/inbox.ts`)
- [x] Glassdoor reviews via RapidAPI (`worker/.../reviewsRapidApi.ts`, `sync:reviews`) — runs in the background, off the request path
- [ ] Set each company's **website/domain** (admin `POST /companies/:id/recruiter`) so `careers@<domain>` resolves; or set a specific inbox there
- [ ] (Optional) `HUNTER_API_KEY` + `POST /companies/:id/recruiter/enrich` if you later want to auto-find a named contact
- [ ] Set `RAPIDAPI_KEY` (subscribe to "Real-Time Glassdoor Data" on RapidAPI) to enable Glassdoor reviews; **confirm you accept the source's ToS/legal terms**
- [ ] Promote a user to `admin` (DB `users.role`) to use the company admin endpoints
- [ ] Add structured salary fields + populate them (currently salary is best-effort extracted from the description text)
- [ ] Add alerting if a company's sync fails repeatedly (`Company.syncError`)
- [ ] Respect source rate limits / add retries with backoff

## 7. Observability

- [ ] Uptime monitoring on `/health` (Better Stack, Pingdom, etc.)
- [ ] Error tracking (Sentry) on API + mobile
- [ ] Metrics/dashboards (request rate, latency, error rate, DB pool usage)
- [ ] Log retention + alerting policy

## 8. Testing & QA

- [ ] Unit tests for auth, swipes, reviews, outreach, salary extraction
- [ ] Integration tests against a throwaway DB
- [ ] Manual QA pass of the core loop: register → feed → swipe → undo → save → unsave → detail → review → outreach
- [ ] Verify refresh-token flow by letting an access token expire mid-session

## 9. Legal & Compliance

- [ ] Privacy policy + terms of service (required by App/Play stores)
- [ ] Account deletion flow (App Store requirement) — wire a `DELETE /me`
- [ ] Confirm you have the right to display third-party job data and reviews
- [ ] GDPR/CCPA data-export & deletion handling if serving those regions

---

### Quick launch path (minimum viable production)

1. Provision a production Neon branch; set `DATABASE_URL`, `NODE_ENV=production`, fresh JWT secrets, and `ALLOWED_ORIGINS`.
2. Switch from `db:push` to `prisma migrate deploy`.
3. Deploy the API to a managed host behind HTTPS; point `/health` at uptime monitoring.
4. Add Sentry to API + mobile.
5. Build the app with EAS using the production `EXPO_PUBLIC_API_URL`; test on real devices.
6. Schedule the sync worker; populate recruiter contacts.
7. Publish privacy policy + terms; add account deletion.
