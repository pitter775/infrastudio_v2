# Plano de Troca de Dominio dos Chatwidgets para o v2

## Objetivo

Trocar o dominio do legado pelo `infrastudio_v2` sem quebrar os chatwidgets que clientes ja usam em seus sites.

Dominio oficial:

- `https://www.infrastudio.pro`

Regra principal:

- compatibilidade primeiro, limpeza depois.

Nao fazer:

- nao mudar contrato publico do widget sem adapter.
- nao exigir troca manual imediata em todos os clientes.
- nao remover endpoint antigo no primeiro corte.
- nao apontar dominio sem logs e rollback.
- nao reintroduzir dependencia de codigo do legado.

---

## Estado atual

Backend v2:

- `POST /api/chat` existe.
- pipeline de chat do v2 esta local-first.
- imports de runtime para `C:\Projetos\infrastudio` foram removidos.
- `npm run test:chat-intelligence:full --workspace backend` passa.
- `npm run build` passa.

Risco principal:

- ainda falta validar o contrato publico real usado pelo widget dos clientes.

---

## Checklist macro

- [x] Fase 1: inventariar contrato real do widget legado.
- [x] Fase 2: criar adapter compativel no v2.
- [x] Fase 3: criar/servir script ou config compativel no v2.
- [x] Fase 4: criar testes de contrato do widget.
- [ ] Fase 5: validar em dominio temporario.
- [x] Fase 6: preparar logs, monitoramento e rollback.
- [ ] Marco: v2 liberado para trocar pelo legado.
- [ ] Fase 7: trocar dominio de forma controlada.
- [ ] Fase 8: monitorar pos-corte e limpar compatibilidade morta.

---

## Fase 1: Inventario do contrato atual

Status: `concluido`

Objetivo:

- descobrir exatamente o que os sites dos clientes carregam e chamam hoje.

Mapear no legado:

- URL publica do script do widget.
- arquivos publicos usados pelo widget.
- endpoints chamados pelo widget.
- payload enviado para o chat.
- payload esperado como resposta.
- parametros obrigatorios.
- uso de `widgetSlug`, `projeto`, `agente`, `canal`, `identificadorExterno`.
- regras de CORS/origem.
- assets e estilos carregados.
- callbacks/eventos usados pelo script, se existirem.

Arquivos provaveis no legado:

- `C:\Projetos\infrastudio\public\chat.js`
- `C:\Projetos\infrastudio\app\api\chat\route.ts`
- `C:\Projetos\infrastudio\app\api\chat\config\route.ts`
- `C:\Projetos\infrastudio\lib\chat-widgets.ts`

Entrega:

- [x] lista de URLs publicas do widget.
- [x] exemplo real de payload de entrada.
- [x] exemplo real de payload de saida.
- [x] lista de endpoints que precisam existir no v2.
- [x] lista de headers/CORS necessarios.

Criterio de aceite:

- conseguir simular uma chamada do widget legado contra o v2 em teste local.

Notas de inventario:

### Scripts publicos encontrados no legado

- `GET /chat.js`
- `GET /chat-widget.js`

Arquivos de origem no legado:

- `C:\Projetos\infrastudio\public\chat.js`
- `C:\Projetos\infrastudio\public\chat-widget.js`

### Script atual mais completo: `/chat.js`

Uso por tag:

```html
<script
  src="https://DOMINIO/chat.js"
  data-projeto="slug-ou-id-do-projeto"
  data-agente="slug-ou-id-do-agente"
  data-api-base="https://DOMINIO"
></script>
```

Tambem expoe API global:

- `window.InfraChat.mount(config)`
- `window.InfraChat.updateContext(context)`
- `window.InfraChat.setContext(context)`
- `window.InfraChat.hide()`
- `window.InfraChat.show(options)`
- `window.InfraChat.destroy()`
- `window.InfraChat.isMounted()`
- `window.InfraChat.getState()`

Config aceita por `InfraChat.mount`:

```json
{
  "projeto": "string",
  "agente": "string",
  "apiBase": "string",
  "context": {},
  "ui": {},
  "policy": {},
  "open": false,
  "hidden": false,
  "embedded": false,
  "target": "string",
  "hideLauncher": false,
  "destroyOnClose": false,
  "mobileFullscreen": false,
  "currentRoute": "string",
  "strictHostControl": true
}
```

Chamadas feitas por `/chat.js`:

- `GET {apiBase}/api/chat/config?projeto=...&agente=...`
- `POST {apiBase}/api/chat`

Payload do `POST /api/chat` gerado por `/chat.js`:

```json
{
  "chatId": "chat atual ou null",
  "message": "texto digitado",
  "projeto": "config.projeto",
  "agente": "config.agente",
  "context": {
    "channel": {
      "kind": "external_widget"
    },
    "ui": {
      "structured_response": true,
      "allow_icons": true
    }
  }
}
```

Resposta esperada pelo script:

```json
{
  "chatId": "string",
  "reply": "string",
  "followUpReply": "string",
  "messageSequence": [],
  "assets": [],
  "whatsapp": {
    "url": "string",
    "label": "string"
  }
}
```

Campos efetivamente consumidos pelo script:

- `chatId`
- `reply`
- `error`
- `assets`
- `whatsapp.url`
- `whatsapp.label`

Resposta esperada do `GET /api/chat/config`:

```json
{
  "projeto": {
    "id": "string",
    "slug": "string",
    "nome": "string"
  },
  "agente": {
    "id": "string",
    "slug": "string",
    "nome": "string"
  },
  "ui": {
    "title": "string",
    "theme": "light|dark|null",
    "accent": "string|null",
    "transparent": "boolean|null",
    "whatsappCelular": "string|null"
  }
}
```

### Script antigo/simplificado: `/chat-widget.js`

Uso por tag:

```html
<script
  src="https://DOMINIO/chat-widget.js"
  data-widget="slug-do-widget"
  data-title="Chat"
  data-api-base="https://DOMINIO"
  data-theme="dark"
  data-accent="#64748b"
  data-transparent="true"
></script>
```

Chamada feita:

- `POST {apiBase}/api/chat`

Payload:

```json
{
  "chatId": "chat atual ou null",
  "message": "texto digitado",
  "widgetSlug": "data-widget"
}
```

Resposta consumida:

- `chatId`
- `reply`
- `error`
- `assets`
- `whatsapp.url`
- `whatsapp.label`

Evento publico observado:

- `window.dispatchEvent(new CustomEvent("infrastudio-chat:open", { detail: { widgetSlug } }))`

### CORS do legado

`POST /api/chat`:

- `Access-Control-Allow-Origin`: `Origin` recebido ou `*`
- `Access-Control-Allow-Methods`: `POST, OPTIONS`
- `Access-Control-Allow-Headers`: `Content-Type`
- `Vary`: `Origin`

`GET /api/chat/config`:

- `Access-Control-Allow-Origin`: `Origin` recebido ou `*`
- `Access-Control-Allow-Methods`: `GET, OPTIONS`
- `Access-Control-Allow-Headers`: `Content-Type`
- `Vary`: `Origin`

### Endpoints que o v2 precisa servir antes da troca

- `GET /chat.js`
- `GET /chat-widget.js`
- `GET /api/chat/config?projeto=...&agente=...`
- `OPTIONS /api/chat`
- `POST /api/chat`
- `OPTIONS /api/chat/config`

### Lacunas atuais no v2 a atacar na Fase 2/3

- `backend/app/api/chat/route.js` precisa aceitar CORS/OPTIONS.
- `backend/app/api/chat/route.js` hoje valida `conversationId` e `texto`; precisa aceitar payload publico com `message`, `projeto`, `agente`, `widgetSlug` e `chatId`.
- `backend/app/api/chat/config/route.js` precisa existir no v2.
- `backend/public/chat.js` e `backend/public/chat-widget.js` precisam existir no v2 ou serem servidos por rota equivalente.
- testes de contrato precisam simular os dois scripts.

---

## Fase 2: Adapter compativel no v2

Status: `concluido`

Objetivo:

- fazer o v2 aceitar o contrato antigo sem exigir mudanca nos clientes.

Arquivos alvo no v2:

- `backend/app/api/chat/route.js`
- `backend/lib/chat-adapter.js`
- `backend/lib/chat/service.js`
- `backend/lib/chat-widgets.js`

Regras:

- payload antigo deve entrar sem quebrar.
- adapter traduz para `processChatRequest`.
- resposta deve preservar campos esperados pelo widget.
- nao criar novo runtime paralelo de chat.

Entrega:

- [x] endpoint aceita payload legado.
- [x] endpoint aceita payload novo.
- [x] resposta mantem compatibilidade.
- [x] erros retornam formato previsivel.

Criterio de aceite:

- teste de contrato passa para payload antigo e novo.

Notas:

- `backend/app/api/chat/route.js` agora aceita contrato publico com `message`, `projeto`, `agente`, `widgetSlug`, `chatId`, `conversationId` e `texto`.
- `OPTIONS /api/chat` foi adicionado com CORS.
- helper criado em `backend/lib/chat/http.js` para CORS, normalizacao de payload publico e resposta publica.
- `backend/lib/chat/service.js` agora reutiliza `chatId` recebido pelo widget quando o chat existe e pertence ao projeto/agente resolvido.
- contrato antigo do admin com `conversationId` + `texto` continua aceito por normalizacao.

---

## Fase 3: Script/config compativel

Status: `concluido`

Objetivo:

- garantir que o script usado pelos clientes continue carregando.

Decisao a tomar:

- manter mesma URL publica depois do corte de dominio.
- ou servir proxy/redirect temporario antes do corte final.

Possiveis rotas no v2:

- `GET /chat.js`
- `GET /api/chat/config`
- outros endpoints descobertos na fase 1.

Entrega:

- [x] script atual identificado.
- [x] rota equivalente criada no v2, se necessario.
- [x] config do widget servida pelo v2.
- [x] assets necessarios disponiveis.

Criterio de aceite:

- site de teste carrega o widget usando dominio temporario do v2.

Notas:

- `backend/public/chat.js` foi adicionado para manter a URL publica `/chat.js`.
- `backend/public/chat-widget.js` foi adicionado para manter a URL publica `/chat-widget.js`.
- `backend/app/api/chat/config/route.js` foi criado.
- `OPTIONS /api/chat/config` foi adicionado com CORS.
- `GET /api/chat/config?projeto=...&agente=...` retorna `projeto`, `agente` e `ui` no formato esperado pelo script atual.

---

## Fase 4: Testes de contrato

Status: `concluido`

Objetivo:

- criar testes que simulem o cliente real usando o widget antigo.

Sugestao de testes:

- carregamento de config.
- POST de mensagem com payload legado.
- POST de mensagem com payload atual.
- resposta com `reply`.
- resposta com `chatId`.
- resposta com `messageSequence` quando WhatsApp.
- erro controlado quando `widgetSlug` invalido.
- CORS/origem quando aplicavel.

Arquivos sugeridos:

- `backend/tests/chat-widget-contract.test.ts`
- fixtures em `backend/tests/fixtures/`

Entrega:

- [x] teste de contrato criado.
- [x] fixtures do payload legado criadas.
- [x] script npm adicionado se necessario.

Criterio de aceite:

- testes passam sem acessar codigo do legado.

Notas:

- cobertura adicionada em `backend/tests/chat-intelligence.smoke.ts`.
- smoke tests subiram de 36 para 38.
- casos adicionados:
  - normalizacao de contratos publicos dos widgets e CORS.
  - reuso de `chatId` enviado pelo widget publico.
- nao foi criado script npm novo porque `npm run test:chat-intelligence:full --workspace backend` ja cobre os testes adicionados.
- validado com:
  - `npm run test:chat-intelligence:full --workspace backend`
  - `npm run build`

---

## Fase 5: Dominio temporario

Status: `bloqueado`

Objetivo:

- validar o v2 em ambiente parecido com producao antes de trocar o dominio principal.

Exemplo:

- `https://www.infrastudio.pro` quando apontar para o v2
- ou preview da Vercel.

Validar:

- widget renderiza.
- mensagem envia.
- resposta volta.
- chat persiste.
- conversa aparece no admin.
- projeto/agente/widget resolvem corretamente.
- sem erro de CORS.
- sem import/dependencia do legado.

Entrega:

- [ ] dominio temporario/preview online.
- [x] teste local em ambiente controlado.
- [x] evidencias/logs locais coletados.
- [x] baseline seguro do dominio oficial atual coletado sem POST.
- [x] pagina local de apoio criada para validar scripts.
- [x] script reutilizavel de validacao criado.

Criterio de aceite:

- 1 site controlado conversa ponta a ponta pelo v2.

Notas:

- pagina local criada em `/widget-contract-test`.
- a pagina `/widget-contract-test` agora possui teste interativo componentizado em `backend/components/widget-contract/widget-contract-test-client.js`.
- ela permite carregar `/chat.js` e `/chat-widget.js` contra o host atual sem editar codigo.
- script criado em `scripts/validate-widget-contract.ps1`.
- usar essa pagina como apoio para montar snippets reais com `https://www.infrastudio.pro`.
- usar o script para validar localhost, preview da Vercel ou dominio final:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\validate-widget-contract.ps1 -BaseUrl "https://preview-ou-dominio"
```

- para validar sem enviar mensagem real:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\validate-widget-contract.ps1 -BaseUrl "https://preview-ou-dominio" -SkipPost
```

- a conclusao desta fase ainda depende de ambiente online/preview ou DNS apontado para o v2.
- validacao local em `http://localhost:3010` concluida com widget real `nexo_leiloes`, projeto `nexo` e agente `agente-imovel`.
- script `scripts/validate-widget-contract.ps1` validado localmente em `http://localhost:3010`.
- `GET /chat.js`: 200.
- `GET /chat-widget.js`: 200.
- `OPTIONS /api/chat`: 204 com `Access-Control-Allow-Origin`.
- `OPTIONS /api/chat/config`: 204 com `Access-Control-Allow-Origin`.
- `GET /api/chat/config?projeto=nexo&agente=agente-imovel`: 200 com `ui`.
- `POST /api/chat` com `{ "message": "oi", "widgetSlug": "nexo_leiloes" }`: 200 com `chatId` e `reply`.
- baseline seguro em `https://www.infrastudio.pro` executado com `-SkipPost`:
  - `GET /chat.js`: 200.
  - `GET /chat-widget.js`: 200.
  - `OPTIONS /api/chat`: 204 com CORS.
  - `OPTIONS /api/chat/config`: 204 com CORS.
  - `GET /api/chat/config?projeto=nexo&agente=agente-imovel`: 200 com `projeto`, `agente` e `ui`.
- build local do backend passou.
- Vercel CLI esta disponivel, mas o projeto nao esta linkado localmente e `npx vercel whoami` nao retornou dentro do tempo esperado.
- bloqueio atual: falta URL de preview/Vercel do v2 para executar validacao online com POST.

---

## Fase 6: Logs, monitoramento e rollback

Status: `concluido`

Objetivo:

- conseguir diagnosticar rapidamente erro em cliente real.

Logs minimos:

- entrada em `/api/chat`.
- origem/host.
- `widgetSlug`.
- projeto resolvido.
- agente resolvido.
- `chatId`.
- tempo de resposta.
- erro de Supabase.
- erro de OpenAI.
- erro de CORS/origem.

Rollback:

- reduzir TTL do DNS antes do corte.
- manter dominio/servico legado online durante janela de transicao.
- manter banco preservado.
- nao deletar endpoints antigos no primeiro corte.

Entrega:

- [x] logs minimos revisados.
- [x] plano de rollback definido.
- [ ] TTL do DNS reduzido antes do corte.

Criterio de aceite:

- em caso de falha, e possivel identificar cliente/widget afetado e voltar o dominio.

Notas:

- helper de diagnostico criado em `backend/lib/chat/diagnostics.js`.
- `/api/chat` agora registra evento estruturado para sucesso, erro de validacao e falha.
- `/api/chat/config` agora registra evento estruturado para sucesso, erro de validacao, not found e falha.
- diagnostico nao registra conteudo da mensagem do cliente.
- campos registrados em `/api/chat`: origem, host, metodo, widgetSlug, projeto, agente, canal, source, presenca de chatId, presenca de anexos, status, chatId, tempo e erro.
- campos registrados em `/api/chat/config`: origem, host, projeto, agente, status, tempo e erro.
- rollback operacional definido: manter legado online durante janela de corte e reduzir TTL antes de apontar o dominio.
- pendencia externa: reduzir TTL do DNS antes da Fase 7.

---

## Marco: quando pode trocar o legado pelo v2

Status: `pronto localmente; pendente de preview/Vercel e DNS`

O dominio principal so deve ser apontado para o v2 quando todos os itens abaixo estiverem marcados.

Checklist obrigatorio:

- [x] Fase 1 concluida: contrato real do widget legado mapeado.
- [x] Fase 2 concluida: v2 aceita payload legado e payload novo.
- [x] Fase 3 concluida: script/config/assets carregam pelo v2.
- [x] Fase 4 concluida: testes de contrato passam sem codigo do legado.
- [ ] Fase 5 concluida: dominio temporario ou preview validado ponta a ponta.
- [x] Fase 6 concluida: logs e rollback prontos.
- [x] `npm run test:chat-intelligence:full --workspace backend` passou no backend.
- [x] `npm run build` passou no backend.
- [x] busca por imports do legado retornou zero resultado em codigo.
- [ ] pelo menos 1 site controlado conversou ponta a ponta pelo v2.
- [ ] pelo menos 2-3 clientes reais de baixo risco foram validados, se houver acesso.
- [ ] DNS com TTL reduzido antes da troca.
- [ ] legado ainda disponivel para rollback durante a janela de corte.

Responsavel pela etapa externa:

- troca da fonte do Git/deploy na Vercel: usuario.
- apontamento DNS e reducao de TTL: usuario.
- validacao online depois do preview: executar `scripts/validate-widget-contract.ps1`.

Decisao:

- se todos os itens estiverem concluídos, pode executar a Fase 7 e trocar o dominio principal.
- se qualquer item critico falhar, nao trocar o dominio ainda.

Criterio final:

- widgets existentes funcionam no v2 sem alteracao manual nos sites dos clientes.

---

## Fase 7: Corte controlado

Status: `pendente`

Ordem:

1. validar preview/dominio temporario.
2. testar 1 cliente controlado.
3. testar 2-3 clientes reais de baixo risco.
4. apontar dominio principal para o v2.
5. monitorar logs por algumas horas.

Entrega:

- [ ] primeiro cliente controlado validado.
- [ ] pequeno grupo real validado.
- [ ] dominio principal apontado.
- [ ] monitoramento pos-corte executado.

Criterio de aceite:

- widgets existentes continuam funcionando sem alteracao manual dos clientes.

Notas:

- preencher durante execucao.

---

## Fase 8: Pos-corte e limpeza

Status: `pendente`

Monitorar:

- volume de chamadas em `/api/chat`.
- erros 4xx/5xx.
- tempo medio de resposta.
- conversas sem agente.
- mensagens sem `chatId`.
- widgets invalidos.
- uso OpenAI.
- billing.

Limpeza depois de estabilizar:

- remover proxy temporario, se existir.
- remover compatibilidade morta.
- documentar contrato final do widget.
- padronizar script para novos clientes.

Entrega:

- [ ] janela de estabilidade concluida.
- [ ] contrato final documentado.
- [ ] limpeza planejada.

Criterio de aceite:

- v2 opera o dominio principal sem dependencia operacional do legado.

Notas:

- preencher durante execucao.

---

## Registro de execucao

Usar esta secao para atualizar progresso a cada entrega.

### 2026-04-11

- Plano criado.
- Fase 1 concluida: contrato real do widget legado inventariado.
- Fase 2 concluida: `/api/chat` aceita contratos publicos e CORS.
- Fase 3 concluida: `/chat.js`, `/chat-widget.js` e `/api/chat/config` disponiveis no v2.
- Fase 4 concluida: testes de contrato adicionados ao harness de chat.
- Validacao: `npm run test:chat-intelligence:full --workspace backend` passou com 38 smoke tests e 6 cenarios.
- Validacao: `npm run build` passou.
- Fase 5 em andamento: validacao local concluida em `http://localhost:3010`.
- Fase 6 concluida: diagnostico estruturado adicionado sem logar conteudo da mensagem.
- Validacao: `npm run test:chat-intelligence:full --workspace backend` passou com 39 smoke tests e 6 cenarios.
- Validacao: `npm run build` passou.
- Telas criticas do v2 concluidas: `/app`, agentes, APIs/conectores, widgets, WhatsApp, atendimento real e `/demo`.
- Busca por dependencia do legado em codigo retornou zero resultado.
- Proximo passo externo: usuario trocar a fonte do Git/deploy na Vercel e validar preview/dominio temporario antes do corte.
