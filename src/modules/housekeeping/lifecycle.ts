/** Housekeeping work-order lifecycle. Pure + unit-tested. */

export const TASK_STATUSES = ["OPEN", "IN_PROGRESS", "BLOCKED", "DONE"] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

/** Allowed status transitions. DONE is terminal — a completed task is never reopened. */
const TRANSITIONS: Record<TaskStatus, TaskStatus[]> = {
  OPEN: ["IN_PROGRESS", "BLOCKED", "DONE"],
  IN_PROGRESS: ["OPEN", "BLOCKED", "DONE"],
  BLOCKED: ["OPEN", "IN_PROGRESS"],
  DONE: [],
};

export function canTransition(from: TaskStatus, to: TaskStatus): boolean {
  if (from === to) return false;
  return TRANSITIONS[from].includes(to);
}
