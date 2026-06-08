import type { Resource } from "@prisma/client";
import type { AuthContext } from "@/platform/auth/context";
import { requireCapability } from "@/platform/rbac";
import { recordAudit } from "@/platform/audit";
import { NotFoundError, ValidationError } from "@/platform/errors";
import { resourcesRepository } from "@/modules/resources/resources.repository";
import type { CreateResourceInput, UpdateResourceInput } from "@/modules/resources/resources.schema";

export const resourcesService = {
  async list(ctx: AuthContext): Promise<Resource[]> {
    requireCapability(ctx.role, "catalog:read");
    return resourcesRepository.list(ctx.propertyId);
  },

  async get(ctx: AuthContext, id: string): Promise<Resource> {
    requireCapability(ctx.role, "catalog:read");
    const resource = await resourcesRepository.findById(id);
    if (!resource || resource.propertyId !== ctx.propertyId) throw new NotFoundError("Resource not found");
    return resource;
  },

  async create(ctx: AuthContext, input: CreateResourceInput): Promise<Resource> {
    requireCapability(ctx.role, "catalog:manage");
    const resource = await resourcesRepository.create({
      ...input,
      property: { connect: { id: ctx.propertyId } },
    });
    await recordAudit({
      actorStaffId: ctx.staffId,
      propertyId: ctx.propertyId,
      action: "CREATE",
      entityType: "Resource",
      entityId: resource.id,
      after: resource,
    });
    return resource;
  },

  async update(ctx: AuthContext, id: string, input: UpdateResourceInput): Promise<Resource> {
    requireCapability(ctx.role, "catalog:manage");
    const before = await this.get(ctx, id);
    const after = await resourcesRepository.update(id, input);
    await recordAudit({
      actorStaffId: ctx.staffId,
      propertyId: ctx.propertyId,
      action: "UPDATE",
      entityType: "Resource",
      entityId: id,
      before,
      after,
    });
    return after;
  },

  /**
   * Cross-module interface used by appointment scheduling: validate that a resource
   * exists, belongs to the property, and is active. Returns the resource (with type).
   */
  async requireActive(propertyId: string, id: string): Promise<Resource> {
    const resource = await resourcesRepository.findById(id);
    if (!resource || resource.propertyId !== propertyId) throw new NotFoundError("Resource not found");
    if (!resource.active) throw new ValidationError("Resource is inactive");
    return resource;
  },
};
