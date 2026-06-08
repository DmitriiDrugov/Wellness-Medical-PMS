# Thesis Requirement → Module / Endpoint Mapping

Maps each thesis requirement to where it is satisfied in the codebase. Paths are
relative to the repo root.

## Architecture principles

| Requirement | Where satisfied |
|---|---|
| Modular monolith, strict module boundaries (service interfaces only) | `src/modules/*` (service/repository split), `docs/adr/0001-architecture.md` |
| Three data planes: operational / financial / compliance+audit | `prisma/schema.prisma` (sectioned), `docs/domain-model.md` |
| Append-only audit on every state change | `src/platform/audit.ts`, `docs/adr/0002-append-only-audit.md`; every `*.service.ts` mutation calls `recordAudit` |
| RBAC at service layer AND every route | `src/platform/rbac.ts` (`requireCapability` in services) + `requireAuth` in every `app/api/**/route.ts` |
| Compliance integrations stubbed behind an interface | `src/platform/compliance/gateway.ts` (`ComplianceGateway` + `LoggingComplianceGateway`) |
| Clean REST contract, consistent JSON, proper status codes | `src/platform/http.ts`, `docs/api-reference.md` |
| Cloud-ready / deployable per property (multi-property seam) | `Property` entity + `propertyId` FKs, `src/platform/config.ts`, `docs/adr/0003-multi-property-seam.md` |

## Domain entities

| Entity | Schema | Module |
|---|---|---|
| Guest | `prisma/schema.prisma` | `src/modules/guests` |
| Room / RoomType / Reservation | `prisma/schema.prisma` | `src/modules/reservations` |
| Treatment | `prisma/schema.prisma` | `src/modules/treatments` |
| ServicePackage / PackageItem | `prisma/schema.prisma` | `src/modules/packages` |
| Resource | `prisma/schema.prisma` | `src/modules/resources` |
| TreatmentAppointment | `prisma/schema.prisma` | `src/modules/appointments` |
| Folio / FolioLineItem / Payment | `prisma/schema.prisma` | `src/modules/folio` |
| Staff / RefreshToken | `prisma/schema.prisma` | `src/modules/auth` |
| HousekeepingTask | `prisma/schema.prisma` | (model + seed; status on Room) |
| AuditLog | `prisma/schema.prisma` | `src/platform/audit.ts` |
| ComplianceEvent | `prisma/schema.prisma` | `src/modules/compliance` |

## Functional requirements (by build phase)

| Phase | Requirement | Endpoints / Logic |
|---|---|---|
| 0 | Schema + realistic seed | `prisma/schema.prisma`, `prisma/seed.ts` |
| 1 | Auth + RBAC + audit | `/api/auth/*`, `/api/me`; `src/platform/{rbac,audit,auth}` |
| 2 | Guests CRUD + GDPR | `/api/guests/**`; soft-delete + consent stamping |
| 2 | Reservations + room allocation + **server-side conflict detection** | `/api/reservations/**`; `src/modules/reservations/overlap.ts`, `assertRoomBookable` |
| 3 | Packages + Treatments + Resources | `/api/{packages,treatments,resources}/**` |
| 3 | Therapist/resource scheduling + **double-booking prevention** | `/api/appointments/**`; `src/modules/appointments/conflicts.ts`, `assertNoDoubleBooking` |
| 4 | Folio + Payments + **auto-charge flow** | `/api/folios/**`; check-out → room charge, complete → treatment charge |
| 5 | Reporting (occupancy, revenue, utilization) | `/api/reports/**`; `src/modules/reporting` |
| 5 | NTAK daily + NAV invoice payloads (logged, not sent) | `/api/compliance/**`; `src/modules/compliance/payloads.ts` |

## Non-functional requirements

| Requirement | Evidence |
|---|---|
| Security: RBAC + input validation on every endpoint | `requireCapability` + zod `*.schema.ts` parsed in every route |
| Modularity: no leaky boundaries | repository-per-module; cross-module calls via service interfaces (`requireActive`, `assertAllInProperty`, folio posting methods) |
| Maintainability: typed, documented services | TS strict, JSDoc on services, ADRs |
| Scalability: stateless app layer | JWT access tokens; no in-process session (`src/platform/auth`) |
| API ergonomics | uniform envelope, predictable status codes (`docs/api-reference.md`) |
| Auditability | append-only `AuditLog`, every mutation recorded |

## Test coverage (pure logic, no DB)

| Concern | Test |
|---|---|
| RBAC matrix per role | `tests/platform/rbac.test.ts` |
| JWT round-trip + refresh hashing + password | `tests/platform/auth-token.test.ts` |
| Reservation overlap (half-open, adjacency) | `tests/modules/reservation-overlap.test.ts` |
| Appointment conflict + resource-type match + duration | `tests/modules/appointment-conflicts.test.ts` |
| Folio money math (balance, overpayment, nights) | `tests/modules/folio-money.test.ts` |
| Reporting aggregation (occupancy window, grouping) | `tests/modules/reporting-aggregate.test.ts` |
| Compliance payload builders (NTAK/NAV) | `tests/modules/compliance-payloads.test.ts` |
