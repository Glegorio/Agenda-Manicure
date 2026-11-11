# WhatsApp, Push e LGPD

## Estratégia em fases (ver ADR-0004)

| Fase    | Canal                                                                                   | Custo                    | Automático?                            | Uso                                                                              |
| ------- | --------------------------------------------------------------------------------------- | ------------------------ | -------------------------------------- | -------------------------------------------------------------------------------- |
| A (MVP) | **Deep link** `https://wa.me/<num>?text=<urlencoded>`                                   | zero                     | Não — abre o WhatsApp com texto pronto | Convites da profissional; botão "Receber confirmação no WhatsApp" para a cliente |
| B       | **Provedor** atrás da porta `WhatsAppGateway` (Z-API **ou** WhatsApp Cloud API oficial) | por mensagem/mensalidade | Sim                                    | Confirmação automática após booking, lembretes                                   |

`wa.me` funciona em qualquer navegador/dispositivo; `whatsapp://send?text=` só funciona com
o app instalado — use `wa.me` como padrão e `whatsapp://` apenas dentro do app mobile
via `Linking.canOpenURL`.

## Porta `WhatsAppGateway`

```ts
interface WhatsAppGateway {
  sendText(input: {
    toE164: string;
    body: string;
    idempotencyKey: string;
  }): Promise<{ providerMessageId: string }>;
  sendTemplate(input: {
    toE164: string;
    template: string;
    language: 'pt_BR';
    params: string[];
    idempotencyKey: string;
  }): Promise<{ providerMessageId: string }>;
}
```

Implementações: `NoopWhatsAppGateway` (dev/test, grava em log), `ZApiGateway`, `CloudApiGateway`.
Selecionada por `WHATSAPP_PROVIDER=noop|zapi|cloud`.

Envio sempre via **fila (pg-boss)** com retry exponencial (3 tentativas) e registro em
`notification_logs`. O booking **não falha** se o WhatsApp falhar.

## Cuidados importantes (riscos reais)

- **API oficial (Cloud API):** mensagens iniciadas pela empresa fora da janela de 24 h
  exigem **template aprovado** pela Meta. A mensagem de confirmação da spec deve ser
  cadastrada como template com parâmetros `{{1}}..{{6}}`.
- **Provedores não oficiais (ex.: Z-API, baseados em WhatsApp Web):** há risco de
  bloqueio do número, sobretudo com **disparo em massa**. Não implementar "disparo em
  massa" automático para contatos que não pediram — no MVP o "disparo" é a profissional
  abrindo conversas uma a uma (deep link) ou compartilhando em lista de transmissão.
- Validar o estado atual das políticas do provedor escolhido antes da fase 5
  (registrar no ADR-0004).

## Template de confirmação

Placeholders do template editável da profissional:
`{nome}`, `{data}` (DD/MM/AAAA), `{hora}` (HH:MM), `{servico}`, `{valor}` (R$ 0,00),
`{endereco}`, `{profissional}`, `{link_cancelamento}`.

Padrão (spec 3.3):

```
Olá {nome}, seu agendamento foi confirmado!
📅 Data: {data} às {hora}
💅 Serviço: {servico}
💰 Valor: {valor}
📍 Endereço: {endereco}
👤 Profissional: {profissional}
```

Renderização em `packages/contracts` (função pura `renderTemplate`) com testes:
placeholder desconhecido é mantido literal; datas no fuso da profissional.

## Push (app da profissional)

- Expo Push Notifications (`expo-notifications`), token salvo em `push_tokens`.
- Eventos: novo agendamento via web; cancelamento; lembrete de fechamento diário (RN-60).
- Ações na notificação abrem a tela certa via deep link do Expo Router.

## LGPD — requisitos mínimos

- **Base legal** para mensagens transacionais (confirmação): execução de contrato/pedido da
  própria cliente. Para convites/marketing: **consentimento** — registrar `consent_marketing_at`.
- **Importação de contatos:** permissão explícita do SO + tela explicando o uso; a
  profissional seleciona contatos; nunca enviar a agenda inteira ao servidor.
- **Minimização:** guardar só nome, telefone, observações.
- **Direitos do titular:** endpoint/admin para exportar e excluir dados de uma cliente.
- **Logs:** telefone mascarado (`+55 11 9****-8888`).
- Política de privacidade e termos linkados na página pública.

> Este documento não é aconselhamento jurídico; valide com um profissional antes do lançamento.
