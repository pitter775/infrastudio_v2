# Arquitetura Alvo Chat Canais e Catalogo

Objetivo:

- deixar o universo `chat + widget + whatsapp + Mercado Livre + billing + api runtime` no nivel maximo pragmatico deste produto
- reduzir acoplamento no `orchestrator`
- consolidar contrato unico de turno, contexto e resposta
- eliminar dependencia residual de heuristica textual
- orientar futuras rodadas do Codex sem reabrir caminhos paralelos

Este arquivo substitui a necessidade de planos separados e mais estreitos quando o assunto for arquitetura global desse universo.

## Leitura executiva

Hoje o projeto ja passou da fase de prototipo funcional.

Ja existe:

- runtime real por dominio
- `intent-stage` semantico
- handlers deterministas relevantes
- continuidade de contexto
- canais reais em operacao
- cobertura de smoke robusta

O principal gargalo estrutural nao e falta de IA.

O principal gargalo estrutural e:

- responsabilidade demais no `orchestrator`
- contratos ainda heterogeneos entre dominios
- continuidade ainda parcialmente dependente de contexto implicito
- operacao multicanal ainda com zonas cinzentas entre adapter, dominio e UI

## Meta de nivel maximo

O alvo ideal e um `conversation engine` central com estes pilares:

1. um contrato unico de turno
2. classificacao semantica estrutural
3. handlers de dominio deterministas
4. adapters de canal finos
5. contexto persistido por dominio
6. observabilidade de decisao por turno
7. testes de jornada reais e estaveis

Em termos de maturidade:

- estado atual aproximado: `7/10`
- alvo realista com mais alguns cortes bons: `9/10`
- nivel maximo teorico desse produto: `9.5/10`

## Principios obrigatorios

- nao resolver entendimento do usuario com `if`, `includes`, regex ou listas de frase
- tudo que for especifico de negocio deve viver em runtime estruturado, banco ou contrato semantico
- canais nao podem decidir dominio
- UI nao pode decidir regra de negocio
- adapters nao podem misturar execucao com continuidade conversacional
- o `orchestrator` deve coordenar, nao possuir a regra de cada vertical
- todo dominio deve falhar fechado quando faltar dado estruturado
- toda resposta relevante deve deixar rastro diagnostico suficiente para auditoria

## Problema estrutural atual

O ecossistema hoje tem bons blocos, mas ainda com fronteiras incompletas:

- `widget` ainda carrega parte importante do comportamento percebido pelo usuario
- `whatsapp` ainda mistura operacao de canal com custo de sincronizacao e contingencia
- `mercado-livre` ainda concentra execucao + parte do comportamento de catalogo
- `billing` ja melhorou bastante, mas ainda depende da qualidade do stage e do catalogo real
- `api runtime` ainda convive com caminhos estruturados e caminhos residuais
- `orchestrator` ainda precisa montar, corrigir e reconciliar coisa demais

Resultado:

- comportamento forte em muitos cenarios
- porem ainda abaixo do teto em clareza arquitetural e robustez operacional

## Arquitetura alvo

### 1. Conversation Engine central

Responsabilidade:

- receber um turno normalizado
- montar contexto util
- rodar classificacao semantica
- escolher dominio principal
- delegar para handler correto
- consolidar resposta final
- persistir contexto e diagnostico

Nao deve fazer:

- regra de negocio de billing
- regra de detalhe/listagem de catalogo
- regra de API factual
- regra de canal especifica

Saida ideal do engine:

```js
{
  reply: "...",
  replyAssets: [],
  domain: "billing|catalog|api_runtime|agenda|handoff|general",
  domainDecision: {...},
  contextUpdate: {...},
  diagnostics: {...},
  channelPayload: {...}
}
```

### 2. Semantic Intent Layer

Responsabilidade:

- transformar fala do usuario em decisao estruturada
- usar contexto persistido do dominio
- nao responder usuario
- nao montar texto comercial

Contrato alvo:

```js
{
  domain: "billing",
  intent: "plan_recommendation",
  confidence: 0.96,
  reason: "follow-up consultivo apos comparacao",
  entities: {
    plans: ["plus", "pro"],
    fields: ["price", "agent_limit"]
  },
  continuity: {
    usedPlanFocus: true,
    usedComparisonFocus: true
  }
}
```

Regra:

- a classificacao pode ser probabilistica
- a execucao da resposta nao

### 3. Domain Handlers

Cada dominio deve ter dono unico claro:

1. `billing handler`
2. `catalog handler`
3. `api runtime handler`
4. `agenda handler`
5. `handoff handler`

Cada handler deve:

- receber runtime estruturado
- receber contexto estruturado
- receber decisao semantica
- responder deterministicamente
- devolver `replyResult + contextUpdate + diagnostics`

Cada handler nao deve:

- buscar “significado” por texto solto
- depender do canal
- persistir direto no banco

### 4. Channel Adapters

Adapters:

- `widget`
- `whatsapp`
- eventuais canais futuros

Responsabilidade:

- normalizar input do canal para contrato comum
- converter saida comum para payload do canal
- aplicar restricoes de renderizacao
- nunca reimplementar regra de dominio

O que o adapter pode decidir:

- formato da mensagem
- limite visual
- assets suportados
- loading UX

O que o adapter nao pode decidir:

- melhor plano
- melhor produto
- qual API consultar
- se a pergunta saiu do detalhe para nova busca

## Contrato unico de contexto

O contexto ideal precisa ser explicito por dominio.

Formato alvo:

```js
{
  conversation: {
    chatId: "...",
    channel: "web",
    userId: "...",
    updatedAt: "..."
  },
  domains: {
    billing: {...},
    catalog: {...},
    apiRuntime: {...},
    agenda: {...},
    handoff: {...}
  },
  ui: {
    source: "widget|whatsapp|admin",
    lastAction: {...}
  },
  diagnostics: {
    lastDomain: "billing",
    lastIntent: "plan_recommendation"
  }
}
```

### Billing context alvo

```js
{
  planFocus: {
    slug: "plus",
    name: "Plus"
  },
  comparisonFocus: {
    plans: [
      { slug: "plus", name: "Plus" },
      { slug: "pro", name: "Pro" }
    ],
    fields: ["price", "attendance_limit", "agent_limit"]
  },
  lastIntent: "plan_comparison",
  lastField: "price",
  lastFields: ["price", "attendance_limit", "agent_limit"]
}
```

### Catalog context alvo

```js
{
  listingSession: {
    id: "session-id",
    source: "mercado_livre_snapshot",
    searchTerm: "inox",
    matchedProductIds: ["MLB1", "MLB2"],
    offset: 0,
    nextOffset: 3,
    hasMore: true
  },
  productFocus: {
    productId: "MLB2",
    sourceListingSessionId: "session-id"
  },
  comparisonFocus: {
    productIds: ["MLB1", "MLB2"],
    fields: ["price", "material"]
  }
}
```

### API runtime context alvo

```js
{
  apiFocus: {
    apiId: "imoveis",
    itemId: "123"
  },
  lastFactFields: ["valor", "status"],
  comparisonFocus: {
    itemIds: ["1", "2"],
    mode: "best_choice",
    fields: ["valor", "cidade"]
  }
}
```

## Contrato unico de resposta de dominio

Todo dominio deveria responder nesse shape:

```js
{
  ok: true,
  domain: "billing",
  reply: "...",
  assets: [],
  metadata: {
    replyStrategy: "structured_plan_recommendation_multi",
    targetPlan: "pro",
    targetFields: ["price", "agent_limit"]
  },
  contextUpdate: {
    billing: {...}
  },
  diagnostics: {
    usedContext: ["comparisonFocus"],
    failClosed: false
  }
}
```

Beneficios:

- menos logica de merge no `orchestrator`
- menos drift entre dominios
- mais facilidade para observabilidade
- testes mais previsiveis

## Vertical por vertical

### Widget

Estado atual bom:

- contrato publico melhorou
- dedupe e erro bruto melhoraram
- continuidade ja existe

Para chegar no teto:

- widget virar adapter fino de canal
- timeline obedecer apenas contrato de renderizacao
- `replace_listing` vs `append_listing` virar regra unica
- menos logica local de merge baseada em tempo/texto
- sync e historico sempre curtos e previsiveis

### WhatsApp

Estado atual bom:

- existe integracao real
- existe handoff
- existe contingencia

Para chegar no teto:

- worker externo com sessao mais robusta
- sync centralizado por canal
- payload minimo de status
- snapshot pesado apenas sob demanda
- separacao mais forte entre estado operacional e conversa

### Mercado Livre

Estado atual bom:

- loja publica existe
- pagina de produto existe
- snapshot local existe
- chat contextual existe

Para chegar no teto:

- `catalog handler` ser dono unico de listagem, detalhe, comparacao e continuidade
- adapter Mercado Livre ficar restrito a snapshot, busca, detalhe e sync
- validacao real em conta/loja ativa
- consolidar contrato entre loja publica e chat

### Billing

Estado atual bom:

- direcao certa de stage + handler + contexto
- comparacao e recomendacao ja sairam bem da heuristica

Para chegar no teto:

- recommendation consultiva mais abstrata
- regra operacional de limite/excedente estruturada
- alias de plano mais robusto
- auditoria real e enriquecimento de catalogos de agentes

### API runtime

Estado atual bom:

- factual estruturado existe
- comparacao semantica existe
- contexto ja existe

Para chegar no teto:

- menos caminho residual textual
- contrato padronizado de item foco e comparacao
- payload factual ainda mais orientado a campo canonico

## O que mais segura o teto hoje

### 1. Orchestrator grande demais

Sinais:

- coordena demais
- remenda demais
- conhece detalhes demais

Direcao:

- empurrar decisao para handlers
- padronizar retorno de dominio
- simplificar merge final

### 2. Heuristica residual

Mesmo melhorando muito, ainda existe logica residual espalhada.

Direcao:

- matar o que ainda decide por texto onde ja existe contexto estruturado
- manter apenas heuristica estrutural, nunca de frase

### 3. Contexto ainda parcialmente implicito

Direcao:

- guardar mais estado util explicitamente
- especialmente `comparisonFocus`, `listingSession`, `apiFocus`, `lastFields`

### 4. Operacao multicanal ainda assimetrica

Direcao:

- mesmo contrato de turno para web e WhatsApp
- adapters apenas traduzem payload

### 5. Observabilidade ainda abaixo do ideal

Hoje ja existe diagnostico relevante, mas o teto pede mais.

Contrato ideal de observabilidade por turno:

```js
{
  turnId: "...",
  domain: "catalog",
  semanticDecision: {...},
  handlerStrategy: "structured_product_fact",
  contextBefore: {...},
  contextAfter: {...},
  fallbackUsed: false,
  latencyMs: 180,
  llmCost: {...},
  source: "widget"
}
```

## Estrada para o nivel maximo

### Fase 1. Consolidar contrato unico

- padronizar `domain result contract`
- padronizar `contextUpdate`
- padronizar `diagnostics`

### Fase 2. Reduzir o orchestrator

- tirar regras de dominio
- manter so coordenacao
- centralizar apenas pipeline, persistencia e montagem final

### Fase 3. Fechar contexto explicito

- `billing.planFocus/comparisonFocus`
- `catalog.listingSession/productFocus/comparisonFocus`
- `apiRuntime.apiFocus/comparisonFocus`
- `agenda.bookingFocus`

### Fase 4. Fortalecer adapters

- widget fino
- WhatsApp fino
- loja publica conversando com o mesmo motor

### Fase 5. Instrumentar de verdade

- top fallbacks
- top domains
- top estrategias
- turnos que reclassificam demais
- turnos que falham fechado por falta de dado

### Fase 6. Fechar validacao real

- widget real
- WhatsApp real
- loja real do Mercado Livre
- agentes com catalogo incompleto
- billing real

## Regras de teste no nivel maximo

Tres camadas obrigatorias:

1. teste unitario de handler
2. smoke de orquestracao
3. jornada real de canal

Exemplos:

- widget: busca, detalhe, load more, follow-up factual
- billing: overview, comparacao, recomendacao, follow-up consultivo
- api runtime: fato, status, comparacao, follow-up curto
- WhatsApp: sync, pausa, handoff, continuidade

## O que pode ser removido ou consolidado

Planos muito isolados por vertical tendem a ficar obsoletos rapido quando o sistema passa a compartilhar motor, contexto e contrato.

Direcao:

- manter um documento arquitetural raiz
- manter arquivos de continuidade realmente vivos por frente critica
- remover planos antigos quando virarem so snapshot historico de uma fase ja superada

## Como o Codex deve usar este arquivo

Se a tarefa tocar qualquer parte de:

- chat
- widget
- WhatsApp
- Mercado Livre
- billing
- api runtime
- continuidade
- contexto conversacional

o Codex deve:

1. ler este arquivo
2. conferir `AGENTS/README.md`
3. conferir `AGENTS/runtime-intent-refactor.md` se tocar cerebro
4. preferir sempre contrato estruturado sobre heuristica
5. atualizar o arquivo de continuidade especifico da frente quando fizer mudanca relevante

## Criterio de pronto arquitetural

Considerar esse universo perto do teto quando:

- dominio certo e escolhido sem drift
- continuidade depende de estado explicito, nao de adivinhacao textual
- canais apenas adaptam
- handlers dominam a regra
- `orchestrator` coordena sem sequestrar responsabilidade
- diagnostico por turno explica claramente por que a resposta saiu daquele jeito
- os cenarios reais de widget, WhatsApp e Mercado Livre passam sem comportamento “misterioso”

## Resumo final

O produto ja tem base forte.

O melhor proximo salto nao e mais “colocar mais IA”.

O melhor proximo salto e:

- arquitetura de contrato
- contexto explicito
- handler dono de dominio
- adapter fino
- observabilidade forte

Esse e o caminho para sair de um sistema forte porem ainda heterogeneo para um motor conversacional realmente maduro.
