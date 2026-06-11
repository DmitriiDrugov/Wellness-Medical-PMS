-- AlterEnum
ALTER TYPE "LineItemType" ADD VALUE 'TOURIST_TAX';

-- AlterTable
ALTER TABLE "Property" ADD COLUMN     "touristTaxAppliesToChildren" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "touristTaxPerPersonPerNightMinor" INTEGER NOT NULL DEFAULT 0;
