# Medical-Wellness PMS Backend — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an auditable, modular-monolith REST backend (Next.js App Router + Prisma/Postgres) for a vertical wellness-hotel PMS, in six phases.

**Architecture:** One Next.js app, API-only (`app/api/**`). Business logic lives in `src/modules/<module>` (service + repository + zod schema + types). Cross-cutting concerns in `src/platform`. Modules talk only through service interfaces. Three data planes (operational / financial / compliance+audit). Append-only audit on every mutation. RBAC (6 roles) enforced in service and route layers. Compliance (NTAK/NAV) stubbed behind `ComplianceGateway`.

**Tech Stack:** Next.js 14+, TypeScript (strict), Prisma, PostgreSQL (hosted), zod, bcrypt, jsonwebtoken, vitest.

Reference spec: `docs/superpowers/specs/2026-06-08-pms-backend-design.md`.

---

## Conventions used by all phases

- **Money:** `Int` minor units (HUF × 100).
- **API envelope:** success `{ data, error: null }`, failure `{ data: null, error: { code, message, details? } }`, lists add `meta`.
- **Errors:** `AppError` subclasses → HTTP status via `src/platform/http.ts`.
- **Audit:** every state-changing service method writes one `AuditLog` row (actor, action, entityType, entityId, before, after).
- **Tests:** vitest. Service-level tests for risky logic (conflict detection, folio math, RBAC); route tests for envelope/status.
- **Commit:** one clean commit per phase (or per cohesive task group).

---

## Phase 0 — Scaffold, schema, seed

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.mjs`, `.env.example`, `vitest.config.ts`
- Create: `prisma/schema.prisma`, `prisma/seed.ts`
- Create: `src/platform/db.ts`, `src/platform/config.ts`
- Create: `docs/adr/0001-architecture.md`, `docs/domain-model.md` (Mermaid ER)

- [ ] **Step 1:** Init Node project; install deps: `next react react-dom typescript @types/node @types/react prisma @prisma/client zod bcryptjs jsonwebtoken @types/bcryptjs @types/jsonwebtoken vitest tsx`.
- [ ] **Step 2:** Add `tsconfig.json` (strict, `@/*` → `src/*` path alias), `next.config.mjs`, npm scripts (`dev`, `build`, `prisma:*`, `seed`, `test`).
- [ ] **Step 3:** Write full `prisma/schema.prisma` per spec §5 (all enums + entities + relations + appropriate indexes/unique constraints; `directUrl` for migrations).
- [ ] **Step 4:** `.env.example` with `DATABASE_URL`, `DIRECT_URL`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `PROPERTY_ID`.
- [ ] **Step 5:** `src/platform/db.ts` (singleton PrismaClient) + `src/platform/config.ts` (env + current property).
- [ ] **Step 6:** `prisma/seed.ts`: 1 Property, staff for all 6 roles (incl. 4 therapists), 4 RoomTypes, 10 Rooms, 6 Treatments, 2 ServicePackages, treatment rooms/resources, a few Guests + Reservations + an open Folio.
- [ ] **Step 7:** Validate schema: `npx prisma validate` and `npx prisma generate`. (Migration deferred until a DB URL exists; document `prisma migrate dev` in README.)
- [ ] **Step 8:** ADR 0001 + Mermaid domain diagram.
- [ ] **Step 9:** Commit `feat(phase-0): scaffold, prisma schema, seed`.

## Phase 1 — Auth + RBAC + Audit

**Files:** `src/platform/auth/*`, `src/platform/rbac.ts`, `src/platform/audit.ts`, `src/platform/http.ts`, `src/platform/errors.ts`, `src/modules/auth/*`, `app/api/auth/{login,refresh,logout}/route.ts`, `app/api/me/route.ts`, tests.

- [ ] Password hashing (bcrypt) + JWT issue/verify (access + refresh) helpers + tests.
- [ ] `RefreshToken` rotation + revocation in auth service + tests.
- [ ] `rbac.ts` role-capability matrix + `requireRole`/`can` + tests (each role allowed/denied).
- [ ] `audit.ts` append-only writer (create-only) + test (one row, correct before/after).
- [ ] `http.ts` envelope + `AppError`→status mapping; `errors.ts`.
- [ ] Route guard wrapper (`withAuth`) extracting Bearer → staff context.
- [ ] Endpoints: login, refresh, logout, `/me`; route tests for status + envelope.
- [ ] Commit `feat(phase-1): auth, rbac, append-only audit`.

## Phase 2 — Guests + Reservations

**Files:** `src/modules/guests/*`, `src/modules/reservations/*`, `app/api/guests/**`, `app/api/reservations/**`, tests.

- [ ] Guests service+repo+schema (CRUD, soft delete, GDPR consent) + RBAC + audit + tests.
- [ ] Reservations repo with **overlap conflict query** + service (create/update/assign-room/check-in/check-out/cancel) + audit.
- [ ] Conflict-detection unit tests (adjacent dates, overlap, cancelled excluded).
- [ ] `availability` endpoint (conflict-aware) + tests.
- [ ] Reservation creation opens a Folio (via folio service interface — folio module stub created here or in P4; if P4, store `folioId` later). Decision: create minimal Folio record now.
- [ ] Route tests (status codes incl. 409 on conflict).
- [ ] Commit `feat(phase-2): guests + reservations with conflict detection`.

## Phase 3 — Packages + Treatments + Resources + Scheduling

**Files:** `src/modules/treatments/*`, `src/modules/packages/*`, `src/modules/resources/*`, appointment logic, `app/api/{treatments,packages,resources,appointments}/**`, tests.

- [ ] Treatments CRUD + Resources CRUD + Packages (with items) CRUD + RBAC + audit.
- [ ] Appointment service: **double-booking prevention** (therapist overlap, resource overlap), therapist-role check, resource-type match.
- [ ] Double-booking unit tests (therapist overlap, resource overlap, type mismatch, cancelled excluded).
- [ ] `appointments/availability` endpoint + tests.
- [ ] complete/cancel transitions + audit.
- [ ] Commit `feat(phase-3): treatments, packages, resources, scheduling`.

## Phase 4 — Folio + Payments

**Files:** `src/modules/folio/*`, `app/api/folios/**`, integration with reservations/packages/treatments services, tests.

- [ ] Folio service+repo: line items, balance computation, status, close.
- [ ] Auto-charge flow: reservation check-out → room-night charges; booking a package/treatment → charge line. Implemented as the respective services calling `folioService.addCharge(...)`.
- [ ] Folio math unit tests (charges, payments, balance, rounding in minor units).
- [ ] Endpoints: get folio (items+balance), add charge, add payment, close + RBAC + audit + route tests.
- [ ] Commit `feat(phase-4): folio + payments with auto-charge flow`.

## Phase 5 — Reporting + Compliance

**Files:** `src/modules/reporting/*`, `src/modules/compliance/*`, `src/platform/compliance/gateway.ts`, `app/api/reports/**`, `app/api/compliance/**`, tests, `docs/openapi.md`, `docs/thesis-mapping.md`.

- [ ] Reporting service: occupancy, revenue, treatment-utilization aggregations + tests.
- [ ] `ComplianceGateway` interface + `LoggingComplianceGateway` (logs + returns ref).
- [ ] NTAK daily-report payload builder + `ComplianceEvent` persistence + test.
- [ ] NAV invoice payload builder (from a folio) + `ComplianceEvent` persistence + test.
- [ ] Endpoints + RBAC + route tests.
- [ ] Docs: OpenAPI/REST reference, thesis-requirement → module/endpoint mapping.
- [ ] Commit `feat(phase-5): reporting + compliance gateway stub`.

---

## Self-Review notes

- **Spec coverage:** all spec §5 entities → Phase 0 schema; §6 endpoints → P1–P5 tasks; §7 RBAC → P1 matrix applied per phase; §8 cross-cutting → P1 platform; §9 testing → per-phase tests; §11 docs → P0 ADR/diagram + P5 OpenAPI/mapping. No gaps.
- **Open execution detail:** Folio record creation straddles P2/P4 — resolved by creating a minimal Folio in P2 and enriching charge logic in P4.
- **DB-dependent steps** (migrate, seed run, live route tests) require a real `DATABASE_URL`; schema/codegen and pure-logic unit tests run without one. README documents the DB setup step.
