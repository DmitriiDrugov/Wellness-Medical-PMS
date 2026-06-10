# Deployment — Supabase + Vercel

This app is a Next.js 14 (App Router) modular monolith: client-rendered UI under
`app/(app)/**` and a REST API under `app/api/**`, backed by Prisma + PostgreSQL
(Supabase) and JWT auth. It is built to run as Vercel serverless functions.

## 1. Supabase

1. Create a project (or use the existing one).
2. **Connection strings** — dashboard → **Connect**. Copy two URIs:
   - **Transaction pooler** (port `6543`) → `DATABASE_URL` (app runtime).
   - **Session pooler** (port `5432`) → `DIRECT_URL` (Prisma Migrate).

   > ⚠️ Do **not** use the *direct* host `db.<ref>.supabase.co` — it is IPv6-only
   > and unreachable from Vercel and most IPv4 networks. Always use the pooler hosts
   > (`aws-0-<region>.pooler.supabase.com`).

   Percent-encode special characters in the password (e.g. `!` → `%21`).

   Recommended query params:
   - `DATABASE_URL`: `?pgbouncer=true&connection_limit=1` (PgBouncer transaction mode;
     `connection_limit=1` is the safe default for serverless).
   - `DIRECT_URL`: no `pgbouncer` flag (migrations need a real session).

## 2. Database schema + seed

Migrations live in `prisma/migrations/`. Apply them to Supabase:

```bash
npm install
npm run prisma:deploy   # prisma migrate deploy — applies committed migrations
npm run seed            # demo data (1 property, 9 staff, 10 rooms, treatments…)
```

> `npm run seed` runs `clear()` first — it **wipes all tables**. Never run it against
> data you want to keep.

Demo staff password: `Passw0rd!`

## 3. Vercel

1. Import the GitHub repo into Vercel (framework auto-detected as Next.js).
2. **Environment Variables** (Project → Settings → Environment Variables) — set for
   Production (and Preview if used):

   | Variable | Value |
   |---|---|
   | `DATABASE_URL` | Transaction pooler URI (port 6543, `pgbouncer=true&connection_limit=1`) |
   | `DIRECT_URL` | Session pooler URI (port 5432) |
   | `JWT_ACCESS_SECRET` | strong random secret (≠ dev) |
   | `JWT_REFRESH_SECRET` | strong random secret (≠ dev) |
   | `ACCESS_TOKEN_TTL` | `900` |
   | `REFRESH_TOKEN_TTL` | `2592000` |
   | `PROPERTY_ID` | leave empty (resolved from the seeded property) |

   Generate secrets with:
   ```bash
   node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
   ```
3. **Build** — handled automatically:
   - `build` script runs `prisma generate && next build`.
   - `postinstall` also runs `prisma generate` (covers Vercel's cached installs).
   - Migrations are **not** auto-applied on deploy. Run `npm run prisma:deploy`
     locally (or in a CI step) after merging a schema change.
4. **Region** — `vercel.json` pins `dub1` (Dublin) to sit next to the Supabase
   `eu-west-1` (Ireland) project. Change it if your Supabase region differs.

## 4. Notes & limitations

- **Auth tokens** are stored in `localStorage` (Bearer). Fine for the MVP; revisit
  (httpOnly cookies) if XSS hardening is required.
- **Stubbed features** (intentional, flagged in-app via `StubBanner`): Housekeeping,
  Memberships (Phase 8), the real AI provider, and NTAK/NAV transmission behind
  `ComplianceGateway`.
- **Function timeout**: the Vercel Hobby plan caps serverless functions at 10s; Pro
  allows up to 60s. Reporting endpoints aggregate in-process — watch this if data grows.
