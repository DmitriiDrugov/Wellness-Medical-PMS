# ADR 0006 — AI Agent Authority — Autonomous Within a Least-Privilege Audited Zone

**Status:** Accepted · **Date:** 2026-06-09
Supersedes the WhatsApp/proposal-only variant of Phase 10 in the clinical/AI addendum.

## Context

Earlier ADRs and the project spec stated *"AI only proposes, never sits in the authorization path."*
That stance was appropriate for the clinical AI scribe (Phase 9), where health-data sensitivity warrants
a human review gate before any write.

Phase 10 introduces an **AI receptionist** for the internal staff↔guest messaging channel. The product
decision here is different: the AI should be able to handle guest conversations end-to-end, including
making bookings directly (no human approval gate), while human takeover remains available at any time.
A pure proposal-only model would make the AI receptionist significantly less useful without a
proportionate safety benefit, because the operations within its zone (reservations, appointments) are
already reversible, conflict-detected, and fully audited.

## Decision

The AI acts as a **real, least-privilege principal** — a seeded `Staff` row per property with role
`StaffRole.AI_AGENT` — subject to the same RBAC, conflict-detection, and append-only audit that govern
human staff.

**Granted capabilities:** `messaging:read`, `messaging:write`, `reservation:read`, `reservation:write`,
`appointment:read`, `appointment:write`, `catalog:read`.

**Explicitly denied:** `folio:*` (no charges, payments, or close), all `clinical:*` and `consent:*`,
`*:delete`, `staff:manage`, `compliance:manage`, `report:read`.

The AI books **only through the existing reservation and appointment services**, so conflict-detection,
validation, and the append-only audit log apply unchanged. It is a constrained actor subject to the
controls, not a bypass around them.

The control is **auditability after the fact**, not a pre-action approval gate:
- Every AI message and every AI booking produces an `AuditLog` row with `actorStaffId = <ai_agent id>`.
- A dedicated **AI Activity** view (audit log filtered to `actor = AI_AGENT`) makes the AI's work
  reviewable at any time.
- Wrong or unwanted AI bookings are reversed through the normal cancel flow (also audited).
- Any staff member with `messaging:write` can **take over** a conversation (`handling=HUMAN`), at which
  point the AI stops auto-replying. Staff can **release** it back to AI at any time.

This revision applies **only to the messaging/receptionist channel**. The clinical AI scribe (Phase 9),
if built, remains strictly proposal-only because writing health-adjacent records warrants a human
signature gate, per ADR 0005.

## Consequences

**Positive:**
- The AI receptionist is genuinely useful — it can book on behalf of guests — while staying inside
  the same RBAC and audit controls as human staff.
- The full audit trail of AI actions satisfies the thesis requirement for an auditable, traceable
  system without adding a separate approval workflow.
- Human takeover is always one click away; the AI cannot touch financials, clinical data, or staff
  management.

**Negative / mitigations:**
- The AI can make a booking that turns out to be wrong (wrong date, wrong treatment). Mitigated by:
  full audit trail, human takeover/review, and the normal cancel flow. The booking is reversible; no
  financial write happens at booking time.

**Scope boundary:**
- This ADR supersedes the proposal-only stance **for the messaging channel only**.
- Clinical AI (scribe) remains proposal-only per ADR 0005.

## Related

- ADR 0002 (append-only audit). ADR 0005 (clinical data governance, proposal-only scribe).
- Spec: `docs/superpowers/specs/2026-06-09-messaging-ai-receptionist-design.md` §2 (AI authority).
