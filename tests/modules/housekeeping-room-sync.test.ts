import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Regression guards for the housekeeping ↔ room-cleanliness sync:
 *  - finishing a CLEANING/TURNDOWN task sets the target room to CLEAN;
 *  - finishing an INSPECTION sets it to INSPECTED;
 *  - MAINTENANCE and area/property tasks never touch a room flag;
 *  - OUT_OF_ORDER is sticky — no task completion clears it;
 *  - assignees must be active staff of the same property;
 *  - openCheckoutCleaning reuses an existing unfinished cleaning task.
 */

const task = (over: object) => ({
  id: "t1",
  propertyId: "p1",
  roomId: "room1",
  areaId: null,
  type: "CLEANING",
  status: "IN_PROGRESS",
  ...over,
});

const { hkRepo, resRepo, authRepo } = vi.hoisted(() => ({
  hkRepo: {
    findById: vi.fn(),
    create: vi.fn(async (data: object) => ({ id: "new-task", ...data })),
    update: vi.fn(),
    findActiveCleaningTask: vi.fn(async (): Promise<Record<string, unknown> | null> => null),
    list: vi.fn(async () => []),
  },
  resRepo: {
    roomById: vi.fn(async () => ({ id: "room1", propertyId: "p1", housekeepingStatus: "DIRTY" })),
    updateRoom: vi.fn(async () => ({})),
  },
  authRepo: {
    findStaffById: vi.fn(async () => ({ id: "hk1", propertyId: "p1", isActive: true })),
  },
}));

vi.mock("@/platform/audit", () => ({ recordAudit: vi.fn(async () => {}) }));
vi.mock("@/platform/events", () => ({ eventBus: { emit: vi.fn() } }));
vi.mock("@/modules/housekeeping/housekeeping.repository", () => ({ housekeepingRepository: hkRepo }));
vi.mock("@/modules/reservations/reservations.repository", () => ({ reservationsRepository: resRepo }));
vi.mock("@/modules/auth/auth.repository", () => ({ authRepository: authRepo }));
vi.mock("@/modules/property/property.repository", () => ({ propertyRepository: { findAreaById: vi.fn() } }));

import { housekeepingService } from "@/modules/housekeeping/housekeeping.service";

const ctx = { kind: "staff" as const, staffId: "hk1", role: "HOUSEKEEPING" as const, propertyId: "p1" };

beforeEach(() => {
  vi.clearAllMocks();
  resRepo.roomById.mockResolvedValue({ id: "room1", propertyId: "p1", housekeepingStatus: "DIRTY" });
  hkRepo.findActiveCleaningTask.mockResolvedValue(null);
});

describe("task DONE → room cleanliness sync", () => {
  it("marks the room CLEAN after a cleaning task is completed", async () => {
    hkRepo.findById.mockResolvedValue(task({}));
    hkRepo.update.mockResolvedValue(task({ status: "DONE" }));
    await housekeepingService.transition(ctx, "t1", "DONE");
    expect(resRepo.updateRoom).toHaveBeenCalledWith("room1", { housekeepingStatus: "CLEAN" });
  });

  it("marks the room INSPECTED after an inspection", async () => {
    hkRepo.findById.mockResolvedValue(task({ type: "INSPECTION" }));
    hkRepo.update.mockResolvedValue(task({ type: "INSPECTION", status: "DONE" }));
    await housekeepingService.transition(ctx, "t1", "DONE");
    expect(resRepo.updateRoom).toHaveBeenCalledWith("room1", { housekeepingStatus: "INSPECTED" });
  });

  it("does not touch the room for a maintenance task", async () => {
    hkRepo.findById.mockResolvedValue(task({ type: "MAINTENANCE" }));
    hkRepo.update.mockResolvedValue(task({ type: "MAINTENANCE", status: "DONE" }));
    await housekeepingService.transition(ctx, "t1", "DONE");
    expect(resRepo.updateRoom).not.toHaveBeenCalled();
  });

  it("does not touch anything for a task without a room target", async () => {
    hkRepo.findById.mockResolvedValue(task({ roomId: null }));
    hkRepo.update.mockResolvedValue(task({ roomId: null, status: "DONE" }));
    await housekeepingService.transition(ctx, "t1", "DONE");
    expect(resRepo.updateRoom).not.toHaveBeenCalled();
  });

  it("never clears OUT_OF_ORDER as a side-effect", async () => {
    resRepo.roomById.mockResolvedValue({ id: "room1", propertyId: "p1", housekeepingStatus: "OUT_OF_ORDER" });
    hkRepo.findById.mockResolvedValue(task({}));
    hkRepo.update.mockResolvedValue(task({ status: "DONE" }));
    await housekeepingService.transition(ctx, "t1", "DONE");
    expect(resRepo.updateRoom).not.toHaveBeenCalled();
  });

  it("syncs via the kanban update path too", async () => {
    hkRepo.findById.mockResolvedValue(task({}));
    hkRepo.update.mockResolvedValue(task({ status: "DONE" }));
    await housekeepingService.updateTask(ctx, "t1", { status: "DONE" });
    expect(resRepo.updateRoom).toHaveBeenCalledWith("room1", { housekeepingStatus: "CLEAN" });
  });
});

describe("assignee validation", () => {
  it("rejects an assignee from another property", async () => {
    authRepo.findStaffById.mockResolvedValue({ id: "hk2", propertyId: "p2", isActive: true });
    await expect(
      housekeepingService.createTask(ctx, {
        title: "Clean lobby",
        type: "CLEANING",
        priority: "NORMAL",
        assignedToStaffId: "hk2",
      }),
    ).rejects.toMatchObject({ status: 422 });
  });

  it("rejects an inactive assignee on reassignment", async () => {
    hkRepo.findById.mockResolvedValue(task({}));
    authRepo.findStaffById.mockResolvedValue({ id: "hk3", propertyId: "p1", isActive: false });
    await expect(
      housekeepingService.updateTask(ctx, "t1", { assignedToStaffId: "hk3" }),
    ).rejects.toMatchObject({ status: 422 });
  });
});

describe("openCheckoutCleaning", () => {
  it("creates a HIGH-priority cleaning work order for the room", async () => {
    const result = await housekeepingService.openCheckoutCleaning(ctx, { id: "room1", number: "101" });
    expect(hkRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ roomId: "room1", type: "CLEANING", priority: "HIGH" }),
    );
    expect(result.id).toBe("new-task");
  });

  it("is idempotent: reuses an unfinished cleaning task instead of duplicating", async () => {
    hkRepo.findActiveCleaningTask.mockResolvedValue(task({ id: "existing" }));
    const result = await housekeepingService.openCheckoutCleaning(ctx, { id: "room1", number: "101" });
    expect(hkRepo.create).not.toHaveBeenCalled();
    expect(result.id).toBe("existing");
  });
});
