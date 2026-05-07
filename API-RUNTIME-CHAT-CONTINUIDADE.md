# API Runtime no Chat - Continuidade

Arquivo de continuidade para o próximo Codex retomar o ajuste do runtime de APIs no chat.

## Contexto do problema

Estamos tentando fazer o agente usar APIs cadastradas no projeto para responder no Chat Widget real.

Caso principal:

- Home / busca aberta:
  - `GET https://nexo-imoveis.vercel.app/api/imoveis/busca?titulo={titulo}`
  - tipo: `Busca de catálogo`
  - escopo: `Busca aberta`
  - campo obrigatório: `titulo`
  - exemplo do usuário: `TRAGA O IMOVEL EDIFICIO VILLA`
- Tela paga / imóvel específico:
  - `GET https://nexo-imoveis.vercel.app/api/imoveis/{id}`
  - tipo: `Consulta por identificador`
  - escopo: `Item atual`
  - campo obrigatório: `id`
  - contexto esperado no widget:
    ```json
    {
      "propertyId": "c47ae17f-ddbe-4c59-96b9-30e6d12c5ff2"
    }
    ```

O usuário quer usar um projeto e um agente, com APIs diferentes aparecendo conforme o contexto. Não criar dois projetos.

## Estado atual

- [x] API editor tem `Tipo de intenção`.
- [x] API editor tem `Escopo de uso`: `Sempre disponível`, `Busca aberta`, `Item atual`.
- [x] `loadAgentRuntimeApis` filtra APIs por `runtime.availabilityScope`.
- [x] API `Item atual` fica invisível quando não há `id/propertyId` no contexto.
- [x] API `Busca aberta` fica invisível quando há item atual no contexto.
- [x] Campo de teste da API foi renomeado para `Variáveis apenas para o botão Send`.
- [x] Texto explica que esse campo não altera o contexto do chat.
- [x] Chat Widget real de teste no admin ganhou painel local de contexto.
- [x] Existe ajuste local para botão `Usar no teste do chat` em API `Item atual`, que envia o JSON do Send para o simulador.
- [x] Dropdowns de `Tipo de intenção` e `Escopo de uso` tiveram bug de fechar corrigido.
- [x] Tooltips foram movidos para hover, sem botão `?`.
- [x] API runtime de catálogo agora monta `assets` para o widget renderizar card de produto.
- [x] Widget aceita card de API runtime mesmo quando não existe imagem/link público.
- [x] WhatsApp também reconhece produto de API runtime sem link, desde que tenha texto/descrição/preço para enviar.
- [x] Busca de API runtime passa a persistir `ultimaBusca` no contexto catalogal a partir dos parâmetros extraídos.

## Commits recentes relevantes

- `735b665 scope runtime apis by context`
- `54e68a6 refine api runtime help controls`
- `868aca1 add test chat context controls`

Há alterações locais depois do `868aca1`:

- `backend/components/app/agents/agent-simulator.js`
- `backend/components/app/apis/api-sheet-manager.js`
- `backend/lib/chat/api-runtime.js`
- `backend/lib/chat/orchestrator.js`
- `backend/public/chat-widget.js`
- `API-RUNTIME-CHAT-CONTINUIDADE.md`

Essas alterações locais adicionam:

- evento `infrastudio-agent-test:set-context`
- botão `Usar no teste do chat`
- envio do JSON de teste para o Chat Widget real
- card/asset para resultado de API runtime de catálogo

Antes de mexer, rode:

```bash
git status --short --branch
```

## Diagnóstico atual

Pela imagem enviada pelo usuário:

- API `Buscar imóveis` está configurada como:
  - `Busca de catálogo`
  - `Busca aberta`
  - URL com `{titulo}`
  - descrição boa
- Chat responde:
  - `Não tenho informações sobre o imóvel...`
- Isso indica que o chat provavelmente não executou a API, não aproveitou a resposta, ou executou sem gerar card.
- O botão `Send` da API e o Chat Widget real ainda são experiências separadas.
- O campo `Variáveis apenas para o botão Send` não prova que o chat usa a API.

## Hipóteses técnicas principais

- [x] Se o classificador semântico retornar `other`/baixa confiança, existe fallback local fechado para exatamente uma API `catalog_search` com um único parâmetro ausente.
- [ ] `semanticApiDecision` pode estar vindo `null`, então `buildApiRoutingOverride` não entra em `api_runtime`.
   - [x] Mesmo com `api_catalog_search`, `parameterValues` pode não estar extraindo `titulo`; fallback fechado cobre API única com parâmetro único e o badge `API` mostra o valor extraído.
- [x] Mesmo executando a API, o runtime de API retornava texto/metadata, mas não gerava assets/cards para o widget.
- [x] O diagnóstico de API runtime aparece no teste do chat como badge `API` com tooltip técnico.

## Arquivos-chave

- `backend/lib/apis.js`
  - `loadAgentRuntimeApis`
  - `fetchApiPreview`
  - `resolveRuntimeApiUrl`
  - `extractConfiguredRuntimeFields`
  - filtro por `runtime.availabilityScope`
- `backend/lib/chat/orchestrator.js`
  - `classifySemanticApiIntentStage`
  - `buildApiDecisionFromSemanticIntent`
  - `reloadRuntimeApisWithSemanticParameters`
  - `buildApiRoutingOverride`
  - retorno do bloco `api_runtime`
- `backend/lib/chat/semantic-intent-stage.js`
  - schema e prompt do classificador de API
- `backend/lib/chat/api-runtime.js`
  - `extractApiCatalogProducts`
  - `buildApiCatalogSearchState`
  - `buildApiCatalogAssets`
  - `resolveApiCatalogReplyResolution`
- `backend/lib/chat/service.js`
  - persistência de contexto
  - `assets`
  - montagem final de resposta
- `backend/lib/chat/reply-formatting.js`
  - montagem de sequência de mensagens para WhatsApp
  - reconhecimento de produto `api_runtime`
- `backend/public/chat-widget.js`
  - renderização de cards/assets
- `backend/components/app/agents/agent-simulator.js`
  - teste do Chat Widget real
- `backend/components/app/apis/api-sheet-manager.js`
  - editor/teste de API

## Plano de ataque recomendado

1. Diagnóstico visível no teste do chat
   - [x] Exibir no teste, via tooltip do badge `API`:
     - APIs runtime carregadas
     - APIs filtradas por escopo
     - intenção semântica de API
     - API selecionada
     - parâmetros extraídos
     - missing params
     - status da execução
   - [x] Usar diagnostics já existentes:
     - `apiRuntimeDiagnostics`
     - `semanticIntent`
     - `routingDecision`

2. Confirmar execução real da API de busca
   - [x] Cobrir em smoke test a mensagem: `TRAGA O IMOVEL EDIFICIO VILLA`
   - [ ] Confirmar se `semanticApiDecision.kind === "api_catalog_search"`.
   - [x] O diagnóstico visível permite confirmar se `parameterValues.titulo === "EDIFICIO VILLA"`.
   - [x] Confirmar em teste automatizado se `loadAgentRuntimeApis` recarrega a API com contexto enriquecido.
   - [x] Confirmar em teste automatizado se a URL final vira:
     - `https://nexo-imoveis.vercel.app/api/imoveis/busca?titulo=EDIFICIO%20VILLA`

3. Tornar busca aberta mais determinística
   - [x] Se houver exatamente uma API ativa `catalog_search` com um único parâmetro ausente, permitir execução por fallback local fechado quando o semantic stage não resolver.
   - [x] O fallback só roda com sinal catalogal mínimo e API única, sem disputar entre múltiplas APIs.
   - [ ] Evitar heurística textual espalhada, conforme `AGENTS/runtime-intent-refactor.md`.

4. Gerar cards para API runtime de catálogo
   - [x] Criar assets a partir dos produtos extraídos em `extractApiCatalogProducts`.
   - [x] Esses assets entram em `assets` na resposta final do chat.
   - [x] Reaproveitar formato de asset aceito pelo widget para API product.
   - [x] Verificar renderização do widget para cards sem imagem/link.
   - [x] Card contém pelo menos título, descrição, preço/valor quando existir, cidade/endereço quando existir e id.
   - [x] WhatsApp reconhece produto de API runtime mesmo sem `targetUrl`.

5. Melhorar copy/UX do editor
   - [x] Para `Busca aberta`, sugerir `{"titulo":"EDIFICIO VILLA"}` no campo Send, não UUID.
   - [x] Para `Item atual`, sugerir `{"id":"..."}`.
   - [x] Adicionar botão `Preencher exemplo` para evitar JSON errado no teste manual.
   - [x] Botão `Usar no teste do chat` aparece apenas para `Item atual`.
   - [x] Deixar claro quando o teste do chat precisa ser recarregado.

6. Validar fluxo de item atual
   - [ ] Abrir teste do chat.
   - [ ] Aplicar contexto:
     ```json
     {
       "propertyId": "c47ae17f-ddbe-4c59-96b9-30e6d12c5ff2"
     }
     ```
   - [ ] Confirmar que API `Item atual` aparece e `Busca aberta` não concorre.
   - [ ] Confirmar que `/api/imoveis/{id}` executa.

7. Validar fluxo de home
   - [ ] Sem contexto `propertyId`.
   - [ ] Confirmar que API `Busca aberta` aparece e `Item atual` não concorre.
   - [ ] Enviar: `TRAGA O IMOVEL EDIFICIO VILLA`.
   - [ ] Esperado:
     - API executada
     - resposta com dados reais
     - card no widget

## Critério de pronto

- [ ] Usuário consegue testar busca aberta no Chat Widget real do admin sem preencher contexto.
- [ ] Usuário consegue testar item atual informando `propertyId` no painel de contexto do teste.
- [x] Resposta do chat não cai em fallback genérico quando a API retorna dados, coberto por smoke test do orquestrador.
- [x] Widget renderiza card para resultado de API de catálogo, coberto por contrato de asset e build.
- [x] Diagnóstico deixa claro por que a API foi ou não foi usada.
- [x] Lint passa nos arquivos alterados.
- [x] Build de produção passa.
- [x] Smoke test de inteligência do chat passa.
- [ ] Push somente se o usuário pedir.

## Comandos úteis

```bash
cd backend
npx eslint components/app/agents/agent-simulator.js components/app/apis/api-sheet-manager.js lib/apis.js lib/chat/orchestrator.js lib/chat/semantic-intent-stage.js lib/chat/api-runtime.js lib/chat/service.js public/chat-widget.js
```

## Observações importantes

- Não resolver com regex ampla ou lista de frases.
- Não criar estrutura paralela.
- Não duplicar componente/utilitário existente.
- Textos visíveis em português correto.
- Não mexer em `database/geral-schema.sql`.
- Só fazer push se o usuário pedir.
