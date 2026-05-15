alter table if exists public.mercadolivre_vendas_sync_state
  add column if not exists analytics_enabled boolean not null default false,
  add column if not exists analytics_enabled_at timestamp with time zone,
  add column if not exists analytics_enabled_by uuid,
  add column if not exists analytics_disabled_at timestamp with time zone;

create index if not exists idx_ml_vendas_sync_state_analytics_enabled
  on public.mercadolivre_vendas_sync_state (analytics_enabled, updated_at desc);
