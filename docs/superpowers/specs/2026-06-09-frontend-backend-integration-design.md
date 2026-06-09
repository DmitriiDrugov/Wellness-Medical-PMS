# Frontend ↔ Backend Integration (Sub-project A) — Design

**Status:** Approved · **Date:** 2026-06-09
**Scope:** Wire the staff operations console (Next.js app-router UI) to the existing,
tested PMS backend. Sub-project A of a 3-part decomposition.

## Context

The web console (`app/(app)/*`) was generated from a Stitch design as a **read-only
presentation shell**: pages fetch via `useApi` → `api.get(...)` and render data, but
every create/edit/lifecycle action is an inert `<button>` with no handler. The only
wired mutations today are message send (`messages`) and auth (`auth-context`).

The backend is complete and tested for these flows (REST routes + zod validation +
RBAC + append-only audit). The API client (`src/web/api-client.ts`) already supports
`post / patch / del` with transparent access-token refresh. The missing layer is
purely **frontend wiring**, plus a few small **supporting read endpoints** required to
populate form pickers.

### Decomposition (agreed)

- **A (this spec):** wire existing-backend mutations to the UI.
- **B (later):** Housekeeping — new backend module over the existing `HousekeepingTask`
  model + UI. (`HousekeepingTask` exists; no service/repo/routes yet.)
- **C (later):** Membership — greenfield domain (no model/API at all); needs its own
  brainstorming. The nav entry stays untouched for now.

## Goals / Non-goals

**Goals**
- Every create/edit/lifecycle button in A1–A6 performs a real API call and reflects the
  result (list refresh, success/error feedback).
- One reusable UI pattern (modal + form kit + mutation hook) so screens stay consistent
  and small.
- No backend behavior changes except adding read-only list endpoints for pickers.

**Non-goals**
- Housekeeping (B) and Membership (C).
- DOM/component testing (no jsdom / testing-library). Frontend correctness is covered by
  `tsc` + pure-unit tests of extracted logic; new endpoints get service-level tests.
- New runtime dependencies.

## Approach

**Modal dialogs + a shared form kit.** Each dead button opens a modal containing a form;
submit calls `api.post/patch`, then closes and calls the list's existing `reload()`.
Lifecycle/destructive actions (check-in, complete, cancel, soft-delete, close folio) use
a confirm dialog or a direct action button inside a detail panel.

**Validation** leans on the server. The API already returns `422` with
`ZodError.flatten()` in `error.details`. The mutation hook maps
`fieldErrors[field]` back onto inputs; forms additionally do light `required` checks
before submit. No client-side schema duplication.

Rejected: dedicated `/new` routes (extra files, full-page nav, clashes with the
detail-panel layout) and inline expanding forms (clutter, awkward for multi-field forms).

## Architecture

### A0 — Shared infrastructure (foundation for A1–A6)

New frontend modules:

- `src/web/components/Modal.tsx` — overlay dialog: backdrop + Esc to close, title,
  body, footer slot. Renders nothing when closed.
- `src/web/components/form.tsx` — presentational form primitives reusing the `.input`
  class: `Field` (label + error text), `TextInput`, `NumberInput` (minor-unit aware
  where relevant), `Select`, `Textarea`, `Checkbox`, `FormActions` (cancel/submit with
  a submitting state).
- `src/web/use-mutation.ts` — `useMutation` hook returning
  `{ submit, submitting, error, fieldErrors, reset }`. `submit(fn)` runs an async API
  call; on `ApiError` with status 422 it populates `fieldErrors` from `details`,
  otherwise sets a top-level `error`.
- `src/web/form-errors.ts` — **pure** helper `toFieldErrors(details): Record<string,string>`
  that flattens `ZodError.flatten()` shape into `{ field: firstMessage }`. Unit-tested.
- `src/web/components/ConfirmDialog.tsx` — titled confirm/cancel modal for lifecycle and
  destructive actions, with a `danger` variant.

CSS additions in `app/globals.css` (same `@layer components` style):
`.modal-overlay`, `.modal-card`, `.btn-danger`, `.label`, and `<select>.input` styling.

`useApi` already exposes `reload()`; pages that currently discard it will destructure it.

### A0 — Supporting read endpoints (backend, read-only)

Needed to populate form pickers; each is a thin service/repo method + route returning
minimal fields, gated by an existing capability. No writes, no schema changes.

| Endpoint | Returns | Capability | Backs |
|---|---|---|---|
| `GET /api/staff?role=THERAPIST` | `{id, firstName, lastName, role}[]` (active, this property) | `appointment:read` | therapist picker (A4) |
| `GET /api/room-types` | `{id, name, basePriceMinor}[]` (this property) | `reservation:read` | room-type picker (A3) |
| `GET /api/rooms` | `{id, number, roomTypeId, status}[]` (this property) | `reservation:read` | assign-room picker (A3) |

Notes:
- Therapist listing: add `authService.listStaff({ propertyId, role })` over a new
  `authRepository.listStaff` (filtered to `isActive`). It returns profile-safe fields
  only (no password hash). Gating by `appointment:read` lets RECEPTION/RESERVATION_ADMIN/
  THERAPIST/managers book without granting `staff:manage`.
- Room types / rooms: add `reservationsService.listRoomTypes` / `listRooms` over existing
  repository access (the repo already has `roomTypeById`, `roomsByType`, `roomById`).

### A1–A6 — Per-screen wiring

Each vertical: replace inert buttons with modal-driven forms / confirm actions, submit
through the API client, refresh on success. Field sets mirror the server zod schemas.

- **A1 Guests** (`guests`): New Guest (create), Edit Guest (patch), Delete (soft-delete,
  confirm). Form: name, email, phone, nationality (ISO-2), DOB, address, GDPR consents.
- **A2 Catalog** (`catalog`): New/Edit Treatment (name, description, durationMinutes,
  priceMinor, requiredResourceType, active); New/Edit Package (name, description,
  priceMinor, active, **items**: treatment + quantity rows); deactivate via `active`.
- **A3 Reservations** (`reservations`): New Reservation (guest, room type, dates,
  adults/children, optional rate + room). Detail panel actions: assign room, check-in,
  check-out, cancel (each a confirm or small form; all already audited server-side).
- **A4 Appointments** (`schedule`): Book Appointment (guest, treatment, therapist,
  resource, start time; optional reservation/notes). Actions: complete, cancel.
  Therapist/resource pickers use the new endpoints; resource list from `GET /api/resources`.
- **A5 Billing / Folio** (`billing`): add charge, charge package, add payment, close
  folio. Amounts entered in major units, converted to minor on submit.
- **A6 Form-templates + Consents** (`form-templates`, plus guest detail): create/edit/
  delete form template; create/revoke consent for a guest.

### Data flow (representative: New Guest)

```
button onClick → open <Modal>
  <form> controlled state
  submit → useMutation.submit(() => api.post("/api/guests", body))
    success → close modal + guests.reload()
    422     → fieldErrors mapped onto <Field> components
    other   → top-level <FormError>
```

## Error handling

- Network/5xx/unknown → top-level form error banner (reuse the `DataState` error styling).
- 422 → per-field messages via `toFieldErrors`.
- 401 → handled by the existing api-client refresh/redirect path; no per-form work.
- Lifecycle conflicts (e.g. 409 "folio has outstanding balance") → surfaced as the
  top-level error in the confirm dialog.

## Testing

- **Pure unit (vitest):** `toFieldErrors` (422 detail shapes → field map), and any
  amount major↔minor conversion helper used by A5.
- **Service-level (vitest):** the 3 new read endpoints' service methods
  (`listStaff` role/property/active filtering; `listRoomTypes` / `listRooms` property
  scoping), following the existing pure/mocked-repo test style.
- **`tsc --noEmit`** stays green across all changes.
- No DOM/component tests; no new test dependencies.

## Build order

A0 (infra + read endpoints) → A1 Guests (validates the pattern end-to-end) → A2 Catalog
→ A3 Reservations → A4 Appointments → A5 Billing → A6 Templates/Consents.

## Risks / mitigations

- **Picker endpoints widen read surface.** Mitigated: minimal fields, gated by existing
  read capabilities, property-scoped, no PII beyond names already shown in the UI.
- **Client/server validation drift.** Mitigated: server zod is the source of truth;
  client does only light required checks and renders server field errors.
- **Scope creep into B/C.** Explicitly out of scope; nav entries for housekeeping/
  membership remain stubs.

## Related

- ADR 0001 (architecture), ADR 0002 (append-only audit), ADR 0006 (AI agent authority).
- Backend routes under `app/api/*`; module schemas under `src/modules/*/*.schema.ts`.
