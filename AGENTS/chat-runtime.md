# Chat Runtime

## Estado atual

- o chat do v2 e local-first
- nao deve importar codigo de `C:\Projetos\infrastudio`
- o fallback para runtime legado foi removido
- `POST /api/chat` aceita contrato publico dos widgets e contrato interno do admin
- `GET /api/chat/config` existe para compatibilidade com `/chat.js`
- `/chat.js` e `/chat-widget.js` existem em `backend/public`
- central `/admin/atendimento` ja suporta sheet mobile acima do chat, voltar mobile e formatacao estilo WhatsApp em texto manual

## Contrato esperado do chat

Entrada comum:

- `message` ou `mensagem`
- `projeto`
- `agente`
- `context`
- `widgetSlug`
- `canal`
- `identificadorExterno`
- `identificador`
- `source`
- `whatsappChannelId`
- `attachments`

Saida comum:

- `chatId`
- `reply`
- `followUpReply`
- `messageSequence`
- `assets`
- `whatsapp`
- `handoff`

## Arquivos-chave

- `backend/app/api/chat/route.js`
- `backend/lib/chat/service.js`
- `backend/lib/chat/orchestrator.js`
- `backend/lib/chat/prompt-builders.js`
- `backend/lib/chat/api-runtime.js`
- `backend/lib/chat/sales-heuristics.js`
- `backend/lib/chat/handoff-policy.js`
- `backend/lib/chat/summary-stage.js`
- `backend/lib/agentes.js`
- `backend/lib/apis.js`
- `backend/lib/chat-widgets.js`

## Estado consolidado do cerebro

- home usa `chat-widget.js`
- chat da home so pode viver na rota `/`
- se projeto/agente/widget nao baterem, o chat nao deve responder
- runtime esta fail-closed quando faltar:
  - agente valido
  - `promptBase`
  - `OPENAI_API_KEY`
  - resposta util do modelo
- handoff principal foi religado no fluxo do v2
- pedido explicito de humano ja dispara handoff no runtime
- runtime ja envia alerta de handoff para atendentes cadastrados via WhatsApp do proprio projeto
- alerta de handoff leva link direto para `/admin/atendimento?conversa=...`
- atendimento humano agora assume automaticamente ao digitar/enviar mensagem no admin
- handoff humano volta sozinho para IA apos 5 minutos sem atividade humana
- widget publico e `chat.js` ja suportam CTA `Chamar humano` quando o runtime oferecer
- WhatsApp por canal ja suporta flag `responseOnlyUnsavedContacts`
- backend do chat ja respeita a regra de responder apenas contatos nao salvos quando a flag vier no canal
- resumo curto de memoria foi religado
- comportamento especifico da InfraStudio saiu do hardcode e foi para `agentes.configuracoes.runtimeConfig`
- APIs do agente aceitam configuracao em `apis.configuracoes`
- runtime de API entende:
  - `http.headers`
  - `runtime.responsePath`
  - `runtime.previewPath`
  - `runtime.fields[].path`

## Regras importantes

- nao reintroduzir fallback generico
- nao deixar comportamento comercial da InfraStudio vazar para agente de cliente
- o legado serve como referencia comportamental, nao como arquitetura
- tudo especifico de negocio deve ir para banco quando fizer sentido:
  - `agentes.configuracoes.runtimeConfig`
  - `apis.configuracoes`

## Pendencias abertas do runtime

- handoff/alerta de WhatsApp precisa de validacao ponta a ponta com canal real conectado e atendente cadastrado
