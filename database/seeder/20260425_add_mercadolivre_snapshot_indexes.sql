-- Índices leves para a vitrine da loja Mercado Livre.
-- Não altera estrutura de dados nem cria sync agressivo.

create index if not exists idx_ml_snapshot_slug
  on public.mercadolivre_produtos_snapshot (slug);

create index if not exists idx_ml_snapshot_projeto_id
  on public.mercadolivre_produtos_snapshot (projeto_id);

create index if not exists idx_ml_snapshot_status
  on public.mercadolivre_produtos_snapshot (status);

-- Índice composto alinhado com as consultas públicas da loja.
create index if not exists idx_ml_snapshot_projeto_slug
  on public.mercadolivre_produtos_snapshot (projeto_id, slug);

-- Índice composto para listagens recentes por projeto.
create index if not exists idx_ml_snapshot_projeto_status_updated_at
  on public.mercadolivre_produtos_snapshot (projeto_id, status, updated_at desc);
