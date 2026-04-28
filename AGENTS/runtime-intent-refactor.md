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
- quando o agente nao trouxer `runtimeConfig.pricingCatalog`, o orquestrador agora pode extrair um catalogo estruturado de pricing a partir do proprio texto do agente (`promptBase`/descricao) antes de classificar billing
- isso fecha o caso de deploy em que os valores estao descritos no agente, mas ainda nao foram migrados para `runtimeConfig`
- essa extracao agora tambem fica em cache em memoria por agente/prompt para evitar custo repetido em toda pergunta de billing
- a chave desse cache foi reduzida para `agentId + hash(promptBase)` para nao carregar o prompt inteiro em memoria como chave
- a extracao de pricing pelo texto do agente agora tambem so roda quando o roteamento inicial nao ja estiver claramente em `catalog`, `api_runtime`, `agenda` ou `handoff`
- o `runtimeConfig` efetivo enriquecido por extracao semantica agora tambem e repassado para o gerador downstream, nao fica preso apenas aos handlers locais do billing
- precedencia de preco agora precisa ser tratada como regra dura:
  - `produto em foco` manda sobre qualquer pricing do agente
  - `runtimeConfig.pricingCatalog` explicito manda sobre qualquer valor descrito no texto do agente
  - extracao do texto do agente so entra quando nao houver catalogo estruturado explicito
- o texto do agente agora tambem pode enriquecer `business.summary`, `business.services` e `sales.cta` quando esses blocos nao estiverem estruturados explicitamente
- esses blocos estruturados tambem respeitam precedencia: se o agente ja tiver `runtimeConfig.business` ou `runtimeConfig.sales` explicitos, o texto nao sobrescreve
- quando `pricingCatalog` vier por extracao do texto do agente, o prompt tambem passa a expor esse catalogo estruturado ao modelo, em vez de depender so do texto cru do agente
- a extracao de business/sales pelo texto do agente agora tambem ficou gated: nao roda quando o roteamento inicial ja estiver claramente em `catalog`, `api_runtime`, `agenda` ou `handoff`
- o `domain-router` de catalogo agora tambem nao continua so por `focus` antigo: ele exige estado recente real de catalogo ou contexto storefront junto do focus
- o fallback local de `load more` no catalogo tambem foi estreitado:
  - `mais` sozinho nao vira mais `catalog_search`
  - agora precisa de frase mais explicita como `mais opcoes`, `mais produtos`, `outros modelos` ou verbos com `o que tiver`
- o `domain-router` de catalogo tambem ficou menos sensivel a follow-up generico com foco recente:
  - `quero`, `manda`, `mostra`, `traz` e afins nao continuam catalogo sozinhos
  - follow-up curto agora precisa de referencia forte (`esse`, `desse`, `gostei`, ordinais, `link`, `detalhes`) ou pedido explicito de mais opcoes
  - isso reduz mais um vazamento em que contexto velho de catalogo sequestrava conversa ampla
- billing/pricing ganhou `intent-stage` estruturado inicial no orquestrador para:
  - `pricing_overview`
  - `highest_priced_plan`
  - `lowest_priced_plan`
  - `plan_comparison`
  - `specific_plan_question`
- resposta de billing continua deterministica sobre `runtimeConfig.pricingCatalog.items`
- o orquestrador agora faz override semantico de billing quando o `intent-stage` reconhece pricing mesmo que o `domain-router` base nao classifique a frase como billing
- o `domain-router` de billing foi estreitado:
  - deixou de tratar `valor`, `preco` e `quanto custa` como sinal suficiente por si so
  - continua aceitando sinal explicito de plano/assinatura/credito
  - tambem aceita nome/slug explicito de plano vindo do `pricingCatalog`
- o fallback heuristico de pricing no orquestrador foi reduzido:
  - billing estruturado prefere `intent-stage`
  - heuristica de pricing fica como contingencia local apenas quando o `intent-stage` nao retornar classificacao
- o handler deterministico de pricing agora aceita o contrato normalizado do `intent-stage` (`kind`) alem do bruto (`intent`)
- o fallback heuristico de pricing no orquestrador foi estreitado:
  - so entra quando o roteamento ja estiver em billing
  - nao deve mais vazar para conversa geral por palavra generica
- o fallback residual de pricing em `sales-heuristics.js` tambem foi estreitado:
  - exige noun billing explicito ou nome real de plano do catalogo
  - nao deve mais disparar so por `valor`, `preco`, `quanto custa`, `me passa`
- o fallback de pricing deixou de reutilizar historico inteiro para casar plano:
  - agora o match residual usa a mensagem atual
  - isso reduz vazamento de pricing por contexto antigo da conversa
- o fallback residual de pricing saiu do orquestrador:
  - pricing estruturado agora depende do `intent-stage`
  - sem classificacao estruturada, o fluxo segue para resposta normal do modelo
- o codigo residual de fallback de pricing tambem foi limpo de `sales-heuristics.js`
  - `buildCatalogPricingReply` voltou a ficar restrito ao caso factual de produto
  - pricing estruturado nao deve mais passar por esse arquivo no fluxo principal
- o stage semantico de catalogo foi ampliado:
  - agora pode resolver item recente de lista, nao so produto em foco
  - isso abre caminho para reduzir `catalog-follow-up.js` como decisor principal
- o stage semantico de catalogo agora tambem cobre ambiguidade entre itens recentes
  - isso reduz a dependencia de heuristica para pedir desambiguacao em follow-up de lista
- o orquestrador agora tambem faz override semantico de catalogo
  - se houver contexto recente de catalogo e a classificacao semantica for forte, o dominio pode subir para `catalog`
  - isso reduz dependencia do `domain-router` em frases curtas como `aquela floral`
- removido um vazamento do orquestrador:
  - `buildCatalogPricingReply(produtoAtual)` nao roda mais fora de `pricingCatalog`
  - isso evitava respostas erradas de preco em perguntas de outro tipo no catalogo
- o `domain-router` de catalogo foi estreitado:
  - resposta generica apos prompt antigo nao sobe mais sozinha para `catalog`
  - follow-up curto de referencia continua aceito
  - verbo generico de catalogo (`me mostra`, `manda`, `quero`) sem candidato real de busca nao sobe sozinho para `catalog`
  - verbo catalogal com candidato real de busca continua aceito
  - continuidade por `focus` de catalogo agora aceita melhor follow-up curto real e reduz dependencia de verbo solto
- o orquestrador deixou de usar o follow-up heuristico amplo de catalogo
  - agora usa uma resolucao deterministica local para:
    - refinamento explicito
    - load more
    - ordem explicita
    - referencia recente
  - a heuristica ampla ficou rebaixada como legado local, nao decisor principal do fluxo
- `decideCatalogFollowUpHeuristically` foi reduzida a alias fino da resolucao deterministica
  - isso evita drift entre a API antiga e o fluxo novo
  - testes compartilhados passaram a usar `resolveDeterministicCatalogFollowUpDecision`
- `catalog-follow-up.js` agora foi quebrado em resolvers menores:
  - `detectCatalogSearchRefinement`
  - `resolveCatalogLoadMoreDecision`
  - `resolveRecentCatalogReferenceDecision`
  - `resolveDeterministicCatalogFollowUpDecision`
  - isso deixa mais claro o que ainda e guardrail local e o que ja virou decisao explicita
  - o fallback local de referencia recente tambem foi estreitado:
    - sinal fraco como `quero bonito` sem match real nao pede mais desambiguacao sozinho
    - desambiguacao local fica reservada para sinais deiticos/ordinais mais fortes
  - o fallback local de refinamento tambem foi estreitado:
    - agora so aceita refinamento textual quando houver atributo/sinal catalogal claro (`inox`, `vidro`, `material`, `cor`, etc.)
    - adjetivo vago ou refinamento aberto deixa de virar busca local
    - variacao linguistica mais aberta deve cair no `intent-stage`
- o `intent-stage` de catalogo foi ampliado para:
  - `catalog_search_refinement`
  - `catalog_load_more`
  - o orquestrador agora consulta o stage semantico sempre que houver snapshot recente de catalogo, nao so em referencia deitica
  - isso reduz mais a dependencia de regex/local guards em frases de refinamento e "mais opcoes"
- `api_runtime` ganhou `intent-stage` estruturado inicial no orquestrador para:
  - `api_fact_query`
  - `api_status_query`
  - `api_comparison`
  - o orquestrador agora pode subir para `api_runtime` por override semantico quando houver APIs estruturadas e o route base nao classificar
  - quando o stage semantico classifica consulta factual/status, o orquestrador agora nao depende mais do sinal textual local para entrar no handler factual de API
  - o stage semantico de API agora tambem pode devolver `targetFieldHints`
  - esses hints passaram a alimentar `buildFocusedApiContext` e `buildApiFallbackReply`, reduzindo a dependencia do texto literal da mensagem para escolher campos como `matricula`, `cartorio`, `valor` e `status`
  - a resposta factual direta de `api-runtime.js` agora tambem consulta esses hints antes do matcher textual local
  - o stage semantico de API agora tambem pode devolver `comparisonMode` e `referencedProductIndexes`
  - `resolveApiCatalogReply` passou a usar essa decisao estruturada antes da deteccao textual de comparacao
  - o agrupamento contextual de campos tambem passou a aceitar hints estruturados antes da deteccao textual do intent
  - o stage semantico de API agora tambem pode devolver `supportFieldHints`
  - `buildFocusedApiContext` e `buildApiFallbackReply` passaram a mesclar esses campos de suporte quando a decisao estruturada trouxer contexto complementar
  - o fallback factual de API agora tambem foi endurecido:
    - sem `targetFieldHints` e sem sinal explicito real de lookup, `buildApiFallbackReply` deixa de responder fato aberto em frase vaga
    - isso reduz vazamento de resposta estruturada quando o cliente fala algo amplo como `me fala desse imovel`
  - `buildFocusedApiContext` tambem deixou de abrir contexto focado em frase vaga quando nao houver hint estruturado nem lookup explicito
  - `relatedTokens` em `getApiKeywordGroups` agora so entram quando ja existe sinal semantico real de lookup
  - `directTokens` de `getApiKeywordGroups` agora foram limitados ao vocabulario real de API
  - isso reduz peso de token livre na busca de campos e deixa `findMatchingApiFields` menos propenso a casar coisa aleatoria
- `findMatchingApiFields` tambem saiu de `includes` solto e passou a pontuar por tokens reais do campo
- isso reduz coincidencia textual parcial em nomes compostos de campo
- no `domain-router`, o follow-up curto de catalogo agora tambem depende de contexto recente real (`produtoAtual` ou `ultimosProdutos`)
- isso reduz subida indevida para catalogo so porque houve um prompt antigo do assistente
- no `domain-router`, substantivo amplo de catalogo (`produto`, `item`, `loja`, etc.) agora tambem depende de contexto real ou candidato de busca
- isso reduz roteamento para catalogo por palavra genérica isolada
  - metadata local tambem passou a propagar `routingDecision` e `focus`, o que ajuda a auditar overrides semanticos
- por enquanto, esse stage de lista recente so entra em follow-up de referencia
  - refinamento explicito de busca continua no caminho de heuristica local protegida
- o gate minimo de referencia recente foi ampliado para cobrir `aquele/daquela/opcao`
  - isso libera o stage semantico em frases menos literais de follow-up de lista
- no merge atual, refinamento heuristico explicito ainda pode vencer um `recent_product_reference_unresolved` semantico
  - isso protege casos como atributo novo na lista recente (`inox`, `vidro`, etc.)
- refinamento heuristico explicito de catalogo agora vence qualquer decisao semantica que nao seja outro refinamento
  - isso evita que o stage semantico engula busca nova quando o usuario adiciona atributo realmente novo
- no refinamento residual, os tokens novos descobertos agora entram antes dos candidatos genericos de busca
  - isso puxa a busca para o atributo realmente novo (`inox`, `vidro`, etc.) em vez da `ultimaBusca`
- o fluxo Mercado Livre tambem passou a usar `uncoveredTokens[0]` como `productSearchTerm` preferencial em refinamento
  - isso fecha o caminho entre decisao de refinamento e execucao da busca
- quando o follow-up recente ja resolve um unico item, o flow state do Mercado Livre agora segura esse item sem nova busca
  - isso vale tanto para resolucao heuristica quanto semantica

Ainda errado / fragil:

- `domain-router` ainda existe como camada heuristica para billing, embora bem menor
- billing ainda tem fallback heuristico em `sales-heuristics.js` quando o `intent-stage` nao roda ou falha
- billing ainda tem fallback heuristico residual em `sales-heuristics.js`, mas agora limitado a contexto ja roteado como billing e a sinais explicitos de plano/catalogo
- billing ainda tem deteccoes auxiliares espalhadas no runtime, mas pricing estruturado saiu do caminho heuristico principal
- catalogo ainda depende bastante de `catalog-follow-up.js`, embora o stage semantico ja cubra produto em foco e item recente
- `catalog-follow-up.js` ainda concentra guardrails textuais locais para refinamento/load more/referencia, embora agora em funcoes menores e explicitas
- `catalog-follow-up.js` ainda continua como fallback local para refinamento/load more/referencia quando o stage semantico nao rodar ou nao classificar
- `domain-router` ainda decide dominio demais por regex
- `domain-router` de catalogo ainda tem regex, mas agora mais dependente de candidato real de busca e menos de verbo solto
- `sales-heuristics` ainda concentra regra de negocio demais
- regressao em um dominio ainda pode contaminar outro
- `api_runtime` ainda depende bastante de matching textual em `api-runtime.js`, apesar do override semantico inicial no orquestrador
- `api-runtime.js` ainda concentra a escolha interna de campos por matching textual, mesmo quando o dominio ja subiu corretamente por intent semantico
- `api-runtime.js` ainda precisa empurrar mais comparacao, resumo e selecao de grupos para dados estruturados em vez de matching local
- `api-runtime.js` ainda usa matching textual para detectar comparacao entre itens e para agrupar suporte contextual de campos
- `api-runtime.js` ainda usa matching textual como fallback quando o stage semantico nao devolver hints suficientes
- principalmente em deteccao aberta de intent e em busca livre por campos
- a parte mais ampla agora esta menor, mas `findMatchingApiFields` e `getApiKeywordGroups` ainda concentram bastante matching local
- o fallback ainda existe, mas ficou mais contido e menos propenso a “adivinhar” contexto de API em frase aberta
- a busca livre por campo continua existindo, mas agora bem mais amarrada ao vocabulario conhecido de API
- o score ainda existe, mas agora bem menos dependente de substring parcial
- o `domain-router` de catalogo ficou mais dependente de estado recente real e menos de frase curta isolada
- o `domain-router` de catalogo agora tambem ficou menos sensivel a substantivo amplo solto
- o `domain-router` de catalogo ainda tem um guardrail local de follow-up curto, mas agora bem mais dependente de referencia forte real

## Ordem de ataque obrigatoria

1. fechar billing de ponta a ponta
- tirar do `domain-router` a dependencia principal de regex para billing
- manter o `intent-stage` como decisor primario
- deixar heuristica so como fallback local minimo
- se possivel, reduzir `buildCatalogPricingReply` para fallback de contingencia apenas

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

 - continuar estreitando o `domain-router` de catalogo, principalmente `hasCatalogSignal` para deixar busca nova cada vez mais dependente de estado recente ou candidato real
