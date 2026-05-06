alter table public.tokens_avulsos
  add column if not exists expires_at timestamp without time zone;

update public.tokens_avulsos
set expires_at = created_at + interval '1 month'
where expires_at is null
  and utilizado is not true;

create index if not exists idx_tokens_avulsos_projeto_validade
  on public.tokens_avulsos (projeto_id, utilizado, expires_at, created_at);

update public.projetos_assinaturas assinatura
set
  data_fim = assinatura.data_inicio + interval '1 month',
  renovar_automatico = false,
  updated_at = now()
from public.planos plano
where assinatura.plano_id = plano.id
  and plano.is_free is true
  and assinatura.status = 'ativo'
  and assinatura.data_inicio is not null
  and assinatura.data_fim is null;
