import { handle, ok } from "@/platform/http";
import { requireAuth } from "@/platform/auth/context";
import { requireCapability, rbacMatrix } from "@/platform/rbac";

/** The role → capability matrix, so the Staff page can render access per role. */
export const GET = handle(async (req) => {
  const ctx = requireAuth(req);
  requireCapability(ctx.role, "staff:manage");
  return ok(rbacMatrix);
});
