import { handle, ok, parseJson } from "@/platform/http";
import { guestRefreshSchema } from "@/modules/guest-auth/guest-auth.schema";
import { guestAuthService } from "@/modules/guest-auth/guest-auth.service";

export const POST = handle(async (req) => {
  const input = guestRefreshSchema.parse(await parseJson(req));
  return ok(await guestAuthService.refresh(input));
});
