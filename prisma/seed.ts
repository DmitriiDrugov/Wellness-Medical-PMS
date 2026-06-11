import crypto from "node:crypto";
import { Prisma, PrismaClient, type StaffRole } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

/**
 * Demo seed for the Medical-Wellness PMS.
 *
 * The dataset is intentionally journey-shaped:
 * - a real property with tax settings and an editable map inventory;
 * - staff for every role, including the AI receptionist principal;
 * - rooms, areas, housekeeping tasks and room cleanliness states;
 * - guests in different lifecycle stages: checked-in, upcoming, checked-out,
 *   no-show, cancelled, and outpatient;
 * - linked reservations, folios, payments, treatments, clinical records,
 *   guest portal accounts, conversations and compliance events.
 *
 * Re-running this script wipes the database and recreates the demo scenario.
 *
 * Demo staff password: $SEED_ADMIN_PASSWORD (default "Passw0rd!").
 * Demo guest login: guest@demo.test / same password.
 */

const ADMIN_EMAIL = "admin@hotel.example";
const DEMO_PASSWORD = process.env.SEED_ADMIN_PASSWORD ?? "Passw0rd!";
const DAY_MS = 24 * 60 * 60 * 1000;

function huf(amount: number): number {
  return amount * 100;
}

function hashToken(raw: string): string {
  return crypto.createHash("sha256").update(raw).digest("hex");
}

function day(offsetDays = 0, hour = 0, minute = 0): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() + offsetDays, hour, minute, 0, 0);
}

function nightsBetween(checkIn: Date, checkOut: Date): number {
  return Math.max(0, Math.round((checkOut.getTime() - checkIn.getTime()) / DAY_MS));
}

function endAt(start: Date, minutes: number): Date {
  return new Date(start.getTime() + minutes * 60_000);
}

function isoDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

async function clear() {
  // Delete in FK-safe order (children first).
  await prisma.treatmentRecord.deleteMany();
  await prisma.intakeFormSubmission.deleteMany();
  await prisma.consent.deleteMany();
  await prisma.formTemplate.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.complianceEvent.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.folioLineItem.deleteMany();
  await prisma.folio.deleteMany();
  await prisma.treatmentAppointment.deleteMany();
  await prisma.packageItem.deleteMany();
  await prisma.servicePackage.deleteMany();
  await prisma.treatment.deleteMany();
  await prisma.resource.deleteMany();
  await prisma.housekeepingTask.deleteMany();
  await prisma.reservation.deleteMany();
  await prisma.room.deleteMany();
  await prisma.roomType.deleteMany();
  await prisma.propertyArea.deleteMany();
  await prisma.refreshToken.deleteMany();
  await prisma.message.deleteMany();
  await prisma.conversation.deleteMany();
  await prisma.guestDocument.deleteMany();
  await prisma.medicalProfile.deleteMany();
  await prisma.guestAccount.deleteMany();
  await prisma.guest.deleteMany();
  await prisma.staff.deleteMany();
  await prisma.property.deleteMany();
}

async function audit(data: Prisma.AuditLogUncheckedCreateInput) {
  await prisma.auditLog.create({ data });
}

async function main() {
  await clear();

  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);

  const property = await prisma.property.create({
    data: {
      name: "Thermal Wellness Hotel",
      legalName: "Thermal Wellness Kft.",
      taxNumber: "12345678-2-42",
      ntakRegNumber: "MA19000123",
      addressLine: "Furdo utca 1.",
      city: "Heviz",
      postalCode: "8380",
      country: "HU",
      timezone: "Europe/Budapest",
      currency: "HUF",
      touristTaxPerPersonPerNightMinor: huf(500),
      touristTaxAppliesToChildren: false,
      createdAt: day(-120, 9),
    },
  });

  const createStaff = (input: {
    email: string;
    role: StaffRole;
    firstName: string;
    lastName: string;
    isActive?: boolean;
  }) =>
    prisma.staff.create({
      data: {
        propertyId: property.id,
        email: input.email,
        passwordHash,
        role: input.role,
        firstName: input.firstName,
        lastName: input.lastName,
        isActive: input.isActive ?? true,
      },
    });

  const admin = await createStaff({ email: ADMIN_EMAIL, role: "ADMIN", firstName: "System", lastName: "Admin" });
  const manager = await createStaff({ email: "manager@hotel.example", role: "MANAGER", firstName: "Katalin", lastName: "Nagy" });
  const reception = await createStaff({ email: "reception@hotel.example", role: "RECEPTION", firstName: "Dora", lastName: "Kiss" });
  const reservationAdmin = await createStaff({
    email: "reservations@hotel.example",
    role: "RESERVATION_ADMIN",
    firstName: "Peter",
    lastName: "Horvath",
  });
  const therapistClara = await createStaff({
    email: "clara.therapist@hotel.example",
    role: "THERAPIST",
    firstName: "Clara",
    lastName: "Farkas",
  });
  const therapistMate = await createStaff({
    email: "mate.therapist@hotel.example",
    role: "THERAPIST",
    firstName: "Mate",
    lastName: "Toth",
  });
  const therapistNoemi = await createStaff({
    email: "noemi.therapist@hotel.example",
    role: "THERAPIST",
    firstName: "Noemi",
    lastName: "Balogh",
  });
  const therapistBalazs = await createStaff({
    email: "balazs.therapist@hotel.example",
    role: "THERAPIST",
    firstName: "Balazs",
    lastName: "Varga",
  });
  const housekeeperEva = await createStaff({
    email: "housekeeping@hotel.example",
    role: "HOUSEKEEPING",
    firstName: "Eva",
    lastName: "Szabo",
  });
  const housekeeperLaszlo = await createStaff({
    email: "laszlo.housekeeping@hotel.example",
    role: "HOUSEKEEPING",
    firstName: "Laszlo",
    lastName: "Molnar",
  });
  const aiAgent = await createStaff({
    email: "ai.reception@hotel.example",
    role: "AI_AGENT",
    firstName: "AI",
    lastName: "Receptionist",
  });
  await createStaff({
    email: "inactive.therapist@hotel.example",
    role: "THERAPIST",
    firstName: "Former",
    lastName: "Colleague",
    isActive: false,
  });

  const classic = await prisma.roomType.create({
    data: {
      propertyId: property.id,
      name: "Classic Twin",
      description: "Standard hotel room for short wellness stays.",
      basePriceMinor: huf(38000),
      maxOccupancy: 2,
    },
  });
  const medical = await prisma.roomType.create({
    data: {
      propertyId: property.id,
      name: "Medical Wellness Room",
      description: "Quiet room near the treatment wing for longer rehabilitation stays.",
      basePriceMinor: huf(48000),
      maxOccupancy: 2,
    },
  });
  const suite = await prisma.roomType.create({
    data: {
      propertyId: property.id,
      name: "Thermal Suite",
      description: "Large suite with balcony and direct thermal spa access.",
      basePriceMinor: huf(72000),
      maxOccupancy: 4,
    },
  });

  const rooms = {
    r101: await prisma.room.create({
      data: {
        propertyId: property.id,
        number: "101",
        roomTypeId: medical.id,
        floor: 1,
        housekeepingStatus: "INSPECTED",
        posX: 1,
        posY: 1,
        width: 2,
        height: 2,
      },
    }),
    r102: await prisma.room.create({
      data: {
        propertyId: property.id,
        number: "102",
        roomTypeId: classic.id,
        floor: 1,
        housekeepingStatus: "DIRTY",
        posX: 4,
        posY: 1,
        width: 2,
        height: 2,
      },
    }),
    r103: await prisma.room.create({
      data: {
        propertyId: property.id,
        number: "103",
        roomTypeId: classic.id,
        floor: 1,
        housekeepingStatus: "CLEAN",
        posX: 7,
        posY: 1,
        width: 2,
        height: 2,
      },
    }),
    r104: await prisma.room.create({
      data: {
        propertyId: property.id,
        number: "104",
        roomTypeId: medical.id,
        floor: 1,
        housekeepingStatus: "CLEAN",
        posX: 10,
        posY: 1,
        width: 2,
        height: 2,
      },
    }),
    r201: await prisma.room.create({
      data: {
        propertyId: property.id,
        number: "201",
        roomTypeId: suite.id,
        floor: 2,
        housekeepingStatus: "CLEAN",
        posX: 1,
        posY: 5,
        width: 3,
        height: 2,
      },
    }),
    r202: await prisma.room.create({
      data: {
        propertyId: property.id,
        number: "202",
        roomTypeId: suite.id,
        floor: 2,
        housekeepingStatus: "INSPECTED",
        posX: 5,
        posY: 5,
        width: 3,
        height: 2,
      },
    }),
    r203: await prisma.room.create({
      data: {
        propertyId: property.id,
        number: "203",
        roomTypeId: classic.id,
        floor: 2,
        housekeepingStatus: "CLEAN",
        posX: 9,
        posY: 5,
        width: 2,
        height: 2,
      },
    }),
    r204: await prisma.room.create({
      data: {
        propertyId: property.id,
        number: "204",
        roomTypeId: medical.id,
        floor: 2,
        housekeepingStatus: "CLEAN",
        posX: 12,
        posY: 5,
        width: 2,
        height: 2,
      },
    }),
    r301: await prisma.room.create({
      data: {
        propertyId: property.id,
        number: "301",
        roomTypeId: suite.id,
        floor: 3,
        housekeepingStatus: "OUT_OF_ORDER",
        posX: 1,
        posY: 9,
        width: 3,
        height: 2,
      },
    }),
    r302: await prisma.room.create({
      data: {
        propertyId: property.id,
        number: "302",
        roomTypeId: suite.id,
        floor: 3,
        housekeepingStatus: "INSPECTED",
        posX: 5,
        posY: 9,
        width: 3,
        height: 2,
      },
    }),
  };

  const lobby = await prisma.propertyArea.create({
    data: {
      propertyId: property.id,
      name: "Lobby and Reception",
      kind: "COMMON",
      floor: 0,
      posX: 1,
      posY: 13,
      width: 5,
      height: 2,
      notes: "Guest arrival, luggage staging, and front desk queue.",
    },
  });
  const thermalPool = await prisma.propertyArea.create({
    data: {
      propertyId: property.id,
      name: "Thermal Pool",
      kind: "POOL",
      floor: 0,
      posX: 7,
      posY: 13,
      width: 4,
      height: 3,
      notes: "High-priority hygiene area checked twice daily.",
    },
  });
  const spaCorridor = await prisma.propertyArea.create({
    data: {
      propertyId: property.id,
      name: "Treatment Corridor",
      kind: "SPA",
      floor: 1,
      posX: 13,
      posY: 1,
      width: 2,
      height: 6,
      notes: "Connects treatment rooms, hydrotherapy and consultation area.",
    },
  });
  const restaurant = await prisma.propertyArea.create({
    data: {
      propertyId: property.id,
      name: "Breakfast Restaurant",
      kind: "RESTAURANT",
      floor: 0,
      posX: 12,
      posY: 13,
      width: 4,
      height: 3,
      notes: "Morning service and dietary meal handoff.",
    },
  });

  const consultation = await prisma.treatment.create({
    data: {
      propertyId: property.id,
      name: "Medical Consultation",
      description: "Initial physician review and wellness plan.",
      durationMinutes: 30,
      priceMinor: huf(18000),
      requiredResourceType: "TREATMENT_ROOM",
    },
  });
  const massage = await prisma.treatment.create({
    data: {
      propertyId: property.id,
      name: "Therapeutic Massage",
      description: "Medical-wellness massage for mobility and pain relief.",
      durationMinutes: 50,
      priceMinor: huf(21500),
      requiredResourceType: "TREATMENT_ROOM",
    },
  });
  const mudPack = await prisma.treatment.create({
    data: {
      propertyId: property.id,
      name: "Thermal Mud Pack",
      description: "Local thermal mud application with recovery rest.",
      durationMinutes: 45,
      priceMinor: huf(19500),
      requiredResourceType: "TREATMENT_ROOM",
    },
  });
  const hydrotherapy = await prisma.treatment.create({
    data: {
      propertyId: property.id,
      name: "Hydrotherapy Bath",
      description: "Supervised mineral bath session.",
      durationMinutes: 30,
      priceMinor: huf(16000),
      requiredResourceType: "TREATMENT_ROOM",
    },
  });
  const physiotherapy = await prisma.treatment.create({
    data: {
      propertyId: property.id,
      name: "Physiotherapy Session",
      description: "Guided rehabilitation exercise session.",
      durationMinutes: 45,
      priceMinor: huf(24000),
      requiredResourceType: "TREATMENT_ROOM",
    },
  });
  const deviceTherapy = await prisma.treatment.create({
    data: {
      propertyId: property.id,
      name: "Electrotherapy Device Session",
      description: "Equipment-based therapy slot.",
      durationMinutes: 30,
      priceMinor: huf(14500),
      requiredResourceType: "EQUIPMENT",
    },
  });

  const treatmentRoomA = await prisma.resource.create({
    data: { propertyId: property.id, name: "Treatment Room A", type: "TREATMENT_ROOM", capacity: 1 },
  });
  const treatmentRoomB = await prisma.resource.create({
    data: { propertyId: property.id, name: "Treatment Room B", type: "TREATMENT_ROOM", capacity: 1 },
  });
  const hydroCabin = await prisma.resource.create({
    data: { propertyId: property.id, name: "Hydrotherapy Cabin", type: "TREATMENT_ROOM", capacity: 1 },
  });
  const electroDevice = await prisma.resource.create({
    data: { propertyId: property.id, name: "Electrotherapy Device", type: "EQUIPMENT", capacity: 1 },
  });

  const rehabPackage = await prisma.servicePackage.create({
    data: {
      propertyId: property.id,
      name: "Rehabilitation Starter",
      description: "Consultation, physiotherapy and two massage sessions for longer stays.",
      priceMinor: huf(99000),
      items: {
        create: [
          { treatment: { connect: { id: consultation.id } }, quantity: 1 },
          { treatment: { connect: { id: physiotherapy.id } }, quantity: 2 },
          { treatment: { connect: { id: massage.id } }, quantity: 2 },
        ],
      },
    },
  });
  const detoxPackage = await prisma.servicePackage.create({
    data: {
      propertyId: property.id,
      name: "Thermal Detox Weekend",
      description: "Mud pack, hydrotherapy and therapeutic massage for a weekend stay.",
      priceMinor: huf(65000),
      items: {
        create: [
          { treatment: { connect: { id: mudPack.id } }, quantity: 1 },
          { treatment: { connect: { id: hydrotherapy.id } }, quantity: 2 },
          { treatment: { connect: { id: massage.id } }, quantity: 1 },
        ],
      },
    },
  });

  const anna = await prisma.guest.create({
    data: {
      firstName: "Anna",
      lastName: "Varga",
      email: "anna.varga@example.com",
      phone: "+36 30 111 2222",
      nationality: "HU",
      dateOfBirth: day(-14900),
      idDocumentType: "NATIONAL_ID",
      idDocumentNumber: "HU-AV-884211",
      idDocumentExpiry: day(900),
      placeOfBirth: "Budapest",
      gender: "F",
      addressLine: "Fo utca 12.",
      city: "Budapest",
      postalCode: "1051",
      country: "HU",
      gdprConsentDataProcessing: true,
      gdprConsentMarketing: true,
      gdprConsentAt: day(-20, 10),
    },
  });
  const markus = await prisma.guest.create({
    data: {
      firstName: "Markus",
      lastName: "Schneider",
      email: "markus.schneider@example.com",
      phone: "+49 151 222 333",
      nationality: "DE",
      dateOfBirth: day(-18000),
      idDocumentType: "PASSPORT",
      idDocumentNumber: "C01X88421",
      idDocumentExpiry: day(640),
      placeOfBirth: "Munich",
      gender: "M",
      addressLine: "Rosenstrasse 18",
      city: "Munich",
      postalCode: "80331",
      country: "DE",
      gdprConsentDataProcessing: true,
      gdprConsentMarketing: false,
      gdprConsentAt: day(-5, 11),
    },
  });
  const julia = await prisma.guest.create({
    data: {
      firstName: "Julia",
      lastName: "Novak",
      email: "julia.novak@example.com",
      phone: "+43 660 123 456",
      nationality: "AT",
      dateOfBirth: day(-13500),
      idDocumentType: "PASSPORT",
      idDocumentNumber: "P-AT-99123",
      idDocumentExpiry: day(1200),
      placeOfBirth: "Graz",
      gender: "F",
      addressLine: "Parkring 7",
      city: "Vienna",
      postalCode: "1010",
      country: "AT",
      gdprConsentDataProcessing: true,
      gdprConsentMarketing: false,
      gdprConsentAt: day(-12, 15),
    },
  });
  const sofia = await prisma.guest.create({
    data: {
      firstName: "Sofia",
      lastName: "Rossi",
      email: "sofia.rossi@example.com",
      phone: "+39 333 456 789",
      nationality: "IT",
      dateOfBirth: day(-11000),
      idDocumentType: "PASSPORT",
      idDocumentNumber: "YA4459211",
      idDocumentExpiry: day(720),
      placeOfBirth: "Bologna",
      gender: "F",
      addressLine: "Via Roma 44",
      city: "Bologna",
      postalCode: "40121",
      country: "IT",
      gdprConsentDataProcessing: true,
      gdprConsentMarketing: true,
      gdprConsentAt: day(-1, 17),
    },
  });
  const peterGuest = await prisma.guest.create({
    data: {
      firstName: "Peter",
      lastName: "Toth",
      email: "peter.toth@example.com",
      phone: "+36 20 777 8888",
      nationality: "HU",
      dateOfBirth: day(-16200),
      idDocumentType: "NATIONAL_ID",
      idDocumentNumber: "HU-PT-11220",
      idDocumentExpiry: day(500),
      placeOfBirth: "Pecs",
      gender: "M",
      addressLine: "Kossuth utca 3.",
      city: "Pecs",
      postalCode: "7621",
      country: "HU",
      gdprConsentDataProcessing: true,
      gdprConsentMarketing: false,
      gdprConsentAt: day(-8, 13),
    },
  });
  const elena = await prisma.guest.create({
    data: {
      firstName: "Elena",
      lastName: "Petrova",
      email: "elena.petrova@example.com",
      phone: "+420 777 444 111",
      nationality: "CZ",
      dateOfBirth: day(-15600),
      idDocumentType: "PASSPORT",
      idDocumentNumber: "CZ778812",
      idDocumentExpiry: day(1000),
      placeOfBirth: "Prague",
      gender: "F",
      city: "Prague",
      country: "CZ",
      gdprConsentDataProcessing: true,
      gdprConsentMarketing: false,
      gdprConsentAt: day(-4, 9),
    },
  });
  const david = await prisma.guest.create({
    data: {
      firstName: "David",
      lastName: "Chen",
      email: "david.chen@example.com",
      phone: "+36 30 987 6543",
      nationality: "US",
      dateOfBirth: day(-14200),
      idDocumentType: "PASSPORT",
      idDocumentNumber: "US74829931",
      idDocumentExpiry: day(1500),
      placeOfBirth: "Seattle",
      gender: "M",
      city: "Budapest",
      country: "HU",
      gdprConsentDataProcessing: true,
      gdprConsentMarketing: false,
      gdprConsentAt: day(-2, 16),
    },
  });

  await prisma.medicalProfile.createMany({
    data: [
      {
        guestId: anna.id,
        dietaryNotes: "Low-sodium menu requested.",
        allergies: "Penicillin.",
        contraindications: "Avoid high-heat sauna after hydrotherapy.",
        currentMedications: "ACE inhibitor, morning dose.",
        prescriptions: "Physio exercises twice daily.",
        mobilityNotes: "Mild knee stiffness on stairs.",
        generalNotes: "Checked-in rehab stay; prefers morning treatments.",
        updatedByStaffId: therapistClara.id,
      },
      {
        guestId: markus.id,
        dietaryNotes: "Vegetarian breakfast.",
        allergies: "None declared.",
        contraindications: "Review blood pressure before mud pack.",
        currentMedications: "Occasional anti-inflammatory.",
        prescriptions: "Bring prior MRI report.",
        mobilityNotes: "Shoulder mobility limitation.",
        generalNotes: "Upcoming package guest; needs consultation on arrival.",
        updatedByStaffId: therapistMate.id,
      },
      {
        guestId: julia.id,
        dietaryNotes: "Gluten-free.",
        allergies: "Latex sensitivity.",
        contraindications: "No electrotherapy near implanted device.",
        currentMedications: "Levothyroxine.",
        prescriptions: null,
        mobilityNotes: "No assistance required.",
        generalNotes: "Completed stay with signed treatment record.",
        updatedByStaffId: therapistNoemi.id,
      },
    ],
  });

  await prisma.guestDocument.createMany({
    data: [
      {
        guestId: anna.id,
        kind: "PASSPORT",
        label: "National ID scan",
        externalRef: "demo-docs/anna-varga-national-id.pdf",
        uploadedByStaffId: reception.id,
        createdAt: day(-1, 10),
      },
      {
        guestId: anna.id,
        kind: "MEDICAL_REPORT",
        label: "Orthopedic referral",
        externalRef: "demo-docs/anna-varga-orthopedic-referral.pdf",
        uploadedByStaffId: therapistClara.id,
        createdAt: day(-1, 11),
      },
      {
        guestId: markus.id,
        kind: "PRESCRIPTION",
        label: "Physiotherapy prescription",
        externalRef: "demo-docs/markus-schneider-physio-prescription.pdf",
        uploadedByStaffId: reception.id,
        createdAt: day(-1, 14),
      },
      {
        guestId: julia.id,
        kind: "CONSENT",
        label: "Signed treatment consent",
        externalRef: "demo-docs/julia-novak-treatment-consent.pdf",
        uploadedByStaffId: reception.id,
        createdAt: day(-5, 15),
      },
    ],
  });

  const annaReservation = await prisma.reservation.create({
    data: {
      propertyId: property.id,
      guestId: anna.id,
      roomTypeId: medical.id,
      roomId: rooms.r101.id,
      checkInDate: day(-1),
      checkOutDate: day(4),
      status: "CHECKED_IN",
      adults: 1,
      children: 0,
      ratePerNightMinor: medical.basePriceMinor,
      notes: "Rehabilitation stay. Morning treatments preferred.",
      createdAt: day(-10, 9),
    },
  });
  const juliaReservation = await prisma.reservation.create({
    data: {
      propertyId: property.id,
      guestId: julia.id,
      roomTypeId: classic.id,
      roomId: rooms.r102.id,
      checkInDate: day(-5),
      checkOutDate: day(-1),
      status: "CHECKED_OUT",
      adults: 2,
      children: 0,
      ratePerNightMinor: classic.basePriceMinor,
      notes: "Checked out; folio closed and room awaits checkout cleaning.",
      createdAt: day(-18, 10),
    },
  });
  const markusReservation = await prisma.reservation.create({
    data: {
      propertyId: property.id,
      guestId: markus.id,
      roomTypeId: suite.id,
      roomId: rooms.r201.id,
      checkInDate: day(1),
      checkOutDate: day(5),
      status: "CONFIRMED",
      adults: 2,
      children: 1,
      ratePerNightMinor: suite.basePriceMinor,
      notes: "Thermal Detox Weekend package; child is tourist-tax exempt.",
      createdAt: day(-3, 12),
    },
  });
  const sofiaReservation = await prisma.reservation.create({
    data: {
      propertyId: property.id,
      guestId: sofia.id,
      roomTypeId: classic.id,
      roomId: rooms.r103.id,
      checkInDate: day(3),
      checkOutDate: day(6),
      status: "PENDING",
      adults: 1,
      children: 0,
      ratePerNightMinor: classic.basePriceMinor,
      notes: "AI-originated enquiry, awaiting deposit confirmation.",
      createdAt: day(-1, 18),
    },
  });
  const peterNoShowReservation = await prisma.reservation.create({
    data: {
      propertyId: property.id,
      guestId: peterGuest.id,
      roomTypeId: medical.id,
      roomId: rooms.r204.id,
      checkInDate: day(-1),
      checkOutDate: day(2),
      status: "NO_SHOW",
      adults: 1,
      children: 0,
      ratePerNightMinor: medical.basePriceMinor,
      notes: "Marked no-show; room is free for resale.",
      createdAt: day(-9, 16),
    },
  });
  const elenaCancelledReservation = await prisma.reservation.create({
    data: {
      propertyId: property.id,
      guestId: elena.id,
      roomTypeId: suite.id,
      checkInDate: day(2),
      checkOutDate: day(4),
      status: "CANCELLED",
      adults: 2,
      children: 0,
      ratePerNightMinor: suite.basePriceMinor,
      notes: "Cancelled due to travel change; kept for audit/lifecycle demo.",
      createdAt: day(-6, 15),
    },
  });

  const annaFolio = await prisma.folio.create({
    data: {
      propertyId: property.id,
      guestId: anna.id,
      reservationId: annaReservation.id,
      status: "OPEN",
      openedAt: day(-1, 8),
    },
  });
  const juliaFolio = await prisma.folio.create({
    data: {
      propertyId: property.id,
      guestId: julia.id,
      reservationId: juliaReservation.id,
      status: "CLOSED",
      openedAt: day(-5, 8),
      closedAt: day(-1, 11),
    },
  });
  const markusFolio = await prisma.folio.create({
    data: {
      propertyId: property.id,
      guestId: markus.id,
      reservationId: markusReservation.id,
      status: "OPEN",
      openedAt: day(-3, 12),
    },
  });

  const juliaNights = nightsBetween(juliaReservation.checkInDate, juliaReservation.checkOutDate);
  const juliaRoomCharge = juliaNights * juliaReservation.ratePerNightMinor;
  const juliaTaxPersonNights = juliaReservation.adults * juliaNights;
  const juliaTouristTax = juliaTaxPersonNights * property.touristTaxPerPersonPerNightMinor;
  const juliaTreatmentCharge = massage.priceMinor;
  const juliaTotal = juliaRoomCharge + juliaTouristTax + juliaTreatmentCharge;

  await prisma.folioLineItem.createMany({
    data: [
      {
        folioId: annaFolio.id,
        type: "PACKAGE",
        description: rehabPackage.name,
        quantity: 1,
        unitPriceMinor: rehabPackage.priceMinor,
        amountMinor: rehabPackage.priceMinor,
        sourceType: "ServicePackage",
        sourceId: rehabPackage.id,
        createdByStaffId: reception.id,
        createdAt: day(-1, 9),
      },
      {
        folioId: annaFolio.id,
        type: "ADJUSTMENT",
        description: "Spa robe deposit",
        quantity: 1,
        unitPriceMinor: huf(10000),
        amountMinor: huf(10000),
        createdByStaffId: reception.id,
        createdAt: day(-1, 9, 10),
      },
      {
        folioId: juliaFolio.id,
        type: "ROOM",
        description: `${classic.name} - ${juliaNights} night(s)`,
        quantity: juliaNights,
        unitPriceMinor: juliaReservation.ratePerNightMinor,
        amountMinor: juliaRoomCharge,
        sourceType: "Reservation",
        sourceId: juliaReservation.id,
        createdByStaffId: reception.id,
        createdAt: day(-1, 10),
      },
      {
        folioId: juliaFolio.id,
        type: "TOURIST_TAX",
        description: `Tourist tax - ${juliaTaxPersonNights} person-night(s)`,
        quantity: juliaTaxPersonNights,
        unitPriceMinor: property.touristTaxPerPersonPerNightMinor,
        amountMinor: juliaTouristTax,
        sourceType: "Reservation",
        sourceId: juliaReservation.id,
        createdByStaffId: reception.id,
        createdAt: day(-1, 10, 5),
      },
      {
        folioId: juliaFolio.id,
        type: "TREATMENT",
        description: massage.name,
        quantity: 1,
        unitPriceMinor: juliaTreatmentCharge,
        amountMinor: juliaTreatmentCharge,
        sourceType: "TreatmentAppointment",
        sourceId: "seeded-before-appointment-link",
        createdByStaffId: therapistNoemi.id,
        createdAt: day(-3, 12),
      },
      {
        folioId: markusFolio.id,
        type: "PACKAGE",
        description: detoxPackage.name,
        quantity: 1,
        unitPriceMinor: detoxPackage.priceMinor,
        amountMinor: detoxPackage.priceMinor,
        sourceType: "ServicePackage",
        sourceId: detoxPackage.id,
        createdByStaffId: reservationAdmin.id,
        createdAt: day(-2, 13),
      },
    ],
  });

  await prisma.payment.createMany({
    data: [
      {
        folioId: annaFolio.id,
        amountMinor: huf(50000),
        method: "CARD",
        reference: "PREAUTH-ANNA-001",
        recordedByStaffId: reception.id,
        paidAt: day(-1, 9, 15),
      },
      {
        folioId: juliaFolio.id,
        amountMinor: juliaTotal,
        method: "CARD",
        reference: "CARD-JULIA-CHECKOUT",
        recordedByStaffId: reception.id,
        paidAt: day(-1, 11),
      },
      {
        folioId: markusFolio.id,
        amountMinor: huf(40000),
        method: "TRANSFER",
        reference: "BANK-MARKUS-DEPOSIT",
        recordedByStaffId: reservationAdmin.id,
        paidAt: day(-2, 15),
      },
    ],
  });

  const annaMassage = await prisma.treatmentAppointment.create({
    data: {
      propertyId: property.id,
      guestId: anna.id,
      treatmentId: massage.id,
      therapistId: therapistClara.id,
      resourceId: treatmentRoomA.id,
      reservationId: annaReservation.id,
      startTime: day(-1, 10),
      endTime: endAt(day(-1, 10), massage.durationMinutes),
      status: "COMPLETED",
      notes: "Completed after arrival; charge is visible on the open folio.",
      createdAt: day(-2, 14),
    },
  });
  await prisma.folioLineItem.create({
    data: {
      folioId: annaFolio.id,
      type: "TREATMENT",
      description: massage.name,
      quantity: 1,
      unitPriceMinor: massage.priceMinor,
      amountMinor: massage.priceMinor,
      sourceType: "TreatmentAppointment",
      sourceId: annaMassage.id,
      createdByStaffId: therapistClara.id,
      createdAt: day(-1, 11),
    },
  });

  const annaHydro = await prisma.treatmentAppointment.create({
    data: {
      propertyId: property.id,
      guestId: anna.id,
      treatmentId: hydrotherapy.id,
      therapistId: therapistMate.id,
      resourceId: hydroCabin.id,
      reservationId: annaReservation.id,
      startTime: day(0, 14),
      endTime: endAt(day(0, 14), hydrotherapy.durationMinutes),
      status: "SCHEDULED",
      notes: "Hydrotherapy after physician review.",
      createdAt: day(-1, 11),
    },
  });
  const annaDevice = await prisma.treatmentAppointment.create({
    data: {
      propertyId: property.id,
      guestId: anna.id,
      treatmentId: deviceTherapy.id,
      therapistId: therapistBalazs.id,
      resourceId: electroDevice.id,
      reservationId: annaReservation.id,
      startTime: day(1, 9),
      endTime: endAt(day(1, 9), deviceTherapy.durationMinutes),
      status: "SCHEDULED",
      notes: "Equipment slot tied to the rehabilitation plan.",
      createdAt: day(-1, 12),
    },
  });
  const juliaMassage = await prisma.treatmentAppointment.create({
    data: {
      propertyId: property.id,
      guestId: julia.id,
      treatmentId: massage.id,
      therapistId: therapistNoemi.id,
      resourceId: treatmentRoomB.id,
      reservationId: juliaReservation.id,
      startTime: day(-3, 11),
      endTime: endAt(day(-3, 11), massage.durationMinutes),
      status: "COMPLETED",
      notes: "Completed during stay; checkout folio is closed.",
      createdAt: day(-5, 10),
    },
  });
  await prisma.folioLineItem.updateMany({
    where: { folioId: juliaFolio.id, sourceType: "TreatmentAppointment", sourceId: "seeded-before-appointment-link" },
    data: { sourceId: juliaMassage.id },
  });
  const markusConsult = await prisma.treatmentAppointment.create({
    data: {
      propertyId: property.id,
      guestId: markus.id,
      treatmentId: consultation.id,
      therapistId: therapistClara.id,
      resourceId: treatmentRoomA.id,
      reservationId: markusReservation.id,
      startTime: day(1, 15),
      endTime: endAt(day(1, 15), consultation.durationMinutes),
      status: "SCHEDULED",
      notes: "Arrival consultation before detox package begins.",
      createdAt: day(-2, 13),
    },
  });
  const markusMudPack = await prisma.treatmentAppointment.create({
    data: {
      propertyId: property.id,
      guestId: markus.id,
      treatmentId: mudPack.id,
      therapistId: therapistMate.id,
      resourceId: treatmentRoomB.id,
      reservationId: markusReservation.id,
      startTime: day(2, 10),
      endTime: endAt(day(2, 10), mudPack.durationMinutes),
      status: "SCHEDULED",
      notes: "Part of Thermal Detox Weekend.",
      createdAt: day(-2, 13, 5),
    },
  });
  const sofiaMassage = await prisma.treatmentAppointment.create({
    data: {
      propertyId: property.id,
      guestId: sofia.id,
      treatmentId: massage.id,
      therapistId: therapistNoemi.id,
      resourceId: treatmentRoomB.id,
      reservationId: sofiaReservation.id,
      startTime: day(3, 16),
      endTime: endAt(day(3, 16), massage.durationMinutes),
      status: "SCHEDULED",
      notes: "Booked by AI after the guest asked for a relaxing arrival treatment.",
      createdAt: day(-1, 18, 5),
    },
  });
  const peterNoShowAppointment = await prisma.treatmentAppointment.create({
    data: {
      propertyId: property.id,
      guestId: peterGuest.id,
      treatmentId: consultation.id,
      therapistId: therapistBalazs.id,
      resourceId: treatmentRoomA.id,
      reservationId: peterNoShowReservation.id,
      startTime: day(-1, 15),
      endTime: endAt(day(-1, 15), consultation.durationMinutes),
      status: "NO_SHOW",
      notes: "Guest missed the appointment; the slot is free in conflict checks.",
      createdAt: day(-8, 15),
    },
  });
  await prisma.treatmentAppointment.create({
    data: {
      propertyId: property.id,
      guestId: david.id,
      treatmentId: physiotherapy.id,
      therapistId: therapistClara.id,
      resourceId: treatmentRoomA.id,
      startTime: day(0, 11),
      endTime: endAt(day(0, 11), physiotherapy.durationMinutes),
      status: "SCHEDULED",
      notes: "Outpatient appointment without hotel reservation or folio billing.",
      createdAt: day(-1, 16),
    },
  });

  const intakeTemplate = await prisma.formTemplate.create({
    data: {
      propertyId: property.id,
      name: "Medical Wellness Intake",
      type: "INTAKE",
      schema: {
        sections: [
          {
            title: "Health and safety",
            fields: [
              { id: "main_goal", label: "Main goal of stay", type: "textarea", required: true },
              { id: "allergies", label: "Allergies", type: "textarea" },
              { id: "contraindications", label: "Contraindications", type: "textarea" },
            ],
          },
        ],
      } as Prisma.InputJsonValue,
      version: 1,
      active: true,
      createdAt: day(-20, 9),
    },
  });
  const historyTemplate = await prisma.formTemplate.create({
    data: {
      propertyId: property.id,
      name: "Medical History Update",
      type: "MEDICAL_HISTORY",
      schema: {
        fields: [
          { id: "medications", label: "Current medications", type: "textarea" },
          { id: "mobility", label: "Mobility limitations", type: "textarea" },
        ],
      } as Prisma.InputJsonValue,
      version: 2,
      active: true,
      createdAt: day(-15, 9),
    },
  });

  await prisma.intakeFormSubmission.createMany({
    data: [
      {
        propertyId: property.id,
        guestId: anna.id,
        templateId: intakeTemplate.id,
        templateVersion: 1,
        answers: {
          main_goal: "Reduce knee pain and improve walking comfort.",
          allergies: "Penicillin",
          contraindications: "Avoid intense heat after bath therapy.",
        } as Prisma.InputJsonValue,
        status: "COMPLETED",
        submittedAt: day(-2, 18),
        createdAt: day(-2, 17),
      },
      {
        propertyId: property.id,
        guestId: markus.id,
        templateId: historyTemplate.id,
        templateVersion: 2,
        answers: {
          medications: "Occasional ibuprofen.",
          mobility: "Reduced shoulder range of motion.",
        } as Prisma.InputJsonValue,
        status: "PENDING",
        submittedAt: null,
        createdAt: day(-1, 13),
      },
      {
        propertyId: property.id,
        guestId: julia.id,
        templateId: intakeTemplate.id,
        templateVersion: 1,
        answers: {
          main_goal: "Relaxation and lower-back pain relief.",
          allergies: "Latex",
          contraindications: "No electrotherapy near implanted device.",
        } as Prisma.InputJsonValue,
        status: "COMPLETED",
        submittedAt: day(-5, 16),
        createdAt: day(-5, 15),
      },
    ],
  });

  await prisma.consent.createMany({
    data: [
      {
        propertyId: property.id,
        guestId: anna.id,
        type: "GDPR_DATA_PROCESSING",
        version: "2026-01",
        text: "Guest consents to processing wellness and stay data.",
        docRef: "demo-consents/anna-gdpr.pdf",
        grantedAt: day(-2, 16),
      },
      {
        propertyId: property.id,
        guestId: anna.id,
        type: "TREATMENT",
        version: "2026-01",
        text: "Guest consents to medical-wellness treatments.",
        docRef: "demo-consents/anna-treatment.pdf",
        grantedAt: day(-2, 16, 5),
      },
      {
        propertyId: property.id,
        guestId: anna.id,
        type: "PHOTO",
        version: "2026-01",
        text: "Guest consents to clinical progress photo references.",
        docRef: "demo-consents/anna-photo.pdf",
        grantedAt: day(-2, 16, 10),
      },
      {
        propertyId: property.id,
        guestId: markus.id,
        type: "GDPR_DATA_PROCESSING",
        version: "2026-01",
        docRef: "demo-consents/markus-gdpr.pdf",
        grantedAt: day(-2, 13),
      },
      {
        propertyId: property.id,
        guestId: markus.id,
        type: "TREATMENT",
        version: "2026-01",
        docRef: "demo-consents/markus-treatment.pdf",
        grantedAt: day(-2, 13, 5),
      },
      {
        propertyId: property.id,
        guestId: julia.id,
        type: "GDPR_DATA_PROCESSING",
        version: "2026-01",
        docRef: "demo-consents/julia-gdpr.pdf",
        grantedAt: day(-5, 15),
      },
      {
        propertyId: property.id,
        guestId: julia.id,
        type: "TREATMENT",
        version: "2026-01",
        docRef: "demo-consents/julia-treatment.pdf",
        grantedAt: day(-5, 15, 5),
      },
      {
        propertyId: property.id,
        guestId: julia.id,
        type: "MARKETING",
        version: "2026-01",
        docRef: "demo-consents/julia-marketing.pdf",
        grantedAt: day(-5, 15, 10),
        revokedAt: day(-1, 10, 30),
      },
      {
        propertyId: property.id,
        guestId: sofia.id,
        type: "GDPR_DATA_PROCESSING",
        version: "2026-01",
        docRef: "demo-consents/sofia-gdpr.pdf",
        grantedAt: day(-1, 17),
      },
      {
        propertyId: property.id,
        guestId: david.id,
        type: "GDPR_DATA_PROCESSING",
        version: "2026-01",
        docRef: "demo-consents/david-gdpr.pdf",
        grantedAt: day(-1, 16),
      },
      {
        propertyId: property.id,
        guestId: david.id,
        type: "TREATMENT",
        version: "2026-01",
        docRef: "demo-consents/david-treatment.pdf",
        grantedAt: day(-1, 16, 5),
      },
    ],
  });

  const annaRecord = await prisma.treatmentRecord.create({
    data: {
      propertyId: property.id,
      treatmentAppointmentId: annaMassage.id,
      guestId: anna.id,
      providerId: therapistClara.id,
      subjective: "Guest reports knee stiffness after travel, pain 4/10.",
      objective: "Mild swelling, tolerated moderate pressure massage.",
      assessment: "Good candidate for gradual hydrotherapy and physio progression.",
      plan: "Hydrotherapy today; continue low-impact mobility exercises.",
      productsUsed: { oils: ["arnica"], durationMinutes: 50 } as Prisma.InputJsonValue,
      photoRefs: ["demo-photos/anna-knee-baseline.jpg"] as Prisma.InputJsonValue,
      status: "SIGNED",
      aiGenerated: false,
      signedById: therapistClara.id,
      signedAt: day(-1, 11, 20),
      createdAt: day(-1, 11),
    },
  });
  const juliaRecord = await prisma.treatmentRecord.create({
    data: {
      propertyId: property.id,
      treatmentAppointmentId: juliaMassage.id,
      guestId: julia.id,
      providerId: therapistNoemi.id,
      subjective: "Lower-back tightness improved compared with intake.",
      objective: "Relaxed paraspinal tone after treatment.",
      assessment: "Positive response to therapeutic massage.",
      plan: "Recommend follow-up wellness massage in 4 weeks.",
      productsUsed: { oils: ["lavender"], notes: "Latex-free setup used" } as Prisma.InputJsonValue,
      status: "SIGNED",
      aiGenerated: false,
      signedById: therapistNoemi.id,
      signedAt: day(-3, 12, 10),
      createdAt: day(-3, 12),
    },
  });
  await prisma.treatmentRecord.create({
    data: {
      propertyId: property.id,
      treatmentAppointmentId: juliaMassage.id,
      guestId: julia.id,
      providerId: therapistNoemi.id,
      subjective: "Addendum: guest later clarified stretching plan tolerance.",
      objective: "No new objective findings.",
      assessment: "Original signed record remains valid.",
      plan: "Add gentle evening stretch only.",
      productsUsed: Prisma.JsonNull,
      photoRefs: Prisma.JsonNull,
      status: "DRAFT",
      aiGenerated: false,
      supersededById: juliaRecord.id,
      createdAt: day(-2, 9),
    },
  });

  await prisma.housekeepingTask.createMany({
    data: [
      {
        propertyId: property.id,
        roomId: rooms.r102.id,
        type: "CLEANING",
        status: "OPEN",
        priority: "HIGH",
        title: "Checkout cleaning - Room 102",
        notes: "Created after Julia Novak checked out. Change linens and minibar count.",
        assignedToStaffId: housekeeperEva.id,
        createdByStaffId: reception.id,
        createdAt: day(-1, 11, 10),
      },
      {
        propertyId: property.id,
        roomId: rooms.r101.id,
        type: "TURNDOWN",
        status: "OPEN",
        priority: "NORMAL",
        title: "Evening turndown - Room 101",
        notes: "Anna Varga requested extra pillow and low-sodium menu card.",
        assignedToStaffId: housekeeperLaszlo.id,
        createdByStaffId: reception.id,
        createdAt: day(0, 9),
      },
      {
        propertyId: property.id,
        roomId: rooms.r301.id,
        type: "MAINTENANCE",
        status: "BLOCKED",
        priority: "URGENT",
        title: "Heating fault - Room 301",
        notes: "Room remains OUT_OF_ORDER until contractor confirms repair.",
        assignedToStaffId: housekeeperEva.id,
        createdByStaffId: manager.id,
        createdAt: day(-2, 8),
      },
      {
        propertyId: property.id,
        areaId: thermalPool.id,
        type: "INSPECTION",
        status: "IN_PROGRESS",
        priority: "HIGH",
        title: "Thermal pool water-quality inspection",
        notes: "Record chlorine and temperature before afternoon session.",
        assignedToStaffId: housekeeperLaszlo.id,
        createdByStaffId: manager.id,
        createdAt: day(0, 8),
        startedAt: day(0, 8, 30),
      },
      {
        propertyId: property.id,
        areaId: restaurant.id,
        type: "RESTOCK",
        status: "DONE",
        priority: "LOW",
        title: "Restock gluten-free breakfast station",
        notes: "Completed before service.",
        assignedToStaffId: housekeeperEva.id,
        createdByStaffId: manager.id,
        createdAt: day(-1, 6),
        startedAt: day(-1, 6, 20),
        completedAt: day(-1, 6, 50),
      },
      {
        propertyId: property.id,
        areaId: lobby.id,
        type: "OTHER",
        status: "OPEN",
        priority: "NORMAL",
        title: "Prepare arrival welcome desk",
        notes: "Markus Schneider arrives tomorrow with family.",
        assignedToStaffId: housekeeperEva.id,
        createdByStaffId: reservationAdmin.id,
        createdAt: day(0, 10),
      },
      {
        propertyId: property.id,
        areaId: spaCorridor.id,
        type: "CLEANING",
        status: "DONE",
        priority: "NORMAL",
        title: "Treatment corridor floor clean",
        notes: "Completed before morning appointments.",
        assignedToStaffId: housekeeperLaszlo.id,
        createdByStaffId: manager.id,
        createdAt: day(0, 6),
        startedAt: day(0, 6, 10),
        completedAt: day(0, 6, 45),
      },
    ],
  });

  const annaGuestAccount = await prisma.guestAccount.create({
    data: {
      guestId: anna.id,
      email: "guest@demo.test",
      passwordHash,
      invitedAt: day(-3, 12),
      activatedAt: day(-2, 18),
      lastLoginAt: day(0, 8),
      createdAt: day(-3, 12),
    },
  });
  await prisma.guestAccount.create({
    data: {
      guestId: markus.id,
      email: "markus.portal@example.com",
      passwordHash,
      invitedAt: day(-2, 13),
      activatedAt: day(-2, 14),
      lastLoginAt: day(-1, 19),
      createdAt: day(-2, 13),
    },
  });
  await prisma.guestAccount.create({
    data: {
      guestId: sofia.id,
      email: "sofia.portal@example.com",
      inviteTokenHash: hashToken("sofia-demo-invite"),
      invitedAt: day(-1, 17),
      createdAt: day(-1, 17),
    },
  });

  const annaConversation = await prisma.conversation.create({
    data: {
      propertyId: property.id,
      guestId: anna.id,
      handling: "HUMAN",
      status: "OPEN",
      assignedStaffId: reception.id,
      lastMessageAt: day(0, 8, 24),
      createdAt: day(-1, 20),
      updatedAt: day(0, 8, 24),
    },
  });
  await prisma.message.createMany({
    data: [
      {
        conversationId: annaConversation.id,
        senderKind: "GUEST",
        body: "Good morning, can I see whether yesterday's massage is already on my bill?",
        createdAt: day(0, 8, 10),
      },
      {
        conversationId: annaConversation.id,
        senderKind: "AI",
        body: "Your treatment charge has been posted. A receptionist can help with the full folio.",
        actionType: "TreatmentAppointment",
        actionId: annaMassage.id,
        createdAt: day(0, 8, 11),
      },
      {
        conversationId: annaConversation.id,
        senderKind: "STAFF",
        senderStaffId: reception.id,
        body: "Hi Anna, I took over the chat. Your package, robe deposit and massage are visible now.",
        createdAt: day(0, 8, 24),
      },
    ],
  });

  const markusConversation = await prisma.conversation.create({
    data: {
      propertyId: property.id,
      guestId: markus.id,
      handling: "AI",
      status: "OPEN",
      lastMessageAt: day(-1, 19, 5),
      createdAt: day(-2, 14),
      updatedAt: day(-1, 19, 5),
    },
  });
  await prisma.message.createMany({
    data: [
      {
        conversationId: markusConversation.id,
        senderKind: "GUEST",
        body: "We arrive tomorrow. Can you keep the detox weekend and book our first consultation?",
        createdAt: day(-1, 19),
      },
      {
        conversationId: markusConversation.id,
        senderKind: "AI",
        body: "Done. Your suite booking is confirmed and the arrival consultation is scheduled for 15:00.",
        actionType: "TreatmentAppointment",
        actionId: markusConsult.id,
        createdAt: day(-1, 19, 1),
      },
      {
        conversationId: markusConversation.id,
        senderKind: "AI",
        body: "I also attached the Thermal Detox Weekend package to your folio; your child is exempt from tourist tax.",
        actionType: "Reservation",
        actionId: markusReservation.id,
        createdAt: day(-1, 19, 5),
      },
    ],
  });

  const sofiaConversation = await prisma.conversation.create({
    data: {
      propertyId: property.id,
      guestId: sofia.id,
      handling: "AI",
      status: "OPEN",
      lastMessageAt: day(-1, 18, 8),
      createdAt: day(-1, 18),
      updatedAt: day(-1, 18, 8),
    },
  });
  await prisma.message.createMany({
    data: [
      {
        conversationId: sofiaConversation.id,
        senderKind: "GUEST",
        body: "I may arrive on Sunday. Is a relaxing massage possible after check-in?",
        createdAt: day(-1, 18),
      },
      {
        conversationId: sofiaConversation.id,
        senderKind: "AI",
        body: "I placed a pending room booking and reserved a 16:00 therapeutic massage on your arrival day.",
        actionType: "TreatmentAppointment",
        actionId: sofiaMassage.id,
        createdAt: day(-1, 18, 8),
      },
    ],
  });

  await prisma.complianceEvent.createMany({
    data: [
      {
        propertyId: property.id,
        type: "NTAK_DAILY_REPORT",
        payload: {
          date: isoDay(day(-1)),
          occupiedRooms: 2,
          arrivals: 0,
          departures: 1,
          noShows: 1,
        } as Prisma.InputJsonValue,
        status: "LOGGED",
        relatedEntityType: "Property",
        relatedEntityId: property.id,
        createdAt: day(0, 6),
      },
      {
        propertyId: property.id,
        type: "NAV_INVOICE",
        payload: {
          folioId: juliaFolio.id,
          guest: "Julia Novak",
          totalMinor: juliaTotal,
          currency: "HUF",
        } as Prisma.InputJsonValue,
        status: "SENT",
        relatedEntityType: "Folio",
        relatedEntityId: juliaFolio.id,
        createdAt: day(-1, 11, 5),
      },
    ],
  });

  await audit({
    propertyId: property.id,
    actorStaffId: admin.id,
    action: "CREATE",
    entityType: "Property",
    entityId: property.id,
    after: { name: property.name, taxNumber: property.taxNumber } as Prisma.InputJsonValue,
    createdAt: day(-120, 9),
  });
  await audit({
    propertyId: property.id,
    actorStaffId: reception.id,
    action: "CREATE",
    entityType: "Guest",
    entityId: anna.id,
    after: { firstName: anna.firstName, lastName: anna.lastName } as Prisma.InputJsonValue,
    createdAt: day(-10, 9, 5),
  });
  await audit({
    propertyId: property.id,
    actorStaffId: reservationAdmin.id,
    action: "CREATE",
    entityType: "Reservation",
    entityId: markusReservation.id,
    after: { status: markusReservation.status, room: rooms.r201.number } as Prisma.InputJsonValue,
    createdAt: day(-3, 12),
  });
  await audit({
    propertyId: property.id,
    actorStaffId: reception.id,
    action: "STATE_CHANGE",
    entityType: "Reservation",
    entityId: annaReservation.id,
    before: { status: "CONFIRMED" } as Prisma.InputJsonValue,
    after: { status: "CHECKED_IN" } as Prisma.InputJsonValue,
    metadata: { operation: "check-in", roomNumber: rooms.r101.number } as Prisma.InputJsonValue,
    createdAt: day(-1, 8, 15),
  });
  await audit({
    propertyId: property.id,
    actorStaffId: therapistClara.id,
    action: "STATE_CHANGE",
    entityType: "TreatmentAppointment",
    entityId: annaMassage.id,
    before: { status: "SCHEDULED" } as Prisma.InputJsonValue,
    after: { status: "COMPLETED" } as Prisma.InputJsonValue,
    createdAt: day(-1, 11),
  });
  await audit({
    propertyId: property.id,
    actorStaffId: therapistClara.id,
    action: "CREATE",
    entityType: "TreatmentRecord",
    entityId: annaRecord.id,
    after: { status: annaRecord.status, guestId: anna.id } as Prisma.InputJsonValue,
    createdAt: day(-1, 11, 20),
  });
  await audit({
    propertyId: property.id,
    actorStaffId: therapistClara.id,
    action: "READ",
    entityType: "MedicalProfile",
    entityId: anna.id,
    metadata: { guestId: anna.id, reason: "treatment prep" } as Prisma.InputJsonValue,
    createdAt: day(0, 9, 30),
  });
  await audit({
    propertyId: property.id,
    actorStaffId: reception.id,
    action: "STATE_CHANGE",
    entityType: "Conversation",
    entityId: annaConversation.id,
    metadata: { to: "HUMAN", assignedStaffId: reception.id } as Prisma.InputJsonValue,
    createdAt: day(0, 8, 20),
  });
  await audit({
    propertyId: property.id,
    actorStaffId: aiAgent.id,
    action: "CREATE",
    entityType: "TreatmentAppointment",
    entityId: sofiaMassage.id,
    after: { guestId: sofia.id, treatment: massage.name } as Prisma.InputJsonValue,
    metadata: { ai: true, conversationId: sofiaConversation.id } as Prisma.InputJsonValue,
    createdAt: day(-1, 18, 8),
  });
  await audit({
    propertyId: property.id,
    actorStaffId: reception.id,
    action: "STATE_CHANGE",
    entityType: "Reservation",
    entityId: juliaReservation.id,
    before: { status: "CHECKED_IN" } as Prisma.InputJsonValue,
    after: { status: "CHECKED_OUT" } as Prisma.InputJsonValue,
    metadata: { auto: "room-charge-tourist-tax-housekeeping" } as Prisma.InputJsonValue,
    createdAt: day(-1, 10, 10),
  });
  await audit({
    propertyId: property.id,
    actorStaffId: reception.id,
    action: "STATE_CHANGE",
    entityType: "Reservation",
    entityId: peterNoShowReservation.id,
    before: { status: "CONFIRMED" } as Prisma.InputJsonValue,
    after: { status: "NO_SHOW" } as Prisma.InputJsonValue,
    createdAt: day(-1, 17),
  });
  await audit({
    propertyId: property.id,
    actorStaffId: manager.id,
    action: "UPDATE",
    entityType: "Room",
    entityId: rooms.r301.id,
    before: { housekeepingStatus: "DIRTY" } as Prisma.InputJsonValue,
    after: { housekeepingStatus: "OUT_OF_ORDER" } as Prisma.InputJsonValue,
    metadata: { reason: "heating fault" } as Prisma.InputJsonValue,
    createdAt: day(-2, 8),
  });
  await audit({
    propertyId: property.id,
    actorStaffId: null,
    action: "LOGIN",
    entityType: "GuestAccount",
    entityId: annaGuestAccount.id,
    metadata: { email: "guest@demo.test" } as Prisma.InputJsonValue,
    createdAt: day(0, 8),
  });

  console.log("Demo seed complete.");
  console.log(`  Property: ${property.name} (${property.id})`);
  console.log(`  Staff login: ${ADMIN_EMAIL} / ${DEMO_PASSWORD}`);
  console.log("  Other staff examples: manager@hotel.example, reception@hotel.example, housekeeping@hotel.example");
  console.log(`  Guest login: guest@demo.test / ${DEMO_PASSWORD}`);
  console.log("  Demo timeline is relative to the day the seed is run.");
  console.log(
    `  Reservations: checked-in=${annaReservation.id}, confirmed=${markusReservation.id}, pending=${sofiaReservation.id}, ` +
      `checked-out=${juliaReservation.id}, no-show=${peterNoShowReservation.id}, cancelled=${elenaCancelledReservation.id}`,
  );
  console.log(
    `  Scheduled demo appointments: ${annaHydro.id}, ${annaDevice.id}, ${markusConsult.id}, ${markusMudPack.id}, ` +
      `no-show=${peterNoShowAppointment.id}`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
