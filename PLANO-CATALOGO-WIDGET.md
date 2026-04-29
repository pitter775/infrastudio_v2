# Plano Catalogo Widget

Objetivo:

- corrigir a continuidade de catalogo no widget sem heuristica textual ampla
- alinhar chat, vitrine e snapshot da loja
- eliminar silencio em acoes explicitas como `Ver mais opcoes` e `Saber mais`
- consolidar um fluxo que o Codex consiga executar por etapas sem reabrir regressao

## Diagnostico atual

Problemas observados no fluxo real:

1. `Ver mais opcoes` ainda pode falhar sem reply
- o clique e explicito, mas em alguns cenarios o backend nao devolve resposta visivel
- isso quebra o contrato da UX e deixa o usuario sem confirmacao

2. `Saber mais` melhorou no widget, mas o catalogo ainda perde coerencia depois
- a bolha azul falsa foi reduzida
- porem, apos entrar em detalhe e fazer nova pergunta curta como `tem balde?`, o runtime ainda pode ficar preso no contexto anterior

3. o chat ainda diverge da vitrine
- a vitrine mostra varios itens relevantes
- o chat pode responder `Encontrei 1 produto`
- isso indica que a busca do chat ainda esta usando estado estreito, residual ou desalinhado da listagem real

4. detalhe de produto e listagem ainda estao acoplados demais
- `produtoAtual`
- `ultimaBusca`
- `ultimosProdutos`
- `pagination`
- tudo ainda vive muito misturado
- isso facilita sequestro de contexto

## Regra obrigatoria

- nao corrigir variacao de linguagem com regex nova, `includes`, lista de frases ou excecoes manuais
- resolver com:
  - estado explicito
  - `intent-stage` semantico estruturado
  - handler deterministico

## Arquitetura alvo

Separar definitivamente:

1. `listingSession`
- representa a busca/listagem ativa
- nao pode ser destruida ao abrir detalhe

2. `productFocus`
- representa o item atualmente em foco
- sempre aponta para a `listingSession` de origem quando existir

Estrutura desejada em `context.catalogo`:

```js
{
  listingSession: {
    id: "session-id",
    snapshotId: "snapshot-id",
    searchTerm: "inox",
    matchedProductIds: ["MLB1", "MLB2", "MLB3"],
    offset: 0,
    nextOffset: 3,
    poolLimit: 24,
    hasMore: true,
    total: 9,
    source: "storefront_snapshot"
  },
  productFocus: {
    productId: "MLB2",
    sourceListingSessionId: "session-id",
    detailLevel: "focused"
  }
}
```

## Ordem de ataque

### Etapa 1. Instrumentacao e reproducao

Objetivo:

- descobrir exatamente onde o estado se perde

Fazer:

- registrar em log diagnostico por turno:
  - `context.catalogo`
  - `context.ui.catalogAction`
  - `catalogDecision`
  - `productSearchTerm`
  - `paginationOffset`
  - `paginationNextOffset`
  - `matched count` real do snapshot
  - `reply assets count`
- reproduzir esta sequencia:
  1. buscar `inox`
  2. clicar `Ver mais opcoes`
  3. clicar `Saber mais`
  4. perguntar `tem balde?`

Conclusao esperada:

- identificar em qual turno:
  - a listagem some
  - o detalhe sequestra o contexto
  - o `load_more` fica silencioso

### Etapa 2. Contrato obrigatorio de acoes estruturadas

Objetivo:

- nenhuma acao do widget pode depender de texto livre

Fazer:

- garantir que:
  - `Ver mais opcoes` use somente `catalogAction=load_more`
  - `Saber mais` use somente `catalogAction=product_detail`
  - ambos possam carregar `catalogProductId`
  - ambos possam carregar `listingSessionId`
- proibir reply silenciosa para acoes estruturadas

Estados permitidos para acoes estruturadas:

- `assistant_reply`
- `assistant_reply_with_assets`
- `explicit_no_more_items`
- `explicit_cannot_continue_listing`

Estado proibido:

- `silent_success`

### Etapa 3. Introduzir `listingSession` no backend

Objetivo:

- parar de depender de `ultimaBusca + ultimosProdutos + produtoAtual` como estado misturado

Fazer:

- criar/normalizar `context.catalogo.listingSession`
- gravar nela:
  - termo da busca
  - ids encontrados
  - offsets
  - total
  - `hasMore`
  - origem do snapshot
- manter `productFocus` separado

Regra:

- abrir detalhe nunca destroi `listingSession`

### Etapa 4. Fazer `load_more` paginar a sessao, nao reinterpretar texto

Objetivo:

- `Ver mais opcoes` deve continuar a lista atual de forma deterministica

Fazer:

- `catalog-intent-handler` deve tratar `load_more` como comando de paginacao da `listingSession`
- o adapter Mercado Livre deve receber:
  - `listingSession.searchTerm`
  - `listingSession.offset`
  - `listingSession.nextOffset`
  - `listingSession.poolLimit`
- se nao existir sessao valida:
  - responder erro controlado

Reply obrigatoria quando nao houver mais itens:

- `Nao encontrei mais itens nessa busca no momento. Se quiser, me passe outro termo e eu faco uma nova busca.`

### Etapa 5. Fazer `product_detail` usar item e sessao explicitamente

Objetivo:

- detalhe nao pode nascer de inferencia textual

Fazer:

- tratar `product_detail` como:
  - `open_product_detail(productId, listingSessionId?)`
- atualizar `productFocus`
- preservar `listingSession`

Regra:

- detalhe e um estado visual/factual
- nao pode sequestrar toda pergunta seguinte

### Etapa 6. Corrigir nova busca curta em contexto de detalhe

Objetivo:

- perguntas como `tem balde?` devem sair do item atual quando a intencao for busca

Fazer:

- fortalecer `intent-stage` semantico para diferenciar:
  - `current_product_question`
  - `catalog_search_refinement`
  - `new_catalog_search`
- quando houver `new_catalog_search`:
  - usar a base do snapshot da loja
  - nao reciclar apenas `produtoAtual`

Regra:

- `tem balde?` em detalhe nao pode continuar respondendo como se fosse pergunta sobre o item atual

### Etapa 7. Guardrail de coerencia com a vitrine

Objetivo:

- impedir replies incoerentes com a base real da loja

Fazer:

- antes de responder quantidade:
  - comparar `replyCount` com `actualMatchedCount`
- se a reply falar `Encontrei 1 produto`, mas o snapshot real tiver mais:
  - bloquear essa resposta
  - reconstruir com base real

### Etapa 8. Factual deterministico de produto

Objetivo:

- perguntas factuais nao podem cair em silencio

Fazer:

- manter handler deterministico para:
  - preco
  - material
  - cor
  - estoque
  - garantia
  - frete
  - link
  - medidas
  - dimensoes
  - peso
  - capacidade
- quando o atributo nao existir:
  - responder explicitamente que o anuncio nao trouxe esse dado

### Etapa 9. Regressao obrigatoria

Criar cobertura para:

1. `inox` -> listar 3 -> `Ver mais opcoes` -> responder sempre
2. `inox` -> `Saber mais` -> sem bolha azul falsa
3. `ver mais opcoes` -> manter a mesma bolha de lista, com loading visivel na propria bolha enquanto atualiza
4. nova busca depois de detalhe/lista, como `tem inox?` -> criar nova bolha de lista e preservar a lista anterior na timeline

### Etapa 10. Contrato de renderizacao da timeline

Objetivo:

- separar claramente atualizacao de lista existente vs nova lista no chat

Fazer:

- backend deve sinalizar modo da mensagem de catalogo:
  - `replace_listing` para `load_more`
  - `append_listing` para nova busca/refinamento que gera nova lista
- widget deve obedecer esse contrato sem dedupe por texto/tempo
- `replace_listing`:
  - atualiza a bolha da lista ativa
  - mostra loading apenas dentro da bolha da lista
  - reposiciona o scroll para o inicio da bolha atualizada
- `append_listing`:
  - cria nova bolha de lista
  - preserva listas anteriores na timeline
  - nao sobrescreve lista antiga so porque o texto da reply e parecido

Regra:

- busca nova nunca pode sobrescrever lista antiga
- so `load_more` pode substituir a bolha da lista atual
3. detalhe -> `tem balde?` -> busca relevante no snapshot
4. `load_more` no fim da sessao -> mensagem explicita de fim
5. reply de quantidade coerente com `matched count` real
6. detalhe + pergunta factual de medidas -> resposta deterministica

## Estrutura atual: avaliacao

A estrutura atual e aproveitavel, mas ainda esta espalhada demais.

Responsabilidades hoje:

- `backend/public/chat-widget.js`
  - UX e disparo das acoes
- `backend/lib/chat/catalog-intent-handler.js`
  - decisao de continuidade catalogal
- `backend/lib/chat/orchestrator.js`
  - coordenacao geral, ainda com peso grande no merge de estados
- `backend/lib/chat/mercado-livre.js`
  - execucao e parte do comportamento de busca/detalhe

Problema estrutural:

- o catalogo ainda nao tem um dono unico de estado
- isso abre espaco para drift entre detalhe, listagem e paginacao

Melhoria estrutural recomendada:

1. `widget`
- apenas dispara acao estruturada

2. `semantic-intent-stage`
- apenas classifica intencao

3. `catalog handler`
- dono unico de:
  - `listingSession`
  - `productFocus`
  - `load_more`
  - `product_detail`
  - `new_catalog_search`

4. `mercado-livre adapter`
- apenas executa:
  - busca
  - paginacao
  - detalhe
  - snapshot

5. `reply builder`
- apenas formata a resposta final

## Checklist de execucao para o Codex

Antes de editar:

1. ler:
  - `AGENTS/README.md`
  - `AGENTS/basico.md`
  - `AGENTS/chat-runtime.md`
  - `AGENTS/runtime-intent-refactor.md`

2. nao adicionar heuristica textual nova

3. atualizar `AGENTS/runtime-intent-refactor.md` a cada mudanca relevante

4. validar com:
  - `cd backend && npm run test:chat-intelligence`

## Ordem recomendada de implementacao

1. Etapa 1
2. Etapa 2
3. Etapa 3
4. Etapa 4
5. Etapa 5
6. Etapa 6
7. Etapa 7
8. Etapa 9
9. refino final da Etapa 8 conforme lacunas reais

## Criterio de pronto

Considerar concluido quando:

- `Ver mais opcoes` nunca fica sem resposta
- `Saber mais` nunca simula digitacao
- abrir detalhe nao quebra a listagem
- busca curta nova em detalhe usa base relevante da loja
- contagem/resumo do chat bate com o snapshot real
- toda a sequencia real do usuario passa sem regressao
