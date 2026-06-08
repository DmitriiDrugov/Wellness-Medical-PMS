import type { Guest } from "@prisma/client";
import type { AuthContext } from "@/platform/auth/context";
import { requireCapability } from "@/platform/rbac";
import { recordAudit } from "@/platform/audit";
import { NotFoundError } from "@/platform/errors";
import { guestsRepository } from "@/modules/guests/guests.repository";
import type { CreateGuestInput, UpdateGuestInput, ListGuestsQuery } from "@/modules/guests/guests.schema";

async function getOrThrow(id: string): Promise<Guest> {
  const guest = await guestsRepository.findById(id);
  if (!guest) throw new NotFoundError("Guest not found");
  return guest;
}

export const guestsService = {
  async list(ctx: AuthContext, query: ListGuestsQuery) {
    requireCapability(ctx.role, "guest:read");
    const { items, total } = await guestsRepository.list({
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
      search: query.search,
    });
    return { items, total, page: query.page, pageSize: query.pageSize };
  },

  async get(ctx: AuthContext, id: string): Promise<Guest> {
    requireCapability(ctx.role, "guest:read");
    return getOrThrow(id);
  },

  async create(ctx: AuthContext, input: CreateGuestInput): Promise<Guest> {
    requireCapability(ctx.role, "guest:write");
    const consentGiven = input.gdprConsentDataProcessing || input.gdprConsentMarketing;
    const guest = await guestsRepository.create({
      ...input,
      gdprConsentAt: consentGiven ? new Date() : null,
    });
    await recordAudit({
      actorStaffId: ctx.staffId,
      propertyId: ctx.propertyId,
      action: "CREATE",
      entityType: "Guest",
      entityId: guest.id,
      after: guest,
    });
    return guest;
  },

  async update(ctx: AuthContext, id: string, input: UpdateGuestInput): Promise<Guest> {
    requireCapability(ctx.role, "guest:write");
    const before = await getOrThrow(id);
    // Stamp consent timestamp when consent transitions to granted.
    const nowGranting =
      (input.gdprConsentDataProcessing && !before.gdprConsentDataProcessing) ||
      (input.gdprConsentMarketing && !before.gdprConsentMarketing);
    const after = await guestsRepository.update(id, {
      ...input,
      ...(nowGranting ? { gdprConsentAt: new Date() } : {}),
    });
    await recordAudit({
      actorStaffId: ctx.staffId,
      propertyId: ctx.propertyId,
      action: "UPDATE",
      entityType: "Guest",
      entityId: id,
      before,
      after,
    });
    return after;
  },

  /** GDPR soft-delete (erasure request). The row is retained but excluded from reads. */
  async remove(ctx: AuthContext, id: string): Promise<void> {
    requireCapability(ctx.role, "guest:write");
    const before = await getOrThrow(id);
    await guestsRepository.softDelete(id);
    await recordAudit({
      actorStaffId: ctx.staffId,
      propertyId: ctx.propertyId,
      action: "DELETE",
      entityType: "Guest",
      entityId: id,
      before,
    });
  },
};
