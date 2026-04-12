# Plano correto: demonstracao sem cadastro no v2

## Objetivo

Implantar no `infrastudio_v2` o fluxo de demonstracao com o mesmo comportamento do legado, mas seguindo a arquitetura do v2.

O fluxo correto nao abre um workspace generico de projetos. Ele deve levar o usuario direto para uma experiencia guiada de edicao, validacao e teste do agente demo.

Template oficial:

```txt
5da7e3e5-f5fb-449d-b135-c78a19daaf5b
```

## Comportamento esperado

Ao clicar em **Testar agora sem cadastro**:

1. O sistema cria ou reaproveita um usuario demo.
2. O sistema cria ou reaproveita um projeto demo real para esse usuario.
3. O projeto demo e criado a partir do template oficial.
4. O usuario entra autenticado com cookie HTTP-only.
5. O usuario e levado direto para a tela de demonstracao do agente.
6. A tela abre com foco em editar, validar e testar o agente.
7. Se o usuario quiser continuar, publicar, salvar de verdade ou sair do limite da demo, o sistema forca login/cadastro.
8. Depois do login/cadastro, o que foi feito na demo e migrado para o usuario real.
9. A demo expira e bloqueia mutacoes.
10. O cleanup limpa ou desativa o que sobrou.

## O que o legado faz

Arquivos analisados no legado:

- `C:\Projetos\infrastudio\app\nova_home\nova-home-client.tsx`
- `C:\Projetos\infrastudio\app\_components\home\home-page-client.tsx`
- `C:\Projetos\infrastudio\app\api\auth\demo-create\route.ts`
- `C:\Projetos\infrastudio\app\api\auth\demo-convert\route.ts`
- `C:\Projetos\infrastudio\lib\projetos.ts`
- `C:\Projetos\infrastudio\lib\usuarios.ts`
- `C:\Projetos\infrastudio\lib\demo-user.ts`
- `C:\Projetos\infrastudio\lib\demo-project-guard.ts`
- `C:\Projetos\infrastudio\lib\demo-conversion.ts`

Resumo do legado:

1. `localStorage.demoUser` guarda o email demo.
2. Email demo usa prefixo `demonstracao_`.
3. Senha demo no legado e fixa (`123`).
4. Front chama `/api/auth/demo-create`.
5. Backend cria/reaproveita usuario demo.
6. Backend chama `ensureDemoProjetoForUsuario`.
7. Projeto demo e clonado do `DEMO_TEMPLATE_PROJECT_ID`.
8. Membership do usuario demo e sempre `viewer`.
9. Backend cria sessao.
10. Front salva `localStorage.demoProjectId`.
11. Front redireciona para o detalhe do projeto.
12. A experiencia principal e editar/testar o agente.
13. Ao fazer login/cadastro real, a demo pode ser convertida.

## Diferenca importante para o v2

O v2 nao deve simplesmente redirecionar para:

```txt
/app/projetos
```

Nem deve deixar o usuario cair em uma tela com menu lateral generico.

O destino correto deve ser uma tela dedicada de demonstracao, por exemplo:

```txt
/demo/agente
```

ou:

```txt
/app/demo/[projectId]
```

Recomendacao:

```txt
/demo/agente
```

Motivo: a demo e uma experiencia de aquisicao/onboarding, nao a area normal do app.

## Arquitetura proposta no v2

### Rotas publicas/client

```txt
backend/app/demo/agente/page.js
backend/components/demo/agent-demo-page.js
```

Responsabilidade:

- carregar sessao demo;
- exibir editor guiado do agente;
- exibir painel de teste do chat;
- exibir CTA para criar conta/entrar;
- salvar snapshot local para conversao.

### Rotas API

```txt
backend/app/api/auth/demo-create/route.js
backend/app/api/auth/demo-convert/route.js
backend/app/api/cron/demo-cleanup/route.js
```

### Helpers

```txt
backend/lib/demo-user.js
backend/lib/demo-projects.js
backend/lib/demo-project-guard.js
backend/lib/demo-conversion.js
```

### Banco

Criar SQL em `database/seeder/`.

Nao editar `database/geral-schema.sql` direto.

Campos necessarios em `projetos`:

```sql
is_demo boolean
demo_expires_at timestamp with time zone
demo_status varchar
demo_template_source_id uuid
demo_owner_user_id uuid
```

Indices:

```sql
owner_user_id, is_demo
is_demo, demo_status, demo_expires_at
```

## Fluxo detalhado

### 1. Clique no CTA da home

Arquivo:

```txt
backend/components/home/landing-page.js
```

Ao clicar:

1. Verificar `localStorage.infrastudio-demo-user`.
2. Se existir e for valido, reaproveitar.
3. Se nao existir, criar:

```json
{
  "email": "demonstracao_<uuid>@infrastudio.demo",
  "password": "<senha-forte>",
  "createdAt": "<iso>"
}
```

4. Chamar:

```txt
POST /api/auth/demo-create
```

5. Receber:

```json
{
  "projectId": "...",
  "redirectTo": "/demo/agente"
}
```

6. Redirecionar para `/demo/agente`.

### 2. Criacao ou reuso do usuario demo

Arquivo:

```txt
backend/app/api/auth/demo-create/route.js
```

Entrada:

```json
{
  "email": "demonstracao_x@infrastudio.demo",
  "password": "..."
}
```

Regras:

- email precisa comecar com `demonstracao_`;
- senha precisa existir;
- se usuario ja existe, reaproveita;
- se nao existe, cria;
- `usuarios.role` sempre `viewer`;
- `email_verificado = true`;
- `ativo = true`;
- provider pode ser `demo`;
- nao criar projeto padrao de cadastro normal.

Depois:

- garantir projeto demo;
- garantir membership `viewer`;
- criar sessao HTTP-only;
- retornar `projectId`.

### 3. Criacao do projeto demo

Arquivo:

```txt
backend/lib/demo-projects.js
```

Funcao:

```txt
ensureDemoProjetoForUsuario(usuarioId)
```

Comportamento:

1. Ler `DEMO_TEMPLATE_PROJECT_ID`.
2. Buscar projeto template oficial.
3. Buscar projeto demo existente:

```txt
is_demo = true
owner_user_id = usuarioId
```

4. Se existir e estiver valido, reaproveitar.
5. Se existir vazio, hidratar clonando template.
6. Se nao existir, criar projeto demo:

```json
{
  "is_demo": true,
  "demo_status": "ativo",
  "demo_expires_at": "now + 30min",
  "demo_template_source_id": "5da7e3e5-f5fb-449d-b135-c78a19daaf5b",
  "demo_owner_user_id": "<usuarioId>",
  "owner_user_id": "<usuarioId>"
}
```

7. Clonar do template:

- agente principal;
- prompt do agente;
- configuracoes do agente;
- APIs;
- vinculos agente/API;
- widget necessario para teste;
- configuracoes basicas do projeto.

Nao clonar:

- dados sensiveis desnecessarios;
- canais WhatsApp reais conectados;
- billing real;
- logs historicos;
- conversas do template.

### 4. Destino da demo

Tela recomendada:

```txt
backend/app/demo/agente/page.js
```

Essa tela deve carregar o projeto demo atual pelo usuario logado.

Layout esperado:

- sem menu lateral generico do app;
- sem lista de projetos;
- sem area admin;
- tela focada em agente;
- editor de prompt/instrucoes;
- preview do comportamento;
- painel de teste do chat;
- barra superior com tempo restante;
- CTA para criar conta;
- CTA para falar com especialista, se fizer sentido.

Se o usuario acessar `/demo/agente` sem sessao demo:

- redirecionar para `/`;
- ou iniciar nova demo se existir credencial local.

### 5. Edicao e teste do agente

Na demo ativa, permitir:

- editar nome/descricao/prompt do agente base;
- testar o chat;
- ver resposta da IA;
- validar APIs ja clonadas do template;
- ajustar campos simples do agente que fazem sentido para demonstracao.

Bloquear:

- criar agente;
- excluir agente;
- criar/excluir API;
- criar/excluir widget;
- conectar WhatsApp;
- alterar projeto inteiro;
- acessar lista geral de projetos;
- virar admin;
- mexer em billing.

Observacao:

O legado permite editar o agente base existente. Esse e o centro da demo.

### 6. Guards no backend

Arquivo:

```txt
backend/lib/demo-project-guard.js
```

Responsabilidades:

- detectar projeto demo;
- validar dono/membership;
- validar expiracao;
- marcar expirado quando necessario;
- retornar `DEMO_EXPIRED` em mutacoes proibidas.

Rotas que precisam consultar o guard:

```txt
backend/app/api/app/projetos/[id]/agente
backend/app/api/app/projetos/[id]/agente/apis
backend/app/api/app/projetos/[id]/apis
backend/app/api/app/projetos/[id]/widgets
backend/app/api/app/projetos/[id]/whatsapp
```

Politica:

- `GET`: permitido se usuario tem acesso.
- `PATCH agente base`: permitido se demo ativa.
- mutacoes fora do agente base: bloqueadas.
- demo expirada: bloqueia tudo que for mutacao com `DEMO_EXPIRED`.

### 7. Snapshot da demo

Arquivo:

```txt
backend/lib/demo-conversion.js
```

O frontend deve salvar um snapshot local do que importa para conversao.

Chaves sugeridas:

```txt
infrastudio-demo-user
infrastudio-demo-project-id
infrastudio-demo-snapshot
infrastudio-demo-conversion-pending
```

Snapshot minimo:

```json
{
  "projeto": {
    "nome": "...",
    "slug": "...",
    "tipo": "...",
    "descricao": "...",
    "status": "...",
    "modeloId": "..."
  },
  "agentes": [
    {
      "id": "...",
      "nome": "...",
      "descricao": "...",
      "promptBase": "...",
      "ativo": true,
      "apiIds": ["..."]
    }
  ],
  "apis": [
    {
      "id": "...",
      "nome": "...",
      "url": "...",
      "metodo": "GET",
      "descricao": "...",
      "ativo": true,
      "campos": [],
      "parametros": []
    }
  ]
}
```

### 8. Forcar login ou cadastro

Quando o usuario demo tentar:

- salvar definitivamente;
- publicar;
- sair da demo para area real;
- acessar billing;
- continuar depois de terminar a validacao;
- converter o agente em projeto real;

O sistema deve abrir a modal de login/cadastro.

Antes de abrir:

1. salvar snapshot;
2. salvar `pendingDemoConversion`;
3. manter `demoUserId` e `demoEmail`.

### 9. Conversao para usuario real

Endpoint:

```txt
backend/app/api/auth/demo-convert/route.js
```

Quando usuario real faz login/cadastro:

1. carregar `pendingDemoConversion`;
2. chamar `/api/auth/demo-convert`;
3. backend valida:
   - usuario atual nao e demo;
   - demoUserId existe;
   - demoUserId e usuario demo;
   - snapshot e valido.
4. criar projeto real para usuario atual;
5. copiar dados do snapshot:
   - projeto;
   - APIs;
   - agentes;
   - vinculos agente/API.
6. consolidar uso da demo, se houver;
7. desativar usuario demo;
8. atualizar sessao do usuario real;
9. retornar `projetoId`;
10. redirecionar para projeto convertido no v2.

Destino depois da conversao:

```txt
/app/projetos/<projetoId>?demo_converted=1
```

ou, se existir tela dedicada de sucesso:

```txt
/app/projetos/<projetoId>/agente?demo_converted=1
```

### 10. Cleanup

Endpoint:

```txt
backend/app/api/cron/demo-cleanup/route.js
```

Protecao:

```txt
CRON_SECRET
```

Responsabilidades:

- localizar projetos `is_demo = true`;
- marcar expirados quando `demo_expires_at < now()`;
- desativar usuarios demo antigos;
- remover ou arquivar demos muito antigas;
- desconectar recursos externos se existirem;
- registrar log operacional.

## Implementacao em fases

### Fase 1: base segura

1. Criar SQL em `database/seeder`.
2. Criar `demo-user.js`.
3. Criar `demo-projects.js`.
4. Criar `/api/auth/demo-create`.
5. Criar guard basico de expiracao.
6. Criar testes unitarios dos helpers.

### Fase 2: experiencia correta

1. Criar `/demo/agente`.
2. Criar UI focada em edicao/teste do agente.
3. Conectar CTA da home para demo-create.
4. Redirecionar para `/demo/agente`.
5. Esconder workspace/menu lateral da demo.

### Fase 3: restricoes

1. Permitir editar agente base.
2. Bloquear criacao/exclusao de agente.
3. Bloquear API/widget/WhatsApp/conectores/projeto.
4. Retornar `DEMO_EXPIRED` quando expirada.
5. Exibir estado expirado no frontend.

### Fase 4: conversao

1. Criar `demo-conversion.js`.
2. Salvar snapshot local.
3. Forcar login/cadastro em acoes finais.
4. Criar `/api/auth/demo-convert`.
5. Migrar snapshot para projeto real.
6. Desativar demo.
7. Redirecionar para projeto real.

### Fase 5: limpeza

1. Criar `/api/cron/demo-cleanup`.
2. Adicionar logs.
3. Validar expiracao.
4. Validar limpeza de usuario/projeto demo.

## Validacao obrigatoria

### Automatizada

Rodar:

```powershell
npm run test:chat-intelligence:full --workspace backend
npm run build --workspace backend
```

Buscar imports do legado:

```txt
../../../infrastudio
../../../../infrastudio
C:\Projetos\infrastudio\lib
```

Resultado esperado:

- zero imports do legado;
- build passando;
- testes passando.

### Manual

1. Clicar em **Testar agora sem cadastro**.
2. Confirmar que criou usuario `demonstracao_`.
3. Confirmar que criou projeto demo.
4. Confirmar que clonou template oficial.
5. Confirmar que abriu direto a tela de agente.
6. Editar prompt do agente.
7. Testar chat.
8. Tentar criar API e confirmar bloqueio.
9. Forcar expiracao e confirmar `DEMO_EXPIRED`.
10. Clicar para continuar/criar conta.
11. Fazer cadastro real.
12. Confirmar conversao para projeto real.
13. Confirmar usuario demo desativado.
14. Rodar cleanup.

## Criterio de pronto

A demonstracao so esta correta quando:

- nao abre workspace generico;
- entra direto na edicao/teste do agente;
- usa usuario e projeto demo reais;
- usa o template oficial;
- usuario demo nunca vira admin;
- demo ativa tem restricoes claras;
- demo expirada bloqueia mutacao;
- login/cadastro real converte o trabalho feito;
- cleanup remove ou desativa sobras;
- nada importa codigo do legado.

