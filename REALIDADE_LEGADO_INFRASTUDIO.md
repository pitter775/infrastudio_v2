# Realidade do Projeto Legado InfraStudio

## Objetivo deste documento

Este arquivo descreve como o projeto legado `C:\Projetos\infrastudio` funciona hoje de verdade, para servir de base objetiva durante a migracao para o `v2`.

Regra de uso:

- este documento existe para reduzir suposicao
- ele descreve a realidade operacional do legado
- ele nao define a arquitetura final do `v2`
- ele deve ser lido junto com:
  - `C:\Projetos\infrastudio_v2\PLANO_MIGRACAO_INFRASTUDIO_V2.md`
  - `C:\Projetos\infrastudio_v2\REALIDADE_ATUAL_V2.md`
  - `C:\Projetos\infrastudio_v2\CHECKLIST_EXECUCAO_MIGRACAO.md`

## O que o legado e hoje

O legado nao e apenas um site com chat.

Ele ja funciona como sistema operacional completo do produto, concentrando:

1. site publico
2. autenticacao
3. area logada
4. painel admin
5. pipeline de chat
6. inbox humana
7. handoff
8. billing
9. integracoes
10. WhatsApp com worker externo
11. modo demo

Conclusao:

- o legado contem muita regra de negocio real
- o principal valor dele nao esta nas telas
- o principal valor dele esta em contratos, persistencia, auth, chat, billing, handoff e integracoes

## Estrutura macro observada

Pastas principais relevantes:

- `app/`
- `app/admin/`
- `app/api/`
- `app/auth/`
- `app/demo/`
- `app/handoff/`
- `app/nova_home/`
- `app/whatsapp/`
- `app/_components/`
- `lib/`
- `lib/supabase/`
- `database/`
- `database/seeder/`
- `public/`

Leitura correta:

- `app/` concentra rotas, layouts, paginas e route handlers
- `lib/` concentra grande parte da regra de negocio
- `database/seeder/` e o lugar de mudanca real de banco
- `public/` contem assets e o widget do chat

## Ambientes reais existentes no legado

Hoje o legado opera pelo menos estes ambientes:

### 1. Site publico

Responsabilidades:

- homepage
- entrada comercial
- fluxo de login/cadastro
- acesso a demo
- documentacao e materiais publicos

Pastas relacionadas:

- `app/nova_home/`
- `app/auth/`
- `app/verificar-email/`
- `app/docs/`
- `app/_components/home/`

### 2. Ambiente do usuario

Responsabilidades:

- acesso ao projeto
- experiencia do cliente logado
- leitura e operacao de projeto conforme permissao

Pastas relacionadas:

- `app/(cliente)/projetos/`
- `app/(cliente)/projetos/_components/`

### 3. Ambiente admin

Responsabilidades:

- operacao global
- projetos
- agentes
- planos
- atendimento
- diagnostico
- usuarios
- logs

Pastas relacionadas:

- `app/admin/`
- `app/admin/projetos/`
- `app/admin/atendimento/`
- `app/admin/planos/`
- `app/admin/chat-logs/`
- `app/admin/usuarios/`

## Auth real do legado

O sistema atual possui auth propria baseada em backend.

Fluxos existentes:

- login
- logout
- sessao atual
- cadastro manual
- confirmacao de email
- reenvio de confirmacao
- login social
- modo demo

Rotas relevantes:

- `app/api/auth/login/route.ts`
- `app/api/auth/logout/route.ts`
- `app/api/auth/me/route.ts`
- `app/api/auth/register/route.ts`
- `app/api/auth/resend-verification/route.ts`
- `app/api/auth/verify-email/route.ts`
- `app/api/auth/oauth/start/route.ts`
- `app/api/auth/oauth/callback/route.ts`
- `app/api/auth/demo-create/route.ts`
- `app/api/auth/demo-convert/route.ts`

Providers sociais documentados:

- Google
- GitHub
- Facebook

Observacoes importantes:

- o backend atual e a fonte de verdade da auth
- o login social nao depende apenas da UI
- Instagram ainda nao deve ser tratado como provider pronto so porque aparece visualmente em algum lugar

## Modo demo real do legado

O legado possui fluxo demo real, com isolamento por projeto demo.

Documentacao de base:

- `C:\Projetos\infrastudio\DEMO_MODE_TECHNICAL_SPEC.md`

Aspectos importantes:

- usuario demo possui projeto demo proprio
- existe TTL de demo
- existem regras de bloqueio por expiracao
- existe cleanup por cron
- existe template oficial de demo
- parte da estrutura da demo pode ser herdada numa conversao

Rotas relevantes:

- `app/api/auth/demo-create/route.ts`
- `app/api/auth/demo-convert/route.ts`
- `app/api/cron/demo-cleanup/`

Leitura correta para a migracao:

- demo e recurso relevante do produto
- demo nao deve ser a primeira camada a migrar
- demo depende de auth, projeto, agente, APIs, widgets e algumas regras operacionais

## Dominio principal do legado

Os conceitos centrais ja existem e sao reais.

Objetos de dominio principais:

- projeto
- agente
- API
- conector
- widget
- chat
- mensagem
- handoff
- canal de WhatsApp
- plano
- billing
- uso

Leitura correta:

- a migracao precisa preservar esses contratos
- o erro seria migrar tela sem preservar esses conceitos

## Pipeline de chat do legado

O centro funcional do sistema esta na camada de chat.

Arquivos centrais:

- `lib/chat-service.ts`
- `lib/chat-orchestrator.ts`

Submodulos relevantes citados na documentacao:

- `lib/chat-intent-classifier.ts`
- `lib/chat-semantic-intent-stage.ts`
- `lib/chat-sales-heuristics.ts`
- `lib/chat-lead-stage.ts`
- `lib/chat-summary-stage.ts`
- `lib/chat-api-runtime.ts`
- `lib/catalog-follow-up.ts`
- `lib/chat-mercado-livre.ts`
- `lib/chat-channel-policy.ts`
- `lib/chat-prompt-builders.ts`

Resumo funcional:

1. o canal envia mensagem
2. o backend resolve projeto, agente, contexto e chat
3. o orchestrator aplica heuristica, politica de canal, chamada de modelo e runtime de APIs
4. a resposta e persistida
5. billing, logs e handoff podem ser acionados

Conclusao:

- o pipeline do chat e o cerebro do produto
- ele deve ser absorvido com prioridade alta

## Widget/site do legado

O site possui chat e widget reais.

Arquivos importantes:

- `app/api/chat/route.ts`
- `app/api/chat/config/route.ts`
- `public/chat.js`
- `lib/chat-widgets.ts`

Leitura correta:

- o widget atual nao e apenas UI
- existe contrato real entre host, widget e backend
- esse contrato deve ser entendido antes de qualquer reescrita completa

## Handoff e inbox humana

O handoff nao e detalhe de interface. Ele e regra de negocio real.

Arquivos e areas relevantes:

- `app/admin/atendimento/page.tsx`
- `app/api/admin/chats/route.ts`
- `app/api/admin/chats/[id]/route.ts`
- `app/api/admin/chats/[id]/handoff/route.ts`
- `lib/chat-handoffs.ts`
- `lib/chat-handoff-policy.ts`
- `lib/chat-attachments.ts`

Capacidades reais citadas na documentacao:

- assumir atendimento
- liberar para IA
- anexos
- feed unificado
- operacao de conversas

Leitura correta:

- atendimento e uma das areas mais importantes do sistema
- a nova tela de atendimento do `v2` deve respeitar essa importancia

## Billing e planos

Billing e runtime, nao so tela administrativa.

Arquivos relevantes:

- `app/admin/planos/page.tsx`
- `app/api/admin/planos/route.ts`
- `lib/billing.ts`
- `lib/billing-access.ts`
- `lib/billing-usage-cycles.ts`
- `lib/planos.ts`

Leitura correta:

- billing interfere em permissao e limite de uso
- nao deve ser recalculado no frontend
- nao deve ser tratado como detalhe visual

## WhatsApp e worker externo

O WhatsApp do produto nao mora inteiro dentro do repo legado.

Arquivos internos relevantes:

- `lib/whatsapp-service.ts`
- `lib/whatsapp-handoff-alerts.ts`
- `lib/whatsapp-handoff-contatos.ts`
- `app/api/whatsapp/session/`
- `app/api/whatsapp/webhook/`
- `app/api/whatsapp/worker-log/`

Servico externo:

- worker separado em `C:\Projetos\whatsapp-service`

Leitura correta:

- o worker deve continuar separado
- o backend do app e dono da regra
- o worker e ponte de canal
- a sessao precisa de persistencia

Impacto na migracao:

- o worker nao deve ser refeito agora
- o `v2` deve aprender a consumir o mesmo contrato com o worker

## Admin do legado

O admin atual possui muitas areas relevantes.

Pastas observadas:

- `app/admin/dashboard/`
- `app/admin/projetos/`
- `app/admin/agentes/`
- `app/admin/atendimento/`
- `app/admin/chat-logs/`
- `app/admin/planos/`
- `app/admin/usuarios/`
- `app/admin/laboratorio/`

Leitura correta:

- o admin do legado e funcional
- mas possui historico de crescimento acumulado
- nao deve ser copiado estruturalmente de forma cega para o `v2`

## Hotspots conhecidos do legado

Pontos citados repetidamente pela documentacao e pela estrutura:

- `app/admin/projetos/[id]/page.tsx`
- `app/admin/atendimento/page.tsx`
- `lib/chat-service.ts`
- `lib/chat-orchestrator.ts`

Leitura correta:

- esses arquivos concentram valor e risco
- precisam ser entendidos
- mas nao devem ser transportados como monolitos para o `v2`

## Banco e regras de mudanca

Documentacao reforca que:

- `database/geral-schema.sql` e snapshot manual
- nao deve ser alterado automaticamente
- mudanca real de banco entra em `database/seeder/`

Leitura correta para a migracao:

- o banco atual deve ser tratado como fonte de verdade inicial
- o `v2` pode reaproveitar o mesmo banco
- mudancas precisam continuar disciplinadas

## Forcas reais do legado

O que o legado ja entrega:

- auth real
- social login real
- demo real
- chat real
- inbox real
- handoff real
- billing real
- integracoes reais
- admin real
- WhatsApp real com worker

## Limites reais do legado

Os principais limites observados sao:

- crescimento com forte acoplamento entre tela e regra
- paginas grandes
- hotspots com muita responsabilidade
- dificuldade de manter evolucao limpa
- risco de continuar acumulando UX e dominio no mesmo lugar

## O que deve ser absorvido do legado

Prioridade alta:

- contratos de auth
- fluxo de sessao
- regras de papel
- services de projetos/agentes/APIs
- pipeline de chat
- handoff
- billing runtime
- integracao com worker WhatsApp
- operacao do atendimento

Prioridade baixa:

- layout antigo
- composicoes visuais antigas
- telas gigantes como estrutura final

## Conclusao operacional

O legado deve ser tratado como:

- fonte de negocio
- fonte de regras
- fonte de contratos
- fonte de comportamento real

Mas nao como:

- molde estrutural do `v2`
- base de UI do `v2`
- arquitetura final do `v2`
