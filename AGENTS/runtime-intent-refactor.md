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
- o `domain-router` de catalogo tambem ficou menos sensivel a substantivo amplo em vitrine:
  - `produto`, `item`, `loja`, `catalogo` e afins nao sobem mais so por contexto de storefront
  - esses termos agora pedem contexto recente real ou candidato de busca real
  - sinais mais fortes como `link`, `estoque`, `modelo`, `MLB...` continuam podendo subir com contexto de catalogo/vitrine
- o fallback local de referencia recente tambem ficou menos propenso a sequestrar busca nova curta:
  - se a frase curta parece busca nova (`saleiro azul`) e nao traz deitico forte, o runtime nao pede desambiguacao da lista recente
  - isso evita transformar busca nova curta em `recent_product_reference_unresolved`
- o `hasShortCatalogQuerySignal` da vitrine tambem foi estreitado:
  - query curta ampla como `item` deixa de subir para catalogo
  - busca curta real como `saleiro azul` continua subindo
  - isso reduz mais um falso positivo da vitrine sem matar busca curta valida
- o `intent-stage` de catalogo agora tambem cobre `new_catalog_search`:
  - isso permite tratar busca curta de vitrine como decisao semantica estruturada
  - o orquestrador agora avalia o stage semantico de catalogo tambem em contexto de storefront, mesmo sem snapshot recente
  - isso reduz mais o peso do `domain-router` na vitrine quando o cliente inicia uma busca curta real
- o `domain-router` deixou de subir busca curta de vitrine por conta propria:
  - `saleiro azul` na vitrine agora pode ficar `general` no roteador
  - a subida para `catalog` passa a acontecer via override semantico do orquestrador
  - isso reduz mais o papel do roteador como decisor primario de catalogo
- o `domain-router` tambem deixou de subir sinal forte de objeto na vitrine sem contexto recente:
  - `me manda o link` ou `estoque` na vitrine sem lista recente nao sobem mais sozinhos para `catalog`
  - com lista recente real, continuam podendo subir
  - isso reduz mais um vazamento em que o roteador sequestrava a conversa antes do stage semantico
- a continuidade de catalogo por `activeFocus` agora tambem ficou mais fail-closed:
  - `focus` antigo sem lista/busca recente real nao mantem mais `catalog` sozinho
  - contexto de vitrine por si so nao basta para continuar follow-up curto no roteador
  - isso reduz dependencia de estado velho e deixa a retomada curta mais dependente de contexto catalogal real
- o `domain-router` de billing tambem ficou mais fail-closed:
  - sem `pricingCatalog` estruturado real no runtime, o roteador nao assume billing so por `planos`, `assinatura` ou similares
  - isso joga mais casos para o `intent-stage` e reduz chute textual no roteador
- o `domain-router` de billing agora tambem ficou mais estrito mesmo com `pricingCatalog`:
  - nome explicito de plano continua subindo
  - billing generico agora pede sinal mais forte de comparacao/valores em vez de subir so por noun amplo
  - isso empurra mais casos para o `intent-stage` e reduz resquicio auxiliar de billing no roteador
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
  - o fallback local de refinamento tambem passou a exigir ancora real no contexto:
    - referencia forte ao item/lista recente ou sobreposicao com `ultimaBusca`/produto atual
    - atributo solto sem ancora deixa de sequestrar a decisao como refinamento local
    - isso rebaixa mais `catalog-follow-up.js` para guardrail local e nao decisor principal
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
- os hints estruturados de API agora tambem entram de forma mais deterministica no runtime:
  - o orquestrador passa a reconstruir `focusedApiContext` com `targetFieldHints` e `supportFieldHints` apos o `intent-stage`
  - `buildFocusedApiContext` e `buildApiFallbackReply` agora priorizam match por hints e por grupos estruturados de intent antes do score textual livre
  - isso reduz dependencia do matcher textual bruto para escolher campo, suporte e resposta factual
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

- billing ainda tem deteccoes auxiliares espalhadas no runtime, mas pricing estruturado saiu do caminho heuristico principal
- catalogo ainda depende bastante de `catalog-follow-up.js`, embora o stage semantico ja cubra produto em foco e item recente
 - `catalog-follow-up.js` ainda concentra guardrails textuais locais para refinamento/load more/referencia, embora agora mais ancorados em estado real
- `catalog-follow-up.js` ainda continua como fallback local para refinamento/load more/referencia quando o stage semantico nao rodar ou nao classificar
- `domain-router` ainda decide dominio demais por regex
- `domain-router` de catalogo ainda tem regex, mas agora mais dependente de candidato real de busca e menos de verbo solto
- `sales-heuristics` ainda concentra regra de negocio demais
- `sales-heuristics` ainda concentra regra de negocio demais, mas ja ficou menos acoplado a pricing/billing
- regressao em um dominio ainda pode contaminar outro
 - `api_runtime` ainda depende bastante de matching textual em `api-runtime.js`, apesar de agora usar melhor os hints estruturados do stage semantico
 - `api-runtime.js` ainda concentra a escolha interna de campos por matching textual quando faltam hints estruturados
- `api-runtime.js` ainda precisa empurrar mais comparacao, resumo e selecao de grupos para dados estruturados em vez de matching local
- `api-runtime.js` ainda usa matching textual para detectar comparacao entre itens e para agrupar suporte contextual de campos
- `api-runtime.js` ainda usa matching textual como fallback quando o stage semantico nao devolver hints suficientes
- principalmente em deteccao aberta de intent e em busca livre por campos
- a parte mais ampla agora esta menor, mas `findMatchingApiFields` e `getApiKeywordGroups` ainda concentram matching local residual
- o fallback ainda existe, mas ficou mais contido e menos propenso a “adivinhar” contexto de API em frase aberta
- a busca livre por campo continua existindo, mas agora bem mais amarrada ao vocabulario conhecido de API
- o score ainda existe, mas agora bem menos dependente de substring parcial
- o `domain-router` de catalogo ficou mais dependente de estado recente real e menos de frase curta isolada
- o `domain-router` de catalogo agora tambem ficou menos sensivel a substantivo amplo solto
- o `domain-router` de catalogo ainda tem um guardrail local de follow-up curto, mas agora bem mais dependente de referencia forte real
- o `domain-router` de catalogo ainda tem um guardrail local de substantivo/objeto, mas agora bem menos propenso a sequestrar vitrine so por palavra ampla
- `catalog-follow-up.js` ainda tem fallback local de referencia recente, mas agora menos agressivo em frases curtas que parecem busca nova
- o `domain-router` ainda tem heuristica local para query curta de vitrine, mas agora mais fail-closed e dependente de candidato real
- a vitrine agora ja consegue usar `intent-stage` para nova busca curta mesmo sem lista recente, reduzindo acoplamento ao roteador textual
- o roteador de vitrine ficou mais fail-closed: contexto de storefront sem sinal forte ou estado recente real nao sobe mais catalogo sozinho
- a vitrine agora depende mais de estado recente real ou de override semantico do orquestrador, e menos de regex no roteador
- billing agora tambem depende mais de runtime estruturado real ou de override semantico do orquestrador, e menos de regex no roteador
- o `domain-router` parou de subir billing como decisor inicial por regex de pricing:
  - a entrada inicial de billing agora depende do `intent-stage` do orquestrador
  - o roteador nao continua mais billing por `focus`
  - isso fecha o ultimo resquicio de billing local no `domain-router`
- a classificacao semantica de billing agora roda mesmo quando o route base caiu em `catalog` sem produto travado
  - isso evita perder uma pergunta de pricing por falso positivo catalogal no roteamento base
  - a resposta continua deterministica sobre `runtimeConfig.pricingCatalog`
- o fallback factual de API tambem ficou mais fail-closed:
  - o runtime deixou de pegar arbitrariamente os primeiros campos da API so porque a frase parecia um follow-up curto
  - sem hints estruturados e sem match factual real, ele prefere nao adivinhar contexto de campo
- o fallback residual de campo em `api-runtime.js` tambem ficou menos amplo:
  - quando ainda precisa cair em preferencia local, ele passa a priorizar campos do intent detectado (`price`, `docs`, `status`, etc.)
  - so usa a lista ampla generica quando nao houver nenhum intent factual minimamente resolvido
  - isso reduz mais um caminho em que o runtime podia puxar campo irrelevante por fallback aberto
- a comparacao textual residual de API tambem ficou mais ancorada:
  - sem decisao semantica, comparacao por texto agora exige ancora real de lista
  - isso pode vir de referencia explicita a `1/2/3` ou de lista recente no contexto
  - comparacao vaga como `qual vale mais a pena?` deixa de escolher item so porque existem produtos na API
- a busca livre de campo em `api-runtime.js` tambem ficou mais estreita:
  - `findMatchingApiFields` agora so roda quando houver token direto real do vocabulario de API na mensagem
  - e o campo so entra na disputa se houver acerto direto real nesse proprio campo
  - intent derivado sozinho nao libera mais matching livre de campo
  - isso reduz mais um caminho de casamento textual amplo quando faltam hints estruturados
- `sales-heuristics.js` tambem perdeu mais um vazamento de billing:
  - a checagem de fronteira para lead capture deixou de depender de `pricingCatalog` e nomes de plano
  - agora ela usa sinal real de conversa de catalogo/produto em vez de match com pricing estruturado
  - o helper residual `buildCatalogPricingReply` saiu do arquivo por nao participar mais do fluxo principal
- o `load more` residual de `catalog-follow-up.js` tambem ficou mais estrito:
  - frase explicita como `mais opcoes` ou `manda o que tiver` continua valendo
  - palavra solta como `outras` agora precisa de ancora real de lista/busca recente
  - isso reduz mais um sequestro de catalogo por fallback curto fora de contexto
- a referencia recente ambigua do catalogo tambem ficou menos ampla:
  - se houver um unico produto recente, deitico forte agora trava direto nesse item
  - a desambiguacao residual (`recent_product_reference_unresolved`) fica reservada para lista recente realmente concorrente
  - isso reduz mais um caso em que o fallback local abria ambiguidade desnecessaria
- o merge de catalogo no orquestrador tambem ficou mais semantico-first:
  - quando existe decisao semantica, ela passa a mandar na maior parte dos casos
  - a heuristica local so sobrescreve o stage quando ele caiu em `recent_product_reference_unresolved` e o guardrail local conseguiu resolver referencia concreta
  - isso rebaixa mais `catalog-follow-up.js` para buraco residual, nao decisor paralelo
- o `domain-router` de vitrine tambem ficou mais semantico-first:
  - busca verbal com candidato real (`me mostra saleiro`) deixa de subir direto por regex local
  - na vitrine sem contexto recente, a subida volta a depender do stage semantico
  - o roteador ainda aceita item explicito do Mercado Livre (`MLB...`) como excecao forte
- o `domain-router` de follow-up curto tambem ficou mais semantico-first:
  - resposta apos prompt antigo nao sobe mais catalogo por query curta local
  - nesse caminho o roteador agora aceita so referencia forte ou pedido explicito de mais opcoes
  - busca curta nova fica para o stage semantico do orquestrador
- o gate de lookup explicito em `api-runtime.js` tambem ficou mais estrito:
  - sinal de API agora exige token direto real + intent factual
  - intent derivado sozinho nao abre mais lookup livre
- o fallback residual de campos na API tambem ficou mais curto:
  - sem `targetFieldHints` e sem intent factual detectado, o runtime nao cai mais na lista generica de campos preferidos
  - isso reduz mais um caminho de resposta semi-estruturada por chute local
- a continuidade por `focus` de catalogo tambem ficou mais estreita:
  - query curta em foco deixa de subir so por `hasShortCatalogQuerySignal`
  - com foco recente, o roteador agora continua catalogo so em follow-up de referencia forte ou pedido explicito de mais opcoes
  - busca curta nova volta a depender do stage semantico
- `api-runtime.js` perdeu mais um score residual de matching livre:
  - `findMatchingApiFields` deixou de somar `relatedTokens` por grupo semantico aproximado
  - o score residual agora fica restrito a `directTokens` reais do vocabulario de API + `intentTokens`
  - isso reduz mais um caminho em que grupo relacionado podia empurrar campo por associacao frouxa
- o `domain-router` tambem perdeu uma heuristica curta que ja nao participava mais do fluxo real:
  - `hasShortCatalogQuerySignal` saiu do arquivo
  - a continuidade/local guard de catalogo fica explicitamente limitada a referencia forte ou pedido claro de mais opcoes
- `api-runtime.js` tambem ficou menos dependente de substring ampla para inferir intent:
  - `getApiKeywordGroups` agora deriva `intentTokens` so de tokens reais presentes no vocabulario conhecido
  - `detectApiIntent` deixou de depender de `normalizedMessage.includes(trigger)` e passa a olhar tokens reais/hints derivados
  - `API_KEYWORD_GROUPS` saiu do arquivo
  - isso reduz mais um caminho em que frase aberta podia empurrar intent factual por substring ampla
- o agrupamento auxiliar de suporte em `api-runtime.js` tambem ficou mais fechado:
  - `findSupportFields` agora usa so `supportFieldHints` estruturados ou campos auxiliares derivados do intent detectado
  - o fallback final por suffix solto foi removido
  - `buildFocusedApiContext` passou a reutilizar esse mesmo resolve unico de suporte
  - isso reduz mais um caminho em que o runtime podia anexar contexto auxiliar por casamento local amplo
- a comparacao textual residual de API tambem ficou mais fechada:
  - comparacao textual de `best_choice` agora so vale com referencia explicita de itens (`1/2/3`, ordinais)
  - ranking textual de preco (`mais barato`, `mais caro`) continua aceito quando houver lista recente real
  - comparacao consultiva vaga sem ancora explicita volta a depender do stage semantico
  - isso reduz mais um caminho em que o runtime podia comparar itens por texto amplo sem referencia concreta
- o orquestrador tambem rebaixou mais o fallback local de catalogo:
  - `resolveDeterministicCatalogFollowUpDecision` agora so e consultado quando nao houver decisao semantica de catalogo ou quando o stage cair em `recent_product_reference_unresolved`
  - com isso, o guardrail local deixa de rodar em paralelo nos casos em que o stage semantico ja decidiu refinamento, load more, busca nova ou referencia resolvida
  - isso reduz mais o papel do fallback local como decisor concorrente

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

- continuar reduzindo matching textual em `api-runtime.js`, principalmente revisando se `detectApiCatalogComparisonIntent` e o agrupamento de suporte ainda podem depender menos de texto livre
- seguir rebaixando `catalog-follow-up.js` para guardrail residual, nao decisor
- depois revisar se o merge final no `orchestrator.js` ja pode simplificar mais um passo sem reabrir regressao
