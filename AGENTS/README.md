# AGENTS

Objetivo:

- manter a leitura rapida para o Codex
- evitar um `AGENTS.md` gigante
- separar contexto por assunto

Ordem recomendada de leitura:

1. `basico.md`
2. `chat-runtime.md` se a tarefa tocar IA/chat/widget
3. `runtime-intent-refactor.md` se a tarefa tocar orquestrador, intencao, billing, catalogo, API runtime ou qualquer regressao causada por heuristica
4. `laboratorio.md` se a tarefa exigir validacao/regressao
5. `roadmap.md` se a tarefa exigir continuidade
6. `melhorias.md` para ideias, backlog e operacao
7. `../ARQUITETURA-ALVO-CHAT-CANAIS-E-CATALOGO.md` se a tarefa envolver widget, WhatsApp, Mercado Livre, billing, catalogo ou arquitetura global do chat
8. `../EGRESS-BANCO-PLANO-CONTINUIDADE.md` se a tarefa envolver performance, egress, payload, consultas Supabase ou reducao de custo de banco
9. `../API-RUNTIME-PRESENTATION-PLANO.md` se a tarefa envolver API runtime, cards fora de catalogo, presentation, responseShape ou estabilizacao da renderizacao de respostas de API
10. Arquivos `../PLANO-*.md` quando a tarefa tocar uma etapa especifica ja planejada; eles detalham contexto, decisoes, pendencias e ordem de execucao de partes do projeto.

## Estado atual rapido

- a tela principal do projeto gira em torno do card do agente e de sheets laterais
- a aba Agente tem edicao de prompt/base, site, logo, conexoes, historico/rollback, JSON e botao `Copiar para LLM`
- o simulador do agente usa runtime real efemero: IA real, APIs reais, custo/token ativo e sem gravar `chats`/`mensagens`
- o projeto pode ter conexoes diretas com APIs, WhatsApp, Chat widget, Mercado Livre e Google Agenda
- Mercado Livre ja cobre OAuth, snapshot local de produtos, loja publica, pagina de produto, pedidos, perguntas, sugestao com IA, dashboard analitico e dominio proprio do cliente
- Google Agenda ja cobre OAuth, calendario selecionado, janela de atendimento, antecedencia minima, timezone, convite por email e criacao/remarcacao/cancelamento de eventos pelo runtime
- billing e por projeto; capacidade disponivel e limites devem ser verificados no snapshot de billing do projeto

## Regra critica para o cerebro do chat

- se a tarefa tocar intent, orquestracao, continuidade, catalogo, Mercado Livre, billing, agenda ou API runtime:
  - nao corrigir por heuristica textual
  - nao expandir regex, lista de frases, gatilhos por palavras ou excecoes manuais para "entender" o usuario
  - nao considerar aceitavel resolver variacao de linguagem por `if`, `includes`, regex ou match de frases
  - a direcao correta e sempre fortalecer estado, intent stage semantico estruturado e handler deterministico

Arquivos:

- [basico.md](C:\Projetos\infrastudio_v2\AGENTS\basico.md): regras base do workspace, stack e limites
- [chat-runtime.md](C:\Projetos\infrastudio_v2\AGENTS\chat-runtime.md): contrato, arquivos-chave e estado atual do cerebro
- [runtime-intent-refactor.md](C:\Projetos\infrastudio_v2\AGENTS\runtime-intent-refactor.md): arquivo de continuidade obrigatorio para reduzir heuristicas e migrar o runtime para estado + intent stage + handlers deterministas
- [laboratorio.md](C:\Projetos\infrastudio_v2\AGENTS\laboratorio.md): baseline, comandos, logs reais e pontos de falha mapeados no admin
- [roadmap.md](C:\Projetos\infrastudio_v2\AGENTS\roadmap.md): foco de retomada, backlog principal, bases entregues e ordem de ataque
- [melhorias.md](C:\Projetos\infrastudio_v2\AGENTS\melhorias.md): melhorias pendentes e oportunidades de produto/operacao
- [ARQUITETURA-ALVO-CHAT-CANAIS-E-CATALOGO.md](C:\Projetos\infrastudio_v2\ARQUITETURA-ALVO-CHAT-CANAIS-E-CATALOGO.md): visao arquitetural alvo do universo chat, widget, WhatsApp, Mercado Livre, billing e catalogo
- [EGRESS-BANCO-PLANO-CONTINUIDADE.md](C:\Projetos\infrastudio_v2\EGRESS-BANCO-PLANO-CONTINUIDADE.md): plano de continuidade para reduzir egress, payload e consultas desnecessarias
- [API-RUNTIME-PRESENTATION-PLANO.md](C:\Projetos\infrastudio_v2\API-RUNTIME-PRESENTATION-PLANO.md): plano de continuidade para separar `intentType`, `presentation`, `responseShape`, extracao de dados e renderizacao de respostas de API
- [API-RUNTIME-CONTEXTO-SAAS.md](C:\Projetos\infrastudio_v2\API-RUNTIME-CONTEXTO-SAAS.md): padrao SaaS para separar busca aberta e item atual por contexto do widget/API runtime

## Arquivos PLANO

Existem varios arquivos `PLANO-*.md` na raiz do projeto. Eles explicam detalhadamente etapas especificas, contexto de decisao, ordem sugerida, riscos e pendencias. Antes de mexer em uma area relacionada, procurar e ler o plano correspondente.

Planos conhecidos:

- [PLANO-API-RUNTIME-FOCO-CONTEXTO.md](C:\Projetos\infrastudio_v2\PLANO-API-RUNTIME-FOCO-CONTEXTO.md): foco/contexto do API runtime
- [PLANO-API-RUNTIME-MULTI-INTENT-LANCAMENTO.md](C:\Projetos\infrastudio_v2\PLANO-API-RUNTIME-MULTI-INTENT-LANCAMENTO.md): API runtime com multi-intencao e lancamento
- [PLANO-DASHBOARD-VENDAS-MERCADO-LIVRE.md](C:\Projetos\infrastudio_v2\PLANO-DASHBOARD-VENDAS-MERCADO-LIVRE.md): dashboard de vendas do Mercado Livre
- [PLANO-EVOLUCAO-AGENTE-ESTRUTURADO.md](C:\Projetos\infrastudio_v2\PLANO-EVOLUCAO-AGENTE-ESTRUTURADO.md): evolucao do agente estruturado
- [PLANO-GOOGLE-AGENDA.md](C:\Projetos\infrastudio_v2\PLANO-GOOGLE-AGENDA.md): integracao Google Agenda
- [PLANO-WHATSAPP-ATENDIMENTO-CONTINUIDADE.md](C:\Projetos\infrastudio_v2\PLANO-WHATSAPP-ATENDIMENTO-CONTINUIDADE.md): WhatsApp, atendimento e continuidade

## Loja real para teste

- existe uma base real de teste da loja Mercado Livre em `Projeto Vitoria Rocha`
- nome publico da loja: `Reliquias de Familia`
- o comando para preparar essa base automaticamente e devolver URLs prontas e:
  - `cd backend && npm run prepare:mercado-livre-test-store -- --query "Reliquia"`
- esse preparo deve:
  - localizar projeto/loja por nome ou slug, mesmo sem acento
  - garantir widget vinculado e ativo
  - garantir loja ativa
  - religar `chat_widget_id`
  - sincronizar snapshot
  - devolver URLs de loja, produto e widget contract

## Mercado Livre e dominio do cliente

- a loja publica fica em `/loja/{slug}`
- produto publico fica em `/loja/{slug}/produto/{produtoSlug}`
- configuracao comercial/visual da loja fica em `Mercado Livre > Loja`
- dominio proprio fica em `Mercado Livre > Loja > Dominio`
- DNS esperado no cliente:
  - registro `A` para `76.76.21.21`
  - `CNAME` de `www` para `cname.vercel-dns.com`
- backend relevante:
  - `backend/lib/mercado-livre-store.js`
  - `backend/lib/mercado-livre-store-core/`
  - `backend/app/api/app/projetos/[id]/conectores/mercado-livre/store/route.js`
  - `backend/app/api/app/projetos/[id]/conectores/mercado-livre/store/domain/route.js`

## Google Agenda

- painel fica em `Google Agenda`
- OAuth inicia em `/api/app/projetos/[id]/google-calendar/oauth/start`
- callback publico fica em `/api/google-calendar/oauth/callback`
- conexao salva calendario, conta, tokens criptografados, status e configuracoes
- runtime usa `backend/lib/chat/google-calendar-handler.js`
- lib principal fica em `backend/lib/google-calendar.js`
- tabelas relacionadas: `google_calendar_connections` e `google_calendar_events`
