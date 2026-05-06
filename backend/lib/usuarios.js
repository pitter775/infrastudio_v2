import "server-only"

import { hashSync } from "bcryptjs"

import { getSupabaseAdminClient } from "@/lib/supabase-admin"
import { applyInitialFreePlan } from "@/lib/usuario-project-bootstrap"

const usuarioSelectFields =
  "id, nome, email, telefone, senha, provider, provider_id, avatar_url, role, email_verificado, ativo, usuarios_projetos(papel, projeto_id, projetos(nome, slug))"
const usuarioSelectFieldsLegacy =
  "id, nome, email, senha, provider, provider_id, avatar_url, role, email_verificado, ativo, usuarios_projetos(papel, projeto_id, projetos(nome, slug))"

async function runUsuarioQueryWithTelefoneFallback(executor) {
  const result = await executor(usuarioSelectFields)
  const hasTelefoneError =
    result?.error &&
    /telefone|schema cache|column/i.test(String(result.error.message || ""))

  if (!hasTelefoneError) {
    return result
  }

  const legacyResult = await executor(usuarioSelectFieldsLegacy)
  if (legacyResult?.data) {
    if (Array.isArray(legacyResult.data)) {
      legacyResult.data = legacyResult.data.map((item) => ({ ...item, telefone: null }))
    } else {
      legacyResult.data = { ...legacyResult.data, telefone: null }
    }
  }

  return legacyResult
}

function normalizeRole(role) {
  return role === "admin" ? "admin" : "viewer"
}

function normalizeStatus(ativo) {
  return ativo === false ? "pendente" : "ativo"
}

export function mapUsuarioToAppUser(row) {
  const memberships =
    row.usuarios_projetos?.map((item) => ({
      projetoId: item.projeto_id,
      projetoNome: Array.isArray(item.projetos)
        ? item.projetos[0]?.nome ?? null
        : item.projetos?.nome ?? null,
      projetoSlug: Array.isArray(item.projetos)
        ? item.projetos[0]?.slug ?? null
        : item.projetos?.slug ?? null,
      papel: normalizeRole(item.papel),
    })) ?? []
  const globalRole = normalizeRole(row.role)

  return {
    id: row.id,
    name: row.nome?.trim() || "Usuario",
    email: row.email?.trim() || "",
    telefone: row.telefone?.trim() || "",
    avatarUrl: row.avatar_url?.trim() || "",
    provider: row.provider ?? undefined,
    providerId: row.provider_id ?? undefined,
    role:
      globalRole === "admin" || memberships.some((item) => item.papel === "admin")
        ? "admin"
        : "viewer",
    status: normalizeStatus(row.ativo),
    currentProjectId: memberships[0]?.projetoId ?? null,
    memberships,
  }
}

export async function findUsuarioWithPasswordByEmail(email) {
  const supabase = getSupabaseAdminClient()
  const { data, error } = await runUsuarioQueryWithTelefoneFallback((fields) =>
    supabase.from("usuarios").select(fields).eq("email", email).maybeSingle()
  )

  if (error) {
    console.error("[usuarios] failed to find usuario by email", error)
    return null
  }

  return data
}

export async function findUsuarioByProvider(provider, providerId) {
  const supabase = getSupabaseAdminClient()
  const { data, error } = await runUsuarioQueryWithTelefoneFallback((fields) =>
    supabase.from("usuarios").select(fields).eq("provider", provider).eq("provider_id", providerId).maybeSingle()
  )

  if (error) {
    console.error("[usuarios] failed to find usuario by provider", error)
    return null
  }

  return data ? mapUsuarioToAppUser(data) : null
}

export async function updateUsuarioProviderAndVerification(input) {
  const supabase = getSupabaseAdminClient()
  const nextAvatarUrl = String(input.avatarUrl || "").trim()
  const updatePayload = {
    provider: input.provider,
    provider_id: input.providerId,
    email_verificado: input.emailVerificado === true,
    ativo: true,
    updated_at: new Date().toISOString(),
  }

  if (nextAvatarUrl) {
    updatePayload.avatar_url = nextAvatarUrl
  }

  const { error } = await supabase
    .from("usuarios")
    .update(updatePayload)
    .eq("id", input.usuarioId)

  if (error) {
    console.error("[usuarios] failed to update usuario provider", error)
    return false
  }

  return true
}

export async function verifyUsuarioEmailByEmail(email) {
  const supabase = getSupabaseAdminClient()
  const { error } = await supabase
    .from("usuarios")
    .update({
      email_verificado: true,
      ativo: true,
      updated_at: new Date().toISOString(),
    })
    .eq("email", email)

  if (error) {
    console.error("[usuarios] failed to verify usuario email", error)
    return false
  }

  return true
}

export async function touchUsuarioLogin(usuarioId) {
  const supabase = getSupabaseAdminClient()
  const { error } = await supabase
    .from("usuarios")
    .update({
      ativo: true,
      ultimo_login_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", usuarioId)

  if (error) {
    console.error("[usuarios] failed to update ultimo_login_at", error)
  }
}

export async function listUsuarios() {
  const supabase = getSupabaseAdminClient()
  const { data, error } = await runUsuarioQueryWithTelefoneFallback((fields) =>
    supabase.from("usuarios").select(fields.replace("senha, ", "")).order("nome", { ascending: true })
  )

  if (error || !data) {
    console.error("[usuarios] failed to list usuarios", error)
    return []
  }

  return data.map(mapUsuarioToAppUser)
}

export async function getUsuarioById(usuarioId) {
  const supabase = getSupabaseAdminClient()
  const { data, error } = await runUsuarioQueryWithTelefoneFallback((fields) =>
    supabase.from("usuarios").select(fields.replace("senha, ", "")).eq("id", usuarioId).maybeSingle()
  )

  if (error || !data) {
    if (error) {
      console.error("[usuarios] failed to get usuario by id", error)
    }
    return null
  }

  return mapUsuarioToAppUser(data)
}

function sanitizeUsuarioPayload(input) {
  return {
    nome: input.nome.trim(),
    email: input.email.trim().toLowerCase(),
    telefone: String(input.telefone ?? "").trim() || null,
    avatar_url: String(input.avatarUrl ?? "").trim() || null,
    ativo: input.ativo ?? true,
    email_verificado: input.emailVerificado ?? true,
    role: input.papel === "admin" ? "admin" : "viewer",
    provider: input.provider ?? "email",
    provider_id: input.providerId ?? null,
    updated_at: new Date().toISOString(),
  }
}

export async function updateOwnUsuarioProfile(input) {
  if (!input.id) {
    return null
  }

  const supabase = getSupabaseAdminClient()
  const payload = {
    nome: String(input.nome ?? "").trim(),
    telefone: String(input.telefone ?? "").trim() || null,
    avatar_url: String(input.avatarUrl ?? "").trim() || null,
    updated_at: new Date().toISOString(),
  }

  if (!payload.nome) {
    return null
  }

  if (input.senha?.trim()) {
    payload.senha = hashSync(input.senha.trim(), 10)
  }

  const { data, error } = await supabase
    .from("usuarios")
    .update(payload)
    .eq("id", input.id)
    .select("id")
    .single()

  if (error || !data) {
    console.error("[usuarios] failed to update own profile", error)
    return null
  }

  return getUsuarioById(data.id)
}

function normalizeProjetoIds(input) {
  const rawIds = [...(input.projetoIds ?? []), input.projetoId ?? null]

  return Array.from(
    new Set(
      rawIds
        .filter((value) => typeof value === "string" && value.trim().length > 0)
        .map((value) => value.trim())
    )
  )
}

async function syncUsuarioProjetoPapeis({ usuarioId, projetoIds, papel }) {
  const supabase = getSupabaseAdminClient()
  const normalizedPapel = papel === "admin" ? "admin" : "viewer"
  const { data: existing, error: readError } = await supabase
    .from("usuarios_projetos")
    .select("projeto_id")
    .eq("usuario_id", usuarioId)

  if (readError) {
    console.error("[usuarios] failed to read usuario_projetos", readError)
    return
  }

  const existingProjetoIds = new Set(
    (existing ?? [])
      .map((item) => item.projeto_id)
      .filter((value) => typeof value === "string" && value.trim().length > 0)
  )
  const targetProjetoIds = new Set(projetoIds)
  const projetoIdsToDelete = Array.from(existingProjetoIds).filter(
    (projetoId) => !targetProjetoIds.has(projetoId)
  )

  if (projetoIdsToDelete.length > 0) {
    const { error } = await supabase
      .from("usuarios_projetos")
      .delete()
      .eq("usuario_id", usuarioId)
      .in("projeto_id", projetoIdsToDelete)

    if (error) {
      console.error("[usuarios] failed to delete removed usuario_projetos", error)
    }
  }

  for (const projetoId of projetoIds) {
    const { data: existingRow, error: existingError } = await supabase
      .from("usuarios_projetos")
      .select("id")
      .eq("usuario_id", usuarioId)
      .eq("projeto_id", projetoId)
      .maybeSingle()

    if (existingError) {
      console.error("[usuarios] failed to read usuario_projeto", existingError)
      continue
    }

    if (existingRow) {
      const { error } = await supabase
        .from("usuarios_projetos")
        .update({ papel: normalizedPapel })
        .eq("id", existingRow.id)

      if (error) {
        console.error("[usuarios] failed to update usuario_projeto", error)
      }

      continue
    }

    const { error } = await supabase.from("usuarios_projetos").insert({
      usuario_id: usuarioId,
      projeto_id: projetoId,
      papel: normalizedPapel,
      created_at: new Date().toISOString(),
    })

    if (error) {
      console.error("[usuarios] failed to insert usuario_projeto", error)
    }
  }
}

async function applyFreePlanOnTransferredAdminProject({ supabase, usuarioId, projetoId, papel }) {
  if (!usuarioId || !projetoId || papel === "admin") {
    return
  }

  const [projectResult, billingResult, ownerResult] = await Promise.all([
    supabase
      .from("projetos")
      .select("id, owner_user_id")
      .eq("id", projetoId)
      .maybeSingle(),
    supabase
      .from("projetos_planos")
      .select(
        "id, plano_id, nome_plano, bloqueado, limite_tokens_input_mensal, limite_tokens_output_mensal, limite_tokens_total_mensal, limite_custo_mensal",
      )
      .eq("projeto_id", projetoId)
      .maybeSingle(),
    supabase
      .from("usuarios")
      .select("id, role")
      .eq("id", usuarioId)
      .maybeSingle(),
  ])

  if (projectResult.error || !projectResult.data?.id || ownerResult.error || !ownerResult.data?.id) {
    return
  }

  if (projectResult.data.owner_user_id === usuarioId) {
    return
  }

  const currentOwnerId = projectResult.data.owner_user_id
  if (!currentOwnerId) {
    return
  }

  const currentOwnerResult = await supabase
    .from("usuarios")
    .select("id, role")
    .eq("id", currentOwnerId)
    .maybeSingle()

  if (currentOwnerResult.error || !currentOwnerResult.data?.id || currentOwnerResult.data.role !== "admin") {
    return
  }

  const billing = billingResult.data ?? null
  const hasUnlimitedAdminBilling =
    !billing ||
    (billing.plano_id == null &&
      billing.bloqueado !== true &&
      billing.limite_tokens_input_mensal == null &&
      billing.limite_tokens_output_mensal == null &&
      billing.limite_tokens_total_mensal == null &&
      billing.limite_custo_mensal == null)

  if (!hasUnlimitedAdminBilling) {
    return
  }

  const now = new Date().toISOString()
  await supabase
    .from("projetos")
    .update({
      owner_user_id: usuarioId,
      updated_at: now,
    })
    .eq("id", projetoId)

  await applyInitialFreePlan({
    supabase,
    projetoId,
    now,
  })
}

export async function createUsuario(input) {
  const supabase = getSupabaseAdminClient()
  const payload = {
    ...sanitizeUsuarioPayload(input),
    senha: hashSync(input.senha?.trim() || "123456", 10),
    created_at: new Date().toISOString(),
  }
  const { data, error } = await supabase
    .from("usuarios")
    .insert(payload)
    .select("id")
    .single()

  if (error || !data) {
    console.error("[usuarios] failed to create usuario", error)
    return null
  }

  await syncUsuarioProjetoPapeis({
    usuarioId: data.id,
    projetoIds: normalizeProjetoIds(input),
    papel: input.papel,
  })

  for (const projetoId of normalizeProjetoIds(input)) {
    await applyFreePlanOnTransferredAdminProject({
      supabase,
      usuarioId: data.id,
      projetoId,
      papel: input.papel,
    })
  }

  return getUsuarioById(data.id)
}

export async function updateUsuario(input) {
  if (!input.id) {
    return null
  }

  const supabase = getSupabaseAdminClient()
  const payload = sanitizeUsuarioPayload(input)

  if (input.senha?.trim()) {
    payload.senha = hashSync(input.senha.trim(), 10)
  }

  const { data, error } = await supabase
    .from("usuarios")
    .update(payload)
    .eq("id", input.id)
    .select("id")
    .single()

  if (error || !data) {
    console.error("[usuarios] failed to update usuario", error)
    return null
  }

  await syncUsuarioProjetoPapeis({
    usuarioId: data.id,
    projetoIds: normalizeProjetoIds(input),
    papel: input.papel,
  })

  for (const projetoId of normalizeProjetoIds(input)) {
    await applyFreePlanOnTransferredAdminProject({
      supabase,
      usuarioId: data.id,
      projetoId,
      papel: input.papel,
    })
  }

  return getUsuarioById(data.id)
}

export async function setUsuarioAtivo(usuarioId, ativo) {
  const supabase = getSupabaseAdminClient()
  const { data, error } = await supabase
    .from("usuarios")
    .update({
      ativo,
      updated_at: new Date().toISOString(),
    })
    .eq("id", usuarioId)
    .select("id")
    .single()

  if (error || !data) {
    console.error("[usuarios] failed to toggle usuario", error)
    return null
  }

  return getUsuarioById(data.id)
}

export async function deleteUsuario(usuarioId) {
  if (!usuarioId) {
    return false
  }

  const supabase = getSupabaseAdminClient()

  async function run(step, operation) {
    const { error } = await operation()
    if (error) {
      console.error(`[usuarios] failed to delete usuario at ${step}`, error)
      return false
    }
    return true
  }

  const { count: ownedProjectCount, error: ownedProjectError } = await supabase
    .from("projetos")
    .select("id", { count: "exact", head: true })
    .eq("owner_user_id", usuarioId)

  if (ownedProjectError) {
    console.error("[usuarios] failed to validate owned projects before delete", ownedProjectError)
    return false
  }

  if ((ownedProjectCount ?? 0) > 0) {
    console.error("[usuarios] refusing to delete usuario with owned projects", { usuarioId, ownedProjectCount })
    return false
  }

  const feedbackIdsResult = await supabase.from("feedbacks").select("id").eq("usuario_id", usuarioId)
  if (feedbackIdsResult.error) {
    console.error("[usuarios] failed to read usuario feedbacks before delete", feedbackIdsResult.error)
    return false
  }

  const feedbackIds = (feedbackIdsResult.data ?? []).map((item) => item.id).filter(Boolean)

  for (let index = 0; index < feedbackIds.length; index += 100) {
    const ids = feedbackIds.slice(index, index + 100)
    if (!ids.length) {
      continue
    }

    if (!(await run("feedback_mensagens.feedback_id", () => supabase.from("feedback_mensagens").delete().in("feedback_id", ids)))) {
      return false
    }
  }

  const steps = [
    ["avisos_leituras", () => supabase.from("avisos_leituras").delete().eq("usuario_id", usuarioId)],
    ["email_verifications", () => supabase.from("email_verifications").delete().eq("usuario_id", usuarioId)],
    ["feedback_mensagens.usuario_id", () => supabase.from("feedback_mensagens").update({ usuario_id: null }).eq("usuario_id", usuarioId)],
    ["feedbacks", () => supabase.from("feedbacks").delete().eq("usuario_id", usuarioId)],
    ["agente_versoes", () => supabase.from("agente_versoes").update({ created_by: null }).eq("created_by", usuarioId)],
    ["api_versoes", () => supabase.from("api_versoes").update({ created_by: null }).eq("created_by", usuarioId)],
    ["chat_handoff_eventos", () => supabase.from("chat_handoff_eventos").update({ usuario_id: null }).eq("usuario_id", usuarioId)],
    [
      "chat_handoffs.requested_by_usuario_id",
      () => supabase.from("chat_handoffs").update({ requested_by_usuario_id: null }).eq("requested_by_usuario_id", usuarioId),
    ],
    [
      "chat_handoffs.claimed_by_usuario_id",
      () => supabase.from("chat_handoffs").update({ claimed_by_usuario_id: null }).eq("claimed_by_usuario_id", usuarioId),
    ],
    [
      "chat_handoffs.released_by_usuario_id",
      () => supabase.from("chat_handoffs").update({ released_by_usuario_id: null }).eq("released_by_usuario_id", usuarioId),
    ],
    ["whatsapp_handoff_contatos", () => supabase.from("whatsapp_handoff_contatos").update({ usuario_id: null }).eq("usuario_id", usuarioId)],
    ["projetos_checkout_intencoes", () => supabase.from("projetos_checkout_intencoes").update({ usuario_id: null }).eq("usuario_id", usuarioId)],
    ["consumos", () => supabase.from("consumos").update({ usuario_id: null }).eq("usuario_id", usuarioId)],
    ["chats", () => supabase.from("chats").update({ usuario_id: null }).eq("usuario_id", usuarioId)],
    ["usuarios_limites_ia", () => supabase.from("usuarios_limites_ia").delete().eq("usuario_id", usuarioId)],
    ["usuarios_projetos", () => supabase.from("usuarios_projetos").delete().eq("usuario_id", usuarioId)],
    ["usuarios", () => supabase.from("usuarios").delete().eq("id", usuarioId)],
  ]

  for (const [step, operation] of steps) {
    if (!(await run(step, operation))) {
      return false
    }
  }

  return true
}
