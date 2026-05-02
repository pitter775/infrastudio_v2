create table if not exists public.mercadolivre_lojas_sync (
  project_id uuid primary key references public.projetos(id) on delete cascade,
  sync_in_progress boolean not null default false,
  sync_mode text not null default 'manual_full',
  last_sync_at timestamptz null,
  last_sync_started_at timestamptz null,
  last_sync_finished_at timestamptz null,
  last_sync_error text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_mercadolivre_lojas_sync_last_sync_at
  on public.mercadolivre_lojas_sync (last_sync_at desc nulls last);
