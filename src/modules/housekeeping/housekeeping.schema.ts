import { z } from "zod";
import { TASK_STATUSES } from "@/modules/housekeeping/lifecycle";

export const TASK_TYPES = ["CLEANING", "TURNDOWN", "MAINTENANCE", "INSPECTION", "RESTOCK", "OTHER"] as const;
export const TASK_PRIORITIES = ["LOW", "NORMAL", "HIGH", "URGENT"] as const;

export const createTaskSchema = z.object({
  title: z.string().min(1),
  type: z.enum(TASK_TYPES).default("CLEANING"),
  priority: z.enum(TASK_PRIORITIES).default("NORMAL"),
  roomId: z.string().min(1).nullish(),
  areaId: z.string().min(1).nullish(),
  assignedToStaffId: z.string().min(1).nullish(),
  notes: z.string().nullish(),
});

export const updateTaskSchema = z.object({
  title: z.string().min(1).optional(),
  type: z.enum(TASK_TYPES).optional(),
  priority: z.enum(TASK_PRIORITIES).optional(),
  status: z.enum(TASK_STATUSES).optional(),
  assignedToStaffId: z.string().min(1).nullish(),
  notes: z.string().nullish(),
});

export const listTasksQuerySchema = z.object({
  status: z.enum(TASK_STATUSES).optional(),
  type: z.enum(TASK_TYPES).optional(),
  assignedToStaffId: z.string().optional(),
  roomId: z.string().optional(),
  areaId: z.string().optional(),
  // NOTE: not z.coerce.boolean() — that would turn the query string "false" into true.
  mine: z
    .enum(["true", "false"])
    .transform((v) => v === "true")
    .optional(),
});

export type CreateTaskInput = z.infer<typeof createTaskSchema>;
export type UpdateTaskInput = z.infer<typeof updateTaskSchema>;
export type ListTasksQuery = z.infer<typeof listTasksQuerySchema>;
