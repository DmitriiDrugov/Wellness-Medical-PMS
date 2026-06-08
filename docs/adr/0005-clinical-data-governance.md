# ADR 0005 — Clinical data governance (consent gate + immutable records)

**Status:** Accepted · **Date:** 2026-06-08

## Context
Phase 6 introduces health-adjacent personal data (IntakeFormSubmission, Consent, TreatmentRecord)
subject to GDPR special-category-adjacent handling and the Hungarian Infotörvény (2011. évi CXII. tv.).
This data needs stricter controls than operational data.

## Decision
- **Strict RBAC.** New capabilities gate clinical access: `clinical:read/write`, `consent:read/write`,
  `consent:status:read`, `submission:write`, `forms:manage`. Therapists are further scoped at the
  service layer to guests they authored records for OR have an appointment with. Reception sees
  **consent status only** (never content); housekeeping has no access.
- **Consent gate.** A `TreatmentRecord` may be created only when the guest holds non-revoked
  `TREATMENT` and `GDPR_DATA_PROCESSING` consents. Enforced in `recordsService.create`.
- **Immutability + addenda.** A `TreatmentRecord` is immutable once `SIGNED`. Corrections create a
  new DRAFT addendum whose `supersededById` points to the prior record; the signed original is never
  mutated. Only a human sign locks a record.
- **Consent history.** Consent is never hard-deleted; revoke sets `revokedAt`, and a new grant is a
  new row. Current status = latest row per type.
- **Audit on read.** `AuditAction` gains `READ`; every clinical read and write is audit-logged.
- **No blobs.** `photoRefs`/`docRef` store opaque external references only; no binary data in Postgres.

## Consequences
- Clinical authoring requires consent capture first — a deliberate, defensible workflow for a thesis
  on auditable medical-wellness systems.
- Read auditing increases `AuditLog` volume; acceptable for the compliance posture.
- The immutable-original model makes the audit trail tamper-evident and easy to reason about.

## Related
- ADR 0002 (append-only audit). Spec addendum §Phase 6. Phase 9 reuses `TreatmentRecord.aiGenerated`.
