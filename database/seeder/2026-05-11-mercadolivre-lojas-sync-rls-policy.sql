alter table public.mercadolivre_lojas_sync enable row level security;

drop policy if exists "mercadolivre_lojas_sync_service_role_all" on public.mercadolivre_lojas_sync;

create policy "mercadolivre_lojas_sync_service_role_all"
  on public.mercadolivre_lojas_sync
  for all
  to service_role
  using (true)
  with check (true);
