import { handle, ok, parseJson } from "@/platform/http";
import { refreshSchema } from "@/modules/auth/auth.schema";
import { authService } from "@/modules/auth/auth.service";

export const POST = handle(async (req) => {
  const input = refreshSchema.parse(await parseJson(req));
  const pair = await authService.refresh(input);
  return ok(pair);
});
