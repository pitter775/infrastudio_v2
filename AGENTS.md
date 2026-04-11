# AGENTS.md

## Regra principal

Tudo que for criado, alterado ou expandido neste projeto deve seguir obrigatoriamente o padrao de stack, pastas, utilitarios e componentes definidos neste documento.

Nao gerar estrutura paralela.
Nao criar componentes fora do padrao sem necessidade real.
Nao duplicar logica de UI que ja pode ser resolvida com os componentes base existentes.

Se houver conflito entre rapidez de implementacao e padronizacao, a padronizacao deste projeto vence.

---

## Estrutura do projeto

Este projeto esta organizado como um workspace com duas aplicacoes:

- `backend/`: aplicacao Next.js com App Router e telas publicadas
- `frontend/`: aplicacao React com Vite usada como mock SPA

Arquivos de workspace e comandos compartilhados ficam na raiz.

---

## Mapa atual de pastas

Raiz:

- `backend/`: app Next.js principal
- `frontend/`: app React/Vite
- `scripts/`: scripts compartilhados do workspace
- `node_modules/`: dependencias instaladas da raiz
- `.git/`: controle de versao

Arquivos principais da raiz:

- `AGENTS.md`: regras obrigatorias do projeto
- `package.json`: workspaces e scripts compartilhados
- `package-lock.json`: lockfile da raiz
- `.gitignore`: ignores do workspace
- `CHECKLIST_EXECUCAO_MIGRACAO.md`: checklist de migracao
- `PLANO_MIGRACAO_INFRASTUDIO_V2.md`: plano de migracao
- `REALIDADE_ATUAL_V2.md`: estado atual do v2
- `REALIDADE_LEGADO_INFRASTUDIO.md`: referencia do legado
- `backend-dev-3010.log`: log local
- `backend-dev-3010.err.log`: log local de erro

Backend:

- `backend/app/`: rotas Next.js App Router
- `backend/app/mock01/`: layout e paginas do mock01
- `backend/app/mock01/dashboard/`: dashboard geral do mock01
- `backend/app/mock01/[slug]/`: rotas dinamicas por projeto
- `backend/app/mock01/[slug]/atendimento/`: atendimento do projeto
- `backend/app/mock01/[slug]/dashboard/`: dashboard do projeto
- `backend/components/`: componentes do backend
- `backend/components/home/`: componentes da landing page
- `backend/components/mock01/`: componentes das telas mock01
- `backend/components/mock01/layout/`: shell/layout do mock01
- `backend/components/ui/`: componentes base do backend
- `backend/lib/`: utilitarios compartilhados do backend
- `backend/public/`: assets publicos do Next.js
- `backend/.next/`: build/cache local gerado pelo Next.js
- `backend/node_modules/`: dependencias instaladas do backend

Arquivos principais do backend:

- `backend/app/layout.js`: layout raiz
- `backend/app/page.js`: pagina inicial
- `backend/app/globals.css`: estilos globais
- `backend/app/favicon.ico`: favicon
- `backend/app/page.module.css`: CSS module legado/base
- `backend/components/home/landing-page.js`: landing page
- `backend/components/home/chat-demo.js`: demo visual da home
- `backend/components/home/data.js`: dados da home
- `backend/components/mock01/data.js`: dados e slugs do mock01
- `backend/components/mock01/projects-grid-view.js`: grid de projetos
- `backend/components/mock01/project-detail-view.js`: detalhe de projeto
- `backend/components/mock01/dashboard-view.js`: dashboard mock01
- `backend/components/mock01/attendance-view.js`: atendimento mock01
- `backend/components/mock01/mock-page-header.js`: header das telas mock01
- `backend/components/mock01/project-card.js`: card de projeto
- `backend/components/mock01/layout/shell.js`: shell lateral/topo mock01
- `backend/components/ui/button.js`: botao base
- `backend/components/ui/sheet.js`: sheet base
- `backend/components/ui/tooltip.js`: tooltip base
- `backend/lib/utils.js`: utilitario `cn()`
- `backend/public/logo.png`: logo
- `backend/public/compartilhar_novo.png`: imagem de compartilhamento
- `backend/public/bg_mercadolivre.png`: asset da home
- `backend/public/bg_sistema.png`: asset da home
- `backend/public/bg_site.png`: asset da home
- `backend/public/bg_whatsapp.png`: asset da home
- `backend/public/file.svg`: asset padrao
- `backend/public/globe.svg`: asset padrao
- `backend/public/next.svg`: asset padrao
- `backend/public/vercel.svg`: asset padrao
- `backend/public/window.svg`: asset padrao
- `backend/package.json`: scripts e dependencias do backend
- `backend/next.config.mjs`: config Next.js
- `backend/jsconfig.json`: alias/imports
- `backend/tailwind.config.js`: config Tailwind do backend
- `backend/postcss.config.mjs`: config PostCSS
- `backend/eslint.config.mjs`: config ESLint
- `backend/vercel.json`: config de deploy
- `backend/README.md`: README do backend
- `backend/AGENTS.md`: instrucoes locais do backend quando existirem
- `backend/CLAUDE.md`: instrucoes locais legadas/externas

Frontend:

- `frontend/src/`: codigo fonte do Vite
- `frontend/src/assets/`: assets importados pelo React
- `frontend/src/components/`: composicoes e componentes de tela
- `frontend/src/components/ui/`: componentes base do frontend
- `frontend/src/lib/`: utilitarios compartilhados do frontend
- `frontend/public/`: assets publicos do Vite
- `frontend/dist/`: build local gerado pelo Vite
- `frontend/node_modules/`: dependencias instaladas do frontend

Arquivos principais do frontend:

- `frontend/src/main.jsx`: entrada React
- `frontend/src/App.jsx`: componente raiz SPA
- `frontend/src/index.css`: estilos globais
- `frontend/src/components/infra-studio-mock.jsx`: mock principal
- `frontend/src/components/app-sidebar.jsx`: sidebar do mock
- `frontend/src/components/project-workspace-mock.jsx`: workspace de projeto
- `frontend/src/components/attendance-panel.jsx`: painel de atendimento
- `frontend/src/components/ui/avatar.jsx`: avatar base
- `frontend/src/components/ui/badge.jsx`: badge base
- `frontend/src/components/ui/button.jsx`: botao base
- `frontend/src/components/ui/dropdown-menu.jsx`: dropdown base
- `frontend/src/components/ui/input.jsx`: input base
- `frontend/src/components/ui/sheet.jsx`: sheet base
- `frontend/src/components/ui/textarea.jsx`: textarea base
- `frontend/src/lib/utils.js`: utilitario `cn()`
- `frontend/src/assets/react.svg`: asset importado
- `frontend/public/vite.svg`: asset publico
- `frontend/index.html`: HTML raiz do Vite
- `frontend/package.json`: scripts e dependencias do frontend
- `frontend/vite.config.js`: config Vite e alias `@`
- `frontend/jsconfig.json`: alias/imports
- `frontend/tailwind.config.js`: config Tailwind do frontend
- `frontend/postcss.config.js`: config PostCSS
- `frontend/eslint.config.js`: config ESLint
- `frontend/components.json`: config de componentes
- `frontend/README.md`: README do frontend

Scripts:

- `scripts/localhost.ps1`: sobe o backend Next.js em porta local configuravel

Pastas geradas como `.next/`, `dist/` e `node_modules/` nao devem ser editadas manualmente.

---

## Rotas atuais

Backend Next.js:

- `/`: landing page em `backend/app/page.js`
- `/mock01`: lista/grid de projetos em `backend/app/mock01/page.js`
- `/mock01/dashboard`: dashboard geral em `backend/app/mock01/dashboard/page.js`
- `/mock01/[slug]`: detalhe de projeto em `backend/app/mock01/[slug]/page.js`
- `/mock01/[slug]/dashboard`: dashboard do projeto em `backend/app/mock01/[slug]/dashboard/page.js`
- `/mock01/[slug]/atendimento`: atendimento do projeto em `backend/app/mock01/[slug]/atendimento/page.js`

Slugs atuais do mock01:

- `equilibramente`
- `airy-beauty`
- `pleasant-joy`

URLs dinamicas validas hoje:

- `/mock01/equilibramente`
- `/mock01/equilibramente/dashboard`
- `/mock01/equilibramente/atendimento`
- `/mock01/airy-beauty`
- `/mock01/airy-beauty/dashboard`
- `/mock01/airy-beauty/atendimento`
- `/mock01/pleasant-joy`
- `/mock01/pleasant-joy/dashboard`
- `/mock01/pleasant-joy/atendimento`

Frontend Vite:

- `/`: SPA renderizada por `frontend/src/App.jsx`

O frontend nao tem roteador declarado nem rotas internas por URL neste momento.

---

## Stack oficial

### Backend

- Next.js
- React
- App Router

### Frontend

- React
- Vite
- Tailwind CSS
- Radix UI primitives
- `lucide-react` para icones
- `clsx` para composicao condicional de classes
- `tailwind-merge` para resolver conflito de classes Tailwind
- `class-variance-authority` para variantes de componentes
- `framer-motion` para animacoes
- `simplebar-react` para scroll customizado

---

## Regra obrigatoria para UI

Toda interface nova deve ser feita usando a stack e os componentes base ja configurados no projeto.

Obrigatorio:

- usar `lucide-react` para icones
- usar `cn()` de `src/lib/utils.js` para combinar classes
- usar Tailwind CSS para estilizacao
- usar Radix UI quando houver dropdown, dialog, sheet, menu, overlay ou comportamento acessivel similar
- reutilizar componentes de `src/components/ui`

Evitar:

- SVG manual inline quando um icone do `lucide-react` resolver
- concatenacao manual de classes quando `cn()` resolver
- criar estilos fora do fluxo do Tailwind sem motivo tecnico forte
- criar componente visual duplicado quando ja existir base em `src/components/ui`

---

## Padrao de pastas do frontend

Toda nova implementacao no frontend deve respeitar esta organizacao:

- `src/components/ui/`: componentes base e primitives reutilizaveis
- `src/components/`: componentes de tela, blocos e composicoes
- `src/lib/`: funcoes utilitarias, helpers e configuracoes compartilhadas
- `src/assets/`: assets estaticos usados pela aplicacao

Se o projeto crescer, manter a expansao dentro desse padrao.

Exemplo:

- componentes base em `src/components/ui`
- componentes especificos de feature em `src/components`
- funcoes como `cn`, formatadores, helpers e config em `src/lib`

Nao criar novas convencoes de pasta sem necessidade real e sem manter consistencia com a stack atual.

---

## Componentes base existentes

Os componentes e utilitarios abaixo sao o ponto de partida obrigatorio para novas interfaces:

- `src/lib/utils.js`
- `src/components/ui/button.jsx`
- `src/components/ui/dropdown-menu.jsx`
- `src/components/ui/sheet.jsx`

Antes de criar um novo componente visual, verificar se ele deve nascer em `src/components/ui` como componente base reutilizavel ou em `src/components` como composicao de tela.

---

## Alias e imports

Usar alias `@` para imports internos do frontend.

Exemplos esperados:

```jsx
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
```

Evitar imports relativos longos quando o alias resolver melhor.

---

## Estilo de implementacao

Ao gerar codigo novo neste projeto:

- priorizar componentes reutilizaveis
- manter API de componentes simples e previsivel
- centralizar variantes em `class-variance-authority` quando fizer sentido
- preferir composicao sobre duplicacao
- manter consistencia visual entre telas
- preparar a base para escalabilidade sem inventar estrutura nova desnecessaria

Regra importante para layout:

- nao usar margem, hack visual ou deslocamento improvisado para "forcar" borda aparecer
- quando uma borda de container sumir, corrigir a estrutura do container e do overflow, nao empurrar o elemento
- nao quebrar alinhamento do header, icones ou toolbar para resolver acabamento visual
- topo e area de conteudo devem permanecer estruturalmente independentes e alinhados
- containers com borda devem ter fechamento visual limpo nos quatro lados

---

## Scroll, animacao e interacoes

Quando aplicavel:

- usar `simplebar-react` para areas com scroll customizado
- usar `framer-motion` para transicoes e animacoes
- usar primitives do Radix para comportamento acessivel de overlays e menus

Esses recursos ja fazem parte da stack e devem ser preferidos ao inves de solucoes improvisadas.

---

## Comandos uteis

Na raiz do projeto:

- `npm run install:all` (rodar uma vez no inicio ou quando dependencias mudarem)
- `npm run localhost`
- `npm run localhost:3001`
- `npm run localhost:3002`
- `npm run build`
- `npm run build:backend`
- `npm run build:frontend`
- `npm run dev:backend`
- `npm run dev:frontend`

No frontend:

- `npm run lint`
- `npm run build`

---

## Como iniciar e ver o mock01

Para continuar depois e abrir em `http://localhost:3000/mock01`:

Na raiz:

- `cd C:\Projetos\infrastudio_v2`

Primeira execucao do projeto:

- `cd C:\Projetos\infrastudio_v2`
- `npm run install:all`
- `npm run localhost`

Execucoes seguintes:

- `cd C:\Projetos\infrastudio_v2`
- `npm run localhost`

Fluxo de dev esperado:

- usar `npm run localhost` para subir o backend local
- usar `npm run localhost:3001` ou `npm run localhost:3002` quando precisar subir em porta alternativa
- usar `npm run dev:backend` ou `npm run dev:frontend` quando quiser subir apenas um workspace especifico
- nao rodar instalacao de dependencias em toda inicializacao se nada mudou

Depois abrir:

- `http://localhost:3000/mock01`
- `http://localhost:3001/mock01` ou `http://localhost:3002/mock01` se usar porta alternativa

---

## Decisao obrigatoria para qualquer agente ou colaborador

Qualquer codigo gerado neste projeto deve seguir explicitamente este documento.

Se uma tarefa envolver frontend:

- seguir o padrao de pastas definido aqui
- usar os componentes e utilitarios da stack atual
- expandir a biblioteca interna de componentes antes de criar solucoes isoladas

Se uma tarefa envolver backend:

- manter a organizacao do app Next.js existente
- evitar criar estrutura desconectada do workspace

Este documento deve ser tratado como referencia obrigatoria de implementacao.

---

## Realidade atual do v2

Esta secao reflete o estado real implementado no backend v2 e deve ser mantida atualizada durante a migracao.

### Rotas reais do backend

Rotas publicas:

- `/`: landing page real em `backend/app/page.js`
- `/mock01`: mock legado visual preservado

Rotas do sistema:

- `/app`
- `/app/projetos`
- `/app/projetos/[id]`
- `/admin`
- `/admin/projetos`
- `/admin/atendimento`
- `/admin/usuarios`

APIs atuais:

- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/auth/me`
- `GET /api/admin/conversations`
- `POST /api/admin/conversations/[id]/messages`
- `GET /api/admin/usuarios`
- `POST /api/admin/usuarios`
- `PUT /api/admin/usuarios`
- `PATCH /api/admin/usuarios/[id]`
- `DELETE /api/admin/usuarios/[id]`
- `POST /api/chat`

### Autenticacao atual

O v2 ja usa autenticacao portada do legado:

- JWT assinado com `APP_AUTH_SECRET`
- cookie HTTP-only `infrastudio-session`
- validacao de senha com `bcrypt`
- Supabase usado apenas como banco
- nao usa Supabase Auth
- `backend/proxy.js` protege `/admin` e `/api/admin`

Arquivos principais:

- `backend/lib/session.js`
- `backend/lib/session-token.js`
- `backend/lib/auth.js`
- `backend/lib/usuarios.js`
- `backend/lib/supabase-admin.js`
- `backend/app/api/auth/login/route.js`
- `backend/app/api/auth/logout/route.js`
- `backend/app/api/auth/me/route.js`

### Admin atual

O admin real usa estrutura propria em `backend/components/admin`, seguindo o layout visual do `mock01` sem depender de imports do mock.

Arquivos principais:

- `backend/app/admin/layout.js`
- `backend/components/admin/layout/shell.js`
- `backend/components/admin/page-header.js`
- `backend/components/admin/projects/projects-page.js`
- `backend/components/admin/projects/project-card.js`

`/admin` redireciona para `/admin/projetos`.

### Usuarios no admin

`/admin/usuarios` possui CRUD real portado do legado para o padrao v2.

Regras atuais:

- apenas usuario com `role = "admin"` pode acessar o CRUD
- cria usuario em `usuarios`
- senha inicial usa hash `bcrypt`
- edita nome, email, senha opcional, status e perfil
- vincula projetos em `usuarios_projetos`
- ativa/inativa usuario
- exclui vinculos em `usuarios_projetos` antes de excluir o usuario

Arquivos principais:

- `backend/components/admin/users/users-page.js`
- `backend/app/api/admin/usuarios/route.js`
- `backend/app/api/admin/usuarios/[id]/route.js`
- `backend/lib/usuarios.js`

### Projetos no admin

`/admin/projetos` lista projetos reais do banco via Supabase.
`/admin/projetos/[id]` abre o detalhe real do projeto usando o layout do `mock01` como referencia visual, mas com componentes proprios do admin.

Regra atual:

- usuario com `role = "admin"` em `usuarios` ve todos os projetos
- usuario comum ve apenas projetos vinculados em `usuarios_projetos`

Arquivo principal:

- `backend/lib/projetos.js`

Componentes principais:

- `backend/components/admin/projects/projects-page.js`
- `backend/components/admin/projects/project-card.js`
- `backend/components/admin/projects/project-detail-page.js`

Dados carregados no detalhe:

- projeto
- agente ativo
- APIs do projeto
- contagem de canais WhatsApp
- contagem de widgets de chat
- contagem de arquivos do agente

Schema de referencia:

- `database/geral-schema.sql`

### Atendimento atual

`/admin/atendimento` ja usa componentes reais em:

- `backend/components/admin/attendance/attendance-page.js`
- `backend/components/admin/attendance/conversation-list.js`
- `backend/components/admin/attendance/conversation-feed.js`
- `backend/components/admin/attendance/conversation-composer.js`
- `backend/components/admin/attendance/conversation-actions.js`
- `backend/components/admin/attendance/mock-data.js`

Fluxo atual:

- carrega conversas por `GET /api/admin/conversations`
- seleciona conversa no frontend
- envia mensagem por `POST /api/admin/conversations/[id]/messages`
- chama `POST /api/chat`
- adiciona a resposta automatica no chat

### Chat atual

`POST /api/chat` chama `backend/lib/chat-adapter.js`.

O adapter usa o pipeline legado:

- `processIncomingChatMessage` de `C:\Projetos\infrastudio\lib\chat-service.ts`

O v2 nao copia o chat-service legado. Ele importa o modulo legado diretamente.

O legado foi ajustado para:

- remover aliases internos `@/lib/...` dentro de `C:\Projetos\infrastudio\lib`
- aceitar modo isolado quando Supabase/WhatsApp/handoff nao estiverem disponiveis

`backend/next.config.mjs` permite importar codigo do diretorio legado via `outputFileTracingRoot` e `turbopack.root`.

### Variaveis de ambiente

O backend deve rodar com `backend/.env.local`.

Variaveis importantes:

- `NEXT_PUBLIC_SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `APP_AUTH_SECRET`
- `OPENAI_API_KEY`

O codigo legado importado tambem le `process.env` do runtime do backend v2.
