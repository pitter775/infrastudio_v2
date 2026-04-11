# Plano de Migracao InfraStudio para o v2

## Objetivo

Este documento define a ordem mais segura para absorver a inteligencia, dados, fluxos e telas do projeto legado `C:\Projetos\infrastudio` para `C:\Projetos\infrastudio_v2`, sem copiar a estrutura antiga de forma cega.

Regra principal desta migracao:

- migrar funcionamento antes de refinamento visual
- reaproveitar banco, dados e `.env.local` do legado quando fizer sentido
- nao copiar telas para lugares errados so para ganhar velocidade
- toda tela nova no `v2` deve respeitar `C:\Projetos\infrastudio_v2\AGENTS.md`
- mock nao e destino final; mock e referencia visual/fluxo para a nova area logada

## Decisao de produto e arquitetura

O `infrastudio_v2` precisa nascer com 3 ambientes bem definidos:

1. site publico
2. ambiente do usuario logado
3. ambiente admin

Decisao recomendada:

- manter o `backend/` do `v2` como aplicacao principal Next.js App Router
- tratar o `frontend/` apenas como laboratorio/apoio enquanto nao houver necessidade real de producao nele
- colocar as telas reais logadas e admin no `backend/app`, nao no mock e nao em estrutura paralela
- usar o mesmo banco do sistema atual inicialmente para reduzir risco
- migrar por blocos de dominio e fluxo, nao por pagina completa

## Fontes de verdade analisadas

Projeto legado:

- `C:\Projetos\infrastudio\AGENTS.md`
- `C:\Projetos\infrastudio\DEMO_MODE_TECHNICAL_SPEC.md`
- `C:\Projetos\infrastudio\LOCAL_AUTH_SOCIAL_SETUP.md`
- `C:\Projetos\infrastudio\MIGRACAO_INTELIGENCIA_GUIA.md`
- `C:\Projetos\infrastudio\PROJECT_AI_SUMMARY.md`

Projeto novo:

- `C:\Projetos\infrastudio_v2\AGENTS.md`
- estrutura atual de `backend/app`, `backend/components`, `backend/lib`, `frontend/src`

## Leitura correta do momento atual

Hoje o legado ja contem:

- auth real
- social login real
- demo real
- admin real
- inbox humana real
- pipeline de chat real
- billing real
- WhatsApp real com worker separado

O `v2` hoje contem:

- base mais limpa de UI
- padrao melhor de componentes e organizacao
- landing/importacao publica ja iniciada
- mock da area logada em `mock01`

Conclusao tecnica:

- o valor do legado esta mais em `fluxos`, `regras`, `APIs`, `auth`, `chat`, `handoff`, `billing` e `persistencia`
- o valor do `v2` esta mais em `estrutura`, `organizacao`, `padrao de UI` e capacidade de crescer direito

Entao a estrategia correta e:

- absorver o cerebro do legado
- reconstruir a casca no padrao do `v2`

## O que nao fazer

- nao copiar `page.tsx` gigante do legado para dentro do `v2`
- nao migrar tudo de uma vez
- nao reescrever regra de negocio antes de provar compatibilidade
- nao levar o mock para producao como se fosse estrutura final
- nao criar uma segunda stack paralela no `frontend/` se a tela real vai viver no `backend/`
- nao mover regra critica para componente de interface
- nao mexer em banco sem plano de compatibilidade

## Estrategia de menor ruido e maior probabilidade de sucesso

### Fase 0. Congelamento de direcao

Objetivo:

- definir onde cada ambiente vivera no `v2`

Decisao recomendada:

- site publico:
  - `backend/app/page.js` e rotas publicas relacionadas
- area do usuario logado:
  - nova arvore em `backend/app/app/...`
- area admin:
  - nova arvore em `backend/app/admin/...`

Critério de aceite:

- estrutura de rotas definida antes de qualquer copia de tela

### Fase 1. Mapa de absorcao

Objetivo:

- mapear o que sera `reaproveitado`, `adaptado`, `reescrito` e `descartado`

Quatro categorias:

1. reaproveitar quase direto
2. reaproveitar com adapter
3. reescrever mantendo contrato
4. nao migrar

Provavel classificacao inicial:

- reaproveitar quase direto:
  - services de auth
  - services de chat
  - orchestrator e submodulos
  - billing runtime
  - handoff rules
- reaproveitar com adapter:
  - rotas API
  - acesso a banco
  - integracao com worker WhatsApp
- reescrever mantendo contrato:
  - telas admin
  - tela do usuario logado
  - widgets visuais internos
- nao migrar:
  - layout antigo
  - blocos gigantes acoplados a UI antiga
  - estilos antigos que contradizem o padrao novo

Critério de aceite:

- lista fechada do que entra em cada categoria

### Fase 2. Base tecnica compartilhada

Objetivo:

- preparar o `v2` para conversar com o banco atual e com as envs reais

Itens:

- copiar e adaptar `.env.local` do legado para o `v2`
- garantir clientes de banco e helpers base no `backend/lib`
- validar conexao com banco existente
- validar acesso ao worker do WhatsApp se necessario
- validar que o `v2` le auth/config sem hardcode

Critério de aceite:

- `v2` sobe localmente conectado ao banco real sem quebrar o legado

### Fase 3. Auth primeiro

Objetivo:

- criar a base de sessao que separa site publico, usuario logado e admin

Motivo:

- sem auth correta, qualquer migracao posterior fica torta

Escopo:

- login
- logout
- sessao atual
- guardas de rota
- papeis `admin` e `viewer`
- base para demo

Ordem recomendada:

1. rotas de auth no `v2`
2. service de auth no `v2`
3. leitura do usuario autenticado no layout
4. protecao de rotas `/app` e `/admin`

Critério de aceite:

- usuario comum entra em `/app`
- admin entra em `/admin`
- publico segue acessando somente rotas publicas

### Fase 4. Estrutura real da area logada

Objetivo:

- parar de usar `mock01` como destino final e mover a experiencia para a pasta correta

Direcao:

- `mock01` continua como referencia temporaria
- criar a estrutura real em `backend/app/app/...`

Estrutura recomendada inicial:

- `backend/app/app/layout.js`
- `backend/app/app/page.js`
- `backend/app/app/projetos/page.js`
- `backend/app/app/projetos/[id]/page.js`
- `backend/components/app/...`
- `backend/components/ui/...`
- `backend/lib/...`

Regra:

- primeiro copiar funcionalmente a tela para o lugar certo
- depois melhorar a UX e refatorar blocos grandes

Critério de aceite:

- a visao do usuario logado deixa de depender de `/mock01`

### Fase 5. Projetos e agentes

Objetivo:

- trazer para o `v2` o miolo da operacao do usuario logado

Prioridade:

1. listagem de projetos
2. detalhe do projeto
3. gestao de agentes
4. APIs vinculadas ao agente

Motivo:

- esse bloco conecta diretamente com o que o usuario precisa operar
- o mock ja aponta para esse fluxo

Critério de aceite:

- usuario logado consegue listar projeto, abrir projeto e editar o agente principal

### Fase 6. Chat, widget e inbox

Objetivo:

- migrar o principal bloco operacional do produto

Prioridade:

1. `POST /api/chat`
2. resolucao de projeto/agente/widget
3. persistencia do chat
4. inbox humana
5. handoff

Regra:

- um pipeline de chat so
- site e WhatsApp devem reutilizar o mesmo cerebro

Critério de aceite:

- chat do site responde via `v2`
- handoff continua funcionando
- inbox mostra o que realmente veio do chat

### Fase 7. WhatsApp

Objetivo:

- plugar o adapter do worker ao `v2` sem reescrever o worker

Escopo:

- status de canal
- QR
- conexao/desconexao
- handoff alert
- trafego de mensagens pelo pipeline unico

Critério de aceite:

- o `v2` gerencia canal e responde conversa reutilizando o mesmo runtime do chat

### Fase 8. Admin

Objetivo:

- trazer a camada de operacao global para o `v2`

Escopo inicial recomendado:

1. dashboard admin minimo
2. projetos
3. atendimento
4. logs
5. planos/billing

Critério de aceite:

- admin consegue operar projeto, atendimento e diagnostico sem voltar ao legado

### Fase 9. Demo

Objetivo:

- reintroduzir a demonstracao depois que auth e fluxos principais estiverem estaveis

Motivo:

- demo depende de auth, projeto, agente, widget, WhatsApp, cleanup e regras de bloqueio
- migrar demo cedo demais aumenta muito o ruido

Critério de aceite:

- demo nasce no `v2` sem quebrar o fluxo real

## Ordem pratica de implementacao

Sequencia recomendada de trabalho:

1. criar este plano e congelar a direcao
2. definir arvore final de rotas do `v2`
3. configurar env e banco no `v2`
4. migrar auth e guards
5. mover mock da area logada para `backend/app/app/...`
6. ligar listagem de projetos a dados reais
7. ligar detalhe de projeto e agentes a dados reais
8. migrar rotas/services centrais de chat
9. migrar inbox e handoff
10. migrar WhatsApp
11. migrar admin
12. migrar demo
13. refinar UX e padronizacao visual

## Direcionamento sobre o mock

O mock nao deve ser mantido como produto final.

Uso correto do mock agora:

- validar fluxo
- validar hierarquia visual
- reaproveitar componentes
- servir como base da area logada real

Uso incorreto do mock:

- continuar adicionando regra de negocio em `mock01`
- deixar `mock01` como rota definitiva
- acoplar dados reais em uma rota temporaria

Regra explicita para esta migracao:

- manter `mock01` existente como referencia visual e tecnica
- nao desmontar o mock antes da area real estar funcional
- fazer uma copia controlada da estrutura do mock para a rota real da area logada
- a copia deve ir para o lugar correto dentro de `backend/app/app/...` e `backend/components/app/...`
- depois que a rota real estiver funcionando com dados reais, o `mock01` pode continuar existindo temporariamente como referencia
- so depois de estabilizar a nova area logada decidir se o `mock01` sera removido, reduzido ou mantido apenas como laboratorio

Decisao pratica:

- neste momento, o caminho recomendado nao e "mover" o mock
- o caminho recomendado e "preservar o mock e copiar para a estrutura final correta"
- essa copia inicial pode ficar visualmente imperfeita, desde que respeite o padrao estrutural do `v2`

## Como copiar sem fazer copia burra

Regra de migracao de tela:

1. identificar a funcionalidade real no legado
2. identificar os dados e actions reais daquela tela
3. criar a tela no lugar correto no `v2`
4. conectar com service/action real
5. aceitar visual imperfeito inicialmente
6. refinar layout depois

Ou seja:

- copiar a intencao
- copiar o fluxo
- copiar os contratos
- nao copiar a bagunca estrutural

## Mapeamento inicial recomendado no v2

### Backend/app

- publico:
  - `backend/app/page.js`
- usuario logado:
  - `backend/app/app/...`
- admin:
  - `backend/app/admin/...`
- auth:
  - `backend/app/auth/...` ou rotas API equivalentes
- APIs:
  - `backend/app/api/...`

### Backend/components

- `backend/components/ui/`
  - base reutilizavel
- `backend/components/app/`
  - componentes da area logada
- `backend/components/admin/`
  - componentes do admin
- `backend/components/public/`
  - componentes do site publico

### Backend/lib

- `backend/lib/auth/`
- `backend/lib/chat/`
- `backend/lib/billing/`
- `backend/lib/projects/`
- `backend/lib/agents/`
- `backend/lib/channels/`
- `backend/lib/widgets/`
- `backend/lib/integrations/`

Observacao:

- hoje o `backend/lib` ainda esta enxuto; essa divisao deve surgir conforme a migracao evoluir
- nao criar tudo vazio de uma vez sem necessidade

## Riscos principais

### Risco 1. Migrar UI antes do dominio

Impacto:

- tela bonita sem funcionar

Mitigacao:

- sempre migrar service/contract junto da tela

### Risco 2. Misturar mock com producao

Impacto:

- vira mais uma camada legada

Mitigacao:

- mover cedo para `backend/app/app/...`

### Risco 3. Duplicar regra de negocio

Impacto:

- comportamento divergente entre legado e `v2`

Mitigacao:

- manter um unico runtime por dominio enquanto a migracao acontece

### Risco 4. Tentar migrar demo cedo

Impacto:

- explode escopo

Mitigacao:

- demo fica depois de auth + area logada + admin minimo

## Criterios de qualidade da migracao

Cada etapa so deve ser considerada concluida quando:

- funciona com dados reais
- respeita o padrao do `AGENTS.md` do `v2`
- nao cria estrutura paralela desnecessaria
- nao depende do mock para existir
- build local continua passando

## Primeiras tarefas concretas depois deste documento

1. definir a arvore final de rotas `publico`, `app` e `admin` dentro do `backend/app`
2. criar documento complementar de mapeamento `legado -> v2` por dominio
3. configurar base de auth no `v2`
4. copiar a tela de mock do usuario logado para a rota real `app`, preservando `mock01` como referencia
5. ligar essa nova tela a listagem real de projetos

## Conclusao

Sim, foi a decisao correta criar este documento na raiz do `v2`.

Ele serve para evitar exatamente o maior risco desta migracao:

- copiar rapido
- estruturar errado
- e depois ter que refazer tudo com regra de negocio no lugar errado

A rota com mais chance de sucesso e:

- usar o legado como fonte de negocio
- usar o `v2` como destino estrutural
- mover primeiro auth e area logada para o lugar certo
- depois conectar dominio real
- e so depois refinar UX
