import { getSupabaseAdminClient } from "@/lib/supabase-admin"

import { isMissingStoreDomainColumnError, STORE_FIELDS, STORE_FIELDS_LEGACY } from "./constants"
import {
  normalizeStore,
  sanitizeColor,
  sanitizeDomain,
  sanitizeFeaturedProducts,
  sanitizeMenuLinks,
  sanitizePhone,
  sanitizeSocialLinks,
  sanitizeText,
  sanitizeVisualConfig,
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

async function ensureStoreWidgetActive(supabase, projectId, widgetId) {
  const normalizedProjectId = sanitizeText(projectId, 80)
  const normalizedWidgetId = sanitizeText(widgetId, 80)

  if (!normalizedProjectId || !normalizedWidgetId) {
    return { widgetId: normalizedWidgetId || null, error: null }
  }

  const { data, error } = await supabase
    .from("chat_widgets")
    .update({
      ativo: true,
      updated_at: new Date().toISOString(),
    })
    .eq("id", normalizedWidgetId)
    .eq("projeto_id", normalizedProjectId)
    .select("id")
    .maybeSingle()

  if (error) {
    console.error("[mercado-livre-store] failed to auto-activate store widget", error)
    return { widgetId: null, error: "Nao foi possivel ativar o widget vinculado da loja." }
  }

  if (!data?.id) {
    return { widgetId: null, error: "O widget selecionado nao pertence a este projeto." }
  }

  return { widgetId: data.id, error: null }
}

async function buildUniqueWidgetSlug(supabase, value, currentId = null) {
  const baseSlug = slugify(value) || "chat"
  let nextSlug = baseSlug
  let index = 2

  while (true) {
    let query = supabase.from("chat_widgets").select("id").eq("slug", nextSlug).limit(1)
    if (currentId) {
      query = query.neq("id", currentId)
    }

    const { data, error } = await query
    if (error) {
      console.error("[mercado-livre-store] failed to validate widget slug", error)
      return nextSlug
    }

    if (!data?.length) {
      return nextSlug
    }

    nextSlug = `${baseSlug}-${index}`
    index += 1
  }
}

async function ensurePrimaryStoreWidget(supabase, project, currentStore = null) {
  const preferredWidgetId = sanitizeText(currentStore?.chat_widget_id, 80) || sanitizeText(project?.chatWidgets?.[0]?.id, 80) || null
  const { data: widgetRows, error } = await supabase
    .from("chat_widgets")
    .select("id, nome, slug, projeto_id, agente_id, ativo, created_at")
    .eq("projeto_id", project.id)
    .order("created_at", { ascending: true })

  if (error) {
    console.error("[mercado-livre-store] failed to load project widgets for restore", error)
    return { widget: null, error: "Nao foi possivel localizar o widget da loja." }
  }

  const list = Array.isArray(widgetRows) ? widgetRows : []
  const selectedWidget =
    list.find((item) => item.id === preferredWidgetId) ||
    list.find((item) => item.agente_id === project?.agent?.id) ||
    list[0] ||
    null
  const defaultStoreName = sanitizeText(currentStore?.nome, 120) || sanitizeText(project?.name || project?.nome, 120) || "Loja"
  const defaultWidgetName = `${defaultStoreName} Chat`
  const defaultWidgetSlug = await buildUniqueWidgetSlug(supabase, `${project?.slug || project?.name || project?.nome || "loja"}-chat`, selectedWidget?.id || null)

  if (selectedWidget?.id) {
    const { data: updatedWidget, error: updateError } = await supabase
      .from("chat_widgets")
      .update({
        nome: defaultWidgetName,
        slug: defaultWidgetSlug,
        agente_id: project?.agent?.id || selectedWidget.agente_id || null,
        ativo: true,
        updated_at: new Date().toISOString(),
      })
      .eq("id", selectedWidget.id)
      .eq("projeto_id", project.id)
      .select("id, nome, slug, projeto_id, agente_id, ativo")
      .maybeSingle()

    if (updateError || !updatedWidget?.id) {
      console.error("[mercado-livre-store] failed to restore selected store widget", updateError)
      return { widget: null, error: "Nao foi possivel restaurar o widget principal da loja." }
    }

    return { widget: updatedWidget, error: null }
  }

  const { data: createdWidget, error: createError } = await supabase
    .from("chat_widgets")
    .insert({
      nome: defaultWidgetName,
      slug: defaultWidgetSlug,
      projeto_id: project.id,
      agente_id: project?.agent?.id || null,
      dominio: "",
      whatsapp_celular: "",
      tema: "dark",
      cor_primaria: "#2563eb",
      fundo_transparente: true,
      ativo: true,
      updated_at: new Date().toISOString(),
    })
    .select("id, nome, slug, projeto_id, agente_id, ativo")
    .maybeSingle()

  if (createError || !createdWidget?.id) {
    console.error("[mercado-livre-store] failed to create fallback store widget", createError)
    return { widget: null, error: "Nao foi possivel criar o widget principal da loja." }
  }

  return { widget: createdWidget, error: null }
}

function buildStorePayload(project, input, current = null) {
  const normalizedName = sanitizeText(input?.name || input?.nome, 120) || sanitizeText(project?.name || project?.nome, 120) || "Loja"
  const active = input?.active === false || input?.ativo === false ? false : true
  const fallbackWidgetId =
    sanitizeText(input?.chatWidgetId, 80) ||
    sanitizeText(current?.chat_widget_id, 80) ||
    sanitizeText(project?.chatWidgets?.[0]?.id, 80) ||
    null

  return {
    projeto_id: project.id,
    nome: normalizedName,
    titulo: sanitizeText(input?.title || input?.titulo, 160),
    texto_principal: sanitizeText(input?.headline || input?.textoPrincipal, 600),
    sobre_nos: sanitizeText(input?.about || input?.sobreNos, 1200),
    cor_primaria: sanitizeColor(input?.accentColor || input?.corPrimaria),
    logo_url: sanitizeText(input?.logoUrl, 500),
    tema: "light",
    ativo: active,
    chat_widget_ativo: fallbackWidgetId ? true : input?.chatWidgetActive !== false,
    chat_widget_id: fallbackWidgetId,
    chat_contexto_completo: input?.chatContextFull === true,
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
    visual_config: sanitizeVisualConfig(input?.visualConfig),
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
  let { data, error } = await supabase
    .from("mercadolivre_lojas")
    .select(STORE_FIELDS)
    .eq("projeto_id", projectId)
    .maybeSingle()

  if (error && isMissingStoreDomainColumnError(error)) {
    const fallbackResult = await supabase
      .from("mercadolivre_lojas")
      .select(STORE_FIELDS_LEGACY)
      .eq("projeto_id", projectId)
      .maybeSingle()

    data = fallbackResult.data
    error = fallbackResult.error
  }

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
  if (payload.chat_widget_id) {
    const activation = await ensureStoreWidgetActive(supabase, project.id, payload.chat_widget_id)
    if (activation.error) {
      return { store: null, error: activation.error }
    }

    payload.chat_widget_id = activation.widgetId
    payload.chat_widget_ativo = Boolean(activation.widgetId)
  }
  const validationError = await validateStorePayload(supabase, project, payload)
  if (validationError) {
    return { store: null, error: validationError }
  }

  payload.slug = await buildUniqueStoreSlug(supabase, payload.slug, current?.id || null)

  const basePayload = current?.id
    ? {
        id: current.id,
        created_at: current.created_at,
        ...payload,
      }
    : payload

  let { data, error } = await supabase
    .from("mercadolivre_lojas")
    .upsert(basePayload, { onConflict: "projeto_id" })
    .select(STORE_FIELDS)
    .maybeSingle()

  if (error && isMissingStoreDomainColumnError(error)) {
    const {
      dominio_personalizado,
      dominio_ativo,
      dominio_status,
      dominio_observacoes,
      chat_contexto_completo,
      visual_config,
      ...legacyPayload
    } = basePayload

    const fallbackResult = await supabase
      .from("mercadolivre_lojas")
      .upsert(legacyPayload, { onConflict: "projeto_id" })
      .select(STORE_FIELDS_LEGACY)
      .maybeSingle()

    data = fallbackResult.data
    error = fallbackResult.error
  }

  if (error || !data) {
    console.error("[mercado-livre-store] failed to save store", error)
    return { store: null, error: "Nao foi possivel salvar a loja do Mercado Livre." }
  }

  return {
    store: normalizeStore(data, project),
    error: null,
  }
}

async function restoreMercadoLivreStoreDefaultsForProject(project, options = {}) {
  if (!project?.id) {
    return { store: null, error: "Projeto nao encontrado." }
  }

  const supabase = options.supabase ?? getSupabaseAdminClient()
  const current = await getMercadoLivreStoreByProjectId(project.id, { supabase })
  const widgetResult = await ensurePrimaryStoreWidget(supabase, project, current)
  if (widgetResult.error || !widgetResult.widget?.id) {
    return { store: null, error: widgetResult.error || "Nao foi possivel restaurar o widget principal." }
  }

  const defaultSlug = await buildUniqueStoreSlug(
    supabase,
    `${project?.slug || project?.name || project?.nome || "loja"}-chat`,
    current?.id || null,
  )
  const defaultName = sanitizeText(current?.nome, 120) || sanitizeText(project?.name || project?.nome, 120) || "Loja"
  const payload = {
    projeto_id: project.id,
    nome: defaultName,
    titulo: sanitizeText(current?.titulo, 160),
    texto_principal: sanitizeText(current?.texto_principal, 600),
    sobre_nos: sanitizeText(current?.sobre_nos, 1200),
    cor_primaria: sanitizeColor(current?.cor_primaria),
    logo_url: sanitizeText(current?.logo_url, 500),
    tema: "light",
    ativo: true,
    chat_widget_ativo: true,
    chat_widget_id: widgetResult.widget.id,
    chat_contexto_completo: current?.chat_contexto_completo === true,
    email_contato: sanitizeText(current?.email_contato, 120),
    telefone_contato: sanitizePhone(current?.telefone_contato),
    whatsapp_contato: sanitizePhone(current?.whatsapp_contato),
    endereco: sanitizeText(current?.endereco, 260),
    dominio_personalizado: sanitizeDomain(current?.dominio_personalizado) || null,
    dominio_ativo: current?.dominio_ativo === true,
    dominio_status: sanitizeText(current?.dominio_status, 32) || "pending",
    dominio_observacoes: sanitizeText(current?.dominio_observacoes, 500),
    footer_texto: sanitizeText(current?.footer_texto, 240),
    menu_links: sanitizeMenuLinks(current?.menu_links),
    social_links: sanitizeSocialLinks(current?.social_links),
    visual_config: sanitizeVisualConfig(current?.visual_config),
    destaques: sanitizeFeaturedProducts(current?.destaques),
    updated_at: new Date().toISOString(),
    slug: defaultSlug,
  }

  const basePayload = current?.id
    ? {
        id: current.id,
        created_at: current.created_at,
        ...payload,
      }
    : payload

  let { data, error } = await supabase
    .from("mercadolivre_lojas")
    .upsert(basePayload, { onConflict: "projeto_id" })
    .select(STORE_FIELDS)
    .maybeSingle()

  if (error && isMissingStoreDomainColumnError(error)) {
    const {
      dominio_personalizado,
      dominio_ativo,
      dominio_status,
      dominio_observacoes,
      chat_contexto_completo,
      visual_config,
      ...legacyPayload
    } = basePayload

    const fallbackResult = await supabase
      .from("mercadolivre_lojas")
      .upsert(legacyPayload, { onConflict: "projeto_id" })
      .select(STORE_FIELDS_LEGACY)
      .maybeSingle()

    data = fallbackResult.data
    error = fallbackResult.error
  }

  if (error || !data) {
    console.error("[mercado-livre-store] failed to restore store defaults", error)
    return { store: null, error: "Nao foi possivel restaurar os padroes da loja." }
  }

  return {
    store: normalizeStore(data, project),
    error: null,
  }
}

export {
  getMercadoLivreStoreByProjectId,
  getMercadoLivreStoreSettingsForProject,
  restoreMercadoLivreStoreDefaultsForProject,
  upsertMercadoLivreStoreForProject,
}
