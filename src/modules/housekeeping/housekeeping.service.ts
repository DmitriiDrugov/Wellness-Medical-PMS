import type { HousekeepingTask, HousekeepingTaskStatus, HousekeepingTaskType } from "@prisma/client";
import type { AuthContext } from "@/platform/auth/context";
import { requireCapability } from "@/platform/rbac";
import { recordAudit } from "@/platform/audit";
import { eventBus } from "@/platform/events";
import { ConflictError, NotFoundError, ValidationError } from "@/platform/errors";
import { authRepository } from "@/modules/auth/auth.repository";
import { reservationsRepository } from "@/modules/reservations/reservations.repository";
import { propertyRepository } from "@/modules/property/property.repository";
import { housekeepingRepository } from "@/modules/housekeeping/housekeeping.repository";
import { canTransition, type TaskStatus } from "@/modules/housekeeping/lifecycle";
import type { CreateTaskInput, UpdateTaskInput, ListTasksQuery } from "@/modules/housekeeping/housekeeping.schema";

async function getOrThrow(id: string, propertyId: string) {
  const task = await housekeepingRepository.findById(id);
  if (!task || task.propertyId !== propertyId) throw new NotFoundError("Task not found");
  return task;
}

/** Validate that a room / area target belongs to this property. */
async function assertTargets(ctx: AuthContext, roomId?: string | null, areaId?: string | null) {
  if (roomId) {
    const room = await reservationsRepository.roomById(roomId);
    if (!room || room.propertyId !== ctx.propertyId) throw new NotFoundError("Room not found");
  }
  if (areaId) {
    const area = await propertyRepository.findAreaById(areaId);
    if (!area || area.propertyId !== ctx.propertyId) throw new NotFoundError("Area not found");
  }
}

/** Validate that an assignee is an active staff member of this property. */
async function assertAssignee(ctx: AuthContext, staffId: string) {
  const staff = await authRepository.findStaffById(staffId);
  if (!staff || staff.propertyId !== ctx.propertyId || !staff.isActive) {
    throw new ValidationError("assignedToStaffId must reference an active staff member in this property");
  }
}

/** Timestamp side-effects of a status change. */
function statusStamps(next: HousekeepingTaskStatus) {
  if (next === "IN_PROGRESS") return { startedAt: new Date() };
  if (next === "DONE") return { completedAt: new Date() };
  return {};
}

/** Room cleanliness implied by a finished work order, or null when none. */
function roomStatusAfterTask(type: HousekeepingTaskType): "CLEAN" | "INSPECTED" | null {
  if (type === "CLEANING" || type === "TURNDOWN") return "CLEAN";
  if (type === "INSPECTION") return "INSPECTED";
  return null;
}

/**
 * Completing a cleaning/inspection work order updates the target room's
 * cleanliness flag. OUT_OF_ORDER is a maintenance state cleared explicitly by a
 * manager, never as a side-effect of one finished task.
 */
async function syncRoomAfterDone(
  ctx: AuthContext,
  task: Pick<HousekeepingTask, "id" | "roomId" | "type">,
): Promise<void> {
  if (!task.roomId) return;
  const next = roomStatusAfterTask(task.type);
  if (!next) return;
  const room = await reservationsRepository.roomById(task.roomId);
  if (!room || room.housekeepingStatus === "OUT_OF_ORDER" || room.housekeepingStatus === next) return;
  await reservationsRepository.updateRoom(task.roomId, { housekeepingStatus: next });
  await recordAudit({
    actorStaffId: ctx.staffId, propertyId: ctx.propertyId,
    action: "STATE_CHANGE", entityType: "Room", entityId: task.roomId,
    before: { housekeepingStatus: room.housekeepingStatus },
    after: { housekeepingStatus: next },
    metadata: { auto: "housekeeping-task-done", taskId: task.id },
  });
  eventBus.emit({ type: "room.updated", entity: "room", entityId: task.roomId, propertyId: ctx.propertyId });
}

export const housekeepingService = {
  async listTasks(ctx: AuthContext, query: ListTasksQuery) {
    requireCapability(ctx.role, "housekeeping:read");
    return housekeepingRepository.list({
      propertyId: ctx.propertyId,
      status: query.status,
      type: query.type,
      roomId: query.roomId,
      areaId: query.areaId,
      assignedToStaffId: query.mine ? ctx.staffId : query.assignedToStaffId,
    });
  },

  /** Mobile endpoint: the caller's own active (not-done) tasks. */
  async myTasks(ctx: AuthContext) {
    requireCapability(ctx.role, "housekeeping:read");
    const tasks = await housekeepingRepository.list({ propertyId: ctx.propertyId, assignedToStaffId: ctx.staffId });
    return tasks.filter((t) => t.status !== "DONE");
  },

  async createTask(ctx: AuthContext, input: CreateTaskInput) {
    requireCapability(ctx.role, "housekeeping:manage");
    await assertTargets(ctx, input.roomId, input.areaId);
    if (input.assignedToStaffId) await assertAssignee(ctx, input.assignedToStaffId);
    const task = await housekeepingRepository.create({
      propertyId: ctx.propertyId,
      title: input.title,
      type: input.type,
      priority: input.priority,
      roomId: input.roomId ?? null,
      areaId: input.areaId ?? null,
      assignedToStaffId: input.assignedToStaffId ?? null,
      notes: input.notes ?? null,
      createdByStaffId: ctx.staffId,
    });
    await recordAudit({
      actorStaffId: ctx.staffId, propertyId: ctx.propertyId,
      action: "CREATE", entityType: "HousekeepingTask", entityId: task.id, after: task,
    });
    eventBus.emit({ type: "housekeeping.created", entity: "housekeeping", entityId: task.id, propertyId: ctx.propertyId });
    return housekeepingRepository.findById(task.id);
  },

  async updateTask(ctx: AuthContext, id: string, input: UpdateTaskInput) {
    requireCapability(ctx.role, "housekeeping:manage");
    const before = await getOrThrow(id, ctx.propertyId);
    if (input.status && input.status !== before.status) {
      if (!canTransition(before.status as TaskStatus, input.status as TaskStatus)) {
        throw new ConflictError(`Cannot move a task from ${before.status} to ${input.status}`);
      }
    }
    if (input.assignedToStaffId) await assertAssignee(ctx, input.assignedToStaffId);
    const after = await housekeepingRepository.update(id, {
      ...(input.title !== undefined ? { title: input.title } : {}),
      ...(input.type !== undefined ? { type: input.type } : {}),
      ...(input.priority !== undefined ? { priority: input.priority } : {}),
      ...(input.assignedToStaffId !== undefined ? { assignedToStaffId: input.assignedToStaffId } : {}),
      ...(input.notes !== undefined ? { notes: input.notes } : {}),
      ...(input.status ? { status: input.status, ...statusStamps(input.status) } : {}),
    });
    await recordAudit({
      actorStaffId: ctx.staffId, propertyId: ctx.propertyId,
      action: input.status ? "STATE_CHANGE" : "UPDATE", entityType: "HousekeepingTask", entityId: id, before, after,
    });
    if (input.status === "DONE" && before.status !== "DONE") {
      await syncRoomAfterDone(ctx, after);
    }
    eventBus.emit({ type: "housekeeping.updated", entity: "housekeeping", entityId: id, propertyId: ctx.propertyId });
    return after;
  },

  /** Transition helper used by the mobile start/complete endpoints. */
  async transition(ctx: AuthContext, id: string, next: "IN_PROGRESS" | "DONE") {
    requireCapability(ctx.role, "housekeeping:manage");
    const before = await getOrThrow(id, ctx.propertyId);
    if (!canTransition(before.status as TaskStatus, next)) {
      throw new ConflictError(`Cannot move a task from ${before.status} to ${next}`);
    }
    const after = await housekeepingRepository.update(id, { status: next, ...statusStamps(next) });
    await recordAudit({
      actorStaffId: ctx.staffId, propertyId: ctx.propertyId,
      action: "STATE_CHANGE", entityType: "HousekeepingTask", entityId: id, before, after,
      metadata: { from: before.status, to: next },
    });
    if (next === "DONE") {
      await syncRoomAfterDone(ctx, after);
    }
    eventBus.emit({ type: `housekeeping.${next.toLowerCase()}`, entity: "housekeeping", entityId: id, propertyId: ctx.propertyId });
    return after;
  },

  /**
   * Cross-module hook (no RBAC — the caller already authorized the check-out):
   * open a checkout-cleaning work order for the vacated room. Idempotent: an
   * existing unfinished cleaning task for the room is reused, not duplicated.
   */
  async openCheckoutCleaning(
    actor: Pick<AuthContext, "staffId" | "propertyId">,
    room: { id: string; number: string },
  ) {
    const existing = await housekeepingRepository.findActiveCleaningTask(room.id);
    if (existing) return existing;
    const task = await housekeepingRepository.create({
      propertyId: actor.propertyId,
      title: `Checkout cleaning — Room ${room.number}`,
      type: "CLEANING",
      priority: "HIGH",
      roomId: room.id,
      createdByStaffId: actor.staffId,
    });
    await recordAudit({
      actorStaffId: actor.staffId, propertyId: actor.propertyId,
      action: "CREATE", entityType: "HousekeepingTask", entityId: task.id, after: task,
      metadata: { auto: "checkout-cleaning" },
    });
    eventBus.emit({ type: "housekeeping.created", entity: "housekeeping", entityId: task.id, propertyId: actor.propertyId });
    return task;
  },
};
