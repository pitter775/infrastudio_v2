# Aba APIs - comportamento do legado

Objetivo deste arquivo: servir como especificacao de comportamento para o Codex replicar a aba no `infrastudio_v2`, mantendo o funcionamento do legado, mas usando os padroes, rotas, componentes, auth e estrutura atuais do v2. Nao importar nada de `C:\Projetos\infrastudio`.

Fonte analisada no legado:

- `C:\Projetos\infrastudio\app\admin\projetos\[id]\page.tsx`
- `C:\Projetos\infrastudio\app\admin\projetos\[id]\_components\project-apis-section.tsx`
- `C:\Projetos\infrastudio\app\api\projetos\[id]\apis\route.ts`
- `C:\Projetos\infrastudio\app\api\apis\[id]\route.ts`
- `C:\Projetos\infrastudio\app\api\apis\[id]\testar\route.ts`
- `C:\Projetos\infrastudio\lib\apis.ts`

## Entrada na aba

Ao abrir o projeto, a pagina carrega:

```json
{
  "endpoint": "GET /api/admin/projetos/[id]",
  "retorno_usado": {
    "apis": "lista de APIs do projeto",
    "stats.totalApis": "contador da aba"
  }
}
```

A aba fica bloqueada se nao houver agente. A lista vem ordenada por `created_at` ascendente.

## Lista exibida

Cada API mostra:

```json
{
  "nome": "api.nome",
  "metodo": "GET",
  "status": "ativa | inativa",
  "url": "api.url",
  "descricao": "api.descricao ou Sem descricao",
  "campos": "quantidade de api.campos",
  "parametros": "quantidade de api.parametros",
  "resumo": "ate 6 nomes de campos, depois +N",
  "parametros_obrigatorios": "mostra com *",
  "aviso_contexto": "se houver obrigatorios, diz que o chat precisa enviar esses nomes",
  "acoes": ["Editar", "Excluir"]
}
```

Se nao houver API, mostra estado vazio.

## Criar API

Botao: `Nova API`.

Abre `ApiModal`.

Campos:

```json
{
  "nome": "obrigatorio",
  "url": "obrigatorio",
  "metodo": "GET fixo/readOnly",
  "descricao": "opcional",
  "ativo": true,
  "campos": [],
  "parametros": []
}
```

O legado so aceita metodo `GET`.

Salva em:

```json
{
  "endpoint": "POST /api/projetos/[id]/apis",
  "body": {
    "nome": "string",
    "url": "string",
    "metodo": "GET",
    "descricao": "string",
    "ativo": "boolean",
    "parametros": [
      {
        "nome": "string",
        "tipo": "string|number|boolean",
        "obrigatorio": "boolean"
      }
    ],
    "campos": [
      {
        "nome": "path do campo",
        "tipo": "string|number|boolean",
        "descricao": "string|null"
      }
    ]
  }
}
```

Validacoes:

```json
{
  "acesso": "admin e pode gerenciar projeto",
  "nome_url": "obrigatorios",
  "metodo": "se enviado, precisa ser GET",
  "demo": "bloqueia escrita"
}
```

No banco:

```json
{
  "apis": {
    "projeto_id": "id",
    "nome": "trim",
    "url": "trim",
    "metodo": "GET",
    "descricao": "trim ou null",
    "ativo": true,
    "configuracoes": {
      "parametros": "parametros sanitizados + parametros inferidos da URL"
    }
  },
  "api_campos": "substitui pelos campos enviados"
}
```

## Parametros por URL

O legado detecta parametros com chaves na URL:

```json
{
  "exemplo": "https://api.exemplo.com/imoveis/{id}",
  "regex": "\\{([a-zA-Z0-9_.-]+)\\}",
  "efeito": "cria parametro obrigatorio com tipo string se ainda nao existir"
}
```

No modal, parametros detectados aparecem em `Valores de teste`. Esses valores servem so para testar e detectar campos.

## Testar API

Botao: `Testar`.

Antes de testar, o legado salva a API atual:

```json
{
  "novo": "POST /api/projetos/[id]/apis",
  "edicao": "PUT /api/apis/[apiId]"
}
```

Depois chama:

```json
{
  "endpoint": "POST /api/apis/[apiId]/testar",
  "body": {
    "context": {
      "parametro": "valor de teste preenchido"
    }
  }
}
```

Runtime do teste:

```json
{
  "passo_1": "carrega API por id",
  "passo_2": "monta URL substituindo parametros obrigatorios",
  "passo_3": "fetch GET com Accept: application/json, cache no-store, timeout 15s",
  "passo_4": "response precisa ser ok e JSON",
  "passo_5": "extrai campos primitivos do JSON",
  "passo_6": "substitui api_campos pelos campos detectados"
}
```

Regras para montar URL:

```json
{
  "placeholder": "se URL tiver {id}, substitui por encodeURIComponent(context.id)",
  "um_parametro_sem_placeholder": "se so houver um parametro e a URL nao tiver ? ou #, adiciona como segmento final /valor",
  "varios_parametros_sem_placeholder": "adiciona como query string",
  "ausente": "erro Parametros obrigatorios ausentes: nome"
}
```

Extracao de campos:

```json
{
  "tipos_aceitos": ["string", "number", "boolean"],
  "null": "vira string",
  "objetos": "percorre recursivamente",
  "arrays": "usa o primeiro item nao nulo como amostra",
  "profundidade_maxima": 6,
  "path": "campos aninhados usam ponto, ex: endereco.bairro",
  "duplicados": "remove por nome case-insensitive"
}
```

Se nenhum campo primitivo for encontrado, retorna erro.

Depois do teste, o modal atualiza:

```json
{
  "detectedApiCampos": "campos detectados + parametros",
  "apiForm": "api retornada ja com campos salvos",
  "estado_local": "upsert da API em data.apis",
  "feedback": "API testada e campos detectados com sucesso."
}
```

## Selecionar campos e parametros

O modal mostra uma arvore de campos detectados.

Comportamentos:

```json
{
  "toggleCampo": "marca/desmarca campo como campo ativo da API",
  "toggleParametro": "marca/desmarca campo como parametro",
  "toggleObrigatorio": "alterna obrigatorio do parametro",
  "parametro_inferido_da_url": "sempre tratado como obrigatorio pela URL"
}
```

Campos ativos sao os unicos que entram no resumo da API para o agente.

## Editar API

Botao: `Editar`.

Carrega no modal:

```json
{
  "id": "api.id",
  "nome": "api.nome",
  "url": "api.url",
  "metodo": "GET",
  "descricao": "api.descricao",
  "ativo": "api.ativo",
  "campos": "api.campos",
  "parametros": "api.parametros"
}
```

Salva em:

```json
{
  "endpoint": "PUT /api/apis/[id]",
  "validacoes": ["API existe", "usuario gerencia o projeto da API", "nome e URL obrigatorios", "metodo GET", "demo bloqueia"]
}
```

Se existem valores de teste suficientes para os parametros obrigatorios, depois de salvar o legado roda teste automaticamente para sincronizar campos reais.

## Excluir API

Botao: `Excluir`.

Chama:

```json
{
  "endpoint": "DELETE /api/apis/[id]",
  "efeitos": [
    "remove vinculos em agente_api",
    "remove api_campos",
    "remove apis"
  ]
}
```

## Uso da API no chat

Quando o agente usa APIs, o legado chama `buildAgenteApiRuntimeContext`.

Fluxo:

```json
{
  "passo_1": "busca ids em agente_api",
  "passo_2": "carrega APIs ativas",
  "passo_3": "monta URL com contexto do chat",
  "passo_4": "faz GET",
  "passo_5": "pega somente campos ativos",
  "passo_6": "gera resumo textual limitado a 3500 caracteres"
}
```

Formato runtime:

```json
{
  "apiId": "id",
  "nome": "nome",
  "url": "url resolvida",
  "descricao": "descricao",
  "campos": [
    {
      "nome": "campo.path",
      "tipo": "string|number|boolean",
      "valor": "valor compacto"
    }
  ],
  "resumo": "API: nome\\nDescricao: ...\\n- campo: valor",
  "erro": "null ou mensagem",
  "parametros": "parametros configurados"
}
```

Valores string sao compactados, espacos normalizados e truncados em 280 caracteres.

## Regra importante para replicar no v2

A aba APIs nao e apenas cadastro. O teste persiste a API antes, detecta campos reais, grava `api_campos` e esses campos viram o contrato que o agente usa no runtime.
