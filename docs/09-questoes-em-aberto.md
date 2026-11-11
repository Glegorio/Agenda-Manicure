# Questões em Aberto

> Ambiguidades e lacunas encontradas na especificação. Cada item tem uma **decisão
> provisória** para não travar o desenvolvimento. Quando o produto decidir, mova a
> decisão para o doc correto (ou um ADR) e marque como resolvida.
>
> **Regra para o Claude:** se uma tarefa esbarrar em uma questão aberta, use a decisão
> provisória e cite o ID (`Q-xx`) no código/PR. Não invente outra.

| ID | Questão | Decisão provisória | Status |
|---|---|---|---|
| Q-01 | Um estabelecimento pode ter várias profissionais (salão)? | Não no MVP. Modelo usa `professional_id`; não criar `establishment` ainda. | aberta |
| Q-02 | Buffer precisa caber antes do fechamento? | Não (RN-35). | provisória |
| Q-03 | Grade "Mensal" da spec significa o quê? | Escala semanal + exceções por data cobrem o caso. | provisória |
| Q-04 | Cliente pode cancelar/remarcar sozinha? | Link de cancelamento na confirmação respeitando a política (fase 5+). Remarcação = cancelar + novo. | aberta |
| Q-05 | Login da profissional: e-mail/senha ou OTP por telefone? | E-mail + senha no MVP. OTP por WhatsApp depois. | provisória |
| Q-06 | "Disparo em massa" pela API do WhatsApp | Não automático no MVP (risco de bloqueio e LGPD). Deep link por contato. | provisória |
| Q-07 | Cobrança de sinal / pagamento online? | Fora do MVP. | provisória |
| Q-08 | Antecedência mínima e horizonte padrão | 120 min / 30 dias, configuráveis. | provisória |
| Q-09 | Imagem do serviço: upload onde? | Storage S3-compatível (ex.: R2) via URL pré-assinada. Decidir provedor na fase 3. | aberta |
| Q-10 | Modelo de cobrança do SaaS (planos)? | Fora do escopo técnico do MVP. | aberta |
| Q-11 | Tempo real: WebSocket (spec) vs SSE | SSE (ADR-0001). | provisória |
| Q-12 | Lembretes D-1 para a cliente | Pós-MVP; infra de fila já suporta. | provisória |
| Q-13 | Valor cobrado diferente do preço (desconto)? | Sim, `paid_cents` editável no fechamento (RN-52). | provisória |
| Q-14 | Uma cliente pode agendar mais de um serviço na mesma visita? | Não no MVP (1 serviço por agendamento). | aberta |
