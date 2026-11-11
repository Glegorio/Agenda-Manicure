---
paths:
  - "**/*.test.ts"
  - "**/*.test.tsx"
  - "**/*.spec.ts"
  - "**/e2e/**"
---

# Regras — testes

- Nome do teste em português, citando a regra quando houver: `it('RN-41: retorna 409 se o slot foi tomado', ...)`.
- Arrange / Act / Assert visíveis. Um comportamento por teste.
- Tempo controlado: injete `now` (domínio) ou use fake timers; nunca dependa do relógio real.
- Fuso: rode testes de data com pelo menos `America/Sao_Paulo` e um fuso com horário de verão.
- Não use `sleep` para esperar; use polling com timeout ou eventos.
- Não apague nem enfraqueça um teste que falha para "fazer passar". Se o teste estiver errado,
  explique por quê e peça confirmação.
- Fixtures/factories em `test/factories`, com valores realistas (nomes BR, telefones E.164 válidos, `price_cents`).
