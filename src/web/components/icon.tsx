import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  BarChartSquare02,
  Bell01,
  Brush01,
  Calendar,
  CalendarDate,
  Check,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  Clock,
  ClockRewind,
  Coins01,
  CreditCard02,
  Download01,
  Edit01,
  Feather,
  File02,
  FilePlus02,
  FilterLines,
  Grid01,
  Lock01,
  LogIn01,
  LogOut01,
  MessageChatCircle,
  Building02,
  Package,
  Plus,
  PlusCircle,
  Receipt,
  SearchLg,
  Send01,
  Settings01,
  Tool02,
  Trash01,
  User01,
  Users01,
  UserPlus01,
  XCircle,
  XClose,
  ClipboardCheck,
  Loading01,
  Zap,
} from "@untitledui/icons";
import type { FC, SVGProps } from "react";

type IconComponent = FC<SVGProps<SVGSVGElement>>;

/**
 * Maps the Material Symbol names the app already uses to Untitled UI icon
 * components. Keeping this registry behind the existing `<Icon name="…" />`
 * API means call sites don't change when the icon set is swapped.
 */
const REGISTRY: Record<string, IconComponent> = {
  add: Plus,
  add_circle: PlusCircle,
  arrow_forward: ArrowRight,
  assessment: BarChartSquare02,
  bolt: Zap,
  calendar_month: Calendar,
  calendar_today: CalendarDate,
  cancel: XCircle,
  card_membership: CreditCard02,
  check: Check,
  check_circle: CheckCircle,
  chevron_left: ChevronLeft,
  chevron_right: ChevronRight,
  cleaning_services: Brush01,
  close: XClose,
  construction: Tool02,
  contact_page: ClipboardCheck,
  dashboard: Grid01,
  delete: Trash01,
  description: File02,
  download: Download01,
  edit: Edit01,
  error: AlertCircle,
  filter_list: FilterLines,
  forum: MessageChatCircle,
  group: Users01,
  history: ClockRewind,
  inventory_2: Package,
  library_add: FilePlus02,
  lock: Lock01,
  login: LogIn01,
  logout: LogOut01,
  meeting_room: Building02,
  notifications: Bell01,
  payments: Coins01,
  person: User01,
  person_add: UserPlus01,
  progress_activity: Loading01,
  receipt_long: Receipt,
  schedule: Clock,
  search: SearchLg,
  send: Send01,
  settings: Settings01,
  spa: Feather,
  warning: AlertTriangle,
};

/**
 * Renders an Untitled UI icon by its (legacy Material Symbol) name. Sizing is
 * driven by the `size-*`/`text-*` utilities passed via `className`; the SVG uses
 * 1em so `text-[18px]` etc. keep working as before.
 */
export function Icon({ name, className }: { name: string; className?: string }) {
  const Cmp = REGISTRY[name];
  if (!Cmp) {
    if (process.env.NODE_ENV !== "production") {
      console.warn(`[Icon] no Untitled UI mapping for "${name}"`);
    }
    return null;
  }
  return <Cmp aria-hidden className={`inline-block size-[1em] shrink-0 ${className ?? ""}`} />;
}
