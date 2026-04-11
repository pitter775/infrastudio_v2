# AGENTS.md

## Regra principal

Este projeto e o `infrastudio_v2`. Tudo que for criado ou alterado deve seguir a estrutura atual do workspace.

Nao criar estrutura paralela.
Nao duplicar componente ou utilitario existente.
Nao reintroduzir imports do legado `C:\Projetos\infrastudio`.
Se houver conflito entre rapidez e padrao do projeto, manter o padrao.

---

## Workspace

Raiz:

- `backend/`: app principal Next.js com App Router.
- `frontend/`: mock SPA React/Vite.
- `database/`: referencia e scripts de banco.
- `scripts/`: scripts locais compartilhados.

Pastas geradas nao devem ser editadas manualmente:

- `node_modules/`
- `.next/`
- `dist/`

---

## Banco de dados

Referencia do schema:

- `database/geral-schema.sql`

Regra:

- nunca editar `database/geral-schema.sql` diretamente.
- novos ajustes de banco devem ser criados como SQL em `database/seeder/`.
- o usuario aplica no banco e depois atualiza o `geral-schema.sql`.

---

## Stack oficial

Backend:

- Next.js
- React
- App Router
- Supabase como banco
- JWT proprio com cookie HTTP-only

Frontend/mock:

- React
- Vite
- Tailwind CSS
- Radix UI primitives
- `lucide-react`
- `framer-motion`
- `simplebar-react`
- `clsx`, `tailwind-merge`, `class-variance-authority`

---

## Padroes de UI

Obrigatorio:

- usar Tailwind CSS.
- usar `cn()` para compor classes.
- usar `lucide-react` para icones.
- reutilizar componentes de `components/ui`.
- usar Radix para dialog, dropdown, sheet, menu, tooltip e overlays acessiveis.

Evitar:

- SVG inline quando `lucide-react` resolver.
- concatenacao manual de classes quando `cn()` resolver.
- componentes visuais duplicados.
- hacks de margem/overflow para corrigir borda ou alinhamento.

Regra de layout:

- header, toolbar e conteudo devem ficar estruturalmente alinhados.
- containers com borda precisam fechar visualmente nos quatro lados.
- se uma borda sumir, corrigir container/overflow, nao empurrar elemento.

---

## Backend

Pastas principais:

- `backend/app/`: rotas App Router.
- `backend/components/`: componentes de tela.
- `backend/components/ui/`: componentes base.
- `backend/lib/`: dominio, integrações e utilitarios.
- `backend/lib/chat/`: pipeline local de inteligencia de chat.
- `backend/tests/`: harness de testes do chat.

Arquivos importantes:

- `backend/app/api/chat/route.js`: endpoint do chat.
- `backend/lib/chat/service.js`: runtime principal do chat.
- `backend/lib/chat/orchestrator.js`: executor local/OpenAI.
- `backend/lib/chats.js`: persistencia de conversas e mensagens.
- `backend/lib/agentes.js`: agentes.
- `backend/lib/apis.js`: APIs do projeto e vinculo com agente.
- `backend/lib/conectores.js`: conectores do projeto.
- `backend/lib/chat-widgets.js`: widgets publicos de chat.
- `backend/lib/whatsapp-channels.js`: canais WhatsApp e contrato com worker externo.
- `backend/lib/admin-conversations.js`: atendimento/admin sobre chats reais.
- `backend/lib/projetos.js`: projetos.
- `backend/lib/session.js`, `backend/lib/session-token.js`, `backend/lib/auth.js`: auth.
- `backend/lib/supabase-admin.js`: Supabase server/admin.

---

## Chat e inteligencia

Estado atual:

- o chat do v2 e local-first.
- nao deve importar codigo de `C:\Projetos\infrastudio`.
- o fallback para `chat-service.ts` legado foi removido.
- `backend/next.config.mjs` deve apontar para a raiz do workspace `infrastudio_v2`, nao para `C:\Projetos`.
- `POST /api/chat` aceita contrato publico dos widgets e contrato interno do admin.
- `GET /api/chat/config` existe para compatibilidade com `/chat.js`.
- `/chat.js` e `/chat-widget.js` existem em `backend/public`.
- CORS/OPTIONS do widget ficam em `backend/lib/chat/http.js`.
- diagnostico estruturado fica em `backend/lib/chat/diagnostics.js` e nao deve logar conteudo da mensagem.

Pipeline atual:

- entrada em `POST /api/chat`.
- `backend/lib/chat-adapter.js` chama `processChatRequest`.
- `backend/lib/chat/service.js` resolve canal, projeto, agente, chat, contexto, anexos, handoff, billing e persistencia.
- `backend/lib/chat/orchestrator.js` executa o nucleo local/OpenAI.
- helpers do cerebro ficam em `backend/lib/chat/*.js`.
- APIs vinculadas ao agente sao consultadas no runtime e injetadas no prompt.

Modulos locais de inteligencia:

- `api-runtime.js`
- `catalog-follow-up.js`
- `handoff-policy.js`
- `lead-stage.js`
- `mercado-livre.js`
- `pipeline-stage.js`
- `prompt-builders.js`
- `sales-heuristics.js`
- `semantic-intent-stage.js`
- `text-utils.js`

Dominios importantes que vieram do legado e devem continuar representados no v2:

- projeto
- agente
- API
- conector
- widget
- chat
- mensagem
- handoff
- canal de WhatsApp
- plano
- billing
- uso

Contrato esperado do chat:

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

---

## Admin real

Rotas reais:

- `/admin`
- `/admin/projetos`
- `/admin/projetos/[id]`
- `/admin/atendimento`
- `/admin/usuarios`

Arquivos principais:

- `backend/app/admin/layout.js`
- `backend/components/admin/layout/shell.js`
- `backend/components/admin/page-header.js`
- `backend/components/admin/projects/projects-page.js`
- `backend/components/admin/projects/project-card.js`
- `backend/components/admin/projects/project-detail-page.js`
- `backend/components/admin/attendance/attendance-page.js`
- `backend/components/admin/users/users-page.js`
- `backend/app/api/admin/conversations/route.js`
- `backend/app/api/admin/conversations/[id]/messages/route.js`
- `backend/app/api/admin/conversations/[id]/handoff/route.js`

Regras:

- `/admin` redireciona para `/admin/projetos`.
- admin ve todos os projetos.
- usuario comum ve apenas projetos vinculados.
- CRUD de usuarios exige `role = "admin"`.
- `/admin/atendimento` usa chats reais, nao mock.
- atendimento permite assumir handoff e liberar IA via `chat_handoffs`.
- atendimento faz polling simples de 10 segundos.
- anexos manuais do atendimento entram como metadados da mensagem.

---

## Auth

O v2 usa auth propria:

- JWT assinado com `APP_AUTH_SECRET`.
- cookie HTTP-only `infrastudio-session`.
- senha com `bcryptjs`.
- Supabase apenas como banco.
- nao usa Supabase Auth.
- `backend/proxy.js` protege `/admin` e `/api/admin`.

APIs:

- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/auth/me`

---

## Rotas principais

Publicas:

- `/`
- `/demo`
- `/mock01`
- `/mock01/dashboard`
- `/mock01/[slug]`
- `/mock01/[slug]/dashboard`
- `/mock01/[slug]/atendimento`

Sistema:

- `/app`
- `/app/projetos`
- `/app/projetos/[id]`

`/app/projetos/[id]` concentra:

- edicao do agente ativo.
- CRUD de APIs GET.
- teste de API.
- vinculo API/agente.
- listagem de conectores.
- CRUD de widgets.
- snippet de instalacao do widget.
- canais WhatsApp com QR/conectar/desconectar.

Admin:

- `/admin`
- `/admin/projetos`
- `/admin/projetos/[id]`
- `/admin/atendimento`
- `/admin/usuarios`

APIs:

- `/api/chat`
- `/api/chat/config`
- `/api/auth/*`
- `/api/admin/conversations`
- `/api/admin/conversations/[id]/handoff`
- `/api/admin/conversations/[id]/messages`
- `/api/admin/usuarios`
- `/api/admin/usuarios/[id]`
- `/api/app/projetos/[id]/agente`
- `/api/app/projetos/[id]/agente/apis`
- `/api/app/projetos/[id]/apis`
- `/api/app/projetos/[id]/apis/[apiId]`
- `/api/app/projetos/[id]/apis/[apiId]/test`
- `/api/app/projetos/[id]/conectores`
- `/api/app/projetos/[id]/widgets`
- `/api/app/projetos/[id]/widgets/[widgetId]`
- `/api/app/projetos/[id]/whatsapp`
- `/api/app/projetos/[id]/whatsapp/[channelId]/connect`
- `/api/app/projetos/[id]/whatsapp/[channelId]/disconnect`
- `/api/app/projetos/[id]/whatsapp/[channelId]/qr`
- `/api/whatsapp/session`
- `/api/whatsapp/worker-log`

---

## Frontend Vite

O `frontend/` e mock SPA. Ele nao e o app principal de producao.

Padrao:

- `frontend/src/components/`: composicoes e telas.
- `frontend/src/components/ui/`: componentes base.
- `frontend/src/lib/`: helpers.
- `frontend/src/assets/`: assets importados.

Usar alias `@` para imports internos.

---

## Variaveis de ambiente

Backend usa `backend/.env.local` no desenvolvimento.

Importantes:

- `NEXT_PUBLIC_SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `APP_AUTH_SECRET`
- `OPENAI_API_KEY`
- `WHATSAPP_WORKER_URL` ou `WHATSAPP_SERVICE_URL`
- `WHATSAPP_BRIDGE_SECRET`

Sem `OPENAI_API_KEY`, o orquestrador local responde com fallback simples, mas sem inteligencia real do modelo.

---

## Comandos

Na raiz:

- `npm run install:all`
- `npm run localhost`
- `npm run localhost:3001`
- `npm run localhost:3002`
- `npm run dev:backend`
- `npm run dev:frontend`
- `npm run build`
- `npm run build:backend`
- `npm run build:frontend`

No backend:

- `npm run build`
- `npm run lint`
- `npm run test:chat-intelligence`
- `npm run test:chat-intelligence:scenarios`
- `npm run test:chat-intelligence:full`

Fluxo comum:

- subir backend: `npm run localhost`
- abrir: `http://localhost:3000/demo`, `http://localhost:3000/app/projetos` ou `http://localhost:3000/admin`

---

## Validacao antes de finalizar mudanca de chat

Rodar no `backend/`:

- `npm run test:chat-intelligence:full`
- `npm run build`

Na raiz, tambem pode rodar:

- `npm run test:chat-intelligence:full --workspace backend`
- `npm run build`

Tambem fazer busca por imports do legado:

- procurar por `../../../infrastudio`
- procurar por `../../../../infrastudio`
- procurar por `C:\Projetos\infrastudio\lib`

Resultado esperado:

- zero imports de codigo do legado.
- testes de chat passando.
- build passando.

---

## Migracao e prioridades

O legado era fonte de regra de negocio, nao modelo de arquitetura.

Absorver do legado:

- contratos de auth e sessao.
- regras de papel.
- projetos, agentes, APIs, conectores e widgets.
- chat, handoff, billing e telemetria.
- contrato com o worker WhatsApp.
- operacao do atendimento.

Nao copiar do legado:

- paginas gigantes como estrutura final.
- layout antigo como padrao.
- regra de negocio colada em componente de UI.
- acoplamento entre tela e dominio.

Ordem recomendada para proximas frentes:

1. publicar o v2 em preview/Vercel quando o usuario fizer a troca da fonte Git.
2. rodar `scripts/validate-widget-contract.ps1` contra a URL publicada.
3. validar `nexo_leiloes` e pelo menos mais um widget real.
4. reduzir TTL e manter legado online para rollback.
5. so entao trocar `https://www.infrastudio.pro` para o v2.
6. depois do corte, atacar billing/logs finos/demo avancada se ainda fizer sentido.

Regras:

- migrar funcionamento antes de refinamento visual.
- migrar por dominio/contrato, nao por copia cega de pagina.
- `mock01` e referencia visual e laboratorio, nao destino final.
- o worker `C:\Projetos\whatsapp-service` continua separado; o v2 deve adaptar-se ao contrato dele.
- demo e importante, mas nao deve contaminar os fluxos reais.
- criar estrutura nova so quando houver implementacao real para ela.

---

## Realidade atual em 2026-04-11

Concluido localmente:

- dependencia de runtime do legado removida.
- widgets publicos compativeis.
- `/app` real com projetos, detalhe, agente, APIs, conectores, widgets e WhatsApp.
- `/admin/atendimento` real sobre chats/mensagens do banco.
- `/demo` publica criada e CTA principal da home aponta para ela.
- `mock01` mantido como laboratorio visual.
- `CHECKPOINT_CONTINUACAO_V2.md` criado para retomada segura.

Validado:

- `npm run test:chat-intelligence:full --workspace backend` passa com 39 smoke tests e 6 cenarios.
- `npm run build` passa.
- busca por dependencia do legado em codigo retorna zero resultado.

Ainda falta do combinado principal:

- usuario publicar/trocar fonte Git na Vercel.
- validar preview/Vercel com `scripts/validate-widget-contract.ps1`.
- testar POST real do widget `nexo_leiloes`.
- validar pelo menos mais um widget real.
- reduzir TTL do DNS.
- trocar dominio mantendo legado online para rollback.

Ainda falta importar ou recriar do legado:

- billing/admin financeiro: planos, uso por projeto, limites, custos/tokens e tela admin.
- logs visuais/diagnostico operacional: tela para erros de chat, widget, OpenAI, API runtime e WhatsApp.
- demo avancada: usuario/projeto demo temporario, TTL, expiracao e conversao para conta real.
- pos-corte de dominio: monitoramento fino, contrato final do widget e limpeza de compatibilidade morta.
- ajustes finos de layout das telas reais apos validacao em producao.

Nao e mais necessario importar do legado para o objetivo principal:

- runtime principal do chat.
- fallback para `chat-service.ts`.
- contrato publico basico dos widgets.
- auth/sessao.
- projetos, agentes, APIs, conectores, widgets, WhatsApp e atendimento operacional minimo.

Fora do caminho critico:

- billing/admin financeiro.
- logs visuais avancados.
- demo com usuario/projeto temporario e TTL.
