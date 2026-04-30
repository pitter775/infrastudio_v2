const STORE_BASE_FIELDS = [
  "id",
  "projeto_id",
  "slug",
  "nome",
  "titulo",
  "texto_principal",
  "sobre_nos",
  "cor_primaria",
  "logo_url",
  "tema",
  "ativo",
  "chat_widget_ativo",
  "chat_widget_id",
  "chat_contexto_completo",
  "email_contato",
  "telefone_contato",
  "whatsapp_contato",
  "endereco",
  "footer_texto",
  "menu_links",
  "social_links",
  "created_at",
  "updated_at",
]

const STORE_DOMAIN_FIELDS = [
  "dominio_personalizado",
  "dominio_ativo",
  "dominio_status",
  "dominio_observacoes",
]

export const STORE_FIELDS = [
  ...STORE_BASE_FIELDS,
  ...STORE_DOMAIN_FIELDS,
  "visual_config",
  "destaques",
].join(", ")

export const STORE_FIELDS_LEGACY = [...STORE_BASE_FIELDS, "destaques"].join(", ")

export function isMissingStoreDomainColumnError(error) {
  const message = String(error?.message || error || "")
  return /dominio_personalizado|dominio_ativo|dominio_status|dominio_observacoes|chat_contexto_completo|visual_config/i.test(message)
}
