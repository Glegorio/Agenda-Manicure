---
name: nova-feature
description: Fluxo padrão para implementar uma funcionalidade ou tarefa do roadmap no projeto Agende — explorar, planejar, escrever testes primeiro, implementar, verificar e documentar. Use sempre que for implementar algo não trivial.
argument-hint: "[descrição ou ID da tarefa, ex.: 2.8]"
---

# Implementar: $ARGUMENTS

## 1. Explorar (sem código)
- Identifique a tarefa no `docs/08-roadmap.md` e as regras `RN-xx` relacionadas em
  `docs/02-regras-de-negocio.md`.
- Leia o código existente que será tocado e os docs específicos (03/04/05/06/07).
- Verifique `docs/09-questoes-em-aberto.md` para decisões provisórias.

## 2. Planejar
- Se tocar mais de um pacote, schema, contrato ou concorrência: delegue ao subagente `arquiteto`.
- Se envolver slots/fuso/hold: consulte também o `especialista-agenda`.
- Apresente o plano curto ao usuário. Se houver pergunta de produto bloqueante, **pare e pergunte**.

## 3. Testes primeiro
- Escreva os testes que expressam o comportamento (nomes citando `RN-xx`). Pode delegar ao `qa-testes`.
- Rode e confirme que **falham pelo motivo certo**.

## 4. Implementar
- Contratos (`packages/contracts`) → domínio (`packages/*`) → API → UI, nessa ordem.
- Passos pequenos; rode os testes do pacote após cada passo.
- Siga as rules de `.claude/rules/` do diretório em que estiver trabalhando.

## 5. Verificar
```bash
pnpm --filter <pacote> test
pnpm lint
pnpm typecheck
```
Para UI web, rode também o Playwright da rota. Corrija até ficar verde. Não desative testes.

## 6. Documentar
- Schema mudou → `docs/04-modelo-de-dados.md`. Endpoint mudou → `docs/05-api-contratos.md`.
- Decisão arquitetural nova → `/adr`.
- Questão em aberto resolvida → atualize `docs/09-questoes-em-aberto.md`.

## 7. Encerrar
Resuma: o que mudou (arquivos), testes adicionados, como verificar manualmente, pendências.
Sugira `/revisar` e depois `/commit`.
