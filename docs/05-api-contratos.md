# Contratos da API (REST, JSON)

> Fonte de verdade executável: schemas Zod em `packages/contracts` (common, errors, service,
> schedule, availability, booking — tarefa 1.6; auth, clientes, relatórios entram nas fases 2–7).
> Este documento é o índice humano. Mudou um endpoint? Atualize os dois no mesmo PR.

## Convenções

- Base: `/v1`. JSON `camelCase`. Datas ISO-8601 com `Z` (UTC). Dinheiro: `priceCents` (int).
- Autenticação da profissional: `Authorization: Bearer <access>`; refresh em `/v1/auth/refresh`.
- Paginação por cursor: `?cursor=&limit=` → `{ items, nextCursor }`.
- Erro padrão:

```json
{
  "error": {
    "code": "SLOT_UNAVAILABLE",
    "message": "Este horário acabou de ser reservado.",
    "details": {}
  }
}
```

Códigos de erro de domínio (sempre `UPPER_SNAKE`):
`VALIDATION_ERROR`(400), `UNAUTHORIZED`(401), `FORBIDDEN`(403), `NOT_FOUND`(404),
`SLOT_UNAVAILABLE`(409), `SLUG_TAKEN`(409), `EMAIL_TAKEN`(409), `HOLD_EXPIRED`(410),
`INVALID_TRANSITION`(422), `RATE_LIMITED`(429), `INTERNAL_ERROR`(500), `SERVICE_UNAVAILABLE`(503).

Na API: services lançam `DomainError(code, message?, details?)` (mensagem padrão em PT-BR por
código); entrada validada com `ZodValidationPipe(schema)` → `400 VALIDATION_ERROR` com
`details.issues: [{ path, message }]`. O filtro global põe toda resposta de erro no envelope;
erros inesperados viram `500 INTERNAL_ERROR` sem expor a mensagem interna.

## Infraestrutura (fora de `/v1`, sem auth)

| Método | Rota            | Descrição                                                                                                                                           |
| ------ | --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| GET    | `/health`       | Liveness, sem acesso ao banco → `{ status: 'ok' }` (`healthResponseSchema`)                                                                         |
| GET    | `/health/ready` | Readiness: `SELECT 1` no banco → `{ status: 'ok', database: 'up' }` (`readinessResponseSchema`) · `503 SERVICE_UNAVAILABLE` se o banco não responde |

## Público (booking web, sem auth)

| Método | Rota                                                       | Descrição                                                                                                                                                                                                                        |
| ------ | ---------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GET    | `/v1/public/:slug`                                         | `publicProfileResponseSchema`: nome, fuso, cidade/UF (endereço completo só com `showFullAddress`, Q-27), tema, política (RN-92) e serviços `active && public` (RN-91); sem e-mail, CEP ou coordenadas · 404 se o slug não existe |
| GET    | `/v1/public/:slug/availability?serviceId=&date=YYYY-MM-DD` | Slots do dia (UTC) + `timezone` (RN-30..36, RN-02a) · 404 se o serviço não é visível · `Cache-Control: no-store`                                                                                                                 |
| GET    | `/v1/public/:slug/availability/days?serviceId=&from=&to=`  | Dias com ao menos 1 slot (calendário), período < 62 dias, recortado em [hoje, hoje + horizonte] · 404 se o serviço não é visível                                                                                                 |
| POST   | `/v1/public/:slug/holds`                                   | `{serviceId, startAt}` → `{holdToken, expiresAt}` · 409 se ocupado                                                                                                                                                               |
| DELETE | `/v1/public/:slug/holds/:holdToken`                        | Libera o hold (cliente voltou)                                                                                                                                                                                                   |
| POST   | `/v1/public/:slug/bookings`                                | `{holdToken, name, phone, notes?}` → agendamento confirmado · 410 se expirou                                                                                                                                                     |

## Autenticação (`/v1/auth`, pública — ADR-0009)

| Método | Rota                | Corpo → resposta                                                                                                       |
| ------ | ------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| POST   | `/v1/auth/register` | `registerRequestSchema` (`slug` opcional, Q-21) → `201` `authSessionResponseSchema` · `409 EMAIL_TAKEN` / `SLUG_TAKEN` |
| POST   | `/v1/auth/login`    | `loginRequestSchema` → `200` sessão · `401` "E-mail ou senha incorretos." (mesma resposta para e-mail inexistente)     |
| POST   | `/v1/auth/refresh`  | `{ refreshToken }` → `200` sessão nova (rotação; o antigo deixa de valer) · `401` se inválido, expirado ou reusado     |
| POST   | `/v1/auth/logout`   | `{ refreshToken }` → `204` (revoga a sessão; idempotente)                                                              |

Sessão: `{ accessToken, accessTokenExpiresAt, refreshToken, refreshTokenExpiresAt, professional: { id, email, businessName, slug } }`.
Access de 15 min, refresh de 30 dias (Q-22). Reusar um refresh já trocado encerra aquela sessão.

## Profissional (auth)

Toda rota abaixo exige `Authorization: Bearer <access>` (guard global; sem token → `401 UNAUTHORIZED`).

| Método          | Rota                                | Descrição                                                                                                                                                                                                                                                                          |
| --------------- | ----------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GET/PATCH       | `/v1/me`                            | Perfil (`professionalProfileSchema`); PATCH parcial (`professionalUpdateSchema`: nome, slug [Q-21], endereço, tema, política, RN-22..25, RN-60) · `409 SLUG_TAKEN`                                                                                                                 |
| GET             | `/v1/me/slug-availability?slug=`    | `{ slug, available, reason? }` com `INVALID_FORMAT` \| `RESERVED` \| `TAKEN` (RN-90); o slug atual da própria conta conta como livre                                                                                                                                               |
| CRUD            | `/v1/services`                      | `serviceInputSchema`/`serviceUpdateSchema` → `serviceResponseSchema` (lista inclui inativos, por `sortOrder`); outra profissional → 404 · `DELETE` → `200 { outcome }` (`DELETED` ou `DEACTIVATED`) (Q-24, RN-12: desativa se houver agendamento de qualquer status ou hold ativo) |
| GET/PUT         | `/v1/schedule/weekly`               | `{ windows: [{ weekday, start, end }] }` em `HH:mm` (RN-20, Q-17); PUT substitui o conjunto e devolve `affectedAppointments` (futuros ativos que a mudança tirou do horário, Q-20/Q-26)                                                                                            |
| GET/PUT/DELETE  | `/v1/schedule/exceptions`           | `GET ?from=&to=` (datas locais, ≤ 366 dias) · `PUT /:date` cria ou substitui (`exceptionBodySchema`, RN-21) · `DELETE /:date` (404 se não existe); PUT e DELETE devolvem `affectedAppointments` do dia (Q-26)                                                                      |
| GET/POST/DELETE | `/v1/blocks`                        | `GET ?from=&to=` (instantes UTC) · `POST` (`blockInputSchema`) → `201 { block, affectedAppointments }` (ativos, não terminados, sobrepostos — Q-26) · `DELETE /:id` → 204                                                                                                          |
| GET             | `/v1/appointments?from=&to=`        | Agenda (dia/semana)                                                                                                                                                                                                                                                                |
| POST            | `/v1/appointments`                  | Agendamento manual                                                                                                                                                                                                                                                                 |
| POST            | `/v1/appointments/:id/transitions`  | `{to, paymentMethod?, paidCents?, reason?}`                                                                                                                                                                                                                                        |
| GET             | `/v1/appointments/stream`           | SSE: `appointment.created/updated`                                                                                                                                                                                                                                                 |
| GET             | `/v1/closures/:date`                | Pendentes + totais do dia                                                                                                                                                                                                                                                          |
| POST            | `/v1/closures/:date`                | Fecha o dia (lote de transições + despesas)                                                                                                                                                                                                                                        |
| CRUD            | `/v1/expenses`                      | Despesas                                                                                                                                                                                                                                                                           |
| CRUD            | `/v1/clients`                       | CRM                                                                                                                                                                                                                                                                                |
| POST            | `/v1/clients/import`                | Lote de `{name, phone}` selecionados no app                                                                                                                                                                                                                                        |
| GET             | `/v1/reports/summary?period=&date=` | KPIs (RN-70..77); `period` = `day`, `week`, `month` ou `year`                                                                                                                                                                                                                      |
| GET             | `/v1/reports/services?from=&to=`    | Ranking de serviços                                                                                                                                                                                                                                                                |
| GET             | `/v1/reports/cashflow?from=&to=`    | Entradas por método − despesas                                                                                                                                                                                                                                                     |
| POST            | `/v1/push-tokens`                   | Registra token Expo                                                                                                                                                                                                                                                                |
| POST            | `/v1/invites/preview`               | Renderiza mensagem de convite com link                                                                                                                                                                                                                                             |

Transições (`POST /v1/appointments/:id/transitions`, RN-52..54, domínio em `@agende/scheduling`):

- `to` ∈ `IN_PROGRESS | COMPLETED | NO_SHOW | CANCELLED`; transição fora da tabela RN-54 → `422 INVALID_TRANSITION`.
- `COMPLETED`: `paymentMethod` obrigatório; `paidCents` opcional — o service usa `price_cents` do snapshot quando ausente (Q-13).
- `CANCELLED`: `cancelledBy` **não** vem do body — é `PROFESSIONAL` nesta rota (token); `CLIENT` só pelo link da cliente (Q-04).
- Dados inválidos (Zod ou domínio, `VALIDATION_ERROR`) → `400`.
- Concorrência: o update condiciona `status = :from` na mesma transação; 0 linhas afetadas → `422 INVALID_TRANSITION`.

## Webhooks

| Método | Rota                              | Descrição                                 |
| ------ | --------------------------------- | ----------------------------------------- |
| POST   | `/v1/webhooks/whatsapp/:provider` | Status de entrega; assinatura obrigatória |
