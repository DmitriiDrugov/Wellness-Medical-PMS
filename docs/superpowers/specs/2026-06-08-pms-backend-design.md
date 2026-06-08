# Design Spec — Vertical PMS for Wellness & Medical-Wellness Hospitality (Backend/API)

**Date:** 2026-06-08
**Status:** Approved (design phase)
**Scope:** Backend, data model, business logic, REST API only. No frontend (UI handled separately via Stitch).
**Context:** BSc engineering thesis MVP. Goal: a cloud-based, modular, **auditable** vertical PMS unifying hotel operations, wellness/treatment scheduling, and Hungarian compliance hooks (NTAK / NAV) in one coherent architecture.

---

## 1. Goals & Non-Goals

### Goals
- A **modular monolith**: one deployable app, strict module boundaries, modules communicate only through service interfaces.
- Clean separation of three data planes: **operational**, **financial (folio)**, **compliance/audit**.
- Every state-changing endpoint produces an **append-only audit record** (actor, action, entity, timestamp, before/after).
- **RBAC** enforced at the service layer *and* on every API route.
- Compliance integrations **stubbed behind a `ComplianceGateway` interface** — the MVP logs the payload it *would* send and persists it.
- A clean, predictable REST API that serves as the contract for the external (Stitch-built) UI.

### Non-Goals (YAGNI for the MVP)
- No frontend, components, or styling.
- No real network calls to NTAK/NAV (logged payloads only).
- No full multi-tenancy (multiple organizations). See §4 for the single-property-with-seam decision.
- No multi-currency arithmetic logic (currency stored on `Property`, fixed to HUF for the demo).

---

## 2. Tech Stack (fixed)

- **Next.js 14+ (App Router)** used as an **API-only backend** via route handlers under `app/api/**`.
- **TypeScript** (strict).
- **PostgreSQL** via **Prisma ORM**. Dev DB: **hosted (Neon/Supabase)**. Pooled URL for the app, direct URL for migrations.
- **Auth:** JWT access token + refresh token; bcrypt password hashing; RBAC with 6 roles.
- **Validation:** zod on every endpoint input.
- No UI libraries, no Tailwind, no React components.

---

## 3. Module & Repository Layout

```
app/api/**/route.ts          # thin HTTP controllers: parse -> authz guard -> call service -> format envelope
src/modules/<module>/
    <module>.service.ts        # business logic, RBAC checks, audit writes, orchestration
    <module>.repository.ts     # the ONLY place that queries this module's own tables
    <module>.schema.ts         # zod input/output validation schemas
    <module>.types.ts          # public service interface (the cross-module contract)
src/platform/                  # cross-cutting concerns, owned by no business module
    db.ts                      # single PrismaClient instance
    auth/                      # JWT issue/verify, refresh rotation, password hashing
    rbac.ts                    # role matrix + requireRole guard
    audit.ts                   # append-only audit writer
    compliance/gateway.ts      # ComplianceGateway interface + LoggingComplianceGateway
    http.ts                    # response envelope helpers + AppError -> HTTP status mapping
    config.ts                  # env config + current-property resolution
    errors.ts                  # typed AppError hierarchy
prisma/
    schema.prisma
    seed.ts                    # 10 rooms, 4 therapists, 6 treatments, demo guests/reservations
docs/                          # ADRs, domain diagram, OpenAPI ref, thesis-requirement mapping
tests/                         # service + route tests
```

**Modules:** `auth`, `guests`, `reservations`, `packages`, `treatments`, `resources`, `folio`, `housekeeping`, `reporting`, `compliance`.

### Boundary rule (how "no cross-module DB access" is honored)
There is one Prisma schema (one database), but **a module's repository may only query that module's own tables**. Any cross-module data need (e.g. the folio module needs a treatment's price) goes through the other module's **service interface** (`<module>.types.ts`) — never its repository or Prisma models directly.

Enforcement: convention + directory structure + an ADR documenting the rule. Optionally an ESLint `no-restricted-imports` boundary rule (a module may import `src/platform/**` and other modules' `*.types.ts`, but not another module's `*.repository.ts`).

---

## 4. Tenancy: Single Property with a Multi-Property Seam

Runtime is **single-property**, but the architecture **visibly generalizes** to other medical-wellness properties (thesis requirement).

- A **`Property` entity** holds organization/compliance identity needed anyway by NTAK/NAV: legal name, tax number (NAV), NTAK registration number, address, timezone, currency.
- Top-level operational aggregates carry a `propertyId` FK: `RoomType`, `Room`, `Reservation`, `Staff`, `Treatment`, `ServicePackage`, `Resource`, `HousekeepingTask`, `Folio`. (`Guest` is org-shared in the MVP; revisit if true isolation is needed.)
- Repositories accept/scope by `propertyId`. `config.ts` resolves the "current property" for the single-property MVP (seeded row).
- **Thesis story:** deploy for a new property by seeding a new `Property` row; queries and RBAC are already property-scoped. The seam costs one FK column + one scope parameter per repository.

---

## 5. Domain Model (Prisma schema sketch)

All monetary amounts are **`Int` minor units = HUF × 100 (fillér)**; the display layer divides by 100. Currency is stored on `Property` (HUF for the demo).

### Enums
- `StaffRole`: `RECEPTION | RESERVATION_ADMIN | THERAPIST | MANAGER | HOUSEKEEPING | ADMIN`
  - `ADMIN` = system superuser (staff/property management). `MANAGER` = business oversight (reports, overrides). Others scoped per §7.
- `ReservationStatus`: `PENDING | CONFIRMED | CHECKED_IN | CHECKED_OUT | CANCELLED | NO_SHOW`
- `AppointmentStatus`: `SCHEDULED | COMPLETED | CANCELLED | NO_SHOW`
- `HousekeepingStatus`: `CLEAN | DIRTY | INSPECTED | OUT_OF_ORDER`
- `FolioStatus`: `OPEN | CLOSED`
- `LineItemType`: `ROOM | PACKAGE | TREATMENT | ADJUSTMENT`
- `PaymentMethod`: `CASH | CARD | TRANSFER`
- `ResourceType`: `TREATMENT_ROOM | EQUIPMENT`
- `ComplianceEventType`: `NTAK_DAILY_REPORT | NAV_INVOICE`
- `ComplianceEventStatus`: `LOGGED | SENT | FAILED`
- `AuditAction`: `CREATE | UPDATE | DELETE | STATE_CHANGE | LOGIN | LOGOUT`

### Entities (abbreviated fields)
- **Property**: `id, name, legalName, taxNumber, ntakRegNumber, addressLine, city, postalCode, country, timezone, currency(default HUF), createdAt`
- **Staff** (the auth user): `id, propertyId, email(unique), passwordHash, role, firstName, lastName, isActive, createdAt, updatedAt`
- **RefreshToken**: `id, staffId, tokenHash, expiresAt, revokedAt?, createdAt` — supports refresh rotation **and** revocation on deactivation.
- **Guest**: `id, firstName, lastName, email?, phone?, nationality?, dateOfBirth?, addressLine?, city?, postalCode?, country?, gdprConsentDataProcessing(bool), gdprConsentMarketing(bool), gdprConsentAt?, createdAt, updatedAt`
- **RoomType**: `id, propertyId, name, description?, basePriceMinor, maxOccupancy`
- **Room**: `id, propertyId, number, roomTypeId, floor?, housekeepingStatus(default DIRTY), createdAt`
- **Reservation**: `id, propertyId, guestId, roomTypeId, roomId?, checkInDate, checkOutDate, status, adults, children, ratePerNightMinor, folioId?, notes?, createdAt, updatedAt`
  - **Conflict rule:** no two reservations with status NOT IN (`CANCELLED`,`NO_SHOW`) may share a `roomId` with overlapping date ranges `[checkIn, checkOut)`.
- **Treatment**: `id, propertyId, name, description?, durationMinutes, priceMinor, requiredResourceType(ResourceType), active(bool)`
- **ServicePackage**: `id, propertyId, name, description?, priceMinor, active(bool)`
- **PackageItem**: `id, packageId, treatmentId, quantity` — composition of a package.
- **Resource**: `id, propertyId, name, type(ResourceType), capacity(default 1), active(bool)`
- **TreatmentAppointment**: `id, propertyId, guestId, treatmentId, therapistId(Staff), resourceId, startTime, endTime, status, reservationId?, folioId?, notes?, createdAt, updatedAt`
  - **Double-booking rule:** a `therapistId` and a `resourceId` may each not have two appointments with status NOT IN (`CANCELLED`,`NO_SHOW`) whose `[startTime, endTime)` overlap. Therapist must have `role = THERAPIST`. Resource type must match the treatment's `requiredResourceType`.
- **Folio**: `id, propertyId, guestId, reservationId?, status(default OPEN), openedAt, closedAt?`
- **FolioLineItem**: `id, folioId, type(LineItemType), description, quantity, unitPriceMinor, amountMinor, sourceType?, sourceId?, createdByStaffId?, createdAt` — charges auto-flow from reservation (room nights), package, and treatment; manual `ADJUSTMENT` allowed.
- **Payment**: `id, folioId, amountMinor, method(PaymentMethod), reference?, recordedByStaffId, paidAt`
  - Folio balance = Σ `amountMinor` of line items − Σ `amountMinor` of payments.
- **HousekeepingTask**: `id, propertyId, roomId, status(HousekeepingStatus), assignedToStaffId?, notes?, createdAt, completedAt?` — work item/history; updates `Room.housekeepingStatus`.
- **AuditLog** (append-only): `id, propertyId?, actorStaffId?, action(AuditAction), entityType, entityId, before(Json?), after(Json?), metadata(Json?), createdAt`
  - Append-only enforced in code: the audit repository exposes only `create` (no update/delete). **Production hardening (ADR):** a Postgres rule/trigger or `REVOKE UPDATE,DELETE` on the table, since Prisma cannot enforce append-only at the DB level.
- **ComplianceEvent**: `id, propertyId, type(ComplianceEventType), payload(Json), status(ComplianceEventStatus default LOGGED), relatedEntityType?, relatedEntityId?, createdAt`

---

## 6. REST API Surface

**Conventions:** JSON envelope `{ "data": ..., "error": null }` on success and `{ "data": null, "error": { "code", "message", "details?" } }` on failure. List endpoints add `"meta": { page, pageSize, total }`. Auth via `Authorization: Bearer <accessToken>`. Correct HTTP status codes (200/201/400/401/403/404/409/422/500). `409 Conflict` for booking/double-booking collisions; `422` for validation failures.

### Phase 1 — Auth
- `POST /api/auth/login` → `{ accessToken, refreshToken }`
- `POST /api/auth/refresh` → rotates refresh token, returns new pair
- `POST /api/auth/logout` → revokes refresh token
- `GET  /api/me` → current staff profile + role

### Phase 2 — Guests & Reservations
- `GET /api/guests`, `POST /api/guests`
- `GET /api/guests/:id`, `PATCH /api/guests/:id`, `DELETE /api/guests/:id` (soft delete / GDPR)
- `GET /api/reservations`, `POST /api/reservations`
- `GET /api/reservations/:id`, `PATCH /api/reservations/:id`
- `POST /api/reservations/:id/assign-room`, `/check-in`, `/check-out`, `/cancel`
- `GET /api/reservations/availability?from&to&roomTypeId` — server-side conflict-aware availability

### Phase 3 — Packages, Treatments, Resources, Scheduling
- `GET/POST /api/treatments`, `GET/PATCH /api/treatments/:id`
- `GET/POST /api/packages`, `GET/PATCH /api/packages/:id` (with items)
- `GET/POST /api/resources`, `GET/PATCH /api/resources/:id`
- `GET/POST /api/appointments`, `PATCH /api/appointments/:id`
- `POST /api/appointments/:id/cancel`, `/complete`
- `GET /api/appointments/availability?therapistId&resourceId&from&to` — double-booking-aware

### Phase 4 — Folio & Payments
- `GET /api/folios/:id` — line items + computed balance
- `POST /api/folios/:id/charges` — manual `ADJUSTMENT` line item
- `POST /api/folios/:id/payments`
- `POST /api/folios/:id/close`
- (Charges from reservations/packages/treatments are created automatically by those services calling the folio service.)

### Phase 5 — Reporting & Compliance
- `GET /api/reports/occupancy?from&to`
- `GET /api/reports/revenue?from&to`
- `GET /api/reports/treatment-utilization?from&to`
- `POST /api/compliance/ntak/daily-report` — build NTAK daily payload → `ComplianceGateway.send()` (logs) → persist `ComplianceEvent`
- `POST /api/compliance/nav/invoice` — build NAV invoice payload for a folio → log → persist `ComplianceEvent`

---

## 7. RBAC Matrix (role × capability)

| Capability | RECEPTION | RESERVATION_ADMIN | THERAPIST | HOUSEKEEPING | MANAGER | ADMIN |
|---|---|---|---|---|---|---|
| Auth / view own profile | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Guests CRUD | ✓ | ✓ | read (own appts) | — | ✓ | ✓ |
| Reservations CRUD + check-in/out | ✓ | ✓ | — | — | ✓ | ✓ |
| Reservation cancel/override | ✓ | ✓ | — | — | ✓ | ✓ |
| Treatments/Packages/Resources config | — | — | — | — | ✓ | ✓ |
| Appointments create/modify | ✓ | ✓ | own only | — | ✓ | ✓ |
| Appointment complete | — | — | own only | — | ✓ | ✓ |
| Housekeeping tasks | — | — | — | ✓ | ✓ | ✓ |
| Folio charges/payments | ✓ | ✓ | — | — | ✓ | ✓ |
| Folio close | ✓ | — | — | — | ✓ | ✓ |
| Reports | — | ✓ | — | — | ✓ | ✓ |
| Compliance (NTAK/NAV) | — | — | — | — | ✓ | ✓ |
| Staff & property management | — | — | — | — | — | ✓ |

(Matrix is the starting contract; refined per phase. Enforced in both the service layer and the route guard.)

---

## 8. Cross-Cutting Behavior

- **Audit:** every state-changing service method calls `audit.record({ actor, action, entityType, entityId, before, after })` inside the same transaction as the mutation where possible.
- **Validation:** zod schema per endpoint; parse failures → `422` with field details.
- **Errors:** typed `AppError` subclasses (`ValidationError`, `NotFoundError`, `ForbiddenError`, `ConflictError`) mapped to HTTP codes in `http.ts`.
- **Stateless app layer:** no in-process session state; JWT + DB only → horizontally scalable.
- **ComplianceGateway:** interface with `LoggingComplianceGateway` impl for the MVP; swap for a real HTTP impl later without touching callers.

---

## 9. Testing Strategy

Test-first (TDD) per phase. Priority coverage:
- Reservation **conflict detection** (overlap edge cases: same-day check-out/check-in adjacency).
- Appointment **double-booking** (therapist + resource overlap, resource-type match).
- **Folio math** (charge aggregation, balance, payments).
- **RBAC** (each role against allowed/denied capabilities).
- **Audit** (a mutation writes exactly one audit row with correct before/after).
Plus route-level tests for envelope shape and status codes.

---

## 10. Build Sequence (commit per phase, pause for review)

- **Phase 0:** Scaffold, Prisma schema for all entities + relations, seed (10 rooms, 4 therapists, 6 treatments, demo guests/reservations).
- **Phase 1:** Auth + RBAC + audit middleware/service; `auth` + `/me` endpoints.
- **Phase 2:** Reservations + Guests API (CRUD, room allocation, conflict detection).
- **Phase 3:** Packages + Treatments + Resource/therapist scheduling (double-booking prevention).
- **Phase 4:** Folio + Payments (charges auto-flow from reservations/packages/treatments).
- **Phase 5:** Reporting endpoints + `ComplianceGateway` stub (NTAK daily + NAV invoice payloads, logged).

---

## 11. Documentation Deliverables (`/docs`)

- Architecture decision records (ADRs): modular-monolith boundaries, append-only audit enforcement, multi-property seam, money-as-minor-units.
- Domain model diagram (Mermaid ER).
- OpenAPI / REST endpoint reference.
- Thesis-requirement → module/endpoint mapping table.

---

## 12. Open Decisions Resolved

| Decision | Choice |
|---|---|
| Dev database | Hosted Postgres (Neon/Supabase); pooled + direct URLs |
| Tenancy | Single property + multi-property seam (`Property` entity + `propertyId` FKs) |
| Money | `Int` minor units = HUF × 100 (fillér); currency on `Property` |
| Auth | JWT access + refresh token (rotation + revocation); bcrypt |
| Roles | 6: RECEPTION, RESERVATION_ADMIN, THERAPIST, MANAGER, HOUSEKEEPING, ADMIN |
