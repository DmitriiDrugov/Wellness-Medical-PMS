import type { Prisma, FormTemplate, IntakeFormSubmission } from "@prisma/client";
import type { AuthContext } from "@/platform/auth/context";
import { requireCapability } from "@/platform/rbac";
import { recordAudit } from "@/platform/audit";
import { NotFoundError } from "@/platform/errors";
import { guestsService } from "@/modules/guests/guests.service";
import { formsRepository } from "@/modules/clinical/forms.repository";
import { assertGuestClinicalScope, auditClinicalRead } from "@/modules/clinical/guards";
import type {
  CreateFormTemplateInput,
  UpdateFormTemplateInput,
  CreateSubmissionInput,
  UpdateSubmissionInput,
  ListSubmissionsQuery,
} from "@/modules/clinical/clinical.schema";

const asJson = (v: unknown): Prisma.InputJsonValue => v as Prisma.InputJsonValue;

/** Submission metadata view — never includes the (clinical) answers. */
function toMetadata(s: IntakeFormSubmission) {
  return {
    id: s.id,
    guestId: s.guestId,
    templateId: s.templateId,
    templateVersion: s.templateVersion,
    status: s.status,
    submittedAt: s.submittedAt,
    createdAt: s.createdAt,
  };
}

export const formsService = {
  // ---- Form templates ----
  async listTemplates(ctx: AuthContext): Promise<FormTemplate[]> {
    requireCapability(ctx.role, "submission:write");
    return formsRepository.listTemplates(ctx.propertyId);
  },

  async getTemplate(ctx: AuthContext, id: string): Promise<FormTemplate> {
    requireCapability(ctx.role, "submission:write");
    const template = await formsRepository.findTemplateById(id);
    if (!template || template.propertyId !== ctx.propertyId) throw new NotFoundError("Form template not found");
    return template;
  },

  async createTemplate(ctx: AuthContext, input: CreateFormTemplateInput): Promise<FormTemplate> {
    requireCapability(ctx.role, "forms:manage");
    const template = await formsRepository.createTemplate({
      property: { connect: { id: ctx.propertyId } },
      name: input.name,
      type: input.type,
      schema: asJson(input.schema),
      active: input.active,
    });
    await recordAudit({
      actorStaffId: ctx.staffId,
      propertyId: ctx.propertyId,
      action: "CREATE",
      entityType: "FormTemplate",
      entityId: template.id,
      after: template,
    });
    return template;
  },

  async updateTemplate(ctx: AuthContext, id: string, input: UpdateFormTemplateInput): Promise<FormTemplate> {
    requireCapability(ctx.role, "forms:manage");
    const before = await this.getTemplate(ctx, id);
    const after = await formsRepository.updateTemplate(id, {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.type !== undefined ? { type: input.type } : {}),
      ...(input.schema !== undefined ? { schema: asJson(input.schema) } : {}),
      ...(input.active !== undefined ? { active: input.active } : {}),
      version: before.version + 1, // editing a template bumps its version
    });
    await recordAudit({
      actorStaffId: ctx.staffId,
      propertyId: ctx.propertyId,
      action: "UPDATE",
      entityType: "FormTemplate",
      entityId: id,
      before,
      after,
    });
    return after;
  },

  // ---- Submissions ----
  async createSubmission(ctx: AuthContext, input: CreateSubmissionInput): Promise<IntakeFormSubmission> {
    requireCapability(ctx.role, "submission:write");
    await guestsService.get(ctx, input.guestId); // validates guest exists/visible
    const template = await formsRepository.findTemplateById(input.templateId);
    if (!template || template.propertyId !== ctx.propertyId) throw new NotFoundError("Form template not found");
    const submission = await formsRepository.createSubmission({
      propertyId: ctx.propertyId,
      guestId: input.guestId,
      templateId: input.templateId,
      templateVersion: template.version,
      answers: asJson(input.answers),
      status: input.status,
      submittedAt: input.status === "COMPLETED" ? new Date() : null,
    });
    await recordAudit({
      actorStaffId: ctx.staffId,
      propertyId: ctx.propertyId,
      action: "CREATE",
      entityType: "IntakeFormSubmission",
      entityId: submission.id,
      after: toMetadata(submission),
    });
    return submission;
  },

  /** Metadata-only list (no answers) — available to form handlers. */
  async listSubmissions(ctx: AuthContext, query: ListSubmissionsQuery) {
    requireCapability(ctx.role, "submission:write");
    const items = await formsRepository.listSubmissions({
      propertyId: ctx.propertyId,
      guestId: query.guestId,
      status: query.status,
    });
    return items.map(toMetadata);
  },

  /** Full submission incl. answers — clinical content; therapist-scoped + audited. */
  async getSubmission(ctx: AuthContext, id: string): Promise<IntakeFormSubmission> {
    requireCapability(ctx.role, "clinical:read");
    const submission = await formsRepository.findSubmissionById(id);
    if (!submission || submission.propertyId !== ctx.propertyId) throw new NotFoundError("Submission not found");
    await assertGuestClinicalScope(ctx, submission.guestId);
    await auditClinicalRead(ctx, "IntakeFormSubmission", id);
    return submission;
  },

  async updateSubmission(ctx: AuthContext, id: string, input: UpdateSubmissionInput): Promise<IntakeFormSubmission> {
    requireCapability(ctx.role, "submission:write");
    const before = await formsRepository.findSubmissionById(id);
    if (!before || before.propertyId !== ctx.propertyId) throw new NotFoundError("Submission not found");
    const completing = input.status === "COMPLETED" && before.status !== "COMPLETED";
    const after = await formsRepository.updateSubmission(id, {
      ...(input.answers !== undefined ? { answers: asJson(input.answers) } : {}),
      ...(input.status !== undefined ? { status: input.status } : {}),
      ...(completing ? { submittedAt: new Date() } : {}),
    });
    await recordAudit({
      actorStaffId: ctx.staffId,
      propertyId: ctx.propertyId,
      action: "UPDATE",
      entityType: "IntakeFormSubmission",
      entityId: id,
      metadata: { statusChange: input.status },
    });
    return after;
  },
};
