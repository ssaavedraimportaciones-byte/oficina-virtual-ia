-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "receiptCheck" JSONB,
ADD COLUMN     "receiptCode" TEXT;

-- AlterTable
ALTER TABLE "sales_settings" ADD COLUMN     "autoConfirmReceipts" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "order_receipts" (
    "orderId" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "data" BYTEA NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "order_receipts_pkey" PRIMARY KEY ("orderId")
);

-- CreateIndex
CREATE INDEX "orders_businessId_receiptCode_idx" ON "orders"("businessId", "receiptCode");

-- AddForeignKey
ALTER TABLE "order_receipts" ADD CONSTRAINT "order_receipts_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
