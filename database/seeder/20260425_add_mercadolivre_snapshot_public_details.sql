alter table if exists public.mercadolivre_produtos_snapshot
  add column if not exists categoria_nome character varying,
  add column if not exists descricao_curta text,
  add column if not exists descricao_longa text;
