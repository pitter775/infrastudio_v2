# Plano API Runtime Multi-Intent Para Lancamento

## Objetivo

Reduzir risco de conflito quando um mesmo agente tiver varias APIs com funcoes diferentes:

- cadastro ou envio de dados
- consulta por identificador
- busca informativa
- busca de catalogo/produtos

O alvo e fazer o runtime escolher a API correta por contrato estruturado, falhar fechado quando houver ambiguidade e impedir execucao acidental de APIs com efeito colateral.

## Contexto atual

Hoje o runtime ja tem bases importantes:

- `loadAgentRuntimeApis` carrega APIs vinculadas ao agente.
- `shouldExecuteRuntimeApi` executa `GET` automaticamente e so executa outros metodos se `configuracoes.runtime.autoExecute === true`.
- `buildFocusedApiContext` seleciona campos relevantes.
- `classifySemanticApiIntentStage` e `buildApiDecisionFromSemanticIntent` ajudam na decisao semantica.
- `resolveApiCatalogReply` reaproveita comportamento de catalogo quando a API retorna produtos.
- `runtime.responsePath`, `runtime.previewPath`, `runtime.fields[]`, `http.headers`, `http.body` ja existem.

Risco atual:

- APIs diferentes podem disputar a mesma mensagem por nome de campo parecido.
- Cadastro/POST pode ficar perigoso se `autoExecute` for usado sem contrato.
- Catalogo API, consulta factual e busca informativa ainda nao tem tipo de intencao obrigatorio.
- Quando ha ambiguidade entre APIs, o runtime ainda pode tentar responder por melhor match de campo.

## Status de execucao

Feito nesta rodada:

- `runtime.intentType` normalizado no runtime de chat.
- `create_record` excluido de consulta factual e bloqueado contra execucao automatica.
- `requiredFields` passou a bloquear execucao automatica quando faltar dado.
- catalogo API ficou separado de consulta factual: `catalog_search` entra como catalogo, `lookup_by_identifier` nao.
- ambiguidade factual entre APIs fortes passou a falhar fechada sem escolher campo por chute.
- stage semantico de API passou a carregar `apiId` e `intentType`.
- testes smoke cobrem cadastro ignorado em consulta, ambiguidade e catalogo separado.
- painel de API ganhou aba Runtime com `intentType`, `descriptionForIntent`, autoexecução, confirmação e alertas de configuração.
- painel de API ganhou presets rápidos para Cadastro, Consulta por código, Busca informativa e Catálogo.
- painel de API passou a salvar `runtime.responsePath`, `runtime.previewPath` e `runtime.fields` a partir dos campos configurados.
- laboratório/trace do chat passou a mostrar `intentType`, API selecionada e diagnóstico compacto de API runtime.
- runtime agora pede campos obrigatórios antes de consulta por identificador.
- intent semântico de API agora reconhece `api_create_record`.
- cadastro (`create_record`) responde coletando dados obrigatórios e avisando que vai confirmar antes de registrar.
- diagnóstico de API runtime agora inclui campos obrigatórios, campos faltantes, motivos de bloqueio e conflito compacto entre APIs.
- runtime aceita execução de `create_record` somente com confirmação estruturada em contexto (`apiRuntime.confirmedApiId`, `confirmedIntentType`, `confirmedAt`) e campos obrigatórios resolvidos.
- widget passa a expor ação estruturada `Confirmar cadastro` quando o runtime está aguardando confirmação de uma API `create_record`.

- confirmacao/cancelamento por texto livre agora passa por classificacao semantica dedicada antes da execucao, sem depender de lista de frases.

Ainda pendente:

- responder de forma mais especifica quando o usuario cancela um cadastro pendente.

## Regras de arquitetura

- Nao resolver por lista de frases especificas do usuario.
- Usar contrato estruturado em `configuracoes.runtime`.
- API com efeito colateral deve falhar fechada ate ter dados obrigatorios e confirmacao.
- Catalogo API pode ser proativo quando houver contexto e termo concreto.
- Consulta por identificador precisa de identificador antes de executar.
- Busca informativa nao deve virar cadastro.

## P0 - Antes do lancamento

### 1. Adicionar `runtime.intentType`

Campo em `apis.configuracoes.runtime.intentType`.

Valores iniciais:

- `create_record`
- `lookup_by_identifier`
- `knowledge_search`
- `catalog_search`
- `generic_fact`

Fallback temporario:

- Se ausente, tratar como `generic_fact`.
- Mostrar alerta no admin/laboratorio quando ausente.

### 2. Travar execucao de APIs com efeito colateral

Regra:

- `GET` pode continuar autoexecutando.
- `POST`, `PUT`, `PATCH`, `DELETE` so executam automaticamente se:
  - `runtime.intentType === "create_record"` ou outro tipo explicitamente permitido
  - `runtime.autoExecute === true`
  - todos os `runtime.requiredFields` estiverem resolvidos
  - `runtime.requiresConfirmation !== true` ou ja houver confirmacao estruturada

Para lancamento, recomendacao conservadora:

- `create_record` nunca executa direto no primeiro turno.
- Primeiro turno coleta/confere dados.
- Segundo turno confirmado executa.

### 3. Adicionar `runtime.requiredFields`

Formato sugerido:

```json
{
  "runtime": {
    "intentType": "lookup_by_identifier",
    "requiredFields": [
      {
        "name": "codigo",
        "source": "message",
        "param": "codigo",
        "description": "Codigo do pedido"
      }
    ]
  }
}
```

Uso:

- `lookup_by_identifier`: se faltar campo, perguntar pelo identificador.
- `create_record`: se faltar campo, perguntar o proximo dado necessario.
- `catalog_search`: termo de busca pode vir da mensagem; nao exigir identificador.

### 4. Falhar fechado em ambiguidade entre APIs

Se duas ou mais APIs forem candidatas fortes e nao houver `preferredApiId` confiavel:

- nao chamar nenhuma API
- responder pedindo escolha objetiva

Exemplo:

> Posso consultar por pedido, buscar produtos no catalogo ou registrar um cadastro. Qual desses caminhos voce quer seguir?

### 5. Separar catalogo API de consulta factual

`catalog_search`:

- pode retornar lista/cards quando houver termo concreto.
- usa campos como `nome`, `titulo`, `produto`, `preco`, `estoque`, `imagem`, `link`, `categoria`.

`lookup_by_identifier`:

- exige codigo/id/documento.
- nao deve responder lista ampla.

`generic_fact`:

- responde apenas fatos presentes em campos carregados.

## P1 - Alta prioridade

### 6. Adicionar `runtime.descriptionForIntent`

Descricao curta usada pelo classificador:

```json
{
  "runtime": {
    "intentType": "catalog_search",
    "descriptionForIntent": "Busca produtos por termo, categoria, cor, material ou disponibilidade."
  }
}
```

### 7. Expor diagnostico no laboratorio

Mostrar por turno:

- API escolhida
- `intentType`
- motivo da escolha
- campos obrigatorios faltantes
- conflito entre APIs
- se executou ou falhou fechado

### 8. Limite de APIs por agente

Hoje `loadAgentRuntimeApis` usa `limit = 4`.

Decidir:

- manter limite e mostrar isso na UI
- ou aumentar com criterio e cache

Para lancamento, se manter 4, o admin precisa avisar quais APIs entram no runtime.

## P2 - Media prioridade

### 9. Validador de configuracao no painel

Alertas:

- sem `runtime.intentType`
- sem `runtime.fields`
- sem `runtime.responsePath` quando payload for grande
- `POST` com `autoExecute` e sem `requiredFields`
- `create_record` sem `requiresConfirmation`
- `catalog_search` sem campos de nome/preco/estoque/link/imagem quando aplicavel

### 10. Templates de API

Criar presets:

- Cadastro
- Consulta por codigo
- Busca informativa
- Catalogo

## P3 - Pos-lancamento

### 11. Classificador semantico multi-API

Saida JSON ideal:

```json
{
  "intentType": "catalog_search",
  "apiId": "uuid",
  "confidence": 0.91,
  "missingFields": [],
  "shouldExecute": true,
  "requiresConfirmation": false
}
```

### 12. Testes de matriz multi-API

Criar fixture com 4 APIs no mesmo agente:

- cadastro lead
- consulta pedido por codigo
- busca FAQ/base informativa
- catalogo de produtos

Casos obrigatorios:

- mensagem de catalogo gera lista
- codigo consulta pedido
- pedido de cadastro nao executa sem confirmacao
- pergunta informativa nao chama cadastro
- ambiguidade pede escolha

## Ordem de ataque recomendada

1. Implementar `runtime.intentType` com fallback.
2. Implementar guardrail de execucao por metodo + `requiredFields`.
3. Implementar ambiguidade fail-closed.
4. Separar comportamento `catalog_search` vs `lookup_by_identifier`.
5. Criar testes multi-API.
6. Expor diagnostico minimo no laboratorio.
7. Ajustar UI/admin para alertas.

## Arquivos provaveis

- `backend/lib/apis.js`
- `backend/lib/chat/api-runtime.js`
- `backend/lib/chat/orchestrator.js`
- `backend/lib/chat/semantic-intent-stage.js`
- `backend/lib/chat/domain-router.js`
- `backend/tests/chat-intelligence.smoke.ts`
- `backend/tests/chat-intelligence.domain-regression.ts`
- componentes admin de API em `backend/components/admin/projects/`

## Gate de validacao

Rodar:

```bash
cd backend
npm run test:chat-intelligence
npm run build
```

Se tocar UI/admin, validar tambem no navegador.
