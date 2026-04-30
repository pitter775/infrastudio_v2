# Billing Runtime Continuidade

Objetivo:

- estabilizar o fluxo de billing do chat sem voltar para heuristica textual
- eliminar respostas genericas de preco quando o cliente pede um fato especifico do plano
- garantir continuidade real de `esse plano`, `esse plus`, `nele`, `e esse`, etc

Este arquivo e o guia rapido para qualquer Codex que assumir essa frente.

## Regra principal

- nao corrigir billing com regex, `includes`, lista de frases ou excecoes manuais
- nao adicionar matcher textual para `quantos atende`, `cabe quantos`, `esse plano`, `plus`, `tem whatsapp`, etc
- a direcao correta e:
  - catalogo estruturado de planos
  - intent stage semantico estruturado
  - handler deterministico
  - contexto persistido de billing

## Estado atual

Ja foi entregue:

- `semantic-intent-stage` de billing cobre:
  - `pricing_overview`
  - `highest_priced_plan`
  - `lowest_priced_plan`
  - `plan_comparison`
  - `specific_plan_question`
  - `plan_limit_question`
  - `plan_feature_question`
- o stage agora pode devolver `targetField`:
  - `attendance_limit`
  - `agent_limit`
  - `credit_limit`
  - `whatsapp_included`
  - `support_level`
  - `price`
- existe um handler deterministico em:
  - `backend/lib/chat/billing-intent-handler.js`
- o contexto ja persiste:
  - `billing.planFocus`
  - `billing.lastIntent`
  - `billing.lastField`
- o metadata do turno agora publica:
  - `billingDiagnostics`
  - `billingContextUpdate`
- `pricingCatalog` do runtime aceita campos estruturados:
  - `slug`
  - `name`
  - `matchAny`
  - `priceLabel`
  - `attendanceLimit`
  - `agentLimit`
  - `creditLimit`
  - `whatsappIncluded`
  - `supportLevel`
  - `features`
  - `channels`
- `billingContextUpdate` nao apaga mais `planFocus` valido quando o turno atual e apenas overview generico ou comparacao ampla sem plano unico resolvido
- comparacao deterministica entre planos agora expõe tambem capacidade/canais/suporte quando esses campos existem no catalogo estruturado
- billing agora aceita `targetFields` estruturados para pergunta composta do mesmo plano
- billing agora tem um caminho deterministico inicial de recomendacao por criterio estruturado do catalogo
- billing agora persiste `comparisonFocus` e `lastFields` para follow-up apos comparacao sem repetir nomes de plano
- comparacao entre dois planos agora tambem pode responder por campos pedidos (`attendance_limit`, `agent_limit`, `credit_limit`, `whatsapp_included`, `support_level`, `price`) em vez de despejar so overview
- recomendacao agora tambem suporta mais de um criterio estruturado quando o stage devolver `targetFields`
- recomendacao aberta sem criterio explicito agora falha fechado de forma deterministica e pede prioridade objetiva antes de recomendar
- follow-up consultivo apos comparacao, como `qual vale mais a pena?`, agora reaproveita `comparisonFocus.fields` para decidir sem depender de repeticao textual
- quando faltar campo estruturado no catalogo real do agente, a resposta agora informa tambem quais campos ainda existem de forma estruturada naquele plano
- existe auditoria real pronta para banco:
  - `cd backend && npm run audit:pricing-catalog`
  - mede quantos agentes tem catalogo, quantos estao so com `priceLabel` e quais campos estruturados ainda faltam por agente

## Arquivos-chave

- `backend/lib/chat/orchestrator.js`
- `backend/lib/chat/semantic-intent-stage.js`
- `backend/lib/chat/billing-intent-handler.js`
- `backend/lib/chat/service.js`
- `backend/lib/agent-runtime-config.js`
- `backend/lib/public-planos.js`
- `backend/tests/chat-intelligence.smoke.ts`
- `AGENTS/runtime-intent-refactor.md`

## Onde ainda esta fragil

### 1. Catalogo de planos ainda esta incompleto na pratica

Hoje o fluxo so responde fato se o `pricingCatalog` tiver o campo estruturado real.

Exemplo:

- se o cliente perguntar `quantos atendimentos cabem no plano plus?`
- e o plano nao tiver `attendanceLimit`
- o runtime falha fechado

Isso e melhor que inventar, mas ainda gera erro funcional se o cadastro dos agentes nao estiver maduro.

Melhora aplicada:

- quando o campo pedido nao existe, a resposta agora tambem mostra os campos estruturados disponiveis naquele catalogo

### 2. Recomendacao ainda depende de criterio semantico suficientemente objetivo

Casos como:

- `qual plano voce recomenda?`
- `qual faz mais sentido pra mim?`

agora nao inventam resposta.

Mas a qualidade final ainda depende do `intent-stage` conseguir devolver:

- criterio principal quando existir
- ou deixar claro que a resposta precisa pedir desempatador

### 3. Continuidade de billing ainda depende do primeiro turno ter fixado foco

`esse plano` so funciona bem quando o turno anterior gerou `billingContextUpdate`.

Se o turno anterior cair em:

- overview generico
- resposta do modelo
- fluxo antigo fora do handler

o `planFocus` pode nao ficar forte o suficiente.

Melhora aplicada:

- overview generico sem plano unico nao limpa mais um foco valido de billing que ja vinha do contexto

### 4. O domain-router legado ainda pode sequestrar a conversa

Se o roteador antigo mandar a mensagem para:

- `catalog`
- `api_runtime`
- `agenda`
- `handoff`

o override semantico de billing nao assume.

Isso ainda deixa billing dependente de uma camada antiga demais.

### 5. Match de plano ainda esta rigido

Hoje o handler resolve plano por alias normalizado do catalogo.

Se o stage vier com nome levemente diferente do cadastrado em `matchAny`, pode perder o foco do plano.

Isso nao deve ser resolvido com heuristica textual espalhada.
Deve ser resolvido com:

- melhor contrato de alias do catalogo
- melhor prompt/classificacao do stage
- se necessario, normalizacao estruturada de alias dentro do dominio de billing apenas

### 6. Billing consultivo ainda nao cobre tudo

Casos ainda frageis:

- `quero gastar menos mas ter mais agentes`
- `vale a pena pagar a diferenca?`
- `se eu passar do limite no plus o que acontece?`

Hoje o handler ja cobre pergunta composta factual e follow-up consultivo pos-comparacao, mas ainda nao fecha toda camada consultiva aberta.

## Erros reais mais provaveis

Ao testar manualmente, priorizar estes cenarios:

1. `quantos atendimentos cabem no plano plus?`
2. `esse plano atende quantas pessoas?`
3. `o plus tem whatsapp?`
4. `qual a diferenca entre basic e plus?`
5. `qual o plano mais barato?`
6. `quero contratar o plus`
7. `se eu precisar de mais atendimentos, qual plano faz sentido?`
8. `qual plano voce recomenda?`
9. `qual vale mais a pena?` logo apos comparar dois planos
10. `esse plano suporta quantos agentes?`
11. `esse plano` logo apos uma resposta generica de overview
12. `plano plus` quando o `matchAny` do catalogo estiver pobre

## Ordem de ataque obrigatoria

### Etapa 1. Auditar dados estruturados reais

Antes de mexer mais no runtime:

- levantar quais agentes/projetos usam `runtimeConfig.pricingCatalog`
- medir quantos tem so `priceLabel`
- medir quantos ja tem:
  - `attendanceLimit`
  - `agentLimit`
  - `creditLimit`
  - `whatsappIncluded`

Se os dados nao existem, a IA nao vai salvar o fluxo.

### Etapa 2. Fortalecer o foco de billing

Objetivo:

- `specific_plan_question`
- `plan_limit_question`
- `plan_feature_question`
- `plan_comparison`

devem sempre alimentar `billing.planFocus` quando houver plano resolvido.

Tambem revisar se `pricing_overview` deve ou nao atualizar foco:

- se houver um unico plano citado pelo cliente, sim
- se for tabela geral, nao

### Etapa 3. Reduzir dependencia do roteador legado

Billing precisa depender menos do `domain-router`.

Direcao:

- deixar o `intent-stage` de billing como decisor primario sempre que existir `pricingCatalog`
- rebaixar o roteador para guardrail auxiliar
- nao deixar palavra generica do catalogo ou de API roubar pergunta factual de billing

### Etapa 4. Suportar perguntas compostas

Sem transformar em heuristica textual.

Possiveis caminhos corretos:

- permitir que o stage devolva mais de um `targetField`
- ou dividir em resposta principal + complemento deterministico

Exemplo desejado:

- `No plano Plus, WhatsApp: Sim.`
- `Ele tambem comporta 250 atendimentos.`

### Etapa 5. Recommendation / recommendation handler

Ja existe uma base deterministica inicial para:

- `se eu precisar de mais atendimentos, qual plano faz sentido?`
- `qual faz mais sentido se eu quiser menos preco?`
- `qual plano voce recomenda` quando o stage trouxer o criterio estruturado

Ainda falta amadurecer para:

- `qual plano voce me recomenda?`
- `qual faz mais sentido pra mim?`
- cenarios com mais de um criterio ao mesmo tempo
- pedidos consultivos sem criterio objetivo suficiente no stage

Isso continua sem chute do modelo.
A regra precisa sair do intent estruturado + catalogo real.

## O que nao fazer

- nao adicionar regex para `quantas pessoas`, `quantos atendimentos`, `cabe`, `suporta`, `tem whatsapp`
- nao adicionar `if` por nome de plano
- nao jogar pergunta factual de billing no modelo geral so para "desenrolar"
- nao responder tabela de valores quando o slot pedido nao foi encontrado
- nao reintroduzir CTA comercial cedo em micropergunta factual

## Critérios de aceite

Uma entrega nessa frente so esta aceitavel quando:

1. pergunta factual de billing responde o campo certo ou falha fechado
2. `esse plano` funciona com contexto persistido entre turnos
3. overview de precos nao atropela pergunta de capacidade
4. billing nao depende de regex nova
5. smoke test cobre os casos novos
6. `AGENTS/runtime-intent-refactor.md` e este arquivo sao atualizados

## Testes minimos obrigatorios

Rodar no `backend/`:

- `npm run test:chat-intelligence`

Adicionar/validar cenarios para:

- pergunta factual de `attendanceLimit`
- pergunta factual de `agentLimit`
- pergunta factual de `whatsappIncluded`
- continuidade por `esse plano`
- falha fechada sem campo estruturado
- comparacao entre dois planos com campo estruturado

## Proximo passo recomendado agora

1. rodar `cd backend && npm run audit:pricing-catalog` e transformar os agentes mais fracos em backlog de preenchimento estrutural
2. revisar onde o primeiro turno de billing ainda cai fora do handler estruturado
3. amadurecer recomendacao para criterios subjetivos quando o cliente nao explicita o eixo
4. revisar follow-up tipo `e qual vale mais a pena?` logo apos comparacao multi-slot

## Resumo curto

O problema principal agora nao e mais "entender a frase".
O problema principal e:

- dados de plano insuficientes
- foco de billing ainda fragil entre turnos
- dependencia residual do roteador legado

Qualquer Codex que pegar essa frente deve continuar daqui, sem voltar para heuristica textual.
