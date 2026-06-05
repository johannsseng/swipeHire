# SwipeHire

Swipe-to-apply job discovery. A pnpm monorepo:

| Package | What it is | Stack |
| --- | --- | --- |
| `api` | REST API | Express 5, Prisma, JWT auth |
| `worker` | Background jobs | tsx scripts (Greenhouse job sync, Glassdoor review sync) |
| `mobile` | iOS/Android app | Expo / React Native |
| `shared` | Shared types | — |

Database is **Postgres on Neon**. Reviews come from in-app users plus an optional
Glassdoor feed (RapidAPI). Recruiter outreach routes to a company careers inbox.

The API is deployed at **https://swipehire-api-vhsg.onrender.com**.

## Run the app against the live backend (teammates start here)

You do **not** need the database, API, or any API keys — the backend is already
deployed. Just run the mobile app and point it at production:

```bash
git clone https://github.com/2601-capstone-jobboard/swipeHire.git
cd swipeHire
pnpm install
cd mobile
cp .env.local.example .env.local      # already points at the live API
pnpm start                            # press i for iOS sim, a for Android, or scan the QR in Expo Go
```

Create an account in the app and start swiping — it's talking to the same
production database. (First request may take ~30–60s while the free instance
wakes up.) To run the full backend locally instead, see *Local setup* below.

## Prerequisites

- Node ≥ 20, `pnpm` (`corepack enable`)
- A Postgres database (Neon, or local via `docker compose up -d`)

## Local setup

```bash
pnpm install
cp .env.example .env          # fill in DATABASE_URL + JWT secrets
pnpm --filter @swipehire/api db:push       # create tables
pnpm --filter @swipehire/api db:generate   # generate Prisma client
```

Run each piece (separate terminals):

```bash
pnpm dev:api        # API on :3000
pnpm dev:worker     # worker (watch mode)
pnpm dev:mobile     # Expo — scan the QR with Expo Go
```

Mobile reads `EXPO_PUBLIC_API_URL` from `mobile/.env.local` (default `http://localhost:3000`).

## Common commands

```bash
pnpm -r typecheck                          # typecheck all packages
pnpm --filter @swipehire/api test          # API unit tests
pnpm --filter @swipehire/worker sync       # sync Greenhouse + Lever job boards
pnpm --filter @swipehire/worker sync:reviews   # sync Glassdoor reviews (needs RAPIDAPI_KEY)
pnpm --filter @swipehire/worker sync:jsearch   # aggregated jobs via JSearch (needs RAPIDAPI_KEY)
pnpm --filter @swipehire/worker enrich:domains # backfill company websites/logos (free, no key)
```

To use the **Admin** tab in the app, promote your user: `UPDATE users SET role='admin' WHERE email='you@example.com';`

## Environment variables

See `.env.example`. Required: `DATABASE_URL`, `JWT_SECRET`, `JWT_REFRESH_SECRET`.
Optional integrations (all dormant until set):

- `RESEND_API_KEY` + `OUTREACH_FROM_EMAIL` — send recruiter outreach emails
- `RAPIDAPI_KEY` — pull Glassdoor reviews via the Real-Time Glassdoor Data API
- `HUNTER_API_KEY` — auto-find a named recruiter contact
- `GLASSDOOR_PARTNER_ID` / `GLASSDOOR_API_KEY` — official Glassdoor partner feed

## Deployment

- **API + worker → Render**: `render.yaml` defines the web service and two cron
  jobs. Connect the repo as a Blueprint and fill the `swipehire` env group.
- **Mobile → EAS**: `mobile/eas.json` has dev/preview/production profiles. Run
  `eas init` then `eas build`. Set the production `EXPO_PUBLIC_API_URL` to your
  deployed API.
- Full step-by-step and a launch checklist: see **[DEPLOYMENT_CHECKLIST.md](./DEPLOYMENT_CHECKLIST.md)**.

> Use a **fresh Neon production branch** with `prisma migrate deploy` (not
> `db:push`) so schema changes are versioned.
