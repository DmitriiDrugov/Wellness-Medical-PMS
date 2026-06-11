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
  dateOfBirth: string | null;
  idDocumentType: string | null;
  idDocumentNumber: string | null;
  idDocumentExpiry: string | null;
  placeOfBirth: string | null;
  gender: string | null;
  addressLine: string | null;
  city: string | null;
  postalCode: string | null;
  country: string | null;
  gdprConsentDataProcessing: boolean;
  gdprConsentMarketing: boolean;
  createdAt: string;
}

export interface MedicalProfile {
  id: string;
  guestId: string;
  dietaryNotes: string | null;
  allergies: string | null;
  contraindications: string | null;
  currentMedications: string | null;
  prescriptions: string | null;
  mobilityNotes: string | null;
  generalNotes: string | null;
  updatedAt: string;
}

export interface GuestDocument {
  id: string;
  guestId: string;
  kind: string;
  label: string;
  externalRef: string;
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

export interface StaffRef {
  id: string;
  firstName: string;
  lastName: string;
  role: string;
}
export interface RoomListItem {
  id: string;
  number: string;
  roomTypeId: string;
  status: string;
}

// ---- Hotel management ----
export interface Property {
  id: string;
  name: string;
  legalName: string;
  taxNumber: string;
  ntakRegNumber: string;
  addressLine: string;
  city: string;
  postalCode: string;
  country: string;
  timezone: string;
  currency: string;
  touristTaxPerPersonPerNightMinor: number;
  touristTaxAppliesToChildren: boolean;
}

export type HousekeepingState = "CLEAN" | "DIRTY" | "INSPECTED" | "OUT_OF_ORDER";

export interface RoomType {
  id: string;
  name: string;
  description: string | null;
  basePriceMinor: number;
  maxOccupancy: number;
}

export interface Room {
  id: string;
  number: string;
  roomTypeId: string;
  floor: number | null;
  housekeepingStatus: HousekeepingState;
  posX: number | null;
  posY: number | null;
  width: number;
  height: number;
}

export type AreaKind =
  | "COMMON" | "POOL" | "SPA" | "RESTAURANT" | "CORRIDOR" | "BACK_OFFICE" | "OUTDOOR" | "OTHER";

export interface PropertyArea {
  id: string;
  name: string;
  kind: AreaKind;
  floor: number | null;
  posX: number | null;
  posY: number | null;
  width: number;
  height: number;
  notes: string | null;
}

export type TaskStatus = "OPEN" | "IN_PROGRESS" | "BLOCKED" | "DONE";
export type TaskType = "CLEANING" | "TURNDOWN" | "MAINTENANCE" | "INSPECTION" | "RESTOCK" | "OTHER";
export type TaskPriority = "LOW" | "NORMAL" | "HIGH" | "URGENT";

export interface HousekeepingTask {
  id: string;
  title: string;
  type: TaskType;
  status: TaskStatus;
  priority: TaskPriority;
  notes: string | null;
  roomId: string | null;
  areaId: string | null;
  room: { id: string; number: string; floor: number | null } | null;
  area: { id: string; name: string; kind: AreaKind; floor: number | null } | null;
  assignedToStaffId: string | null;
  assignedTo: { id: string; firstName: string; lastName: string } | null;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
}

// ---- Booking grid ----
export interface GridRoom {
  id: string;
  number: string;
  floor: number | null;
  roomTypeId: string;
  roomTypeName: string;
  housekeepingStatus: "CLEAN" | "DIRTY" | "INSPECTED" | "OUT_OF_ORDER";
}
export interface GridBooking {
  id: string;
  guestId: string;
  guestName: string;
  roomId: string | null;
  roomNumber: string | null;
  roomTypeId: string;
  roomTypeName: string;
  checkInDate: string;
  checkOutDate: string;
  status: ReservationStatus;
  adults: number;
  children: number;
}
export interface BookingGridResponse {
  from: string;
  to: string;
  view: "day" | "week";
  rooms: GridRoom[];
  roomTypes: { id: string; name: string }[];
  bookings: GridBooking[];
  utilization: { occupiedRoomNights: number; availableRoomNights: number; ratePct: number };
}
