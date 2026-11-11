# Contratos da API (REST, JSON)

> Fonte de verdade executável: schemas Zod em `packages/contracts`.
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
`SLOT_UNAVAILABLE`(409), `SLUG_TAKEN`(409), `HOLD_EXPIRED`(410),
`INVALID_TRANSITION`(422), `RATE_LIMITED`(429).

## Infraestrutura (fora de `/v1`, sem auth)

| Método | Rota      | Descrição                                                                   |
| ------ | --------- | --------------------------------------------------------------------------- |
| GET    | `/health` | Liveness, sem acesso ao banco → `{ status: 'ok' }` (`healthResponseSchema`) |

## Público (booking web, sem auth)

| Método | Rota                                                       | Descrição                                                                    |
| ------ | ---------------------------------------------------------- | ---------------------------------------------------------------------------- |
| GET    | `/v1/public/:slug`                                         | Perfil público, tema, política de cancelamento, serviços públicos            |
| GET    | `/v1/public/:slug/availability?serviceId=&date=YYYY-MM-DD` | Slots do dia (UTC) + `timezone`                                              |
| GET    | `/v1/public/:slug/availability/days?serviceId=&from=&to=`  | Dias com ao menos 1 slot (para o calendário)                                 |
| POST   | `/v1/public/:slug/holds`                                   | `{serviceId, startAt}` → `{holdToken, expiresAt}` · 409 se ocupado           |
| DELETE | `/v1/public/:slug/holds/:holdToken`                        | Libera o hold (cliente voltou)                                               |
| POST   | `/v1/public/:slug/bookings`                                | `{holdToken, name, phone, notes?}` → agendamento confirmado · 410 se expirou |

## Profissional (auth)

| Método    | Rota                                                    | Descrição                                    |
| --------- | ------------------------------------------------------- | -------------------------------------------- |
| POST      | `/v1/auth/register` · `/login` · `/refresh` · `/logout` | Autenticação                                 |
| GET/PATCH | `/v1/me`                                                | Perfil, tema, timezone, parâmetros de agenda |
| GET       | `/v1/me/slug-availability?slug=`                        | Checa slug                                   |
| CRUD      | `/v1/services`                                          | Serviços                                     |
| GET/PUT   | `/v1/schedule/weekly`                                   | Escala semanal (substitui o conjunto)        |
| CRUD      | `/v1/schedule/exceptions`                               | Folgas/datas especiais                       |
| CRUD      | `/v1/blocks`                                            | Bloqueios manuais                            |
| GET       | `/v1/appointments?from=&to=`                            | Agenda (dia/semana)                          |
| POST      | `/v1/appointments`                                      | Agendamento manual                           |
| POST      | `/v1/appointments/:id/transitions`                      | `{to, paymentMethod?, paidCents?, reason?}`  |
| GET       | `/v1/appointments/stream`                               | SSE: `appointment.created/updated`           |
| GET       | `/v1/closures/:date`                                    | Pendentes + totais do dia                    |
| POST      | `/v1/closures/:date`                                    | Fecha o dia (lote de transições + despesas)  |
| CRUD      | `/v1/expenses`                                          | Despesas                                     |
| CRUD      | `/v1/clients`                                           | CRM                                          |
| POST      | `/v1/clients/import`                                    | Lote de `{name, phone}` selecionados no app  |
| GET       | `/v1/reports/summary?period=day                         | week                                         | month | year&date=` | KPIs (RN-70..77) |
| GET       | `/v1/reports/services?from=&to=`                        | Ranking de serviços                          |
| GET       | `/v1/reports/cashflow?from=&to=`                        | Entradas por método − despesas               |
| POST      | `/v1/push-tokens`                                       | Registra token Expo                          |
| POST      | `/v1/invites/preview`                                   | Renderiza mensagem de convite com link       |

## Webhooks

| Método | Rota                              | Descrição                                 |
| ------ | --------------------------------- | ----------------------------------------- |
| POST   | `/v1/webhooks/whatsapp/:provider` | Status de entrega; assinatura obrigatória |
