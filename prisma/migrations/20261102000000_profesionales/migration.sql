-- CreateTable
CREATE TABLE "professionals" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "professionals_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "professionals_businessId_idx" ON "professionals"("businessId");

-- AlterTable
ALTER TABLE "appointments" ADD COLUMN "professionalId" TEXT,
ADD COLUMN "professionalName" TEXT;

-- AlterTable
ALTER TABLE "table_reservations" ADD COLUMN "attendantName" TEXT;

-- AddForeignKey
ALTER TABLE "professionals" ADD CONSTRAINT "professionals_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_professionalId_fkey" FOREIGN KEY ("professionalId") REFERENCES "professionals"("id") ON DELETE SET NULL ON UPDATE CASCADE;
