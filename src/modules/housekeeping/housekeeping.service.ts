import type { HousekeepingTaskStatus } from "@prisma/client";
import type { AuthContext } from "@/platform/auth/context";
import { requireCapability } from "@/platform/rbac";
import { recordAudit } from "@/platform/audit";
import { eventBus } from "@/platform/events";
import { ConflictError, NotFoundError } from "@/platform/errors";
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

/** Timestamp side-effects of a status change. */
function statusStamps(next: HousekeepingTaskStatus) {
  if (next === "IN_PROGRESS") return { startedAt: new Date() };
  if (next === "DONE") return { completedAt: new Date() };
  return {};
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
    eventBus.emit({ type: `housekeeping.${next.toLowerCase()}`, entity: "housekeeping", entityId: id, propertyId: ctx.propertyId });
    return after;
  },
};
