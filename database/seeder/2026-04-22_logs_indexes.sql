create index if not exists idx_logs_created_at_desc
  on public.logs (created_at desc);

create index if not exists idx_logs_projeto_created_at_desc
  on public.logs (projeto_id, created_at desc);

create index if not exists idx_logs_tipo_origem_created_at_desc
  on public.logs (tipo, origem, created_at desc);
