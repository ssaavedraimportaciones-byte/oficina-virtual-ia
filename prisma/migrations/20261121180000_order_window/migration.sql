-- Ventana opcional para recibir pedidos (apagada por defecto: nada cambia para los negocios actuales)
ALTER TABLE "sales_settings" ADD COLUMN "ordersOnlyInHours" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "sales_settings" ADD COLUMN "preorderMinutes" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "sales_settings" ADD COLUMN "orderCutoffMinutes" INTEGER NOT NULL DEFAULT 0;
