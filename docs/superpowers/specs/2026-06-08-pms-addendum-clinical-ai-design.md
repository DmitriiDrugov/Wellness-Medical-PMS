# Design Spec — Addendum: Forms & Charting, Guest Booking, Memberships, AI Layer

**Date:** 2026-06-08
**Status:** Phase 6 approved; Phases 7–10 to be specced as reached.
**Scope:** Backend/API only. Extends the existing modular-monolith PMS. Same rules: no UI, RBAC at
service layer, append-only `AuditLog`, external dependencies behind interfaces with real + mock
implementations (the NTAK/NAV pattern).

## Addendum overview (Phases 6–10)

| Phase | Feature | Key new components |
|---|---|---|
| 6 | Forms & Charting (clinical) | FormTemplate, IntakeFormSubmission, Consent, TreatmentRecord; consent gate; clinical RBAC; `AuditAction.READ` |
| 7 | Guest self-service online booking | Public endpoints reusing conflict-detection; `source=online`, `status=pending_confirmation`; rate limiting |
| 8 | Memberships | MembershipPlan, Membership; `BillingGateway` (real-ready + mock); benefits applied at folio time |
| 9 | AI Scribe assistant | `AIProvider` (real + mock); drafts SOAP into TreatmentRecord (`status=draft`, `aiGenerated=true`); proposals-only, human sign required |
| 10 | Multilingual WhatsApp agent | `WhatsAppGateway` (real + simulator); Conversation, Message; least-privilege `ai_agent` role; HU/EN/RU/DE |

**Cross-cutting AI stance (Phases 9–10):** AI only *proposes*. It never signs, finalizes, or sits in
the authorization path. A human must review and explicitly sign. AI drafts and human signatures are
separate audit entries; drafts are flagged `aiGenerated=true`. The `ai_agent` role is least-privilege.

---

## PHASE 6 — Forms & Charting (APPROVED)

### Clinical data sensitivity (cross-cutting)
IntakeForm / Consent / TreatmentRecord hold health-adjacent personal data (GDPR special-category-
adjacent + Hungarian Infotörvény, 2011. évi CXII. tv.). Therefore:
- Strict RBAC: therapist (only own/assigned guests), manager, admin may read clinical records.
  Reception sees **consent status only** (granted/revoked), never clinical or consent content.
  Housekeeping has no access.
- A valid, non-revoked Consent of the required types MUST exist before a TreatmentRecord is created
  (enforced at the service layer).
- TreatmentRecord is IMMUTABLE once signed; corrections create an addendum record. Every read and
  write of clinical data is audit-logged.

### Confirmed decisions
1. **Consent gate:** creating a TreatmentRecord requires non-revoked `TREATMENT` **and**
   `GDPR_DATA_PROCESSING` consents for the guest.
2. **Therapist read scope:** a therapist may read a TreatmentRecord / consent / submission content if
   they authored the record (`providerId = self`) OR they have/had a TreatmentAppointment with the guest.
3. **Media references:** `photoRefs` / `docRef` store opaque external string keys only — no binary
   blobs in Postgres, no StorageGateway in this phase.
4. **Addendum/immutability:** the supersession pointer lives on the *addendum*
   (`addendum.supersededById = originalId`); the signed original is never mutated.
5. **Audit reads:** `AuditAction` gains `READ`; clinical reads are audit-logged.

### Module
New `src/modules/clinical`:
```
clinical.schema.ts            # zod for templates, submissions, consent, records
forms.repository.ts / forms.service.ts        # FormTemplate + IntakeFormSubmission
consent.repository.ts / consent.service.ts    # Consent (+ internal hasRequiredConsents)
records.repository.ts / records.service.ts    # TreatmentRecord (consent gate, sign, addendum)
access.ts                     # pure: computeMissingConsents, currentConsentStatus,
                              #       canTherapistAccess, assertRecordEditable
consent.types.ts              # cross-module interface (required consent check)
```
Reuses `appointmentsService.get` for appointment context and a new
`appointmentsService.hasAppointmentWithGuest(therapistId, guestId)` (internal) for read-scoping —
no duplicated scheduling logic.

### Prisma additions
- Enums: `FormType(INTAKE|MEDICAL_HISTORY|CUSTOM)`, `SubmissionStatus(PENDING|COMPLETED)`,
  `ConsentType(TREATMENT|GDPR_DATA_PROCESSING|PHOTO|MARKETING)`,
  `TreatmentRecordStatus(DRAFT|SIGNED)`; extend `AuditAction` with `READ`.
- **FormTemplate**: `id, propertyId, name, type, schema Json, version Int @default(1), active, createdAt, updatedAt`; unique `[propertyId, name]`.
- **IntakeFormSubmission**: `id, propertyId, guestId, templateId, templateVersion Int, answers Json, status, submittedAt?, createdAt, updatedAt`.
- **Consent**: `id, propertyId, guestId, type, version String, text String?, docRef String?, grantedAt, revokedAt?, createdAt`; index `[guestId, type]`; history-preserving.
- **TreatmentRecord**: `id, propertyId, treatmentAppointmentId, guestId, providerId, subjective?, objective?, assessment?, plan?, productsUsed Json?, photoRefs Json?, status @default(DRAFT), aiGenerated Boolean @default(false), signedById?, signedAt?, supersededById? @unique (self-relation), createdAt, updatedAt`.

### RBAC capabilities (added)
`forms:manage` (MANAGER, ADMIN) · `submission:write` (RECEPTION, RESERVATION_ADMIN, THERAPIST, MANAGER,
ADMIN) · `clinical:read` (THERAPIST scoped, MANAGER, ADMIN) · `clinical:write` (THERAPIST, MANAGER,
ADMIN) · `consent:write` (RECEPTION, THERAPIST, MANAGER, ADMIN) · `consent:read` (THERAPIST scoped,
MANAGER, ADMIN) · `consent:status:read` (RECEPTION, RESERVATION_ADMIN, THERAPIST, MANAGER, ADMIN).
Housekeeping: none. Submission full-content read uses `clinical:read`; metadata list uses `submission:write`.

### Endpoints
- Templates: `GET/POST /api/form-templates`, `GET/PATCH /api/form-templates/:id` (PATCH bumps version).
- Submissions: `POST /api/intake-submissions`, `GET /api/intake-submissions` (metadata-only list),
  `GET /api/intake-submissions/:id` (full = clinical:read), `PATCH /api/intake-submissions/:id`.
- Consent: `GET /api/guests/:guestId/consents` (full), `POST /api/guests/:guestId/consents` (grant),
  `GET /api/guests/:guestId/consents/status` (status-only), `POST /api/consents/:id/revoke`.
- Records: `POST /api/treatment-records`, `GET /api/treatment-records` (list),
  `GET /api/treatment-records/:id`, `PATCH /api/treatment-records/:id` (DRAFT only),
  `POST /api/treatment-records/:id/sign`, `POST /api/treatment-records/:id/addendum`.

### Error semantics
- Missing consent → `409 CONFLICT`, `error.details.missingConsents = [...]`.
- Edit/sign a non-DRAFT record → `409 CONFLICT`.
- Therapist accessing out-of-scope clinical data → `403 FORBIDDEN`.

### Tests (pure logic, no DB)
`computeMissingConsents`, `currentConsentStatus`, `canTherapistAccess`, `assertRecordEditable`.
Seed gains an intake FormTemplate and granted `TREATMENT` + `GDPR_DATA_PROCESSING` consents for the
checked-in demo guest so a record can be authored in demos.

### Docs
Domain model (Mermaid) gains the four entities; API reference gains the endpoints; an AI-stance
architecture note is added in Phase 9. ADR 0005 records the consent-gate + clinical-immutability decisions.
