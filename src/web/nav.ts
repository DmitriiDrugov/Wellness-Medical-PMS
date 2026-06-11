import { can, type Capability } from "@/platform/rbac";
import type { Role } from "@/web/auth-context";

export interface NavItem {
  label: string;
  href: string;
  icon: string; // Icon registry name (see src/web/components/icon.tsx)
  capability?: Capability; // required capability to see the item
  roles?: Role[]; // additional role gate (for features with no capability yet)
  /** Screen maps to an un-built backend phase — rendered as a disabled placeholder. */
  stub?: boolean;
}

/** A top-nav branch: one trigger that opens a menu of related modules. */
export interface NavGroup {
  label: string;
  icon: string;
  items: NavItem[];
}

/**
 * Top-navigation information architecture. Modules are grouped by meaning:
 * Front Desk = the guest-facing desk flow, Therapy = the treatment business,
 * Hotel = the physical property, Insights = read models, Admin = governance.
 * A group is visible when at least one of its items is.
 */
export const NAV_GROUPS: NavGroup[] = [
  {
    label: "Dashboard",
    icon: "dashboard",
    items: [{ label: "Dashboard", href: "/dashboard", icon: "dashboard" }],
  },
  {
    label: "Front Desk",
    icon: "calendar_month",
    items: [
      { label: "Booking", href: "/booking", icon: "calendar_month", capability: "reservation:read" },
      { label: "Guests", href: "/guests", icon: "group", capability: "guest:read" },
      { label: "Billing", href: "/billing", icon: "receipt_long", capability: "folio:read" },
      { label: "Messages", href: "/messages", icon: "forum", capability: "messaging:read" },
    ],
  },
  {
    label: "Therapy",
    icon: "spa",
    items: [
      { label: "Treatments", href: "/schedule", icon: "spa", capability: "appointment:read" },
      { label: "Packages", href: "/catalog", icon: "inventory_2", capability: "catalog:read" },
      { label: "Form Templates", href: "/form-templates", icon: "description", capability: "forms:manage" },
    ],
  },
  {
    label: "Hotel",
    icon: "hotel",
    items: [
      { label: "Property", href: "/hotel", icon: "settings", capability: "property:manage" },
      {
        label: "Housekeeping",
        href: "/housekeeping",
        icon: "cleaning_services",
        roles: ["HOUSEKEEPING", "MANAGER", "ADMIN"],
      },
    ],
  },
  {
    label: "Insights",
    icon: "assessment",
    items: [
      { label: "Reports", href: "/reports", icon: "assessment", capability: "report:read" },
      { label: "Audit Log", href: "/audit", icon: "history", capability: "audit:read" },
    ],
  },
  {
    label: "Admin",
    icon: "lock",
    items: [
      { label: "Staff", href: "/staff", icon: "group", capability: "staff:manage" },
      { label: "Membership", href: "/membership", icon: "card_membership", roles: ["MANAGER", "ADMIN"], stub: true },
    ],
  },
];

function itemVisible(item: NavItem, role: Role): boolean {
  const capOk = item.capability ? can(role, item.capability) : true;
  const roleOk = item.roles ? item.roles.includes(role) : true;
  return capOk && roleOk;
}

/** Groups (with their visible items) a role may see. Empty groups are dropped. */
export function visibleGroups(role: Role): NavGroup[] {
  return NAV_GROUPS.map((group) => ({ ...group, items: group.items.filter((i) => itemVisible(i, role)) })).filter(
    (group) => group.items.length > 0,
  );
}

/** Flat list of visible items (route guards, breadcrumbs, tests). */
export function visibleNav(role: Role): NavItem[] {
  return visibleGroups(role).flatMap((g) => g.items);
}
