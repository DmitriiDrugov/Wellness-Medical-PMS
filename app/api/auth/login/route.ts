import { handle, ok, parseJson } from "@/platform/http";
import { loginSchema } from "@/modules/auth/auth.schema";
import { authService } from "@/modules/auth/auth.service";

export const POST = handle(async (req) => {
  const input = loginSchema.parse(await parseJson(req));
  const pair = await authService.login(input);
  return ok(pair);
});
