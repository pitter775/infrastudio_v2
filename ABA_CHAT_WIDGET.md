# Aba Chat Widget - comportamento do legado

Objetivo deste arquivo: servir como especificacao de comportamento para o Codex replicar a aba no `infrastudio_v2`, mantendo o funcionamento do legado, mas usando os padroes, rotas, componentes, auth e estrutura atuais do v2. Nao importar nada de `C:\Projetos\infrastudio`.

Fonte analisada no legado:

- `C:\Projetos\infrastudio\app\admin\projetos\[id]\page.tsx`
- `C:\Projetos\infrastudio\app\admin\projetos\[id]\_components\project-chats-section.tsx`
- `C:\Projetos\infrastudio\app\api\admin\chat-widgets\route.ts`
- `C:\Projetos\infrastudio\lib\chat-widgets.ts`

## Entrada na aba

Ao entrar em `/admin/projetos/[id]`, a pagina busca o detalhe do projeto em:

```json
{
  "endpoint": "GET /api/admin/projetos/[id]",
  "retorno_usado": {
    "widgets": "lista de chat_widgets do projeto",
    "agentes": "lista de agentes do projeto",
    "apis": "lista de APIs do projeto",
    "whatsappChannels": "lista de canais WhatsApp",
    "stats.totalWidgets": "contador exibido na aba"
  }
}
```

A aba fica bloqueada enquanto o projeto nao tiver pelo menos um agente. Quando liberada, ela mostra os widgets criados e um snippet pronto do primeiro widget ativo; se nao houver ativo, usa o primeiro da lista.

## Lista exibida

Cada card mostra:

```json
{
  "titulo": "Chat widget",
  "status": "ativo | inativo",
  "dominio": "widget.dominio ou texto padrao",
  "tema": "dark | light",
  "corPrimaria": "hex",
  "slug": "slug publico",
  "acoes": ["Ver codigo", "Editar", "Remover"]
}
```

Se nao existir widget, aparece estado vazio pedindo para criar um widget.

## Criar widget

Botao: `Criar widget do site`.

Abre modal `WidgetModal`.

Campos na criacao:

```json
{
  "nome": "obrigatorio",
  "dominio": "opcional",
  "tema": "dark por padrao",
  "corPrimaria": "#2563eb por padrao",
  "fundoTransparente": true,
  "ativo": true
}
```

Na criacao, o slug nao aparece no modal. Ele e gerado automaticamente:

```json
{
  "slug": "slug digitado ou slugify(nome) ou chat-widget",
  "agenteId": "agente ativo do projeto; se nao houver, primeiro agente",
  "whatsappCelular": "numero limpo vindo do formulario ou primeiro canal WhatsApp",
  "projetoId": "id da rota"
}
```

Salva em:

```json
{
  "endpoint": "POST /api/admin/chat-widgets",
  "validacoes": [
    "usuario precisa ser admin global",
    "nome e slug obrigatorios",
    "projetoId obrigatorio",
    "usuario precisa poder gerenciar o projeto",
    "agenteId obrigatorio",
    "agente precisa pertencer ao projeto",
    "um agente nao pode ter dois widgets no mesmo projeto",
    "demo bloqueia escrita"
  ],
  "tabela": "chat_widgets"
}
```

Depois de salvar, o widget retornado entra no estado local por `upsertById`, o modal fecha e aparece feedback de sucesso.

## Editar widget

Botao: `Editar`.

No modo edicao aparecem campos extras:

```json
{
  "slug": "editavel",
  "whatsappCelular": "editavel e salvo apenas com digitos",
  "projeto": "informativo",
  "agente": "informativo, agente ativo selecionado automaticamente"
}
```

Salva em:

```json
{
  "endpoint": "PUT /api/admin/chat-widgets",
  "body": {
    "id": "widget.id",
    "nome": "string",
    "slug": "string",
    "projetoId": "id da rota",
    "agenteId": "agente resolvido",
    "dominio": "string|null",
    "whatsappCelular": "digitos",
    "tema": "dark|light",
    "corPrimaria": "hex",
    "fundoTransparente": "boolean",
    "ativo": "boolean"
  }
}
```

A API valida se o widget existe, se pertence ao projeto informado, se o agente pertence ao projeto e se nao duplica o vinculo agente-widget.

## Remover widget

Botao: `Remover`.

Fluxo:

```json
{
  "endpoint": "DELETE /api/admin/chat-widgets",
  "body": {
    "id": "widget.id",
    "projetoId": "id da rota"
  },
  "validacoes": [
    "widget existe",
    "widget.projetoId bate com projetoId",
    "demo bloqueia escrita"
  ],
  "efeito": "remove a linha de chat_widgets"
}
```

## Codigo do widget

Botao: `Ver codigo`.

Abre modal com duas variantes:

```json
{
  "essencial": "Minimo preenchido",
  "detalhado": "Completo e detalhado"
}
```

O snippet essencial carrega `/chat.js` e chama `window.InfraChat.mount`.

Dados montados no snippet:

```json
{
  "apiBase": "window.location.origin ou https://seu-dominio",
  "projeto": "projeto.slug ou projeto.id",
  "agente": "agente.slug ou agente.id",
  "strictHostControl": true,
  "context": {
    "route.path": "window.location.pathname",
    "ui.title": "widget.nome",
    "ui.theme": "widget.tema",
    "ui.accent": "widget.corPrimaria",
    "ui.transparent": "widget.fundoTransparente",
    "parametros_obrigatorios": "inclui placeholders quando APIs ligadas ao agente exigem parametros"
  }
}
```

O snippet detalhado adiciona controle de host:

```json
{
  "isAllowedRoute": "window.location.pathname.startsWith('/')",
  "hasUnlockedChat": true,
  "quando_bloqueado": "window.InfraChat.destroy()",
  "quando_liberado": "window.InfraChat.mount(...)",
  "policy.allowedRoutes": ["/"]
}
```

## Regra importante para replicar no v2

O widget nao e solto. Ele sempre precisa ficar vinculado a um agente do mesmo projeto, e o legado impede dois widgets para o mesmo agente no mesmo projeto.
