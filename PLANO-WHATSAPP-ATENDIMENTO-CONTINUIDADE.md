# Plano WhatsApp, Atendimento e Continuidade

Documento curto de continuidade da frente WhatsApp.

## Objetivo

Unificar widget e WhatsApp no mesmo atendimento quando for o mesmo cliente, preservando nome, telefone, historico e contexto do catalogo Mercado Livre.

## Regra

- Nao resolver variacao de texto com regex nova.
- Usar intent estruturado + estado salvo + handler deterministico.
- Preservar `catalogo.listingSession`, `catalogo.productFocus`, `catalogo.produtoAtual` e `catalogo.ultimosProdutos`.
- Renderizacao por canal fica separada:
  - widget: cards e actions.
  - WhatsApp: texto curto e links.

## Feito

- `backend/lib/chat/contact.js`
  - Nome e telefone agora podem vir de `lead` ou de varios campos do WhatsApp.
  - `resolveChatContactSnapshot` fica mais completo.

- `backend/lib/chats.js`
  - Criado `findActiveChatByContactPhone`.
  - Busca chat ativo por telefone em qualquer canal, com escopo por projeto/agente.

- `backend/lib/chat/service.js`
  - `ensureActiveChatSession` agora tenta reaproveitar atendimento existente por telefone antes de criar outro.
  - `buildNextContext` preserva estado aninhado de catalogo quando o WhatsApp chega com contexto vazio.
  - `mergeContext` publico foi mantido raso para nao quebrar fluxos antigos.

- `backend/tests/chat-intelligence.smoke.ts`
  - Coberto widget -> WhatsApp pelo mesmo telefone.
  - Coberto preservacao de `listingSession` e `productFocus`.
  - Coberto caso do print:
    - mensagem: `tem outros produtos de jogo de jantar ?`
    - intent: `catalog_alternative_search`
    - busca: `jogo de jantar`
    - exclui produto atual.
  - Coberto payload final do WhatsApp com `buildWhatsAppMessageSequence`:
    - lista curta.
    - links limpos.
    - sem repetir produto atual quando `excludeCurrentProduct` for true.
  - Coberto disponibilidade de catalogo Mercado Livre:
    - chat rejeita produto vendido/sem estoque.
    - loja publica rejeita produto pausado, fechado ou sem estoque.

- `backend/lib/mercado-livre-connector.js`
  - Busca/listagem live do Mercado Livre agora filtra apenas item `active` com estoque maior que zero.
  - Produto live individual tambem falha fechado quando estiver pausado, vendido ou sem estoque.

- `backend/lib/mercado-livre-store-core/public.js`
  - Detalhe publico da loja agora respeita status/estoque live quando existir.
  - Produto pausado, fechado ou sem estoque nao e retornado no detalhe publico.

- `backend/lib/admin-conversations.js`
  - Mensagens do atendimento agora carregam `canal` e `origem`.
  - Resposta manual do admin escolhe o canal da mensagem mais recente quando o atendimento mistura widget e WhatsApp.

- `backend/app/api/admin/conversations/[id]/messages/route.js`
  - Envio manual usa o canal resolvido antes de decidir se deve enviar pelo WhatsApp.

- `backend/components/admin/attendance/attendance-page.js`
  - Bolha do atendimento mostra origem `site` ou `whatsapp` por mensagem.

- `AGENTS/runtime-intent-refactor.md`
  - Atualizado com o progresso da frente WhatsApp/catalogo.

## Validado

- `cd backend && npm run test:chat-intelligence`
  - 197 smoke tests passaram.

- `cd backend && npm run build`
  - passou.

- `cd backend && npm run lint`
  - passou com 9 warnings antigos de `<img>`.

## Pendente

1. Validar fluxo real no WhatsApp worker.
2. Validar `/admin/atendimento` com dados reais mostrando mensagens misturadas de widget e WhatsApp no mesmo atendimento.
3. Confirmar envio manual real do admin pelo canal correto quando o atendimento tiver os dois canais.
4. Rodar refresh/snapshot contra uma conta real Mercado Livre e confirmar que produto pausado/vendido sai da loja e do chat.
5. Depois da validacao real, remover deste plano o que estiver concluido.
