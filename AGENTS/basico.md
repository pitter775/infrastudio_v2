# Basico

## Regras principais

- este projeto e o `infrastudio_v2`
- tudo deve seguir a estrutura atual do workspace
- nao criar estrutura paralela
- nao duplicar componente ou utilitario existente
- nao reintroduzir imports do legado `C:\Projetos\infrastudio`
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
