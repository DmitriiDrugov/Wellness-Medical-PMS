# Patient-Journey Workflow — Master Design Spec

Date: 2026-06-10
Status: Approved (decisions captured 2026-06-10)
Author: pairing session

## 1. Goal

Make the PMS behave like a real commercial property-management system (Oracle-OPERA
class) where **every module is a different window onto one entity graph** and the
**booking is the origin of all information**. Use the *patient journey* as the
organizing spine. Concretely:

- Rename **Reservations → Booking** (UI/routes); build a real **Booking Grid**
  (resource × time, Day/Week views, filters, utilization footer, Book modal),
  styled after the Stitch "Room Booking Grid-Engine" reference.
- Add **tourist tax** (Hungarian IFA): configurable per-property rate, nightly
  accrual onto the folio, and a **Tax Report** tab.
- **Deep patient registration**: passport/ID identity + a structured medical
  profile (diet, allergies, complications/contraindications, prescriptions) +
  document references.
- **Treatment grid** with Day/Week views (therapist & treatment-room swimlanes);
  confirm the *completed-treatment → bill* flow end-to-end.
- **Real-time cross-module sync via SSE**: a domain-event bus pushes
  `booking|folio|appointment|guest.changed` events; UIs refetch live.
- **Client-app endpoints** (no UI this round): live folio/bill, treatment
  schedule, and documents under the existing guest-auth portal.
- **Remove seeds**: leave only one bootstrap admin `admin@hotel.example`
  (+ the single Property row its FKs require).

## 2. Decisions (locked)

| # | Decision | Choice |
|---|---|---|
| 1 | Sequencing | Full autonomous, all phases A–F, one clean commit per phase |
| 2 | Patient/mobile app | Prepare **API endpoints only**; client app built later |
| 3 | Live sync | **Real-time push (SSE)** + in-process EventBus |
| 4 | Seed | Only `admin@hotel.example` + its Property |

## 3. The entity spine (already structurally true)

```
Guest ─< Reservation(booking) ─1:1─ Folio ─< FolioLineItem / Payment
  │           │                        ▲
  │           └─< TreatmentAppointment ─┘  (complete ⇒ TREATMENT charge: implemented)
  │
  └─< MedicalProfile (1:1) / GuestDocument / IntakeFormSubmission / Consent / TreatmentRecord
```

The booking is the aggregate root: a folio is created per reservation
(`ensureForReservation`), room nights post on check-out (`postRoomCharges`),
treatments post on completion (`postTreatmentCharge`). This spec **deepens and
surfaces** that graph; it does not re-architect it.

## 4. Data-model changes (Prisma)

All additive/nullable → a single forward migration, no destructive change.

**Tourist tax**
- `enum LineItemType += TOURIST_TAX`
- `Property += touristTaxPerPersonPerNightMinor Int @default(0)`
- `Property += touristTaxAppliesToChildren Boolean @default(false)`
  (Hungarian IFA exempts under-18 by default.)

**Deep patient registration** — identity fields on `Guest`:
- `idDocumentType String?` (PASSPORT | NATIONAL_ID | DRIVING_LICENCE — free string, validated in zod)
- `idDocumentNumber String?`, `idDocumentExpiry DateTime?`, `placeOfBirth String?`, `gender String?`

**`model MedicalProfile`** (1:1 with Guest, operational at-a-glance clinical data,
distinct from the immutable clinical `TreatmentRecord`/`IntakeFormSubmission`):
- `guestId @unique`, `dietaryNotes`, `allergies`, `contraindications`,
  `currentMedications`, `prescriptions`, `mobilityNotes`, `generalNotes`
  (all `String?`), `updatedByStaffId`, timestamps.

**`model GuestDocument`** (reference-only, mirrors existing `docRef`/`photoRefs` pattern —
no blobs stored): `guestId`, `kind String`, `label String`, `externalRef String`,
`uploadedByStaffId`, `createdAt`.

RBAC: reuse `guest:read`/`guest:write` for identity + documents; reuse
`clinical:read`/`clinical:write` for the medical profile (therapist/clinical roles).
No new capabilities.

## 5. Modules & components

### 5.1 Booking (rename + grid) — `src/modules/reservations` (internal name kept)
- **UI/route rename only**: `app/(app)/reservations` → `app/(app)/booking`; nav
  label "Reservations" → "Booking"; keep API path `/api/reservations` and the
  Prisma `Reservation` model (rename would force a destructive migration for no
  product value). A short note documents the name mapping.
- **Booking-grid aggregation**: `GET /api/booking-grid?from&to&view=day|week` →
  `{ resources: [...rooms grouped by type/floor], days: [...], cells }` where each
  room row carries the reservation bars overlapping the window (tape-chart).
  Utilization = occupied room-nights ÷ available room-nights in window.
- New service method `reservationsService.grid(ctx, {from,to})`.

### 5.2 Tourist tax — folio module
- `folioService.postTouristTax(actor, { reservationId, guestId, adults, children, nights })`
  computes `(adults + (appliesToChildren ? children : 0)) × nights × rate` and
  upserts a single `TOURIST_TAX` line item (idempotent by `sourceType=Reservation`,
  `sourceId=reservationId`, recomputed on check-out alongside room charges).
- **Tax Report**: `GET /api/reports/tourist-tax?from&to` aggregates `TOURIST_TAX`
  line items (count of guest-nights, taxable persons, total HUF) for the
  municipal/NTAK return; surfaced as a "Tax Report" tab on the Reports page.

### 5.3 Deep patient registration — `src/modules/guests`
- Extend guest schema/service/repo with identity fields, `medicalProfile`
  upsert (`getMedicalProfile`/`upsertMedicalProfile`, `clinical:*` gated, audited
  with `READ` logging like other clinical access), and document CRUD
  (`addDocument`/`listDocuments`/`removeDocument`).
- UI: Patient Profile becomes tabbed — **Identity · Medical · Documents ·
  Bookings · Folio · Clinical** — all reading the same guest aggregate.

### 5.4 Treatment grid — `src/modules/appointments`
- `GET /api/appointments/grid?from&to&view=day|week&by=therapist|room` →
  swimlane rows (therapists or treatment-room resources) × time blocks.
- UI: `app/(app)/schedule` gains a Day/Week toggle + grid view alongside the list.
- Verify `complete` → `postTreatmentCharge` lands on the open folio (already wired);
  add a regression test.

### 5.5 Real-time sync (SSE) — `src/platform/events`
- `EventBus` (in-process `EventEmitter`) with typed `DomainEvent`
  `{ type, propertyId, entity, id, at }`. Services emit after successful mutation
  (booking/appointment/folio/guest create/update/state-change).
- `GET /api/events/stream` (SSE, staff-auth, property-scoped) relays events.
- Web: `useEventStream()` hook subscribes and triggers `useApi` refetch /
  cache invalidation for affected views (grid, folio, schedule).
- **Constraint (documented):** in-process bus is single-instance; correct in
  local dev and the thesis demo. Production multi-instance (Vercel) would swap the
  bus for Supabase Realtime / Postgres `LISTEN/NOTIFY` behind the same interface.
  Web hook degrades to interval polling if the SSE connection drops.

### 5.6 Client-app endpoints (guest portal API, no UI)
Under `requireGuest`, scoped to the authenticated guest:
- `GET /api/guest/folio` — live bill: open folio, line items, payments, balance.
- `GET /api/guest/appointments` — the guest's upcoming/past treatment schedule.
- `GET /api/guest/documents` — the guest's own document references.
Read-only; no staff/clinical fields leaked (whitelist serializers).

### 5.7 Seed cleanup — `prisma/seed.ts`
- Replace the 333-line demo seed with a minimal bootstrap: one `Property`
  (with tax identity + a sample IFA rate) and one `ADMIN` staff
  `admin@hotel.example` (password from `SEED_ADMIN_PASSWORD` env, documented
  default). No rooms, guests, bookings, catalog, or appointments.

## 6. Data flow (patient journey, end to end)

1. **Book** (grid → Book modal, or future portal): `Reservation` created →
   `folio.ensureForReservation` → `EventBus.emit(booking.changed)`.
2. **Register**: receptionist fills Identity + Medical + uploads document refs;
   consents/intake via existing clinical module.
3. **Schedule treatments**: appointments placed on the treatment grid against a
   therapist + treatment room; conflict checks (existing `conflicts.ts`).
4. **Perform**: therapist marks `complete` → `postTreatmentCharge` →
   `folio.changed` → guest's live bill + billing UI update via SSE.
5. **Nightly/Checkout**: `postRoomCharges` + `postTouristTax` recomputed.
6. **Bill**: folio = room + tax + treatments + packages − payments; guest reads it
   through `/api/guest/folio`.
7. **Tax Report**: manager pulls `TOURIST_TAX` aggregate for the period.

## 7. Error handling & testing

- Reuse `handle`/`AppError`/zod-422 envelope and `recordAudit` everywhere.
- Money stays Int minor units (`money.ts`); tax rounds per line, not per person.
- Tests (vitest, pure-logic style already in repo): tax computation +
  exemptions; grid window aggregation & utilization; folio totals incl. tax;
  guest-endpoint field whitelisting; seed bootstrap shape. Keep existing 79 green.

## 8. Build order (phases, one commit each)

- **A** — Booking rename + Booking Grid (+ SSE EventBus scaffold, used by grid)
- **B** — Tourist tax + Tax Report
- **C** — Deep patient registration (identity, MedicalProfile, GuestDocument)
- **D** — Treatment grid Day/Week + completed→bill regression
- **E** — Guest-portal client-app endpoints + SSE wiring across UIs
- **F** — Seed cleanup → `admin@hotel.example` only

## 9. Non-goals (YAGNI)

Native mobile app UI; multi-property runtime; real NTAK/NAV transmission
(stubs stay); payment-gateway integration; document blob storage (refs only);
renaming the `Reservation` DB model/API path.
