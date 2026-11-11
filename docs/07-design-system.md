# Design System

Tokens vivem em `packages/ui-tokens` e são consumidos por web (CSS variables) e mobile
(objeto de tema). **Nenhuma cor/raio/duração literal em componentes** — sempre token.

## Paletas (primária) — validar contraste AA antes de congelar

| Paleta         | `primary` (light) | `onPrimary` | `primary` (dark) | Observação                                          |
| -------------- | ----------------- | ----------- | ---------------- | --------------------------------------------------- |
| Rose Gold      | `#B76E79`         | `#FFFFFF`   | `#E8A9B2`        | conferir 4.5:1 do texto branco; escurecer se falhar |
| Nude Minimal   | `#A9826B`         | `#FFFFFF`   | `#D9B8A3`        | idem                                                |
| Elegance Black | `#1F1F1F`         | `#FFFFFF`   | `#F2F2F2`        | dark usa invertido                                  |
| Pastel Lilac   | `#8E7CC3`         | `#FFFFFF`   | `#C7B9F0`        | idem                                                |

Os hex acima são **pontos de partida**. A fase 3 inclui um teste automatizado
(`packages/ui-tokens/test/contrast.test.ts`) que calcula o contraste WCAG 2.1 de todas as
combinações texto/fundo usadas e **falha abaixo de 4.5:1** (texto normal) ou **3:1**
(texto grande ≥ 18.66 px bold / 24 px e componentes de UI).

Neutros e semânticos (comuns a todas as paletas): `background`, `surface`, `surfaceElevated`,
`textPrimary`, `textSecondary`, `border`, `success`, `warning`, `danger`, `muted`.

Status da agenda (RN-55): `status.scheduled = primary`, `status.inProgress = warning`,
`status.completed = success`, `status.cancelled = muted` (+ texto riscado),
`status.noShow = danger`. **Cor nunca é o único indicador** — sempre ícone + rótulo.

## Forma, espaço e tipografia

- Raio: `radius.md = 12`, `radius.lg = 16`, `radius.full = 9999` (chips).
- Espaçamento: escala 4 pt (`4, 8, 12, 16, 24, 32, 48`).
- Elevação de card: sombra suave no light; no dark, `surfaceElevated` mais clara em vez de sombra.
- Tipografia: fonte do sistema no mobile; web com 1 família variável (subset latin) ou system-ui.
  Tamanho mínimo de corpo 16 px (evita zoom no iOS em inputs).
- Ícones: **Lucide** (`lucide-react` / `lucide-react-native`), 20/24 px, stroke 1.75.

## Movimento

- Durações: `motion.fast = 150ms`, `motion.base = 220ms`, `motion.slow = 300ms`; easing `ease-out`.
- Respeitar `prefers-reduced-motion` (web) e `AccessibilityInfo.isReduceMotionEnabled` (mobile).
- Haptics (`expo-haptics`): `selection` ao trocar aba/slot; `notificationSuccess` ao confirmar
  agendamento ou baixa; `notificationError` em falha.

## Ergonomia (Thumb Zone)

- CTA primário **fixo no rodapé** (sticky bottom bar), largura total, altura ≥ 48 px,
  respeitando `safe-area-inset-bottom`.
- Alvos de toque ≥ 44×44 pt (iOS) / 48×48 dp (Android).
- Ações destrutivas nunca no mesmo lugar do CTA primário; confirmar com bottom sheet.
- Navegação por tabs inferiores no app.

## Acessibilidade (WCAG 2.1 AA)

- Todo controle com rótulo acessível (`accessibilityLabel` / `aria-label`).
- Foco visível na web; ordem de foco lógica nas 3 etapas.
- Slots de horário são `button`s com rótulo completo ("Terça, 14 de janeiro, 10:15").
- Mensagens de erro anunciadas (`aria-live="polite"` / `AccessibilityInfo.announceForAccessibility`).
- Suporte a fonte dinâmica até 200% sem cortar CTA.
