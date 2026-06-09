/** Lightweight view models mirroring the API responses (see docs/api-reference.md). */

export type ReservationStatus =
  | "PENDING"
  | "CONFIRMED"
  | "CHECKED_IN"
  | "CHECKED_OUT"
  | "CANCELLED"
  | "NO_SHOW";

export interface Guest {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  nationality: string | null;
  addressLine: string | null;
  city: string | null;
  postalCode: string | null;
  country: string | null;
  gdprConsentDataProcessing: boolean;
  gdprConsentMarketing: boolean;
  createdAt: string;
}

export interface RoomTypeRef {
  id: string;
  name: string;
  basePriceMinor: number;
}
export interface RoomRef {
  id: string;
  number: string;
}
export interface Reservation {
  id: string;
  guestId: string;
  guest?: Guest;
  roomTypeId: string;
  roomType?: RoomTypeRef;
  roomId: string | null;
  room?: RoomRef | null;
  checkInDate: string;
  checkOutDate: string;
  status: ReservationStatus;
  adults: number;
  children: number;
  ratePerNightMinor: number;
  notes: string | null;
}

export interface Treatment {
  id: string;
  name: string;
  description: string | null;
  durationMinutes: number;
  priceMinor: number;
  requiredResourceType: string | null;
  active: boolean;
}

export interface ServicePackage {
  id: string;
  name: string;
  priceMinor: number;
  active: boolean;
  items?: { treatmentId: string; quantity: number; treatment?: Treatment }[];
}

export type AppointmentStatus = "SCHEDULED" | "COMPLETED" | "CANCELLED" | "NO_SHOW";
export interface Appointment {
  id: string;
  guestId: string;
  guest?: Guest;
  treatmentId: string;
  treatment?: Treatment;
  therapistId: string;
  therapist?: { id: string; firstName: string; lastName: string };
  resourceId: string;
  resource?: { id: string; name: string; type: string };
  startTime: string;
  endTime: string;
  status: AppointmentStatus;
  reservationId: string | null;
  notes: string | null;
}

export interface FolioLineItem {
  id: string;
  type: string;
  description: string;
  quantity: number;
  unitPriceMinor: number;
  amountMinor: number;
  createdAt: string;
}
export interface Payment {
  id: string;
  amountMinor: number;
  method: string;
  reference: string | null;
  paidAt: string;
}
export interface FolioSummary {
  id: string;
  guestId: string;
  reservationId: string | null;
  status: "OPEN" | "CLOSED";
  chargesMinor: number;
  paymentsMinor: number;
  balanceMinor: number;
}
export interface Folio extends FolioSummary {
  lineItems: FolioLineItem[];
  payments: Payment[];
}

export interface AuditLog {
  id: string;
  action: "CREATE" | "UPDATE" | "DELETE" | "STATE_CHANGE" | "LOGIN" | "LOGOUT" | "READ";
  entityType: string;
  entityId: string;
  actorStaffId: string | null;
  actor?: { id: string; firstName: string; lastName: string; role: string } | null;
  metadata?: Record<string, unknown> | null;
  createdAt: string;
}

export interface FormTemplate {
  id: string;
  name: string;
  type: "INTAKE" | "MEDICAL_HISTORY" | "CUSTOM";
  version: number;
  active: boolean;
  updatedAt: string;
}

export interface ConversationDto {
  id: string;
  guestId: string;
  guest?: { firstName: string; lastName: string };
  handling: "AI" | "HUMAN";
  status: "OPEN" | "CLOSED";
  assignedStaffId: string | null;
  lastMessageAt: string;
}

export interface MessageDto {
  id: string;
  senderKind: "GUEST" | "AI" | "STAFF";
  senderStaffId: string | null;
  body: string;
  actionType: string | null;
  actionId: string | null;
  createdAt: string;
}
