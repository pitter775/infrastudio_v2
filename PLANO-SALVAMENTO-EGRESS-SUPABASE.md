# Plano de Salvamento de Egress Supabase

Contexto:

- plano atual com limite mensal de `5 GB` de egress
- uso observado em 1 dia chegando perto de `1.35 GB`
- isso indica vazamento estrutural de trafego e nao apenas pico normal
- se continuar assim, o projeto fica inviavel no plano atual

Objetivo:

- descobrir exatamente de onde sai o trafego
- cortar desperdicio imediatamente
- reduzir payload, frequencia e repeticao
- impedir regressao futura com checklist e monitoramento

## 1. Meta de guerra

Meta inicial dos proximos dias:

- derrubar o consumo diario para menos de `100 MB/dia`
- mapear top 10 rotas/fluxos que mais consomem egress
- remover polling inutil
- parar envio de historico completo e blobs/base64 desnecessarios
- limitar consultas e respostas em todas as telas sensiveis

## 2. Hipoteses mais provaveis

Fontes mais provaveis do problema:

- frontend fazendo `fetch` repetido por `render`, `useEffect` sem dependencia correta ou refresh em cascata
- polling frequente sem backoff, sem pausa em aba oculta e sem condicao de parada
- telas do admin carregando listas completas em vez de paginas/limites
- chat carregando historico inteiro varias vezes
- payloads grandes com `base64`, QR, anexos, logs ou JSON bruto
- endpoints retornando colunas demais
- consultas repetidas na mesma tela sem cache local ou memoizacao de estado
- worker/status de WhatsApp sendo consultado muitas vezes
- testes/laboratorio rodando repetidamente com payload pesado
- realtime/websocket trocando dado demais quando bastaria evento pequeno
- SSR/server components refazendo busca a cada navegacao sem reaproveitamento
- imagens/arquivos servidos via storage sem cache adequado

## 3. Fase 1: conter hoje

Essas acoes sao de emergencia e devem entrar antes de investigacao profunda:

1. reduzir polling agressivo
   - aumentar intervalos
   - parar polling em aba invisivel
   - parar polling quando status estiver estavel
   - usar backoff progressivo em erro e inatividade

2. cortar payload grande de endpoints criticos
   - remover campos nao usados
   - nunca devolver `session_data` inteiro se a tela usa 3 ou 4 campos
   - nao devolver historico inteiro de chat por padrao
   - nao devolver QR/base64 se nao estiver explicitamente necessario

3. colocar `limit` em toda listagem
   - chats
   - mensagens
   - logs
   - contatos
   - eventos
   - feedbacks
   - tabelas administrativas

4. revisar telas com refresh automatico
   - admin atendimento
   - WhatsApp manager
   - laboratorio
   - dashboard
   - chat widget

5. desligar temporariamente qualquer teste automatico pesado em producao
   - laboratorio com replay
   - cenarios de teste com payloads completos
   - verificacoes que disparam multiplas consultas por clique

## 4. Fase 2: auditoria tecnica completa

Abrir uma frente de auditoria por camadas.

### 4.1 Frontend

Checklist:

- localizar todos os `useEffect` que fazem `fetch`
- localizar `setInterval`, `setTimeout` recursivo e polling manual
- localizar chamadas repetidas em `router.refresh()`
- localizar telas que recarregam ao trocar tab, sheet, modal ou detalhe
- identificar componentes que desmontam/remontam e buscam tudo de novo
- revisar dependencias de hooks para evitar loop
- validar se existe deduplicacao de requests
- validar se existe cache local de resposta
- validar se a mesma tela chama `GET` de lista e depois `GET` individual em cascata sem necessidade

O que procurar:

- request a cada render
- request a cada foco
- request a cada troca de estado cosmética
- request duplicada ao abrir painel
- request por item de lista
- `Promise.all` exagerado para dados secundarios

### 4.2 Backend / rotas

Checklist:

- listar endpoints mais chamados
- medir tamanho medio de resposta por endpoint
- revisar `select *`
- revisar joins que trazem JSON demais
- separar endpoint leve de status e endpoint pesado de detalhe
- evitar retornar blobs, logs e historicos em resposta principal
- revisar respostas de admin e debug

Perguntas obrigatorias por rota:

- esse endpoint retorna so o necessario?
- existe limite, cursor ou pagina?
- existe resposta resumida para listagem?
- existe campo grande inutil sendo enviado?
- esse endpoint esta sendo chamado mais vezes do que deveria?

### 4.3 Chat / WhatsApp

Checklist:

- revisar envio e leitura do historico de mensagens
- garantir que widget e admin busquem apenas ultimas N mensagens
- evitar reenviar contexto inteiro sempre
- resumir memoria e contexto em vez de trafegar tudo
- nao trafegar anexos/base64 quando um `signed URL` resolver
- revisar polling de QR/status do WhatsApp
- separar status curto de snapshot completo
- nao pedir snapshot completa quando so precisa saber `connected/offline`

### 4.4 Supabase

Checklist:

- revisar tabelas com linhas grandes em JSON
- revisar uso de storage e arquivos publicos
- revisar realtime habilitado onde nao precisa
- revisar consultas de dashboard/admin puxando muito dado
- revisar se o gargalo e Database egress, Storage egress ou Realtime
- revisar logs do Supabase por rota mais acionada

## 5. Fase 3: instrumentacao obrigatoria

Sem medir, vamos continuar no escuro.

Criar instrumentacao por request:

- rota
- tamanho aproximado da resposta
- tempo
- usuario/projeto
- tela/origem quando possivel
- contagem por minuto

Registrar pelo menos:

- top endpoints por volume
- top endpoints por frequencia
- top projetos/usuarios por consumo
- top telas por repeticao

Implementacao minima:

1. middleware/helper para logar resposta estimada de APIs criticas
2. contador simples por endpoint em memoria + flush para log
3. log especifico para polling
4. flag para identificar requests de widget, admin, laboratorio e WhatsApp

## 6. Fase 4: correcoes por prioridade

### Prioridade P0

- polling sem controle
- `fetch` por render
- respostas com base64 grande
- historico completo de chat
- endpoints sem `limit`
- refresh repetido em modais e sheets

### Prioridade P1

- falta de cache em tela aberta
- falta de reaproveitamento entre tabs
- busca duplicada ao abrir detalhe
- painis administrativos puxando tudo
- realtime onde polling curto resolveria melhor ou vice-versa

### Prioridade P2

- refatoracao de payloads
- endpoints de resumo
- cache local/in-memory por sessao
- compressao/normalizacao de respostas
- limpeza de campos JSON enormes

## 7. Acoes concretas por area

### 7.1 Atendimento / chats

- carregar so ultimas `20` ou `50` mensagens
- usar paginacao reversa para historico antigo
- separar lista de conversas de detalhe da conversa
- nao recalcular resumo completo a cada refresh
- evitar polling quando conversa nao esta aberta

### 7.2 WhatsApp

- status leve com payload minimo
- snapshot completa so quando QR ou erro exigir
- parar polling quando conectado
- backoff quando sem QR
- nao devolver QR/base64 em `listagem`
- persistir status estavel e reaproveitar o persistido

### 7.3 Admin / dashboards

- cards com dados agregados, nao listas completas
- abrir sheet sem refazer tudo
- cache de tela durante a sessao
- evitar `router.refresh()` global quando so uma secao mudou

### 7.4 Widget

- nao sincronizar historico inteiro
- limitar mensagens
- parar sync quando widget fechado
- reduzir frequencia
- nao pedir config repetidamente sem necessidade

### 7.5 Laboratorio e testes

- desabilitar auto-repeat
- limitar payload salvo
- nao trafegar dumps completos na UI principal
- baixar detalhe sob demanda

## 8. Regras novas do projeto

Virar regra obrigatoria:

1. toda listagem precisa de `limit`
2. toda tela com auto refresh precisa de backoff e pausa em aba oculta
3. toda resposta grande precisa de justificativa
4. proibido retornar `select *` em rotas de UI
5. JSON/base64 grande so sob demanda
6. historico completo apenas com paginacao
7. abrir modal/sheet nao pode disparar cascata de requests desnecessaria
8. testes de laboratorio devem ter modo leve por padrao

## 9. Ordem de ataque recomendada

Dia 1:

- mapear polling e auto refresh
- mapear endpoints grandes
- cortar payloads obvios
- colocar limites nas listagens principais

Dia 2:

- atacar chat e WhatsApp
- separar status leve de detalhe pesado
- revisar atendimento/admin

Dia 3:

- instrumentar tamanho/frequencia por endpoint
- revisar laboratorio, logs e dumps
- validar queda real no painel do Supabase

Dia 4 em diante:

- refinar cache
- criar guideline permanente
- fechar regressao com checklist de PR

## 10. Checklist de investigacao pratica

Executar para cada tela critica:

1. abrir DevTools Network
2. navegar sem interagir por 2 minutos
3. anotar requests repetidas
4. ordenar por tamanho
5. ordenar por quantidade
6. abrir payload/resposta
7. marcar se e necessario, duplicado ou exagerado
8. corrigir
9. repetir medicao

## 11. Suspeitos iniciais deste projeto

Com base no que ja vimos no workspace, eu atacaria primeiro:

- `backend/components/app/whatsapp/whatsapp-manager.js`
- `backend/components/admin/attendance/attendance-page.js`
- `backend/public/chat-widget.js`
- rotas `/api/app/projetos/[id]/whatsapp*`
- rotas de chat e sincronizacao de mensagens
- telas de laboratorio
- qualquer endpoint que devolva `session_data`, logs, dumps ou historico inteiro

## 12. Entregaveis desta frente

Precisamos sair com:

- mapa de consumo por tela/endpoint
- lista priorizada de desperdicios
- pacote de correcoes P0
- pacote de correcoes P1
- regra permanente anti-egress no projeto
- comparativo antes/depois no Supabase

## 13. Definicao de sucesso

Vamos considerar controlado quando:

- uso diario ficar previsivel
- nenhum fluxo sozinho consumir centenas de MB por dia
- polling pesado deixar de existir
- respostas grandes virarem excecao
- o painel do Supabase mostrar queda clara por varios dias seguidos

## 14. Observacao final

Isso nao parece problema isolado de banco.

Parece combinacao de:

- excesso de leituras
- payload grande
- repeticao de requests
- falta de cache/reaproveitamento
- fluxos de status/chat/WhatsApp consumindo mais do que deveriam

O caminho correto e:

- medir
- cortar desperdicio imediato
- corrigir arquitetura de fetch e polling
- proteger contra regressao

## 15. Leitura do Security Advisor do Supabase

O print do Supabase ajuda, mas de forma indireta.

O que aparece:

- varios itens `RLS Enabled No Policy`
- tabelas com RLS ligado, mas sem policy definida

Isso significa:

- e um problema real de seguranca/governanca
- nao explica sozinho o pico de egress observado
- mas entra no plano porque pode mascarar arquitetura ruim e abrir caminho para consultas indevidas no futuro

Leitura pragmatica:

- se o app usa majoritariamente `supabase admin client` no backend, o egress principal continua vindo das consultas/respostas pesadas e repetidas
- `RLS Enabled No Policy` nao costuma ser o motivo de gastar centenas de MB em um dia por si so
- porem indica que a modelagem de acesso no banco ainda esta frouxa e precisa ser saneada

Resumo:

- para o problema de custo/egress, a causa principal continua sendo excesso de leitura, polling, payload grande e repeticao
- para o problema de seguranca, o Advisor mostrou uma frente paralela obrigatoria

## 16. Como isso entra no plano

Adicionar uma trilha separada de endurecimento do banco.

### 16.1 Trilha de seguranca/RLS

Passos:

1. inventariar todas as tabelas apontadas pelo Advisor
2. classificar por uso:
   - leitura publica
   - leitura autenticada
   - escrita autenticada
   - backend only
3. definir quais tabelas realmente precisam de RLS
4. para cada tabela com RLS ativo sem policy:
   - criar policy minima correta
   - ou desligar RLS se a tabela for backend only e sempre acessada por service role
5. revisar se existe algum acesso client-side direto ao Supabase nessas tabelas

Objetivo:

- reduzir superficie de risco
- impedir consulta indevida
- deixar claro o que e trafego legitimo e o que seria anomalia

### 16.2 Tabelas sensiveis que apareceram no print

Pelo print, merecem prioridade:

- `public.canais_whatsapp`
- `public.chat_handoffs`
- `public.chat_handoff_eventos`
- `public.chat_widgets`
- `public.agentes`
- `public.apis`
- `public.agente_arquivos`
- `public.agente_versoes`
- `public.agenda_horarios`
- `public.agenda_reservas`

Essas tabelas:

- tem dado operacional
- algumas tem potencial de payload grande em JSON
- varias sao candidatas a acesso exclusivamente backend

### 16.3 Regra operacional nova

Antes de manter RLS ativo:

- confirmar se a tabela precisa mesmo de acesso client-side

Se nao precisa:

- backend only
- acesso apenas por API propria
- response enxuta
- sem expor tabela direto ao cliente

Se precisa:

- policy minima
- colunas minimas expostas por rota
- paginacao e limite obrigatorios

## 17. Conclusao sobre o print do Supabase

O print ajuda em duas coisas:

1. confirma que o banco precisa de endurecimento
2. reforca que precisamos mapear exatamente quais tabelas sao acessadas pelo cliente e quais devem ficar so no backend

Mas ele nao muda o diagnostico principal do egress:

- o consumo alto continua muito mais compativel com polling, listagens pesadas, historico completo, base64 e respostas grandes repetidas

Entao a ordem correta continua:

- primeiro cortar egress P0
- em paralelo abrir a trilha de RLS/policies
- depois fechar exposicoes desnecessarias de tabela

## 18. Progresso executado nesta frente

Ja entrou no codigo:

- atendimento admin com lista leve e detalhe sob demanda
- polling do atendimento reduzido e pausado em aba oculta
- `GET /api/chat` limitado por padrao
- widget publico com sync menos frequente e historico local curto
- sincronizacao do titulo do widget corrigida para usar configuracao cadastrada

Novo corte feito agora:

- `chat_handoffs` do atendimento saiu de consulta por conversa para carga em lote
- detalhe da conversa admin deixou de buscar chats um por um e passou a carregar em lote
- preview de ultima mensagem do atendimento saiu de `N` consultas por chat para busca em lote
- listagem do WhatsApp parou de consultar o worker por padrao em toda abertura de painel
- snapshot do worker agora fica sob demanda via `?refresh=1`
- polling de conexao/QR do WhatsApp passou a usar refresh explicito e respeitar aba oculta
- laboratorio deixou de recarregar a lista de payload dumps a cada filtro/refresh e caiu para `50` logs por carga
- laboratorio passou a usar leitura compacta dos logs, sem puxar payload completo na listagem principal
- paginas de agenda, notificacoes e laboratorio tiveram carregamentos ajustados para reduzir risco de refetch acidental por hook instavel
- atendimento passou a limitar anexos do composer a `5` arquivos de ate `2 MB` cada, reduzindo pico de payload base64 no admin
- painel do Mercado Livre deixou de disparar cargas duplicadas ao trocar de aba
- callbacks de carregamento do WhatsApp ficaram estabilizados para reduzir risco de loop/refetch indireto
- `widget-manager` passou a reaproveitar os widgets ja entregues no payload inicial do projeto, evitando `fetch` extra ao abrir o painel quando os dados ja estao em memoria
- `chat-demo`, `project-agent-panel`, `agent-editor` e `widget-manager` tiveram hooks estabilizados para remover refetch/efeitos dependentes de callbacks instaveis

Impacto esperado:

- menos trafego backend -> Supabase na central de atendimento
- menos trafego backend -> worker do WhatsApp em painel aberto
- menos requests duplicadas no laboratorio
- menos egress de JSON pesado na listagem de logs
- menos pico de payload por anexo no atendimento
- menos respostas pesadas e menos repeticao de leitura

## 19. Estimativa de melhora ate agora

Sem medir ainda por endpoint no painel do Supabase apos alguns dias, isso continua sendo estimativa e nao numero fechado.

Faixa pragmatica com o que ja cortamos:

- melhora nos fluxos atacados diretamente: algo entre `50%` e `70%`
- melhora geral provavel do projeto hoje: algo entre `35%` e `55%`

Base dessa estimativa:

- central de atendimento era um dos maiores suspeitos e foi bastante enxugada
- widget publico ficou mais leve, menos frequente e com historico curto
- WhatsApp parou de consultar snapshot/worker completo sem necessidade
- laboratorio deixou de trafegar payload pesado na listagem principal
- varias cargas duplicadas por hook/tab foram removidas

Validacao correta:

- acompanhar `1` a `3` dias no painel do Supabase
- comparar dias equivalentes de uso real
- depois recalibrar a meta e apontar o proximo gargalo real

## 20. Proximo alvo imediato

Os maiores suspeitos restantes agora sao:

- laboratorio admin
- instrumentacao real de tamanho/frequencia por endpoint para sair de estimativa e entrar em medicao
- anexos/base64 que ainda nao migraram para upload direto ou `signed URL`
- imagens servidas sem otimizacao em pontos quentes do admin/chat

Proxima etapa recomendada:

1. instrumentar endpoints criticos com contagem e tamanho aproximado de resposta
2. revisar queries das rotas mais chamadas com base na telemetria gerada
3. depois da migracao para storage, atacar anexos/base64 e imagens

## 21. Regra temporaria definida agora

Imagens e `base64` nao serao atacados nesta rodada.

Motivo:

- a intencao e migrar esse fluxo para storage dedicado
- mexer agora poderia gerar retrabalho

Ate a migracao:

- manter limites atuais
- evitar expandir payload desses fluxos
- concentrar esforco em query otimizada, polling, cache e instrumentacao

## 22. Instrumentacao ja iniciada

Entrou uma primeira camada leve de medicao em memoria no backend.

Cobertura inicial:

- `/api/admin/conversations`
- `/api/admin/conversations/[id]/messages`
- `/api/admin/laboratorio`
- `/api/app/projetos/[id]/whatsapp`
- `/api/chat`

O que esta sendo medido:

- rota
- metodo
- status
- tempo
- tamanho aproximado do JSON de resposta
- contagem acumulada por rota/status

Objetivo:

- identificar rapidamente quais rotas ainda concentram volume e repeticao
- usar isso para guiar a revisao fina de query e payload
