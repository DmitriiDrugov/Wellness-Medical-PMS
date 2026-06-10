import { can, type Capability } from "@/platform/rbac";
import type { Role } from "@/web/auth-context";

export interface NavItem {
  label: string;
  href: string;
  icon: string; // Icon registry name (see src/web/components/icon.tsx)
  capability?: Capability; // required capability to see the item
  roles?: Role[]; // additional role gate (for features with no capability yet)
  /** Screen maps to an un-built backend phase (7–10) or Housekeeping — rendered as a disabled placeholder. */
  stub?: boolean;
}

/** Sidebar information architecture, mirrors the Stitch mockups' left nav. */
export const NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: "dashboard" },
  { label: "Booking", href: "/booking", icon: "calendar_month", capability: "reservation:read" },
  { label: "Guests", href: "/guests", icon: "group", capability: "guest:read" },
  { label: "Treatments", href: "/schedule", icon: "spa", capability: "appointment:read" },
  { label: "Packages", href: "/catalog", icon: "inventory_2", capability: "catalog:read" },
  { label: "Billing", href: "/billing", icon: "receipt_long", capability: "folio:read" },
  { label: "Housekeeping", href: "/housekeeping", icon: "cleaning_services", roles: ["HOUSEKEEPING", "MANAGER", "ADMIN"] },
  { label: "Hotel", href: "/hotel", icon: "settings", capability: "property:manage" },
  { label: "Reports", href: "/reports", icon: "assessment", capability: "report:read" },
  { label: "Audit Log", href: "/audit", icon: "history", capability: "audit:read" },
  { label: "Form Templates", href: "/form-templates", icon: "description", capability: "forms:manage" },
  // ---- Stubs: backend not yet built (Phases 8–10) ----
  { label: "Membership", href: "/membership", icon: "card_membership", roles: ["MANAGER", "ADMIN"], stub: true },
  { label: "Messages", href: "/messages", icon: "forum", capability: "messaging:read" },
];

/** Items visible to a role: capability gate AND/OR role gate must pass. */
export function visibleNav(role: Role): NavItem[] {
  return NAV_ITEMS.filter((item) => {
    const capOk = item.capability ? can(role, item.capability) : true;
    const roleOk = item.roles ? item.roles.includes(role) : true;
    return capOk && roleOk;
  });
}
