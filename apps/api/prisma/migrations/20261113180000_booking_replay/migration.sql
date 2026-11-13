-- Q-41: reenvio da confirmação com o mesmo hold devolve a reserva já criada.
-- Guarda só o sha256 do token (nunca o token). NULL em agendamentos manuais e anteriores.
ALTER TABLE "appointments" ADD COLUMN "hold_token_hash" TEXT;

-- Um token confirma uma reserva por profissional (NULLs não colidem no PostgreSQL).
CREATE UNIQUE INDEX "appointments_professional_id_hold_token_hash_key"
  ON "appointments" ("professional_id", "hold_token_hash");
