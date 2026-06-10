import { handle, ok, created, parseJson } from "@/platform/http";
import { requireAuth } from "@/platform/auth/context";
import { createTaskSchema, listTasksQuerySchema } from "@/modules/housekeeping/housekeeping.schema";
import { housekeepingService } from "@/modules/housekeeping/housekeeping.service";

export const GET = handle(async (req) => {
  const ctx = requireAuth(req);
  const query = listTasksQuerySchema.parse(Object.fromEntries(new URL(req.url).searchParams));
  return ok(await housekeepingService.listTasks(ctx, query));
});

export const POST = handle(async (req) => {
  const ctx = requireAuth(req);
  const input = createTaskSchema.parse(await parseJson(req));
  return created(await housekeepingService.createTask(ctx, input));
});
