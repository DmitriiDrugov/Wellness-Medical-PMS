import { handle, ok, parseJson } from "@/platform/http";
import { guestLogoutSchema } from "@/modules/guest-auth/guest-auth.schema";
import { guestAuthService } from "@/modules/guest-auth/guest-auth.service";

export const POST = handle(async (req) => {
  const input = guestLogoutSchema.parse(await parseJson(req));
  await guestAuthService.logout(input);
  return ok({ ok: true });
});
