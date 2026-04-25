import { getSupabaseAdminClient } from "@/lib/supabase-admin"

import { STORE_FIELDS } from "./constants"
import {
  normalizeStore,
  sanitizeColor,
  sanitizeDomain,
  sanitizeFeaturedProducts,
  sanitizeMenuLinks,
  sanitizePhone,
  sanitizeSocialLinks,
  sanitizeText,
  slugify,
} from "./sanitize"

async function buildUniqueStoreSlug(supabase, value, currentId = null) {
  const baseSlug = slugify(value) || "loja"
  let nextSlug = baseSlug
  let index = 2

  while (true) {
    let query = supabase.from("mercadolivre_lojas").select("id").eq("slug", nextSlug).limit(1)
    if (currentId) {
      query = query.neq("id", currentId)
    }

    const { data, error } = await query
    if (error) {
      console.error("[mercado-livre-store] failed to validate slug", error)
      return nextSlug
    }

    if (!data?.length) {
      return nextSlug
    }

    nextSlug = `${baseSlug}-${index}`
    index += 1
  }
}

function buildStorePayload(project, input, current = null) {
  const normalizedName = sanitizeText(input?.name || input?.nome, 120) || sanitizeText(project?.name || project?.nome, 120) || "Loja"
  return {
    projeto_id: project.id,
    nome: normalizedName,
    titulo: sanitizeText(input?.title || input?.titulo, 160),
    texto_principal: sanitizeText(input?.headline || input?.textoPrincipal, 600),
    sobre_nos: sanitizeText(input?.about || input?.sobreNos, 1200),
    cor_primaria: sanitizeColor(input?.accentColor || input?.corPrimaria),
    logo_url: sanitizeText(input?.logoUrl, 500),
    tema: "light",
    ativo: input?.active === true,
    chat_widget_ativo: input?.chatWidgetActive !== false,
    chat_widget_id: sanitizeText(input?.chatWidgetId, 80) || null,
    email_contato: sanitizeText(input?.contactEmail, 120),
    telefone_contato: sanitizePhone(input?.contactPhone),
    whatsapp_contato: sanitizePhone(input?.contactWhatsApp),
    endereco: sanitizeText(input?.contactAddress, 260),
    dominio_personalizado: sanitizeDomain(input?.customDomain) || null,
    dominio_ativo: input?.customDomainActive === true,
    dominio_status: sanitizeText(input?.customDomainStatus, 32) || "pending",
    dominio_observacoes: sanitizeText(input?.customDomainNotes, 500),
    footer_texto: sanitizeText(input?.footerText, 240),
    menu_links: sanitizeMenuLinks(input?.menuLinks),
    social_links: sanitizeSocialLinks(input?.socialLinks),
    destaques: sanitizeFeaturedProducts(input?.featuredProducts),
    updated_at: new Date().toISOString(),
    slug: sanitizeText(input?.slug, 80) || current?.slug || `${slugify(project?.slug || project?.name || "loja")}-ml`,
  }
}

async function validateStorePayload(supabase, project, payload) {
  if (!payload.nome) {
    return "Informe o nome da loja."
  }

  if (!payload.slug) {
    return "Informe um slug valido para a loja."
  }

  if (payload.dominio_ativo && !payload.dominio_personalizado) {
    return "Informe um dominio valido antes de ativar o dominio proprio."
  }

  if (payload.chat_widget_id) {
    const { data, error } = await supabase
      .from("chat_widgets")
      .select("id")
      .eq("id", payload.chat_widget_id)
      .eq("projeto_id", project.id)
      .limit(1)
      .maybeSingle()

    if (error) {
      console.error("[mercado-livre-store] failed to validate store widget", error)
      return "Nao foi possivel validar o widget selecionado."
    }

    if (!data?.id) {
      return "O widget selecionado nao pertence a este projeto."
    }
  }

  return null
}

async function getMercadoLivreStoreByProjectId(projectId, options = {}) {
  if (!projectId) {
    return null
  }

  const supabase = options.supabase ?? getSupabaseAdminClient()
  const { data, error } = await supabase
    .from("mercadolivre_lojas")
    .select(STORE_FIELDS)
    .eq("projeto_id", projectId)
    .maybeSingle()

  if (error) {
    console.error("[mercado-livre-store] failed to load store by project", error)
    return null
  }

  return data || null
}

async function getMercadoLivreStoreSettingsForProject(project, options = {}) {
  if (!project?.id) {
    return null
  }

  const row = await getMercadoLivreStoreByProjectId(project.id, options)
  return normalizeStore(row, project)
}

async function upsertMercadoLivreStoreForProject(project, input = {}, options = {}) {
  if (!project?.id) {
    return { store: null, error: "Projeto nao encontrado." }
  }

  const supabase = options.supabase ?? getSupabaseAdminClient()
  const current = await getMercadoLivreStoreByProjectId(project.id, { supabase })
  const payload = buildStorePayload(project, input, current)
  const validationError = await validateStorePayload(supabase, project, payload)
  if (validationError) {
    return { store: null, error: validationError }
  }

  payload.slug = await buildUniqueStoreSlug(supabase, payload.slug, current?.id || null)

  const query = supabase
    .from("mercadolivre_lojas")
    .upsert(
      current?.id
        ? {
            id: current.id,
            created_at: current.created_at,
            ...payload,
          }
        : payload,
      { onConflict: "projeto_id" }
    )
    .select(STORE_FIELDS)
    .maybeSingle()

  const { data, error } = await query
  if (error || !data) {
    console.error("[mercado-livre-store] failed to save store", error)
    return { store: null, error: "Nao foi possivel salvar a loja do Mercado Livre." }
  }

  return {
    store: normalizeStore(data, project),
    error: null,
  }
}

export { getMercadoLivreStoreByProjectId, getMercadoLivreStoreSettingsForProject, upsertMercadoLivreStoreForProject }
