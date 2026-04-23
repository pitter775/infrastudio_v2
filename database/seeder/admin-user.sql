-- Usuario admin inicial para banco novo.
-- Login: admin@admin
-- Senha: 123

INSERT INTO public.usuarios (
  nome,
  email,
  senha,
  provider,
  ativo,
  role,
  email_verificado,
  created_at,
  updated_at
)
VALUES (
  'Admin',
  'admin@admin',
  '$2b$10$7ercWnVCpCxtMdyYh3YDcuTAbs5Gb4xP70a8a6fSggB2E508Qbpee',
  'email',
  true,
  'admin',
  true,
  now(),
  now()
)
ON CONFLICT (email) DO UPDATE
SET
  nome = EXCLUDED.nome,
  senha = EXCLUDED.senha,
  provider = EXCLUDED.provider,
  ativo = EXCLUDED.ativo,
  role = EXCLUDED.role,
  email_verificado = EXCLUDED.email_verificado,
  updated_at = now();
