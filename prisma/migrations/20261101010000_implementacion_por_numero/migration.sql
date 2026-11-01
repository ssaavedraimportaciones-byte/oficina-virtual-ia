-- El cobro de implementación pasa de ser por cliente a ser por negocio (cada
-- negocio es un número de WhatsApp distinto, y cada uno es trabajo aparte de
-- conectar). Se mueve la columna de "users" a "businesses"; quien ya la
-- tenía pagada, se la deja pagada en todos sus negocios actuales, para no
-- cobrarle de nuevo algo que ya pagó.
ALTER TABLE "businesses" ADD COLUMN "setupFeePaidAt" TIMESTAMP(3);

UPDATE "businesses" b
SET "setupFeePaidAt" = u."setupFeePaidAt"
FROM "business_members" m
JOIN "users" u ON u.id = m."userId"
WHERE m."businessId" = b.id
  AND m.role = 'OWNER'
  AND u."setupFeePaidAt" IS NOT NULL;

ALTER TABLE "users" DROP COLUMN "setupFeePaidAt";
