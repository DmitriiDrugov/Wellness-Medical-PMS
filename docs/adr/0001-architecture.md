# ADR 0001 — Modular monolith with service-interface boundaries

**Status:** Accepted · **Date:** 2026-06-08

## Context
The PMS unifies hotel operations, wellness scheduling, and Hungarian compliance. The thesis
values auditability, clear module boundaries, and maintainability over feature breadth. A full
microservice split would add operational complexity unjustified for an MVP, while an unstructured
monolith would blur the boundaries the thesis wants to demonstrate.

## Decision
Build a **modular monolith** on Next.js (App Router), API-only.

- One deployable app; business logic in `src/modules/<module>` (service + repository + zod schema + types).
- Cross-cutting concerns in `src/platform` (db, auth, rbac, audit, http, compliance, config, errors).
- **Boundary rule:** a module's repository may query only that module's own tables. Cross-module
  needs go through the other module's *service interface* (`<module>.types.ts`), never its repository
  or Prisma models directly.
- One Prisma schema / one database; isolation is enforced by convention + structure (optionally an
  ESLint `no-restricted-imports` rule), not by separate databases.

## Consequences
- Clear seams that could later be extracted into services without rewriting business logic.
- RBAC and audit are enforced uniformly at the service layer.
- Developers must respect the repository boundary; this is documented and reviewable.

## Related
- ADR 0002 (append-only audit), ADR 0003 (multi-property seam), ADR 0004 (money as minor units).
