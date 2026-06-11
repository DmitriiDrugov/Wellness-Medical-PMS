import type { Reservation, Room } from "@prisma/client";
import type { AuthContext } from "@/platform/auth/context";
import { requireCapability } from "@/platform/rbac";
import { recordAudit } from "@/platform/audit";
import { eventBus } from "@/platform/events";
import { ConflictError, NotFoundError, ValidationError } from "@/platform/errors";
import { nightsBetween } from "@/platform/intervals";
import { folioService } from "@/modules/folio/folio.service";
import { guestsService } from "@/modules/guests/guests.service";
import { housekeepingService } from "@/modules/housekeeping/housekeeping.service";
import { reservationsRepository } from "@/modules/reservations/reservations.repository";
import { computeUtilization } from "@/modules/reservations/grid";
import type {
  CreateReservationInput,
  UpdateReservationInput,
  AvailabilityQuery,
  ListReservationsQuery,
  BookingGridQuery,
  CreateRoomTypeInput,
  UpdateRoomTypeInput,
  CreateRoomInput,
  UpdateRoomInput,
} from "@/modules/reservations/reservations.schema";

async function getOrThrow(id: string, propertyId: string) {
  const reservation = await reservationsRepository.findById(id);
  if (!reservation || reservation.propertyId !== propertyId) throw new NotFoundError("Reservation not found");
  return reservation;
}

/** Statuses in which a reservation's lifecycle is finished and it must not change. */
const TERMINAL_STATUSES = ["CHECKED_OUT", "CANCELLED", "NO_SHOW"] as const;

function assertMutable(reservation: Reservation): void {
  if ((TERMINAL_STATUSES as readonly string[]).includes(reservation.status)) {
    throw new ConflictError(`Cannot modify a reservation with status ${reservation.status}`);
  }
}

/** Validate a room exists, belongs to the property, matches the type, and is free. */
async function assertRoomBookable(
  ctx: AuthContext,
  roomId: string,
  roomTypeId: string,
  checkIn: Date,
  checkOut: Date,
  excludeReservationId?: string,
): Promise<Room> {
  const room = await reservationsRepository.roomById(roomId);
  if (!room || room.propertyId !== ctx.propertyId) throw new NotFoundError("Room not found");
  if (room.roomTypeId !== roomTypeId) {
    throw new ValidationError("Room does not match the reserved room type");
  }
  const conflicts = await reservationsRepository.findConflicting(roomId, checkIn, checkOut, excludeReservationId);
  if (conflicts.length > 0) {
    throw new ConflictError("Room is already booked for the requested dates", {
      conflictingReservationIds: conflicts.map((c) => c.id),
    });
  }
  return room;
}

export const reservationsService = {
  async list(ctx: AuthContext, query: ListReservationsQuery) {
    requireCapability(ctx.role, "reservation:read");
    const { items, total } = await reservationsRepository.list({
      propertyId: ctx.propertyId,
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
      status: query.status,
      roomId: query.roomId,
      guestId: query.guestId,
      from: query.from,
      to: query.to,
    });
    return { items, total, page: query.page, pageSize: query.pageSize };
  },

  async get(ctx: AuthContext, id: string) {
    requireCapability(ctx.role, "reservation:read");
    return getOrThrow(id, ctx.propertyId);
  },

  async create(ctx: AuthContext, input: CreateReservationInput): Promise<Reservation> {
    requireCapability(ctx.role, "reservation:write");
    // Defense in depth: the route schema enforces this, but direct callers (the AI
    // receptionist invokes the service, not the route) must not bypass it.
    if (input.checkOutDate <= input.checkInDate) {
      throw new ValidationError("checkOutDate must be after checkInDate");
    }
    // Existence check (404, not a DB error) that also rejects GDPR-erased guests.
    await guestsService.requireExists(input.guestId);
    const roomType = await reservationsRepository.roomTypeById(input.roomTypeId);
    if (!roomType || roomType.propertyId !== ctx.propertyId) {
      throw new NotFoundError("Room type not found");
    }
    if (input.roomId) {
      await assertRoomBookable(ctx, input.roomId, input.roomTypeId, input.checkInDate, input.checkOutDate);
    }
    const reservation = await reservationsRepository.create({
      property: { connect: { id: ctx.propertyId } },
      guest: { connect: { id: input.guestId } },
      roomType: { connect: { id: input.roomTypeId } },
      ...(input.roomId ? { room: { connect: { id: input.roomId } } } : {}),
      checkInDate: input.checkInDate,
      checkOutDate: input.checkOutDate,
      adults: input.adults,
      children: input.children,
      ratePerNightMinor: input.ratePerNightMinor ?? roomType.basePriceMinor,
      notes: input.notes,
      status: "PENDING",
    });
    await recordAudit({
      actorStaffId: ctx.staffId,
      propertyId: ctx.propertyId,
      action: "CREATE",
      entityType: "Reservation",
      entityId: reservation.id,
      after: reservation,
    });
    eventBus.emit({ type: "booking.created", entity: "booking", entityId: reservation.id, propertyId: ctx.propertyId });
    return reservation;
  },

  async update(ctx: AuthContext, id: string, input: UpdateReservationInput): Promise<Reservation> {
    requireCapability(ctx.role, "reservation:write");
    const before = await getOrThrow(id, ctx.propertyId);
    // A finished stay has already been billed (room charges + tourist tax post at
    // check-out); silently editing dates/occupancy afterwards would desync the folio.
    assertMutable(before);
    const checkIn = input.checkInDate ?? before.checkInDate;
    const checkOut = input.checkOutDate ?? before.checkOutDate;
    if (checkOut <= checkIn) throw new ValidationError("checkOutDate must be after checkInDate");
    // If dates change while a room is assigned, re-validate availability.
    if (before.roomId && (input.checkInDate || input.checkOutDate)) {
      await assertRoomBookable(ctx, before.roomId, before.roomTypeId, checkIn, checkOut, id);
    }
    const after = await reservationsRepository.update(id, { ...input });
    await recordAudit({
      actorStaffId: ctx.staffId,
      propertyId: ctx.propertyId,
      action: "UPDATE",
      entityType: "Reservation",
      entityId: id,
      before,
      after,
    });
    eventBus.emit({ type: "booking.updated", entity: "booking", entityId: id, propertyId: ctx.propertyId });
    return after;
  },

  async assignRoom(ctx: AuthContext, id: string, roomId: string): Promise<Reservation> {
    requireCapability(ctx.role, "reservation:write");
    const before = await getOrThrow(id, ctx.propertyId);
    assertMutable(before);
    await assertRoomBookable(ctx, roomId, before.roomTypeId, before.checkInDate, before.checkOutDate, id);
    const after = await reservationsRepository.update(id, { room: { connect: { id: roomId } } });
    await recordAudit({
      actorStaffId: ctx.staffId,
      propertyId: ctx.propertyId,
      action: "STATE_CHANGE",
      entityType: "Reservation",
      entityId: id,
      before,
      after,
      metadata: { operation: "assign-room", roomId },
    });
    eventBus.emit({ type: "booking.room-assigned", entity: "booking", entityId: id, propertyId: ctx.propertyId });
    return after;
  },

  async checkIn(ctx: AuthContext, id: string): Promise<Reservation> {
    return this.transition(ctx, id, "CHECKED_IN", async (r) => {
      if (!r.roomId) throw new ValidationError("Assign a room before check-in");
      if (!["PENDING", "CONFIRMED"].includes(r.status)) {
        throw new ConflictError(`Cannot check in a reservation with status ${r.status}`);
      }
      const room = await reservationsRepository.roomById(r.roomId);
      if (room?.housekeepingStatus === "OUT_OF_ORDER") {
        throw new ConflictError("The assigned room is out of order; assign another room before check-in");
      }
    });
  },

  async checkOut(ctx: AuthContext, id: string): Promise<Reservation> {
    requireCapability(ctx.role, "reservation:write");
    const before = await getOrThrow(id, ctx.propertyId);
    if (before.status !== "CHECKED_IN") {
      throw new ConflictError(`Cannot check out a reservation with status ${before.status}`);
    }
    // Guard before any state change: room/tax charges silently no-op on a closed
    // folio, so checking out against one would lose revenue without a trace.
    const folio = await folioService.findForReservation(id);
    if (folio && folio.status !== "OPEN") {
      throw new ConflictError("The folio for this reservation is already closed; it cannot receive check-out charges");
    }
    const after = await reservationsRepository.update(id, { status: "CHECKED_OUT" });
    await recordAudit({
      actorStaffId: ctx.staffId,
      propertyId: ctx.propertyId,
      action: "STATE_CHANGE",
      entityType: "Reservation",
      entityId: id,
      before,
      after,
      metadata: { from: before.status, to: "CHECKED_OUT" },
    });
    // Auto-charge room nights to the reservation's folio (creates the folio if needed).
    const nights = nightsBetween(before.checkInDate, before.checkOutDate);
    await folioService.postRoomCharges(ctx, {
      reservationId: id,
      guestId: before.guestId,
      nights,
      ratePerNightMinor: before.ratePerNightMinor,
      description: `${before.roomType.name} — ${nights} night(s)`,
    });
    // Accrue the Hungarian tourist tax (IFA) for the stay onto the same folio.
    await folioService.postTouristTax(ctx, {
      reservationId: id,
      guestId: before.guestId,
      adults: before.adults,
      children: before.children,
      nights,
    });
    // The vacated room needs cleaning: flag it dirty and open a housekeeping work order.
    if (before.roomId && before.room) {
      await reservationsRepository.updateRoom(before.roomId, { housekeepingStatus: "DIRTY" });
      eventBus.emit({ type: "room.updated", entity: "room", entityId: before.roomId, propertyId: ctx.propertyId });
      await housekeepingService.openCheckoutCleaning(ctx, { id: before.roomId, number: before.room.number });
    }
    eventBus.emit({ type: "booking.checked-out", entity: "booking", entityId: id, propertyId: ctx.propertyId });
    return after;
  },

  /** Guest never arrived: PENDING/CONFIRMED → NO_SHOW (frees the room for resale). */
  async noShow(ctx: AuthContext, id: string): Promise<Reservation> {
    return this.transition(ctx, id, "NO_SHOW", (r) => {
      if (!["PENDING", "CONFIRMED"].includes(r.status)) {
        throw new ConflictError(`Cannot mark a reservation with status ${r.status} as a no-show`);
      }
    });
  },

  async cancel(ctx: AuthContext, id: string): Promise<Reservation> {
    return this.transition(ctx, id, "CANCELLED", (r) => {
      if (["CHECKED_OUT", "CANCELLED"].includes(r.status)) {
        throw new ConflictError(`Cannot cancel a reservation with status ${r.status}`);
      }
    });
  },

  /** Shared status-transition helper: guard, update status, audit STATE_CHANGE. */
  async transition(
    ctx: AuthContext,
    id: string,
    next: "CHECKED_IN" | "CHECKED_OUT" | "CANCELLED" | "NO_SHOW",
    guard: (r: Reservation) => void | Promise<void>,
  ): Promise<Reservation> {
    requireCapability(ctx.role, "reservation:write");
    const before = await getOrThrow(id, ctx.propertyId);
    await guard(before);
    const after = await reservationsRepository.update(id, { status: next });
    await recordAudit({
      actorStaffId: ctx.staffId,
      propertyId: ctx.propertyId,
      action: "STATE_CHANGE",
      entityType: "Reservation",
      entityId: id,
      before,
      after,
      metadata: { from: before.status, to: next },
    });
    eventBus.emit({ type: `booking.${next.toLowerCase()}`, entity: "booking", entityId: id, propertyId: ctx.propertyId });
    return after;
  },

  /**
   * Booking-grid payload: the full room inventory (rows), every booking overlapping
   * the window (bars), the room-type list (filters) and occupancy for the footer.
   * One read powers the whole resource × time tape-chart.
   */
  async grid(ctx: AuthContext, query: BookingGridQuery) {
    requireCapability(ctx.role, "reservation:read");
    const [rooms, reservations] = await Promise.all([
      reservationsRepository.roomsWithType(ctx.propertyId),
      reservationsRepository.reservationsInWindow(ctx.propertyId, query.from, query.to),
    ]);

    const roomTypes = [...new Map(rooms.map((r) => [r.roomType.id, r.roomType])).values()].sort((a, b) =>
      a.name.localeCompare(b.name),
    );

    const bookings = reservations.map((r) => ({
      id: r.id,
      guestId: r.guestId,
      guestName: `${r.guest.firstName} ${r.guest.lastName}`.trim(),
      roomId: r.roomId,
      roomNumber: r.room?.number ?? null,
      roomTypeId: r.roomTypeId,
      roomTypeName: r.roomType.name,
      checkInDate: r.checkInDate,
      checkOutDate: r.checkOutDate,
      status: r.status,
      adults: r.adults,
      children: r.children,
    }));

    const utilization = computeUtilization(
      reservations.map((r) => ({ roomId: r.roomId, checkInDate: r.checkInDate, checkOutDate: r.checkOutDate })),
      rooms.length,
      query.from,
      query.to,
    );

    return {
      from: query.from,
      to: query.to,
      view: query.view,
      rooms: rooms.map((r) => ({
        id: r.id,
        number: r.number,
        floor: r.floor,
        roomTypeId: r.roomTypeId,
        roomTypeName: r.roomType.name,
        housekeepingStatus: r.housekeepingStatus,
      })),
      roomTypes,
      bookings,
      utilization,
    };
  },

  async listRoomTypes(ctx: AuthContext) {
    requireCapability(ctx.role, "reservation:read");
    return reservationsRepository.listRoomTypes(ctx.propertyId);
  },

  // ---- Room-type & room management (property:manage) ----

  async createRoomType(ctx: AuthContext, input: CreateRoomTypeInput) {
    requireCapability(ctx.role, "property:manage");
    const rt = await reservationsRepository.createRoomType({ propertyId: ctx.propertyId, ...input });
    await recordAudit({ actorStaffId: ctx.staffId, propertyId: ctx.propertyId, action: "CREATE", entityType: "RoomType", entityId: rt.id, after: rt });
    eventBus.emit({ type: "room.type-created", entity: "room", entityId: rt.id, propertyId: ctx.propertyId });
    return rt;
  },

  async updateRoomType(ctx: AuthContext, id: string, input: UpdateRoomTypeInput) {
    requireCapability(ctx.role, "property:manage");
    const before = await reservationsRepository.roomTypeById(id);
    if (!before || before.propertyId !== ctx.propertyId) throw new NotFoundError("Room type not found");
    const after = await reservationsRepository.updateRoomType(id, input);
    await recordAudit({ actorStaffId: ctx.staffId, propertyId: ctx.propertyId, action: "UPDATE", entityType: "RoomType", entityId: id, before, after });
    eventBus.emit({ type: "room.type-updated", entity: "room", entityId: id, propertyId: ctx.propertyId });
    return after;
  },

  async createRoom(ctx: AuthContext, input: CreateRoomInput) {
    requireCapability(ctx.role, "property:manage");
    const roomType = await reservationsRepository.roomTypeById(input.roomTypeId);
    if (!roomType || roomType.propertyId !== ctx.propertyId) throw new NotFoundError("Room type not found");
    const room = await reservationsRepository.createRoom({ propertyId: ctx.propertyId, ...input });
    await recordAudit({ actorStaffId: ctx.staffId, propertyId: ctx.propertyId, action: "CREATE", entityType: "Room", entityId: room.id, after: room });
    eventBus.emit({ type: "room.created", entity: "room", entityId: room.id, propertyId: ctx.propertyId });
    return room;
  },

  async updateRoom(ctx: AuthContext, id: string, input: UpdateRoomInput) {
    requireCapability(ctx.role, "property:manage");
    const before = await reservationsRepository.roomById(id);
    if (!before || before.propertyId !== ctx.propertyId) throw new NotFoundError("Room not found");
    if (input.roomTypeId) {
      const rt = await reservationsRepository.roomTypeById(input.roomTypeId);
      if (!rt || rt.propertyId !== ctx.propertyId) throw new NotFoundError("Room type not found");
    }
    const after = await reservationsRepository.updateRoom(id, input);
    await recordAudit({ actorStaffId: ctx.staffId, propertyId: ctx.propertyId, action: "UPDATE", entityType: "Room", entityId: id, before, after });
    eventBus.emit({ type: "room.updated", entity: "room", entityId: id, propertyId: ctx.propertyId });
    return after;
  },

  async deleteRoom(ctx: AuthContext, id: string): Promise<void> {
    requireCapability(ctx.role, "property:manage");
    const before = await reservationsRepository.roomById(id);
    if (!before || before.propertyId !== ctx.propertyId) throw new NotFoundError("Room not found");
    const used = await reservationsRepository.countRoomReservations(id);
    if (used > 0) throw new ConflictError("Cannot delete a room that has reservations; mark it out of order instead");
    await reservationsRepository.deleteRoom(id);
    await recordAudit({ actorStaffId: ctx.staffId, propertyId: ctx.propertyId, action: "DELETE", entityType: "Room", entityId: id, before });
    eventBus.emit({ type: "room.deleted", entity: "room", entityId: id, propertyId: ctx.propertyId });
  },

  async listRooms(ctx: AuthContext) {
    requireCapability(ctx.role, "reservation:read");
    return reservationsRepository.roomsByType(ctx.propertyId);
  },

  /**
   * Cross-module interface (no RBAC): validate that a reservation can host new
   * guest activity (an appointment that will later bill to its folio). Ensures the
   * stay exists in this property, belongs to THIS guest, and is not finished —
   * otherwise a completed treatment would post its charge to someone else's bill
   * or to a stay that can no longer receive charges.
   */
  async requireActiveStay(propertyId: string, reservationId: string, guestId: string): Promise<Reservation> {
    const reservation = await reservationsRepository.findById(reservationId);
    if (!reservation || reservation.propertyId !== propertyId) throw new NotFoundError("Reservation not found");
    if (reservation.guestId !== guestId) {
      throw new ValidationError("Reservation belongs to a different guest");
    }
    if (!["PENDING", "CONFIRMED", "CHECKED_IN"].includes(reservation.status)) {
      throw new ConflictError(`Cannot link to a reservation with status ${reservation.status}`);
    }
    return reservation;
  },

  /** Rooms of the requested type with no blocking reservation overlapping [from, to). */
  async availability(ctx: AuthContext, query: AvailabilityQuery) {
    requireCapability(ctx.role, "reservation:read");
    const rooms = await reservationsRepository.roomsByType(ctx.propertyId, query.roomTypeId);
    const roomIds = rooms.map((r) => r.id);
    const blocking = roomIds.length
      ? await reservationsRepository.findBlockingForRooms(roomIds, query.from, query.to)
      : [];
    const blockedRoomIds = new Set(blocking.map((b) => b.roomId).filter(Boolean) as string[]);
    const available = rooms.filter((r) => !blockedRoomIds.has(r.id));
    return { from: query.from, to: query.to, available, total: available.length };
  },
};
