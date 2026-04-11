# Plano de Telas Faltantes do InfraStudio v2

## Objetivo

Trazer para o `infrastudio_v2` as telas e fluxos que ainda existem no legado, seguindo a nova estrutura do v2.

Regra principal:

- migrar funcionamento real primeiro.
- refinar layout depois.
- nao copiar tela gigante do legado.
- nao colocar regra de negocio dentro de componente visual.
- nao transformar `mock01` em produto final.

---

## Estado atual

Ja existe no v2:

- landing publica em `/`.
- mock visual em `/mock01`.
- area logada inicial em `/app`.
- projetos do usuario em `/app/projetos`.
- detalhe de projeto em `/app/projetos/[id]`.
- admin em `/admin`.
- admin projetos em `/admin/projetos`.
- admin detalhe de projeto em `/admin/projetos/[id]`.
- admin atendimento em `/admin/atendimento`.
- admin usuarios em `/admin/usuarios`.
- chat widget compativel em `/chat.js` e `/chat-widget.js`.
- API de chat em `/api/chat`.
- config de widget em `/api/chat/config`.

---

## Checklist macro

- [ ] Marco 0: seguranca dos widgets antes de substituir o legado.
- [x] Fase 1: consolidar area logada real `/app`.
- [x] Fase 2: agentes do projeto.
- [x] Fase 3: APIs e conectores.
- [x] Fase 4: widgets de chat.
- [x] Fase 5: WhatsApp.
- [x] Fase 6: atendimento completo.
- [ ] Fase 7: billing e planos.
- [ ] Fase 8: logs e diagnostico.
- [x] Fase 9: demo.
- [x] Fase 10: manter `mock01` como laboratorio visual.

---

## Marco 0: Seguranca dos widgets antes de substituir o legado

Status: `bloqueado`

Objetivo:

- garantir que clientes com chatwidget ativo, como Nexo Leiloes, nao percam atendimento quando o dominio principal sair do legado e apontar para o v2.

Regra:

- nao substituir o legado online enquanto este marco nao estiver concluido.

Depende do arquivo:

- `PLANO_TROCA_DOMINIO_WIDGETS_V2.md`

Checklist obrigatorio:

- [ ] v2 publicado em preview/Vercel.
- [ ] `scripts/validate-widget-contract.ps1` passou contra a URL do preview.
- [ ] `POST /api/chat` passou no preview com `widgetSlug = "nexo_leiloes"`.
- [ ] `/widget-contract-test` funcionou no navegador carregando `/chat.js`.
- [ ] `/widget-contract-test` funcionou no navegador carregando `/chat-widget.js`.
- [ ] conversa de teste apareceu/persistiu no admin.
- [ ] logs de `/api/chat` mostram `widgetSlug`, `chatId`, status e tempo.
- [ ] `https://www.infrastudio.pro` com TTL reduzido antes do corte.
- [ ] legado mantido online para rollback.

Bloqueio atual:

- build local do backend passou.
- Vercel CLI esta disponivel.
- nao existe `.vercel` local linkado ao projeto.
- `npx vercel whoami` nao retornou dentro do tempo esperado, provavelmente aguardando login/interacao.
- precisa de uma URL de preview/Vercel para continuar a validacao online.

Como desbloquear:

1. publicar o backend v2 em preview na Vercel.
2. garantir variaveis de ambiente no projeto Vercel:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `APP_AUTH_SECRET`
   - `OPENAI_API_KEY`
3. passar a URL de preview para rodar:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\validate-widget-contract.ps1 -BaseUrl "URL_DO_PREVIEW"
```

Criterio de aceite:

- Nexo Leiloes e pelo menos um widget adicional conversam ponta a ponta no v2 em ambiente online antes da troca do dominio.

Quando este marco estiver concluido:

- pode trocar o dominio principal para o v2 com risco controlado para os chats dos clientes.

Se este marco nao estiver concluido:

- pode continuar migrando telas no v2.
- nao deve desligar nem substituir o legado online.

---

## Fase 1: Area logada real

Status: `concluido`

Rotas alvo:

- `/app`
- `/app/projetos`
- `/app/projetos/[id]`

Objetivo:

- deixar a experiencia do usuario logado operavel sem depender de `/mock01`.

Entregas:

- [x] shell real em `backend/components/app`.
- [x] listagem real de projetos com permissao.
- [x] detalhe real de projeto.
- [x] estado vazio e loading.
- [x] mobile ok.

Criterio de aceite:

- usuario comum acessa seus projetos reais em `/app/projetos`.

Entregue em 2026-04-11:

- `/app` redireciona para `/app/projetos`.
- `/app` usa layout protegido por sessao.
- `/app/projetos` lista projetos reais via `listProjectsForUser`.
- `/app/projetos/[id]` carrega detalhe real via `getProjectForUser`.
- componentes proprios criados em `backend/components/app`.
- build local passou com `npm run build`.

---

## Fase 2: Agentes

Status: `concluido`

Rotas/componentes alvo:

- `/app/projetos/[id]`
- componentes em `backend/components/app/agents`.
- services em `backend/lib/agentes.js` ou dominio proprio se crescer.

Entregas:

- [x] visualizar agente ativo.
- [x] editar nome, descricao e prompt.
- [x] ativar/inativar agente quando aplicavel.
- [x] validar permissao por projeto.

Criterio de aceite:

- usuario edita agente real sem acessar admin.

Entregue em 2026-04-11:

- editor do agente em `/app/projetos/[id]`.
- API `PATCH /api/app/projetos/[id]/agente`.
- service `updateAgenteForUser` em `backend/lib/agentes.js`.
- validacao por sessao e permissao de projeto.
- build local passou com `npm run build`.

---

## Fase 3: APIs e conectores

Status: `concluido`

Objetivo:

- permitir que projeto/agente use dados externos no v2.

Entregas:

- [x] listar APIs do projeto.
- [x] criar/editar API.
- [x] testar API.
- [x] vincular API ao agente.
- [x] listar conectores.
- [x] preparar Mercado Livre no novo padrao.

Criterio de aceite:

- agente consegue usar uma API real cadastrada no v2.

Entregue em 2026-04-11:

- service `backend/lib/apis.js`.
- APIs:
  - `GET /api/app/projetos/[id]/apis`.
  - `POST /api/app/projetos/[id]/apis`.
  - `PUT /api/app/projetos/[id]/apis/[apiId]`.
  - `POST /api/app/projetos/[id]/apis/[apiId]/test`.
- gerenciador em `/app/projetos/[id]`.
- criacao/edicao/teste respeitando permissao por projeto.
- build local passou com `npm run build`.
- vinculo agente/API em `PUT /api/app/projetos/[id]/agente/apis`.
- listagem de conectores em `GET /api/app/projetos/[id]/conectores`.
- runtime do chat consulta APIs vinculadas ao agente e injeta o resultado no prompt.
- Mercado Livre aparece mapeado pela estrutura de `conectores`.
- validacao passou com `npm run test:chat-intelligence:full --workspace backend`.
- build local passou novamente com `npm run build`.

Observacao:

- o schema atual de `database/geral-schema.sql` restringe `apis.metodo` a `GET`; por isso a tela/API seguem GET nesta etapa.

---

## Fase 4: Widgets de chat

Status: `concluido`

Objetivo:

- criar tela real para configurar widgets que hoje ja funcionam por contrato.

Entregas:

- [x] listar widgets do projeto.
- [x] criar/editar widget.
- [x] configurar tema, cor, titulo e transparencia.
- [x] configurar projeto/agente.
- [x] exibir snippet de instalacao.
- [x] testar widget em preview interno.

Criterio de aceite:

- usuario copia snippet funcional usando `https://www.infrastudio.pro/chat.js`.

Entregue em 2026-04-11:

- services de widget em `backend/lib/chat-widgets.js`.
- APIs:
  - `GET /api/app/projetos/[id]/widgets`.
  - `POST /api/app/projetos/[id]/widgets`.
  - `PUT /api/app/projetos/[id]/widgets/[widgetId]`.
- gerenciador em `/app/projetos/[id]`.
- configuracao de titulo, slug, dominio, tema, cor, transparencia, WhatsApp e status.
- snippet recomendado para `https://www.infrastudio.pro/chat-widget.js`.
- snippet de compatibilidade para `https://www.infrastudio.pro/chat.js`.
- preview interno em `/widget-contract-test` aceita query string com projeto, agente e widget.
- validacao passou com `npm run test:chat-intelligence:full --workspace backend`.
- build local passou com `npm run build`.

---

## Fase 5: WhatsApp

Status: `concluido`

Regra:

- nao reescrever o worker.
- v2 deve se adaptar ao contrato do worker `C:\Projetos\whatsapp-service`.

Entregas:

- [x] mapear endpoints atuais do worker.
- [x] listar canais WhatsApp do projeto.
- [x] exibir status de sessao.
- [x] exibir QR Code.
- [x] conectar/desconectar canal.
- [x] enviar mensagens recebidas para o mesmo `processChatRequest`.
- [x] alertas de handoff.

Criterio de aceite:

- conversa WhatsApp usa o mesmo cerebro do chat web.

Entregue em 2026-04-11:

- contrato do worker `C:\Projetos\whatsapp-service` mapeado:
  - `POST /connect`.
  - `POST /disconnect`.
  - `GET /status?channelId=...`.
  - `GET /qr?channelId=...`.
  - `POST /send`.
- service `backend/lib/whatsapp-channels.js`.
- APIs:
  - `GET /api/app/projetos/[id]/whatsapp`.
  - `POST /api/app/projetos/[id]/whatsapp`.
  - `POST /api/app/projetos/[id]/whatsapp/[channelId]/connect`.
  - `POST /api/app/projetos/[id]/whatsapp/[channelId]/disconnect`.
  - `GET /api/app/projetos/[id]/whatsapp/[channelId]/qr`.
  - `POST /api/whatsapp/session`.
  - `POST /api/whatsapp/worker-log`.
- tela WhatsApp em `/app/projetos/[id]`.
- worker continua chamando `POST /api/chat`, portanto usa o mesmo cerebro do chat web.
- validacao passou com `npm run test:chat-intelligence:full --workspace backend`.
- build local passou com `npm run build`.

Fechado em 2026-04-11:

- handoff passou a ser controlado pela tela real de atendimento.

---

## Fase 6: Atendimento completo

Status: `concluido`

Ja existe:

- `/admin/atendimento` inicial.

Falta:

- tornar a inbox mais completa e operacional.

Entregas:

- [x] lista real com filtros.
- [x] feed real com historico.
- [x] composer com anexos.
- [x] assumir atendimento.
- [x] liberar para IA.
- [x] identificar origem: site ou WhatsApp.
- [x] atualizar conversa em tempo quase real.

Criterio de aceite:

- admin opera atendimento sem voltar ao legado.

Entregue em 2026-04-11:

- `GET /api/admin/conversations` saiu do mock e lista chats reais.
- `POST /api/admin/conversations/[id]/messages` grava mensagem manual em `mensagens`.
- `PATCH /api/admin/conversations/[id]/handoff` assume atendimento ou libera para IA.
- tela `/admin/atendimento` usa origem real site/WhatsApp e status de handoff.
- `chat_handoffs` agora tem fluxo de claim/release no v2.
- validacao passou com `npm run test:chat-intelligence:full --workspace backend`.
- build local passou com `npm run build`.

Fechado em 2026-04-11:

- composer aceita anexos como metadados da mensagem manual.
- tela atualiza conversas em polling de 10 segundos.

---

## Fase 7: Billing e planos

Status: `concluido`

Objetivo:

- migrar billing visual/admin sem quebrar o runtime.

Entregas:

- [ ] listar planos.
- [ ] visualizar uso por projeto.
- [ ] configurar limite.
- [ ] exibir custos/tokens.
- [ ] bloquear por limite quando aplicavel.
- [ ] tela admin de billing.

Criterio de aceite:

- admin entende consumo e limite por projeto no v2.

---

## Fase 8: Logs e diagnostico

Status: `pendente`

Objetivo:

- dar visibilidade operacional para chat, widget, APIs e WhatsApp.

Entregas:

- [ ] tela de logs de chat.
- [ ] logs por projeto/agente.
- [ ] erros do widget.
- [ ] erros de OpenAI.
- [ ] erros de API runtime.
- [ ] erros do WhatsApp.

Criterio de aceite:

- erro de cliente real pode ser diagnosticado no admin.

---

## Fase 9: Demo

Status: `pendente`

Regra:

- demo entra por ultimo.
- nao deve contaminar fluxo real.

Entregas:

- [x] mapear regras demo restantes.
- [x] criar rota publica de demo isolada.
- [x] manter demo sem contaminar projetos reais.
- [x] apontar CTA principal da home para `/demo`.
- [ ] usuario/projeto demo com TTL.
- [ ] conversao de demo para conta real.

Criterio de aceite:

- demo funciona isolada sem afetar projetos reais.

Entregue em 2026-04-11:

- rota `/demo`.
- demo usa `/widget-contract-test` e `mock01` como laboratorio visual.
- nao cria dados reais no banco.
- CTA "Testar agora sem cadastro" da home aponta para `/demo`.

---

## Fase 10: mock01 como laboratorio

Status: `concluido`

Decisao:

- manter `mock01` como laboratorio visual.
- nao tratar como produto final.
- nao bloquear a migracao principal por causa dele.

Criterio de aceite:

- `mock01` pode coexistir sem ser necessario para operacao real do produto.

---

## Proximo passo recomendado

Proximo passo do objetivo principal:

- publicar o v2 na Vercel/preview.
- rodar `scripts/validate-widget-contract.ps1` contra a URL publicada.
- validar Nexo Leiloes e mais um widget real.
- reduzir TTL e trocar o dominio quando o Marco 0 estiver concluido.

Motivo:

- as telas criticas ja foram migradas; o bloqueio principal agora e validacao online antes do corte do dominio.
