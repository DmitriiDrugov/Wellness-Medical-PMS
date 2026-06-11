import type { AuthContext } from "@/platform/auth/context";
import { requireCapability } from "@/platform/rbac";
import { recordAudit } from "@/platform/audit";
import { eventBus } from "@/platform/events";
import { NotFoundError } from "@/platform/errors";
import { propertyRepository } from "@/modules/property/property.repository";
import type { UpdatePropertyInput, CreateAreaInput, UpdateAreaInput } from "@/modules/property/property.schema";

async function getPropertyOrThrow(id: string) {
  const property = await propertyRepository.get(id);
  if (!property) throw new NotFoundError("Property not found");
  return property;
}

export const propertyService = {
  /** Any authenticated staff may read the property profile (tax config, identity). */
  async get(ctx: AuthContext) {
    return getPropertyOrThrow(ctx.propertyId);
  },

  async update(ctx: AuthContext, input: UpdatePropertyInput) {
    requireCapability(ctx.role, "property:manage");
    const before = await getPropertyOrThrow(ctx.propertyId);
    const after = await propertyRepository.update(ctx.propertyId, input);
    await recordAudit({
      actorStaffId: ctx.staffId,
      propertyId: ctx.propertyId,
      action: "UPDATE",
      entityType: "Property",
      entityId: ctx.propertyId,
      before,
      after,
    });
    eventBus.emit({ type: "property.updated", entity: "property", entityId: ctx.propertyId, propertyId: ctx.propertyId });
    return after;
  },

  // ---- Areas ----

  /** Areas are non-sensitive map/task targets — readable by any authenticated staff. */
  async listAreas(ctx: AuthContext) {
    return propertyRepository.listAreas(ctx.propertyId);
  },

  async createArea(ctx: AuthContext, input: CreateAreaInput) {
    requireCapability(ctx.role, "property:manage");
    const area = await propertyRepository.createArea({ propertyId: ctx.propertyId, ...input });
    await recordAudit({
      actorStaffId: ctx.staffId,
      propertyId: ctx.propertyId,
      action: "CREATE",
      entityType: "PropertyArea",
      entityId: area.id,
      after: area,
    });
    eventBus.emit({ type: "area.created", entity: "area", entityId: area.id, propertyId: ctx.propertyId });
    return area;
  },

  async updateArea(ctx: AuthContext, id: string, input: UpdateAreaInput) {
    requireCapability(ctx.role, "property:manage");
    const before = await propertyRepository.findAreaById(id);
    if (!before || before.propertyId !== ctx.propertyId) throw new NotFoundError("Area not found");
    const after = await propertyRepository.updateArea(id, input);
    await recordAudit({
      actorStaffId: ctx.staffId,
      propertyId: ctx.propertyId,
      action: "UPDATE",
      entityType: "PropertyArea",
      entityId: id,
      before,
      after,
    });
    eventBus.emit({ type: "area.updated", entity: "area", entityId: id, propertyId: ctx.propertyId });
    return after;
  },

  async deleteArea(ctx: AuthContext, id: string): Promise<void> {
    requireCapability(ctx.role, "property:manage");
    const before = await propertyRepository.findAreaById(id);
    if (!before || before.propertyId !== ctx.propertyId) throw new NotFoundError("Area not found");
    await propertyRepository.deleteArea(id);
    await recordAudit({
      actorStaffId: ctx.staffId,
      propertyId: ctx.propertyId,
      action: "DELETE",
      entityType: "PropertyArea",
      entityId: id,
      before,
    });
    eventBus.emit({ type: "area.deleted", entity: "area", entityId: id, propertyId: ctx.propertyId });
  },
};
