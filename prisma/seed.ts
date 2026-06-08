import { PrismaClient, ResourceType } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

// Helper: HUF -> minor units (fillér). 35000 HUF -> 3_500_000.
const huf = (amount: number) => amount * 100;

// Shared demo password for all seeded staff accounts.
const DEMO_PASSWORD = "Passw0rd!";

async function clear() {
  // Delete in FK-safe order (children first).
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
  await prisma.refreshToken.deleteMany();
  await prisma.guest.deleteMany();
  await prisma.staff.deleteMany();
  await prisma.property.deleteMany();
}

async function main() {
  await clear();

  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);

  // --- Property ---
  const property = await prisma.property.create({
    data: {
      name: "Thermál Wellness Hotel",
      legalName: "Thermál Wellness Kft.",
      taxNumber: "12345678-2-42",
      ntakRegNumber: "MA19000123",
      addressLine: "Fürdő utca 1.",
      city: "Hévíz",
      postalCode: "8380",
      country: "HU",
    },
  });
  const propertyId = property.id;

  // --- Staff (all 6 roles; 4 therapists) ---
  const staffData = [
    { email: "admin@hotel.test", role: "ADMIN", firstName: "Anna", lastName: "Admin" },
    { email: "manager@hotel.test", role: "MANAGER", firstName: "Márton", lastName: "Manager" },
    { email: "reception@hotel.test", role: "RECEPTION", firstName: "Réka", lastName: "Reception" },
    { email: "reservations@hotel.test", role: "RESERVATION_ADMIN", firstName: "Róbert", lastName: "Reserve" },
    { email: "housekeeping@hotel.test", role: "HOUSEKEEPING", firstName: "Hanna", lastName: "House" },
    { email: "therapist1@hotel.test", role: "THERAPIST", firstName: "Tamás", lastName: "Tóth" },
    { email: "therapist2@hotel.test", role: "THERAPIST", firstName: "Tímea", lastName: "Takács" },
    { email: "therapist3@hotel.test", role: "THERAPIST", firstName: "Tibor", lastName: "Tar" },
    { email: "therapist4@hotel.test", role: "THERAPIST", firstName: "Teréz", lastName: "Tóth" },
  ] as const;

  const staff = [];
  for (const s of staffData) {
    staff.push(
      await prisma.staff.create({
        data: { ...s, propertyId, passwordHash },
      }),
    );
  }
  const therapists = staff.filter((s) => s.role === "THERAPIST");

  // --- Room types & 10 rooms ---
  const roomTypeDefs = [
    { name: "Standard Double", basePriceMinor: huf(32000), maxOccupancy: 2, count: 4 },
    { name: "Superior Double", basePriceMinor: huf(42000), maxOccupancy: 2, count: 3 },
    { name: "Wellness Suite", basePriceMinor: huf(68000), maxOccupancy: 3, count: 2 },
    { name: "Family Room", basePriceMinor: huf(55000), maxOccupancy: 4, count: 1 },
  ];

  let roomCounter = 100;
  const roomTypes = [];
  const rooms = [];
  for (const def of roomTypeDefs) {
    const rt = await prisma.roomType.create({
      data: {
        propertyId,
        name: def.name,
        basePriceMinor: def.basePriceMinor,
        maxOccupancy: def.maxOccupancy,
        description: `${def.name} with thermal spa access`,
      },
    });
    roomTypes.push(rt);
    for (let i = 0; i < def.count; i++) {
      roomCounter += 1;
      rooms.push(
        await prisma.room.create({
          data: {
            propertyId,
            number: String(roomCounter),
            roomTypeId: rt.id,
            floor: Math.floor(roomCounter / 100),
            housekeepingStatus: "CLEAN",
          },
        }),
      );
    }
  }

  // --- Resources (treatment rooms + equipment) ---
  const resourceDefs = [
    { name: "Massage Room A", type: ResourceType.TREATMENT_ROOM },
    { name: "Massage Room B", type: ResourceType.TREATMENT_ROOM },
    { name: "Hydrotherapy Room", type: ResourceType.TREATMENT_ROOM },
    { name: "Physio Room", type: ResourceType.TREATMENT_ROOM },
    { name: "Mud Wrap Station", type: ResourceType.EQUIPMENT },
  ];
  const resources = [];
  for (const r of resourceDefs) {
    resources.push(await prisma.resource.create({ data: { propertyId, ...r } }));
  }

  // --- 6 Treatments ---
  const treatmentDefs = [
    { name: "Swedish Massage", durationMinutes: 50, priceMinor: huf(14000), requiredResourceType: ResourceType.TREATMENT_ROOM },
    { name: "Deep Tissue Massage", durationMinutes: 60, priceMinor: huf(17000), requiredResourceType: ResourceType.TREATMENT_ROOM },
    { name: "Thermal Mud Wrap", durationMinutes: 45, priceMinor: huf(13000), requiredResourceType: ResourceType.EQUIPMENT },
    { name: "Hydrotherapy Session", durationMinutes: 40, priceMinor: huf(12000), requiredResourceType: ResourceType.TREATMENT_ROOM },
    { name: "Physiotherapy Consultation", durationMinutes: 30, priceMinor: huf(11000), requiredResourceType: ResourceType.TREATMENT_ROOM },
    { name: "Aromatherapy Facial", durationMinutes: 55, priceMinor: huf(15000), requiredResourceType: ResourceType.TREATMENT_ROOM },
  ];
  const treatments = [];
  for (const t of treatmentDefs) {
    treatments.push(await prisma.treatment.create({ data: { propertyId, ...t } }));
  }

  // --- 2 Service packages ---
  const relaxPackage = await prisma.servicePackage.create({
    data: {
      propertyId,
      name: "Relax & Renew",
      description: "Swedish massage + aromatherapy facial",
      priceMinor: huf(26000),
      items: {
        create: [
          { treatmentId: treatments[0]!.id, quantity: 1 },
          { treatmentId: treatments[5]!.id, quantity: 1 },
        ],
      },
    },
  });
  const thermalPackage = await prisma.servicePackage.create({
    data: {
      propertyId,
      name: "Thermal Therapy",
      description: "Mud wrap + hydrotherapy + physio consult",
      priceMinor: huf(33000),
      items: {
        create: [
          { treatmentId: treatments[2]!.id, quantity: 1 },
          { treatmentId: treatments[3]!.id, quantity: 1 },
          { treatmentId: treatments[4]!.id, quantity: 1 },
        ],
      },
    },
  });

  // --- Guests ---
  const guestDefs = [
    { firstName: "János", lastName: "Kovács", email: "janos.kovacs@example.com", nationality: "HU" },
    { firstName: "Eszter", lastName: "Nagy", email: "eszter.nagy@example.com", nationality: "HU" },
    { firstName: "Liam", lastName: "Schmidt", email: "liam.schmidt@example.de", nationality: "DE" },
    { firstName: "Sophie", lastName: "Dubois", email: "sophie.dubois@example.fr", nationality: "FR" },
  ];
  const guests = [];
  for (const g of guestDefs) {
    guests.push(
      await prisma.guest.create({
        data: {
          ...g,
          gdprConsentDataProcessing: true,
          gdprConsentAt: new Date(),
        },
      }),
    );
  }

  // --- Reservations + a folio ---
  const today = new Date();
  const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);

  const res1 = await prisma.reservation.create({
    data: {
      propertyId,
      guestId: guests[0]!.id,
      roomTypeId: roomTypes[0]!.id,
      roomId: rooms[0]!.id,
      checkInDate: addDays(today, -1),
      checkOutDate: addDays(today, 2),
      status: "CHECKED_IN",
      adults: 2,
      ratePerNightMinor: roomTypes[0]!.basePriceMinor,
    },
  });

  await prisma.reservation.create({
    data: {
      propertyId,
      guestId: guests[1]!.id,
      roomTypeId: roomTypes[1]!.id,
      checkInDate: addDays(today, 5),
      checkOutDate: addDays(today, 8),
      status: "CONFIRMED",
      adults: 1,
      ratePerNightMinor: roomTypes[1]!.basePriceMinor,
    },
  });

  // Open folio for the checked-in guest, with one room-night charge.
  await prisma.folio.create({
    data: {
      propertyId,
      guestId: guests[0]!.id,
      reservationId: res1.id,
      lineItems: {
        create: [
          {
            type: "ROOM",
            description: "Standard Double — night 1",
            quantity: 1,
            unitPriceMinor: roomTypes[0]!.basePriceMinor,
            amountMinor: roomTypes[0]!.basePriceMinor,
            sourceType: "Reservation",
            sourceId: res1.id,
          },
        ],
      },
    },
  });

  // A sample appointment for the checked-in guest.
  const apptStart = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 10, 0, 0);
  const apptEnd = new Date(apptStart.getTime() + treatments[0]!.durationMinutes * 60_000);
  await prisma.treatmentAppointment.create({
    data: {
      propertyId,
      guestId: guests[0]!.id,
      treatmentId: treatments[0]!.id,
      therapistId: therapists[0]!.id,
      resourceId: resources[0]!.id,
      startTime: apptStart,
      endTime: apptEnd,
      status: "SCHEDULED",
      reservationId: res1.id,
    },
  });

  console.log("Seed complete:");
  console.log(`  Property: ${property.name} (${propertyId})`);
  console.log(`  Staff: ${staff.length} (${therapists.length} therapists)`);
  console.log(`  Rooms: ${rooms.length} across ${roomTypes.length} room types`);
  console.log(`  Treatments: ${treatments.length}, Packages: 2, Resources: ${resources.length}`);
  console.log(`  Guests: ${guests.length}, Reservations: 2, Folio: 1, Appointment: 1`);
  console.log(`  Demo login password for all staff: ${DEMO_PASSWORD}`);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
