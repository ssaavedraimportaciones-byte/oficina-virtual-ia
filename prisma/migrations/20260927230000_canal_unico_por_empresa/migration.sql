-- Un número de WhatsApp o una cuenta de Instagram solo puede estar conectado a
-- una empresa: todos llegan al mismo webhook y se reparten por este ID.
-- Si ya hubiera duplicados, se lo queda la empresa que lo conectó primero y a
-- las demás se les desconecta (sus mensajes ya estaban llegando mal).
UPDATE "businesses" AS b SET "whatsappPhoneNumberId" = NULL
WHERE b."whatsappPhoneNumberId" IS NOT NULL AND EXISTS (
  SELECT 1 FROM "businesses" AS o
  WHERE o."whatsappPhoneNumberId" = b."whatsappPhoneNumberId"
    AND (o."createdAt" < b."createdAt" OR (o."createdAt" = b."createdAt" AND o."id" < b."id"))
);

UPDATE "businesses" AS b SET "instagramPageId" = NULL
WHERE b."instagramPageId" IS NOT NULL AND EXISTS (
  SELECT 1 FROM "businesses" AS o
  WHERE o."instagramPageId" = b."instagramPageId"
    AND (o."createdAt" < b."createdAt" OR (o."createdAt" = b."createdAt" AND o."id" < b."id"))
);

-- CreateIndex
CREATE UNIQUE INDEX "businesses_whatsappPhoneNumberId_key" ON "businesses"("whatsappPhoneNumberId");

-- CreateIndex
CREATE UNIQUE INDEX "businesses_instagramPageId_key" ON "businesses"("instagramPageId");
