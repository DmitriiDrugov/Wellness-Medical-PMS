# ADR 0004 — Money as integer minor units

**Status:** Accepted · **Date:** 2026-06-08

## Context
Folio charges, payments, and prices require exact arithmetic. JavaScript floating-point numbers
cannot represent currency reliably. The demo currency is HUF (which has no everyday minor unit), but
the model should not be hard-coded to HUF.

## Decision
- Store all monetary amounts as **`Int` minor units = major unit × 100** (for HUF, fillér).
  Example: 35,000 HUF → `3_500_000`.
- Currency is stored on `Property` (HUF for the demo), not on each amount, in the single-currency MVP.
- The display/presentation layer (the external UI) divides by 100 for human-readable values.

## Consequences
- Exact integer arithmetic for all folio math; no floating-point rounding errors.
- Currency-agnostic convention: a future non-HUF property works without schema change.
- Multi-currency arithmetic (FX, per-amount currency) is explicitly out of scope for the MVP.

## Related
- ADR 0003 (Property holds currency), spec §5, spec §12.
