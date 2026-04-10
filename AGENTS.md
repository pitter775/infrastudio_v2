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

- `backend/`: aplicacao Next.js
- `frontend/`: aplicacao React com Vite

Arquivos de workspace e comandos compartilhados ficam na raiz.

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
- `npm run localhost`

Depois abrir:

- `http://localhost:3000/mock01`

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
