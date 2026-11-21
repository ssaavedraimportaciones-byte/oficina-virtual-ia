-- CreateEnum
CREATE TYPE "SetupTier" AS ENUM ('SIMPLE', 'ESTANDAR', 'AVANZADO');

-- AlterTable
ALTER TABLE "businesses" ADD COLUMN     "setupTier" "SetupTier" NOT NULL DEFAULT 'ESTANDAR';
