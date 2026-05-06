alter table public.chat_widgets
  add column if not exists identificacao_contato_ativa boolean not null default false;
