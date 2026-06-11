import { z } from "zod";

const dateRange = {
  checkInDate: z.coerce.date(),
  checkOutDate: z.coerce.date(),
};

export const createReservationSchema = z
  .object({
    guestId: z.string().min(1),
    roomTypeId: z.string().min(1),
    roomId: z.string().min(1).optional(),
    ...dateRange,
    adults: z.number().int().min(1).default(1),
    children: z.number().int().min(0).default(0),
    ratePerNightMinor: z.number().int().min(0).optional(),
    notes: z.string().optional(),
  })
  .refine((v) => v.checkOutDate > v.checkInDate, {
    message: "checkOutDate must be after checkInDate",
    path: ["checkOutDate"],
  });

export const updateReservationSchema = z.object({
  checkInDate: z.coerce.date().optional(),
  checkOutDate: z.coerce.date().optional(),
  adults: z.number().int().min(1).optional(),
  children: z.number().int().min(0).optional(),
  ratePerNightMinor: z.number().int().min(0).optional(),
  notes: z.string().optional(),
});

export const assignRoomSchema = z.object({
  roomId: z.string().min(1),
});

export const availabilityQuerySchema = z
  .object({
    from: z.coerce.date(),
    to: z.coerce.date(),
    roomTypeId: z.string().min(1).optional(),
  })
  .refine((v) => v.to > v.from, { message: "to must be after from", path: ["to"] });

export const listReservationsQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
    status: z
      .enum(["PENDING", "CONFIRMED", "CHECKED_IN", "CHECKED_OUT", "CANCELLED", "NO_SHOW"])
      .optional(),
    roomId: z.string().min(1).optional(),
    guestId: z.string().min(1).optional(),
    // Calendar window: when both are given, return reservations overlapping [from, to).
    from: z.coerce.date().optional(),
    to: z.coerce.date().optional(),
  })
  .refine((v) => !(v.from && v.to) || v.to > v.from, {
    message: "to must be after from",
    path: ["to"],
  })
  .refine((v) => (v.from ? !!v.to : !v.to), {
    message: "from and to must be provided together",
    path: ["from"],
  });

// ---- Room-type & room management (Hotel Management page) ----

export const createRoomTypeSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  basePriceMinor: z.number().int().min(0),
  maxOccupancy: z.number().int().min(1).max(20).default(2),
});
export const updateRoomTypeSchema = createRoomTypeSchema.partial();

export const HOUSEKEEPING_STATES = ["CLEAN", "DIRTY", "INSPECTED", "OUT_OF_ORDER"] as const;

const roomPlacement = {
  floor: z.number().int().optional(),
  posX: z.number().int().min(0).optional(),
  posY: z.number().int().min(0).optional(),
  width: z.number().int().min(1).max(20).optional(),
  height: z.number().int().min(1).max(20).optional(),
};

export const createRoomSchema = z.object({
  number: z.string().min(1),
  roomTypeId: z.string().min(1),
  ...roomPlacement,
});

export const updateRoomSchema = z.object({
  number: z.string().min(1).optional(),
  roomTypeId: z.string().min(1).optional(),
  housekeepingStatus: z.enum(HOUSEKEEPING_STATES).optional(),
  ...roomPlacement,
});

export type CreateRoomTypeInput = z.infer<typeof createRoomTypeSchema>;
export type UpdateRoomTypeInput = z.infer<typeof updateRoomTypeSchema>;
export type CreateRoomInput = z.infer<typeof createRoomSchema>;
export type UpdateRoomInput = z.infer<typeof updateRoomSchema>;

export const bookingGridQuerySchema = z
  .object({
    from: z.coerce.date(),
    to: z.coerce.date(),
    view: z.enum(["day", "week"]).default("week"),
  })
  .refine((v) => v.to > v.from, { message: "to must be after from", path: ["to"] });

export type BookingGridQuery = z.infer<typeof bookingGridQuerySchema>;
export type CreateReservationInput = z.infer<typeof createReservationSchema>;
export type UpdateReservationInput = z.infer<typeof updateReservationSchema>;
export type AssignRoomInput = z.infer<typeof assignRoomSchema>;
export type AvailabilityQuery = z.infer<typeof availabilityQuerySchema>;
export type ListReservationsQuery = z.infer<typeof listReservationsQuerySchema>;
