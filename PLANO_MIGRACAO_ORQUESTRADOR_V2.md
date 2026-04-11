# Plano de Migracao do Orquestrador para o v2

## Objetivo

Este documento detalha a migracao da inteligencia de chat do legado para o `v2`, com foco no nucleo do orquestrador e em micros passos.

A meta e simples:

- parar de depender de imports externos para `C:\Projetos\infrastudio`
- manter o comportamento funcional do legado
- internalizar o cerebro do chat no `backend/lib`
- seguir o padrao estrutural do `AGENTS.md` do `v2`

## Situacao atual no v2

Hoje o `v2` ja possui:

- auth real
- rotas `/app` e `/admin`
- admin de projetos real
- atendimento admin funcional
- `POST /api/chat`

O ponto de bloqueio atual e:

- `backend/lib/chat-adapter.js` importa `../../../infrastudio/lib/agentes.ts`
- `backend/lib/chat-adapter.js` importa `../../../infrastudio/lib/chat-service.ts`
- `backend/lib/chat-adapter.js` importa `../../../infrastudio/lib/projetos.ts`

Impacto:

- funciona localmente
- quebra no deploy da Vercel
- mantem o `v2` dependente de um repo externo

## Leitura tecnica do legado

### Centro do pipeline

Os dois arquivos centrais continuam sendo:

- `C:\Projetos\infrastudio\lib\chat-service.ts`
- `C:\Projetos\infrastudio\lib\chat-orchestrator.ts`

### Responsabilidade do `chat-service.ts`

Hoje ele concentra:

- resolucao de projeto
- resolucao de agente
- resolucao de widget e canal
- resolucao e criacao de chat
- persistencia de mensagens
- integracao com handoff
- integracao com billing
- integracao com WhatsApp
- fallback isolado
- formatacao de saida por canal

Export principal:

- `processIncomingChatMessage`

Exports auxiliares relevantes:

- `resolveCanonicalWhatsAppExternalIdentifier`
- `formatWhatsAppHumanOutboundText`
- `sanitizeWhatsAppCustomerFacingReply`
- `buildWhatsAppMessageSequence`
- `buildContinuationMessage`

### Responsabilidade do `chat-orchestrator.ts`

Hoje ele concentra:

- heuristicas de intencao
- analise semantica
- politica por canal
- contexto de catalogo e Mercado Livre
- construcao de prompt
- guardrails
- chamada do modelo
- enriquecimento de lead
- resumo de conversa

Export principal:

- `generateSalesReply`

Exports auxiliares relevantes:

- `enrichLeadContext`
- `shouldRefreshSummary`
- `summarizeConversation`

## Dependencias do nucleo

### Nucleo obrigatorio da fase 1

Esses modulos participam diretamente do fluxo principal do orquestrador e do service:

- `agentes.ts`
- `projetos.ts`
- `chats.ts`
- `chat-service.ts`
- `chat-orchestrator.ts`
- `chat-context.ts`
- `chat-context-stage.ts`
- `chat-domain-stage.ts`
- `chat-intent-classifier.ts`
- `chat-pipeline-stage.ts`
- `chat-semantic-intent-stage.ts`
- `chat-sales-heuristics.ts`
- `chat-prompt-builders.ts`
- `chat-openai-stage.ts`
- `chat-openai-utils.ts`
- `chat-channel-policy.ts`
- `chat-text-utils.ts`
- `chat-lead-stage.ts`
- `chat-summary-stage.ts`
- `chat-recovery-stage.ts`
- `chat-api-runtime.ts`
- `catalog-follow-up.ts`
- `chat-mercado-livre.ts`
- `apis.ts`
- `conectores.ts`
- `segredos.ts`
- `runtime-error-log.ts`

### Suporte necessario logo depois

Esses modulos nao devem travar a primeira internalizacao do nucleo, mas entram cedo:

- `chat-logs.ts`
- `chat-usage-metrics.ts`
- `chat-widgets.ts`
- `chat-handoffs.ts`
- `chat-handoff-policy.ts`
- `chat-attachments.ts`
- `billing-access.ts`
- `billing-usage-cycles.ts`
- `openai-pricing.ts`
- `whatsapp-channels.ts`
- `whatsapp-handoff-alerts.ts`

### Satelites que podem entrar em fase posterior

Esses pontos devem ser mapeados, mas nao precisam bloquear o primeiro corte do orquestrador:

- detalhes avancados de widget
- fluxos completos de anexos
- rotinas avancadas de telemetria
- refinamentos completos de WhatsApp
- tudo que for exclusivamente operacional do painel

## Estrutura alvo no v2

O destino recomendado no `backend/lib` e este:

- `backend/lib/chat/adapter.js`
- `backend/lib/chat/service.js`
- `backend/lib/chat/orchestrator.js`
- `backend/lib/chat/context.js`
- `backend/lib/chat/summary.js`
- `backend/lib/chat/handoff.js`
- `backend/lib/chat/widgets.js`
- `backend/lib/chat/attachments.js`
- `backend/lib/chat/logs.js`
- `backend/lib/chat/usage.js`

Dominios de apoio, criados conforme necessidade real:

- `backend/lib/agentes.js`
- `backend/lib/projetos.js`
- `backend/lib/chats.js`
- `backend/lib/apis.js`
- `backend/lib/conectores.js`
- `backend/lib/whatsapp-channels.js`
- `backend/lib/billing/...`

Regra:

- nao criar estrutura paralela desnecessaria
- criar apenas o que estiver sendo absorvido de fato
- manter a API do `v2` simples e previsivel

## Contrato que precisa ficar estavel

Antes de refatorar internamente, o `v2` deve congelar o contrato de entrada e saida do pipeline.

Entrada minima observada hoje:

- `message` ou `mensagem`
- `projeto`
- `agente`
- `context`
- `widgetSlug`
- `canal`
- `identificadorExterno`
- `identificador`
- `source`
- `whatsappChannelId`
- `attachments`

Saida minima observada hoje:

- `chatId`
- `reply`
- `followUpReply`
- `messageSequence`
- `assets`
- `whatsapp`

Regra:

- o controller do `v2` deve depender desse contrato
- o interior do pipeline pode mudar
- o contrato externo deve mudar o minimo possivel

## Ordem de migracao em micros passos

### Micro passo 1. Fechar o inventario do nucleo

Objetivo:

- registrar tudo que o `chat-service.ts` e o `chat-orchestrator.ts` realmente puxam

Status:

- concluido neste documento em nivel estrutural

Criterio de aceite:

- lista do nucleo, suporte e satelites definida

### Micro passo 2. Criar a estrutura base do dominio chat no v2

Objetivo:

- criar `backend/lib/chat/`
- transformar o adapter atual em adapter fino

Entrega:

- mover a responsabilidade de orquestracao para arquivos internos do `v2`

Criterio de aceite:

- `chat-adapter` deixa de ser ponto de acoplamento com o repo externo

### Micro passo 3. Congelar o contrato do pipeline

Objetivo:

- documentar e manter a assinatura de `processIncomingChatMessage`

Entrega:

- service interno com a mesma interface externa relevante

Criterio de aceite:

- `/api/chat` continua funcionando sem alteracao de contrato visivel

### Micro passo 4. Internalizar o `chat-service`

Objetivo:

- trazer o service para dentro do `v2`

Escopo inicial:

- resolucao de projeto
- resolucao de agente
- resolucao de canal
- criacao e leitura de chat
- chamada do orchestrator interno
- retorno do payload padronizado

Fora do primeiro corte, se necessario:

- anexos completos
- billing completo
- WhatsApp completo
- handoff completo

Criterio de aceite:

- `POST /api/chat` executa com service interno do `v2`

### Micro passo 5. Internalizar o `chat-orchestrator`

Objetivo:

- trazer o cerebro de decisao para dentro do `v2`

Escopo inicial:

- heuristicas
- classificacao de intencao
- construcao de prompt
- chamada do modelo
- enriquecimento de lead
- resumo de conversa

Criterio de aceite:

- respostas basicas equivalentes ao legado

### Micro passo 6. Ligar persistencia e contexto reais

Objetivo:

- conectar o pipeline interno aos dados reais do `v2`

Escopo:

- mensagens
- stats do chat
- contexto
- resumo

Criterio de aceite:

- historico e contexto continuam consistentes

### Micro passo 7. Ligar handoff

Objetivo:

- restaurar a politica de atendimento humano

Escopo:

- abrir handoff
- pausar IA
- liberar para IA

Criterio de aceite:

- atendimento admin continua operacional

### Micro passo 8. Ligar billing e telemetria

Objetivo:

- restaurar controle de uso e custo

Escopo:

- verificacao de limite
- registro de uso
- metrica basica

Criterio de aceite:

- controle de uso volta a refletir a execucao real

### Micro passo 9. Ligar WhatsApp e satelites

Objetivo:

- reconectar o pipeline unico aos canais externos

Escopo:

- formatacao por WhatsApp
- sessao/canal
- alertas de handoff

Criterio de aceite:

- site e WhatsApp compartilham o mesmo cerebro no `v2`

### Micro passo 10. Remover o acoplamento externo

Objetivo:

- eliminar imports para `../../../infrastudio/...`

Criterio de aceite:

- build local passa
- deploy na Vercel passa
- `v2` fica autonomo

## Regra de execucao

Durante essa migracao:

- nao migrar UI junto com o nucleo do chat
- nao copiar tela gigante do legado
- nao abrir auth, demo, billing visual e WhatsApp ao mesmo tempo
- nao expandir novos imports para fora do repo
- preservar o contrato principal do chat

## Proximo passo recomendado

Executar agora o micro passo 2:

- criar a estrutura `backend/lib/chat/`
- preparar os arquivos base `adapter`, `service` e `orchestrator`
- deixar o `v2` pronto para receber a internalizacao do nucleo em etapas pequenas
