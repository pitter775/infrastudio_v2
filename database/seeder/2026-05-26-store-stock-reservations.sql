-- Reserva transacional de estoque para checkout proprio da loja.

create table if not exists public.loja_estoque_reservas (
  id uuid primary key default gen_random_uuid(),
  projeto_id uuid not null references public.projetos(id) on delete cascade,
  loja_id uuid references public.mercadolivre_lojas(id) on delete cascade,
  pedido_id uuid,
  mercadolivre_item_id text not null check (length(trim(mercadolivre_item_id)) > 0),
  mercadolivre_variation_id text,
  quantidade integer not null default 1 check (quantidade > 0),
  status text not null default 'ativa' check (status in ('ativa', 'confirmada', 'liberada', 'expirada')),
  expires_at timestamptz not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop index if exists public.loja_estoque_reservas_item_status_exp_idx;
create index loja_estoque_reservas_item_status_exp_idx
  on public.loja_estoque_reservas (projeto_id, mercadolivre_item_id, mercadolivre_variation_id, status, expires_at);

create index if not exists loja_estoque_reservas_pedido_idx
  on public.loja_estoque_reservas (pedido_id)
  where pedido_id is not null;

alter table public.loja_estoque_reservas
  drop constraint if exists loja_estoque_reservas_pedido_id_fkey;

alter table public.loja_estoque_reservas
  add column if not exists mercadolivre_variation_id text;

alter table public.loja_pedido_itens
  add column if not exists mercadolivre_variation_id text,
  add column if not exists variation_attributes jsonb not null default '[]'::jsonb;

alter table public.loja_estoque_reservas enable row level security;

drop policy if exists loja_estoque_reservas_service_role_all on public.loja_estoque_reservas;
create policy loja_estoque_reservas_service_role_all
  on public.loja_estoque_reservas
  for all
  to service_role
  using (true)
  with check (true);

drop function if exists public.loja_reservar_estoque(uuid, uuid, uuid, text, integer, integer, timestamptz);

create or replace function public.loja_reservar_estoque(
  p_projeto_id uuid,
  p_loja_id uuid,
  p_pedido_id uuid,
  p_mercadolivre_item_id text,
  p_mercadolivre_variation_id text,
  p_quantidade integer,
  p_available_quantity integer,
  p_expires_at timestamptz
)
returns table(ok boolean, reserva_id uuid, reserved_quantity integer, available_after_reservations integer, reason text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_reserved integer := 0;
  v_reserva_id uuid;
  v_item_id text := trim(coalesce(p_mercadolivre_item_id, ''));
  v_variation_id text := nullif(trim(coalesce(p_mercadolivre_variation_id, '')), '');
  v_quantity integer := greatest(coalesce(p_quantidade, 1), 1);
  v_available integer := greatest(coalesce(p_available_quantity, 0), 0);
begin
  if p_projeto_id is null or v_item_id = '' then
    return query select false, null::uuid, 0, 0, 'invalid_input';
    return;
  end if;

  update public.loja_estoque_reservas
    set status = 'expirada',
        updated_at = now()
    where projeto_id = p_projeto_id
      and mercadolivre_item_id = v_item_id
      and coalesce(mercadolivre_variation_id, '') = coalesce(v_variation_id, '')
      and status = 'ativa'
      and expires_at <= now();

  perform pg_advisory_xact_lock(hashtextextended(p_projeto_id::text || ':' || v_item_id || ':' || coalesce(v_variation_id, ''), 0));

  select coalesce(sum(quantidade), 0)
    into v_reserved
    from public.loja_estoque_reservas
    where projeto_id = p_projeto_id
      and mercadolivre_item_id = v_item_id
      and coalesce(mercadolivre_variation_id, '') = coalesce(v_variation_id, '')
      and status in ('ativa', 'confirmada')
      and (status = 'confirmada' or expires_at > now());

  if (v_available - v_reserved) < v_quantity then
    return query select false, null::uuid, v_reserved, greatest(v_available - v_reserved, 0), 'insufficient_stock';
    return;
  end if;

  insert into public.loja_estoque_reservas (
    projeto_id,
    loja_id,
    pedido_id,
    mercadolivre_item_id,
    mercadolivre_variation_id,
    quantidade,
    status,
    expires_at
  )
  values (
    p_projeto_id,
    p_loja_id,
    p_pedido_id,
    v_item_id,
    v_variation_id,
    v_quantity,
    'ativa',
    coalesce(p_expires_at, now() + interval '30 minutes')
  )
  returning id into v_reserva_id;

  return query select true, v_reserva_id, v_reserved + v_quantity, greatest(v_available - v_reserved - v_quantity, 0), null::text;
end;
$$;

grant execute on function public.loja_reservar_estoque(uuid, uuid, uuid, text, text, integer, integer, timestamptz) to service_role;
