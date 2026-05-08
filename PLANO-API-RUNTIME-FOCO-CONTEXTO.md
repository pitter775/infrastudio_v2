# Plano API Runtime: foco, contexto e saída de foco

Objetivo: fazer APIs de catálogo se comportarem com fluidez parecida ao canal Mercado Livre, sem assumir que a API terá campos fixos, nomes previsíveis ou domínio específico.

## Premissa principal

A API pode representar qualquer coisa: imóveis, veículos, processos, pedidos, produtos, serviços, documentos ou dados internos.

Por isso, a solução não deve copiar regras específicas do Mercado Livre. O que deve ser reaproveitado é a arquitetura:

- estado de lista;
- estado de item em foco;
- ação estruturada do widget;
- classificação semântica de continuidade;
- handlers determinísticos para fatos;
- LLM apenas para redação/análise quando houver contexto estruturado suficiente.

## Problema atual

Quando a API retorna um card e o usuário continua a conversa, o runtime ainda tende a:

- repetir o card ou o resumo;
- tratar follow-up como nova consulta;
- não fixar claramente o item escolhido;
- responder perguntas consultivas como se fossem detalhe genérico;
- não sair do foco com a mesma maturidade do Mercado Livre.

Exemplo real:

1. API retorna imóvel com card.
2. Usuário pergunta: `quais os riscos desse imóvel?`
3. Resposta esperada: análise do imóvel em foco.
4. Resposta ruim: repetir detalhes/card ou buscar novamente.

## Direção correta

Criar uma camada genérica de `api_runtime` como provider de catálogo conversável.

Ela deve normalizar qualquer item retornado pela API para um contrato interno mínimo, sem depender de campos obrigatórios rígidos.

```js
{
  id,
  source: "api_runtime",
  sourceApiId,
  nome,
  descricao,
  resumo,
  preco,
  localizacao,
  link,
  imagem,
  fields,
  rawContext
}
```

`fields` deve conter campos normalizados e escalares úteis. `rawContext` deve ser enxuto, limitado e seguro para contexto da LLM, evitando payload grande.

## O que reaproveitar do Mercado Livre

Reaproveitar:

- `catalog-intent-handler.js`;
- `listingSession`;
- `productFocus`;
- `catalogAction=product_detail`;
- `catalogAction=load_more`;
- intent semântico de catálogo;
- comparação/ranking compartilhados;
- saída de foco por decisão semântica.

Não reaproveitar:

- suposições de estoque, frete, Mercado Livre, anúncio, vendedor ou compra;
- botões/labels específicos do Mercado Livre;
- campos fixos como `MLB`, `permalink`, `warranty`, `freeShipping` como regra geral;
- heurísticas textuais específicas de produto.

## Comportamento esperado do botão Saber mais

No widget, `Saber mais` não deve simular texto livre do usuário.

Ele deve enviar ação estruturada:

```js
{
  ui: {
    catalogAction: "product_detail",
    catalogProductId,
    listingSessionId
  }
}
```

O backend deve:

- resolver o item exato;
- salvar `context.catalogo.productFocus`;
- preservar `context.catalogo.listingSession`;
- responder com foco no item;
- evitar repetir card quando o usuário só quer explicação;
- anexar card apenas quando fizer sentido visualmente.

## Modo foco

Quando um item de API está em foco, perguntas sobre o item devem usar esse item como fonte principal.

Exemplos que devem permanecer no foco:

- `quais os riscos?`
- `vale a pena?`
- `me explica melhor`
- `e a localização?`
- `tem algum problema?`
- `o que devo conferir?`
- `esse preço faz sentido?`
- `qual o próximo passo?`

Para perguntas factuais, usar handler determinístico quando possível:

- preço;
- endereço;
- cidade;
- status;
- data;
- código;
- link;
- descrição;
- campos presentes em `fields`.

Para perguntas consultivas, usar LLM com contexto completo do item:

- riscos;
- custo-benefício;
- pontos de atenção;
- adequação;
- análise comercial;
- próximos passos.

Regra dura: se a API não trouxe o dado, responder que não consta no retorno da API. Não inventar.

## Saída de foco

O foco deve ser abandonado quando o intent semântico indicar mudança real de escopo.

Exemplos:

- `tem outro parecido?`
- `mostra mais opções`
- `tem casa em Santos?`
- `busca apartamento com garagem`
- `quero outro mais barato`
- `quais outros imóveis tem?`
- `volta para a lista`

Esses casos devem virar:

- `catalog_load_more`;
- `new_catalog_search`;
- `catalog_search_refinement`;
- `similar_items_search`;
- `catalog_alternative_search`;
- `catalog_browse`.

Não resolver saída de foco com lista de frases soltas. A decisão deve vir do `semantic-intent-stage` e do `catalog-intent-handler`.

## Ajustes técnicos sugeridos

### 1. Fortalecer normalização da API

Arquivo principal:

- `backend/lib/chat/api-runtime.js`

Melhorar a criação de itens em:

- `extractApiCatalogProducts`;
- `groupApiFieldListAsCatalogItem`;
- `buildApiCatalogSearchState`;
- `buildApiCatalogAssetsFromProducts`.

Garantir que cada item tenha:

- id estável;
- `source = "api_runtime"`;
- `sourceApiId`;
- `fields`;
- `rawContext` enxuto;
- `facts` quando aplicável.

### 2. Persistir foco corretamente

Arquivos prováveis:

- `backend/lib/chat/service.js`;
- `backend/lib/chat/orchestrator.js`;
- `backend/lib/chat/api-runtime.js`.

Ao receber `catalogAction=product_detail` para item de API:

- definir `conversation.mode = "product_detail"` ou `product_focus`;
- definir `catalogo.productFocus`;
- manter `catalogo.listingSession`;
- definir `catalogo.produtoAtual` para compatibilidade;
- limpar ações temporárias de UI depois do turno.

### 3. Usar decisão de catálogo no fluxo API

Hoje a API tem `semanticApiDecision`, mas precisa respeitar melhor o estado compartilhado de catálogo quando `intentType = "catalog_search"`.

O ideal:

- API de catálogo usa `semanticCatalogDecision` para continuidade;
- API factual usa `semanticApiDecision`;
- orquestrador decide domínio, mas não interpreta linguagem por regex nova.

### 4. Criar resposta consultiva genérica de item

Adicionar um builder para perguntas consultivas sobre item de API.

Entrada:

- mensagem do usuário;
- item em foco;
- `fields`;
- `rawContext`;
- histórico curto;
- tipo consultivo vindo do intent.

Saída:

- texto em português claro;
- sem card repetido por padrão;
- sem inventar dado ausente;
- com próximos passos práticos.

Para imóvel/leilão, a LLM pode citar riscos possíveis apenas como pontos a verificar, por exemplo documentação, ocupação, débitos, matrícula, edital, localização e liquidez, desde que deixe claro quando não constam na API.

### 5. Melhorar assets/botões de API

No widget:

- manter `Saber mais` como ação estruturada;
- para API com link, botão externo deve ser genérico: `Abrir detalhes`;
- para API sem link, `Saber mais` deve focar no item e não tentar abrir URL;
- considerar trocar label por domínio quando houver label configurado: `Analisar`, `Ver detalhes`, `Ver riscos`.

Arquivo:

- `backend/public/chat-widget.js`

### 6. Diagnóstico

Publicar em `metadata` dados suficientes para debugar:

- `catalogDiagnostics.catalogDecision`;
- `apiRuntimeDiagnostics.selectedApiId`;
- `productFocus.productId`;
- `listingSession.id`;
- motivo de saída ou permanência no foco;
- se anexou card ou não.

## Testes mínimos

Criar ou registrar cenários no laboratório:

1. Busca inicial retorna vários itens de API.
2. Clicar `Saber mais` no primeiro item.
3. Perguntar `quais os riscos desse imóvel?`.
4. Perguntar `e a localização?`.
5. Pedir `mostra outro parecido`.
6. Pedir `tem mais opções?`.
7. Fazer nova busca concreta.
8. Confirmar que o item antigo não sequestra a conversa.
9. Confirmar que perguntas sobre o item não disparam nova API.
10. Confirmar que dado ausente é tratado como ausente, não inventado.

Comandos úteis:

```bash
cd backend
npm run test:chat-intelligence
npm run test:chat-intelligence:full
npm run test:chat-laboratory:record
```

## Critério de pronto

A API estará no nível esperado quando:

- `Saber mais` fixa o item corretamente;
- perguntas seguintes usam o item em foco;
- perguntas consultivas recebem análise fluida;
- perguntas factuais usam dados estruturados;
- nova busca sai do foco sem esforço;
- lista e foco coexistem sem conflito;
- o card não é repetido em toda resposta;
- o comportamento não depende do domínio ser imóvel, produto ou Mercado Livre.

## Próximo passo recomendado

Começar por `api-runtime.js` e `service.js`:

1. garantir que item de API carregue `fields` e `rawContext`;
2. persistir `productFocus` em `catalogAction=product_detail`;
3. criar resposta consultiva genérica para item em foco;
4. ligar saída de foco ao `catalog-intent-handler`;
5. só depois ajustar UI/labels do widget.

## Registro de implementação inicial

- Itens de catálogo vindos de API passaram a carregar `fields` normalizados e `rawContext` enxuto.
- O roteamento semântico de catálogo agora também considera contexto recente de `api_runtime`.
- Perguntas consultivas sobre item em foco podem responder sem reenviar card por padrão.
- `productFocus` agora preserva `source`.
- O widget não mostra parcelamento em cards de API runtime.
