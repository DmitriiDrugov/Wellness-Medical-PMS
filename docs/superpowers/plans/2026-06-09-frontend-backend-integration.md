# Frontend ↔ Backend Integration (Sub-project A) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every create/edit/lifecycle button in the staff console perform a real API call against the existing backend, using one reusable modal + form + mutation pattern.

**Architecture:** A shared frontend kit (`Modal`, `ConfirmDialog`, form primitives, `useMutation` hook, pure `toFieldErrors` mapper) plus three small read-only backend endpoints for form pickers. Each screen replaces inert buttons with modal-driven forms that submit via the existing `api` client and refresh the list via `useApi`'s `reload()`. Server zod validation is the source of truth; the hook maps `422` field errors back onto inputs.

**Tech Stack:** Next.js 14 App Router (client components), TypeScript, Tailwind, the existing `src/web/api-client.ts`, vitest (pure + service-level only — no DOM testing).

**Conventions (read before starting):**
- All new page-level UI files start with `"use client";`.
- Reuse existing CSS classes: `.input`, `.btn-primary`, `.btn-secondary`, `.btn-ghost`, `.card`, `.pill*`. New classes (`.modal-overlay`, `.modal-card`, `.btn-danger`, `.label`) are added in Task A0.5.
- After every mutation success: close the modal and call the list's `reload()`.
- Money is integer minor units (HUF×100). Forms collect major units (e.g. `12000` Ft) and multiply by 100 on submit; `formatMinor` already divides by 100 for display.
- Commit after each task. We are on branch `feat/messaging-ai-receptionist`.

---

## Task A0.1: Pure `toFieldErrors` mapper

**Files:**
- Create: `src/web/form-errors.ts`
- Test: `tests/web/form-errors.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/web/form-errors.test.ts
import { describe, it, expect } from "vitest";
import { toFieldErrors } from "@/web/form-errors";

describe("toFieldErrors", () => {
  it("maps a ZodError.flatten() shape to first message per field", () => {
    const details = {
      formErrors: [],
      fieldErrors: { email: ["Invalid email"], firstName: ["Required", "Too short"] },
    };
    expect(toFieldErrors(details)).toEqual({ email: "Invalid email", firstName: "Required" });
  });

  it("returns an empty object for missing/odd shapes", () => {
    expect(toFieldErrors(undefined)).toEqual({});
    expect(toFieldErrors(null)).toEqual({});
    expect(toFieldErrors({ formErrors: ["bad"] })).toEqual({});
    expect(toFieldErrors({ fieldErrors: { x: [] } })).toEqual({});
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/web/form-errors.test.ts`
Expected: FAIL — cannot find module `@/web/form-errors`.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/web/form-errors.ts
/**
 * Flattens the `error.details` of a 422 response (Zod's `flatten()` shape:
 * `{ formErrors, fieldErrors }`) into `{ field: firstMessage }` for form display.
 * Tolerant of missing/odd shapes — always returns a plain object.
 */
export function toFieldErrors(details: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  if (details && typeof details === "object" && "fieldErrors" in details) {
    const fe = (details as { fieldErrors?: Record<string, string[]> }).fieldErrors ?? {};
    for (const [key, msgs] of Object.entries(fe)) {
      if (Array.isArray(msgs) && msgs.length > 0) out[key] = msgs[0]!;
    }
  }
  return out;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/web/form-errors.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/web/form-errors.ts tests/web/form-errors.test.ts
git commit -m "feat(web): toFieldErrors — map 422 details to per-field messages"
```

---

## Task A0.2: `useMutation` hook

**Files:**
- Create: `src/web/use-mutation.ts`

No unit test (thin React glue over `toFieldErrors`, which is already tested). Verified by `tsc`.

- [ ] **Step 1: Write the hook**

```ts
// src/web/use-mutation.ts
"use client";

import { useCallback, useState } from "react";
import { ApiError } from "@/web/api-client";
import { toFieldErrors } from "@/web/form-errors";

/**
 * Runs a single async API call, exposing submitting/error state. On a 422 it maps
 * field errors via toFieldErrors; any other ApiError surfaces its message; unknown
 * errors get a generic message. `submit` resolves to the call result, or `undefined`
 * if it failed (so callers can `if (!result) return;`).
 */
export function useMutation() {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const reset = useCallback(() => {
    setError(null);
    setFieldErrors({});
  }, []);

  const submit = useCallback(async <T>(fn: () => Promise<T>): Promise<T | undefined> => {
    setSubmitting(true);
    setError(null);
    setFieldErrors({});
    try {
      return await fn();
    } catch (err) {
      if (err instanceof ApiError && err.status === 422) {
        setFieldErrors(toFieldErrors(err.details));
      } else if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError("Something went wrong. Please try again.");
      }
      return undefined;
    } finally {
      setSubmitting(false);
    }
  }, []);

  return { submit, submitting, error, fieldErrors, reset };
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/web/use-mutation.ts
git commit -m "feat(web): useMutation hook (submitting/error/fieldErrors)"
```

---

## Task A0.3: `Modal` and `ConfirmDialog` components

**Files:**
- Create: `src/web/components/Modal.tsx`
- Create: `src/web/components/ConfirmDialog.tsx`

- [ ] **Step 1: Write `Modal.tsx`**

```tsx
// src/web/components/Modal.tsx
"use client";

import { useEffect } from "react";
import { Icon } from "@/web/components/ui";

export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-outline-variant/50 px-5 py-3">
          <h2 className="text-lg font-semibold text-on-surface">{title}</h2>
          <button className="btn-ghost px-2" onClick={onClose} aria-label="Close">
            <Icon name="close" />
          </button>
        </div>
        <div className="max-h-[70vh] overflow-y-auto px-5 py-4">{children}</div>
        {footer && (
          <div className="flex justify-end gap-2 border-t border-outline-variant/50 px-5 py-3">{footer}</div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Write `ConfirmDialog.tsx`**

```tsx
// src/web/components/ConfirmDialog.tsx
"use client";

import { Modal } from "@/web/components/Modal";

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Confirm",
  danger,
  busy,
  error,
  onConfirm,
  onClose,
}: {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  danger?: boolean;
  busy?: boolean;
  error?: string | null;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      footer={
        <>
          <button className="btn-ghost" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button className={danger ? "btn-danger" : "btn-primary"} onClick={onConfirm} disabled={busy}>
            {busy ? "Working…" : confirmLabel}
          </button>
        </>
      }
    >
      <p className="text-sm text-on-surface-variant">{message}</p>
      {error && (
        <p className="mt-3 rounded-lg bg-error-container/60 px-3 py-2 text-sm text-on-error-container">{error}</p>
      )}
    </Modal>
  );
}
```

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/web/components/Modal.tsx src/web/components/ConfirmDialog.tsx
git commit -m "feat(web): Modal + ConfirmDialog primitives"
```

---

## Task A0.4: Form primitives (`Field`, `FormError`, `FormActions`)

**Files:**
- Create: `src/web/components/form.tsx`

Forms use raw `<input className="input">` / `<select className="input">` / `<textarea className="input">` (matching existing pages); these three wrappers cover labelling, error text, and the footer actions.

- [ ] **Step 1: Write `form.tsx`**

```tsx
// src/web/components/form.tsx
"use client";

import type { ReactNode } from "react";

export function Field({
  label,
  error,
  required,
  children,
}: {
  label: string;
  error?: string;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="label">
        {label}
        {required && <span className="text-error"> *</span>}
      </span>
      {children}
      {error && <span className="mt-1 block text-xs text-error">{error}</span>}
    </label>
  );
}

export function FormError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <div className="rounded-lg bg-error-container/60 px-3 py-2 text-sm text-on-error-container">{message}</div>
  );
}

export function FormActions({
  onCancel,
  submitLabel = "Save",
  submitting,
}: {
  onCancel: () => void;
  submitLabel?: string;
  submitting?: boolean;
}) {
  return (
    <>
      <button type="button" className="btn-ghost" onClick={onCancel} disabled={submitting}>
        Cancel
      </button>
      <button type="submit" className="btn-primary" disabled={submitting}>
        {submitting ? "Saving…" : submitLabel}
      </button>
    </>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/web/components/form.tsx
git commit -m "feat(web): Field/FormError/FormActions form primitives"
```

---

## Task A0.5: CSS additions for modals, danger button, label

**Files:**
- Modify: `app/globals.css` (append inside the existing `@layer components { … }` block, after the `.input` rule on line 71)

- [ ] **Step 1: Add the rules**

Insert these rules immediately before the closing `}` of `@layer components`:

```css
  .label {
    @apply mb-1 block text-xs font-semibold uppercase tracking-wide text-on-surface-variant;
  }
  .btn-danger {
    @apply inline-flex items-center justify-center gap-2 rounded bg-error px-4 py-2 text-sm font-semibold text-on-error transition hover:opacity-90 disabled:opacity-50;
  }
  .modal-overlay {
    @apply fixed inset-0 z-50 grid place-items-center bg-black/40 p-4;
  }
  .modal-card {
    @apply w-full max-w-lg overflow-hidden rounded-lg bg-surface-container-lowest shadow-elevated;
  }
```

- [ ] **Step 2: Typecheck (sanity; CSS isn't typechecked but ensures nothing else broke)**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add app/globals.css
git commit -m "feat(web): modal/danger/label component CSS"
```

---

## Task A0.6: Backend — `GET /api/staff?role=THERAPIST`

Backs the therapist picker (Task A4). Returns profile-safe staff filtered by property + optional role, gated by `appointment:read`.

**Files:**
- Modify: `src/modules/auth/auth.repository.ts` (add `listStaff`)
- Modify: `src/modules/auth/auth.service.ts` (add `listStaff`)
- Create: `app/api/staff/route.ts`
- Test: `tests/modules/staff-list.test.ts`

- [ ] **Step 1: Add the repository method**

In `src/modules/auth/auth.repository.ts`, add inside the `authRepository` object (after `findAiAgent`):

```ts
  listStaff(params: { propertyId: string; role?: StaffRole }) {
    return prisma.staff.findMany({
      where: {
        propertyId: params.propertyId,
        isActive: true,
        ...(params.role ? { role: params.role } : {}),
      },
      orderBy: { lastName: "asc" },
    });
  },
```

Update the import line at the top to also import `StaffRole`:

```ts
import type { Staff, StaffRole } from "@prisma/client";
```

- [ ] **Step 2: Write the failing service test**

```ts
// tests/modules/staff-list.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const staffRows = [
  { id: "t1", email: "a@x.io", role: "THERAPIST", firstName: "Ann", lastName: "Lee", isActive: true, propertyId: "p1", passwordHash: "h" },
  { id: "t2", email: "b@x.io", role: "THERAPIST", firstName: "Bo", lastName: "Ng", isActive: true, propertyId: "p1", passwordHash: "h" },
];

vi.mock("@/modules/auth/auth.repository", () => ({
  authRepository: { listStaff: vi.fn(async () => staffRows) },
}));

import { authService } from "@/modules/auth/auth.service";

const ctx = { kind: "staff" as const, staffId: "r1", role: "RECEPTION" as const, propertyId: "p1" };

describe("authService.listStaff", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns profile-safe rows (no passwordHash) for a capable role", async () => {
    const out = await authService.listStaff(ctx, "THERAPIST");
    expect(out).toHaveLength(2);
    expect(out[0]).not.toHaveProperty("passwordHash");
    expect(out[0]).toMatchObject({ id: "t1", firstName: "Ann", role: "THERAPIST" });
  });

  it("rejects a role lacking appointment:read", async () => {
    const hk = { ...ctx, role: "HOUSEKEEPING" as const };
    await expect(authService.listStaff(hk, "THERAPIST")).rejects.toThrow();
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run tests/modules/staff-list.test.ts`
Expected: FAIL — `authService.listStaff` is not a function.

- [ ] **Step 4: Add the service method**

In `src/modules/auth/auth.service.ts`, add `requireCapability` to imports and a `listStaff` method to the `authService` object. Add this import near the top (after the existing imports):

```ts
import { requireCapability } from "@/platform/rbac";
import type { StaffRole } from "@prisma/client";
```

Add this method inside `export const authService = { … }` (e.g. after `getProfile`):

```ts
  async listStaff(ctx: { role: StaffRole; propertyId: string }, role?: StaffRole): Promise<StaffProfile[]> {
    requireCapability(ctx.role, "appointment:read");
    const rows = await authRepository.listStaff({ propertyId: ctx.propertyId, role });
    return rows.map(toProfile);
  },
```

(`toProfile` already strips `passwordHash`.)

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run tests/modules/staff-list.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 6: Create the route**

```ts
// app/api/staff/route.ts
import { handle, ok } from "@/platform/http";
import { requireAuth } from "@/platform/auth/context";
import { authService } from "@/modules/auth/auth.service";
import type { StaffRole } from "@prisma/client";

const ROLES: StaffRole[] = [
  "RECEPTION", "RESERVATION_ADMIN", "THERAPIST", "HOUSEKEEPING", "MANAGER", "ADMIN", "AI_AGENT",
];

export const GET = handle(async (req) => {
  const ctx = requireAuth(req);
  const param = new URL(req.url).searchParams.get("role");
  const role = ROLES.find((r) => r === param);
  return ok(await authService.listStaff(ctx, role));
});
```

- [ ] **Step 7: Typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 8: Commit**

```bash
git add src/modules/auth/auth.repository.ts src/modules/auth/auth.service.ts app/api/staff/route.ts tests/modules/staff-list.test.ts
git commit -m "feat(api): GET /api/staff (role filter) for staff/therapist pickers"
```

---

## Task A0.7: Backend — `GET /api/room-types` and `GET /api/rooms`

Back the room-type picker (new reservation) and room picker (assign-room).

**Files:**
- Modify: `src/modules/reservations/reservations.repository.ts` (add `listRoomTypes`)
- Modify: `src/modules/reservations/reservations.service.ts` (add `listRoomTypes`, `listRooms`)
- Create: `app/api/room-types/route.ts`
- Create: `app/api/rooms/route.ts`
- Test: `tests/modules/room-inventory-list.test.ts`

- [ ] **Step 1: Add the repository method**

In `src/modules/reservations/reservations.repository.ts`, add inside `reservationsRepository` (after `roomTypeById`):

```ts
  listRoomTypes(propertyId: string): Promise<RoomType[]> {
    return prisma.roomType.findMany({ where: { propertyId }, orderBy: { name: "asc" } });
  },
```

(`roomsByType(propertyId)` already lists rooms; reuse it for rooms.)

- [ ] **Step 2: Write the failing service test**

```ts
// tests/modules/room-inventory-list.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const roomTypes = [{ id: "rt1", name: "Deluxe", basePriceMinor: 5000000, propertyId: "p1" }];
const rooms = [{ id: "r1", number: "101", roomTypeId: "rt1", status: "AVAILABLE", propertyId: "p1" }];

vi.mock("@/modules/reservations/reservations.repository", () => ({
  reservationsRepository: {
    listRoomTypes: vi.fn(async () => roomTypes),
    roomsByType: vi.fn(async () => rooms),
  },
}));

import { reservationsService } from "@/modules/reservations/reservations.service";

const ctx = { kind: "staff" as const, staffId: "s1", role: "RECEPTION" as const, propertyId: "p1" };

describe("reservations inventory listings", () => {
  beforeEach(() => vi.clearAllMocks());

  it("lists room types for a capable role", async () => {
    const out = await reservationsService.listRoomTypes(ctx);
    expect(out).toEqual(roomTypes);
  });

  it("lists rooms for a capable role", async () => {
    const out = await reservationsService.listRooms(ctx);
    expect(out).toEqual(rooms);
  });

  it("rejects a role lacking reservation:read", async () => {
    const hk = { ...ctx, role: "HOUSEKEEPING" as const };
    await expect(reservationsService.listRoomTypes(hk)).rejects.toThrow();
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run tests/modules/room-inventory-list.test.ts`
Expected: FAIL — `listRoomTypes` is not a function.

- [ ] **Step 4: Add the service methods**

In `src/modules/reservations/reservations.service.ts`, add inside `export const reservationsService = { … }` (after `availability`):

```ts
  async listRoomTypes(ctx: AuthContext) {
    requireCapability(ctx.role, "reservation:read");
    return reservationsRepository.listRoomTypes(ctx.propertyId);
  },

  async listRooms(ctx: AuthContext) {
    requireCapability(ctx.role, "reservation:read");
    return reservationsRepository.roomsByType(ctx.propertyId);
  },
```

(`requireCapability` and `reservationsRepository` are already imported in this file.)

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run tests/modules/room-inventory-list.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 6: Create the routes**

```ts
// app/api/room-types/route.ts
import { handle, ok } from "@/platform/http";
import { requireAuth } from "@/platform/auth/context";
import { reservationsService } from "@/modules/reservations/reservations.service";

export const GET = handle(async (req) => {
  const ctx = requireAuth(req);
  return ok(await reservationsService.listRoomTypes(ctx));
});
```

```ts
// app/api/rooms/route.ts
import { handle, ok } from "@/platform/http";
import { requireAuth } from "@/platform/auth/context";
import { reservationsService } from "@/modules/reservations/reservations.service";

export const GET = handle(async (req) => {
  const ctx = requireAuth(req);
  return ok(await reservationsService.listRooms(ctx));
});
```

- [ ] **Step 7: Typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 8: Commit**

```bash
git add src/modules/reservations/reservations.repository.ts src/modules/reservations/reservations.service.ts app/api/room-types/route.ts app/api/rooms/route.ts tests/modules/room-inventory-list.test.ts
git commit -m "feat(api): GET /api/room-types and /api/rooms for reservation pickers"
```

---

## Task A0.8: Frontend types for pickers

**Files:**
- Modify: `src/web/types.ts` (append)

- [ ] **Step 1: Add types at the end of `src/web/types.ts`**

```ts
export interface StaffRef {
  id: string;
  firstName: string;
  lastName: string;
  role: string;
}
export interface RoomListItem {
  id: string;
  number: string;
  roomTypeId: string;
  status: string;
}
```

(`RoomTypeRef` already exists and matches `GET /api/room-types`.)

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/web/types.ts
git commit -m "feat(web): StaffRef + RoomListItem picker types"
```

---

## Task A1: Guests — create / edit / delete

**Files:**
- Create: `app/(app)/guests/GuestFormModal.tsx`
- Modify: `app/(app)/guests/page.tsx`

- [ ] **Step 1: Create `GuestFormModal.tsx`**

```tsx
// app/(app)/guests/GuestFormModal.tsx
"use client";

import { useState } from "react";
import { api } from "@/web/api-client";
import { useMutation } from "@/web/use-mutation";
import { Modal } from "@/web/components/Modal";
import { Field, FormError, FormActions } from "@/web/components/form";
import type { Guest } from "@/web/types";

type Props = {
  open: boolean;
  guest: Guest | null; // null => create
  onClose: () => void;
  onSaved: () => void;
};

export function GuestFormModal({ open, guest, onClose, onSaved }: Props) {
  const { submit, submitting, error, fieldErrors, reset } = useMutation();
  const [form, setForm] = useState(() => initial(guest));

  // Re-seed the form whenever the modal opens for a different record.
  function initial(g: Guest | null) {
    return {
      firstName: g?.firstName ?? "",
      lastName: g?.lastName ?? "",
      email: g?.email ?? "",
      phone: g?.phone ?? "",
      nationality: g?.nationality ?? "",
      gdprConsentDataProcessing: g?.gdprConsentDataProcessing ?? false,
      gdprConsentMarketing: g?.gdprConsentMarketing ?? false,
    };
  }
  function set<K extends keyof ReturnType<typeof initial>>(k: K, v: ReturnType<typeof initial>[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const body = {
      firstName: form.firstName,
      lastName: form.lastName,
      email: form.email || undefined,
      phone: form.phone || undefined,
      nationality: form.nationality || undefined,
      gdprConsentDataProcessing: form.gdprConsentDataProcessing,
      gdprConsentMarketing: form.gdprConsentMarketing,
    };
    const result = guest
      ? await submit(() => api.patch(`/api/guests/${guest.id}`, body))
      : await submit(() => api.post("/api/guests", body));
    if (result !== undefined) onSaved();
  }

  return (
    <Modal
      open={open}
      onClose={() => {
        reset();
        onClose();
      }}
      title={guest ? "Edit Guest" : "New Guest"}
      footer={<FormActions onCancel={onClose} submitting={submitting} submitLabel={guest ? "Save changes" : "Create guest"} />}
    >
      <form id="guest-form" onSubmit={onSubmit} className="space-y-4">
        <FormError message={error} />
        <div className="grid grid-cols-2 gap-3">
          <Field label="First name" required error={fieldErrors.firstName}>
            <input className="input" value={form.firstName} onChange={(e) => set("firstName", e.target.value)} />
          </Field>
          <Field label="Last name" required error={fieldErrors.lastName}>
            <input className="input" value={form.lastName} onChange={(e) => set("lastName", e.target.value)} />
          </Field>
        </div>
        <Field label="Email" error={fieldErrors.email}>
          <input className="input" type="email" value={form.email} onChange={(e) => set("email", e.target.value)} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Phone" error={fieldErrors.phone}>
            <input className="input" value={form.phone} onChange={(e) => set("phone", e.target.value)} />
          </Field>
          <Field label="Nationality (ISO-2)" error={fieldErrors.nationality}>
            <input className="input" maxLength={2} value={form.nationality} onChange={(e) => set("nationality", e.target.value.toUpperCase())} />
          </Field>
        </div>
        <div className="flex gap-6">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.gdprConsentDataProcessing} onChange={(e) => set("gdprConsentDataProcessing", e.target.checked)} />
            GDPR data processing
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.gdprConsentMarketing} onChange={(e) => set("gdprConsentMarketing", e.target.checked)} />
            Marketing
          </label>
        </div>
      </form>
    </Modal>
  );
}
```

Note: the footer `FormActions` submit button is `type="submit"`, but it lives outside the `<form>`. Add `form="guest-form"` so it submits. Update the `FormActions` usage to wrap the buttons in the form, OR (simpler) move `FormActions` inside the form and drop the footer. **Use this approach:** render the actions inside the form and pass `footer={undefined}`:

Replace the `footer={…}` prop and the closing of the form with actions at the bottom of the form:

```tsx
    >
      <form onSubmit={onSubmit} className="space-y-4">
        <FormError message={error} />
        {/* …fields… */}
        <div className="flex justify-end gap-2 pt-2">
          <FormActions onCancel={onClose} submitting={submitting} submitLabel={guest ? "Save changes" : "Create guest"} />
        </div>
      </form>
    </Modal>
```

(Apply the same in-form actions pattern in all subsequent form modals.)

- [ ] **Step 2: Wire `guests/page.tsx`**

In `app/(app)/guests/page.tsx`:

1. Add imports near the top:

```tsx
import { GuestFormModal } from "./GuestFormModal";
import { ConfirmDialog } from "@/web/components/ConfirmDialog";
import { useMutation } from "@/web/use-mutation";
```

2. Capture `reload` from `useApi` (line 14 currently destructures `{ data, meta, loading, error }`):

```tsx
  const { data, meta, loading, error, reload } = useApi<Guest[]>(
```

3. Add modal state inside `GuestsPage` (after `const selected = …`):

```tsx
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Guest | null>(null);
  const [deleting, setDeleting] = useState<Guest | null>(null);
  const del = useMutation();

  function openCreate() {
    setEditing(null);
    setFormOpen(true);
  }
  function openEdit(g: Guest) {
    setEditing(g);
    setFormOpen(true);
  }
  async function confirmDelete() {
    if (!deleting) return;
    const ok = await del.submit(() => api.del(`/api/guests/${deleting.id}`));
    if (ok !== undefined) {
      setDeleting(null);
      reload();
    }
  }
```

4. Replace the inert New Guest button (lines 27-29) with:

```tsx
          <button className="btn-primary" onClick={openCreate}>
            <Icon name="person_add" className="text-[20px]" /> New Guest
          </button>
```

5. In the `GuestDetail` component, add Edit/Delete buttons. Change `<GuestDetail guest={selected} />` (line 99) to:

```tsx
        <GuestDetail guest={selected} onEdit={openEdit} onDelete={setDeleting} />
```

   And update the `GuestDetail` signature + add an actions row after the header block (after line 134's closing `</div>` of the header flex):

```tsx
function GuestDetail({
  guest,
  onEdit,
  onDelete,
}: {
  guest: Guest | null;
  onEdit: (g: Guest) => void;
  onDelete: (g: Guest) => void;
}) {
```

   Add this right after the name/header `</div>` inside the returned `<Card>` (just before `<div className="mt-4 grid grid-cols-2 …`):

```tsx
      <div className="mt-3 flex gap-2">
        <button className="btn-secondary flex-1" onClick={() => onEdit(guest)}>
          <Icon name="edit" className="text-[18px]" /> Edit
        </button>
        <button className="btn-ghost text-error" onClick={() => onDelete(guest)}>
          <Icon name="delete" className="text-[18px]" /> Delete
        </button>
      </div>
```

6. Render the modals before the final closing `</div>` of `GuestsPage`'s return (after `</div>` that closes the grid, around line 100):

```tsx
      <GuestFormModal
        open={formOpen}
        guest={editing}
        onClose={() => setFormOpen(false)}
        onSaved={() => {
          setFormOpen(false);
          reload();
        }}
      />
      <ConfirmDialog
        open={deleting !== null}
        title="Delete guest"
        message={`Soft-delete ${deleting?.firstName ?? ""} ${deleting?.lastName ?? ""}? They will be hidden from lists (GDPR erasure).`}
        confirmLabel="Delete"
        danger
        busy={del.submitting}
        error={del.error}
        onConfirm={confirmDelete}
        onClose={() => setDeleting(null)}
      />
```

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 4: Manual smoke (optional, requires running DB)**

Run `npm run dev`, log in, open Guests, create a guest, edit it, delete it. Each action closes the modal and the list refreshes.

- [ ] **Step 5: Commit**

```bash
git add "app/(app)/guests/GuestFormModal.tsx" "app/(app)/guests/page.tsx"
git commit -m "feat(web): wire Guests create/edit/delete to the API"
```

---

## Task A2: Catalog — treatments & packages

**Files:**
- Create: `app/(app)/catalog/TreatmentFormModal.tsx`
- Create: `app/(app)/catalog/PackageFormModal.tsx`
- Modify: `app/(app)/catalog/page.tsx`

- [ ] **Step 1: Create `TreatmentFormModal.tsx`**

```tsx
// app/(app)/catalog/TreatmentFormModal.tsx
"use client";

import { useState } from "react";
import { api } from "@/web/api-client";
import { useMutation } from "@/web/use-mutation";
import { Modal } from "@/web/components/Modal";
import { Field, FormError, FormActions } from "@/web/components/form";
import type { Treatment } from "@/web/types";

export function TreatmentFormModal({
  open,
  treatment,
  onClose,
  onSaved,
}: {
  open: boolean;
  treatment: Treatment | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { submit, submitting, error, fieldErrors } = useMutation();
  const [form, setForm] = useState({
    name: treatment?.name ?? "",
    description: treatment?.description ?? "",
    durationMinutes: String(treatment?.durationMinutes ?? 50),
    priceMajor: String((treatment?.priceMinor ?? 0) / 100),
    requiredResourceType: (treatment?.requiredResourceType as string) ?? "TREATMENT_ROOM",
    active: treatment?.active ?? true,
  });
  function set<K extends keyof typeof form>(k: K, v: (typeof form)[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const body = {
      name: form.name,
      description: form.description || undefined,
      durationMinutes: Number(form.durationMinutes),
      priceMinor: Math.round(Number(form.priceMajor) * 100),
      requiredResourceType: form.requiredResourceType,
      active: form.active,
    };
    const result = treatment
      ? await submit(() => api.patch(`/api/treatments/${treatment.id}`, body))
      : await submit(() => api.post("/api/treatments", body));
    if (result !== undefined) onSaved();
  }

  return (
    <Modal open={open} onClose={onClose} title={treatment ? "Edit Treatment" : "New Treatment"}>
      <form onSubmit={onSubmit} className="space-y-4">
        <FormError message={error} />
        <Field label="Name" required error={fieldErrors.name}>
          <input className="input" value={form.name} onChange={(e) => set("name", e.target.value)} />
        </Field>
        <Field label="Description" error={fieldErrors.description}>
          <textarea className="input" rows={2} value={form.description} onChange={(e) => set("description", e.target.value)} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Duration (min)" required error={fieldErrors.durationMinutes}>
            <input className="input" type="number" min={5} value={form.durationMinutes} onChange={(e) => set("durationMinutes", e.target.value)} />
          </Field>
          <Field label="Price (HUF)" required error={fieldErrors.priceMinor}>
            <input className="input" type="number" min={0} value={form.priceMajor} onChange={(e) => set("priceMajor", e.target.value)} />
          </Field>
        </div>
        <Field label="Required resource" required error={fieldErrors.requiredResourceType}>
          <select className="input" value={form.requiredResourceType} onChange={(e) => set("requiredResourceType", e.target.value)}>
            <option value="TREATMENT_ROOM">Treatment room</option>
            <option value="EQUIPMENT">Equipment</option>
          </select>
        </Field>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={form.active} onChange={(e) => set("active", e.target.checked)} /> Active
        </label>
        <div className="flex justify-end gap-2 pt-2">
          <FormActions onCancel={onClose} submitting={submitting} submitLabel={treatment ? "Save changes" : "Create treatment"} />
        </div>
      </form>
    </Modal>
  );
}
```

- [ ] **Step 2: Create `PackageFormModal.tsx`**

```tsx
// app/(app)/catalog/PackageFormModal.tsx
"use client";

import { useState } from "react";
import { api } from "@/web/api-client";
import { useApi } from "@/web/use-api";
import { useMutation } from "@/web/use-mutation";
import { Modal } from "@/web/components/Modal";
import { Icon } from "@/web/components/ui";
import { Field, FormError, FormActions } from "@/web/components/form";
import type { Treatment } from "@/web/types";

type Line = { treatmentId: string; quantity: number };

export function PackageFormModal({ open, onClose, onSaved }: { open: boolean; onClose: () => void; onSaved: () => void }) {
  const { submit, submitting, error, fieldErrors } = useMutation();
  const treatments = useApi<Treatment[]>(() => api.get<Treatment[]>("/api/treatments"), []);
  const options = treatments.data ?? [];

  const [name, setName] = useState("");
  const [priceMajor, setPriceMajor] = useState("0");
  const [lines, setLines] = useState<Line[]>([{ treatmentId: "", quantity: 1 }]);

  function setLine(i: number, patch: Partial<Line>) {
    setLines((ls) => ls.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  }
  function addLine() {
    setLines((ls) => [...ls, { treatmentId: "", quantity: 1 }]);
  }
  function removeLine(i: number) {
    setLines((ls) => ls.filter((_, idx) => idx !== i));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const body = {
      name,
      priceMinor: Math.round(Number(priceMajor) * 100),
      active: true,
      items: lines.filter((l) => l.treatmentId).map((l) => ({ treatmentId: l.treatmentId, quantity: l.quantity })),
    };
    const result = await submit(() => api.post("/api/packages", body));
    if (result !== undefined) onSaved();
  }

  return (
    <Modal open={open} onClose={onClose} title="New Package">
      <form onSubmit={onSubmit} className="space-y-4">
        <FormError message={error} />
        <Field label="Name" required error={fieldErrors.name}>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label="Price (HUF)" required error={fieldErrors.priceMinor}>
          <input className="input" type="number" min={0} value={priceMajor} onChange={(e) => setPriceMajor(e.target.value)} />
        </Field>
        <div>
          <span className="label">Items</span>
          {fieldErrors.items && <span className="mb-1 block text-xs text-error">{fieldErrors.items}</span>}
          <div className="space-y-2">
            {lines.map((l, i) => (
              <div key={i} className="flex gap-2">
                <select className="input flex-1" value={l.treatmentId} onChange={(e) => setLine(i, { treatmentId: e.target.value })}>
                  <option value="">Select treatment…</option>
                  {options.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
                <input className="input w-20" type="number" min={1} value={l.quantity} onChange={(e) => setLine(i, { quantity: Number(e.target.value) })} />
                <button type="button" className="btn-ghost px-2" onClick={() => removeLine(i)} aria-label="Remove">
                  <Icon name="close" />
                </button>
              </div>
            ))}
          </div>
          <button type="button" className="btn-ghost mt-2" onClick={addLine}>
            <Icon name="add" className="text-[18px]" /> Add item
          </button>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <FormActions onCancel={onClose} submitting={submitting} submitLabel="Create package" />
        </div>
      </form>
    </Modal>
  );
}
```

- [ ] **Step 3: Wire `catalog/page.tsx`**

Read the current file first. Then:
1. Add imports: `import { useState } from "react";` (if not present), `import { TreatmentFormModal } from "./TreatmentFormModal";`, `import { PackageFormModal } from "./PackageFormModal";`.
2. Ensure the treatments/packages `useApi` calls destructure `reload` (e.g. rename to `const treatments = useApi(...)` and call `treatments.reload()`), or add `reload` to the destructure.
3. Add state: `const [treatmentOpen, setTreatmentOpen] = useState(false);` and `const [packageOpen, setPackageOpen] = useState(false);` and `const [editingTreatment, setEditingTreatment] = useState<Treatment | null>(null);`.
4. Replace the New Package button with `onClick={() => setPackageOpen(true)}` and the New Treatment button with `onClick={() => { setEditingTreatment(null); setTreatmentOpen(true); }}`.
5. Add an Edit affordance on each treatment row: `onClick={() => { setEditingTreatment(t); setTreatmentOpen(true); }}`.
6. Render before the page's closing tag:

```tsx
      <TreatmentFormModal
        open={treatmentOpen}
        treatment={editingTreatment}
        onClose={() => setTreatmentOpen(false)}
        onSaved={() => { setTreatmentOpen(false); /* reload treatments list */ }}
      />
      <PackageFormModal
        open={packageOpen}
        onClose={() => setPackageOpen(false)}
        onSaved={() => { setPackageOpen(false); /* reload packages list */ }}
      />
```

Replace the `/* reload … */` comments with the actual reload calls for whatever the `useApi` variables are named in this file (e.g. `treatments.reload()`, `packages.reload()`).

- [ ] **Step 4: Typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add "app/(app)/catalog"
git commit -m "feat(web): wire Catalog treatment + package create/edit to the API"
```

---

## Task A3: Reservations — create + lifecycle

**Files:**
- Create: `app/(app)/reservations/ReservationFormModal.tsx`
- Modify: `app/(app)/reservations/page.tsx`

- [ ] **Step 1: Create `ReservationFormModal.tsx`**

```tsx
// app/(app)/reservations/ReservationFormModal.tsx
"use client";

import { useState } from "react";
import { api } from "@/web/api-client";
import { useApi } from "@/web/use-api";
import { useMutation } from "@/web/use-mutation";
import { Modal } from "@/web/components/Modal";
import { Field, FormError, FormActions } from "@/web/components/form";
import { fullName } from "@/web/format";
import type { Guest, RoomTypeRef } from "@/web/types";

export function ReservationFormModal({ open, onClose, onSaved }: { open: boolean; onClose: () => void; onSaved: () => void }) {
  const { submit, submitting, error, fieldErrors } = useMutation();
  const guests = useApi<Guest[]>(() => api.get<Guest[]>("/api/guests", { pageSize: 100 }), []);
  const roomTypes = useApi<RoomTypeRef[]>(() => api.get<RoomTypeRef[]>("/api/room-types"), []);

  const [form, setForm] = useState({
    guestId: "",
    roomTypeId: "",
    checkInDate: "",
    checkOutDate: "",
    adults: "1",
    children: "0",
  });
  function set<K extends keyof typeof form>(k: K, v: string) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const body = {
      guestId: form.guestId,
      roomTypeId: form.roomTypeId,
      checkInDate: form.checkInDate,
      checkOutDate: form.checkOutDate,
      adults: Number(form.adults),
      children: Number(form.children),
    };
    const result = await submit(() => api.post("/api/reservations", body));
    if (result !== undefined) onSaved();
  }

  return (
    <Modal open={open} onClose={onClose} title="New Reservation">
      <form onSubmit={onSubmit} className="space-y-4">
        <FormError message={error} />
        <Field label="Guest" required error={fieldErrors.guestId}>
          <select className="input" value={form.guestId} onChange={(e) => set("guestId", e.target.value)}>
            <option value="">Select guest…</option>
            {(guests.data ?? []).map((g) => (
              <option key={g.id} value={g.id}>
                {fullName(g.firstName, g.lastName)}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Room type" required error={fieldErrors.roomTypeId}>
          <select className="input" value={form.roomTypeId} onChange={(e) => set("roomTypeId", e.target.value)}>
            <option value="">Select room type…</option>
            {(roomTypes.data ?? []).map((rt) => (
              <option key={rt.id} value={rt.id}>
                {rt.name}
              </option>
            ))}
          </select>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Check-in" required error={fieldErrors.checkInDate}>
            <input className="input" type="date" value={form.checkInDate} onChange={(e) => set("checkInDate", e.target.value)} />
          </Field>
          <Field label="Check-out" required error={fieldErrors.checkOutDate}>
            <input className="input" type="date" value={form.checkOutDate} onChange={(e) => set("checkOutDate", e.target.value)} />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Adults" error={fieldErrors.adults}>
            <input className="input" type="number" min={1} value={form.adults} onChange={(e) => set("adults", e.target.value)} />
          </Field>
          <Field label="Children" error={fieldErrors.children}>
            <input className="input" type="number" min={0} value={form.children} onChange={(e) => set("children", e.target.value)} />
          </Field>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <FormActions onCancel={onClose} submitting={submitting} submitLabel="Create reservation" />
        </div>
      </form>
    </Modal>
  );
}
```

- [ ] **Step 2: Wire `reservations/page.tsx`**

Read the current file. Then:
1. Import `ReservationFormModal`, `ConfirmDialog`, `useMutation`, and the `RoomListItem` type.
2. Destructure `reload` from the reservations `useApi`.
3. Add `const [createOpen, setCreateOpen] = useState(false);` and wire the New Reservation button `onClick={() => setCreateOpen(true)}`.
4. Add lifecycle actions on a selected reservation. For each, POST and reload:

```tsx
  const action = useMutation();
  async function lifecycle(id: string, op: "check-in" | "check-out" | "cancel") {
    const ok = await action.submit(() => api.post(`/api/reservations/${id}/${op}`));
    if (ok !== undefined) reload();
  }
  async function assignRoom(id: string, roomId: string) {
    const ok = await action.submit(() => api.post(`/api/reservations/${id}/assign-room`, { roomId }));
    if (ok !== undefined) reload();
  }
```

   Render these as buttons in a detail panel / row menu (a `check_in`, `logout`, `cancel` button set), each calling `lifecycle(r.id, …)`. For assign-room, present a small `<select>` of rooms loaded via `useApi<RoomListItem[]>(() => api.get("/api/rooms"), [])` filtered to the reservation's `roomTypeId`, then call `assignRoom`.
5. Render the create modal before the page's closing tag:

```tsx
      <ReservationFormModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onSaved={() => { setCreateOpen(false); reload(); }}
      />
```

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add "app/(app)/reservations"
git commit -m "feat(web): wire Reservations create + lifecycle to the API"
```

---

## Task A4: Appointments — book + complete/cancel

**Files:**
- Create: `app/(app)/schedule/AppointmentFormModal.tsx`
- Modify: `app/(app)/schedule/page.tsx`

- [ ] **Step 1: Create `AppointmentFormModal.tsx`**

```tsx
// app/(app)/schedule/AppointmentFormModal.tsx
"use client";

import { useState } from "react";
import { api } from "@/web/api-client";
import { useApi } from "@/web/use-api";
import { useMutation } from "@/web/use-mutation";
import { Modal } from "@/web/components/Modal";
import { Field, FormError, FormActions } from "@/web/components/form";
import { fullName } from "@/web/format";
import type { Guest, Treatment, StaffRef } from "@/web/types";

interface ResourceRef {
  id: string;
  name: string;
  type: string;
}

export function AppointmentFormModal({ open, onClose, onSaved }: { open: boolean; onClose: () => void; onSaved: () => void }) {
  const { submit, submitting, error, fieldErrors } = useMutation();
  const guests = useApi<Guest[]>(() => api.get<Guest[]>("/api/guests", { pageSize: 100 }), []);
  const treatments = useApi<Treatment[]>(() => api.get<Treatment[]>("/api/treatments"), []);
  const therapists = useApi<StaffRef[]>(() => api.get<StaffRef[]>("/api/staff", { role: "THERAPIST" }), []);
  const resources = useApi<ResourceRef[]>(() => api.get<ResourceRef[]>("/api/resources"), []);

  const [form, setForm] = useState({ guestId: "", treatmentId: "", therapistId: "", resourceId: "", startTime: "" });
  function set<K extends keyof typeof form>(k: K, v: string) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const body = {
      guestId: form.guestId,
      treatmentId: form.treatmentId,
      therapistId: form.therapistId,
      resourceId: form.resourceId,
      startTime: new Date(form.startTime).toISOString(),
    };
    const result = await submit(() => api.post("/api/appointments", body));
    if (result !== undefined) onSaved();
  }

  return (
    <Modal open={open} onClose={onClose} title="Book Appointment">
      <form onSubmit={onSubmit} className="space-y-4">
        <FormError message={error} />
        <Field label="Guest" required error={fieldErrors.guestId}>
          <select className="input" value={form.guestId} onChange={(e) => set("guestId", e.target.value)}>
            <option value="">Select guest…</option>
            {(guests.data ?? []).map((g) => (
              <option key={g.id} value={g.id}>{fullName(g.firstName, g.lastName)}</option>
            ))}
          </select>
        </Field>
        <Field label="Treatment" required error={fieldErrors.treatmentId}>
          <select className="input" value={form.treatmentId} onChange={(e) => set("treatmentId", e.target.value)}>
            <option value="">Select treatment…</option>
            {(treatments.data ?? []).map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Therapist" required error={fieldErrors.therapistId}>
            <select className="input" value={form.therapistId} onChange={(e) => set("therapistId", e.target.value)}>
              <option value="">Select…</option>
              {(therapists.data ?? []).map((s) => (
                <option key={s.id} value={s.id}>{fullName(s.firstName, s.lastName)}</option>
              ))}
            </select>
          </Field>
          <Field label="Resource" required error={fieldErrors.resourceId}>
            <select className="input" value={form.resourceId} onChange={(e) => set("resourceId", e.target.value)}>
              <option value="">Select…</option>
              {(resources.data ?? []).map((r) => (
                <option key={r.id} value={r.id}>{r.name}</option>
              ))}
            </select>
          </Field>
        </div>
        <Field label="Start time" required error={fieldErrors.startTime}>
          <input className="input" type="datetime-local" value={form.startTime} onChange={(e) => set("startTime", e.target.value)} />
        </Field>
        <div className="flex justify-end gap-2 pt-2">
          <FormActions onCancel={onClose} submitting={submitting} submitLabel="Book appointment" />
        </div>
      </form>
    </Modal>
  );
}
```

- [ ] **Step 2: Wire `schedule/page.tsx`**

Read the current file. Then:
1. Import `AppointmentFormModal`, `ConfirmDialog`, `useMutation`.
2. Destructure `reload` from the appointments `useApi`.
3. Add `const [bookOpen, setBookOpen] = useState(false);`, wire the Book Appointment button `onClick={() => setBookOpen(true)}`.
4. Add complete/cancel actions on an appointment cell/detail:

```tsx
  const action = useMutation();
  async function complete(id: string) {
    const ok = await action.submit(() => api.post(`/api/appointments/${id}/complete`));
    if (ok !== undefined) reload();
  }
  async function cancel(id: string) {
    const ok = await action.submit(() => api.post(`/api/appointments/${id}/cancel`));
    if (ok !== undefined) reload();
  }
```

   Surface these (e.g. clicking an appointment opens a small popover/confirm with Complete + Cancel). A `ConfirmDialog` per action is acceptable.
5. Render the modal before the page close:

```tsx
      <AppointmentFormModal
        open={bookOpen}
        onClose={() => setBookOpen(false)}
        onSaved={() => { setBookOpen(false); reload(); }}
      />
```

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add "app/(app)/schedule"
git commit -m "feat(web): wire Appointments booking + complete/cancel to the API"
```

---

## Task A5: Billing / Folio — charge, payment, close

**Files:**
- Create: `app/(app)/billing/FolioActions.tsx`
- Modify: `app/(app)/billing/page.tsx`

- [ ] **Step 1: Read `billing/page.tsx`** to learn how a folio is currently selected/displayed (note the variable holding the active `Folio` and the list `reload`).

- [ ] **Step 2: Create `FolioActions.tsx`**

```tsx
// app/(app)/billing/FolioActions.tsx
"use client";

import { useState } from "react";
import { api } from "@/web/api-client";
import { useMutation } from "@/web/use-mutation";
import { Modal } from "@/web/components/Modal";
import { ConfirmDialog } from "@/web/components/ConfirmDialog";
import { Icon } from "@/web/components/ui";
import { Field, FormError, FormActions } from "@/web/components/form";
import type { Folio } from "@/web/types";

export function FolioActions({ folio, onChanged }: { folio: Folio; onChanged: () => void }) {
  const [charge, setCharge] = useState(false);
  const [payment, setPayment] = useState(false);
  const [closing, setClosing] = useState(false);
  const close = useMutation();

  async function confirmClose() {
    const ok = await close.submit(() => api.post(`/api/folios/${folio.id}/close`));
    if (ok !== undefined) {
      setClosing(false);
      onChanged();
    }
  }

  const disabled = folio.status !== "OPEN";

  return (
    <div className="flex flex-wrap gap-2">
      <button className="btn-secondary" disabled={disabled} onClick={() => setCharge(true)}>
        <Icon name="add" className="text-[18px]" /> Add charge
      </button>
      <button className="btn-secondary" disabled={disabled} onClick={() => setPayment(true)}>
        <Icon name="payments" className="text-[18px]" /> Add payment
      </button>
      <button className="btn-primary" disabled={disabled || folio.balanceMinor !== 0} onClick={() => setClosing(true)}>
        <Icon name="lock" className="text-[18px]" /> Close folio
      </button>

      <ChargeModal open={charge} folioId={folio.id} onClose={() => setCharge(false)} onSaved={() => { setCharge(false); onChanged(); }} />
      <PaymentModal open={payment} folioId={folio.id} onClose={() => setPayment(false)} onSaved={() => { setPayment(false); onChanged(); }} />
      <ConfirmDialog
        open={closing}
        title="Close folio"
        message="Close this folio? It must have a zero balance and cannot be reopened."
        confirmLabel="Close folio"
        busy={close.submitting}
        error={close.error}
        onConfirm={confirmClose}
        onClose={() => setClosing(false)}
      />
    </div>
  );
}

function ChargeModal({ open, folioId, onClose, onSaved }: { open: boolean; folioId: string; onClose: () => void; onSaved: () => void }) {
  const { submit, submitting, error, fieldErrors } = useMutation();
  const [description, setDescription] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [unitMajor, setUnitMajor] = useState("0");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const body = { description, quantity: Number(quantity), unitPriceMinor: Math.round(Number(unitMajor) * 100) };
    const ok = await submit(() => api.post(`/api/folios/${folioId}/charges`, body));
    if (ok !== undefined) onSaved();
  }

  return (
    <Modal open={open} onClose={onClose} title="Add charge">
      <form onSubmit={onSubmit} className="space-y-4">
        <FormError message={error} />
        <Field label="Description" required error={fieldErrors.description}>
          <input className="input" value={description} onChange={(e) => setDescription(e.target.value)} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Quantity" required error={fieldErrors.quantity}>
            <input className="input" type="number" min={1} value={quantity} onChange={(e) => setQuantity(e.target.value)} />
          </Field>
          <Field label="Unit price (HUF)" required error={fieldErrors.unitPriceMinor}>
            <input className="input" type="number" min={0} value={unitMajor} onChange={(e) => setUnitMajor(e.target.value)} />
          </Field>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <FormActions onCancel={onClose} submitting={submitting} submitLabel="Add charge" />
        </div>
      </form>
    </Modal>
  );
}

function PaymentModal({ open, folioId, onClose, onSaved }: { open: boolean; folioId: string; onClose: () => void; onSaved: () => void }) {
  const { submit, submitting, error, fieldErrors } = useMutation();
  const [amountMajor, setAmountMajor] = useState("0");
  const [method, setMethod] = useState("CARD");
  const [reference, setReference] = useState("");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const body = { amountMinor: Math.round(Number(amountMajor) * 100), method, reference: reference || undefined };
    const ok = await submit(() => api.post(`/api/folios/${folioId}/payments`, body));
    if (ok !== undefined) onSaved();
  }

  return (
    <Modal open={open} onClose={onClose} title="Add payment">
      <form onSubmit={onSubmit} className="space-y-4">
        <FormError message={error} />
        <Field label="Amount (HUF)" required error={fieldErrors.amountMinor}>
          <input className="input" type="number" min={0} value={amountMajor} onChange={(e) => setAmountMajor(e.target.value)} />
        </Field>
        <Field label="Method" required error={fieldErrors.method}>
          <select className="input" value={method} onChange={(e) => setMethod(e.target.value)}>
            <option value="CARD">Card</option>
            <option value="CASH">Cash</option>
            <option value="BANK_TRANSFER">Bank transfer</option>
          </select>
        </Field>
        <Field label="Reference" error={fieldErrors.reference}>
          <input className="input" value={reference} onChange={(e) => setReference(e.target.value)} />
        </Field>
        <div className="flex justify-end gap-2 pt-2">
          <FormActions onCancel={onClose} submitting={submitting} submitLabel="Add payment" />
        </div>
      </form>
    </Modal>
  );
}
```

Note: confirm the payment `method` enum and the charge route path against `src/modules/folio/folio.schema.ts` and `app/api/folios/[id]/charges/route.ts` while wiring; adjust the `<option>` values / body keys if they differ.

- [ ] **Step 3: Wire `billing/page.tsx`**

Render `<FolioActions folio={activeFolio} onChanged={reloadFolio} />` in the folio detail panel, where `activeFolio` is the selected `Folio` and `reloadFolio` re-fetches it (use the detail `useApi`'s `reload`, or re-fetch by id). Import `FolioActions`.

- [ ] **Step 4: Typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add "app/(app)/billing"
git commit -m "feat(web): wire Folio charge/payment/close to the API"
```

---

## Task A6: Form-templates + consents

**Files:**
- Create: `app/(app)/form-templates/TemplateFormModal.tsx`
- Modify: `app/(app)/form-templates/page.tsx`
- Modify: `app/(app)/guests/page.tsx` (consent actions in `GuestDetail`)

- [ ] **Step 1: Read** `src/modules/clinical/clinical.schema.ts` and `app/api/form-templates/route.ts` + `app/api/form-templates/[id]/route.ts` to confirm the create/update body (fields: `name`, `type`, `schema`/`fields`, `active`) and the consent endpoints (`POST /api/guests/[id]/consents`, `POST /api/consents/[id]/revoke`).

- [ ] **Step 2: Create `TemplateFormModal.tsx`**

```tsx
// app/(app)/form-templates/TemplateFormModal.tsx
"use client";

import { useState } from "react";
import { api } from "@/web/api-client";
import { useMutation } from "@/web/use-mutation";
import { Modal } from "@/web/components/Modal";
import { Field, FormError, FormActions } from "@/web/components/form";
import type { FormTemplate } from "@/web/types";

export function TemplateFormModal({
  open,
  template,
  onClose,
  onSaved,
}: {
  open: boolean;
  template: FormTemplate | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { submit, submitting, error, fieldErrors } = useMutation();
  const [name, setName] = useState(template?.name ?? "");
  const [type, setType] = useState<FormTemplate["type"]>(template?.type ?? "INTAKE");
  const [active, setActive] = useState(template?.active ?? true);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    // `schema` shape is defined by the backend; send an empty field list on create.
    const body = template ? { name, active } : { name, type, schema: { fields: [] } };
    const ok = template
      ? await submit(() => api.patch(`/api/form-templates/${template.id}`, body))
      : await submit(() => api.post("/api/form-templates", body));
    if (ok !== undefined) onSaved();
  }

  return (
    <Modal open={open} onClose={onClose} title={template ? "Edit Template" : "New Template"}>
      <form onSubmit={onSubmit} className="space-y-4">
        <FormError message={error} />
        <Field label="Name" required error={fieldErrors.name}>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        {!template && (
          <Field label="Type" required error={fieldErrors.type}>
            <select className="input" value={type} onChange={(e) => setType(e.target.value as FormTemplate["type"])}>
              <option value="INTAKE">Intake</option>
              <option value="MEDICAL_HISTORY">Medical history</option>
              <option value="CUSTOM">Custom</option>
            </select>
          </Field>
        )}
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} /> Active
        </label>
        <div className="flex justify-end gap-2 pt-2">
          <FormActions onCancel={onClose} submitting={submitting} submitLabel={template ? "Save changes" : "Create template"} />
        </div>
      </form>
    </Modal>
  );
}
```

Important: align the create body (`schema` / `fields` key and whether `type` is accepted) with the real `createFormTemplateSchema` read in Step 1. Adjust before committing.

- [ ] **Step 3: Wire `form-templates/page.tsx`**: import `TemplateFormModal`, destructure `reload`, add create/edit state + a New Template button and per-row Edit, delete via `api.del('/api/form-templates/:id')` behind a `ConfirmDialog`, render the modal.

- [ ] **Step 4: Consent actions in `guests/page.tsx`**: in `GuestDetail`, next to the consent pills, add a button that records or revokes consent. To create: `api.post(\`/api/guests/${guest.id}/consents\`, { type, granted: true })` (confirm body in Step 1). To revoke a consent: `api.post(\`/api/consents/${consentId}/revoke\`)`. Reload the guest detail after. Keep it minimal — a single "Record GDPR consent" button when missing is sufficient for A6.

- [ ] **Step 5: Typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add "app/(app)/form-templates" "app/(app)/guests/page.tsx"
git commit -m "feat(web): wire Form Templates CRUD + guest consent actions"
```

---

## Final verification

- [ ] **Step 1: Full typecheck + test suite**

Run: `npm run typecheck && npm test`
Expected: `tsc` clean; all vitest suites pass (including the new `form-errors`, `staff-list`, `room-inventory-list` tests).

- [ ] **Step 2: Build**

Run: `npm run build`
Expected: Next.js build succeeds (no type/route errors).

- [ ] **Step 3: Manual smoke (requires a seeded DB)**

Run `npm run seed` (if needed) then `npm run dev`. Log in as `Passw0rd!`. For each screen, exercise one create and one lifecycle/edit action; confirm the modal closes and the list refreshes, and that an invalid submit shows field/inline errors.

---

## Self-review notes (for the implementer)

- **Server schema is truth.** Three tasks (A5 charge/payment, A6 template, A6 consent) tell you to confirm body keys against the real zod schema before committing — do it; the field names in the snippets are best-effort.
- **`reload` plumbing.** Several pages currently discard `useApi`'s `reload`. Each wiring step adds it to the destructure — don't forget, or lists won't refresh after a mutation.
- **In-form actions.** Submit buttons live inside `<form>` (not in the Modal `footer`) so `type="submit"` works. Every form modal in this plan follows that pattern.
- **No DOM tests.** Frontend correctness rests on `tsc` + `npm run build` + the manual smoke; only pure (`toFieldErrors`) and service (`staff-list`, `room-inventory-list`) logic gets vitest coverage, per the agreed testing scope.
