-- Schema executavel para banco novo do infrastudio_v2 no Supabase.
-- Gerado a partir do schema de referencia, com ordem, PKs/FKs e RLS ajustados.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE public.modelos (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  nome character varying NOT NULL,
  provider character varying NOT NULL,
  custo_input numeric,
  custo_output numeric,
  ativo boolean DEFAULT true,
  configuracoes jsonb,
  created_at timestamp without time zone DEFAULT now(),
  CONSTRAINT modelos_pkey PRIMARY KEY (id)
);

CREATE TABLE public.usuarios (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  nome character varying,
  email character varying UNIQUE,
  senha text,
  provider character varying,
  provider_id character varying,
  ativo boolean DEFAULT true,
  ultimo_login_at timestamp without time zone,
  created_at timestamp without time zone DEFAULT now(),
  updated_at timestamp without time zone DEFAULT now(),
  avatar_url text,
  role character varying NOT NULL DEFAULT 'viewer'::character varying,
  email_verificado boolean NOT NULL DEFAULT false,
  telefone text,
  CONSTRAINT usuarios_pkey PRIMARY KEY (id)
);

CREATE TABLE public.planos (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  nome character varying NOT NULL,
  descricao text,
  preco_mensal numeric NOT NULL DEFAULT 0,
  limite_tokens_input_mensal integer,
  limite_tokens_output_mensal integer,
  limite_tokens_total_mensal integer,
  limite_custo_mensal numeric,
  max_agentes integer DEFAULT 1,
  max_apis integer DEFAULT 1,
  max_whatsapp integer DEFAULT 0,
  ativo boolean DEFAULT true,
  created_at timestamp without time zone DEFAULT now(),
  updated_at timestamp without time zone DEFAULT now(),
  permitir_excedente boolean DEFAULT false,
  custo_token_excedente numeric DEFAULT 0,
  is_free boolean NOT NULL DEFAULT false,
  CONSTRAINT planos_pkey PRIMARY KEY (id)
);

CREATE TABLE public.projetos (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  nome character varying NOT NULL,
  tipo character varying,
  descricao text,
  status character varying DEFAULT 'ativo'::character varying,
  configuracoes jsonb,
  created_at timestamp without time zone DEFAULT now(),
  updated_at timestamp without time zone DEFAULT now(),
  slug character varying,
  modo_cobranca character varying DEFAULT 'plano'::character varying CHECK (modo_cobranca::text = ANY (ARRAY['plano'::character varying, 'manual'::character varying, 'ilimitado'::character varying]::text[])),
  modelo_id uuid,
  owner_user_id uuid,
  is_demo boolean NOT NULL DEFAULT false,
  demo_expires_at timestamp without time zone,
  demo_status character varying,
  CONSTRAINT projetos_pkey PRIMARY KEY (id)
);

CREATE TABLE public.agentes (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  projeto_id uuid NOT NULL,
  nome character varying,
  descricao text,
  modelo_id uuid,
  prompt_base text,
  configuracoes jsonb,
  ativo boolean DEFAULT true,
  created_at timestamp without time zone DEFAULT now(),
  slug character varying,
  updated_at timestamp without time zone DEFAULT now(),
  CONSTRAINT agentes_pkey PRIMARY KEY (id),
  CONSTRAINT agentes_projeto_id_key UNIQUE (projeto_id),
  CONSTRAINT agentes_projeto_id_id_key UNIQUE (projeto_id, id)
);

CREATE TABLE public.apis (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  projeto_id uuid NOT NULL,
  nome character varying NOT NULL,
  url text NOT NULL,
  metodo character varying NOT NULL DEFAULT 'GET'::character varying CHECK (upper(metodo::text) = ANY (ARRAY['GET'::text, 'POST'::text, 'PUT'::text, 'PATCH'::text, 'DELETE'::text])),
  descricao text,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamp without time zone NOT NULL DEFAULT now(),
  updated_at timestamp without time zone NOT NULL DEFAULT now(),
  configuracoes jsonb NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT apis_pkey PRIMARY KEY (id)
);

CREATE TABLE public.agenda_horarios (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  projeto_id uuid NOT NULL,
  agente_id uuid,
  titulo text NOT NULL DEFAULT 'Horario disponivel'::text,
  dia_semana smallint CHECK (dia_semana IS NULL OR dia_semana >= 0 AND dia_semana <= 6),
  data_inicio timestamp with time zone,
  data_fim timestamp with time zone,
  hora_inicio time without time zone NOT NULL,
  hora_fim time without time zone NOT NULL,
  timezone text NOT NULL DEFAULT 'America/Sao_Paulo'::text,
  capacidade integer NOT NULL DEFAULT 1 CHECK (capacidade > 0),
  ativo boolean NOT NULL DEFAULT true,
  configuracoes jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT agenda_horarios_pkey PRIMARY KEY (id)
);

CREATE TABLE public.chats (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  projeto_id uuid,
  usuario_id uuid,
  titulo character varying,
  modelo_id uuid,
  contexto jsonb,
  total_tokens integer DEFAULT 0,
  total_custo numeric DEFAULT 0,
  status character varying DEFAULT 'ativo'::character varying,
  created_at timestamp without time zone DEFAULT now(),
  updated_at timestamp without time zone DEFAULT now(),
  agente_id uuid,
  canal character varying NOT NULL DEFAULT 'web'::character varying,
  identificador_externo text,
  contato_nome text,
  contato_telefone text,
  contato_avatar_url text,
  CONSTRAINT chats_pkey PRIMARY KEY (id)
);

CREATE TABLE public.agenda_reservas (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  projeto_id uuid NOT NULL,
  agente_id uuid,
  horario_id uuid,
  chat_id uuid,
  status text NOT NULL DEFAULT 'reservado'::text CHECK (status = ANY (ARRAY['reservado'::text, 'confirmado'::text, 'cancelado'::text, 'concluido'::text])),
  contato_nome text,
  contato_email text,
  contato_telefone text,
  resumo_conversa text,
  dados_contato jsonb NOT NULL DEFAULT '{}'::jsonb,
  origem text NOT NULL DEFAULT 'chat'::text,
  canal text,
  horario_reservado timestamp with time zone NOT NULL,
  timezone text NOT NULL DEFAULT 'America/Sao_Paulo'::text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT agenda_reservas_pkey PRIMARY KEY (id)
);

CREATE TABLE public.agente_api (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  agente_id uuid NOT NULL,
  api_id uuid NOT NULL,
  created_at timestamp without time zone NOT NULL DEFAULT now(),
  CONSTRAINT agente_api_pkey PRIMARY KEY (id)
);

CREATE TABLE public.agente_arquivos (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  agente_id uuid NOT NULL,
  projeto_id uuid NOT NULL,
  nome character varying NOT NULL,
  descricao text,
  arquivo_nome character varying NOT NULL,
  mime_type character varying NOT NULL,
  tamanho_bytes integer NOT NULL DEFAULT 0,
  categoria character varying NOT NULL CHECK (categoria::text = ANY (ARRAY['image'::character varying, 'file'::character varying]::text[])),
  storage_path text NOT NULL UNIQUE,
  public_url text NOT NULL,
  created_at timestamp without time zone NOT NULL DEFAULT now(),
  updated_at timestamp without time zone NOT NULL DEFAULT now(),
  CONSTRAINT agente_arquivos_pkey PRIMARY KEY (id)
);

CREATE TABLE public.agente_versoes (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  agente_id uuid NOT NULL,
  projeto_id uuid NOT NULL,
  version_number integer NOT NULL,
  nome character varying,
  descricao text,
  prompt_base text,
  configuracoes jsonb NOT NULL DEFAULT '{}'::jsonb,
  ativo boolean NOT NULL DEFAULT true,
  source character varying NOT NULL DEFAULT 'manual_update'::character varying,
  note text,
  created_by uuid,
  created_at timestamp without time zone NOT NULL DEFAULT now(),
  CONSTRAINT agente_versoes_pkey PRIMARY KEY (id)
);

CREATE TABLE public.api_campos (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  api_id uuid NOT NULL,
  nome character varying NOT NULL,
  tipo character varying NOT NULL CHECK (tipo::text = ANY (ARRAY['string'::character varying, 'number'::character varying, 'boolean'::character varying]::text[])),
  descricao text,
  created_at timestamp without time zone NOT NULL DEFAULT now(),
  CONSTRAINT api_campos_pkey PRIMARY KEY (id)
);

CREATE TABLE public.api_versoes (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  api_id uuid NOT NULL,
  projeto_id uuid NOT NULL,
  version_number integer NOT NULL,
  nome character varying,
  url text,
  metodo character varying DEFAULT 'GET'::character varying CHECK (upper(metodo::text) = ANY (ARRAY['GET'::text, 'POST'::text, 'PUT'::text, 'PATCH'::text, 'DELETE'::text])),
  descricao text,
  configuracoes jsonb NOT NULL DEFAULT '{}'::jsonb,
  ativo boolean NOT NULL DEFAULT true,
  source text NOT NULL DEFAULT 'manual_update'::text,
  note text,
  created_by uuid,
  created_at timestamp without time zone NOT NULL DEFAULT now(),
  CONSTRAINT api_versoes_pkey PRIMARY KEY (id)
);

CREATE TABLE public.avisos_leituras (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  usuario_id uuid NOT NULL,
  aviso_chave text NOT NULL,
  aviso_tipo character varying,
  destino text,
  lido_em timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT avisos_leituras_pkey PRIMARY KEY (id)
);

CREATE TABLE public.canais_whatsapp (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  projeto_id uuid NOT NULL,
  agente_id uuid,
  numero character varying NOT NULL,
  session_data jsonb,
  status character varying NOT NULL DEFAULT 'ativo'::character varying CHECK (status::text = ANY (ARRAY['ativo'::character varying, 'inativo'::character varying]::text[])),
  created_at timestamp without time zone NOT NULL DEFAULT now(),
  updated_at timestamp without time zone NOT NULL DEFAULT now(),
  CONSTRAINT canais_whatsapp_pkey PRIMARY KEY (id)
);

CREATE TABLE public.chat_widgets (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  nome character varying NOT NULL,
  slug character varying NOT NULL,
  projeto_id uuid,
  agente_id uuid,
  dominio text,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamp without time zone NOT NULL DEFAULT now(),
  updated_at timestamp without time zone NOT NULL DEFAULT now(),
  tema character varying NOT NULL DEFAULT 'dark'::character varying CHECK (tema::text = ANY (ARRAY['dark'::character varying, 'light'::character varying]::text[])),
  cor_primaria character varying NOT NULL DEFAULT '#2563eb'::character varying,
  fundo_transparente boolean NOT NULL DEFAULT true,
  whatsapp_celular text,
  CONSTRAINT chat_widgets_pkey PRIMARY KEY (id)
);

CREATE TABLE public.chat_handoffs (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  chat_id uuid NOT NULL UNIQUE,
  projeto_id uuid NOT NULL,
  canal_whatsapp_id uuid,
  status character varying NOT NULL DEFAULT 'bot'::character varying CHECK (status::text = ANY (ARRAY['bot'::character varying, 'pending_human'::character varying, 'human'::character varying]::text[])),
  motivo text,
  requested_by character varying NOT NULL DEFAULT 'system'::character varying CHECK (requested_by::text = ANY (ARRAY['system'::character varying, 'agent'::character varying, 'human'::character varying]::text[])),
  requested_by_usuario_id uuid,
  claimed_by_usuario_id uuid,
  released_by_usuario_id uuid,
  requested_at timestamp without time zone NOT NULL DEFAULT now(),
  claimed_at timestamp without time zone,
  released_at timestamp without time zone,
  last_alert_at timestamp without time zone,
  alert_message text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamp without time zone NOT NULL DEFAULT now(),
  updated_at timestamp without time zone NOT NULL DEFAULT now(),
  CONSTRAINT chat_handoffs_pkey PRIMARY KEY (id)
);

CREATE TABLE public.chat_handoff_eventos (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  handoff_id uuid NOT NULL,
  chat_id uuid NOT NULL,
  projeto_id uuid NOT NULL,
  tipo character varying NOT NULL CHECK (tipo::text = ANY (ARRAY['requested'::character varying, 'alert_sent'::character varying, 'claimed'::character varying, 'released'::character varying, 'paused'::character varying, 'resumed'::character varying, 'note'::character varying]::text[])),
  descricao text,
  usuario_id uuid,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamp without time zone NOT NULL DEFAULT now(),
  CONSTRAINT chat_handoff_eventos_pkey PRIMARY KEY (id)
);

CREATE TABLE public.conectores (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  projeto_id uuid NOT NULL,
  agente_id uuid,
  slug character varying,
  nome character varying NOT NULL,
  tipo character varying NOT NULL,
  descricao text,
  endpoint_base text,
  metodo_auth character varying,
  configuracoes jsonb,
  ativo boolean DEFAULT true,
  created_at timestamp without time zone DEFAULT now(),
  updated_at timestamp without time zone DEFAULT now(),
  CONSTRAINT conectores_pkey PRIMARY KEY (id)
);

CREATE TABLE public.consumos (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  projeto_id uuid,
  usuario_id uuid,
  modelo_id uuid,
  origem character varying,
  tokens_input integer,
  tokens_output integer,
  custo_total numeric,
  referencia_id uuid,
  created_at timestamp without time zone DEFAULT now(),
  CONSTRAINT consumos_pkey PRIMARY KEY (id)
);

CREATE TABLE public.email_verifications (
  token text NOT NULL,
  usuario_id uuid NOT NULL,
  email text NOT NULL,
  expires_at timestamp with time zone NOT NULL,
  used_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT email_verifications_pkey PRIMARY KEY (token)
);

CREATE TABLE public.feedbacks (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  usuario_id uuid NOT NULL,
  projeto_id uuid,
  assunto character varying NOT NULL,
  categoria character varying NOT NULL CHECK (categoria::text = ANY (ARRAY['sugestao'::character varying, 'reclamacao'::character varying, 'melhoria'::character varying, 'duvida'::character varying, 'outro'::character varying]::text[])),
  status character varying NOT NULL DEFAULT 'novo'::character varying CHECK (status::text = ANY (ARRAY['novo'::character varying, 'em_andamento'::character varying, 'respondido'::character varying, 'fechado'::character varying]::text[])),
  admin_visualizado boolean NOT NULL DEFAULT false,
  usuario_visualizado boolean NOT NULL DEFAULT true,
  closed_at timestamp without time zone,
  created_at timestamp without time zone NOT NULL DEFAULT now(),
  updated_at timestamp without time zone NOT NULL DEFAULT now(),
  CONSTRAINT feedbacks_pkey PRIMARY KEY (id)
);

CREATE TABLE public.feedback_mensagens (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  feedback_id uuid NOT NULL,
  usuario_id uuid,
  remetente_tipo character varying NOT NULL CHECK (remetente_tipo::text = ANY (ARRAY['usuario'::character varying, 'admin'::character varying]::text[])),
  mensagem text NOT NULL,
  lida_pelo_admin boolean NOT NULL DEFAULT false,
  lida_pelo_usuario boolean NOT NULL DEFAULT false,
  created_at timestamp without time zone NOT NULL DEFAULT now(),
  updated_at timestamp without time zone NOT NULL DEFAULT now(),
  CONSTRAINT feedback_mensagens_pkey PRIMARY KEY (id)
);

CREATE TABLE public.logs (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  projeto_id uuid,
  tipo character varying,
  origem character varying,
  descricao text,
  payload jsonb,
  created_at timestamp without time zone DEFAULT now(),
  CONSTRAINT logs_pkey PRIMARY KEY (id)
);

CREATE TABLE public.mensagens (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  chat_id uuid,
  role character varying NOT NULL,
  conteudo text NOT NULL,
  tokens_input integer,
  tokens_output integer,
  custo numeric,
  metadata jsonb,
  created_at timestamp without time zone DEFAULT now(),
  canal character varying NOT NULL DEFAULT 'web'::character varying,
  identificador_externo text,
  CONSTRAINT mensagens_pkey PRIMARY KEY (id)
);

CREATE TABLE public.projetos_assinaturas (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  projeto_id uuid NOT NULL,
  plano_id uuid NOT NULL,
  status character varying NOT NULL DEFAULT 'ativo'::character varying CHECK (status::text = ANY (ARRAY['ativo'::character varying::text, 'cancelado'::character varying::text, 'trial'::character varying::text, 'suspenso'::character varying::text, 'aguardando_confirmacao'::character varying::text])),
  data_inicio timestamp without time zone DEFAULT now(),
  data_fim timestamp without time zone,
  renovar_automatico boolean DEFAULT true,
  created_at timestamp without time zone DEFAULT now(),
  updated_at timestamp without time zone DEFAULT now(),
  CONSTRAINT projetos_assinaturas_pkey PRIMARY KEY (id)
);

CREATE TABLE public.projetos_checkout_intencoes (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  projeto_id uuid NOT NULL,
  usuario_id uuid,
  usuario_email character varying,
  tipo character varying NOT NULL CHECK (tipo::text = ANY (ARRAY['plan'::character varying::text, 'topup'::character varying::text])),
  status character varying NOT NULL DEFAULT 'pendente'::character varying CHECK (status::text = ANY (ARRAY['pendente'::character varying::text, 'confirmado'::character varying::text, 'falhou'::character varying::text, 'expirado'::character varying::text])),
  plano_id uuid,
  plano_nome character varying,
  plano_key character varying,
  valor numeric,
  tokens integer,
  checkout_url text,
  origem character varying NOT NULL DEFAULT 'mercado_pago'::character varying,
  mercado_pago_recurso_tipo character varying,
  mercado_pago_recurso_id character varying,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  confirmado_at timestamp without time zone,
  created_at timestamp without time zone NOT NULL DEFAULT now(),
  updated_at timestamp without time zone NOT NULL DEFAULT now(),
  CONSTRAINT projetos_checkout_intencoes_pkey PRIMARY KEY (id)
);

CREATE TABLE public.projetos_ciclos_uso (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  projeto_id uuid NOT NULL,
  data_inicio timestamp without time zone NOT NULL,
  data_fim timestamp without time zone NOT NULL,
  tokens_input integer DEFAULT 0,
  tokens_output integer DEFAULT 0,
  custo_total numeric DEFAULT 0,
  fechado boolean DEFAULT false,
  created_at timestamp without time zone DEFAULT now(),
  limite_tokens_input integer,
  limite_tokens_output integer,
  limite_tokens_total integer,
  limite_custo numeric,
  custo_token_excedente numeric,
  permitir_excedente boolean DEFAULT false,
  alerta_80 boolean DEFAULT false,
  alerta_100 boolean DEFAULT false,
  bloqueado boolean DEFAULT false,
  excedente_tokens integer DEFAULT 0,
  excedente_custo numeric DEFAULT 0,
  plano_id uuid,
  CONSTRAINT projetos_ciclos_uso_pkey PRIMARY KEY (id)
);

CREATE TABLE public.projetos_planos (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  projeto_id uuid NOT NULL UNIQUE,
  nome_plano character varying NOT NULL DEFAULT 'padrao'::character varying,
  modelo_referencia character varying NOT NULL DEFAULT 'gpt-4o-mini'::character varying,
  limite_tokens_input_mensal integer,
  limite_tokens_output_mensal integer,
  limite_tokens_total_mensal integer,
  limite_custo_mensal numeric,
  auto_bloquear boolean NOT NULL DEFAULT true,
  bloqueado boolean NOT NULL DEFAULT false,
  bloqueado_motivo text,
  observacoes text,
  created_at timestamp without time zone NOT NULL DEFAULT now(),
  updated_at timestamp without time zone NOT NULL DEFAULT now(),
  plano_id uuid,
  CONSTRAINT projetos_planos_pkey PRIMARY KEY (id)
);

CREATE TABLE public.segredos (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  projeto_id uuid,
  nome character varying,
  tipo character varying,
  valor text,
  created_at timestamp without time zone DEFAULT now(),
  CONSTRAINT segredos_pkey PRIMARY KEY (id)
);

CREATE TABLE public.tokens_avulsos (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  projeto_id uuid NOT NULL,
  tokens integer NOT NULL,
  custo numeric DEFAULT 0,
  origem character varying DEFAULT 'manual'::character varying,
  utilizado boolean DEFAULT false,
  created_at timestamp without time zone DEFAULT now(),
  tokens_utilizados integer NOT NULL DEFAULT 0,
  CONSTRAINT tokens_avulsos_pkey PRIMARY KEY (id)
);

CREATE TABLE public.usuarios_limites_ia (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  usuario_id uuid NOT NULL,
  projeto_id uuid NOT NULL,
  papel_financeiro character varying NOT NULL DEFAULT 'padrao'::character varying,
  modelo_referencia character varying NOT NULL DEFAULT 'gpt-4o-mini'::character varying,
  limite_tokens_input_mensal integer,
  limite_tokens_output_mensal integer,
  limite_tokens_total_mensal integer,
  limite_custo_mensal numeric,
  auto_bloquear boolean NOT NULL DEFAULT true,
  bloqueado boolean NOT NULL DEFAULT false,
  bloqueado_motivo text,
  observacoes text,
  created_at timestamp without time zone NOT NULL DEFAULT now(),
  updated_at timestamp without time zone NOT NULL DEFAULT now(),
  CONSTRAINT usuarios_limites_ia_pkey PRIMARY KEY (id)
);

CREATE TABLE public.usuarios_projetos (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  usuario_id uuid,
  projeto_id uuid,
  papel character varying DEFAULT 'admin'::character varying,
  created_at timestamp without time zone DEFAULT now(),
  CONSTRAINT usuarios_projetos_pkey PRIMARY KEY (id)
);

CREATE TABLE public.whatsapp_handoff_contatos (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  projeto_id uuid NOT NULL,
  canal_whatsapp_id uuid,
  usuario_id uuid,
  nome character varying NOT NULL,
  numero character varying NOT NULL,
  papel character varying,
  observacoes text,
  ativo boolean NOT NULL DEFAULT true,
  receber_alertas boolean NOT NULL DEFAULT true,
  created_at timestamp without time zone NOT NULL DEFAULT now(),
  updated_at timestamp without time zone NOT NULL DEFAULT now(),
  CONSTRAINT whatsapp_handoff_contatos_pkey PRIMARY KEY (id)
);

-- Chaves estrangeiras adicionadas depois da criacao das tabelas para evitar erro de ordem.
ALTER TABLE public.projetos
  ADD CONSTRAINT projetos_modelo_id_fkey
  FOREIGN KEY (modelo_id) REFERENCES public.modelos(id);
ALTER TABLE public.projetos
  ADD CONSTRAINT projetos_owner_user_id_fkey
  FOREIGN KEY (owner_user_id) REFERENCES public.usuarios(id);
ALTER TABLE public.agentes
  ADD CONSTRAINT agentes_projeto_id_fkey
  FOREIGN KEY (projeto_id) REFERENCES public.projetos(id);
ALTER TABLE public.agentes
  ADD CONSTRAINT agentes_modelo_id_fkey
  FOREIGN KEY (modelo_id) REFERENCES public.modelos(id);
ALTER TABLE public.apis
  ADD CONSTRAINT apis_projeto_id_fkey
  FOREIGN KEY (projeto_id) REFERENCES public.projetos(id);
ALTER TABLE public.agenda_horarios
  ADD CONSTRAINT agenda_horarios_projeto_id_fkey
  FOREIGN KEY (projeto_id) REFERENCES public.projetos(id);
ALTER TABLE public.agenda_horarios
  ADD CONSTRAINT agenda_horarios_agente_id_fkey
  FOREIGN KEY (agente_id) REFERENCES public.agentes(id);
ALTER TABLE public.chats
  ADD CONSTRAINT chats_projeto_id_fkey
  FOREIGN KEY (projeto_id) REFERENCES public.projetos(id);
ALTER TABLE public.chats
  ADD CONSTRAINT chats_usuario_id_fkey
  FOREIGN KEY (usuario_id) REFERENCES public.usuarios(id);
ALTER TABLE public.chats
  ADD CONSTRAINT chats_modelo_id_fkey
  FOREIGN KEY (modelo_id) REFERENCES public.modelos(id);
ALTER TABLE public.chats
  ADD CONSTRAINT chats_agente_id_fkey
  FOREIGN KEY (agente_id) REFERENCES public.agentes(id);
ALTER TABLE public.chats
  ADD CONSTRAINT chats_projeto_agente_fkey
  FOREIGN KEY (projeto_id, agente_id) REFERENCES public.agentes(projeto_id, id);
ALTER TABLE public.agenda_reservas
  ADD CONSTRAINT agenda_reservas_agente_id_fkey
  FOREIGN KEY (agente_id) REFERENCES public.agentes(id);
ALTER TABLE public.agenda_reservas
  ADD CONSTRAINT agenda_reservas_horario_id_fkey
  FOREIGN KEY (horario_id) REFERENCES public.agenda_horarios(id);
ALTER TABLE public.agenda_reservas
  ADD CONSTRAINT agenda_reservas_projeto_id_fkey
  FOREIGN KEY (projeto_id) REFERENCES public.projetos(id);
ALTER TABLE public.agenda_reservas
  ADD CONSTRAINT agenda_reservas_chat_id_fkey
  FOREIGN KEY (chat_id) REFERENCES public.chats(id);
ALTER TABLE public.agente_api
  ADD CONSTRAINT agente_api_agente_id_fkey
  FOREIGN KEY (agente_id) REFERENCES public.agentes(id);
ALTER TABLE public.agente_api
  ADD CONSTRAINT agente_api_api_id_fkey
  FOREIGN KEY (api_id) REFERENCES public.apis(id);
ALTER TABLE public.agente_arquivos
  ADD CONSTRAINT agente_arquivos_agente_id_fkey
  FOREIGN KEY (agente_id) REFERENCES public.agentes(id);
ALTER TABLE public.agente_arquivos
  ADD CONSTRAINT agente_arquivos_projeto_id_fkey
  FOREIGN KEY (projeto_id) REFERENCES public.projetos(id);
ALTER TABLE public.agente_arquivos
  ADD CONSTRAINT agente_arquivos_projeto_agente_fkey
  FOREIGN KEY (projeto_id, agente_id) REFERENCES public.agentes(projeto_id, id);
ALTER TABLE public.agente_versoes
  ADD CONSTRAINT agente_versoes_agente_id_fkey
  FOREIGN KEY (agente_id) REFERENCES public.agentes(id);
ALTER TABLE public.agente_versoes
  ADD CONSTRAINT agente_versoes_projeto_id_fkey
  FOREIGN KEY (projeto_id) REFERENCES public.projetos(id);
ALTER TABLE public.agente_versoes
  ADD CONSTRAINT agente_versoes_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES public.usuarios(id);
ALTER TABLE public.agente_versoes
  ADD CONSTRAINT agente_versoes_projeto_agente_fkey
  FOREIGN KEY (projeto_id, agente_id) REFERENCES public.agentes(projeto_id, id);
ALTER TABLE public.api_campos
  ADD CONSTRAINT api_campos_api_id_fkey
  FOREIGN KEY (api_id) REFERENCES public.apis(id);
ALTER TABLE public.api_versoes
  ADD CONSTRAINT api_versoes_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES public.usuarios(id);
ALTER TABLE public.api_versoes
  ADD CONSTRAINT api_versoes_api_id_fkey
  FOREIGN KEY (api_id) REFERENCES public.apis(id);
ALTER TABLE public.api_versoes
  ADD CONSTRAINT api_versoes_projeto_id_fkey
  FOREIGN KEY (projeto_id) REFERENCES public.projetos(id);
ALTER TABLE public.avisos_leituras
  ADD CONSTRAINT avisos_leituras_usuario_id_fkey
  FOREIGN KEY (usuario_id) REFERENCES public.usuarios(id);
ALTER TABLE public.canais_whatsapp
  ADD CONSTRAINT canais_whatsapp_projeto_id_fkey
  FOREIGN KEY (projeto_id) REFERENCES public.projetos(id);
ALTER TABLE public.canais_whatsapp
  ADD CONSTRAINT canais_whatsapp_agente_id_fkey
  FOREIGN KEY (agente_id) REFERENCES public.agentes(id);
ALTER TABLE public.canais_whatsapp
  ADD CONSTRAINT canais_whatsapp_projeto_agente_fkey
  FOREIGN KEY (projeto_id, agente_id) REFERENCES public.agentes(projeto_id, id);
ALTER TABLE public.chat_widgets
  ADD CONSTRAINT chat_widgets_projeto_id_fkey
  FOREIGN KEY (projeto_id) REFERENCES public.projetos(id);
ALTER TABLE public.chat_widgets
  ADD CONSTRAINT chat_widgets_agente_id_fkey
  FOREIGN KEY (agente_id) REFERENCES public.agentes(id);
ALTER TABLE public.chat_widgets
  ADD CONSTRAINT chat_widgets_projeto_agente_fkey
  FOREIGN KEY (projeto_id, agente_id) REFERENCES public.agentes(projeto_id, id);
ALTER TABLE public.chat_handoffs
  ADD CONSTRAINT chat_handoffs_chat_id_fkey
  FOREIGN KEY (chat_id) REFERENCES public.chats(id);
ALTER TABLE public.chat_handoffs
  ADD CONSTRAINT chat_handoffs_projeto_id_fkey
  FOREIGN KEY (projeto_id) REFERENCES public.projetos(id);
ALTER TABLE public.chat_handoffs
  ADD CONSTRAINT chat_handoffs_canal_whatsapp_id_fkey
  FOREIGN KEY (canal_whatsapp_id) REFERENCES public.canais_whatsapp(id);
ALTER TABLE public.chat_handoffs
  ADD CONSTRAINT chat_handoffs_requested_by_usuario_id_fkey
  FOREIGN KEY (requested_by_usuario_id) REFERENCES public.usuarios(id);
ALTER TABLE public.chat_handoffs
  ADD CONSTRAINT chat_handoffs_claimed_by_usuario_id_fkey
  FOREIGN KEY (claimed_by_usuario_id) REFERENCES public.usuarios(id);
ALTER TABLE public.chat_handoffs
  ADD CONSTRAINT chat_handoffs_released_by_usuario_id_fkey
  FOREIGN KEY (released_by_usuario_id) REFERENCES public.usuarios(id);
ALTER TABLE public.chat_handoff_eventos
  ADD CONSTRAINT chat_handoff_eventos_handoff_id_fkey
  FOREIGN KEY (handoff_id) REFERENCES public.chat_handoffs(id);
ALTER TABLE public.chat_handoff_eventos
  ADD CONSTRAINT chat_handoff_eventos_chat_id_fkey
  FOREIGN KEY (chat_id) REFERENCES public.chats(id);
ALTER TABLE public.chat_handoff_eventos
  ADD CONSTRAINT chat_handoff_eventos_projeto_id_fkey
  FOREIGN KEY (projeto_id) REFERENCES public.projetos(id);
ALTER TABLE public.chat_handoff_eventos
  ADD CONSTRAINT chat_handoff_eventos_usuario_id_fkey
  FOREIGN KEY (usuario_id) REFERENCES public.usuarios(id);
ALTER TABLE public.conectores
  ADD CONSTRAINT conectores_projeto_id_fkey
  FOREIGN KEY (projeto_id) REFERENCES public.projetos(id);
ALTER TABLE public.conectores
  ADD CONSTRAINT conectores_agente_id_fkey
  FOREIGN KEY (agente_id) REFERENCES public.agentes(id);
ALTER TABLE public.conectores
  ADD CONSTRAINT conectores_projeto_agente_fkey_v2
  FOREIGN KEY (projeto_id, agente_id) REFERENCES public.agentes(projeto_id, id);
ALTER TABLE public.consumos
  ADD CONSTRAINT consumos_projeto_id_fkey
  FOREIGN KEY (projeto_id) REFERENCES public.projetos(id);
ALTER TABLE public.consumos
  ADD CONSTRAINT consumos_usuario_id_fkey
  FOREIGN KEY (usuario_id) REFERENCES public.usuarios(id);
ALTER TABLE public.consumos
  ADD CONSTRAINT consumos_modelo_id_fkey
  FOREIGN KEY (modelo_id) REFERENCES public.modelos(id);
ALTER TABLE public.email_verifications
  ADD CONSTRAINT email_verifications_usuario_id_fkey
  FOREIGN KEY (usuario_id) REFERENCES public.usuarios(id);
ALTER TABLE public.feedbacks
  ADD CONSTRAINT feedbacks_usuario_id_fkey
  FOREIGN KEY (usuario_id) REFERENCES public.usuarios(id);
ALTER TABLE public.feedbacks
  ADD CONSTRAINT feedbacks_projeto_id_fkey
  FOREIGN KEY (projeto_id) REFERENCES public.projetos(id);
ALTER TABLE public.feedback_mensagens
  ADD CONSTRAINT feedback_mensagens_feedback_id_fkey
  FOREIGN KEY (feedback_id) REFERENCES public.feedbacks(id);
ALTER TABLE public.feedback_mensagens
  ADD CONSTRAINT feedback_mensagens_usuario_id_fkey
  FOREIGN KEY (usuario_id) REFERENCES public.usuarios(id);
ALTER TABLE public.logs
  ADD CONSTRAINT logs_projeto_id_fkey
  FOREIGN KEY (projeto_id) REFERENCES public.projetos(id);
ALTER TABLE public.mensagens
  ADD CONSTRAINT mensagens_chat_id_fkey
  FOREIGN KEY (chat_id) REFERENCES public.chats(id);
ALTER TABLE public.projetos_assinaturas
  ADD CONSTRAINT fk_assinatura_projeto
  FOREIGN KEY (projeto_id) REFERENCES public.projetos(id);
ALTER TABLE public.projetos_assinaturas
  ADD CONSTRAINT fk_assinatura_plano
  FOREIGN KEY (plano_id) REFERENCES public.planos(id);
ALTER TABLE public.projetos_checkout_intencoes
  ADD CONSTRAINT projetos_checkout_intencoes_projeto_id_fkey
  FOREIGN KEY (projeto_id) REFERENCES public.projetos(id);
ALTER TABLE public.projetos_checkout_intencoes
  ADD CONSTRAINT projetos_checkout_intencoes_usuario_id_fkey
  FOREIGN KEY (usuario_id) REFERENCES public.usuarios(id);
ALTER TABLE public.projetos_checkout_intencoes
  ADD CONSTRAINT projetos_checkout_intencoes_plano_id_fkey
  FOREIGN KEY (plano_id) REFERENCES public.planos(id);
ALTER TABLE public.projetos_ciclos_uso
  ADD CONSTRAINT fk_ciclo_projeto
  FOREIGN KEY (projeto_id) REFERENCES public.projetos(id);
ALTER TABLE public.projetos_ciclos_uso
  ADD CONSTRAINT fk_ciclo_plano
  FOREIGN KEY (plano_id) REFERENCES public.planos(id);
ALTER TABLE public.projetos_planos
  ADD CONSTRAINT projetos_planos_projeto_id_fkey
  FOREIGN KEY (projeto_id) REFERENCES public.projetos(id);
ALTER TABLE public.projetos_planos
  ADD CONSTRAINT projetos_planos_plano_id_fkey
  FOREIGN KEY (plano_id) REFERENCES public.planos(id);
ALTER TABLE public.segredos
  ADD CONSTRAINT segredos_projeto_id_fkey
  FOREIGN KEY (projeto_id) REFERENCES public.projetos(id);
ALTER TABLE public.tokens_avulsos
  ADD CONSTRAINT tokens_avulsos_projeto_id_fkey
  FOREIGN KEY (projeto_id) REFERENCES public.projetos(id);
ALTER TABLE public.usuarios_limites_ia
  ADD CONSTRAINT usuarios_limites_ia_usuario_id_fkey
  FOREIGN KEY (usuario_id) REFERENCES public.usuarios(id);
ALTER TABLE public.usuarios_limites_ia
  ADD CONSTRAINT usuarios_limites_ia_projeto_id_fkey
  FOREIGN KEY (projeto_id) REFERENCES public.projetos(id);
ALTER TABLE public.usuarios_projetos
  ADD CONSTRAINT usuarios_projetos_usuario_id_fkey
  FOREIGN KEY (usuario_id) REFERENCES public.usuarios(id);
ALTER TABLE public.usuarios_projetos
  ADD CONSTRAINT usuarios_projetos_projeto_id_fkey
  FOREIGN KEY (projeto_id) REFERENCES public.projetos(id);
ALTER TABLE public.whatsapp_handoff_contatos
  ADD CONSTRAINT whatsapp_handoff_contatos_projeto_id_fkey
  FOREIGN KEY (projeto_id) REFERENCES public.projetos(id);
ALTER TABLE public.whatsapp_handoff_contatos
  ADD CONSTRAINT whatsapp_handoff_contatos_canal_whatsapp_id_fkey
  FOREIGN KEY (canal_whatsapp_id) REFERENCES public.canais_whatsapp(id);
ALTER TABLE public.whatsapp_handoff_contatos
  ADD CONSTRAINT whatsapp_handoff_contatos_usuario_id_fkey
  FOREIGN KEY (usuario_id) REFERENCES public.usuarios(id);

-- Indices para consultas, joins e limpezas frequentes.
CREATE UNIQUE INDEX usuarios_projetos_usuario_projeto_key
  ON public.usuarios_projetos (usuario_id, projeto_id);
CREATE UNIQUE INDEX chat_widgets_slug_key
  ON public.chat_widgets (slug);
CREATE UNIQUE INDEX canais_whatsapp_projeto_numero_key
  ON public.canais_whatsapp (projeto_id, numero);
CREATE UNIQUE INDEX agente_versoes_agente_version_key
  ON public.agente_versoes (agente_id, version_number);
CREATE UNIQUE INDEX api_versoes_api_version_key
  ON public.api_versoes (api_id, version_number);

CREATE INDEX projetos_owner_user_id_idx
  ON public.projetos (owner_user_id);
CREATE INDEX projetos_slug_idx
  ON public.projetos (slug);
CREATE INDEX agentes_modelo_id_idx
  ON public.agentes (modelo_id);
CREATE INDEX apis_projeto_updated_idx
  ON public.apis (projeto_id, updated_at DESC);
CREATE INDEX api_campos_api_id_idx
  ON public.api_campos (api_id);
CREATE INDEX api_versoes_projeto_api_idx
  ON public.api_versoes (projeto_id, api_id);
CREATE INDEX agente_api_agente_id_idx
  ON public.agente_api (agente_id);
CREATE INDEX agente_api_api_id_idx
  ON public.agente_api (api_id);
CREATE INDEX agente_arquivos_projeto_agente_idx
  ON public.agente_arquivos (projeto_id, agente_id);
CREATE INDEX agente_versoes_projeto_agente_idx
  ON public.agente_versoes (projeto_id, agente_id);
CREATE INDEX agenda_horarios_projeto_agente_idx
  ON public.agenda_horarios (projeto_id, agente_id);
CREATE INDEX agenda_horarios_data_inicio_idx
  ON public.agenda_horarios (data_inicio);
CREATE INDEX agenda_reservas_projeto_horario_idx
  ON public.agenda_reservas (projeto_id, horario_reservado DESC);
CREATE INDEX agenda_reservas_chat_id_idx
  ON public.agenda_reservas (chat_id);
CREATE INDEX canais_whatsapp_projeto_agente_idx
  ON public.canais_whatsapp (projeto_id, agente_id);
CREATE INDEX canais_whatsapp_projeto_agente_status_idx
  ON public.canais_whatsapp (projeto_id, agente_id, status, updated_at DESC);
CREATE INDEX chat_widgets_projeto_agente_idx
  ON public.chat_widgets (projeto_id, agente_id);
CREATE INDEX chats_projeto_updated_idx
  ON public.chats (projeto_id, updated_at DESC);
CREATE INDEX chats_agente_id_idx
  ON public.chats (agente_id);
CREATE INDEX chats_usuario_id_idx
  ON public.chats (usuario_id);
CREATE INDEX chats_externo_idx
  ON public.chats (projeto_id, canal, identificador_externo);
CREATE INDEX chat_handoffs_projeto_status_idx
  ON public.chat_handoffs (projeto_id, status);
CREATE INDEX chat_handoff_eventos_handoff_created_idx
  ON public.chat_handoff_eventos (handoff_id, created_at DESC);
CREATE INDEX conectores_projeto_agente_idx
  ON public.conectores (projeto_id, agente_id);
CREATE INDEX consumos_projeto_created_idx
  ON public.consumos (projeto_id, created_at DESC);
CREATE INDEX consumos_usuario_id_idx
  ON public.consumos (usuario_id);
CREATE INDEX email_verifications_usuario_id_idx
  ON public.email_verifications (usuario_id);
CREATE INDEX feedbacks_usuario_status_idx
  ON public.feedbacks (usuario_id, status);
CREATE INDEX feedbacks_projeto_status_idx
  ON public.feedbacks (projeto_id, status);
CREATE INDEX feedback_mensagens_feedback_created_idx
  ON public.feedback_mensagens (feedback_id, created_at);
CREATE INDEX logs_projeto_created_idx
  ON public.logs (projeto_id, created_at DESC);
CREATE INDEX logs_tipo_created_idx
  ON public.logs (tipo, created_at DESC);
CREATE INDEX mensagens_chat_created_idx
  ON public.mensagens (chat_id, created_at);
CREATE INDEX projetos_assinaturas_projeto_status_idx
  ON public.projetos_assinaturas (projeto_id, status);
CREATE INDEX projetos_checkout_intencoes_projeto_status_idx
  ON public.projetos_checkout_intencoes (projeto_id, status);
CREATE INDEX projetos_ciclos_uso_projeto_periodo_idx
  ON public.projetos_ciclos_uso (projeto_id, data_inicio, data_fim);
CREATE INDEX segredos_projeto_id_idx
  ON public.segredos (projeto_id);
CREATE INDEX tokens_avulsos_projeto_utilizado_idx
  ON public.tokens_avulsos (projeto_id, utilizado);
CREATE INDEX usuarios_limites_ia_usuario_projeto_idx
  ON public.usuarios_limites_ia (usuario_id, projeto_id);
CREATE INDEX usuarios_projetos_projeto_id_idx
  ON public.usuarios_projetos (projeto_id);
CREATE INDEX whatsapp_handoff_contatos_projeto_idx
  ON public.whatsapp_handoff_contatos (projeto_id);

-- RLS habilitado para evitar exposicao direta via chaves anon/authenticated do Supabase.
ALTER TABLE public.modelos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usuarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.planos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projetos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agentes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.apis ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agenda_horarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agenda_reservas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agente_api ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agente_arquivos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agente_versoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.api_campos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.api_versoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.avisos_leituras ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.canais_whatsapp ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_widgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_handoffs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_handoff_eventos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conectores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.consumos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_verifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feedbacks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feedback_mensagens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mensagens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projetos_assinaturas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projetos_checkout_intencoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projetos_ciclos_uso ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projetos_planos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.segredos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tokens_avulsos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usuarios_limites_ia ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usuarios_projetos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_handoff_contatos ENABLE ROW LEVEL SECURITY;

-- O backend do projeto usa service role; se usar anon key diretamente, crie policies antes de expor as tabelas.
