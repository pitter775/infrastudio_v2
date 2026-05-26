-- Campos de OAuth do Mercado Pago da loja.
-- Mantem pagamento da loja separado do billing da InfraStudio.

alter table public.loja_pagamento_config
  add column if not exists refresh_token_encrypted text,
  add column if not exists token_expires_at timestamptz,
  add column if not exists connected_at timestamptz,
  add column if not exists last_validated_at timestamptz,
  add column if not exists last_error_message text;

create unique index if not exists loja_pagamento_config_projeto_provider_idx
  on public.loja_pagamento_config (projeto_id, provider);
