# Glossário (PT ⇄ código)

O código é escrito em **inglês** (identificadores); a UI e a documentação em **português**.
Use esta tabela para nomear coisas de forma consistente.

| Termo de negócio (PT)      | Identificador no código | Notas                                                          |
| -------------------------- | ----------------------- | -------------------------------------------------------------- |
| Profissional               | `professional`          | dona da conta                                                  |
| Cliente (final)            | `client`                | quem agenda; não confundir com "HTTP client" (use `apiClient`) |
| Serviço                    | `service`               | ex.: Alongamento em Gel                                        |
| Agendamento                | `appointment`           |                                                                |
| Reserva temporária / trava | `slotHold` / `hold`     | 5 min                                                          |
| Horário disponível         | `slot`                  | início possível                                                |
| Janela de trabalho         | `workWindow`            |                                                                |
| Escala semanal             | `weeklySchedule`        |                                                                |
| Exceção de data / folga    | `scheduleException`     |                                                                |
| Bloqueio manual            | `manualBlock`           |                                                                |
| Intervalo de transição     | `bufferMin`             |                                                                |
| Antecedência mínima        | `minNoticeMin`          |                                                                |
| Fechamento do dia          | `dayClosure`            |                                                                |
| Baixa (dar baixa)          | `complete` transition   |                                                                |
| Falta                      | `NO_SHOW`               |                                                                |
| Despesa                    | `expense`               |                                                                |
| Faturamento bruto          | `grossRevenueCents`     |                                                                |
| Ticket médio               | `averageTicketCents`    |                                                                |
| Forma de pagamento         | `paymentMethod`         | `PIX`, `CREDIT_CARD`, `DEBIT_CARD`, `CASH`                     |
| Link de agendamento        | `bookingLink` / `slug`  |                                                                |
| Paleta                     | `themePalette`          |                                                                |
