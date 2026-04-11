# Realidade Atual do InfraStudio v2

## Objetivo deste documento

Este arquivo descreve o estado atual do `C:\Projetos\infrastudio_v2`, separando com clareza:

- o que ja existe
- o que ja esta organizado
- o que ainda e mock
- o que ainda nao deve ser tratado como produto final

Este documento existe para evitar que a migracao para o `v2` seja feita com suposicoes erradas.

## O que o v2 e hoje

O `v2` hoje e uma base mais limpa e mais organizada para reconstruir o produto.

Ele ainda nao e o sistema completo migrado.

Hoje ele representa principalmente:

- uma estrutura melhor de projeto
- uma base de UI mais padronizada
- um backend Next.js organizado como workspace
- um frontend Vite auxiliar/laboratorial
- uma homepage publica importada/adaptada
- um mock importante da area logada em `mock01`

Conclusao:

- o `v2` esta estruturalmente melhor que o legado
- mas ainda nao contem os fluxos reais centrais do produto

## Estrutura atual do workspace

Na raiz:

- `backend/`
- `frontend/`
- `scripts/`
- `AGENTS.md`
- `PLANO_MIGRACAO_INFRASTUDIO_V2.md`

Leitura correta:

- o projeto foi organizado como workspace
- o destino principal de produto hoje e o `backend/`
- o `frontend/` existe, mas nao deve virar outra estrutura paralela sem motivo forte

## Regra principal do v2

O arquivo `C:\Projetos\infrastudio_v2\AGENTS.md` define a base obrigatoria de implementacao.

Pontos centrais:

- nao gerar estrutura paralela
- nao duplicar logica visual sem necessidade
- seguir stack e padrao do projeto
- priorizar componentes reutilizaveis
- usar a stack atual de UI

Leitura correta:

- qualquer migracao para o `v2` precisa respeitar isso
- o erro seria usar a urgencia da migracao como desculpa para baguncar a estrutura

## Stack oficial do v2

### Backend

- Next.js
- React
- App Router

### Frontend

- React
- Vite
- Tailwind CSS
- Radix UI primitives
- `lucide-react`
- `clsx`
- `tailwind-merge`
- `class-variance-authority`
- `framer-motion`
- `simplebar-react`

Leitura correta:

- a stack visual ja foi definida
- o ganho do `v2` esta tambem em padronizacao de componente

## Estado atual do backend

O `backend/` e hoje o nucleo mais promissor do `v2`.

Pastas observadas:

- `backend/app/`
- `backend/components/`
- `backend/lib/`
- `backend/public/`

Rotas atuais observadas:

- `backend/app/page.js`
- `backend/app/mock01/page.js`
- `backend/app/mock01/[slug]/page.js`
- `backend/app/mock01/dashboard/page.js`
- `backend/app/mock01/[slug]/dashboard/page.js`
- `backend/app/mock01/[slug]/atendimento/page.js`

Leitura correta:

- o backend hoje ja serve pagina publica e mock
- ainda nao existe a estrutura real de `app` logado e `admin`
- isso ainda precisa nascer de forma organizada

## Estado atual do frontend

O `frontend/` possui estrutura padronizada de Vite e UI.

Pastas observadas:

- `frontend/src/assets/`
- `frontend/src/components/`
- `frontend/src/components/ui/`
- `frontend/src/lib/`

Leitura correta:

- ele existe como workspace valido
- mas o fluxo principal do produto, neste momento, nao deve ser espalhado entre `backend` e `frontend` sem decisao clara
- o melhor caminho atual e concentrar a experiencia principal no `backend`, que esta alinhado com Vercel e com a decisao do projeto

## O que ja esta pronto no v2

### 1. Base estrutural melhor

Ja existe:

- workspace organizado
- scripts de build e dev na raiz
- backend isolado
- frontend isolado
- configuracao de deploy do backend corrigida para Vercel

### 2. Base de componentes

No `backend` ja existem componentes reutilizaveis como:

- `backend/components/ui/button.js`
- `backend/components/ui/sheet.js`
- `backend/components/ui/tooltip.js`
- `backend/lib/utils.js`

No `frontend` tambem existe estrutura paralela de UI.

Leitura correta:

- o `v2` ja tem fundacao de design system
- isso e uma vantagem concreta em relacao ao legado

### 3. Landing/publico

Ja existe uma homepage e componentes publicos relevantes em:

- `backend/components/home/`
- `backend/app/page.js`

Leitura correta:

- o site publico ja comecou a ser absorvido

### 4. Mock da area logada

Ja existe mock funcional em:

- `backend/app/mock01/`
- `backend/components/mock01/`

Leitura correta:

- esse mock e importante
- ele nao e o destino final da area logada
- ele e referencia de UX e estrutura de composicao

## O que o mock01 representa hoje

O `mock01` representa a visao evoluida da area logada.

Ele ja contem:

- listagem de projetos/agentes
- detalhe de projeto
- shell visual
- fluxo de painel lateral
- dashboard mock
- tela mock de atendimento
- componentes reutilizaveis importantes
- comportamento mobile mais refinado no workspace e nos sheets

Arquivos relevantes:

- `backend/components/mock01/project-card.js`
- `backend/components/mock01/projects-grid-view.js`
- `backend/components/mock01/project-detail-view.js`
- `backend/components/mock01/dashboard-view.js`
- `backend/components/mock01/attendance-view.js`
- `backend/components/mock01/layout/shell.js`

Leitura correta:

- o mock01 ja e um ativo importante
- ele deve ser preservado
- ele deve ser copiado para a estrutura real no momento certo
- ele nao deve receber regra de negocio real como se fosse rota final
- ele hoje ja serve tambem como referencia de responsividade mobile e comportamento de sheets

## Evolucao recente do mock01

Nas ultimas iteracoes, o `mock01` recebeu refinamentos visuais e estruturais importantes.

O que existe agora:

- header mobile mais consistente no workspace
- menu principal acessivel no topo no celular
- botao de atendimento reposicionado no topo no mobile
- subtitulos de sheets ocultados no celular quando necessario
- headers dos sheets mais padronizados entre agente, integracoes e API
- card do agente no mobile com comportamento proprio, sem drag, sem scroll e com escala menor

Leitura correta:

- o mock01 nao e so uma vitrine estatica
- ele ja consolida decisoes visuais e de interacao que podem orientar a futura area logada real
- mesmo assim, continua sendo mock e referencia, nao implementacao final de produto

## Decisao importante ja registrada

No plano de migracao ficou definido:

- manter `mock01`
- nao desmontar o mock agora
- fazer copia controlada do mock para o lugar certo depois

Isso significa:

- `mock01` continua sendo laboratorio e referencia
- a area logada real nascera em outra arvore

## O que ainda falta no v2

Ainda nao existe, de forma real e consolidada:

- auth real
- sessao real
- rotas protegidas reais
- area logada em rota final
- admin real
- integracao com banco legado
- integracao com chat real
- handoff real
- atendimento real
- billing real
- integracao real com worker WhatsApp
- demo real

Conclusao:

- o `v2` esta mais pronto para crescer
- mas ainda nao esta operacional como substituto do legado

## Melhor leitura da vantagem do v2

O `v2` e melhor que o legado principalmente em:

- estrutura
- clareza de organizacao
- padrao visual
- componentizacao
- base para escalabilidade
- chance de manter disciplina arquitetural

O `v2` ainda nao e melhor em:

- completude funcional
- cobertura de casos reais
- maturidade de negocio

## Regras de implementacao obrigatorias no v2

O `AGENTS.md` do `v2` exige:

- reutilizar componentes
- usar `lucide-react`
- usar `cn()`
- usar Tailwind
- usar Radix quando apropriado
- manter consistencia de pastas
- evitar gambiarra visual

Leitura correta:

- a absorcao do legado deve ser funcional, mas tambem disciplinada
- se uma tela vier do legado, ela precisa ser reorganizada no padrao do `v2`

## Direcao estrutural recomendada para o v2

Destino recomendado no `backend/app`:

- publico:
  - `backend/app/...`
- usuario logado:
  - `backend/app/app/...`
- admin:
  - `backend/app/admin/...`

Destino recomendado em componentes:

- `backend/components/public/...`
- `backend/components/app/...`
- `backend/components/admin/...`
- `backend/components/ui/...`

Observacao:

- essas pastas ainda nao precisam ser criadas todas imediatamente
- mas esse e o destino correto, nao o `mock01`

## O que o v2 nao deve virar

O `v2` nao deve virar:

- novo legado com regra colada na tela
- duplicacao de estrutura entre backend e frontend sem motivo
- mock permanente
- experimento eterno sem integrar com negocio real

## O que o v2 deve virar

O `v2` deve virar:

- a base oficial do produto
- o projeto principal na Vercel
- a nova casa do site publico
- a nova casa da area logada
- a nova casa do admin
- um sistema com camada de dominio mais organizada

## Conclusao operacional

O `v2` hoje ainda nao substitui o legado.

Mas ele ja e:

- melhor fundacao
- melhor ponto de partida
- melhor espaco para crescer sem repetir os mesmos erros

Essa e a principal razao para seguir nele:

- nao porque a stack mudou
- mas porque a disciplina estrutural mudou
