import "server-only"

import { getSupabaseAdminClient } from "@/lib/supabase-admin"

const contactFields =
  "id, projeto_id, canal_whatsapp_id, usuario_id, nome, numero, papel, observacoes, ativo, receber_alertas, created_at, updated_at"

function userCanAccessProject(user, projectId) {
  if (user?.role === "admin") {
    return true
  }

  return user?.memberships?.some((item) => item.projetoId === projectId) ?? false
}

function normalizePhone(value) {
  let digits = String(value || "").replace(/\D/g, "").replace(/^0+/, "")

  while (digits.startsWith("55") && digits.length > 11) {
    digits = digits.slice(2)
  }

  if (digits.length > 11) {
    digits = digits.slice(-11)
  }

  return digits ? `55${digits}` : ""
}

function mapContact(row) {
  return {
    id: row.id,
    projetoId: row.projeto_id,
    canalWhatsappId: row.canal_whatsapp_id ?? null,
    usuarioId: row.usuario_id ?? null,
    nome: row.nome?.trim() || "Atendente",
    numero: normalizePhone(row.numero),
    papel: row.papel?.trim() || "",
    observacoes: row.observacoes?.trim() || "",
    ativo: row.ativo !== false,
    receberAlertas: row.receber_alertas !== false,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export function normalizeWhatsAppHandoffPhone(value) {
  return normalizePhone(value)
}

export async function listBillingAlertRecipientsByProjectId(projectId, deps = {}) {
  if (!projectId) {
    return []
  }

  try {
    const supabase = deps.supabase ?? getSupabaseAdminClient()
    const { data, error } = await supabase
      .from("whatsapp_handoff_contatos")
      .select(contactFields)
      .eq("projeto_id", projectId)
      .eq("ativo", true)
      .eq("receber_alertas", true)
      .order("nome", { ascending: true })

    if (error) {
      console.error("[whatsapp-handoff] failed to list billing alert recipients", error)
      return []
    }

    return (data ?? []).map(mapContact)
  } catch (error) {
    console.error("[whatsapp-handoff] failed to list billing alert recipients", error)
    return []
  }
}

export async function listActiveHandoffRecipientsByProjectId(projectId, options = {}, deps = {}) {
  if (!projectId) {
    return []
  }

  try {
    const supabase = deps.supabase ?? getSupabaseAdminClient()
    let query = supabase
      .from("whatsapp_handoff_contatos")
      .select(contactFields)
      .eq("projeto_id", projectId)
      .eq("ativo", true)
      .eq("receber_alertas", true)
      .order("nome", { ascending: true })

    if (options.canalWhatsappId) {
      query = query.or(`canal_whatsapp_id.eq.${options.canalWhatsappId},canal_whatsapp_id.is.null`)
    }

    const { data, error } = await query

    if (error) {
      console.error("[whatsapp-handoff] failed to list handoff recipients", error)
      return []
    }

    return (data ?? []).map(mapContact)
  } catch (error) {
    console.error("[whatsapp-handoff] failed to list handoff recipients", error)
    return []
  }
}

export async function listWhatsAppHandoffContactsForUser(project, user) {
  if (!project?.id || !userCanAccessProject(user, project.id)) {
    return []
  }

  try {
    const supabase = getSupabaseAdminClient()
    const { data, error } = await supabase
      .from("whatsapp_handoff_contatos")
      .select(contactFields)
      .eq("projeto_id", project.id)
      .order("nome", { ascending: true })

    if (error) {
      console.error("[whatsapp-handoff] failed to list contacts", error)
      return []
    }

    return (data || []).map(mapContact)
  } catch (error) {
    console.error("[whatsapp-handoff] failed to list contacts", error)
    return []
  }
}

export async function saveWhatsAppHandoffContactForUser(project, input, user) {
  if (!project?.id || !userCanAccessProject(user, project.id)) {
    return { contact: null, error: "Acesso negado." }
  }

  const nome = String(input.nome || "").trim()
  const numero = normalizePhone(input.numero)

  if (!nome || numero.length < 12) {
    return { contact: null, error: "Nome e numero valido sao obrigatorios." }
  }

  try {
    const supabase = getSupabaseAdminClient()
    let targetId = input.id || null

    if (!targetId) {
      const { data: existingContact } = await supabase
        .from("whatsapp_handoff_contatos")
        .select(contactFields)
        .eq("projeto_id", project.id)
        .eq("numero", numero)
        .limit(1)
        .maybeSingle()

      if (existingContact?.id) {
        targetId = existingContact.id
      }
    }

    const payload = {
      projeto_id: project.id,
      canal_whatsapp_id: input.canalWhatsappId || null,
      nome,
      numero,
      papel: String(input.papel || "").trim() || null,
      observacoes: String(input.observacoes || "").trim() || null,
      ativo: input.ativo === false ? false : true,
      receber_alertas: input.receberAlertas === false ? false : true,
      updated_at: new Date().toISOString(),
    }

    const query = targetId
      ? supabase.from("whatsapp_handoff_contatos").update(payload).eq("id", targetId).eq("projeto_id", project.id)
      : supabase.from("whatsapp_handoff_contatos").insert(payload)

    const { data, error } = await query.select(contactFields).maybeSingle()

    if (error || !data) {
      if (error) {
        console.error("[whatsapp-handoff] failed to save contact", error)
      }
      return { contact: null, error: "Não foi possível salvar o atendente." }
    }

    return { contact: mapContact(data), error: null }
  } catch (error) {
    console.error("[whatsapp-handoff] failed to save contact", error)
    return { contact: null, error: "Não foi possível salvar o atendente." }
  }
}

export async function deleteWhatsAppHandoffContactForUser(project, contactId, user) {
  if (!project?.id || !contactId || !userCanAccessProject(user, project.id)) {
    return false
  }

  try {
    const supabase = getSupabaseAdminClient()
    const { error } = await supabase
      .from("whatsapp_handoff_contatos")
      .delete()
      .eq("id", contactId)
      .eq("projeto_id", project.id)

    if (error) {
      console.error("[whatsapp-handoff] failed to delete contact", error)
      return false
    }

    return true
  } catch (error) {
    console.error("[whatsapp-handoff] failed to delete contact", error)
    return false
  }
}
