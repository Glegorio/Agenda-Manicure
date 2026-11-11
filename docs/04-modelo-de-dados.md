# Modelo de Dados (PostgreSQL 16 + Prisma)

> Rascunho de referência. O schema real vive em `apps/api/prisma/schema.prisma`.
> Mudou o schema? Atualize este arquivo no mesmo PR.

## Convenções

- Tabelas em `snake_case` plural; Prisma models em `PascalCase` com `@@map`.
- PK `id uuid` (v7 gerado na aplicação, ordenável por tempo).
- `created_at`, `updated_at` em toda tabela (`timestamptz`).
- Dinheiro: `*_cents integer` (ou `bigint` em agregados). **Nunca** `float`/`decimal` em JS.
- Instantes: `timestamptz` (UTC). Horas de escala: `time` + `timezone` da profissional.
- Enums Postgres para status e formas de pagamento.

## Entidades

```
professionals 1─┬─* services
                ├─* weekly_schedule_windows
                ├─* schedule_exceptions ─* exception_windows
                ├─* clients ─* client_tags
                ├─* appointments *─1 clients
                │        └─ *─1 services (nullable; snapshot é a fonte)
                ├─* slot_holds
                ├─* manual_blocks
                ├─* expenses
                ├─* day_closures
                ├─* notification_logs
                └─* push_tokens
```

### professionals

| coluna                         | tipo                                                            | notas                            |
| ------------------------------ | --------------------------------------------------------------- | -------------------------------- |
| id                             | uuid                                                            |                                  |
| email                          | citext unique                                                   | login                            |
| password_hash                  | text                                                            | argon2id                         |
| business_name                  | text                                                            |                                  |
| slug                           | citext unique                                                   | RN-90                            |
| timezone                       | text                                                            | IANA, padrão `America/Sao_Paulo` |
| address_line, city, state, zip | text                                                            |                                  |
| lat, lng                       | double precision null                                           | geolocalização                   |
| logo_url, cover_url            | text null                                                       |                                  |
| theme_palette                  | enum `ROSE_GOLD`,`NUDE_MINIMAL`,`ELEGANCE_BLACK`,`PASTEL_LILAC` |                                  |
| theme_mode                     | enum `LIGHT`,`DARK`,`SYSTEM`                                    |                                  |
| buffer_min                     | smallint                                                        | 0–60, padrão 10                  |
| slot_step_min                  | smallint                                                        | 5/10/15/30, padrão 15            |
| min_notice_min                 | int                                                             | padrão 120                       |
| booking_horizon_days           | smallint                                                        | padrão 30                        |
| cancellation_policy            | text                                                            | exibida na etapa 3               |
| whatsapp_confirmation_template | text                                                            | com placeholders                 |
| closing_reminder_offset_min    | smallint                                                        | padrão 30                        |

### services

`id, professional_id, name, category, description, image_url, price_cents int, duration_min smallint, active bool, public bool, sort_order int`

### weekly_schedule_windows

`id, professional_id, weekday smallint (0=dom..6=sáb), start_time time, end_time time` — `CHECK (start_time < end_time)`.

### schedule_exceptions / exception_windows

`schedule_exceptions(id, professional_id, date date, closed bool, note)` unique `(professional_id, date)`;
`exception_windows(id, exception_id, start_time, end_time)`.

### clients

`id, professional_id, name, phone_e164, notes, source enum(WEB,MANUAL,CONTACT_IMPORT), consent_marketing_at timestamptz null` — unique `(professional_id, phone_e164)`.

### appointments

| coluna                | tipo             | notas                                   |
| --------------------- | ---------------- | --------------------------------------- |
| id                    | uuid             |                                         |
| professional_id       | uuid             |                                         |
| client_id             | uuid             |                                         |
| service_id            | uuid null        |                                         |
| service_name_snapshot | text             | RN-11                                   |
| price_cents_snapshot  | int              |                                         |
| duration_min_snapshot | smallint         |                                         |
| start_at              | timestamptz      |                                         |
| end_at                | timestamptz      | `start_at + duration`                   |
| block_end_at          | timestamptz      | `end_at + buffer` vigente no momento    |
| status                | enum             | RN-50                                   |
| source                | enum `WEB`,`APP` |                                         |
| client_notes          | text             | observações da etapa 3                  |
| paid_cents            | int null         | RN-52                                   |
| payment_method        | enum null        | `PIX`,`CREDIT_CARD`,`DEBIT_CARD`,`CASH` |
| cancelled_by          | enum null        |                                         |
| cancel_reason         | text null        |                                         |
| status_changed_at     | timestamptz      |                                         |

**Constraint anti double-booking (SQL cru na migration — Prisma não gera):**

```sql
CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE appointments
  ADD CONSTRAINT appointments_no_overlap
  EXCLUDE USING gist (
    professional_id WITH =,
    tstzrange(start_at, block_end_at, '[)') WITH &&
  )
  WHERE (status IN ('SCHEDULED', 'IN_PROGRESS'));
```

Índices: `(professional_id, start_at)`, `(professional_id, status, start_at)`.

### slot_holds

`id, professional_id, service_id, start_at, end_at, block_end_at, token_hash text unique, expires_at timestamptz, created_at` — índice `(professional_id, expires_at)`.

### manual_blocks

`id, professional_id, start_at, end_at, reason` — bloqueios pontuais criados pela profissional.

### expenses

`id, professional_id, date date, description, category, amount_cents int`.

### day_closures

`id, professional_id, date date, closed_at, reopened_at null, totals jsonb` — unique `(professional_id, date)`.

### notification_logs

`id, professional_id, appointment_id null, channel enum(WHATSAPP,PUSH), template, to_masked, status enum(QUEUED,SENT,FAILED,DELIVERED,READ), provider_message_id, error, attempts, created_at`.

### push_tokens

`id, professional_id, expo_push_token unique, platform, last_seen_at`.
