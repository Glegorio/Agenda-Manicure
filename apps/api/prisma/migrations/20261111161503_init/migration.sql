-- Extensões exigidas (o shadow DB do `migrate dev` nasce sem elas; o init do compose também cria).
CREATE EXTENSION IF NOT EXISTS citext;
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- CreateEnum
CREATE TYPE "ThemePalette" AS ENUM ('ROSE_GOLD', 'NUDE_MINIMAL', 'ELEGANCE_BLACK', 'PASTEL_LILAC');

-- CreateEnum
CREATE TYPE "ThemeMode" AS ENUM ('LIGHT', 'DARK', 'SYSTEM');

-- CreateEnum
CREATE TYPE "AppointmentStatus" AS ENUM ('SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'NO_SHOW');

-- CreateEnum
CREATE TYPE "AppointmentSource" AS ENUM ('WEB', 'APP');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('PIX', 'CREDIT_CARD', 'DEBIT_CARD', 'CASH');

-- CreateEnum
CREATE TYPE "CancelledBy" AS ENUM ('PROFESSIONAL', 'CLIENT');

-- CreateEnum
CREATE TYPE "ClientSource" AS ENUM ('WEB', 'MANUAL', 'CONTACT_IMPORT');

-- CreateTable
CREATE TABLE "professionals" (
    "id" UUID NOT NULL,
    "email" CITEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "business_name" TEXT NOT NULL,
    "slug" CITEXT,
    "timezone" TEXT NOT NULL DEFAULT 'America/Sao_Paulo',
    "address_line" TEXT,
    "city" TEXT,
    "state" TEXT,
    "zip" TEXT,
    "lat" DOUBLE PRECISION,
    "lng" DOUBLE PRECISION,
    "logo_url" TEXT,
    "cover_url" TEXT,
    "theme_palette" "ThemePalette" NOT NULL DEFAULT 'ROSE_GOLD',
    "theme_mode" "ThemeMode" NOT NULL DEFAULT 'SYSTEM',
    "buffer_min" SMALLINT NOT NULL DEFAULT 10,
    "slot_step_min" SMALLINT NOT NULL DEFAULT 15,
    "min_notice_min" INTEGER NOT NULL DEFAULT 120,
    "booking_horizon_days" SMALLINT NOT NULL DEFAULT 30,
    "cancellation_policy" TEXT,
    "whatsapp_confirmation_template" TEXT,
    "closing_reminder_offset_min" SMALLINT NOT NULL DEFAULT 30,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "professionals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" UUID NOT NULL,
    "professional_id" UUID NOT NULL,
    "token_hash" TEXT NOT NULL,
    "family_id" UUID NOT NULL,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "revoked_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "services" (
    "id" UUID NOT NULL,
    "professional_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "description" TEXT,
    "image_url" TEXT,
    "price_cents" INTEGER NOT NULL,
    "duration_min" SMALLINT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "public" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "services_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "weekly_schedule_windows" (
    "id" UUID NOT NULL,
    "professional_id" UUID NOT NULL,
    "weekday" SMALLINT NOT NULL,
    "start_min" SMALLINT NOT NULL,
    "end_min" SMALLINT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "weekly_schedule_windows_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "schedule_exceptions" (
    "id" UUID NOT NULL,
    "professional_id" UUID NOT NULL,
    "date" DATE NOT NULL,
    "closed" BOOLEAN NOT NULL,
    "note" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "schedule_exceptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exception_windows" (
    "id" UUID NOT NULL,
    "exception_id" UUID NOT NULL,
    "start_min" SMALLINT NOT NULL,
    "end_min" SMALLINT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "exception_windows_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clients" (
    "id" UUID NOT NULL,
    "professional_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "phone_e164" TEXT NOT NULL,
    "notes" TEXT,
    "source" "ClientSource" NOT NULL,
    "consent_marketing_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "clients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "appointments" (
    "id" UUID NOT NULL,
    "professional_id" UUID NOT NULL,
    "client_id" UUID NOT NULL,
    "service_id" UUID,
    "service_name_snapshot" TEXT NOT NULL,
    "price_cents_snapshot" INTEGER NOT NULL,
    "duration_min_snapshot" SMALLINT NOT NULL,
    "start_at" TIMESTAMPTZ(3) NOT NULL,
    "end_at" TIMESTAMPTZ(3) NOT NULL,
    "block_end_at" TIMESTAMPTZ(3) NOT NULL,
    "status" "AppointmentStatus" NOT NULL DEFAULT 'SCHEDULED',
    "source" "AppointmentSource" NOT NULL,
    "client_notes" TEXT,
    "paid_cents" INTEGER,
    "payment_method" "PaymentMethod",
    "cancelled_by" "CancelledBy",
    "cancel_reason" TEXT,
    "status_changed_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "appointments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "slot_holds" (
    "id" UUID NOT NULL,
    "professional_id" UUID NOT NULL,
    "service_id" UUID NOT NULL,
    "start_at" TIMESTAMPTZ(3) NOT NULL,
    "end_at" TIMESTAMPTZ(3) NOT NULL,
    "block_end_at" TIMESTAMPTZ(3) NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "slot_holds_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "manual_blocks" (
    "id" UUID NOT NULL,
    "professional_id" UUID NOT NULL,
    "start_at" TIMESTAMPTZ(3) NOT NULL,
    "end_at" TIMESTAMPTZ(3) NOT NULL,
    "reason" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "manual_blocks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "professionals_email_key" ON "professionals"("email");

-- CreateIndex
CREATE UNIQUE INDEX "professionals_slug_key" ON "professionals"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_tokens_token_hash_key" ON "refresh_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "refresh_tokens_professional_id_idx" ON "refresh_tokens"("professional_id");

-- CreateIndex
CREATE INDEX "refresh_tokens_family_id_idx" ON "refresh_tokens"("family_id");

-- CreateIndex
CREATE INDEX "services_professional_id_sort_order_idx" ON "services"("professional_id", "sort_order");

-- CreateIndex
CREATE UNIQUE INDEX "services_id_professional_id_key" ON "services"("id", "professional_id");

-- CreateIndex
CREATE INDEX "weekly_schedule_windows_professional_id_weekday_idx" ON "weekly_schedule_windows"("professional_id", "weekday");

-- CreateIndex
CREATE UNIQUE INDEX "schedule_exceptions_professional_id_date_key" ON "schedule_exceptions"("professional_id", "date");

-- CreateIndex
CREATE INDEX "exception_windows_exception_id_idx" ON "exception_windows"("exception_id");

-- CreateIndex
CREATE UNIQUE INDEX "clients_id_professional_id_key" ON "clients"("id", "professional_id");

-- CreateIndex
CREATE UNIQUE INDEX "clients_professional_id_phone_e164_key" ON "clients"("professional_id", "phone_e164");

-- CreateIndex
CREATE INDEX "appointments_professional_id_start_at_idx" ON "appointments"("professional_id", "start_at");

-- CreateIndex
CREATE INDEX "appointments_professional_id_status_start_at_idx" ON "appointments"("professional_id", "status", "start_at");

-- CreateIndex
CREATE INDEX "appointments_client_id_professional_id_idx" ON "appointments"("client_id", "professional_id");

-- CreateIndex
CREATE INDEX "appointments_service_id_idx" ON "appointments"("service_id");

-- CreateIndex
CREATE UNIQUE INDEX "slot_holds_token_hash_key" ON "slot_holds"("token_hash");

-- CreateIndex
CREATE INDEX "slot_holds_professional_id_expires_at_idx" ON "slot_holds"("professional_id", "expires_at");

-- CreateIndex
CREATE INDEX "slot_holds_service_id_professional_id_idx" ON "slot_holds"("service_id", "professional_id");

-- CreateIndex
CREATE INDEX "manual_blocks_professional_id_start_at_idx" ON "manual_blocks"("professional_id", "start_at");

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_professional_id_fkey" FOREIGN KEY ("professional_id") REFERENCES "professionals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "services" ADD CONSTRAINT "services_professional_id_fkey" FOREIGN KEY ("professional_id") REFERENCES "professionals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "weekly_schedule_windows" ADD CONSTRAINT "weekly_schedule_windows_professional_id_fkey" FOREIGN KEY ("professional_id") REFERENCES "professionals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "schedule_exceptions" ADD CONSTRAINT "schedule_exceptions_professional_id_fkey" FOREIGN KEY ("professional_id") REFERENCES "professionals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exception_windows" ADD CONSTRAINT "exception_windows_exception_id_fkey" FOREIGN KEY ("exception_id") REFERENCES "schedule_exceptions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clients" ADD CONSTRAINT "clients_professional_id_fkey" FOREIGN KEY ("professional_id") REFERENCES "professionals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_professional_id_fkey" FOREIGN KEY ("professional_id") REFERENCES "professionals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_client_id_professional_id_fkey" FOREIGN KEY ("client_id", "professional_id") REFERENCES "clients"("id", "professional_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "services"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "slot_holds" ADD CONSTRAINT "slot_holds_professional_id_fkey" FOREIGN KEY ("professional_id") REFERENCES "professionals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "slot_holds" ADD CONSTRAINT "slot_holds_service_id_professional_id_fkey" FOREIGN KEY ("service_id", "professional_id") REFERENCES "services"("id", "professional_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "manual_blocks" ADD CONSTRAINT "manual_blocks_professional_id_fkey" FOREIGN KEY ("professional_id") REFERENCES "professionals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ===================================================================================
-- SQL cru (o Prisma não gera): anti double-booking (RN-42, ADR-0003) e CHECKs de domínio.
-- ===================================================================================

-- RN-42: nunca dois agendamentos ativos sobrepostos para a mesma profissional.
ALTER TABLE "appointments"
  ADD CONSTRAINT "appointments_no_overlap"
  EXCLUDE USING gist (
    "professional_id" WITH =,
    tstzrange("start_at", "block_end_at", '[)') WITH &&
  )
  WHERE ("status" IN ('SCHEDULED', 'IN_PROGRESS'));

-- RN-22..25
ALTER TABLE "professionals"
  ADD CONSTRAINT "professionals_buffer_min_check" CHECK ("buffer_min" BETWEEN 0 AND 60),
  ADD CONSTRAINT "professionals_slot_step_min_check" CHECK ("slot_step_min" IN (5, 10, 15, 30)),
  ADD CONSTRAINT "professionals_min_notice_min_check" CHECK ("min_notice_min" >= 0),
  ADD CONSTRAINT "professionals_booking_horizon_days_check" CHECK ("booking_horizon_days" BETWEEN 1 AND 365),
  ADD CONSTRAINT "professionals_closing_reminder_offset_min_check" CHECK ("closing_reminder_offset_min" >= 0),
  -- RN-90 (formato; a lista de reservados fica na aplicação)
  ADD CONSTRAINT "professionals_slug_check" CHECK (
    -- ::text: em citext o operador ~ ignora maiúsculas e aceitaria "Ana".
    "slug" IS NULL OR ("slug"::text ~ '^[a-z0-9]+(-[a-z0-9]+)*$' AND length("slug") BETWEEN 3 AND 40)
  );

-- RN-10
ALTER TABLE "services"
  ADD CONSTRAINT "services_price_cents_check" CHECK ("price_cents" >= 0),
  ADD CONSTRAINT "services_duration_min_check" CHECK (
    "duration_min" BETWEEN 5 AND 600 AND "duration_min" % 5 = 0
  );

-- RN-20
-- Janelas em minutos desde a meia-noite local: 0 <= início < fim <= 1440 (1440 = 24:00, Q-15).
-- Q-17: janelas do mesmo dia não se sobrepõem; '[)' permite as que só se encostam.
ALTER TABLE "weekly_schedule_windows"
  ADD CONSTRAINT "weekly_schedule_windows_weekday_check" CHECK ("weekday" BETWEEN 0 AND 6),
  ADD CONSTRAINT "weekly_schedule_windows_time_check" CHECK (
    0 <= "start_min" AND "start_min" < "end_min" AND "end_min" <= 1440
  ),
  ADD CONSTRAINT "weekly_schedule_windows_no_overlap" EXCLUDE USING gist (
    "professional_id" WITH =,
    "weekday" WITH =,
    int4range("start_min", "end_min", '[)') WITH &&
  );

-- RN-21
ALTER TABLE "exception_windows"
  ADD CONSTRAINT "exception_windows_time_check" CHECK (
    0 <= "start_min" AND "start_min" < "end_min" AND "end_min" <= 1440
  ),
  ADD CONSTRAINT "exception_windows_no_overlap" EXCLUDE USING gist (
    "exception_id" WITH =,
    int4range("start_min", "end_min", '[)') WITH &&
  );

-- RN-80
ALTER TABLE "clients"
  ADD CONSTRAINT "clients_phone_e164_check" CHECK ("phone_e164" ~ '^\+[1-9][0-9]{9,14}$');

-- RN-11, RN-42, RN-52
ALTER TABLE "appointments"
  ADD CONSTRAINT "appointments_time_check" CHECK ("start_at" < "end_at" AND "end_at" <= "block_end_at"),
  ADD CONSTRAINT "appointments_price_cents_snapshot_check" CHECK ("price_cents_snapshot" >= 0),
  ADD CONSTRAINT "appointments_paid_cents_check" CHECK ("paid_cents" IS NULL OR "paid_cents" >= 0),
  -- RN-52: concluído exige valor recebido e forma de pagamento.
  ADD CONSTRAINT "appointments_completed_payment_check" CHECK (
    "status" <> 'COMPLETED' OR ("paid_cents" IS NOT NULL AND "payment_method" IS NOT NULL)
  ),
  -- RN-53: cancelado exige quem cancelou.
  ADD CONSTRAINT "appointments_cancelled_by_check" CHECK (
    "status" <> 'CANCELLED' OR "cancelled_by" IS NOT NULL
  );

-- RN-40
ALTER TABLE "slot_holds"
  ADD CONSTRAINT "slot_holds_time_check" CHECK ("start_at" < "end_at" AND "end_at" <= "block_end_at");

ALTER TABLE "manual_blocks"
  ADD CONSTRAINT "manual_blocks_time_check" CHECK ("start_at" < "end_at");
