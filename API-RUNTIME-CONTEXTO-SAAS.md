# API Runtime - Contexto SaaS de Item Atual

Este padrao existe para evitar que uma integracao criada para um cliente vire hardcode no produto.

A Nexo e um caso real usando este contrato, mas o comportamento deve ser tratado como recurso SaaS reutilizavel por qualquer projeto/agente.

## Ideia central

Um mesmo agente pode ter APIs diferentes para momentos diferentes da conversa:

- busca aberta: o cliente ainda esta procurando itens
- item atual: o cliente esta em uma pagina de detalhe e pergunta sobre aquele item

O runtime decide qual API fica disponivel pelo contexto do chat e por `apis.configuracoes.runtime`.

## Busca aberta

Use quando o cliente esta procurando itens por termo.

Configuracao esperada:

```json
{
  "runtime": {
    "intentType": "catalog_search",
    "availabilityScope": "open_search",
    "requiredFields": [
      { "name": "titulo", "param": "titulo", "source": "titulo" }
    ],
    "presentation": "list",
    "responseShape": "list"
  }
}
```

Exemplo de URL:

```text
/api/imoveis/busca?titulo={titulo}
```

## Item atual

Use quando o cliente esta em uma pagina de detalhe e pergunta sobre aquele registro.

Configuracao esperada:

```json
{
  "runtime": {
    "intentType": "lookup_by_identifier",
    "availabilityScope": "context_item",
    "requiredFields": [
      { "name": "id", "param": "id", "source": "propertyId" }
    ],
    "presentation": "text",
    "responseShape": "single_item"
  }
}
```

Exemplo de URL:

```text
/api/imoveis/{id}
```

## Contexto esperado

O widget pode receber contexto explicitamente no embed:

```html
<script
  src="https://www.infrastudio.pro/chat-widget.js"
  data-widget="meu-widget"
  data-context='{"propertyId":"uuid-do-item","resource":{"id":"uuid-do-item","type":"imovel"}}'>
</script>
```

Campos reconhecidos pelo runtime:

- `id`
- `propertyId`
- `resource.id`
- `imovel.id`
- `property.id`
- `catalogo.produtoAtual.id`

## Inferencia automatica do widget

Para sites imobiliarios que seguem a rota:

```text
/imoveis/{uuid}
```

o `chat-widget.js` pode inferir automaticamente:

```json
{
  "id": "uuid-do-imovel",
  "propertyId": "uuid-do-imovel",
  "resource": { "id": "uuid-do-imovel", "type": "imovel" },
  "imovel": { "id": "uuid-do-imovel" },
  "ui": {
    "chatSessionScope": "navigation",
    "pageKind": "property_detail",
    "productDetailPreferred": true
  }
}
```

Se outro segmento usar uma rota diferente, o site cliente deve passar `data-context` explicitamente ou o produto deve ganhar uma convencao generica nova, sem hardcode de cliente.

## Regras de manutencao

- Nao criar branch especial para cliente dentro do orquestrador.
- Nao decidir por nome do cliente, dominio ou slug do projeto.
- Separar sempre `open_search` e `context_item`.
- Guardar URL, campos, apresentacao e paths em `apis.configuracoes.runtime`.
- Se uma API de item atual retornar objeto grande, preferir `runtime.fields`/`runtimeItems` antes de exibir JSON bruto.
- Documentar novas convencoes aqui antes de reaproveitar em outro cliente.
