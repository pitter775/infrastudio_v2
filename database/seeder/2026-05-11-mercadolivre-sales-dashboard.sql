create table if not exists public.mercadolivre_pedidos_snapshot (
  id uuid not null default uuid_generate_v4(),
  projeto_id uuid not null,
  connector_id uuid,
  mercadolivre_order_id text not null,
  status text,
  status_detail text,
  currency_id text not null default 'BRL',
  total_amount numeric(12, 2) not null default 0,
  paid_amount numeric(12, 2),
  total_items integer not null default 0,
  buyer_id text,
  buyer_nickname text,
  buyer_first_name text,
  buyer_last_name text,
  shipping_id text,
  date_created timestamp with time zone,
  date_closed timestamp with time zone,
  date_last_updated timestamp with time zone,
  tags jsonb not null default '[]'::jsonb,
  raw_summary jsonb not null default '{}'::jsonb,
  synced_at timestamp with time zone not null default now(),
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint mercadolivre_pedidos_snapshot_pkey primary key (id),
  constraint mercadolivre_pedidos_snapshot_projeto_id_fkey foreign key (projeto_id) references public.projetos(id) on delete cascade,
  constraint mercadolivre_pedidos_snapshot_connector_id_fkey foreign key (connector_id) references public.conectores(id) on delete set null,
  constraint mercadolivre_pedidos_snapshot_order_not_empty check (length(trim(mercadolivre_order_id)) > 0)
);

create unique index if not exists idx_ml_pedidos_snapshot_projeto_order
  on public.mercadolivre_pedidos_snapshot (projeto_id, mercadolivre_order_id);

create index if not exists idx_ml_pedidos_snapshot_projeto_created
  on public.mercadolivre_pedidos_snapshot (projeto_id, date_created desc);

create index if not exists idx_ml_pedidos_snapshot_projeto_closed
  on public.mercadolivre_pedidos_snapshot (projeto_id, date_closed desc);

create index if not exists idx_ml_pedidos_snapshot_projeto_updated
  on public.mercadolivre_pedidos_snapshot (projeto_id, date_last_updated desc);

create index if not exists idx_ml_pedidos_snapshot_projeto_status
  on public.mercadolivre_pedidos_snapshot (projeto_id, status);

create index if not exists idx_ml_pedidos_snapshot_projeto_synced
  on public.mercadolivre_pedidos_snapshot (projeto_id, synced_at desc);

alter table public.mercadolivre_pedidos_snapshot enable row level security;

drop policy if exists "mercadolivre_pedidos_snapshot_service_role_all" on public.mercadolivre_pedidos_snapshot;

create policy "mercadolivre_pedidos_snapshot_service_role_all"
  on public.mercadolivre_pedidos_snapshot
  for all
  to service_role
  using (true)
  with check (true);

create table if not exists public.mercadolivre_pedido_itens_snapshot (
  id uuid not null default uuid_generate_v4(),
  projeto_id uuid not null,
  pedido_snapshot_id uuid not null,
  mercadolivre_order_id text not null,
  item_position integer not null default 0,
  item_id text,
  title text,
  quantity integer not null default 0,
  unit_price numeric(12, 2) not null default 0,
  full_unit_price numeric(12, 2),
  sale_fee numeric(12, 2),
  currency_id text not null default 'BRL',
  category_id text,
  variation_id text,
  variation_attributes jsonb not null default '[]'::jsonb,
  raw_summary jsonb not null default '{}'::jsonb,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint mercadolivre_pedido_itens_snapshot_pkey primary key (id),
  constraint mercadolivre_pedido_itens_snapshot_projeto_id_fkey foreign key (projeto_id) references public.projetos(id) on delete cascade,
  constraint mercadolivre_pedido_itens_snapshot_pedido_id_fkey foreign key (pedido_snapshot_id) references public.mercadolivre_pedidos_snapshot(id) on delete cascade,
  constraint mercadolivre_pedido_itens_snapshot_order_not_empty check (length(trim(mercadolivre_order_id)) > 0)
);

create unique index if not exists idx_ml_pedido_itens_snapshot_pedido_position
  on public.mercadolivre_pedido_itens_snapshot (pedido_snapshot_id, item_position);

create index if not exists idx_ml_pedido_itens_snapshot_projeto_item
  on public.mercadolivre_pedido_itens_snapshot (projeto_id, item_id);

create index if not exists idx_ml_pedido_itens_snapshot_projeto_title
  on public.mercadolivre_pedido_itens_snapshot (projeto_id, title);

create index if not exists idx_ml_pedido_itens_snapshot_order
  on public.mercadolivre_pedido_itens_snapshot (mercadolivre_order_id);

alter table public.mercadolivre_pedido_itens_snapshot enable row level security;

drop policy if exists "mercadolivre_pedido_itens_snapshot_service_role_all" on public.mercadolivre_pedido_itens_snapshot;

create policy "mercadolivre_pedido_itens_snapshot_service_role_all"
  on public.mercadolivre_pedido_itens_snapshot
  for all
  to service_role
  using (true)
  with check (true);

create table if not exists public.mercadolivre_vendas_sync_state (
  projeto_id uuid not null,
  connector_id uuid,
  sync_in_progress boolean not null default false,
  sync_mode text not null default 'manual_incremental',
  last_success_at timestamp with time zone,
  last_error_at timestamp with time zone,
  last_error_message text,
  last_sync_started_at timestamp with time zone,
  last_sync_finished_at timestamp with time zone,
  last_order_date_created timestamp with time zone,
  last_order_date_updated timestamp with time zone,
  total_orders_synced integer not null default 0,
  total_items_synced integer not null default 0,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint mercadolivre_vendas_sync_state_pkey primary key (projeto_id),
  constraint mercadolivre_vendas_sync_state_projeto_id_fkey foreign key (projeto_id) references public.projetos(id) on delete cascade,
  constraint mercadolivre_vendas_sync_state_connector_id_fkey foreign key (connector_id) references public.conectores(id) on delete set null
);

create index if not exists idx_ml_vendas_sync_state_last_success
  on public.mercadolivre_vendas_sync_state (last_success_at desc);

create index if not exists idx_ml_vendas_sync_state_in_progress
  on public.mercadolivre_vendas_sync_state (sync_in_progress, updated_at desc);

alter table public.mercadolivre_vendas_sync_state enable row level security;

drop policy if exists "mercadolivre_vendas_sync_state_service_role_all" on public.mercadolivre_vendas_sync_state;

create policy "mercadolivre_vendas_sync_state_service_role_all"
  on public.mercadolivre_vendas_sync_state
  for all
  to service_role
  using (true)
  with check (true);
