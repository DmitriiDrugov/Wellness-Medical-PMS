# Medical-Wellness PMS — Backend

API-only modular-monolith backend for a vertical Property Management System unifying hotel
operations, wellness/treatment scheduling, and Hungarian compliance hooks (NTAK / NAV).
BSc engineering thesis MVP. **No frontend** — the UI is built separately (Stitch).

## Stack
Next.js 14 (App Router, API-only) · TypeScript · PostgreSQL + Prisma · JWT RBAC · zod · vitest.

## Architecture
Modular monolith. Business logic in `src/modules/<module>`; cross-cutting concerns in
`src/platform`. Three data planes (operational / financial / compliance+audit). Append-only audit
on every mutation. RBAC (6 roles) enforced in service and route layers. Compliance stubbed behind
a `ComplianceGateway`. See [`docs/`](docs/) for the design spec, ADRs, and domain model.

## Setup

1. **Install:** `npm install`
2. **Database:** create a hosted Postgres (Neon/Supabase). Copy `.env.example` → `.env` and set
   `DATABASE_URL` (pooled) + `DIRECT_URL` (direct) and the JWT secrets.
3. **Migrate:** `npm run prisma:migrate` (creates tables)
4. **Seed:** `npm run seed` (demo property, staff for every role incl. AI, 10 rooms,
   6 treatments, 2 packages, demo guests/reservations, folios, clinical records,
   housekeeping, messaging, and compliance events). Demo staff password: `Passw0rd!`;
   guest portal demo: `guest@demo.test` / `Passw0rd!`.
5. **Run:** `npm run dev`

## Scripts
| Script | Purpose |
|---|---|
| `npm run dev` | Start the API server |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | Run vitest |
| `npm run prisma:migrate` | Apply migrations |
| `npm run prisma:studio` | Inspect the DB |
| `npm run seed` | Load demo data |

## Build phases
0. Scaffold + schema + seed ✅
1. Auth + RBAC + audit
2. Guests + Reservations
3. Packages + Treatments + Resource/therapist scheduling
4. Folio + Payments
5. Reporting + Compliance gateway stub

See [`docs/superpowers/plans/2026-06-08-pms-backend.md`](docs/superpowers/plans/2026-06-08-pms-backend.md).
