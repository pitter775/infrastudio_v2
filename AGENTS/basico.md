# Basico

## Regras principais

- este projeto e o `infrastudio_v2`
- tudo deve seguir a estrutura atual do workspace
- nao criar estrutura paralela
- nao duplicar componente ou utilitario existente
- nao reintroduzir imports do legado `C:\Projetos\infrastudio`
- performance e regra obrigatoria em toda evolucao, principalmente em banco, egress e consultas
- toda query deve ser otimizada: buscar so o necessario, usar `limit` quando fizer sentido e evitar `select *`, N+1, payload grande e refetch/polling desnecessario
- se houver conflito entre rapidez e padrao do projeto, manter o padrao

## Workspace

Raiz:

- `backend/`: app principal Next.js com App Router
- `frontend/`: mock SPA React/Vite
- `database/`: referencia e scripts de banco
- `scripts/`: scripts locais compartilhados

Pastas geradas nao devem ser editadas manualmente:

- `node_modules/`
- `.next/`
- `dist/`

## Banco

- schema de referencia: `database/geral-schema.sql`
- nunca editar `database/geral-schema.sql` diretamente
- novos ajustes de banco devem ser criados em `database/seeder/`

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

## Padroes de UI

- usar Tailwind CSS
- usar `cn()` para classes
- usar `lucide-react` para icones
- reutilizar `components/ui`
- usar Radix para overlays acessiveis

Evitar:

- SVG inline quando `lucide-react` resolver
- concatenacao manual de classes
- componentes visuais duplicados
- hacks de margem/overflow

## Auth e rotas reais

O v2 usa auth propria:

- JWT assinado com `APP_AUTH_SECRET`
- cookie HTTP-only `infrastudio-session`
- Supabase apenas como banco

Areas principais:

- `/`
- `/app`
- `/app/projetos`
- `/app/projetos/[id]`
- `/admin`
- `/admin/avisos`
- `/admin/projetos`
- `/admin/atendimento`
- `/admin/usuarios`
- `/politica-de-privacidade`

## Billing e projetos

- billing esta amarrado por projeto, nao por usuario
- primeiro projeto do usuario no cadastro recebe `free`
- projeto criado depois disso nasce bloqueado ate ter plano habilitado
- projeto criado por perfil `admin` pode ficar sem plano e operar como ilimitado
- ao transferir projeto de owner `admin` para usuario comum, o projeto entra automaticamente no `free`
- home publica ja usa planos reais do banco via Supabase
- checkout e retorno de pagamento ja existem em:
  - `/api/planos`
  - `/api/app/projetos/[id]/billing/checkout`
  - `/pagamento/sucesso`
  - `/api/mercado-pago/webhook`
- menu lateral do projeto e modal global de billing ja expõem:
  - plano atual
  - uso mensal
  - upgrade
  - compra de creditos

## Comandos uteis

Na raiz:

- `npm run localhost`
- `npm run build`

No `backend/`:

- `npm run build`
- `npm run lint`
- `npm run test:chat-intelligence`
- `npm run test:chat-intelligence:full`

## Regra de finalizacao

- so fazer push se o usuario pedir
