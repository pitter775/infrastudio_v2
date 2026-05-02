alter table if exists public.mercadolivre_produtos_snapshot
  add column if not exists ml_date_created timestamp without time zone,
  add column if not exists ml_last_updated timestamp without time zone;

create index if not exists idx_mercadolivre_produtos_snapshot_recentes
  on public.mercadolivre_produtos_snapshot (projeto_id, status, estoque, ml_date_created desc, updated_at desc);
