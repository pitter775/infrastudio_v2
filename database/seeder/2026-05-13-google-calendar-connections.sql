create table if not exists public.google_calendar_connections (
  id uuid primary key default uuid_generate_v4(),
  projeto_id uuid not null references public.projetos(id) on delete cascade,
  agente_id uuid references public.agentes(id) on delete set null,
  google_account_email text,
  calendar_id text,
  calendar_name text,
  access_token text,
  refresh_token text,
  expires_at timestamp with time zone,
  status text not null default 'disconnected' check (status in ('connected', 'disconnected', 'error')),
  configuracoes jsonb not null default '{}'::jsonb,
  created_at timestamp with time zone not null default timezone('utc'::text, now()),
  updated_at timestamp with time zone not null default timezone('utc'::text, now())
);

create unique index if not exists google_calendar_connections_project_agent_uidx
  on public.google_calendar_connections (projeto_id, coalesce(agente_id, '00000000-0000-0000-0000-000000000000'::uuid));

create index if not exists google_calendar_connections_project_idx
  on public.google_calendar_connections (projeto_id, status);

create table if not exists public.google_calendar_events (
  id uuid primary key default uuid_generate_v4(),
  connection_id uuid references public.google_calendar_connections(id) on delete set null,
  projeto_id uuid not null references public.projetos(id) on delete cascade,
  agente_id uuid references public.agentes(id) on delete set null,
  chat_id uuid references public.chats(id) on delete set null,
  google_event_id text,
  calendar_id text,
  status text not null default 'created' check (status in ('created', 'cancelled', 'rescheduled', 'error')),
  start_at timestamp with time zone,
  end_at timestamp with time zone,
  summary text,
  attendee_email text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamp with time zone not null default timezone('utc'::text, now()),
  updated_at timestamp with time zone not null default timezone('utc'::text, now())
);

create index if not exists google_calendar_events_project_idx
  on public.google_calendar_events (projeto_id, created_at desc);

create index if not exists google_calendar_events_chat_idx
  on public.google_calendar_events (chat_id)
  where chat_id is not null;
