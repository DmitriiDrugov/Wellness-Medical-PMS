import type { Prisma, Reservation, Room, RoomType, ReservationStatus } from "@prisma/client";
import { prisma } from "@/platform/db";
import { BLOCKING_RESERVATION_STATUSES } from "@/modules/reservations/overlap";

const BLOCKING = BLOCKING_RESERVATION_STATUSES as unknown as ReservationStatus[];

/**
 * Reservations module repository — owns the Reservation, Room and RoomType tables
 * (hotel room inventory is part of the reservations domain).
 */
export const reservationsRepository = {
  create(data: Prisma.ReservationCreateInput): Promise<Reservation> {
    return prisma.reservation.create({ data });
  },

  findById(id: string) {
    return prisma.reservation.findUnique({
      where: { id },
      include: { guest: true, room: true, roomType: true },
    });
  },

  async list(params: {
    propertyId: string;
    skip: number;
    take: number;
    status?: ReservationStatus;
    roomId?: string;
    from?: Date;
    to?: Date;
  }) {
    const where: Prisma.ReservationWhereInput = {
      propertyId: params.propertyId,
      ...(params.status ? { status: params.status } : {}),
      ...(params.roomId ? { roomId: params.roomId } : {}),
      // Half-open overlap with the requested [from, to) window.
      ...(params.from && params.to
        ? { checkInDate: { lt: params.to }, checkOutDate: { gt: params.from } }
        : {}),
    };
    const [items, total] = await Promise.all([
      prisma.reservation.findMany({
        where,
        skip: params.skip,
        take: params.take,
        orderBy: { checkInDate: "desc" },
        include: { guest: true, room: true, roomType: true },
      }),
      prisma.reservation.count({ where }),
    ]);
    return { items, total };
  },

  update(id: string, data: Prisma.ReservationUpdateInput): Promise<Reservation> {
    return prisma.reservation.update({ where: { id }, data });
  },

  /** Reservations occupying `roomId` that overlap [checkIn, checkOut), excluding one id. */
  findConflicting(roomId: string, checkIn: Date, checkOut: Date, excludeId?: string): Promise<Reservation[]> {
    return prisma.reservation.findMany({
      where: {
        roomId,
        status: { in: BLOCKING },
        ...(excludeId ? { id: { not: excludeId } } : {}),
        checkInDate: { lt: checkOut },
        checkOutDate: { gt: checkIn },
      },
    });
  },

  roomById(id: string): Promise<Room | null> {
    return prisma.room.findUnique({ where: { id } });
  },

  roomTypeById(id: string): Promise<RoomType | null> {
    return prisma.roomType.findUnique({ where: { id } });
  },

  listRoomTypes(propertyId: string): Promise<RoomType[]> {
    return prisma.roomType.findMany({ where: { propertyId }, orderBy: { name: "asc" } });
  },

  roomsByType(propertyId: string, roomTypeId?: string): Promise<Room[]> {
    return prisma.room.findMany({
      where: { propertyId, ...(roomTypeId ? { roomTypeId } : {}) },
      orderBy: { number: "asc" },
    });
  },

  /** All rooms with their type — the row inventory for the booking grid. */
  roomsWithType(propertyId: string) {
    return prisma.room.findMany({
      where: { propertyId },
      orderBy: [{ floor: "asc" }, { number: "asc" }],
      include: { roomType: { select: { id: true, name: true } } },
    });
  },

  /** Reservations overlapping [from, to) for the booking grid (guest + room + type). */
  reservationsInWindow(propertyId: string, from: Date, to: Date) {
    return prisma.reservation.findMany({
      where: {
        propertyId,
        status: { notIn: ["CANCELLED", "NO_SHOW"] },
        checkInDate: { lt: to },
        checkOutDate: { gt: from },
      },
      orderBy: { checkInDate: "asc" },
      include: {
        guest: { select: { id: true, firstName: true, lastName: true } },
        room: { select: { id: true, number: true } },
        roomType: { select: { id: true, name: true } },
      },
    });
  },

  /** All blocking reservations overlapping [from, to) for the given rooms. */
  findBlockingForRooms(roomIds: string[], from: Date, to: Date): Promise<Reservation[]> {
    return prisma.reservation.findMany({
      where: {
        roomId: { in: roomIds },
        status: { in: BLOCKING },
        checkInDate: { lt: to },
        checkOutDate: { gt: from },
      },
    });
  },
};
