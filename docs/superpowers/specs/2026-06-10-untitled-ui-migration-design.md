# Untitled UI React Re-platform — Design Spec

**Date:** 2026-06-10
**Status:** Approved (big-bang, teal brand on UUI tokens, light-only)
**Branch:** `feat/untitled-ui-migration`

## Goal

Migrate the entire web UI of the Medical-Wellness PMS from its hand-rolled
Tailwind v3 "Serene Pro" design layer to **Untitled UI React** — its components
(react-aria backed), design tokens, typography, spacing, shadows, and icons —
while preserving the app's teal wellness brand identity.

## Constraints / Decisions

- **Big-bang** scope: all shared components + all 13 page routes + 7 form modals.
- **Brand:** keep teal (`#05685f` family) remapped onto Untitled UI's `brand-*` scale.
- **Theme mode:** light only.
- **Backend untouched:** API routes, Prisma, services, auth logic unchanged. Only
  the presentation layer (`app/**/*.tsx`, `src/web/**`, `globals.css`, Tailwind/PostCSS config) changes.

## Required stack upgrade (UUI hard requirements)

| Package | From | To |
|---|---|---|
| react / react-dom | 18.3 | 19.2 |
| next | 14.2 | 15.x |
| typescript | 5.6 | 5.9 |
| tailwindcss | 3.4 | 4.x |
| @types/react | 18 | 19 |

New deps: `@untitledui/icons`, `react-aria-components`, `tailwindcss-react-aria-components`,
`tailwind-merge`, `tailwindcss-animate`, `@tailwindcss/postcss`.

## Architecture

### Token bridge (bounds the work)
Keep the app's existing semantic class names (`bg-surface`, `text-on-surface-variant`,
`bg-primary/10`, `border-outline-variant`, `.btn-*`, `.card`, `.pill-*`, `.input`,
`.label`, `.modal-*`) **as Tailwind v4 `@theme` aliases / `@utility` definitions that
point at the Untitled UI palette + component styling.** Old `primary` (teal) → UUI
`brand`; surfaces/neutrals → UUI gray scale. Result: existing page markup renders as
authentic Untitled UI without a line-by-line rewrite.

### Icon registry
`Icon` wrapper kept; backed by a map from the ~30 Material Symbol names in use to
`@untitledui/icons` components. Call sites `<Icon name="calendar_today" />` keep working.

### Component mapping
| Current | Untitled UI |
|---|---|
| `.btn-*`, `FormActions` | `Button` for shared/form actions; inline buttons keep `.btn-*` restyled to UUI |
| `.input`, `Field` | `Input`, `Label`, `Select`, `Checkbox`, `TextArea` |
| `Card`, `StatCard` | UUI card + metric patterns |
| `Modal`, `ConfirmDialog` | UUI `Modal`/`Dialog` (react-aria) |
| `StatusPill`, `.pill-*` | `Badge` |
| `DataState` | kept, restyled (spinner/empty/error) |
| `Sidebar`, `Topbar`, `AppShell` | UUI sidebar-navigation + header + `Avatar` |
| page tables | UUI table styling |

## Build order (bottom-up)

1. **Foundation:** deps + stack upgrade + Tailwind v4 + PostCSS + UUI scaffold + theme/bridge → `typecheck`.
2. **Icon registry** (Material Symbols → UUI icons).
3. **Shared primitives** (Button/Input/Field/Card/Badge/Modal/ConfirmDialog/DataState/PageHeader/StatCard).
4. **Shell + login** (Sidebar/Topbar/AppShell/login page).
5. **Page sweep:** 13 pages + 7 modals (icons, residual markup, tables).
6. **Integration gate:** `npm run typecheck` + `npm run build` green (pages are client
   components → build needs no DB).

## Surface inventory

**Pages (13):** dashboard, reservations, guests, schedule, catalog, billing, reports,
audit, form-templates, messages, membership (stub), housekeeping (stub), login.

**Modals/feature components (7):** FolioActions, PackageFormModal, TreatmentFormModal,
TemplateFormModal, GuestFormModal, ReservationFormModal, AppointmentFormModal.

**Shared (7):** AppShell, ConfirmDialog, Modal, Sidebar, Topbar, form, ui.

## Risks

- Three majors at once (React 19 / Next 15 / Tailwind v4) may surface peer-dep / build breakages.
- react-aria changes form/dialog semantics (controlled inputs, focus traps) — form modals need care.
- Visual fidelity can be gated on `typecheck` + `next build`, but pixel confirmation needs
  the app running against a database (not set up in this environment).

## Verification

- `npm run typecheck` after each phase.
- `npm run build` as the integration gate.
- Existing vitest suite (`npm test`) must stay green (it covers non-UI logic).
