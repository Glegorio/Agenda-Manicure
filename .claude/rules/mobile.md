---
paths:
  - "apps/mobile/**"
---

# Regras — App Mobile (Expo / React Native)

- Expo Router (rotas em `app/`), TypeScript strict, TanStack Query para dados do servidor.
- Antes de usar uma API do Expo, confira a doc da versão do SDK instalada (`package.json`);
  não presuma APIs de versões antigas.
- Tokens de auth no `expo-secure-store`. Nada sensível em AsyncStorage.
- **Thumb zone:** CTA primário no rodapé (componente `BottomActionBar`), alvos ≥ 48 dp,
  respeitar safe area. Navegação principal por tabs inferiores.
- Cores, raio, espaçamento e durações só via tema de `packages/ui-tokens`.
- Ícones: `lucide-react-native`. Haptics (`expo-haptics`) conforme `docs/07-design-system.md`.
- Respeitar "reduzir movimento" e fonte dinâmica.
- Agenda Hub: status com cor **+ ícone + rótulo** (nunca só cor).
- Contatos (`expo-contacts`): pedir permissão com tela explicativa antes; a profissional
  seleciona quem importar; enviar só nome e telefone (LGPD — doc 06).
- Abrir WhatsApp: `https://wa.me/...` via `Linking.openURL`; `whatsapp://` só após `canOpenURL`.
- Testes: jest-expo + React Native Testing Library para componentes com lógica; fluxos críticos
  (fechamento diário, transições) com testes de integração da tela.
