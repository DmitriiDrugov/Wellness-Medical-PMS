import type { Prisma, HousekeepingTask, HousekeepingTaskStatus } from "@prisma/client";
import { prisma } from "@/platform/db";

/** Tile info joined so the board/map can label a task without extra round-trips. */
const TASK_INCLUDE = {
  room: { select: { id: true, number: true, floor: true } },
  area: { select: { id: true, name: true, kind: true, floor: true } },
  assignedTo: { select: { id: true, firstName: true, lastName: true } },
} satisfies Prisma.HousekeepingTaskInclude;

export const housekeepingRepository = {
  list(params: {
    propertyId: string;
    status?: HousekeepingTaskStatus;
    type?: string;
    assignedToStaffId?: string;
    roomId?: string;
    areaId?: string;
  }) {
    const where: Prisma.HousekeepingTaskWhereInput = {
      propertyId: params.propertyId,
      ...(params.status ? { status: params.status } : {}),
      ...(params.type ? { type: params.type as Prisma.HousekeepingTaskWhereInput["type"] } : {}),
      ...(params.assignedToStaffId ? { assignedToStaffId: params.assignedToStaffId } : {}),
      ...(params.roomId ? { roomId: params.roomId } : {}),
      ...(params.areaId ? { areaId: params.areaId } : {}),
    };
    return prisma.housekeepingTask.findMany({
      where,
      orderBy: [{ status: "asc" }, { priority: "desc" }, { createdAt: "asc" }],
      include: TASK_INCLUDE,
    });
  },

  findById(id: string) {
    return prisma.housekeepingTask.findUnique({ where: { id }, include: TASK_INCLUDE });
  },

  create(data: Prisma.HousekeepingTaskUncheckedCreateInput): Promise<HousekeepingTask> {
    return prisma.housekeepingTask.create({ data });
  },

  update(id: string, data: Prisma.HousekeepingTaskUncheckedUpdateInput) {
    return prisma.housekeepingTask.update({ where: { id }, data, include: TASK_INCLUDE });
  },
};
