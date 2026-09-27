-- AlterTable
ALTER TABLE "conversations" ADD COLUMN     "agentPaused" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "handoffReason" TEXT NOT NULL DEFAULT '';

-- AlterTable
ALTER TABLE "messages" ADD COLUMN     "externalId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "messages_externalId_key" ON "messages"("externalId");

