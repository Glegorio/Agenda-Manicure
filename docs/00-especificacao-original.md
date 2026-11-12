# Especificação Técnica Original — System Core & Web Booking Engine

> Este é o documento de especificação recebido, apenas reformatado em Markdown.
> **Não edite este arquivo** — ele é a fonte histórica. Decisões e refinamentos
> ficam em `docs/01-visao-produto.md`, `docs/02-regras-de-negocio.md` e nos ADRs.

## 1. Visão Geral do Produto (Product Vision)

Plataforma SaaS Mobile-First direcionada a manicures e profissionais autônomas de estética, composta por:

- **App Mobile (Android/iOS):** Painel operacional, financeiro e administrativo da profissional.
- **Web Booking App (PWA Web App):** Aplicação client-side leve (sem necessidade de instalação) para agendamento self-service pelo cliente final.

## 2. Arquitetura do Sistema e Fluxo de Dados

```
[ App Mobile (Manicure) ] ──(REST API/WebSocket)──> [ Backend Cloud ]
                                                          │
[ WhatsApp Web / Client ] <───(Webhooks / API)────────────┤
                                                          │
[ Web App (Cliente Final) ] ──(REST API / Sync)───────────┘
```

### 2.1. Regras de Negócio Principais (Core Business Logic)

**Algoritmo de Slot Dinâmico (Dynamic Time-Slot Calculation):**
O sistema não trabalha apenas com horários fixos de início, mas calcula a grade em função de:
Horário de Início + Duração Estimada do Serviço + Intervalo de Transição (Buffer Time).

*Exemplo:* Se a profissional abre às 08:00, oferece Alongamento em Gel (120 min) e tem Buffer Time de 15 min, o próximo slot vago é calculado automaticamente para 10:15.

**Sincronização Atômica de Agenda (Concurrency Management):**
Trava temporária de 5 minutos no banco de dados enquanto o cliente preenche o formulário na Web, evitando double-booking (dois agendamentos no mesmo horário simultaneamente).

## 3. Módulos e Funcionalidades Detalhadas

### 3.1. Módulo de Configurações e Parâmetros (Admin Setup)

- **Gestão de Serviços:** CRUD de serviços com parâmetros de Nome, Preço (R$), Duração Estimada (min) e Categoria.
- **Escala de Trabalho e Janelas de Agendamento:**
  - Definição de grade Semanal/Mensal (Dias de Atendimento, Horário Início/Fim, Pausa de Almoço/Intervalos).
  - Configuração de Buffer Time de segurança entre atendimentos (ex: 10, 15 ou 20 minutos).
- **Perfil do Estabelecimento/Profissional:** Nome comercial, foto de capa/logo, endereço físico com suporte a geolocalização, regras de cancelamento e mensagem padrão para confirmação via WhatsApp.

### 3.2. Módulo de Integração com Contatos e Disparo de Links

- **Importação via Contact API Native:** Leitura e categorização dos contatos do celular da profissional para criação da base de clientes (CRM básico).
- **Deep Linking & WhatsApp Dispatcher:**
  - Geração de URL única com slug personalizado (ex: `agende.app/nail-designer-ana`).
  - Disparo em massa de convites e links de agendamento através da API do WhatsApp ou via acionamento direto do app (`whatsapp://send?text=...`).

### 3.3. Web Booking Engine (Interface da Cliente)

- **UX/UI Responsiva e PWA:** Interface idêntica à identidade visual definida pela profissional, carregando em menos de 2 segundos em conexões 3G/4G.
- **Fluxo em 3 Etapas:**
  1. Seleção do Serviço: Card descritivo com preço, imagem e duração.
  2. Seleção de Data e Slot: Calendário dinâmico exibindo apenas horários disponíveis validados.
  3. Identificação e Confirmação: Formulário com Nome, Telefone (WhatsApp) e Observações.
- **Notificação Automática via WhatsApp (Outbound Message):** Confirmação imediata enviada ao cliente com o payload formatado:

```
Olá [Nome], seu agendamento foi confirmado!
📅 Data: DD/MM/AAAA às HH:MM
💅 Serviço: [Nome do Serviço]
💰 Valor: R$ [Preço]
📍 Endereço: [Endereço da Profissional]
👤 Profissional: [Nome da Profissional]
```

### 3.4. Gestão Operacional e Fechamento Diário

- **Visão Principal em Calendário (Agenda Hub):** Visualização diária/semanal em estilo Time-Grid com status por cores (Agendado, Em Andamento, Concluído, Cancelado, Falta/No-Show).
- **Push Notifications & Ritual de Fechamento (End-of-Day Reconciliation):**
  - Disparo de notificação interna no aplicativo ao final do expediente para validação dos atendimentos pendentes do dia.
  - Tela rápida de baixa: confirmação do status de presença, forma de pagamento (PIX, Cartão de Crédito/Débito, Dinheiro) e inclusão de custos/despesas extras caso ocorram.

### 3.5. Dashboard Financeiro e Analytics

Métricas Principais (KPIs):

- **Faturamento Bruto:** Visão Diária, Semanal, Mensal e Anual.
- **Volume de Atendimentos:** Total de agendamentos realizados vs. cancelados vs. faltas (Taxa de No-Show).
- **Ticket Médio:** Valor médio gasto por cliente por atendimento.
- **Serviços Mais Lucrativos:** Gráfico de distribuição por tipo de serviço efetuado.
- **Fluxo de Caixa Simplificado:** Entradas de recebimento segregadas por método de pagamento.

## 4. Diretrizes de UI/UX e Design System

### 4.1. Fundamentos Visuais

- **Arquitetura de Cores Dinâmicas (Theming Engine):** Suporte a temas claros/escuros (Light/Dark Mode) e personalização da cor primária através de paletas predefinidas (ex: Rose Gold, Nude Minimal, Elegance Black, Pastel Lilac). Garantia de contraste aceitável pelas normas de acessibilidade WCAG 2.1 (AA).
- **Componentização:** Uso massivo de Cards Elevados e com bordas arredondadas (Border Radius: 12px a 16px). Ícones vetoriais padronizados (ex: Lucide Icons ou Phosphor Icons).
- **Micro-interações:** Animações sutis (150ms a 300ms) ao alternar abas, agendar ou dar baixa financeira, com resposta tátil (haptic feedback).

### 4.2. Usabilidade Mobile (Thumb Zone Ergonomics)

Todos os botões primários de ação (CTA como "Agendar", "Salvar", "Confirmar Pagamento") devem se situar na área inferior da tela.

## 5. Sugestão de Stack Tecnológico

| Camada | Tecnologia Recomendada | Justificativa |
|---|---|---|
| Mobile App | React Native (Expo) / Flutter | Desenvolvimento híbrido rápido (iOS/Android) com alta performance de UI. |
| Web Booking (Client) | Next.js / React (PWA) | Carregamento ultrarrápido, otimizado para navegadores mobile. |
| Backend & API | Node.js (NestJS) ou Python (FastAPI) | Alta performance em I/O, fácil manipulação de datas e cronogramas. |
| Banco de Dados | PostgreSQL | Robusto, relacional, ideal para controle financeiro e concorrência de agenda. |
| Notificações & Whats | API Oficial WhatsApp Business / Z-API | Envio automatizado de mensagens de confirmação e lembretes. |
