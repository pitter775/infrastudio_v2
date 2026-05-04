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
- Extracao de planos mensais descritos no texto do agente ganhou parser deterministico antes da chamada semantica por LLM, reduzindo custo/egress de runtime e evitando que valor de projeto sob medida substitua planos mensais.
- Metadata persistida em `mensagens` para respostas da IA passou a salvar diagnostico compacto, sem duplicar `catalogDiagnostics` completo, contexto de catalogo ou payloads grandes de decisao.
- Logs do runtime passaram a compactar `catalogDiagnostics`, mantendo contadores, offsets e decisao principal sem gravar `contextCatalogo` completo.
- Resolucao de canal/projeto/agente/widget do `/api/chat` ganhou cache curto em memoria (`20s`) fora do teste de agente, reduzindo releituras iguais em mensagens consecutivas.
- Busca de canal WhatsApp ativo no runtime passou a limitar linhas e filtrar por agente/fallback nulo, evitando ler todos os canais ativos do projeto em toda mensagem.
- Historico recente usado pelo runtime passou a usar query lean, sem `metadata`, tokens, custo, assets, anexos ou payloads de UI.
- Importacao de historico por `identificador_externo` tambem passou a retornar apenas campos usados pelo cerebro (`id`, `chat_id`, `role`, `conteudo`, `canal`, `created_at`).
- Busca de catalogo Mercado Livre no chat passou a usar select compacto do snapshot, sem descricao longa, atributos e galeria completa na listagem.
- Quando a busca vem do snapshot local, o chat nao carrega mais o conector completo do Mercado Livre so para montar a resposta.
- Detalhe de produto do chat tenta resolver primeiro pelo snapshot local antes de cair em conector/OAuth/API externa.
- Configuracao da loja usada no chat passou a ler apenas `chat_contexto_completo`, sem carregar toda a loja.
- Busca de snapshot do Mercado Livre no chat deixou de pedir `count: exact`; usa uma linha extra para estimar `hasMore`.
- Billing runtime passou a carregar apenas recargas avulsas ainda disponiveis para validar/registrar uso, evitando varrer creditos ja usados em toda mensagem.
- Registro de uso do billing deixou de buscar destinatarios de alerta, canal WhatsApp central e emails em toda mensagem; agora so carrega isso quando cruza 80%, 100% ou bloqueio.
- `chats.contexto` passou a compactar estado de catalogo antes de persistir: lista recente limitada, produto em foco resumido, imagens/atributos/descricao longa capados e somente campos operacionais de paginacao/foco.
- Logs redundantes do runtime foram reduzidos: nao grava mais evento de APIs carregadas quando nao ha APIs e nao grava evento separado de "turno persistido" em todo atendimento.
- Contexto de APIs externas no prompt passou a priorizar campos factuais compactos e limitar preview bruto, reduzindo tokens enviados quando a API retorna payload grande.
- Auditoria de `select *` em `backend/lib` e `backend/app` nao encontrou mais ocorrencias apos ajuste.
- Agenda deixou de usar `select *`; horarios e reservas agora usam selects explicitos, inclusive inserts/updates que retornam dados.
- Handoffs do chat deixaram de usar `select *`; leituras, insert e update retornam apenas campos usados pelo mapper.
- Dashboard deixou de carregar `logs.payload` inteiro; usa JSON paths compactos para nivel, evento, erro, status e dados minimos de filtro/preview.
- Listagem de APIs do projeto deixou de carregar `configuracoes` e versoes em cascata; detalhes/config completa agora carregam sob demanda ao abrir a API no editor.

Mapa atual das leituras completas/pesadas restantes:

- `agentes`: nao ha `select *`, mas `agenteFields` ainda inclui `prompt_base` e `configuracoes` em fluxos de editor/detalhe; listagem leve ainda deve ser separada quando a tela nao precisar editar.
- `apis`: listagem simples ja esta enxuta; `apiFields` com `configuracoes` ficou restrito a detalhe/editor/teste/runtime.
- `chat_widgets`: sem `select *`; campos ja enxutos para config publica/CRUD.
- `whatsapp`: sem `select *`; `channelFields` inclui `session_data`, necessario para manager/runtime, mas listagens simples podem ganhar select compacto depois.
- `dashboard`: chats e logs estao compactos; billing ainda pode ser separado em preview leve em etapa propria.
- `agenda`: sem `select *`; disponibilidade publica ainda pode ganhar limite por janela/data quando nao houver `date`.
- `logs`: funcoes administrativas ainda podem carregar `payload` completo quando a tela pede detalhe/limpeza; usar modo `compact` nas listagens sempre que possivel.

Arquivos principais:

- `backend/lib/projetos.js`
- `backend/lib/chat/service.js`
- `backend/lib/chat/persistence.js`
- `backend/lib/whatsapp-channels.js`
- `backend/lib/chats.js`
- `backend/app/api/chat/route.js`
- `backend/lib/billing.js`
- `backend/lib/chat/prompt-builders.js`
- `backend/lib/apis.js`
- `backend/lib/chat/semantic-intent-stage.js`
- `backend/lib/chat/mercado-livre.js`
- `backend/lib/mercado-livre-connector.js`
- `backend/lib/mercado-livre-store-core/snapshot.js`
- `backend/lib/mercado-livre-store-core/store-config.js`
- `backend/lib/billing.js`
- `backend/lib/agenda.js`
- `backend/lib/chat-handoffs.js`
- `backend/lib/dashboard.js`
- `backend/lib/apis.js`
- `backend/app/api/app/projetos/[id]/apis/[apiId]/route.js`
- `backend/components/app/apis/api-sheet-manager.js`

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
- `cd backend && npm run test:chat-intelligence:domain-regression`

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
