# ADR-0004: Integração WhatsApp em fases

- Status: proposto (confirmar provedor antes da fase 5)
- Data: 2026-11-11

## Contexto

A spec pede confirmação automática por WhatsApp e "disparo em massa" de convites, citando
API oficial ou Z-API. Há custo por mensagem, exigência de templates aprovados na API
oficial e risco de bloqueio de número com provedores não oficiais e envios em massa.

## Decisão

- **Fase A (MVP):** deep links `wa.me` — a profissional envia convites manualmente; a cliente
  recebe na tela de sucesso um botão que abre o WhatsApp com o resumo do agendamento.
- **Fase B:** confirmação automática via porta `WhatsAppGateway` com adapter do provedor
  escolhido, enviada por fila com retry. Não implementar disparo em massa automático.
- Antes da fase 5: pesquisar as políticas e preços vigentes dos provedores, decidir e
  atualizar este ADR para "aceito" com o provedor escolhido.

## Alternativas consideradas

- Integrar provedor desde o dia 1 — bloqueia o MVP em contratação/aprovação de templates.
- SMS — custo e baixa adesão no público-alvo.

## Consequências

- O booking nunca depende do sucesso do envio.
- Trocar de provedor = novo adapter, sem tocar no domínio.
