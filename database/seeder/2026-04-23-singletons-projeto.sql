BEGIN;

WITH ranked_widgets AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY projeto_id
      ORDER BY updated_at DESC NULLS LAST, created_at DESC NULLS LAST, id DESC
    ) AS row_num
  FROM public.chat_widgets
  WHERE projeto_id IS NOT NULL
)
DELETE FROM public.chat_widgets
WHERE id IN (
  SELECT id
  FROM ranked_widgets
  WHERE row_num > 1
);

WITH ranked_channels AS (
  SELECT
    id,
    projeto_id,
    ROW_NUMBER() OVER (
      PARTITION BY projeto_id
      ORDER BY updated_at DESC NULLS LAST, created_at DESC NULLS LAST, id DESC
    ) AS row_num,
    FIRST_VALUE(id) OVER (
      PARTITION BY projeto_id
      ORDER BY updated_at DESC NULLS LAST, created_at DESC NULLS LAST, id DESC
    ) AS keep_id
  FROM public.canais_whatsapp
  WHERE projeto_id IS NOT NULL
),
rebind_contacts AS (
  UPDATE public.whatsapp_handoff_contatos contato
  SET canal_whatsapp_id = ranked.keep_id,
      updated_at = NOW()
  FROM ranked_channels ranked
  WHERE contato.canal_whatsapp_id = ranked.id
    AND ranked.row_num > 1
  RETURNING contato.id
)
DELETE FROM public.canais_whatsapp
WHERE id IN (
  SELECT id
  FROM ranked_channels
  WHERE row_num > 1
);

WITH ranked_ml_connectors AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY projeto_id
      ORDER BY updated_at DESC NULLS LAST, created_at DESC NULLS LAST, id DESC
    ) AS row_num
  FROM public.conectores
  WHERE projeto_id IS NOT NULL
    AND (
      LOWER(COALESCE(tipo, '')) = 'mercado_livre'
      OR LOWER(COALESCE(slug, '')) LIKE '%mercado%'
      OR LOWER(COALESCE(nome, '')) LIKE '%mercado%'
      OR LOWER(COALESCE(tipo, '')) = 'ml'
      OR LOWER(COALESCE(slug, '')) = 'ml'
    )
)
DELETE FROM public.conectores
WHERE id IN (
  SELECT id
  FROM ranked_ml_connectors
  WHERE row_num > 1
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_chat_widgets_unique_projeto_id
  ON public.chat_widgets (projeto_id)
  WHERE projeto_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_canais_whatsapp_unique_projeto_id
  ON public.canais_whatsapp (projeto_id)
  WHERE projeto_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_conectores_unique_ml_por_projeto
  ON public.conectores (projeto_id)
  WHERE projeto_id IS NOT NULL
    AND LOWER(COALESCE(tipo, '')) = 'mercado_livre';

COMMIT;
