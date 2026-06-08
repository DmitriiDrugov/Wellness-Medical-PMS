import type { AuthContext } from "@/platform/auth/context";
import { requireCapability } from "@/platform/rbac";
import { recordAudit } from "@/platform/audit";
import { NotFoundError } from "@/platform/errors";
import { treatmentsService } from "@/modules/treatments/treatments.service";
import { packagesRepository } from "@/modules/packages/packages.repository";
import type { CreatePackageInput, UpdatePackageInput } from "@/modules/packages/packages.schema";

export const packagesService = {
  async list(ctx: AuthContext) {
    requireCapability(ctx.role, "catalog:read");
    return packagesRepository.list(ctx.propertyId);
  },

  async get(ctx: AuthContext, id: string) {
    requireCapability(ctx.role, "catalog:read");
    const pkg = await packagesRepository.findById(id);
    if (!pkg || pkg.propertyId !== ctx.propertyId) throw new NotFoundError("Package not found");
    return pkg;
  },

  async create(ctx: AuthContext, input: CreatePackageInput) {
    requireCapability(ctx.role, "catalog:manage");
    // Cross-module validation: every referenced treatment must exist in this property.
    await treatmentsService.assertAllInProperty(ctx.propertyId, input.items.map((i) => i.treatmentId));
    const pkg = await packagesRepository.create(ctx.propertyId, {
      name: input.name,
      description: input.description,
      priceMinor: input.priceMinor,
      active: input.active,
      items: input.items,
    });
    await recordAudit({
      actorStaffId: ctx.staffId,
      propertyId: ctx.propertyId,
      action: "CREATE",
      entityType: "ServicePackage",
      entityId: pkg.id,
      after: pkg,
    });
    return pkg;
  },

  async update(ctx: AuthContext, id: string, input: UpdatePackageInput) {
    requireCapability(ctx.role, "catalog:manage");
    const before = await this.get(ctx, id);
    const scalars = {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.priceMinor !== undefined ? { priceMinor: input.priceMinor } : {}),
      ...(input.active !== undefined ? { active: input.active } : {}),
    };
    let after;
    if (input.items) {
      await treatmentsService.assertAllInProperty(ctx.propertyId, input.items.map((i) => i.treatmentId));
      after = await packagesRepository.updateWithItems(id, scalars, input.items);
    } else {
      after = await packagesRepository.updateScalars(id, scalars);
    }
    await recordAudit({
      actorStaffId: ctx.staffId,
      propertyId: ctx.propertyId,
      action: "UPDATE",
      entityType: "ServicePackage",
      entityId: id,
      before,
      after,
    });
    return after;
  },
};
