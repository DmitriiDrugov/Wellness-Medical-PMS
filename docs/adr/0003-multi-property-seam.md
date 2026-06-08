# ADR 0003 — Single-property runtime with a multi-property seam

**Status:** Accepted · **Date:** 2026-06-08

## Context
The MVP runs one wellness hotel, but the thesis must show the architecture generalizes to other
medical-wellness properties. Full multi-tenancy (multiple organizations, hard isolation) is overkill
for the MVP.

## Decision
- Introduce a **`Property` entity** (one seeded row) that also carries the compliance identity needed
  by NTAK/NAV (legal name, tax number, NTAK registration number, address, timezone, currency).
- Top-level operational aggregates carry a `propertyId` FK: `RoomType`, `Room`, `Reservation`,
  `Staff`, `Treatment`, `ServicePackage`, `Resource`, `HousekeepingTask`, `Folio`, `ComplianceEvent`.
- Repositories accept/scope by `propertyId`. `config.ts#getCurrentPropertyId()` resolves the current
  property for the single-property MVP (env `PROPERTY_ID` override, else the seeded property).
- `Guest` is org-shared in the MVP (not property-scoped); revisit if true isolation is required.

## Consequences
- Deploying for a new property = seed a new `Property` row; queries are already property-scoped.
- A future multi-property deployment resolves the property per-request (e.g. from the authenticated
  staff's `propertyId`) instead of from config.
- Cost is one FK column + one scope parameter per repository — a concrete, defensible demonstration.

## Related
- ADR 0001 (architecture), spec §4.
