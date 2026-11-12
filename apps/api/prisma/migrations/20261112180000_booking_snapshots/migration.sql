-- Q-30: o hold guarda nome e preço do serviço vistos pela cliente; a reserva usa esses valores.
-- Holds são transitórios (5 min, RN-40): os existentes são descartados para criar colunas NOT NULL.
DELETE FROM "slot_holds";
ALTER TABLE "slot_holds"
  ADD COLUMN "service_name_snapshot" TEXT NOT NULL,
  ADD COLUMN "price_cents_snapshot" INTEGER NOT NULL,
  ADD CONSTRAINT "slot_holds_price_cents_snapshot_check" CHECK ("price_cents_snapshot" >= 0);

-- Q-29: nome digitado na reserva pública; o cadastro de cliente existente não é alterado.
ALTER TABLE "appointments" ADD COLUMN "booked_name" TEXT;
