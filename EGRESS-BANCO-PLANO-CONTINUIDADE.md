# Egress do Banco - Plano e Continuidade

Documento de retomada para reduzir egress, payload e consultas desnecessarias no `infrastudio_v2`.

## Regras obrigatorias

- Seguir `AGENTS.md`, `AGENTS/README.md` e `AGENTS/basico.md`.
- Nao criar estrutura paralela.
- Nao editar `database/geral-schema.sql`.
- Ajustes de banco entram em `database/seeder/`.
- Toda query nova deve buscar apenas campos necessarios, usar `limit` e evitar N+1, polling sem controle e payload grande.
- Se tocar chat/IA/widget, ler tambem `AGENTS/chat-runtime.md` e `AGENTS/laboratorio.md`.
- Se tocar intent/orquestracao/catalogo/billing/API runtime, nao resolver com heuristica textual.

## Estado atual

### Atendimento

Concluido em 2026-05-04:

- `/api/admin/conversations` passou a retornar preview leve.
- Sidebar nao traz mais `contexto`, tokens, custo, metadata, assets, anexos ou mensagem completa.
- Ultima mensagem da sidebar usa query especifica leve.
- Atendimento nao seleciona a primeira conversa automaticamente.
- Detalhe da conversa carrega apenas apos clique.
- Detalhe inicial carrega `30` mensagens.
- Historico antigo carrega sob demanda por cursor com `Carregar anteriores`.
- Contador caro de mensagens saiu da sidebar.
- Indices criados em `database/seeder/2026-05-04-atendimento-egress-indexes.sql`.

### Chat runtime

Parcialmente concluido em 2026-05-04:

- `resolveChatChannel` passou a usar leitura leve de projeto no runtime.
- Leitura de projeto do runtime nao chama mais `enrichProjectSummary`, evitando counts, billing snapshot, agente duplicado e directConnections em toda mensagem.
- Historico enviado ao runtime passou a carregar janela recente limitada (`28` mensagens por padrao, maximo `60`).
- Alerta de handoff humano busca apenas as ultimas `12` mensagens para achar a ultima mensagem do cliente.
- Corrigida preservacao de ordem cronologica do historico ao limitar mensagens.
- POST `/api/chat` em WhatsApp reaproveita o canal/projeto/agente ja resolvido na validacao de contato salvo, evitando resolver o mesmo canal duas vezes na mesma mensagem.
- Catalogo de planos do billing ganhou cache curto de `60s` no runtime.
- `loadAgentRuntimeApis` deixou de carregar `api_campos` via join para todas as APIs; agora carrega campos em segunda query apenas quando a API nao tem `runtime.fields` configurado.

Arquivos principais:

- `backend/lib/projetos.js`
- `backend/lib/chat/service.js`
- `backend/lib/chat/persistence.js`
- `backend/lib/chats.js`
- `backend/app/api/chat/route.js`
- `backend/lib/billing.js`
- `backend/lib/apis.js`

Arquivos principais:

- `backend/components/admin/attendance/attendance-page.js`
- `backend/lib/admin-conversations.js`
- `backend/lib/chats.js`
- `backend/app/api/admin/conversations/[id]/messages/route.js`
- `database/seeder/2026-05-04-atendimento-egress-indexes.sql`

Validacao feita:

- `cd backend && npm run lint`
- `cd backend && npm run build`
- `git diff --check`

## Proximo ponto de recomeco

Prioridade maxima agora: **continuar Chat runtime / API de chat**.

Antes de mexer:

1. Ler `AGENTS/chat-runtime.md`.
2. Ler `AGENTS/laboratorio.md`.
3. Mapear o fluxo de `/api/chat` e funcoes chamadas no runtime.
4. Separar o que e config publica leve, config completa, historico e metadata.

Objetivo da proxima etapa:

- reduzir egress por mensagem enviada no widget/WhatsApp
- evitar carregar agente/widget/projeto completos em toda mensagem
- manter comportamento do cerebro sem regressao

Checklist da proxima etapa:

1. Mapear queries restantes do runtime:
   - widget/config
   - agente/runtimeConfig
   - billing guardrail
   - APIs runtime
   - catalogo/Mercado Livre
2. Criar funcoes de leitura leve onde estiver carregando mais do que usa.
3. Avaliar cache curto em memoria para config estavel restante:
   - `widgetId`
   - `agenteId`
   - `projetoId`
   - billing snapshot basico
4. Reduzir metadata e contexto persistidos:
   - verificar tamanho de `chats.contexto`
   - manter anexos/assets apenas quando o fluxo precisa
5. Reduzir `metadata` salva em `mensagens`:
   - separar metadata operacional minima de dados grandes
   - nao duplicar payload externo bruto
6. Validar:
   - `cd backend && npm run test:chat-intelligence`
   - `cd backend && npm run build`
   - testar widget real quando possivel

## Backlog priorizado

### 1. Chat runtime `/api/chat`

Maior impacto esperado porque roda a cada mensagem.

Melhorias:

- cache curto para config de agente/widget/projeto
- selecao enxuta de campos
- separar config publica leve da config completa
- limitar historico usado por mensagem
- reduzir metadata salva por mensagem
- revisar `recordJsonApiUsage` nas rotas de chat

### 2. Mercado Livre / catalogo

Alto impacto por snapshot, loja, produtos e assets.

Melhorias:

- listas sempre paginadas
- campos de card apenas: nome, preco, imagem, slug, estoque/status
- nao retornar JSON bruto do Mercado Livre para UI
- cachear snapshot por projeto quando fizer sentido
- limitar imagens/assets por produto

### 3. Billing / dashboard

Alto potencial em telas administrativas e snapshots.

Melhorias:

- criar previews leves para cards/listas
- separar detail de preview
- evitar recalculo lendo muitas linhas
- reduzir payload de `recordJsonApiUsage`

### 4. Agentes e APIs

Melhorias:

- listagem de agentes apenas com `id`, `nome`, `ativo`, `updated_at`
- carregar prompt/config completa apenas no editor
- carregar versoes/snapshots apenas sob demanda
- API config completa apenas ao editar/testar

### 5. WhatsApp manager

Melhorias:

- reduzir polling
- status compacto
- logs paginados
- QR/session apenas quando necessario

### 6. Agenda

Melhorias:

- buscar sempre por intervalo de datas
- limitar campos
- agrupar disponibilidade quando possivel
- nao retornar historico antigo por padrao

## Como atualizar este documento

- Ao concluir uma etapa, mover para `Estado atual`.
- Manter `Proximo ponto de recomeco` com uma tarefa clara e executavel.
- Se criar seeder, registrar o arquivo aqui.
- Se remover um item de `AGENTS/melhorias.md`, registrar que foi concluido.
