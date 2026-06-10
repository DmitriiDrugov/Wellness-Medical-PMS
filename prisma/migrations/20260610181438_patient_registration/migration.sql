-- AlterTable
ALTER TABLE "Guest" ADD COLUMN     "gender" TEXT,
ADD COLUMN     "idDocumentExpiry" TIMESTAMP(3),
ADD COLUMN     "idDocumentNumber" TEXT,
ADD COLUMN     "idDocumentType" TEXT,
ADD COLUMN     "placeOfBirth" TEXT;

-- CreateTable
CREATE TABLE "MedicalProfile" (
    "id" TEXT NOT NULL,
    "guestId" TEXT NOT NULL,
    "dietaryNotes" TEXT,
    "allergies" TEXT,
    "contraindications" TEXT,
    "currentMedications" TEXT,
    "prescriptions" TEXT,
    "mobilityNotes" TEXT,
    "generalNotes" TEXT,
    "updatedByStaffId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MedicalProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GuestDocument" (
    "id" TEXT NOT NULL,
    "guestId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "externalRef" TEXT NOT NULL,
    "uploadedByStaffId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GuestDocument_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MedicalProfile_guestId_key" ON "MedicalProfile"("guestId");

-- CreateIndex
CREATE INDEX "GuestDocument_guestId_idx" ON "GuestDocument"("guestId");

-- AddForeignKey
ALTER TABLE "MedicalProfile" ADD CONSTRAINT "MedicalProfile_guestId_fkey" FOREIGN KEY ("guestId") REFERENCES "Guest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GuestDocument" ADD CONSTRAINT "GuestDocument_guestId_fkey" FOREIGN KEY ("guestId") REFERENCES "Guest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
