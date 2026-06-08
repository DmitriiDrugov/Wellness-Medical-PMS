# ADR 0002 — Append-only audit log

**Status:** Accepted · **Date:** 2026-06-08

## Context
Every state-changing operation must leave an immutable trail (actor, action, entity, timestamp,
before/after). Auditability is a core thesis requirement and underpins the compliance story.

## Decision
A dedicated `AuditLog` table, treated as **append-only**:

- The audit repository exposes only `create()` — no update or delete methods exist in code.
- Every state-changing service method writes exactly one audit row, ideally within the same
  transaction as the mutation, capturing `before`/`after` snapshots as JSON.
- Audit lives in its own data plane, separate from operational and financial data.

## Consequences
- Application code cannot tamper with audit history.
- Prisma cannot enforce append-only at the database level. **Production hardening:** add a Postgres
  rule/trigger that rejects `UPDATE`/`DELETE`, or `REVOKE UPDATE, DELETE ON "AuditLog"` from the
  application role. Documented here as a deployment step beyond the MVP.

## Related
- ADR 0001 (architecture), spec §8 (cross-cutting behavior).
