create index if not exists idx_chats_atendimento_projeto_updated
  on public.chats (projeto_id, updated_at desc)
  where canal is distinct from 'admin_agent_test';

create index if not exists idx_chats_atendimento_canal_updated
  on public.chats (canal, updated_at desc);

create index if not exists idx_mensagens_chat_created_desc
  on public.mensagens (chat_id, created_at desc);

create index if not exists idx_chat_handoffs_chat_id
  on public.chat_handoffs (chat_id);
