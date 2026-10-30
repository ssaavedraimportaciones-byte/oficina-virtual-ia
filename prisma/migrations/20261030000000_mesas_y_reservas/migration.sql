-- AlterTable
ALTER TABLE "businesses" ADD COLUMN     "reservationMinutes" INTEGER NOT NULL DEFAULT 120;

-- CreateTable
CREATE TABLE "floors" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "width" INTEGER NOT NULL DEFAULT 1000,
    "height" INTEGER NOT NULL DEFAULT 600,

    CONSTRAINT "floors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "floor_elements" (
    "id" TEXT NOT NULL,
    "floorId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "x" INTEGER NOT NULL,
    "y" INTEGER NOT NULL,
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "shape" TEXT NOT NULL DEFAULT 'rect',
    "seats" INTEGER NOT NULL DEFAULT 0,
    "sun" TEXT,
    "zone" TEXT NOT NULL DEFAULT '',
    "nearWindow" BOOLEAN,
    "reservable" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "floor_elements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "table_reservations" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "tableId" TEXT,
    "tableLabel" TEXT NOT NULL,
    "floorName" TEXT NOT NULL,
    "conversationId" TEXT,
    "contactName" TEXT NOT NULL,
    "contactHandle" TEXT NOT NULL,
    "partySize" INTEGER NOT NULL,
    "startsAt" TEXT NOT NULL,
    "durationMinutes" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'confirmado',
    "note" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "table_reservations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "floors_businessId_idx" ON "floors"("businessId");

-- CreateIndex
CREATE INDEX "floor_elements_floorId_idx" ON "floor_elements"("floorId");

-- CreateIndex
CREATE INDEX "table_reservations_businessId_startsAt_idx" ON "table_reservations"("businessId", "startsAt");

-- CreateIndex
CREATE INDEX "table_reservations_tableId_idx" ON "table_reservations"("tableId");

-- AddForeignKey
ALTER TABLE "floors" ADD CONSTRAINT "floors_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "floor_elements" ADD CONSTRAINT "floor_elements_floorId_fkey" FOREIGN KEY ("floorId") REFERENCES "floors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "table_reservations" ADD CONSTRAINT "table_reservations_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "table_reservations" ADD CONSTRAINT "table_reservations_tableId_fkey" FOREIGN KEY ("tableId") REFERENCES "floor_elements"("id") ON DELETE SET NULL ON UPDATE CASCADE;

