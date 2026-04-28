# Runtime Intent Refactor

Arquivo de continuidade obrigatorio para qualquer Codex que tocar o cerebro do chat.

Objetivo:

- parar de expandir heuristicas textuais espalhadas
- migrar o runtime para estado + intent stage + handlers deterministas
- evitar regressao cruzada entre Mercado Livre, billing, API runtime e chat geral

## Regra principal

- nao adicionar nova heuristica textual ampla para resolver variacao de linguagem do usuario
- se o problema for "o usuario falou diferente", a solucao preferida e:
  1. fortalecer contexto/estado
  2. criar ou melhorar classificacao estruturada por LLM
  3. responder por handler determinista usando dados estruturados

Heuristica so pode entrar como:

- guardrail minimo
- fallback local e isolado
- protecao contra loop, greeting, sanidade basica

Heuristica nao pode entrar como:

- decisor principal de billing
- decisor principal de catalogo
- decisor principal de API runtime
- decisor principal de agenda

## Arquitetura alvo

1. estado/contexto
- `general`
- `billing`
- `catalog_listing`
- `product_focus`
- `product_locked`
- `api_runtime`
- `agenda`
- `handoff`

2. intent stage estruturado
- entrada:
  - ultima mensagem
  - historico curto
  - contexto atual
  - dados estruturados disponiveis
- saida JSON:
  - `domain`
  - `intent`
  - `target`
  - `confidence`
  - `needsLookup`
  - `useCurrentProduct`
  - `usePricingCatalog`
  - `needsHuman`

3. handlers deterministas
- `billing-handler`
- `catalog-handler`
- `api-handler`
- `agenda-handler`
- `handoff-handler`

4. LLM de redacao
- entra para explicar melhor
- nao entra para inventar fato

## Onde a heuristica ainda pesa hoje

- `backend/lib/chat/domain-router.js`
- `backend/lib/chat/orchestrator.js`
- `backend/lib/chat/sales-heuristics.js`
- `backend/lib/chat/catalog-follow-up.js`
- `backend/lib/chat/mercado-livre.js`
- `backend/lib/chat/api-runtime.js`

## Estado atual desta frente

Ja feito:

- Mercado Livre em detalhe de produto ganhou contexto forte e reset por navegacao
- snapshot da loja Mercado Livre ficou mais resiliente no refresh
- produto em foco do Mercado Livre ja responde varios fatos de forma deterministica
- busca por "outro do mesmo tipo" no Mercado Livre ja usa classificacao semantica
- pricing estruturado do agente voltou a responder `plano mais caro` e `me passa os valores` pelo `runtimeConfig.pricingCatalog`

Ainda errado / fragil:

- billing/plans ainda depende de heuristica textual em partes do orquestrador
- `domain-router` ainda decide dominio demais por regex
- `sales-heuristics` ainda concentra regra de negocio demais
- regressao em um dominio ainda pode contaminar outro

## Ordem de ataque obrigatoria

1. tirar billing/pricing da heuristica ampla
- criar `intent-stage` estruturado para:
  - `pricing_overview`
  - `highest_priced_plan`
  - `lowest_priced_plan`
  - `plan_comparison`
- responder sempre via `runtimeConfig.pricingCatalog.items`

2. tirar catalogo da heuristica ampla
- manter estado de produto/lista
- classificar:
  - `product_fact_question`
  - `same_type_search`
  - `new_catalog_search`
  - `recent_item_reference`

3. tirar API runtime da heuristica ampla
- classificar:
  - `api_fact_query`
  - `api_status_query`
  - `api_comparison`

4. simplificar o orquestrador
- ele coordena
- nao interpreta linguagem por regex

## Arquivos para ler antes de continuar

- `AGENTS/chat-runtime.md`
- `backend/lib/chat/orchestrator.js`
- `backend/lib/chat/domain-router.js`
- `backend/lib/chat/sales-heuristics.js`
- `backend/lib/chat/semantic-intent-stage.js`
- `backend/lib/chat/mercado-livre.js`
- `backend/lib/chat/api-runtime.js`

## Regras de manutencao deste arquivo

- atualizar este arquivo a cada mudanca relevante nessa frente
- registrar:
  - o que foi concluido
  - o que ainda esta fragil
  - qual o proximo passo exato
- se um Codex pegar essa frente, ele deve continuar daqui antes de inventar nova heuristica

## Proximo passo recomendado agora

- extrair billing/plans para `intent-stage` estruturado
- remover do fluxo de pricing a dependencia principal de regex
- manter o JSON do agente como fonte de verdade
