create table if not exists public.mercadolivre_produtos_snapshot (
  id uuid not null default uuid_generate_v4(),
  projeto_id uuid not null,
  ml_item_id character varying(60) not null,
  titulo character varying(180) not null,
  slug character varying(180) not null,
  preco numeric(14,2) not null default 0,
  preco_original numeric(14,2) not null default 0,
  thumbnail_url text,
  permalink text,
  status character varying(40),
  estoque integer not null default 0,
  categoria_id character varying(80),
  atributos_json jsonb not null default '[]'::jsonb,
  ultima_sincronizacao_em timestamp without time zone,
  created_at timestamp without time zone not null default now(),
  updated_at timestamp without time zone not null default now(),
  constraint mercadolivre_produtos_snapshot_pkey primary key (id),
  constraint mercadolivre_produtos_snapshot_projeto_id_fkey
    foreign key (projeto_id) references public.projetos(id) on delete cascade,
  constraint mercadolivre_produtos_snapshot_projeto_item_key
    unique (projeto_id, ml_item_id)
);

alter table public.mercadolivre_produtos_snapshot enable row level security;

create policy mercadolivre_produtos_snapshot_no_select
on public.mercadolivre_produtos_snapshot
for select
to authenticated
using (false);

create policy mercadolivre_produtos_snapshot_no_insert
on public.mercadolivre_produtos_snapshot
for insert
to authenticated
with check (false);

create policy mercadolivre_produtos_snapshot_no_update
on public.mercadolivre_produtos_snapshot
for update
to authenticated
using (false)
with check (false);

create policy mercadolivre_produtos_snapshot_no_delete
on public.mercadolivre_produtos_snapshot
for delete
to authenticated
using (false);
