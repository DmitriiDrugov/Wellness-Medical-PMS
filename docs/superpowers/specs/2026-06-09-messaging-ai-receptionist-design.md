# Design Spec — Phase 10 (revised): Internal AI-Receptionist Messaging Channel

**Date:** 2026-06-09
**Status:** Approved (brainstorm); supersedes the WhatsApp variant of Phase 10 in the
clinical/AI addendum.
**Scope:** Backend channel + staff web side. The guest client is a separate mobile app (built
later) that consumes these REST endpoints; it is **out of scope here**. Same project rules: modular
monolith, RBAC at the service layer, append-only `AuditLog`, external dependencies behind interfaces
with real + mock implementations (the NTAK/NAV pattern).

## 1. Overview

Replace the external WhatsApp integration with an **internal staff↔guest messaging channel** centred
on an **AI receptionist**. By default the AI handles every guest conversation; a staff member can
**take over** the dialogue (the AI then stops auto-replying) and **release** it back. The AI is a
constrained, audited principal that acts **autonomously within its zone of responsibility** — there
is **no human proposal/approval gate**; the control is **after-the-fact auditability**.

This revised Phase 10 also pulls in a thin slice of **guest authentication** (so the mobile client can
connect) and reuses the Phase 9 `AIProvider` abstraction.

| Concern | Decision |
|---|---|
| Deliverable | Backend messaging + guest auth + staff "Messages" web screen (no mobile app) |
| Guest auth | Email + password `GuestAccount`, reuses JWT infra, separate `guest` principal |
| Transport | REST polling with a `since` cursor (no websockets/workers) |
| Threading | One conversation per guest |
| Staff access | Reception, Reservation Admin, Manager, Admin (all); Therapist (own guests only); Housekeeping none |
| AI role | AI receptionist handles by default; human takeover; AI behind `AIProvider` (real + mock) |
| AI authority | Acts directly within a least-privilege capability scope; **audit, not approval** |

## 2. AI authority & guardrails (thesis-defense note)

The project's ADRs state *"AI only proposes, never sits in the authorization path."* This phase
deliberately revises that to **"AI acts within a least-privilege, fully-audited zone of
responsibility."** The safety story is preserved not by an approval gate but by three properties:

1. **Least privilege.** The AI is a real principal with role `AI_AGENT` whose capability set is
   strictly `messaging:read`, `messaging:write`, `reservation:read`, `reservation:write`,
   `appointment:read`, `appointment:write`, `catalog:read`. It is **denied** (by the same RBAC matrix
   that governs humans): `folio:*` (no charges/payments/close), all `clinical:*` / `consent:*`,
   `*:delete`, `staff:manage`, `compliance:manage`, `report:read`.
2. **Same path as humans.** The AI books **only** through the existing reservation/appointment
   services, so conflict-detection, validation, and append-only audit apply unchanged. It is a
   *constrained actor subject to* the controls, not a bypass.
3. **Auditability.** Every AI message and AI booking is an `AuditLog` row with the `AI_AGENT` actor. A
   dedicated **AI Activity** audit view (`actor = AI_AGENT`) makes the AI's work reviewable. Wrong
   bookings are reversed through the normal cancel flow (also audited). Human takeover halts the AI.

ADR 0006 will record this revision and its rationale.

## 3. Principals & authentication

- **`GuestAccount`** holds guest credentials, linked 1:1 to the existing staff-managed `Guest`
  profile. A guest sets their password via a first-login invite token (the invite delivery channel is
  mocked, like NTAK/NAV — no real email send in this phase).
- **`AuthContext` gains `kind: "staff" | "guest"`.** Guest access tokens carry `guestId` (no `role`,
  no capabilities — guests are authorized by ownership, not the RBAC matrix). Staff tokens are
  unchanged.
- **AI principal:** a seeded `Staff` row per property with role `AI_AGENT`, so AI actions flow through
  the existing RBAC + audit with `actorStaffId = <ai agent staff id>`.
- New endpoints: `POST /api/guest-auth/login`, `/refresh`, `/logout`; `POST /api/guest-auth/set-password`
  (invite token); `GET /api/guest/me`.

## 4. Prisma additions

- Enums:
  - extend `StaffRole` with `AI_AGENT`.
  - `ConversationHandling { AI, HUMAN }`, `ConversationStatus { OPEN, CLOSED }`,
    `MessageSenderKind { GUEST, AI, STAFF }`.
- **GuestAccount**: `id, guestId @unique, email @unique, passwordHash, invitedAt?, activatedAt?,
  lastLoginAt?, createdAt, updatedAt`. FK → `Guest`.
- **Conversation**: `id, propertyId, guestId @unique, handling @default(AI), status @default(OPEN),
  assignedStaffId?, lastMessageAt, createdAt, updatedAt`. Indexes `[propertyId, handling]`,
  `[propertyId, status]`.
- **Message**: `id, conversationId, senderKind, senderStaffId?, body, actionType?, actionId?,
  createdAt`. `actionType/actionId` link a message to a record the AI created in that turn (e.g.
  `Reservation`/id). Index `[conversationId, createdAt]`.
- `RefreshToken` is extended to also reference a `guestAccountId?` (or a parallel guest refresh-token
  table) so guest sessions rotate like staff sessions.

## 5. RBAC capabilities (added)

`messaging:read` / `messaging:write`.

| Role | messaging:read | messaging:write | Notes |
|---|---|---|---|
| RECEPTION, RESERVATION_ADMIN, MANAGER, ADMIN | ✓ | ✓ | all guest threads |
| THERAPIST | ✓ (scoped) | ✓ (scoped) | only guests they have/had an appointment with (`hasAppointmentWithGuest`) |
| HOUSEKEEPING | — | — | none |
| AI_AGENT | ✓ | ✓ | + `reservation:write`, `appointment:write`, `catalog:read` (its zone) |

Guests are not in the RBAC matrix: a guest may read/write **only their own** conversation, enforced by
matching the token's `guestId`.

## 6. Module

New `src/modules/messaging`:
```
messaging.schema.ts        # zod: send message, list query (since cursor), takeover/release
conversation.repository.ts # Conversation
message.repository.ts      # Message (append-only reads with cursor)
messaging.service.ts       # send, list, takeover, release, ensureConversationForGuest
access.ts                  # pure: canStaffAccessConversation, assertGuestOwnsConversation
ai/ai-provider.ts          # AIProvider interface + types (reply + optional action intents)
ai/mock-ai-provider.ts     # deterministic canned/echo + scripted tool-calls (tests/demos)
ai/real-ai-provider.ts     # LLM with tool-calling → maps to reservation/appointment services
ai/agent.ts                # runAiTurn(conversation): build history → provider → persist + act
```
Reuses `appointmentsService.hasAppointmentWithGuest` for therapist scoping and the
reservation/appointment services for AI actions (no duplicated logic).

## 7. Message flow (polling backend, no workers)

1. Guest `POST /api/conversations/me/messages { body }` → append `GUEST` message, bump `lastMessageAt`.
2. If `conversation.handling === AI`, the **same request** runs `runAiTurn`:
   - build recent history → `AIProvider.respond(history, guestContext)`.
   - persist the `AI` reply message.
   - for each action intent the provider returns, execute it via the relevant service **as the
     `AI_AGENT` principal** (RBAC + conflict-detection + audit apply); attach `actionType/actionId` to
     the AI message. Failures become a graceful AI message ("I couldn't complete that…"), never a 500.
3. If `handling === HUMAN`, no AI turn runs; the message simply waits for staff.
4. Both sides poll `GET /api/conversations/:id/messages?since=<ISO|id>` for new messages.

`AIProvider` mock returns deterministic replies and scripted action intents so the agent loop is unit-
testable with no network.

## 8. Human takeover

- `POST /api/conversations/:id/take-over` → `handling=HUMAN`, `assignedStaffId=ctx.staffId`; audited
  `STATE_CHANGE`.
- `POST /api/conversations/:id/release` → `handling=AI`, clear assignment; audited.
- Staff `POST /api/conversations/:id/messages` posts a `STAFF` message (allowed regardless of handling;
  posting while `AI` implicitly does **not** auto-take-over — staff use take-over explicitly).

## 9. Endpoints

| Method | Path | Principal / Capability |
|---|---|---|
| POST | `/api/guest-auth/login` / `/refresh` / `/logout` | public / guest |
| POST | `/api/guest-auth/set-password` | invite token |
| GET | `/api/guest/me` | guest |
| GET | `/api/conversations/me` + `/api/conversations/me/messages` | guest (own only) |
| POST | `/api/conversations/me/messages` | guest (triggers AI turn) |
| GET | `/api/conversations` | messaging:read (staff; therapist scoped) |
| GET | `/api/conversations/:id` + `/messages?since=` | messaging:read |
| POST | `/api/conversations/:id/messages` | messaging:write (STAFF message) |
| POST | `/api/conversations/:id/take-over` / `/release` | messaging:write |

## 10. Staff web

Replace the WhatsApp Console stub: route `/whatsapp` → **`/messages`** (sidebar label "Messages", icon
`forum`). Thread list with **AI Handled / Needs Staff** badges + last message; conversation view with
message bubbles (guest / AI / staff distinguished), `actionRef` chips ("AI booked Room 101"),
**Take over / Release** button, and a composer (enabled when human-handled). Polls for new messages.
The **AI Activity** audit view is the existing Audit Log filtered to `actor = AI_AGENT`.

## 11. Error semantics

- Guest accessing another guest's conversation → `403`.
- Therapist accessing an out-of-scope conversation → `403`.
- AI action failure (conflict/validation) → no HTTP error; surfaced as an AI message and an audit row.
- A guest message to a `CLOSED` conversation **auto-reopens** it (`status=OPEN`, `handling=AI`); a
  staff message to a `CLOSED` conversation returns `409` (staff reopen via take-over).

## 12. Tests (pure logic, no DB)

`canStaffAccessConversation` (role + therapist scope), `assertGuestOwnsConversation`, message
`since`-cursor selection, `runAiTurn` with the **mock** provider (reply persisted; scripted action
executed as AI_AGENT; failure → graceful message), RBAC matrix gains `messaging:*` and `AI_AGENT`
assertions.

## 13. Docs

Domain model (Mermaid) gains `GuestAccount`, `Conversation`, `Message`. `api-reference.md` gains the
endpoints above. **ADR 0006** records the messaging channel + the revised AI-authority stance
(autonomous-within-zone, audit-not-approval) superseding the WhatsApp/proposal-only variant.

## 14. Out of scope (YAGNI)

Mobile app; message attachments/media; multilingual auto-translation; AI taking payments or touching
clinical data; websockets/real-time push; group/multi-thread conversations.
