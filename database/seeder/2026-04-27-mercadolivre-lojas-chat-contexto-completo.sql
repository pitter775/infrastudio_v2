alter table public.mercadolivre_lojas
  add column if not exists chat_contexto_completo boolean not null default false;
