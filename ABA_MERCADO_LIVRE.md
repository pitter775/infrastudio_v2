# Aba Mercado Livre - comportamento do legado

Objetivo deste arquivo: servir como especificacao de comportamento para o Codex replicar a aba no `infrastudio_v2`, mantendo o funcionamento do legado, mas usando os padroes, rotas, componentes, auth e estrutura atuais do v2. Nao importar nada de `C:\Projetos\infrastudio`.

Fonte analisada no legado:

- `C:\Projetos\infrastudio\app\admin\projetos\[id]\page.tsx`
- `C:\Projetos\infrastudio\app\admin\projetos\[id]\_components\project-mercado-section.tsx`
- `C:\Projetos\infrastudio\app\api\admin\conectores\route.ts`
- `C:\Projetos\infrastudio\app\api\admin\conectores\mercado-livre\resolve\route.ts`
- `C:\Projetos\infrastudio\app\api\admin\conectores\[id]\mercado-livre\connect\route.ts`
- `C:\Projetos\infrastudio\app\api\admin\conectores\mercado-livre\callback\route.ts`
- `C:\Projetos\infrastudio\lib\conectores.ts`

## Entrada na aba

Ao entrar no projeto, a pagina carrega conectores em:

```json
{
  "endpoint": "GET /api/admin/projetos/[id]",
  "retorno_usado": {
    "conectores": "lista de conectores do projeto",
    "agentes": "lista para resolver agente ativo",
    "stats.totalConectores": "contador da aba"
  }
}
```

A aba fica bloqueada se nao houver agente. O legado permite apenas um conector Mercado Livre por projeto.

## Lista exibida

Cada conector aparece como uma loja/conexao:

```json
{
  "nome": "connector.nome",
  "tipo": "mercado_livre",
  "status": "ativo | inativo",
  "sellerId": "configuracoes.seller_id ou nao informado",
  "nickname": "configuracoes.nickname ou nao informado",
  "conta": "conectada se refresh_token; token manual se access_token; nao conectada caso contrario",
  "endpointBase": "https://api.mercadolibre.com por padrao",
  "acoes": ["Conectar Mercado Livre", "Editar", "Remover completamente"]
}
```

Se ja existe conector, o botao de criar some. Se nao existe, aparece `Conexao`.

## Criar conexao

Botao: `Conexao`.

Abre modal `ConnectorModal` em 2 etapas.

### Etapa 1: produto da loja

Campo:

```json
{
  "productUrl": "URL de um produto real do Mercado Livre"
}
```

Ao clicar `Avancar`, chama:

```json
{
  "endpoint": "POST /api/admin/conectores/mercado-livre/resolve",
  "body": {
    "projetoId": "id da rota",
    "url": "productUrl"
  }
}
```

Validacoes da resolve:

```json
{
  "acesso": "admin e pode gerenciar projeto",
  "url": "obrigatoria, http/https, host mercadolivre/mercadolibre",
  "produto": "de preferencia URL com MLB no path ou hash"
}
```

Como resolve identifica a loja:

```json
{
  "fetch": "GET no HTML do produto com user-agent de navegador",
  "tentativas": "ate 3 por URL candidata",
  "espera_extra": "5s se o primeiro HTML nao trouxer seller",
  "seller_patterns": ["seller_id", "sellerId", "seller.id", "user_id"],
  "nickname_patterns": ["seller_permalink", "nickname", "sellerName"]
}
```

Retorno esperado:

```json
{
  "ok": true,
  "sellerId": "id numerico",
  "nickname": "string|null",
  "productUrl": "url normalizada"
}
```

Se funcionar, o modal vai para a etapa 2 e preenche:

```json
{
  "sellerId": "payload.sellerId",
  "nickname": "payload.nickname",
  "nome": "nickname se nome ainda estiver vazio",
  "productUrl": "payload.productUrl"
}
```

### Etapa 2: dados da aplicacao

Campos:

```json
{
  "nome": "nome da conexao",
  "appId": "APP ID do Mercado Livre",
  "clientSecret": "CLIENT SECRET",
  "sellerId": "preenchido pela etapa 1",
  "nickname": "preenchido pela etapa 1",
  "endpointBase": "https://api.mercadolibre.com",
  "accessToken": "manual/opcional",
  "ativo": true
}
```

Ao salvar:

```json
{
  "endpoint": "POST /api/admin/conectores",
  "body": {
    "nome": "form.nome",
    "tipo": "mercado_livre",
    "projetoId": "id da rota",
    "agenteId": "agente ativo ou primeiro agente",
    "endpointBase": "form.endpointBase",
    "configuracoes": {
      "app_id": "form.appId",
      "client_secret": "form.clientSecret",
      "seller_id": "form.sellerId",
      "nickname": "form.nickname",
      "access_token": "form.accessToken"
    },
    "ativo": "form.ativo"
  }
}
```

Validacoes:

```json
{
  "sellerId": "obrigatorio antes de salvar",
  "agente": "obrigatorio e precisa pertencer ao projeto",
  "projeto": "usuario precisa gerenciar",
  "tipo": "somente mercado_livre",
  "unicidade": "um mercado_livre por projeto",
  "demo": "bloqueia escrita"
}
```

Depois de criar, o modal nao fecha imediatamente. Ele fica com o conector criado no formulario e mostra mensagem mandando usar o botao da conexao criada para autorizar a loja.

## Conectar Mercado Livre por OAuth

Botao no card: `Conectar Mercado Livre`.

Abre:

```json
{
  "endpoint": "GET /api/admin/conectores/[id]/mercado-livre/connect",
  "efeito": "redireciona para URL de autorizacao do Mercado Livre"
}
```

A rota valida admin, conector existente e acesso ao projeto. Depois chama `buildMercadoLivreAuthorizationUrl`.

Callback:

```json
{
  "endpoint": "GET /api/admin/conectores/mercado-livre/callback",
  "sucesso": "redireciona para /admin/projetos/[projetoId]?mercado_livre_oauth=success",
  "erro": "redireciona para /admin/projetos?mercado_livre_oauth_error=mensagem"
}
```

No sucesso, o callback completa OAuth e atualiza configuracoes do conector com tokens, user/seller e expiracao.

## Editar conexao

Botao: `Editar`.

Abre direto na etapa de detalhes. Permite revisar nome, APP ID, CLIENT SECRET, status e dados da loja.

Salva em:

```json
{
  "endpoint": "PUT /api/admin/conectores",
  "regra": "mescla configuracoes existentes com as novas para nao perder tokens ja salvos",
  "bloqueios": ["projeto invalido", "agente invalido", "duplicidade por projeto/tipo", "demo"]
}
```

## Remover conexao

Botao: `Remover completamente`.

O legado abre modal de confirmacao antes de excluir. A API recebe:

```json
{
  "endpoint": "DELETE /api/admin/conectores",
  "body": {
    "id": "connector.id",
    "projetoId": "id da rota"
  },
  "efeito": "remove a linha de conectores"
}
```

## Tutorial lateral

A lateral mostra:

```json
{
  "painel_apps": "https://developers.mercadolivre.com.br/apps",
  "callback": "{origin}/api/admin/conectores/mercado-livre/callback",
  "webhook": "{origin}/api/mercado-livre/webhook?canal=ml"
}
```

O webhook do legado apenas registra notificacoes e responde:

```json
{
  "GET": "se vier challenge, devolve o challenge em text/plain",
  "POST": "log payload e retorna { ok: true }"
}
```

## Regra importante para replicar no v2

O Mercado Livre e conector do projeto, mas operacionalmente fica vinculado a um agente. O fluxo correto e: identificar loja por produto, salvar APP ID/SECRET, depois autorizar por OAuth.
