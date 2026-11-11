# Visão do Produto

> Fonte histórica: [`00-especificacao-original.md`](00-especificacao-original.md).
> Este arquivo é a versão **viva** — atualize quando uma decisão de produto mudar.

## Problema

Manicures e profissionais autônomas de estética gerenciam agenda por WhatsApp e caderno.
Consequências: troca de mensagens para achar horário, double-booking, faltas sem controle
e nenhuma visão financeira.

## Solução

Uma plataforma SaaS mobile-first com duas superfícies:

| Superfície                            | Usuária         | Objetivo                                                                                 |
| ------------------------------------- | --------------- | ---------------------------------------------------------------------------------------- |
| **App Mobile** (iOS/Android)          | A profissional  | Configurar serviços e escala, ver a agenda, dar baixa nos atendimentos, ver o financeiro |
| **Web Booking** (PWA, sem instalação) | A cliente final | Escolher serviço → horário → confirmar, em menos de 1 minuto                             |

## Personas

- **Ana, nail designer autônoma** — atende sozinha em casa ou em sala alugada, 6–10 clientes/dia,
  usa o celular o dia inteiro com uma mão (a outra está ocupada). Não é técnica.
- **Cliente final** — recebe o link no WhatsApp, abre no navegador do celular, quer agendar rápido
  e receber a confirmação no WhatsApp. Não cria conta.

## Princípios de produto

1. **Zero atrito para a cliente final** — sem cadastro, sem senha, sem instalar nada.
2. **A agenda nunca mente** — um horário exibido como livre está livre; nunca há double-booking.
3. **Uma mão, polegar** — toda ação primária fica na parte inferior da tela.
4. **Rápido em 3G** — página de agendamento interativa em < 2 s em 3G/4G.
5. **Dinheiro é exato** — valores em centavos inteiros; nada de ponto flutuante.

## Escopo do MVP (v1)

Dentro:

- Uma profissional por conta (single-tenant por profissional; ver questões em aberto sobre salões).
- CRUD de serviços, escala semanal com pausas, buffer, exceções de data (folga/feriado).
- Link público com slug, fluxo de 3 etapas, hold de 5 min, confirmação.
- Confirmação ao cliente via WhatsApp (ver ADR-0004 para a estratégia por fases).
- Agenda Hub (dia/semana), mudança de status, fechamento diário, despesas extras.
- Dashboard com KPIs listados na spec.
- Importação de contatos do celular (com consentimento — ver LGPD).

Fora do MVP (backlog):

- Pagamento online / sinal (PIX cobrança).
- Múltiplas profissionais por estabelecimento.
- Lembretes automáticos D-1 (vem logo após o MVP, a infraestrutura já fica pronta).
- Fidelidade, cupons, avaliações.

## Métricas de sucesso

- % de agendamentos feitos via link (vs. manual no app).
- Taxa de no-show antes/depois.
- Tempo mediano do fluxo de agendamento web (meta: < 60 s).
- Retenção semanal das profissionais (fechamento diário feito ≥ 4×/semana).
