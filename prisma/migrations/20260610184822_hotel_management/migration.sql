/*
  Warnings:

  - The `status` column on the `HousekeepingTask` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - Added the required column `title` to the `HousekeepingTask` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "HousekeepingTaskStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'BLOCKED', 'DONE');

-- CreateEnum
CREATE TYPE "HousekeepingTaskType" AS ENUM ('CLEANING', 'TURNDOWN', 'MAINTENANCE', 'INSPECTION', 'RESTOCK', 'OTHER');

-- CreateEnum
CREATE TYPE "TaskPriority" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'URGENT');

-- CreateEnum
CREATE TYPE "AreaKind" AS ENUM ('COMMON', 'POOL', 'SPA', 'RESTAURANT', 'CORRIDOR', 'BACK_OFFICE', 'OUTDOOR', 'OTHER');

-- DropForeignKey
ALTER TABLE "HousekeepingTask" DROP CONSTRAINT "HousekeepingTask_roomId_fkey";

-- DropIndex
DROP INDEX "HousekeepingTask_propertyId_idx";

-- AlterTable
ALTER TABLE "HousekeepingTask" ADD COLUMN     "areaId" TEXT,
ADD COLUMN     "createdByStaffId" TEXT,
ADD COLUMN     "priority" "TaskPriority" NOT NULL DEFAULT 'NORMAL',
ADD COLUMN     "startedAt" TIMESTAMP(3),
ADD COLUMN     "title" TEXT NOT NULL,
ADD COLUMN     "type" "HousekeepingTaskType" NOT NULL DEFAULT 'CLEANING',
ALTER COLUMN "roomId" DROP NOT NULL,
DROP COLUMN "status",
ADD COLUMN     "status" "HousekeepingTaskStatus" NOT NULL DEFAULT 'OPEN';

-- AlterTable
ALTER TABLE "Room" ADD COLUMN     "height" INTEGER NOT NULL DEFAULT 2,
ADD COLUMN     "posX" INTEGER,
ADD COLUMN     "posY" INTEGER,
ADD COLUMN     "width" INTEGER NOT NULL DEFAULT 2;

-- CreateTable
CREATE TABLE "PropertyArea" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" "AreaKind" NOT NULL DEFAULT 'COMMON',
    "floor" INTEGER,
    "posX" INTEGER,
    "posY" INTEGER,
    "width" INTEGER NOT NULL DEFAULT 3,
    "height" INTEGER NOT NULL DEFAULT 2,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PropertyArea_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PropertyArea_propertyId_idx" ON "PropertyArea"("propertyId");

-- CreateIndex
CREATE INDEX "HousekeepingTask_propertyId_status_idx" ON "HousekeepingTask"("propertyId", "status");

-- CreateIndex
CREATE INDEX "HousekeepingTask_assignedToStaffId_status_idx" ON "HousekeepingTask"("assignedToStaffId", "status");

-- CreateIndex
CREATE INDEX "HousekeepingTask_areaId_idx" ON "HousekeepingTask"("areaId");

-- AddForeignKey
ALTER TABLE "PropertyArea" ADD CONSTRAINT "PropertyArea_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HousekeepingTask" ADD CONSTRAINT "HousekeepingTask_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HousekeepingTask" ADD CONSTRAINT "HousekeepingTask_areaId_fkey" FOREIGN KEY ("areaId") REFERENCES "PropertyArea"("id") ON DELETE SET NULL ON UPDATE CASCADE;
