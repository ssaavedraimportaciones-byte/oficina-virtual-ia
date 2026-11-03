-- CreateTable
CREATE TABLE "business_logos" (
    "businessId" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "data" BYTEA NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "business_logos_pkey" PRIMARY KEY ("businessId")
);

-- AddForeignKey
ALTER TABLE "business_logos" ADD CONSTRAINT "business_logos_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
