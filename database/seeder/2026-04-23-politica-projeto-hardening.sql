BEGIN;

WITH ranked_memberships AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY usuario_id, projeto_id
      ORDER BY created_at DESC NULLS LAST, id DESC
    ) AS row_num
  FROM public.usuarios_projetos
  WHERE usuario_id IS NOT NULL
    AND projeto_id IS NOT NULL
)
DELETE FROM public.usuarios_projetos
WHERE id IN (
  SELECT id
  FROM ranked_memberships
  WHERE row_num > 1
);

WITH ranked_contacts AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY projeto_id, numero
      ORDER BY updated_at DESC NULLS LAST, created_at DESC NULLS LAST, id DESC
    ) AS row_num
  FROM public.whatsapp_handoff_contatos
  WHERE projeto_id IS NOT NULL
    AND numero IS NOT NULL
)
DELETE FROM public.whatsapp_handoff_contatos
WHERE id IN (
  SELECT id
  FROM ranked_contacts
  WHERE row_num > 1
);

ALTER TABLE public.usuarios_projetos
  ALTER COLUMN usuario_id SET NOT NULL,
  ALTER COLUMN projeto_id SET NOT NULL;

ALTER TABLE public.chat_widgets
  ALTER COLUMN projeto_id SET NOT NULL;

ALTER TABLE public.usuarios_projetos
  ADD CONSTRAINT usuarios_projetos_usuario_projeto_unique
  UNIQUE (usuario_id, projeto_id);

ALTER TABLE public.agentes
  ADD CONSTRAINT agentes_projeto_id_id_unique
  UNIQUE (projeto_id, id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_whatsapp_handoff_contatos_unique_numero_por_projeto
  ON public.whatsapp_handoff_contatos (projeto_id, numero)
  WHERE projeto_id IS NOT NULL
    AND numero IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_apis_projeto_id
  ON public.apis (projeto_id);

CREATE INDEX IF NOT EXISTS idx_whatsapp_handoff_contatos_projeto_id
  ON public.whatsapp_handoff_contatos (projeto_id);

CREATE INDEX IF NOT EXISTS idx_whatsapp_handoff_contatos_canal_id
  ON public.whatsapp_handoff_contatos (canal_whatsapp_id);

CREATE INDEX IF NOT EXISTS idx_conectores_projeto_tipo
  ON public.conectores (projeto_id, tipo);

ALTER TABLE public.chat_widgets
  DROP CONSTRAINT IF EXISTS chat_widgets_projeto_agente_fkey;

ALTER TABLE public.canais_whatsapp
  DROP CONSTRAINT IF EXISTS canais_whatsapp_projeto_agente_fkey;

ALTER TABLE public.conectores
  DROP CONSTRAINT IF EXISTS conectores_projeto_agente_fkey_v2;

ALTER TABLE public.chat_widgets
  ADD CONSTRAINT chat_widgets_project_agent_match_fkey
  FOREIGN KEY (projeto_id, agente_id)
  REFERENCES public.agentes (projeto_id, id)
  ON DELETE SET NULL;

ALTER TABLE public.canais_whatsapp
  ADD CONSTRAINT canais_whatsapp_project_agent_match_fkey
  FOREIGN KEY (projeto_id, agente_id)
  REFERENCES public.agentes (projeto_id, id)
  ON DELETE SET NULL;

ALTER TABLE public.conectores
  ADD CONSTRAINT conectores_project_agent_match_fkey
  FOREIGN KEY (projeto_id, agente_id)
  REFERENCES public.agentes (projeto_id, id)
  ON DELETE SET NULL;

COMMIT;
