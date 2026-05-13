# Plano Google Agenda

Objetivo:

- remover a agenda local do fluxo ativo do produto
- transformar Google Agenda em uma conexao do agente
- permitir que o agente consulte disponibilidade e crie eventos diretamente no Google Calendar
- manter o runtime baseado em estado, intent semantico estruturado e handler deterministico

## Decisao de produto

- Google Agenda entra como uma nova conexao do agente/projeto.
- A agenda local atual nao deve ser evoluida.
- A agenda local pode ficar no banco temporariamente por seguranca, mas nao deve ser usada pelo chat.
- O usuario final nao configura env nem Google Cloud.
- A InfraStudio configura um OAuth Client separado para Google Agenda.

## Env de servidor

Manter o login Google atual separado da integracao Google Agenda.

Login social existente:

```env
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
```

Nova integracao Google Agenda:

```env
GOOGLE_CALENDAR_CLIENT_ID=
GOOGLE_CALENDAR_CLIENT_SECRET=
GOOGLE_CALENDAR_REDIRECT_URI=
```

Observacoes:

- `GOOGLE_CALENDAR_REDIRECT_URI` deve apontar para o callback da InfraStudio em producao.
- O cliente final apenas clica em conectar e autoriza a propria conta.
- O OAuth da agenda precisa de `access_type=offline` para obter `refresh_token`.
- Escopo inicial recomendado: `https://www.googleapis.com/auth/calendar.events`.
- Usar escopo mais amplo (`https://www.googleapis.com/auth/calendar`) apenas se for realmente necessario listar/gerenciar calendarios de forma ampla.

## Experiencia no painel

Criar um novo sheet/painel de conexao:

- nome: `Google Agenda`
- contexto: conexoes do projeto/agente
- status:
  - desconectado
  - conectado
  - token expirado/erro
- acoes:
  - conectar Google
  - escolher calendario
  - salvar configuracoes
  - desconectar

Configuracoes minimas:

- calendario padrao (`calendarId`)
- duracao padrao do evento
- timezone, padrao `America/Sao_Paulo`
- antecedencia minima para agendar
- dias permitidos
- horario inicial/final permitido
- enviar convite para cliente quando houver email
- titulo padrao do evento
- descricao padrao do evento

## Banco

Criar ajustes apenas em `database/seeder/`.

Tabela sugerida:

```sql
google_calendar_connections
```

Campos sugeridos:

- `id`
- `projeto_id`
- `agente_id`
- `google_account_email`
- `calendar_id`
- `calendar_name`
- `access_token`
- `refresh_token`
- `expires_at`
- `status`
- `configuracoes jsonb`
- `created_at`
- `updated_at`

Opcional, mas recomendado para auditoria:

```sql
google_calendar_events
```

Campos sugeridos:

- `id`
- `connection_id`
- `projeto_id`
- `agente_id`
- `chat_id`
- `google_event_id`
- `calendar_id`
- `status`
- `start_at`
- `end_at`
- `summary`
- `attendee_email`
- `metadata jsonb`
- `created_at`
- `updated_at`

## Backend

Criar modulo:

```txt
backend/lib/google-calendar.js
```

Responsabilidades:

- iniciar OAuth
- validar `state`
- finalizar callback
- salvar tokens
- renovar token expirado
- listar calendarios da conta conectada
- consultar disponibilidade
- criar evento
- cancelar evento
- remarcar evento
- gravar logs operacionais

Rotas sugeridas:

```txt
GET    /api/app/projetos/[id]/google-calendar
POST   /api/app/projetos/[id]/google-calendar/oauth/start
GET    /api/app/projetos/[id]/google-calendar/oauth/callback
PATCH  /api/app/projetos/[id]/google-calendar
DELETE /api/app/projetos/[id]/google-calendar
```

Se o Google nao aceitar callback com segmento dinamico, usar callback fixo e resolver projeto/agente pelo `state` assinado:

```txt
GET /api/google-calendar/oauth/callback
```

## Runtime do agente

Remover o uso ativo da agenda local:

- nao carregar `listPublicAgendaAvailability` no chat
- nao chamar `resolveAgendaReservationSkill`
- nao auto-cadastrar APIs internas `Agenda - listar horarios` e `Agenda - criar reserva`
- nao usar `/api/agenda` como ferramenta do agente

Criar handler deterministico:

```txt
backend/lib/chat/google-calendar-handler.js
```

Capacidades:

- `check_availability`
- `create_event`
- `cancel_event`
- `reschedule_event`

Contexto persistido na conversa:

```js
{
  googleCalendar: {
    pending: {
      action: "create_event",
      startAt: "...",
      endAt: "...",
      contact: {
        name: "",
        email: "",
        phone: ""
      }
    },
    lastEvent: {
      eventId: "",
      calendarId: "",
      startAt: "",
      endAt: "",
      status: "confirmed"
    }
  }
}
```

Regra critica:

- nao adicionar regex/listas de frases para resolver linguagem de agenda
- usar intent semantico estruturado para detectar agendamento, remarcacao e cancelamento
- executar pelo handler sobre dados estruturados

## Fluxo esperado no chat

1. Usuario pede um agendamento.
2. Intent stage classifica dominio `agenda` ou `google_calendar`.
3. Handler verifica se existe conexao Google Agenda ativa.
4. Se nao existir, responde fail-closed informando que a agenda ainda nao esta conectada.
5. Se faltar data/hora/duracao, pede apenas o dado faltante.
6. Se faltar contato obrigatorio, pede email ou telefone conforme configuracao.
7. Consulta disponibilidade no Google Calendar.
8. Se livre, cria evento.
9. Responde confirmacao com data/hora.
10. Salva `eventId` e contexto no chat.

## Remocao da agenda local

Primeiro corte:

- tirar `/admin/agenda` do menu
- tirar CTA/action antigo `agenda_schedule` quando depender de slots locais
- parar imports de `backend/lib/agenda` dentro do runtime do chat
- deixar rotas antigas sem destaque enquanto a nova integracao estabiliza

Segundo corte, depois de validar:

- remover pagina admin antiga
- remover APIs antigas `/api/admin/agenda`, `/api/agenda` e `/api/cron/agenda-cleanup`
- remover `backend/lib/agenda.js`
- remover `backend/lib/chat/agenda-skill.js`
- remover testes antigos especificos da agenda local
- avaliar limpeza futura das tabelas `agenda_horarios` e `agenda_reservas`

Nao apagar tabela/dados em producao no primeiro PR.

## UI

Reaproveitar padroes existentes:

- Tailwind
- `cn()`
- `components/ui`
- Radix quando houver overlay/sheet
- `lucide-react` para icones

Evitar criar estrutura paralela.

Locais provaveis para encaixe:

- `backend/components/admin/projects/project-detail-page.js`
- componentes de conexoes/integracoes existentes do projeto
- seguir padrao dos sheets atuais de APIs, WhatsApp e Mercado Livre

## Testes minimos

Backend:

- OAuth start gera URL correta com escopos de Calendar
- callback valida `state` e salva conexao
- refresh token renova access token expirado
- create event monta payload correto
- indisponibilidade falha fechado

Chat/runtime:

- sem conexao Google Agenda ativa, pedido de agendamento informa configuracao pendente
- com conexao ativa, pedido com data/hora cria evento
- pedido sem horario coleta horario
- pedido sem contato coleta contato quando necessario
- cancelamento/remarcacao usa `lastEvent` do contexto

Comandos:

```bash
cd backend
npm run test:chat-intelligence
npm run test:chat-laboratory:record
npm run build
```

## Ordem recomendada de implementacao

1. Criar seeder das tabelas. Concluido em `database/seeder/2026-05-13-google-calendar-connections.sql`.
2. Criar `backend/lib/google-calendar.js`. Concluido com OAuth, refresh, listagem de calendarios e criacao de evento.
3. Criar rotas OAuth/CRUD da conexao. Concluido para conexao, start OAuth e callback.
4. Criar sheet `Google Agenda`. Concluido como primeiro painel funcional.
5. Integrar a conexao ao detalhe do projeto/agente. Concluido no menu/sheet do projeto.
6. Criar `google-calendar-handler`.
7. Trocar runtime da agenda local para Google Agenda.
8. Remover a agenda local do menu e do fluxo ativo. Primeiro corte concluido: menu removido e runtime deixou de carregar slots/reservas locais.
9. Ajustar testes.
10. Atualizar `AGENTS/melhorias.md`, removendo a pendencia antiga de agenda local quando concluido.

## Status da implementacao

Iniciado em 2026-05-13.

Ja feito:

- seeder das tabelas `google_calendar_connections` e `google_calendar_events`
- lib server-side de Google Agenda com tokens criptografados via `APP_AUTH_SECRET`
- OAuth separado em `/api/google-calendar/oauth/callback`
- rotas do projeto em `/api/app/projetos/[id]/google-calendar`
- rota de start OAuth em `/api/app/projetos/[id]/google-calendar/oauth/start`
- sheet `Google Agenda` no detalhe do projeto
- contagem de conexao no card/conexoes diretas do agente
- remocao do item `Agenda` do menu admin
- runtime do chat parou de carregar a agenda local e de expor CTA local `agenda_schedule`
- remocao das rotas/pagina/lib antigas da agenda local:
  - `/admin/agenda`
  - `/api/admin/agenda`
  - `/api/agenda`
  - `/api/cron/agenda-cleanup`
  - `backend/lib/agenda.js`
  - `backend/lib/chat/agenda-skill.js`
- remocao do cron antigo de limpeza da agenda local no Vercel
- remocao do suporte especial a API interna `/api/agenda` no teste de APIs
- handler inicial `backend/lib/chat/google-calendar-handler.js`
- classificacao semantica inicial de agenda em `classifySemanticGoogleCalendarIntentStage`
- criacao de evento real no Google Agenda pelo runtime quando houver data/hora e contato
- consulta de disponibilidade via `freeBusy` antes de criar evento
- persistencia de `googleCalendar.pending` e `googleCalendar.lastEvent` no contexto do chat
- cancelamento de evento pelo chat usando `googleCalendar.lastEvent`
- remarcacao de evento pelo chat com validacao de disponibilidade e `PATCH` no Google Calendar

Pendente imediato:

- validar OAuth em ambiente real com Google Cloud configurado
- validar evento real criado pelo chat em conta conectada
- validar cancelamento/remarcacao real pelo chat em conta conectada
- revisar testes antigos que ainda mencionam `agendaSlots` apenas como payload legado

## Pontos de atencao

- Tokens OAuth devem ficar no servidor e nunca ir para o client.
- Se possivel, criptografar tokens em repouso antes de salvar.
- Evitar `select *`; buscar somente campos necessarios.
- Toda consulta deve ter filtros por `projeto_id` e, quando aplicavel, `agente_id`.
- Logs devem ser enxutos para nao vazar token ou dado sensivel.
- Push somente se o usuario pedir.
