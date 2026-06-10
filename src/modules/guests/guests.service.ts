import type { Guest } from "@prisma/client";
import type { AuthContext } from "@/platform/auth/context";
import { requireCapability } from "@/platform/rbac";
import { recordAudit } from "@/platform/audit";
import { eventBus } from "@/platform/events";
import { NotFoundError } from "@/platform/errors";
import { guestsRepository } from "@/modules/guests/guests.repository";
import type {
  CreateGuestInput,
  UpdateGuestInput,
  ListGuestsQuery,
  UpsertMedicalProfileInput,
  AddDocumentInput,
} from "@/modules/guests/guests.schema";

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

  /**
   * Cross-module interface (no RBAC): assert a guest exists and is not soft-deleted.
   * Used by booking flows (reservations/appointments) that need to validate the guest
   * without granting the actor `guest:read` — notably the least-privilege AI_AGENT,
   * which may book (ADR 0006) but must not be able to read the guest directory.
   */
  async requireExists(id: string): Promise<Guest> {
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
    eventBus.emit({ type: "guest.created", entity: "guest", entityId: guest.id, propertyId: ctx.propertyId });
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
    eventBus.emit({ type: "guest.updated", entity: "guest", entityId: id, propertyId: ctx.propertyId });
    return after;
  },

  // ---- Medical profile (clinical data: clinical:* gated, access is audited) ----

  async getMedicalProfile(ctx: AuthContext, guestId: string) {
    requireCapability(ctx.role, "clinical:read");
    await getOrThrow(guestId); // ensure the guest exists / not erased
    const profile = await guestsRepository.findMedicalProfile(guestId);
    // Reading clinical data is logged (AuditAction.READ), like the rest of Phase 6.
    await recordAudit({
      actorStaffId: ctx.staffId,
      propertyId: ctx.propertyId,
      action: "READ",
      entityType: "MedicalProfile",
      entityId: profile?.id ?? guestId,
      metadata: { guestId },
    });
    return profile;
  },

  async upsertMedicalProfile(ctx: AuthContext, guestId: string, input: UpsertMedicalProfileInput) {
    requireCapability(ctx.role, "clinical:write");
    await getOrThrow(guestId);
    const before = await guestsRepository.findMedicalProfile(guestId);
    const after = await guestsRepository.upsertMedicalProfile(guestId, {
      ...input,
      updatedByStaffId: ctx.staffId,
    });
    await recordAudit({
      actorStaffId: ctx.staffId,
      propertyId: ctx.propertyId,
      action: before ? "UPDATE" : "CREATE",
      entityType: "MedicalProfile",
      entityId: after.id,
      before,
      after,
      metadata: { guestId },
    });
    eventBus.emit({ type: "guest.medical-updated", entity: "guest", entityId: guestId, propertyId: ctx.propertyId });
    return after;
  },

  // ---- Documents (reference only — guest:* gated) ----

  async listDocuments(ctx: AuthContext, guestId: string) {
    requireCapability(ctx.role, "guest:read");
    await getOrThrow(guestId);
    return guestsRepository.listDocuments(guestId);
  },

  async addDocument(ctx: AuthContext, guestId: string, input: AddDocumentInput) {
    requireCapability(ctx.role, "guest:write");
    await getOrThrow(guestId);
    const doc = await guestsRepository.addDocument({ guestId, ...input, uploadedByStaffId: ctx.staffId });
    await recordAudit({
      actorStaffId: ctx.staffId,
      propertyId: ctx.propertyId,
      action: "CREATE",
      entityType: "GuestDocument",
      entityId: doc.id,
      after: doc,
      metadata: { guestId },
    });
    eventBus.emit({ type: "guest.document-added", entity: "guest", entityId: guestId, propertyId: ctx.propertyId });
    return doc;
  },

  async removeDocument(ctx: AuthContext, guestId: string, documentId: string): Promise<void> {
    requireCapability(ctx.role, "guest:write");
    const doc = await guestsRepository.findDocument(documentId);
    if (!doc || doc.guestId !== guestId) throw new NotFoundError("Document not found");
    await guestsRepository.deleteDocument(documentId);
    await recordAudit({
      actorStaffId: ctx.staffId,
      propertyId: ctx.propertyId,
      action: "DELETE",
      entityType: "GuestDocument",
      entityId: documentId,
      before: doc,
      metadata: { guestId },
    });
    eventBus.emit({ type: "guest.document-removed", entity: "guest", entityId: guestId, propertyId: ctx.propertyId });
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
