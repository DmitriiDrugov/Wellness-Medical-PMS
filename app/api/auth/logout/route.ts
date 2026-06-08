import { handle, ok, parseJson } from "@/platform/http";
import { logoutSchema } from "@/modules/auth/auth.schema";
import { authService } from "@/modules/auth/auth.service";

export const POST = handle(async (req) => {
  const input = logoutSchema.parse(await parseJson(req));
  await authService.logout(input);
  return ok({ success: true });
});
