import type { Prisma, TreatmentRecord } from "@prisma/client";
import type { AuthContext } from "@/platform/auth/context";
import { requireCapability } from "@/platform/rbac";
import { recordAudit } from "@/platform/audit";
import { ConflictError, NotFoundError } from "@/platform/errors";
import { appointmentsService } from "@/modules/appointments/appointments.service";
import { consentService } from "@/modules/clinical/consent.service";
import { recordsRepository } from "@/modules/clinical/records.repository";
import { isRecordEditable, REQUIRED_RECORD_CONSENTS } from "@/modules/clinical/access";
import { assertGuestClinicalScope, assertRecordScope, auditClinicalRead } from "@/modules/clinical/guards";
import type { CreateRecordInput, UpdateRecordInput, AddendumInput, ListRecordsQuery } from "@/modules/clinical/clinical.schema";

const asJson = (v: unknown): Prisma.InputJsonValue | undefined =>
  v === undefined ? undefined : (v as Prisma.InputJsonValue);

async function loadOrThrow(id: string, propertyId: string): Promise<TreatmentRecord> {
  const record = await recordsRepository.findById(id);
  if (!record || record.propertyId !== propertyId) throw new NotFoundError("Treatment record not found");
  return record;
}

function soapData(input: CreateRecordInput | UpdateRecordInput | AddendumInput) {
  return {
    subjective: input.subjective,
    objective: input.objective,
    assessment: input.assessment,
    plan: input.plan,
    productsUsed: asJson(input.productsUsed),
    photoRefs: asJson(input.photoRefs),
  };
}

export const recordsService = {
  /**
   * Create a DRAFT clinical record. Enforces the consent gate (TREATMENT +
   * GDPR_DATA_PROCESSING) and (via appointmentsService.get) therapist ownership of
   * the appointment. The provider is the appointment's therapist.
   */
  async create(ctx: AuthContext, input: CreateRecordInput, opts?: { aiGenerated?: boolean }): Promise<TreatmentRecord> {
    requireCapability(ctx.role, "clinical:write");
    const appointment = await appointmentsService.get(ctx, input.treatmentAppointmentId);

    const missing = await consentService.getMissingRequiredConsents(appointment.guestId, REQUIRED_RECORD_CONSENTS);
    if (missing.length > 0) {
      throw new ConflictError("Required consent(s) not granted for this guest", { missingConsents: missing });
    }

    const record = await recordsRepository.create({
      propertyId: ctx.propertyId,
      treatmentAppointmentId: appointment.id,
      guestId: appointment.guestId,
      providerId: appointment.therapistId,
      ...soapData(input),
      status: "DRAFT",
      aiGenerated: opts?.aiGenerated ?? false,
    });
    await recordAudit({
      actorStaffId: ctx.staffId,
      propertyId: ctx.propertyId,
      action: "CREATE",
      entityType: "TreatmentRecord",
      entityId: record.id,
      after: { status: record.status, aiGenerated: record.aiGenerated, guestId: record.guestId },
      metadata: { aiGenerated: record.aiGenerated },
    });
    return record;
  },

  async get(ctx: AuthContext, id: string): Promise<TreatmentRecord> {
    requireCapability(ctx.role, "clinical:read");
    const record = await loadOrThrow(id, ctx.propertyId);
    await assertRecordScope(ctx, record);
    await auditClinicalRead(ctx, "TreatmentRecord", id);
    return record;
  },

  async list(ctx: AuthContext, query: ListRecordsQuery): Promise<TreatmentRecord[]> {
    requireCapability(ctx.role, "clinical:read");
    if (query.guestId) await assertGuestClinicalScope(ctx, query.guestId);
    const records = await recordsRepository.list({
      propertyId: ctx.propertyId,
      guestId: query.guestId,
      appointmentId: query.appointmentId,
    });

    let visible = records;
    if (ctx.role === "THERAPIST" && !query.guestId) {
      // Without a guest filter, restrict to records the therapist authored or whose
      // guest they have an appointment with (cached per guest to avoid N queries).
      const cache = new Map<string, boolean>();
      const allowed: TreatmentRecord[] = [];
      for (const r of records) {
        if (r.providerId === ctx.staffId) {
          allowed.push(r);
          continue;
        }
        let has = cache.get(r.guestId);
        if (has === undefined) {
          has = await appointmentsService.hasAppointmentWithGuest(ctx.staffId, r.guestId);
          cache.set(r.guestId, has);
        }
        if (has) allowed.push(r);
      }
      visible = allowed;
    }
    await auditClinicalRead(ctx, "TreatmentRecord", query.guestId ?? "list", { count: visible.length });
    return visible;
  },

  async update(ctx: AuthContext, id: string, input: UpdateRecordInput): Promise<TreatmentRecord> {
    requireCapability(ctx.role, "clinical:write");
    const before = await loadOrThrow(id, ctx.propertyId);
    await assertRecordScope(ctx, before);
    if (!isRecordEditable(before.status)) {
      throw new ConflictError("A signed record is immutable; create an addendum instead");
    }
    const after = await recordsRepository.update(id, soapData(input));
    await recordAudit({
      actorStaffId: ctx.staffId,
      propertyId: ctx.propertyId,
      action: "UPDATE",
      entityType: "TreatmentRecord",
      entityId: id,
      metadata: { draftEdit: true },
    });
    return after;
  },

  /** Human sign — the ONLY action that locks a record. Always its own audit entry. */
  async sign(ctx: AuthContext, id: string): Promise<TreatmentRecord> {
    requireCapability(ctx.role, "clinical:write");
    const before = await loadOrThrow(id, ctx.propertyId);
    await assertRecordScope(ctx, before);
    if (before.status !== "DRAFT") throw new ConflictError(`Cannot sign a record with status ${before.status}`);
    const after = await recordsRepository.update(id, {
      status: "SIGNED",
      signedBy: { connect: { id: ctx.staffId } },
      signedAt: new Date(),
    });
    await recordAudit({
      actorStaffId: ctx.staffId,
      propertyId: ctx.propertyId,
      action: "STATE_CHANGE",
      entityType: "TreatmentRecord",
      entityId: id,
      before: { status: "DRAFT" },
      after: { status: "SIGNED", signedById: ctx.staffId },
      metadata: { humanSignature: true },
    });
    return after;
  },

  /** Correct a signed record via a new DRAFT addendum; the original is never mutated. */
  async addendum(ctx: AuthContext, id: string, input: AddendumInput): Promise<TreatmentRecord> {
    requireCapability(ctx.role, "clinical:write");
    const original = await loadOrThrow(id, ctx.propertyId);
    await assertRecordScope(ctx, original);
    if (original.status !== "SIGNED") {
      throw new ConflictError("Addenda may only be created for signed records");
    }
    const addendum = await recordsRepository.create({
      propertyId: ctx.propertyId,
      treatmentAppointmentId: original.treatmentAppointmentId,
      guestId: original.guestId,
      providerId: original.providerId,
      ...soapData(input),
      status: "DRAFT",
      supersededById: original.id,
    });
    await recordAudit({
      actorStaffId: ctx.staffId,
      propertyId: ctx.propertyId,
      action: "CREATE",
      entityType: "TreatmentRecord",
      entityId: addendum.id,
      after: { status: addendum.status, supersedes: original.id },
      metadata: { addendumOf: original.id },
    });
    return addendum;
  },
};
