-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "kitchenPrintedAt" TIMESTAMP(3),
ADD COLUMN     "paidAt" TIMESTAMP(3),
ADD COLUMN     "paymentDeadline" TIMESTAMP(3),
ADD COLUMN     "paymentLink" TEXT,
ADD COLUMN     "paymentMethod" TEXT,
ADD COLUMN     "paymentStatus" TEXT NOT NULL DEFAULT 'no_aplica';

-- CreateTable
CREATE TABLE "sales_settings" (
    "businessId" TEXT NOT NULL,
    "paymentsEnabled" BOOLEAN NOT NULL DEFAULT false,
    "transferInfo" TEXT NOT NULL DEFAULT '',
    "holdMinutes" INTEGER NOT NULL DEFAULT 20,
    "mercadoPagoToken" TEXT,
    "kitchenEnabled" BOOLEAN NOT NULL DEFAULT false,
    "stockAlertsEnabled" BOOLEAN NOT NULL DEFAULT false,
    "stockAlertThreshold" INTEGER NOT NULL DEFAULT 5,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sales_settings_pkey" PRIMARY KEY ("businessId")
);

-- AddForeignKey
ALTER TABLE "sales_settings" ADD CONSTRAINT "sales_settings_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
