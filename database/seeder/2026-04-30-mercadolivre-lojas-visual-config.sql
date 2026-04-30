alter table public.mercadolivre_lojas
  add column if not exists visual_config jsonb not null default '{}'::jsonb;

comment on column public.mercadolivre_lojas.visual_config is
  'Configuracao visual da loja publica: hero, background, opacidade e modo de imagem.';
