# AI-Receptionist Messaging Channel — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an internal staff↔guest messaging channel with an AI receptionist that handles guest conversations autonomously within a least-privilege, fully-audited zone of responsibility, plus human takeover and a staff "Messages" web screen — replacing the WhatsApp stub.

**Architecture:** New `src/modules/messaging` module (conversation/message repos + service + pure access rules + AI agent loop) following the existing service/repository/zod/RBAC patterns. Guests authenticate via a new `GuestAccount` + guest JWT principal (`AuthContext.kind`). The AI is a seeded `Staff` row with role `AI_AGENT`, booking through existing reservation/appointment services so RBAC, conflict-detection and append-only audit apply unchanged. The `AIProvider` external dependency follows the NTAK/NAV gateway pattern (real + mock). Transport is REST polling with a `since` cursor.

**Tech Stack:** Next.js 14 App Router (API routes), Prisma + PostgreSQL, zod, jsonwebtoken, bcryptjs, vitest. Frontend: React client components + Tailwind (existing `src/web`).

**Reference spec:** `docs/superpowers/specs/2026-06-09-messaging-ai-receptionist-design.md`

---

## File Structure

**Prisma / platform**
- Modify `prisma/schema.prisma` — enums (`AI_AGENT`, conversation/message enums), models `GuestAccount`, `Conversation`, `Message`; `RefreshToken.guestAccountId?`.
- Modify `src/platform/rbac.ts` — `messaging:read`/`messaging:write` caps; `AI_AGENT` matrix row.
- Modify `src/platform/auth/jwt.ts` — guest token issue/verify helpers.
- Modify `src/platform/auth/context.ts` — `AuthContext.kind`, `requireStaff`, `requireGuest`.

**Guest auth**
- Create `src/modules/guest-auth/{guest-auth.schema.ts,guest-auth.repository.ts,guest-auth.service.ts,guest-auth.types.ts}`.
- Create routes `app/api/guest-auth/{login,refresh,logout,set-password}/route.ts`, `app/api/guest/me/route.ts`.

**Messaging**
- Create `src/modules/messaging/{messaging.schema.ts,access.ts,conversation.repository.ts,message.repository.ts,messaging.service.ts}`.
- Create `src/modules/messaging/ai/{ai-provider.ts,mock-ai-provider.ts,real-ai-provider.ts,agent.ts}`.
- Create routes: `app/api/conversations/route.ts`, `app/api/conversations/[id]/route.ts`, `app/api/conversations/[id]/messages/route.ts`, `app/api/conversations/[id]/take-over/route.ts`, `app/api/conversations/[id]/release/route.ts`, `app/api/conversations/me/route.ts`, `app/api/conversations/me/messages/route.ts`.

**Tests**
- Create `tests/modules/messaging-access.test.ts`, `tests/modules/messaging-agent.test.ts`.
- Modify `tests/platform/rbac.test.ts`.

**Seed / web / docs**
- Modify `prisma/seed.ts` — AI_AGENT staff, demo GuestAccount + conversation.
- Replace `app/(app)/whatsapp/page.tsx` → `app/(app)/messages/page.tsx`; modify `src/web/nav.ts`, `src/web/types.ts`.
- Modify `docs/api-reference.md`, `docs/domain-model.md`; create `docs/adr/0006-ai-agent-authority.md`.

---

## Task 1: Prisma schema — models, enums, migration

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Add the `AI_AGENT` enum value to `StaffRole`**

In `prisma/schema.prisma`, find `enum StaffRole { ... }` and add `AI_AGENT` as the last value.

- [ ] **Step 2: Add messaging enums**

Add near the other enums:

```prisma
enum ConversationHandling {
  AI
  HUMAN
}

enum ConversationStatus {
  OPEN
  CLOSED
}

enum MessageSenderKind {
  GUEST
  AI
  STAFF
}
```

- [ ] **Step 3: Add the `GuestAccount` model and relation on `Guest`**

```prisma
model GuestAccount {
  id           String    @id @default(cuid())
  guestId      String    @unique
  guest        Guest     @relation(fields: [guestId], references: [id])
  email        String    @unique
  passwordHash String?
  inviteTokenHash String?
  invitedAt    DateTime?
  activatedAt  DateTime?
  lastLoginAt  DateTime?
  createdAt    DateTime  @default(now())
  updatedAt    DateTime  @updatedAt
}
```

Add to `model Guest { ... }` relations: `guestAccount GuestAccount?`.

- [ ] **Step 4: Add `Conversation` and `Message` models**

```prisma
model Conversation {
  id              String               @id @default(cuid())
  propertyId      String
  property        Property             @relation(fields: [propertyId], references: [id])
  guestId         String               @unique
  guest           Guest                @relation(fields: [guestId], references: [id])
  handling        ConversationHandling @default(AI)
  status          ConversationStatus   @default(OPEN)
  assignedStaffId String?
  assignedStaff   Staff?               @relation("ConversationAssignee", fields: [assignedStaffId], references: [id])
  lastMessageAt   DateTime             @default(now())
  createdAt       DateTime             @default(now())
  updatedAt       DateTime             @updatedAt

  messages Message[]

  @@index([propertyId, status])
  @@index([propertyId, handling])
}

model Message {
  id             String            @id @default(cuid())
  conversationId String
  conversation   Conversation      @relation(fields: [conversationId], references: [id], onDelete: Cascade)
  senderKind     MessageSenderKind
  senderStaffId  String?
  body           String
  actionType     String? // e.g. "Reservation", "TreatmentAppointment"
  actionId       String?
  createdAt      DateTime          @default(now())

  @@index([conversationId, createdAt])
}
```

Add relations on `Guest`: `conversation Conversation?`. On `Staff`: `assignedConversations Conversation[] @relation("ConversationAssignee")`.

- [ ] **Step 5: Add guest reference on `RefreshToken`**

In `model RefreshToken`, add an optional column so guest sessions reuse the table:

```prisma
  guestAccountId String?
```

Add index `@@index([guestAccountId])` inside the model. (The existing `staffId` becomes effectively "one of staff/guest"; keep `staffId` optional if it is currently required — change `staffId String` to `staffId String?` and add `@@index([staffId])` if not present.)

- [ ] **Step 6: Push schema to the dev database**

Run: `npx prisma db push`
Expected: "Your database is now in sync with your Prisma schema."

- [ ] **Step 7: Regenerate the Prisma client**

Run: `npx prisma generate`
Expected: "Generated Prisma Client".

- [ ] **Step 8: Commit**

```bash
git add prisma/schema.prisma
git commit -m "feat(db): GuestAccount, Conversation, Message models + AI_AGENT role"
```

---

## Task 2: RBAC — messaging capabilities + AI_AGENT role

**Files:**
- Modify: `src/platform/rbac.ts`
- Test: `tests/platform/rbac.test.ts`

- [ ] **Step 1: Write failing RBAC tests**

Add to `tests/platform/rbac.test.ts`:

```ts
it("grants messaging to front desk + management, scopes therapist, denies housekeeping", () => {
  expect(can("RECEPTION", "messaging:write")).toBe(true);
  expect(can("MANAGER", "messaging:read")).toBe(true);
  expect(can("THERAPIST", "messaging:read")).toBe(true); // service adds own-guest scope
  expect(can("HOUSEKEEPING", "messaging:read")).toBe(false);
});

it("gives AI_AGENT a least-privilege booking zone and nothing destructive/financial", () => {
  expect(can("AI_AGENT", "messaging:write")).toBe(true);
  expect(can("AI_AGENT", "reservation:write")).toBe(true);
  expect(can("AI_AGENT", "appointment:write")).toBe(true);
  expect(can("AI_AGENT", "catalog:read")).toBe(true);
  expect(can("AI_AGENT", "folio:write")).toBe(false);
  expect(can("AI_AGENT", "folio:close")).toBe(false);
  expect(can("AI_AGENT", "clinical:read")).toBe(false);
  expect(can("AI_AGENT", "staff:manage")).toBe(false);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- rbac`
Expected: FAIL — `AI_AGENT` not assignable / capability missing.

- [ ] **Step 3: Add the capabilities and role**

In `src/platform/rbac.ts`:
- Add to the `Capability` union: `| "messaging:read" | "messaging:write"`.
- Add both to the `ALL` array.
- Add `"messaging:read", "messaging:write"` to `RECEPTION`, `RESERVATION_ADMIN`, `THERAPIST` arrays (MANAGER/ADMIN already get everything via `ALL`).
- Add a new matrix entry:

```ts
  AI_AGENT: [
    "messaging:read", "messaging:write",
    "reservation:read", "reservation:write",
    "appointment:read", "appointment:write",
    "catalog:read",
  ],
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- rbac`
Expected: PASS.

- [ ] **Step 5: Typecheck**

Run: `npm run typecheck`
Expected: no errors (the `Record<StaffRole, Capability[]>` matrix now covers `AI_AGENT`).

- [ ] **Step 6: Commit**

```bash
git add src/platform/rbac.ts tests/platform/rbac.test.ts
git commit -m "feat(rbac): messaging caps + least-privilege AI_AGENT role"
```

---

## Task 3: Guest JWT + auth context principal kind

**Files:**
- Modify: `src/platform/auth/jwt.ts`
- Modify: `src/platform/auth/context.ts`

- [ ] **Step 1: Add guest token claims + helpers in `jwt.ts`**

Append to `src/platform/auth/jwt.ts`:

```ts
/** Claims carried in a GUEST access token. */
export interface GuestTokenClaims {
  sub: string; // guestAccountId
  guestId: string;
  propertyId: string;
  kind: "guest";
}

export function issueGuestAccessToken(claims: Omit<GuestTokenClaims, "kind">): string {
  return jwt.sign({ ...claims, kind: "guest" }, config.jwt.accessSecret, {
    expiresIn: config.jwt.accessTtlSeconds,
  });
}

export function verifyGuestAccessToken(token: string): GuestTokenClaims {
  try {
    const decoded = jwt.verify(token, config.jwt.accessSecret);
    if (typeof decoded === "string") throw new Error("Unexpected token payload");
    const d = decoded as jwt.JwtPayload & Partial<GuestTokenClaims>;
    if (!d.sub || !d.guestId || !d.propertyId || d.kind !== "guest") throw new Error("Missing claims");
    return { sub: d.sub, guestId: d.guestId, propertyId: d.propertyId, kind: "guest" };
  } catch {
    throw new UnauthorizedError("Invalid or expired guest token");
  }
}
```

- [ ] **Step 2: Extend `AuthContext` and add `requireStaff` / `requireGuest`**

Rewrite `src/platform/auth/context.ts`:

```ts
import type { StaffRole } from "@prisma/client";
import { UnauthorizedError, ForbiddenError } from "@/platform/errors";
import { verifyAccessToken } from "@/platform/auth/jwt";
import { verifyGuestAccessToken } from "@/platform/auth/jwt";

export interface StaffAuthContext {
  kind: "staff";
  staffId: string;
  role: StaffRole;
  propertyId: string;
}
export interface GuestAuthContext {
  kind: "guest";
  guestAccountId: string;
  guestId: string;
  propertyId: string;
}
export type AuthContext = StaffAuthContext;

function bearer(req: Request): string {
  const header = req.headers.get("authorization") ?? req.headers.get("Authorization");
  if (!header || !header.startsWith("Bearer ")) {
    throw new UnauthorizedError("Missing or malformed Authorization header");
  }
  return header.slice("Bearer ".length).trim();
}

/** Staff principal (unchanged signature for existing callers). */
export function requireAuth(req: Request): StaffAuthContext {
  const claims = verifyAccessToken(bearer(req));
  return { kind: "staff", staffId: claims.sub, role: claims.role, propertyId: claims.propertyId };
}

export const requireStaff = requireAuth;

/** Guest principal — authorized by ownership, not the RBAC matrix. */
export function requireGuest(req: Request): GuestAuthContext {
  const claims = verifyGuestAccessToken(bearer(req));
  return {
    kind: "guest",
    guestAccountId: claims.sub,
    guestId: claims.guestId,
    propertyId: claims.propertyId,
  };
}
```

Note: `AuthContext` stays aliased to `StaffAuthContext` so all existing services compile unchanged.

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/platform/auth/jwt.ts src/platform/auth/context.ts
git commit -m "feat(auth): guest JWT claims + requireGuest principal"
```

---

## Task 4: Guest-auth module (service/repo/schema/types)

**Files:**
- Create: `src/modules/guest-auth/guest-auth.types.ts`
- Create: `src/modules/guest-auth/guest-auth.schema.ts`
- Create: `src/modules/guest-auth/guest-auth.repository.ts`
- Create: `src/modules/guest-auth/guest-auth.service.ts`

- [ ] **Step 1: Types**

`src/modules/guest-auth/guest-auth.types.ts`:

```ts
export interface GuestProfile {
  guestId: string;
  email: string;
  firstName: string;
  lastName: string;
  propertyId: string;
}
export interface GuestTokenPair {
  accessToken: string;
  refreshToken: string;
  tokenType: "Bearer";
  expiresIn: number;
}
```

- [ ] **Step 2: Schemas**

`src/modules/guest-auth/guest-auth.schema.ts`:

```ts
import { z } from "zod";

export const guestLoginSchema = z.object({ email: z.string().email(), password: z.string().min(1) });
export const guestRefreshSchema = z.object({ refreshToken: z.string().min(1) });
export const guestLogoutSchema = z.object({ refreshToken: z.string().min(1) });
export const guestSetPasswordSchema = z.object({
  inviteToken: z.string().min(1),
  password: z.string().min(8),
});

export type GuestLoginInput = z.infer<typeof guestLoginSchema>;
export type GuestRefreshInput = z.infer<typeof guestRefreshSchema>;
export type GuestLogoutInput = z.infer<typeof guestLogoutSchema>;
export type GuestSetPasswordInput = z.infer<typeof guestSetPasswordSchema>;
```

- [ ] **Step 3: Repository**

`src/modules/guest-auth/guest-auth.repository.ts`:

```ts
import { prisma } from "@/platform/db";

export const guestAuthRepository = {
  findAccountByEmail(email: string) {
    return prisma.guestAccount.findUnique({ where: { email }, include: { guest: true } });
  },
  findAccountById(id: string) {
    return prisma.guestAccount.findUnique({ where: { id }, include: { guest: true } });
  },
  findAccountByInviteHash(inviteTokenHash: string) {
    return prisma.guestAccount.findFirst({ where: { inviteTokenHash }, include: { guest: true } });
  },
  activate(id: string, passwordHash: string) {
    return prisma.guestAccount.update({
      where: { id },
      data: { passwordHash, inviteTokenHash: null, activatedAt: new Date() },
    });
  },
  touchLogin(id: string) {
    return prisma.guestAccount.update({ where: { id }, data: { lastLoginAt: new Date() } });
  },
  createRefreshToken(input: { guestAccountId: string; tokenHash: string; expiresAt: Date }) {
    return prisma.refreshToken.create({ data: input });
  },
  findValidRefreshToken(tokenHash: string) {
    return prisma.refreshToken.findFirst({
      where: { tokenHash, revokedAt: null, expiresAt: { gt: new Date() } },
    });
  },
  revokeRefreshTokenById(id: string) {
    return prisma.refreshToken.update({ where: { id }, data: { revokedAt: new Date() } });
  },
  revokeRefreshTokenByHash(tokenHash: string) {
    return prisma.refreshToken.updateMany({ where: { tokenHash, revokedAt: null }, data: { revokedAt: new Date() } });
  },
};
```

- [ ] **Step 4: Service**

`src/modules/guest-auth/guest-auth.service.ts`:

```ts
import { config } from "@/platform/config";
import { UnauthorizedError, NotFoundError, ValidationError } from "@/platform/errors";
import { recordAudit } from "@/platform/audit";
import {
  issueGuestAccessToken,
  generateRefreshToken,
  hashRefreshToken,
  refreshTokenExpiry,
} from "@/platform/auth/jwt";
import { hashPassword, verifyPassword } from "@/platform/auth/password";
import { guestAuthRepository } from "@/modules/guest-auth/guest-auth.repository";
import type { GuestProfile, GuestTokenPair } from "@/modules/guest-auth/guest-auth.types";
import type {
  GuestLoginInput, GuestRefreshInput, GuestLogoutInput, GuestSetPasswordInput,
} from "@/modules/guest-auth/guest-auth.schema";

type Account = Awaited<ReturnType<typeof guestAuthRepository.findAccountById>>;

async function issuePair(account: NonNullable<Account>): Promise<GuestTokenPair> {
  const accessToken = issueGuestAccessToken({
    sub: account.id,
    guestId: account.guestId,
    propertyId: account.guest.propertyId,
  });
  const refresh = generateRefreshToken();
  await guestAuthRepository.createRefreshToken({
    guestAccountId: account.id,
    tokenHash: refresh.hash,
    expiresAt: refreshTokenExpiry(),
  });
  return { accessToken, refreshToken: refresh.raw, tokenType: "Bearer", expiresIn: config.jwt.accessTtlSeconds };
}

function toProfile(account: NonNullable<Account>): GuestProfile {
  return {
    guestId: account.guestId,
    email: account.email,
    firstName: account.guest.firstName,
    lastName: account.guest.lastName,
    propertyId: account.guest.propertyId,
  };
}

export const guestAuthService = {
  async login(input: GuestLoginInput): Promise<GuestTokenPair> {
    const account = await guestAuthRepository.findAccountByEmail(input.email);
    const ok = account?.passwordHash ? await verifyPassword(input.password, account.passwordHash) : false;
    if (!account || !account.activatedAt || !ok) throw new UnauthorizedError("Invalid credentials");
    await guestAuthRepository.touchLogin(account.id);
    await recordAudit({
      actorStaffId: null, propertyId: account.guest.propertyId,
      action: "LOGIN", entityType: "GuestAccount", entityId: account.id,
    });
    return issuePair(account);
  },

  async setPassword(input: GuestSetPasswordInput): Promise<GuestProfile> {
    const account = await guestAuthRepository.findAccountByInviteHash(hashRefreshToken(input.inviteToken));
    if (!account) throw new ValidationError("Invalid or used invite token");
    const passwordHash = await hashPassword(input.password);
    const updated = await guestAuthRepository.activate(account.id, passwordHash);
    return toProfile({ ...account, ...updated });
  },

  async refresh(input: GuestRefreshInput): Promise<GuestTokenPair> {
    const existing = await guestAuthRepository.findValidRefreshToken(hashRefreshToken(input.refreshToken));
    if (!existing?.guestAccountId) throw new UnauthorizedError("Invalid or expired refresh token");
    const account = await guestAuthRepository.findAccountById(existing.guestAccountId);
    if (!account) throw new UnauthorizedError("Account not found");
    await guestAuthRepository.revokeRefreshTokenById(existing.id);
    return issuePair(account);
  },

  async logout(input: GuestLogoutInput): Promise<void> {
    await guestAuthRepository.revokeRefreshTokenByHash(hashRefreshToken(input.refreshToken));
  },

  async getProfile(guestAccountId: string): Promise<GuestProfile> {
    const account = await guestAuthRepository.findAccountById(guestAccountId);
    if (!account) throw new NotFoundError("Guest account not found");
    return toProfile(account);
  },
};
```

Note: confirm `hashPassword` exists in `src/platform/auth/password.ts`; if only `verifyPassword` exists, add `export async function hashPassword(pw: string){ return bcrypt.hash(pw, 10); }` there in this step.

- [ ] **Step 5: Typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/modules/guest-auth src/platform/auth/password.ts
git commit -m "feat(guest-auth): GuestAccount login/refresh/logout/set-password service"
```

---

## Task 5: Guest-auth routes

**Files:**
- Create: `app/api/guest-auth/login/route.ts`, `app/api/guest-auth/refresh/route.ts`, `app/api/guest-auth/logout/route.ts`, `app/api/guest-auth/set-password/route.ts`
- Create: `app/api/guest/me/route.ts`

- [ ] **Step 1: Login / refresh / logout / set-password routes**

`app/api/guest-auth/login/route.ts`:

```ts
import { handle, ok, parseJson } from "@/platform/http";
import { guestLoginSchema } from "@/modules/guest-auth/guest-auth.schema";
import { guestAuthService } from "@/modules/guest-auth/guest-auth.service";

export const POST = handle(async (req) => {
  const input = guestLoginSchema.parse(await parseJson(req));
  return ok(await guestAuthService.login(input));
});
```

`app/api/guest-auth/refresh/route.ts` — same shape with `guestRefreshSchema` → `guestAuthService.refresh`.
`app/api/guest-auth/logout/route.ts` — `guestLogoutSchema` → `guestAuthService.logout`, return `ok({ ok: true })`.
`app/api/guest-auth/set-password/route.ts` — `guestSetPasswordSchema` → `guestAuthService.setPassword`.

- [ ] **Step 2: `GET /api/guest/me`**

`app/api/guest/me/route.ts`:

```ts
import { handle, ok } from "@/platform/http";
import { requireGuest } from "@/platform/auth/context";
import { guestAuthService } from "@/modules/guest-auth/guest-auth.service";

export const GET = handle(async (req) => {
  const ctx = requireGuest(req);
  return ok(await guestAuthService.getProfile(ctx.guestAccountId));
});
```

- [ ] **Step 3: Typecheck + build**

Run: `npm run typecheck && npm run build`
Expected: routes compile; no errors.

- [ ] **Step 4: Commit**

```bash
git add app/api/guest-auth app/api/guest
git commit -m "feat(guest-auth): REST routes (login/refresh/logout/set-password/me)"
```

---

## Task 6: Messaging access rules (pure, TDD)

**Files:**
- Create: `src/modules/messaging/access.ts`
- Test: `tests/modules/messaging-access.test.ts`

- [ ] **Step 1: Write failing tests**

`tests/modules/messaging-access.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { canStaffAccessConversation, assertGuestOwnsConversation } from "@/modules/messaging/access";
import { ForbiddenError } from "@/platform/errors";

describe("messaging access", () => {
  const conv = { guestId: "g1" };

  it("lets reception/manager access any conversation", () => {
    expect(canStaffAccessConversation("RECEPTION", "s1", conv, false)).toBe(true);
    expect(canStaffAccessConversation("MANAGER", "s1", conv, false)).toBe(true);
  });

  it("lets a therapist access only their own guest's conversation", () => {
    expect(canStaffAccessConversation("THERAPIST", "t1", conv, true)).toBe(true);
    expect(canStaffAccessConversation("THERAPIST", "t1", conv, false)).toBe(false);
  });

  it("denies housekeeping", () => {
    expect(canStaffAccessConversation("HOUSEKEEPING", "s1", conv, true)).toBe(false);
  });

  it("guest ownership: matches guestId, else 403", () => {
    expect(() => assertGuestOwnsConversation("g1", conv)).not.toThrow();
    expect(() => assertGuestOwnsConversation("other", conv)).toThrow(ForbiddenError);
  });
});
```

- [ ] **Step 2: Run to verify fail**

Run: `npm test -- messaging-access`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `access.ts`**

```ts
import type { StaffRole } from "@prisma/client";
import { ForbiddenError } from "@/platform/errors";

const ALL_ACCESS: StaffRole[] = ["RECEPTION", "RESERVATION_ADMIN", "MANAGER", "ADMIN"];

/**
 * Whether a staff member may read/write a conversation.
 * `therapistHasGuest` is supplied by the service (appointmentsService.hasAppointmentWithGuest).
 */
export function canStaffAccessConversation(
  role: StaffRole,
  _staffId: string,
  _conv: { guestId: string },
  therapistHasGuest: boolean,
): boolean {
  if (ALL_ACCESS.includes(role)) return true;
  if (role === "THERAPIST") return therapistHasGuest;
  return false; // HOUSEKEEPING, AI_AGENT handled separately
}

export function assertGuestOwnsConversation(guestId: string, conv: { guestId: string }): void {
  if (conv.guestId !== guestId) throw new ForbiddenError("Not your conversation");
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npm test -- messaging-access`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/modules/messaging/access.ts tests/modules/messaging-access.test.ts
git commit -m "feat(messaging): pure access rules + tests"
```

---

## Task 7: Messaging schema + repositories

**Files:**
- Create: `src/modules/messaging/messaging.schema.ts`
- Create: `src/modules/messaging/conversation.repository.ts`
- Create: `src/modules/messaging/message.repository.ts`

- [ ] **Step 1: Schema**

`src/modules/messaging/messaging.schema.ts`:

```ts
import { z } from "zod";

export const sendMessageSchema = z.object({ body: z.string().min(1).max(4000) });
export const listMessagesQuerySchema = z.object({
  since: z.string().optional(), // ISO timestamp cursor (exclusive)
  limit: z.coerce.number().int().min(1).max(100).default(50),
});
export const listConversationsQuerySchema = z.object({
  handling: z.enum(["AI", "HUMAN"]).optional(),
  status: z.enum(["OPEN", "CLOSED"]).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(50),
});

export type SendMessageInput = z.infer<typeof sendMessageSchema>;
export type ListMessagesQuery = z.infer<typeof listMessagesQuerySchema>;
export type ListConversationsQuery = z.infer<typeof listConversationsQuerySchema>;
```

- [ ] **Step 2: Conversation repository**

`src/modules/messaging/conversation.repository.ts`:

```ts
import type { Prisma, ConversationHandling, ConversationStatus } from "@prisma/client";
import { prisma } from "@/platform/db";

export const conversationRepository = {
  findById(id: string) {
    return prisma.conversation.findUnique({ where: { id }, include: { guest: true } });
  },
  findByGuestId(guestId: string) {
    return prisma.conversation.findUnique({ where: { guestId }, include: { guest: true } });
  },
  create(data: { propertyId: string; guestId: string }) {
    return prisma.conversation.create({
      data: { propertyId: data.propertyId, guestId: data.guestId },
      include: { guest: true },
    });
  },
  update(id: string, data: Prisma.ConversationUpdateInput) {
    return prisma.conversation.update({ where: { id }, data, include: { guest: true } });
  },
  async list(params: {
    propertyId: string; skip: number; take: number;
    handling?: ConversationHandling; status?: ConversationStatus; guestIds?: string[];
  }) {
    const where: Prisma.ConversationWhereInput = {
      propertyId: params.propertyId,
      ...(params.handling ? { handling: params.handling } : {}),
      ...(params.status ? { status: params.status } : {}),
      ...(params.guestIds ? { guestId: { in: params.guestIds } } : {}),
    };
    const [items, total] = await Promise.all([
      prisma.conversation.findMany({
        where, skip: params.skip, take: params.take,
        orderBy: { lastMessageAt: "desc" }, include: { guest: true },
      }),
      prisma.conversation.count({ where }),
    ]);
    return { items, total };
  },
};
```

- [ ] **Step 3: Message repository**

`src/modules/messaging/message.repository.ts`:

```ts
import type { Prisma, MessageSenderKind } from "@prisma/client";
import { prisma } from "@/platform/db";

export const messageRepository = {
  create(data: {
    conversationId: string; senderKind: MessageSenderKind; senderStaffId?: string;
    body: string; actionType?: string; actionId?: string;
  }) {
    return prisma.message.create({ data });
  },
  listSince(conversationId: string, since: Date | undefined, take: number) {
    const where: Prisma.MessageWhereInput = {
      conversationId,
      ...(since ? { createdAt: { gt: since } } : {}),
    };
    return prisma.message.findMany({ where, orderBy: { createdAt: "asc" }, take });
  },
  recentHistory(conversationId: string, take: number) {
    return prisma.message
      .findMany({ where: { conversationId }, orderBy: { createdAt: "desc" }, take })
      .then((rows) => rows.reverse());
  },
};
```

- [ ] **Step 4: Typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/modules/messaging/messaging.schema.ts src/modules/messaging/conversation.repository.ts src/modules/messaging/message.repository.ts
git commit -m "feat(messaging): schema + conversation/message repositories"
```

---

## Task 8: AIProvider interface + mock

**Files:**
- Create: `src/modules/messaging/ai/ai-provider.ts`
- Create: `src/modules/messaging/ai/mock-ai-provider.ts`

- [ ] **Step 1: Interface + types**

`src/modules/messaging/ai/ai-provider.ts`:

```ts
/** Minimal conversation turn passed to the AI. */
export interface AiTurnMessage {
  senderKind: "GUEST" | "AI" | "STAFF";
  body: string;
}

/** A booking action the AI decided to take this turn (executed via real services). */
export type AiAction =
  | { type: "create_reservation"; guestId: string; roomTypeId: string; checkInDate: string; checkOutDate: string }
  | { type: "create_appointment"; guestId: string; treatmentId: string; therapistId: string; resourceId: string; startTime: string };

export interface AiResponse {
  reply: string;
  actions: AiAction[];
}

export interface AiGuestContext {
  guestId: string;
  propertyId: string;
  firstName: string;
}

export interface AIProvider {
  respond(history: AiTurnMessage[], guest: AiGuestContext): Promise<AiResponse>;
}
```

- [ ] **Step 2: Deterministic mock**

`src/modules/messaging/ai/mock-ai-provider.ts`:

```ts
import type { AIProvider, AiResponse, AiTurnMessage, AiGuestContext } from "@/modules/messaging/ai/ai-provider";

/**
 * Deterministic provider for tests/demos. Behaviour is driven by the latest guest
 * message text so the agent loop is exercisable with no network:
 *  - contains "book a room" → emits a create_reservation action (scripted ids via env-free defaults injected by caller in tests)
 *  - otherwise → a canned greeting/echo reply, no actions.
 */
export class MockAIProvider implements AIProvider {
  constructor(private readonly scripted?: Partial<AiResponse>) {}

  async respond(history: AiTurnMessage[], guest: AiGuestContext): Promise<AiResponse> {
    if (this.scripted) return { reply: "OK", actions: [], ...this.scripted };
    const last = [...history].reverse().find((m) => m.senderKind === "GUEST")?.body ?? "";
    if (/book.*room/i.test(last)) {
      return { reply: `Sure ${guest.firstName}, I'll arrange that.`, actions: [] };
    }
    return { reply: `Hello ${guest.firstName}, how can I help with your stay?`, actions: [] };
  }
}
```

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/modules/messaging/ai/ai-provider.ts src/modules/messaging/ai/mock-ai-provider.ts
git commit -m "feat(messaging): AIProvider interface + deterministic mock"
```

---

## Task 9: AI agent loop (TDD with mock)

**Files:**
- Create: `src/modules/messaging/ai/agent.ts`
- Test: `tests/modules/messaging-agent.test.ts`

- [ ] **Step 1: Write failing test (pure executor)**

The agent exposes a pure `executeAiTurn` that takes the provider + a set of injected callbacks (so it is testable with no DB). `tests/modules/messaging-agent.test.ts`:

```ts
import { describe, it, expect, vi } from "vitest";
import { executeAiTurn } from "@/modules/messaging/ai/agent";
import { MockAIProvider } from "@/modules/messaging/ai/mock-ai-provider";

const guest = { guestId: "g1", propertyId: "p1", firstName: "Sam" };

describe("executeAiTurn", () => {
  it("persists the AI reply and runs no action for a plain message", async () => {
    const saveMessage = vi.fn().mockResolvedValue({ id: "m1" });
    const runAction = vi.fn();
    const res = await executeAiTurn({
      provider: new MockAIProvider(),
      history: [{ senderKind: "GUEST", body: "hi" }],
      guest, saveMessage, runAction,
    });
    expect(saveMessage).toHaveBeenCalledOnce();
    expect(runAction).not.toHaveBeenCalled();
    expect(res.reply).toContain("Sam");
  });

  it("executes a scripted action and links it to the AI message", async () => {
    const saveMessage = vi.fn().mockResolvedValue({ id: "m1" });
    const runAction = vi.fn().mockResolvedValue({ actionType: "Reservation", actionId: "r1" });
    const provider = new MockAIProvider({
      reply: "Booked!",
      actions: [{ type: "create_reservation", guestId: "g1", roomTypeId: "rt1", checkInDate: "2026-07-01", checkOutDate: "2026-07-03" }],
    });
    await executeAiTurn({ provider, history: [], guest, saveMessage, runAction });
    expect(runAction).toHaveBeenCalledOnce();
    expect(saveMessage).toHaveBeenCalledWith(expect.objectContaining({ actionType: "Reservation", actionId: "r1" }));
  });

  it("turns an action failure into a graceful message, not a throw", async () => {
    const saveMessage = vi.fn().mockResolvedValue({ id: "m1" });
    const runAction = vi.fn().mockRejectedValue(new Error("conflict"));
    const provider = new MockAIProvider({
      reply: "Booked!",
      actions: [{ type: "create_reservation", guestId: "g1", roomTypeId: "rt1", checkInDate: "2026-07-01", checkOutDate: "2026-07-03" }],
    });
    const res = await executeAiTurn({ provider, history: [], guest, saveMessage, runAction });
    expect(res.reply).toMatch(/couldn.t/i);
    expect(saveMessage).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run to verify fail**

Run: `npm test -- messaging-agent`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `agent.ts`**

```ts
import type { AIProvider, AiAction, AiTurnMessage, AiGuestContext } from "@/modules/messaging/ai/ai-provider";

export interface ActionResult { actionType: string; actionId: string }

export interface ExecuteAiTurnDeps {
  provider: AIProvider;
  history: AiTurnMessage[];
  guest: AiGuestContext;
  /** Persist an AI message; returns the created row. */
  saveMessage: (input: { body: string; actionType?: string; actionId?: string }) => Promise<{ id: string }>;
  /** Execute one booking action via the real services as the AI principal. */
  runAction: (action: AiAction) => Promise<ActionResult>;
}

/**
 * One AI turn: ask the provider, persist its reply, then attempt each action it
 * chose. Action failures degrade to a graceful follow-up message — never an
 * exception — so a guest POST is never a 500 because the AI mis-stepped.
 */
export async function executeAiTurn(deps: ExecuteAiTurnDeps): Promise<{ reply: string }> {
  const response = await deps.provider.respond(deps.history, deps.guest);

  let actionType: string | undefined;
  let actionId: string | undefined;
  let failureNote: string | undefined;

  for (const action of response.actions) {
    try {
      const result = await deps.runAction(action);
      actionType = result.actionType;
      actionId = result.actionId;
    } catch {
      failureNote = "I couldn't complete that just now — a staff member will follow up.";
    }
  }

  const body = failureNote ? `${response.reply}\n\n${failureNote}` : response.reply;
  await deps.saveMessage({ body, actionType, actionId });
  return { reply: body };
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npm test -- messaging-agent`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/modules/messaging/ai/agent.ts tests/modules/messaging-agent.test.ts
git commit -m "feat(messaging): AI agent turn executor (graceful action failure) + tests"
```

---

## Task 10: Real AIProvider + action wiring (provider singleton)

**Files:**
- Create: `src/modules/messaging/ai/real-ai-provider.ts`
- Create: `src/modules/messaging/ai/index.ts` (provider selection, mirrors compliance gateway selection)

- [ ] **Step 1: Real provider (guarded; falls back to mock when unconfigured)**

`src/modules/messaging/ai/real-ai-provider.ts`:

```ts
import type { AIProvider, AiResponse, AiTurnMessage, AiGuestContext } from "@/modules/messaging/ai/ai-provider";

/**
 * Real LLM-backed provider. Intentionally minimal: builds a prompt from history,
 * calls the configured model, and maps tool-calls to AiAction[]. Left as a thin
 * shell so the channel runs on the mock until an API key is configured.
 */
export class RealAIProvider implements AIProvider {
  constructor(private readonly apiKey: string) {}
  async respond(_history: AiTurnMessage[], guest: AiGuestContext): Promise<AiResponse> {
    // TODO(real-llm): call model with tool schema; map tool calls → AiAction[].
    return { reply: `Hello ${guest.firstName}, how can I help?`, actions: [] };
  }
}
```

- [ ] **Step 2: Provider selector**

`src/modules/messaging/ai/index.ts`:

```ts
import type { AIProvider } from "@/modules/messaging/ai/ai-provider";
import { MockAIProvider } from "@/modules/messaging/ai/mock-ai-provider";
import { RealAIProvider } from "@/modules/messaging/ai/real-ai-provider";

/** Mirror the compliance-gateway pattern: real when configured, else mock. */
export function getAIProvider(): AIProvider {
  const key = process.env.AI_API_KEY;
  return key ? new RealAIProvider(key) : new MockAIProvider();
}

export type { AIProvider } from "@/modules/messaging/ai/ai-provider";
```

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/modules/messaging/ai/real-ai-provider.ts src/modules/messaging/ai/index.ts
git commit -m "feat(messaging): real AIProvider shell + mock/real selector"
```

---

## Task 11: Messaging service (send/list/takeover/release + AI wiring)

**Files:**
- Create: `src/modules/messaging/messaging.service.ts`

- [ ] **Step 1: Implement the service**

`src/modules/messaging/messaging.service.ts`:

```ts
import type { StaffAuthContext, GuestAuthContext } from "@/platform/auth/context";
import { requireCapability } from "@/platform/rbac";
import { recordAudit } from "@/platform/audit";
import { ForbiddenError, NotFoundError, ConflictError } from "@/platform/errors";
import { appointmentsService } from "@/modules/appointments/appointments.service";
import { reservationsService } from "@/modules/reservations/reservations.service";
import { conversationRepository } from "@/modules/messaging/conversation.repository";
import { messageRepository } from "@/modules/messaging/message.repository";
import { canStaffAccessConversation, assertGuestOwnsConversation } from "@/modules/messaging/access";
import { executeAiTurn } from "@/modules/messaging/ai/agent";
import { getAIProvider } from "@/modules/messaging/ai";
import type { AiAction } from "@/modules/messaging/ai/ai-provider";
import type { ListConversationsQuery, ListMessagesQuery } from "@/modules/messaging/messaging.schema";

const HISTORY_LIMIT = 20;

/** The seeded AI principal for a property (role AI_AGENT). */
async function aiActorFor(propertyId: string) {
  const { authRepository } = await import("@/modules/auth/auth.repository");
  // Find the AI_AGENT staff for this property. (auth.repository gains findAiAgent in this task.)
  const ai = await authRepository.findAiAgent(propertyId);
  if (!ai) throw new NotFoundError("AI agent principal not configured");
  return { kind: "staff" as const, staffId: ai.id, role: ai.role, propertyId };
}

async function runAiAction(propertyId: string, action: AiAction): Promise<{ actionType: string; actionId: string }> {
  const ctx = await aiActorFor(propertyId);
  if (action.type === "create_reservation") {
    const r = await reservationsService.create(ctx, {
      guestId: action.guestId, roomTypeId: action.roomTypeId,
      checkInDate: new Date(action.checkInDate), checkOutDate: new Date(action.checkOutDate),
      adults: 1, children: 0,
    });
    return { actionType: "Reservation", actionId: r.id };
  }
  const a = await appointmentsService.create(ctx, {
    guestId: action.guestId, treatmentId: action.treatmentId,
    therapistId: action.therapistId, resourceId: action.resourceId,
    startTime: new Date(action.startTime),
  });
  return { actionType: "TreatmentAppointment", actionId: a.id };
}

export const messagingService = {
  /** Guest's own conversation, created lazily on first access. */
  async getOrCreateForGuest(ctx: GuestAuthContext) {
    const existing = await conversationRepository.findByGuestId(ctx.guestId);
    return existing ?? conversationRepository.create({ propertyId: ctx.propertyId, guestId: ctx.guestId });
  },

  async listForStaff(ctx: StaffAuthContext, q: ListConversationsQuery) {
    requireCapability(ctx.role, "messaging:read");
    let guestIds: string[] | undefined;
    if (ctx.role === "THERAPIST") {
      // Therapists: restrict to guests they have/had an appointment with.
      const { appointmentsRepository } = await import("@/modules/appointments/appointments.repository");
      guestIds = await appointmentsRepository.guestIdsForTherapist(ctx.staffId); // added in this task
    }
    const { items, total } = await conversationRepository.list({
      propertyId: ctx.propertyId, skip: (q.page - 1) * q.pageSize, take: q.pageSize,
      handling: q.handling, status: q.status, guestIds,
    });
    return { items, total, page: q.page, pageSize: q.pageSize };
  },

  async getForStaff(ctx: StaffAuthContext, id: string) {
    requireCapability(ctx.role, "messaging:read");
    const conv = await conversationRepository.findById(id);
    if (!conv || conv.propertyId !== ctx.propertyId) throw new NotFoundError("Conversation not found");
    const hasGuest = ctx.role === "THERAPIST"
      ? await appointmentsService.hasAppointmentWithGuest(ctx.staffId, conv.guestId)
      : false;
    if (!canStaffAccessConversation(ctx.role, ctx.staffId, conv, hasGuest)) {
      throw new ForbiddenError("Not allowed to view this conversation");
    }
    return conv;
  },

  async listMessagesForStaff(ctx: StaffAuthContext, id: string, q: ListMessagesQuery) {
    await this.getForStaff(ctx, id);
    return messageRepository.listSince(id, q.since ? new Date(q.since) : undefined, q.limit);
  },

  async listMessagesForGuest(ctx: GuestAuthContext, q: ListMessagesQuery) {
    const conv = await this.getOrCreateForGuest(ctx);
    return messageRepository.listSince(conv.id, q.since ? new Date(q.since) : undefined, q.limit);
  },

  /** Guest sends a message → append, reopen if closed, run an AI turn when AI-handled. */
  async guestSend(ctx: GuestAuthContext, body: string) {
    let conv = await this.getOrCreateForGuest(ctx);
    if (conv.status === "CLOSED") {
      conv = await conversationRepository.update(conv.id, { status: "OPEN", handling: "AI" });
    }
    await messageRepository.create({ conversationId: conv.id, senderKind: "GUEST", body });
    await conversationRepository.update(conv.id, { lastMessageAt: new Date() });

    if (conv.handling === "AI") {
      const history = (await messageRepository.recentHistory(conv.id, HISTORY_LIMIT)).map((m) => ({
        senderKind: m.senderKind, body: m.body,
      }));
      await executeAiTurn({
        provider: getAIProvider(),
        history,
        guest: { guestId: conv.guestId, propertyId: conv.propertyId, firstName: conv.guest.firstName },
        saveMessage: async (input) => {
          const msg = await messageRepository.create({ conversationId: conv.id, senderKind: "AI", ...input });
          await conversationRepository.update(conv.id, { lastMessageAt: new Date() });
          if (input.actionType && input.actionId) {
            await recordAudit({
              actorStaffId: null, propertyId: conv.propertyId, action: "CREATE",
              entityType: "Message", entityId: msg.id,
              metadata: { ai: true, actionType: input.actionType, actionId: input.actionId },
            });
          }
          return msg;
        },
        runAction: (action) => runAiAction(conv.propertyId, action),
      });
    }
    return messageRepository.listSince(conv.id, undefined, 100);
  },

  async staffSend(ctx: StaffAuthContext, id: string, body: string) {
    requireCapability(ctx.role, "messaging:write");
    const conv = await this.getForStaff(ctx, id);
    if (conv.status === "CLOSED") throw new ConflictError("Conversation is closed; take over to reopen");
    const msg = await messageRepository.create({
      conversationId: id, senderKind: "STAFF", senderStaffId: ctx.staffId, body,
    });
    await conversationRepository.update(id, { lastMessageAt: new Date() });
    return msg;
  },

  async takeOver(ctx: StaffAuthContext, id: string) {
    requireCapability(ctx.role, "messaging:write");
    await this.getForStaff(ctx, id);
    const after = await conversationRepository.update(id, {
      handling: "HUMAN", status: "OPEN", assignedStaff: { connect: { id: ctx.staffId } },
    });
    await recordAudit({
      actorStaffId: ctx.staffId, propertyId: ctx.propertyId, action: "STATE_CHANGE",
      entityType: "Conversation", entityId: id, metadata: { to: "HUMAN" },
    });
    return after;
  },

  async release(ctx: StaffAuthContext, id: string) {
    requireCapability(ctx.role, "messaging:write");
    await this.getForStaff(ctx, id);
    const after = await conversationRepository.update(id, { handling: "AI", assignedStaff: { disconnect: true } });
    await recordAudit({
      actorStaffId: ctx.staffId, propertyId: ctx.propertyId, action: "STATE_CHANGE",
      entityType: "Conversation", entityId: id, metadata: { to: "AI" },
    });
    return after;
  },
};
```

- [ ] **Step 2: Add the two repository helpers referenced above**

In `src/modules/auth/auth.repository.ts` add:

```ts
  findAiAgent(propertyId: string) {
    return prisma.staff.findFirst({ where: { propertyId, role: "AI_AGENT", isActive: true } });
  },
```

In `src/modules/appointments/appointments.repository.ts` add:

```ts
  async guestIdsForTherapist(therapistId: string): Promise<string[]> {
    const rows = await prisma.treatmentAppointment.findMany({
      where: { therapistId }, select: { guestId: true }, distinct: ["guestId"],
    });
    return rows.map((r) => r.guestId);
  },
```

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/modules/messaging/messaging.service.ts src/modules/auth/auth.repository.ts src/modules/appointments/appointments.repository.ts
git commit -m "feat(messaging): service (send/list/takeover/release) + AI booking wiring"
```

---

## Task 12: Messaging routes

**Files:**
- Create: `app/api/conversations/route.ts`, `app/api/conversations/[id]/route.ts`, `app/api/conversations/[id]/messages/route.ts`, `app/api/conversations/[id]/take-over/route.ts`, `app/api/conversations/[id]/release/route.ts`
- Create: `app/api/conversations/me/route.ts`, `app/api/conversations/me/messages/route.ts`

- [ ] **Step 1: Staff list + detail + messages**

`app/api/conversations/route.ts`:

```ts
import { handle, ok } from "@/platform/http";
import { requireStaff } from "@/platform/auth/context";
import { listConversationsQuerySchema } from "@/modules/messaging/messaging.schema";
import { messagingService } from "@/modules/messaging/messaging.service";

export const GET = handle(async (req) => {
  const ctx = requireStaff(req);
  const q = listConversationsQuerySchema.parse(Object.fromEntries(new URL(req.url).searchParams));
  const r = await messagingService.listForStaff(ctx, q);
  return ok(r.items, { page: r.page, pageSize: r.pageSize, total: r.total });
});
```

`app/api/conversations/[id]/route.ts`:

```ts
import { handle, ok } from "@/platform/http";
import { requireStaff } from "@/platform/auth/context";
import { messagingService } from "@/modules/messaging/messaging.service";

type Params = { params: { id: string } };
export const GET = handle(async (req, { params }: Params) => {
  const ctx = requireStaff(req);
  return ok(await messagingService.getForStaff(ctx, params.id));
});
```

`app/api/conversations/[id]/messages/route.ts`:

```ts
import { handle, ok, created, parseJson } from "@/platform/http";
import { requireStaff } from "@/platform/auth/context";
import { listMessagesQuerySchema, sendMessageSchema } from "@/modules/messaging/messaging.schema";
import { messagingService } from "@/modules/messaging/messaging.service";

type Params = { params: { id: string } };
export const GET = handle(async (req, { params }: Params) => {
  const ctx = requireStaff(req);
  const q = listMessagesQuerySchema.parse(Object.fromEntries(new URL(req.url).searchParams));
  return ok(await messagingService.listMessagesForStaff(ctx, params.id, q));
});
export const POST = handle(async (req, { params }: Params) => {
  const ctx = requireStaff(req);
  const input = sendMessageSchema.parse(await parseJson(req));
  return created(await messagingService.staffSend(ctx, params.id, input.body));
});
```

- [ ] **Step 2: Take-over / release**

`app/api/conversations/[id]/take-over/route.ts`:

```ts
import { handle, ok } from "@/platform/http";
import { requireStaff } from "@/platform/auth/context";
import { messagingService } from "@/modules/messaging/messaging.service";

type Params = { params: { id: string } };
export const POST = handle(async (req, { params }: Params) => {
  const ctx = requireStaff(req);
  return ok(await messagingService.takeOver(ctx, params.id));
});
```

`app/api/conversations/[id]/release/route.ts` — identical with `messagingService.release`.

- [ ] **Step 3: Guest self routes**

`app/api/conversations/me/route.ts`:

```ts
import { handle, ok } from "@/platform/http";
import { requireGuest } from "@/platform/auth/context";
import { messagingService } from "@/modules/messaging/messaging.service";

export const GET = handle(async (req) => {
  const ctx = requireGuest(req);
  return ok(await messagingService.getOrCreateForGuest(ctx));
});
```

`app/api/conversations/me/messages/route.ts`:

```ts
import { handle, ok, parseJson } from "@/platform/http";
import { requireGuest } from "@/platform/auth/context";
import { listMessagesQuerySchema, sendMessageSchema } from "@/modules/messaging/messaging.schema";
import { messagingService } from "@/modules/messaging/messaging.service";

export const GET = handle(async (req) => {
  const ctx = requireGuest(req);
  const q = listMessagesQuerySchema.parse(Object.fromEntries(new URL(req.url).searchParams));
  return ok(await messagingService.listMessagesForGuest(ctx, q));
});
export const POST = handle(async (req) => {
  const ctx = requireGuest(req);
  const input = sendMessageSchema.parse(await parseJson(req));
  return ok(await messagingService.guestSend(ctx, input.body));
});
```

- [ ] **Step 4: Typecheck + build**

Run: `npm run typecheck && npm run build`
Expected: all routes compile.

- [ ] **Step 5: Commit**

```bash
git add app/api/conversations
git commit -m "feat(messaging): staff + guest conversation/message routes"
```

---

## Task 13: Seed — AI agent, demo guest account & conversation

**Files:**
- Modify: `prisma/seed.ts`

- [ ] **Step 1: Seed an AI_AGENT staff per property**

In `prisma/seed.ts`, in the staff-creation section, add an `AI_AGENT` staff for the seeded property (inactive password, `isActive: true`):

```ts
{ email: "ai@hotel.test", role: "AI_AGENT", firstName: "Aria", lastName: "AI" },
```

(Reuse the same hashed demo password so the row is valid; the AI never logs in via password.)

- [ ] **Step 2: Seed a GuestAccount + conversation for the demo checked-in guest**

After guests are created, add:

```ts
const demoGuest = guests[0]!;
await prisma.guestAccount.create({
  data: {
    guestId: demoGuest.id,
    email: demoGuest.email ?? "guest@demo.test",
    passwordHash: await hashPassword("Passw0rd!"),
    activatedAt: new Date(),
  },
});
const convo = await prisma.conversation.create({
  data: { propertyId: property.id, guestId: demoGuest.id, handling: "AI" },
});
await prisma.message.create({
  data: { conversationId: convo.id, senderKind: "GUEST", body: "Hi, what time does the spa open?" },
});
await prisma.message.create({
  data: { conversationId: convo.id, senderKind: "AI", body: "Good day! Our spa is open 08:00–20:00 daily." },
});
```

Add `treatmentRecord`/messaging deletions to the `clear()` function in FK-safe order: delete `message`, `conversation`, `guestAccount` before `guest`.

- [ ] **Step 3: Re-run seed**

Run: `npm run seed`
Expected: "Seed complete" with no FK errors.

- [ ] **Step 4: Commit**

```bash
git add prisma/seed.ts
git commit -m "feat(seed): AI_AGENT principal + demo guest account & conversation"
```

---

## Task 14: Staff "Messages" web screen (replaces WhatsApp stub)

**Files:**
- Delete: `app/(app)/whatsapp/page.tsx`
- Create: `app/(app)/messages/page.tsx`
- Modify: `src/web/nav.ts`
- Modify: `src/web/types.ts`

- [ ] **Step 1: Update nav**

In `src/web/nav.ts`, replace the WhatsApp stub item with a real item:

```ts
{ label: "Messages", href: "/messages", icon: "forum", capability: "messaging:read" },
```

Remove the old `whatsapp` entry and its `stub: true`.

- [ ] **Step 2: Add view types**

In `src/web/types.ts` add:

```ts
export interface ConversationDto {
  id: string;
  guestId: string;
  guest?: { firstName: string; lastName: string };
  handling: "AI" | "HUMAN";
  status: "OPEN" | "CLOSED";
  assignedStaffId: string | null;
  lastMessageAt: string;
}
export interface MessageDto {
  id: string;
  senderKind: "GUEST" | "AI" | "STAFF";
  senderStaffId: string | null;
  body: string;
  actionType: string | null;
  actionId: string | null;
  createdAt: string;
}
```

- [ ] **Step 3: Build the Messages screen**

`app/(app)/messages/page.tsx` — client component: left thread list (from `GET /api/conversations`) with AI Handled / Needs Staff badge; right pane shows messages (`GET /api/conversations/:id/messages`, polled every 4s with `since` cursor), Take over / Release button (`POST .../take-over` | `/release`), and a composer enabled only when `handling === "HUMAN"` (`POST /api/conversations/:id/messages`). Use existing `api`, `useApi`, `Card`, `StatusPill`, `Icon`, `DataState`, `fullName`, `formatTime`. AI messages with `actionType` render an `actionRef` chip (e.g. "AI booked Reservation").

Full component:

```tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { api } from "@/web/api-client";
import { useApi } from "@/web/use-api";
import type { ConversationDto, MessageDto } from "@/web/types";
import { PageHeader, Card, StatusPill, Icon, DataState } from "@/web/components/ui";
import { fullName, formatTime } from "@/web/format";

export default function MessagesPage() {
  const convos = useApi<ConversationDto[]>(() => api.get<ConversationDto[]>("/api/conversations", { pageSize: 100 }), []);
  const [activeId, setActiveId] = useState<string | null>(null);
  const list = convos.data ?? [];
  const active = list.find((c) => c.id === activeId) ?? null;

  return (
    <div>
      <PageHeader title="Messages" subtitle="Guest conversations. The AI receptionist replies by default; take over to step in." />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="p-0 lg:col-span-1">
          <DataState loading={convos.loading} error={convos.error} empty={list.length === 0} emptyLabel="No conversations yet.">
            <ul className="max-h-[72vh] overflow-y-auto">
              {list.map((c) => (
                <li key={c.id}>
                  <button onClick={() => setActiveId(c.id)}
                    className={`flex w-full items-center justify-between border-b border-outline-variant/30 px-4 py-3 text-left hover:bg-[#f4f8f7] ${activeId === c.id ? "bg-[#f4f8f7]" : ""}`}>
                    <span className="font-medium text-on-surface">{fullName(c.guest?.firstName, c.guest?.lastName)}</span>
                    <StatusPill tone={c.handling === "AI" ? "primary" : "warning"}>
                      {c.handling === "AI" ? "AI Handled" : "Needs Staff"}
                    </StatusPill>
                  </button>
                </li>
              ))}
            </ul>
          </DataState>
        </Card>
        <div className="lg:col-span-2">
          {active ? <Thread conv={active} onChanged={convos.reload} /> : <Card>Select a conversation.</Card>}
        </div>
      </div>
    </div>
  );
}

function Thread({ conv, onChanged }: { conv: ConversationDto; onChanged: () => void }) {
  const [messages, setMessages] = useState<MessageDto[]>([]);
  const [body, setBody] = useState("");
  const sinceRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    setMessages([]);
    sinceRef.current = undefined;
    let active = true;
    async function poll() {
      const { data } = await api.get<MessageDto[]>(`/api/conversations/${conv.id}/messages`, { since: sinceRef.current });
      if (!active || data.length === 0) return;
      sinceRef.current = data[data.length - 1]!.createdAt;
      setMessages((prev) => [...prev, ...data]);
    }
    poll();
    const t = setInterval(poll, 4000);
    return () => { active = false; clearInterval(t); };
  }, [conv.id]);

  async function send() {
    if (!body.trim()) return;
    await api.post(`/api/conversations/${conv.id}/messages`, { body });
    setBody("");
  }
  async function toggleHandling() {
    await api.post(`/api/conversations/${conv.id}/${conv.handling === "AI" ? "take-over" : "release"}`);
    onChanged();
  }

  return (
    <Card className="flex h-[72vh] flex-col p-0">
      <div className="flex items-center justify-between border-b border-outline-variant/50 px-5 py-3">
        <span className="font-semibold text-on-surface">{fullName(conv.guest?.firstName, conv.guest?.lastName)}</span>
        <button className="btn-secondary" onClick={toggleHandling}>
          <Icon name={conv.handling === "AI" ? "back_hand" : "smart_toy"} className="text-[18px]" />
          {conv.handling === "AI" ? "Take over" : "Release to AI"}
        </button>
      </div>
      <div className="flex-1 space-y-3 overflow-y-auto px-5 py-4">
        {messages.map((m) => (
          <div key={m.id} className={`flex ${m.senderKind === "GUEST" ? "justify-start" : "justify-end"}`}>
            <div className={`max-w-[75%] rounded-lg px-3 py-2 text-sm ${
              m.senderKind === "GUEST" ? "bg-surface-container text-on-surface"
                : m.senderKind === "AI" ? "bg-primary/10 text-on-surface" : "bg-primary text-on-primary"}`}>
              <p className="mb-0.5 text-[10px] font-semibold uppercase opacity-70">{m.senderKind}</p>
              <p className="whitespace-pre-wrap">{m.body}</p>
              {m.actionType && (
                <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-success/15 px-2 py-0.5 text-[11px] font-semibold text-success">
                  <Icon name="bolt" className="text-[12px]" /> AI booked {m.actionType}
                </span>
              )}
              <p className="mt-1 text-[10px] opacity-60">{formatTime(m.createdAt)}</p>
            </div>
          </div>
        ))}
      </div>
      <div className="flex items-center gap-2 border-t border-outline-variant/50 p-3">
        <input className="input flex-1" placeholder={conv.handling === "HUMAN" ? "Type a reply…" : "Take over to reply"}
          disabled={conv.handling !== "HUMAN"} value={body} onChange={(e) => setBody(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send()} />
        <button className="btn-primary" disabled={conv.handling !== "HUMAN"} onClick={send}>
          <Icon name="send" className="text-[18px]" />
        </button>
      </div>
    </Card>
  );
}
```

- [ ] **Step 4: Delete the WhatsApp stub**

Run: `git rm app/(app)/whatsapp/page.tsx`

- [ ] **Step 5: Typecheck + build**

Run: `npm run typecheck && npm run build`
Expected: `/messages` route present; `/whatsapp` gone.

- [ ] **Step 6: Commit**

```bash
git add app/(app)/messages src/web/nav.ts src/web/types.ts
git commit -m "feat(web): Messages screen with AI/human handover (replaces WhatsApp stub)"
```

---

## Task 15: Docs — api-reference, domain-model, ADR 0006

**Files:**
- Modify: `docs/api-reference.md`
- Modify: `docs/domain-model.md`
- Create: `docs/adr/0006-ai-agent-authority.md`

- [ ] **Step 1: api-reference — add a "Messaging (Phase 10)" section**

Add a table documenting: guest-auth endpoints, `GET /api/guest/me`, the staff conversation/message/take-over/release endpoints, and the guest `me` endpoints, with capabilities (`messaging:read`/`write`, guest-owned) and the polling `since` cursor note.

- [ ] **Step 2: domain-model — add entities**

Add `GuestAccount`, `Conversation`, `Message` to the Mermaid diagram and the entity table (Module: `src/modules/messaging` / `guest-auth`).

- [ ] **Step 3: ADR 0006**

`docs/adr/0006-ai-agent-authority.md`: record the decision that the AI receptionist acts autonomously within a least-privilege, fully-audited `AI_AGENT` capability zone (no proposal/approval gate), superseding the WhatsApp/proposal-only Phase 10 variant; rationale = audit-not-approval control + same-path-as-humans; consequences = constrained capabilities, every AI action audited, human takeover + reversal.

- [ ] **Step 4: Commit**

```bash
git add docs/api-reference.md docs/domain-model.md docs/adr/0006-ai-agent-authority.md
git commit -m "docs: messaging endpoints, domain entities, ADR 0006 (AI authority)"
```

---

## Task 16: Full verification

- [ ] **Step 1: Run the whole test suite**

Run: `npm test`
Expected: all green incl. `messaging-access` (4) and `messaging-agent` (3) and updated rbac.

- [ ] **Step 2: Typecheck + build**

Run: `npm run typecheck && npm run build`
Expected: clean; routes include `/api/conversations/**`, `/api/guest-auth/**`, `/messages`.

- [ ] **Step 3: Manual smoke (DB running, seeded)**

```bash
# guest login → send a message → AI auto-replies
GUEST=$(curl -s -X POST localhost:3000/api/guest-auth/login -H 'content-type: application/json' -d '{"email":"guest@demo.test","password":"Passw0rd!"}' | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>console.log(JSON.parse(s).data.accessToken))')
curl -s -X POST localhost:3000/api/conversations/me/messages -H "authorization: Bearer $GUEST" -H 'content-type: application/json' -d '{"body":"hello"}'
# staff sees it, takes over, replies
MGR=$(curl -s -X POST localhost:3000/api/auth/login -H 'content-type: application/json' -d '{"email":"manager@hotel.test","password":"Passw0rd!"}' | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>console.log(JSON.parse(s).data.accessToken))')
curl -s localhost:3000/api/conversations -H "authorization: Bearer $MGR"
```
Expected: guest send returns messages incl. an `AI` reply; staff list shows the conversation as `AI` handled.

- [ ] **Step 4: Final commit (if any docs/tweaks)**

```bash
git add -A && git commit -m "chore: messaging channel verification fixes"
```

---

## Self-review notes (author)

- **Spec coverage:** principals/auth (T3–T5), data model (T1), RBAC incl. AI_AGENT zone (T2), message flow + AI turn (T8–T12), takeover (T11–T12), audit of AI (T11), staff web (T14), guest auth slice (T4–T5), docs/ADR (T15). Auto-reopen-on-guest-message implemented in T11 `guestSend`. ✅
- **Therapist scoping:** list uses `guestIdsForTherapist`; single-conversation access uses `hasAppointmentWithGuest` (already exists). ✅
- **No AI in authorization path bypass:** AI books via `reservationsService`/`appointmentsService` as a real `AI_AGENT` principal → RBAC + conflict-detection + audit apply. ✅
- **Naming consistency:** `executeAiTurn`, `getAIProvider`, `messagingService`, `conversationRepository`, `messageRepository`, `requireGuest`, `requireStaff` used consistently across tasks.
