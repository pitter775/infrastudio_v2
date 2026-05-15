alter table if exists public.mercadolivre_produtos_snapshot
  add column if not exists videos_json jsonb not null default '[]'::jsonb;

