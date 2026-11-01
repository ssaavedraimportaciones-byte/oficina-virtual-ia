-- Reemplaza el plan único PRO (sin límite) por tres tramos pagos que se
-- diferencian por cuántos negocios incluyen: BASICO (1), NEGOCIOS (hasta 3) e
-- ILIMITADO (sin límite, lo que antes era PRO). Quien ya estaba en PRO pasa a
-- ILIMITADO, que es el mismo límite de negocios que ya tenía.
CREATE TYPE "Plan_new" AS ENUM ('FREE', 'BASICO', 'NEGOCIOS', 'ILIMITADO');

ALTER TABLE "users" ALTER COLUMN "plan" DROP DEFAULT;
ALTER TABLE "users" ALTER COLUMN "plan" TYPE "Plan_new" USING (
  CASE "plan"::text
    WHEN 'PRO' THEN 'ILIMITADO'
    ELSE "plan"::text
  END
)::"Plan_new";
ALTER TABLE "users" ALTER COLUMN "plan" SET DEFAULT 'FREE';

DROP TYPE "Plan";
ALTER TYPE "Plan_new" RENAME TO "Plan";

-- AlterTable
ALTER TABLE "users" ADD COLUMN "setupFeePaidAt" TIMESTAMP(3);
