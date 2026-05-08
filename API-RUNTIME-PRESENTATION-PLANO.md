# API Runtime Presentation - Plano de estabilização

Documento de continuidade para o Codex evoluir o runtime de APIs do chat com menos instabilidade entre teste manual, Chat Widget, catálogo, resposta textual e cards.

## Objetivo

Separar quatro responsabilidades que hoje ainda se misturam:

1. Intenção da API: quando e por que usar a API.
2. Execução da API: quais parâmetros/contextos preencher para chamar a URL.
3. Extração da resposta: quais dados retornados viram campos estruturados.
4. Apresentação: como renderizar a resposta no canal (`text`, `card`, `list`, `table`, `summary`).

O ponto central: `catalog_search` não deve ser o único caminho capaz de gerar card. Catálogo é uma intenção/listagem, enquanto card é uma apresentação.

## Estado recente

Já foi corrigido:

- `parameterValues` semânticos contam como fonte válida para `requiredFields`.
- API fora de `catalog_search` também consegue responder sobre `campos`/`preview` retornados.
- Quando o stage semântico escolhe `api_catalog_search`, mas não extrai parâmetro, o orquestrador completa o parâmetro em caso controlado:
  - uma única API `catalog_search`
  - um único parâmetro ausente
  - mensagem com sinal catalogal mínimo
- `catalog_search` continua gerando card/listagem quando há dados mínimos.
- Etapa 1 iniciada: normalizadores de `presentation` e `responseShape` existem em `backend/lib/apis.js`.
- Etapa 2 iniciada: `fetchApiPreview` agora pode publicar `runtimeItems` genérico sem remover `catalogItems`.
- Etapa 3 iniciada: `presentation: "card"` ou `"list"` permite montar asset/card de API runtime mesmo fora de `catalog_search`.
- Etapa 6 iniciada: editor de API já salva `presentation`, `responseShape` e `display` básico para título, subtítulo, descrição, preço, imagem, galeria, link e status.
- Etapa 4 iniciada: resposta textual genérica já respeita `presentation: "table"`, `"list"` e `"summary"` em fallback determinístico.
- Etapa 7 iniciada: diagnóstico de API runtime já expõe apresentação, formato, contagem de campos e contagem de itens no trace/widget.

## Modelo alvo

Adicionar contratos independentes dentro de `apis.configuracoes.runtime`.

### `intentType`

Decide a intenção operacional:

- `create_record`
- `lookup_by_identifier`
- `knowledge_search`
- `catalog_search`
- `generic_fact`

### `presentation`

Novo campo para decidir renderização:

- `text`: resposta textual com campos principais.
- `card`: um registro principal em card.
- `list`: vários itens/cards ou lista curta.
- `table`: linhas/colunas para dados tabulares.
- `summary`: resumo textual do retorno bruto/estruturado.
- `auto`: runtime escolhe pelo formato da resposta e campos disponíveis.

Exemplo:

```json
{
  "runtime": {
    "intentType": "lookup_by_identifier",
    "presentation": "card"
  }
}
```

### `responseShape`

Novo campo para declarar o formato da resposta:

- `single_item`: um objeto principal.
- `list`: array de objetos.
- `table`: array de objetos com colunas comparáveis.
- `raw`: texto/JSON sem estrutura confiável.
- `auto`: detectar com fallback seguro.

### `display`

Novo bloco para mapear campos visuais:

```json
{
  "runtime": {
    "presentation": "card",
    "responseShape": "single_item",
    "display": {
      "titlePath": "titulo",
      "subtitlePath": "cidade",
      "descriptionPath": "descricao",
      "pricePath": "valor_publico",
      "imagePath": "imagem",
      "imagesPath": "imagens",
      "linkPath": "url",
      "statusPath": "status"
    }
  }
}
```

Aceitar aliases comuns automaticamente:

- título: `titulo`, `title`, `nome`, `name`, `label`
- descrição: `descricao`, `description`, `resumo`, `summary`
- preço: `preco`, `price`, `valor`, `valor_publico`, `valor_minimo`, `valor_avaliacao`
- imagem: `imagem`, `image`, `foto`, `thumbnail`, `picture`
- imagens: `imagens`, `images`, `fotos`, `pictures`, `galeria`
- link: `url`, `link`, `permalink`, `href`
- localização: `cidade`, `estado`, `endereco`, `address`

## Regras de comportamento alvo

Quando a API foi escolhida e executada com sucesso:

- não responder pedindo campo que já veio em `parameterValues`
- não cair em fallback genérico se há `campos`, `runtimeItems`, `catalogItems` ou `preview` útil
- se não houver card, responder em texto simples
- se a resposta for lista e `presentation` não estiver claro, usar texto/lista simples em vez de inventar card ruim

Gerar card quando:

- `runtime.presentation === "card"`
- ou `runtime.presentation === "auto"` e houver título/nome + pelo menos um dado útil
- ou `intentType === "catalog_search"` e houver item normalizado

Não gerar card quando:

- API retornou erro
- resposta está vazia
- não existe título/nome/identidade mínima do item
- `presentation === "text"` ou `presentation === "summary"`

## Etapas de implementação

### Etapa 1 - Tipos e normalizadores

Criar funções utilitárias em `backend/lib/apis.js` ou helper local:

- `normalizeRuntimePresentation(value)`
- `normalizeRuntimeResponseShape(value)`
- `getRuntimePresentation(api)`
- `getRuntimeResponseShape(api)`
- `getRuntimeDisplayConfig(api)`

Defaults conservadores:

- `presentation`: `auto`
- `responseShape`: `auto`

### Etapa 2 - Extrator genérico de resposta

Hoje `extractConfiguredRuntimeFields` só faz autoextração ampla para `catalog_search`.

Criar extrator comum:

- `extractRuntimeResponseItems(api, payload)`
- `extractRuntimeScalarFields(api, payload)`
- `normalizeRuntimeItemFields(item, configuredFields)`

Regras:

- usar `responsePath` primeiro
- se `responseShape === "list"`, procurar array no root ou caminhos comuns
- se `responseShape === "single_item"`, tratar objeto principal
- se `responseShape === "auto"`, detectar:
  - array de objetos -> `list`
  - objeto -> `single_item`
  - texto -> `raw`/`summary`

Isso deve alimentar:

- `campos`
- novo `runtimeItems`
- `catalogItems` por compatibilidade quando `intentType === "catalog_search"`
- `preview`

### Etapa 3 - Assets/cards genéricos

Criar camada genérica:

- `extractApiRuntimeDisplayItems(apis, customDeps)`
- `buildApiRuntimeAssets(apis, customDeps)`
- `buildApiRuntimeAssetFromDisplayItem(item)`

`catalog_search` pode continuar chamando a camada antiga no primeiro corte, mas o alvo é migrar para a camada genérica.

Card genérico deve preencher:

- `id`
- `kind: "product"` ou futuro `kind: "record"`
- `provider: "api_runtime"`
- `nome`
- `descricao`
- `priceValue`/`priceLabel` quando houver
- `publicUrl`/`images` quando houver
- `targetUrl` quando houver
- `metadata.apiId`
- `metadata.source = "api_runtime"`

Se o widget só entende `kind: "product"`, manter `product` por compatibilidade até criar `record`.

### Etapa 4 - Reply determinístico por presentation

Criar resolver antes do fallback textual:

- `resolveApiRuntimePresentationReply(message, context, apis, customDeps)`

Comportamento:

- `card`: bolha curta + asset
- `list`: bolha curta + assets/lista
- `table`: texto tabular compacto se UI não suportar tabela
- `text`: campos formatados
- `summary`: preview/resumo

Evitar LLM para decidir fatos. LLM pode reescrever depois, mas os dados devem vir do retorno estruturado.

### Etapa 5 - Parâmetros e `requiredFields`

Unificar validação de entrada:

- URL params ausentes
- `requiredFields`
- `parameterValues`
- contexto (`context`, `context.apiRuntime.parameterValues`)
- `runtime.parametros`/`config.parametros`

Criar uma função única:

- `resolveRuntimeApiInputs(api, context, semanticDecision)`

Saída:

```json
{
  "values": { "titulo": "EDIFICIO VILLA" },
  "missing": ["titulo"],
  "sources": { "titulo": "semantic_parameter" }
}
```

Usar isso em:

- execução da API
- diagnóstico
- mensagem de campo faltante
- confirmação de `create_record`

### Etapa 6 - Editor de API

Adicionar no editor:

- seletor `Apresentação`: Auto, Texto, Card, Lista, Tabela, Resumo
- seletor `Formato da resposta`: Auto, Item único, Lista, Tabela, Bruto
- mapeamento visual opcional: título, subtítulo, descrição, preço/valor, imagem, link, status

Adicionar avisos:

- API com URL `{titulo}` sem parâmetro/contextPath claro
- API com `presentation: card` sem título/nome detectável
- API com `presentation: list` sem array detectável no teste
- API retorna imagem/preço/link mas está como `text`; sugerir card
- API retorna array mas está como `text`; sugerir `list`/`table`

### Etapa 7 - Diagnóstico

Expandir `apiRuntimeDiagnostics`:

```json
{
  "selectedApiId": "...",
  "intentType": "lookup_by_identifier",
  "presentation": "card",
  "responseShape": "single_item",
  "parameterValues": { "titulo": "EDIFICIO VILLA" },
  "missingParams": [],
  "requiredFields": ["titulo"],
  "missingRequiredFields": [],
  "fieldCount": 6,
  "runtimeItemCount": 1,
  "assetCount": 1,
  "replyMode": "card"
}
```

O tooltip do badge `API` deve mostrar API selecionada, parâmetros usados, URL executada, status, campos retornados, apresentação escolhida e motivo de fallback se não gerou card.

### Etapa 8 - Testes obrigatórios

Adicionar smoke tests para:

1. `catalog_search + presentation auto`: retorna lista e gera assets/cards.
2. `lookup_by_identifier + presentation card`: retorna objeto único e gera card.
3. `generic_fact + presentation text`: retorna campos e responde texto sem card.
4. `generic_fact + presentation summary`: retorna preview bruto e responde resumo/preview sem pedir campo ausente.
5. `responseShape list + presentation table`: retorna array e responde tabela textual compacta se UI não suportar tabela.
6. API com `requiredFields` preenchido por `parameterValues`: não pede campo novamente.
7. Stage semântico escolhe API mas não extrai parâmetro: fallback controlado preenche parâmetro quando seguro.
8. API retorna dados, mas sem título mínimo para card: cai para texto simples.

## Riscos e cuidados

- Não transformar `presentation: auto` em chute agressivo.
- Não gerar card ruim sem identidade mínima.
- Não deixar `lookup_by_identifier` virar catálogo/listagem sem contexto.
- Não reabrir `create_record` executando sem confirmação.
- Não resolver variação linguística com lista grande de frases.
- Não quebrar assets atuais do Mercado Livre.
- Não quebrar compatibilidade do widget com `provider: "api_runtime"`.

## Critério de pronto

- API que funciona no teste manual também tem caminho previsível no chat.
- `catalog_search` continua gerando cards/listas.
- `lookup_by_identifier` consegue gerar card quando configurado para isso.
- APIs fora de catálogo sempre usam dados retornados quando a API foi executada com sucesso.
- Diagnóstico explica por que a API respondeu texto, card, lista, tabela ou resumo.
- Editor mostra avisos antes de salvar configuração instável.
- Smoke tests cobrem a matriz de intenção x apresentação.

## Próximo passo recomendado

Começar pela Etapa 1 e Etapa 2:

1. Adicionar avisos inteligentes no editor quando `presentation: card` não tiver título/nome detectável ou quando a resposta parecer lista.
2. Completar `resolveApiRuntimePresentationReply` como contrato único, retornando também `replyMode` e `assets`.
3. Consolidar o caminho antigo de `catalogItems` em cima de `runtimeItems`, mantendo compatibilidade.
4. Validar visualmente o badge `API` no Chat Widget real do admin.
