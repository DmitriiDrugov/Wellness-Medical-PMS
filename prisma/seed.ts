import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

/**
 * Minimal bootstrap seed — NOT demo data.
 *
 * The system is shipped clean for real-world testing: this creates only the single
 * Property the runtime requires (FKs hang off it) and one ADMIN login. Everything
 * else — rooms, guests, bookings, catalog, appointments — is created through the
 * app. Re-running wipes the database back to this clean baseline.
 *
 * Admin credentials: admin@hotel.example / $SEED_ADMIN_PASSWORD (default "Passw0rd!").
 */

const ADMIN_EMAIL = "admin@hotel.example";
const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD ?? "Passw0rd!";

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

async function main() {
  await clear();

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
      // Hungarian tourist tax (IFA): 500 HUF per adult per night, under-18 exempt.
      touristTaxPerPersonPerNightMinor: 50_000,
      touristTaxAppliesToChildren: false,
    },
  });

  await prisma.staff.create({
    data: {
      propertyId: property.id,
      email: ADMIN_EMAIL,
      passwordHash: await bcrypt.hash(ADMIN_PASSWORD, 10),
      role: "ADMIN",
      firstName: "System",
      lastName: "Admin",
    },
  });

  console.log("Bootstrap complete — clean system ready for testing.");
  console.log(`  Property: ${property.name} (${property.id})`);
  console.log(`  Admin login: ${ADMIN_EMAIL} / ${ADMIN_PASSWORD}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
