import type { Treatment } from "@prisma/client";
import type { AuthContext } from "@/platform/auth/context";
import { requireCapability } from "@/platform/rbac";
import { recordAudit } from "@/platform/audit";
import { NotFoundError, ValidationError } from "@/platform/errors";
import { treatmentsRepository } from "@/modules/treatments/treatments.repository";
import type { CreateTreatmentInput, UpdateTreatmentInput } from "@/modules/treatments/treatments.schema";

export const treatmentsService = {
  async list(ctx: AuthContext): Promise<Treatment[]> {
    requireCapability(ctx.role, "catalog:read");
    return treatmentsRepository.list(ctx.propertyId);
  },

  async get(ctx: AuthContext, id: string): Promise<Treatment> {
    requireCapability(ctx.role, "catalog:read");
    const treatment = await treatmentsRepository.findById(id);
    if (!treatment || treatment.propertyId !== ctx.propertyId) throw new NotFoundError("Treatment not found");
    return treatment;
  },

  async create(ctx: AuthContext, input: CreateTreatmentInput): Promise<Treatment> {
    requireCapability(ctx.role, "catalog:manage");
    const treatment = await treatmentsRepository.create({
      ...input,
      property: { connect: { id: ctx.propertyId } },
    });
    await recordAudit({
      actorStaffId: ctx.staffId,
      propertyId: ctx.propertyId,
      action: "CREATE",
      entityType: "Treatment",
      entityId: treatment.id,
      after: treatment,
    });
    return treatment;
  },

  async update(ctx: AuthContext, id: string, input: UpdateTreatmentInput): Promise<Treatment> {
    requireCapability(ctx.role, "catalog:manage");
    const before = await this.get(ctx, id);
    const after = await treatmentsRepository.update(id, input);
    await recordAudit({
      actorStaffId: ctx.staffId,
      propertyId: ctx.propertyId,
      action: "UPDATE",
      entityType: "Treatment",
      entityId: id,
      before,
      after,
    });
    return after;
  },

  /** Cross-module interface: fetch an active treatment, validating property + state. */
  async requireActive(propertyId: string, id: string): Promise<Treatment> {
    const treatment = await treatmentsRepository.findById(id);
    if (!treatment || treatment.propertyId !== propertyId) throw new NotFoundError("Treatment not found");
    if (!treatment.active) throw new ValidationError("Treatment is inactive");
    return treatment;
  },

  /** Cross-module interface: validate a set of treatment ids belong to the property. */
  async assertAllInProperty(propertyId: string, ids: string[]): Promise<Treatment[]> {
    const found = await treatmentsRepository.findManyByIds(ids);
    if (found.length !== new Set(ids).size || found.some((t) => t.propertyId !== propertyId)) {
      throw new ValidationError("One or more treatments do not exist in this property");
    }
    return found;
  },
};
