alter table public.mercadolivre_lojas
  add column if not exists dominio_personalizado character varying(160),
  add column if not exists dominio_ativo boolean not null default false,
  add column if not exists dominio_status character varying(32) not null default 'pending',
  add column if not exists dominio_observacoes text;
