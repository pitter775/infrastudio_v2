WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY usuario_id, aviso_chave
      ORDER BY lido_em DESC NULLS LAST, updated_at DESC NULLS LAST, created_at DESC NULLS LAST, id DESC
    ) AS row_number
  FROM public.avisos_leituras
)
DELETE FROM public.avisos_leituras
WHERE id IN (
  SELECT id
  FROM ranked
  WHERE row_number > 1
);

CREATE UNIQUE INDEX IF NOT EXISTS avisos_leituras_usuario_chave_uidx
  ON public.avisos_leituras (usuario_id, aviso_chave);
