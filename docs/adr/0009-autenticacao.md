# ADR-0009: Autenticação da profissional — argon2id, JWT curto e refresh opaco rotativo

- Status: aceito
- Data: 2026-11-12

## Contexto

A profissional entra por e-mail e senha (Q-05). A sessão dura 30 dias com rotação (Q-22). O app
mobile guarda tokens no SecureStore (4.1). Toda query autenticada filtra por `professionalId`
vindo do token (regra 5). A tabela `refresh_tokens` já existe desde a 2.1.

## Decisão

- **Senha:** argon2id (`@node-rs/argon2`, parâmetros fixados no código: m=19 MiB, t=2, p=1, mínimo da OWASP). O pacote
  traz binários pré-compilados, sem node-gyp. Senha de 8 a 128 caracteres. No login com e-mail
  inexistente, a API verifica um hash fictício, para o tempo de resposta não revelar quem tem conta.
  Senha errada e e-mail inexistente devolvem a mesma resposta (`401`).
- **Access token:** JWT HS256 (`jose`), `sub = professionalId`, 15 min (`JWT_ACCESS_TTL`), com
  segredo de no mínimo 32 caracteres (`JWT_ACCESS_SECRET`, vazio no `.env.example`: a API não sobe
  sem um segredo próprio). A verificação fixa o algoritmo
  (recusa `alg: none`) e usa o `Clock` injetável.
- **Refresh token:** 32 bytes aleatórios (base64url), opaco. O banco guarda só o sha256. Validade
  de 30 dias (`JWT_REFRESH_TTL`).
  - Rotação: cada uso revoga o token (`UPDATE … WHERE revoked_at IS NULL`) e emite outro na
    mesma família (`family_id`). Cada login abre uma família nova.
  - Reuso de um token já revogado (ou perder a corrida de duas trocas simultâneas) revoga a
    família inteira. Outras sessões (outros logins) continuam valendo.
  - Logout revoga a família do token informado; é idempotente e sempre responde `204`.
- **Guard global** (`APP_GUARD`): nega por padrão. Rotas abertas usam `@Public()`; as autenticadas
  leem o id com `@CurrentProfessional()`, nunca do body ou da query.
- `JWT_REFRESH_SECRET` sai dos `.env.example`: o refresh é opaco, não um JWT.

## Alternativas consideradas

- Refresh como JWT: não permite revogar sem uma lista no banco, e a lista já é a tabela.
- `argon2` (node-gyp) ou bcrypt: o primeiro exige toolchain nativo; o segundo trunca em 72 bytes.
- `@nestjs/jwt`/Passport: mais camadas para um único esquema (Bearer HS256); `jose` resolve direto.
- Sessão em cookie: o cliente principal é o app mobile; a web booking não tem login.

## Consequências

- O access token continua válido até expirar (≤ 15 min) mesmo após logout ou revogação.
- Duas trocas simultâneas do mesmo refresh (ex.: duas abas) encerram aquela sessão; o cliente
  deve serializar o refresh.
- O registro responde `409 EMAIL_TAKEN`, o que revela se um e-mail tem conta (troca comum em
  SaaS B2B, aceita pela UX do cadastro). Mitigação obrigatória na 2.10: rate limit forte em
  `/register` e `/login`. Confirmação por e-mail (resposta genérica) só quando houver verificação
  de e-mail (fora da Fase 2, Q-22).
- Rate limit de login/registro e limpeza de refresh tokens expirados ficam para a 2.10.
- Rotação, reuso e logout rodam numa transação com `pg_advisory_xact_lock` por família; o
  `401` de reuso só é devolvido depois do commit da revogação.
- Trocar `JWT_ACCESS_SECRET` derruba todos os access tokens (os refresh continuam valendo).
