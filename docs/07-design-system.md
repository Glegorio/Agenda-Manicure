# Design System

Tokens vivem em `packages/ui-tokens` e são consumidos por web (CSS variables) e mobile
(objeto de tema). **Nenhuma cor/raio/duração literal em componentes** — sempre token.

## Paletas (primária) — validadas AA (3.1)

| Paleta         | `primary` (light) | `onPrimary` (light) | `primary` (dark) | `onPrimary` (dark) |
| -------------- | ----------------- | ------------------- | ---------------- | ------------------ |
| Rose Gold      | `#9A5560`         | `#FFFFFF`           | `#E8A9B2`        | `#1F1416`          |
| Nude Minimal   | `#86624D`         | `#FFFFFF`           | `#D9B8A3`        | `#1F1813`          |
| Elegance Black | `#1F1F1F`         | `#FFFFFF`           | `#F2F2F2`        | `#1F1F1F`          |
| Pastel Lilac   | `#6B58A6`         | `#FFFFFF`           | `#C7B9F0`        | `#1B1626`          |

Os pontos de partida (`#B76E79`, `#A9826B`, `#8E7CC3`) falhavam 4.5:1 com texto branco e foram
escurecidos; no dark o texto sobre a primary é escuro. Fonte: `packages/ui-tokens/src/palettes.ts`.
`packages/ui-tokens/src/__tests__/contrast.test.ts` calcula o contraste WCAG 2.1 de todas as
combinações texto/fundo usadas e **falha abaixo de 4.5:1** (texto: textPrimary, textSecondary, primary,
danger, success, warning, muted e as cores de status, sobre background, surface e surfaceElevated) ou
**3:1** (borda e anel de foco).

Neutros e semânticos (comuns a todas as paletas, valores em `NEUTRALS`): `background`, `surface`,
`surfaceElevated`, `textPrimary`, `textSecondary`, `border`, `success`, `warning`, `danger`, `muted`;
`focusRing` = primary. Web: `buildThemeCss(palette, mode)` gera `--color-*`, `--status-*`,
`--space-*`, `--radius-*`, `--font-size-*`, `--motion-*` (`SYSTEM` usa `prefers-color-scheme`).
Mobile: `getTheme(palette, scheme)`.

Status da agenda (RN-55): `status.scheduled = primary`, `status.inProgress = warning`,
`status.completed = success`, `status.cancelled = muted` (+ texto riscado),
`status.noShow = danger`. **Cor nunca é o único indicador** — sempre ícone + rótulo.

## Forma, espaço e tipografia

- Raio: `radius.md = 12`, `radius.lg = 16`, `radius.full = 9999` (chips).
- Espaçamento: escala 4 pt (`4, 8, 12, 16, 24, 32, 48`).
- Elevação de card: sombra suave no light; no dark, `surfaceElevated` mais clara em vez de sombra.
- Tipografia: fonte do sistema no mobile; web com 1 família variável (subset latin) ou system-ui.
  Tamanho mínimo de corpo 16 px (evita zoom no iOS em inputs).
- Escala de fonte (`fontSize`): `sm 14`, `md 16`, `lg 18`, `xl 22`, `xxl 28` — números no mobile,
  `rem` na web (`--font-size-*`, base 16) para respeitar o tamanho de fonte do usuário. `sm` só em
  texto secundário, nunca em campos de entrada. Texto grande (≥ 18.66 px bold ou 24 px) exige 3:1.
- Ícones: **Lucide** (`lucide-react` / `lucide-react-native`), 20/24 px, stroke 1.75.

## Movimento

- Durações: `motion.fast = 150ms`, `motion.base = 220ms`, `motion.slow = 300ms`; easing `ease-out`.
- Respeitar `prefers-reduced-motion` (web) e `AccessibilityInfo.isReduceMotionEnabled` (mobile).
  Na web, `buildThemeCss` já zera `--motion-*` em `prefers-reduced-motion: reduce`.
- Haptics (`expo-haptics`): `selection` ao trocar aba/slot; `notificationSuccess` ao confirmar
  agendamento ou baixa; `notificationError` em falha.

## Ergonomia (Thumb Zone)

- CTA primário **fixo no rodapé** (sticky bottom bar), largura total, altura ≥ 48 px,
  respeitando `safe-area-inset-bottom`.
- Alvos de toque ≥ 44×44 pt (iOS) / 48×48 dp (Android).
  Token: `touchTarget = 48` (`--touch-target` na web).
- Ações destrutivas nunca no mesmo lugar do CTA primário; confirmar com bottom sheet.
- Navegação por tabs inferiores no app.

## Acessibilidade (WCAG 2.1 AA)

- Todo controle com rótulo acessível (`accessibilityLabel` / `aria-label`).
- Foco visível na web; ordem de foco lógica nas 3 etapas.
  Anel `focusRing` (= primary) com `--focus-ring-width: 2px` e `--focus-ring-offset: 2px`: desenhado
  fora do controle, sobre o fundo da página, para não sumir no botão primário (mesma cor).
- Slots de horário são `button`s com rótulo completo ("Terça, 14 de janeiro, 10:15").
- Mensagens de erro anunciadas (`aria-live="polite"` / `AccessibilityInfo.announceForAccessibility`).
- Suporte a fonte dinâmica até 200% sem cortar CTA.
