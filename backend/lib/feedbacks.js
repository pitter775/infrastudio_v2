import "server-only"

import { getSupabaseAdminClient } from "@/lib/supabase-admin"

export const FEEDBACK_CATEGORIAS = ["sugestao", "reclamacao", "melhoria", "duvida", "outro"]
export const FEEDBACK_STATUSES = ["novo", "em_andamento", "respondido", "fechado"]
export const FEEDBACK_ORDENACOES = ["recentes", "pendentes"]

function canAccessGlobalAdmin(user) {
  return user?.role === "admin"
}

function canAccessProject(user, projectId) {
  if (!projectId) {
    return true
  }

  if (canAccessGlobalAdmin(user)) {
    return true
  }

  return user?.memberships?.some((item) => item?.projetoId === projectId)
}

function isFeedbackCategoria(value) {
  return FEEDBACK_CATEGORIAS.includes(String(value ?? "").trim())
}

function isFeedbackStatus(value) {
  return FEEDBACK_STATUSES.includes(String(value ?? "").trim())
}

function isFeedbackOrdenacao(value) {
  return FEEDBACK_ORDENACOES.includes(String(value ?? "").trim())
}

function mapUsuarioRow(value) {
  const row = Array.isArray(value) ? value[0] ?? null : value

  return {
    id: row?.id ?? "",
    nome: row?.nome?.trim() || null,
    email: row?.email?.trim() || null,
  }
}

function mapProjetoRow(value) {
  const row = Array.isArray(value) ? value[0] ?? null : value

  if (!row) {
    return null
  }

  return {
    id: row.id ?? null,
    nome: row.nome?.trim() || null,
  }
}

export function mapFeedbackMessageRow(row) {
  return {
    id: row.id,
    feedbackId: row.feedback_id,
    usuarioId: row.usuario_id ?? null,
    remetenteTipo: row.remetente_tipo === "admin" ? "admin" : "usuario",
    mensagem: row.mensagem?.trim() || "",
    lidaPeloAdmin: row.lida_pelo_admin === true,
    lidaPeloUsuario: row.lida_pelo_usuario === true,
    createdAt: row.created_at ?? new Date(0).toISOString(),
    updatedAt: row.updated_at ?? row.created_at ?? new Date(0).toISOString(),
  }
}

export function buildFeedbackRecord(row, mensagens) {
  const ultimaMensagem = mensagens[mensagens.length - 1] ?? null
  const usuario = mapUsuarioRow(row.usuarios)

  return {
    id: row.id,
    usuarioId: row.usuario_id,
    projetoId: row.projeto_id ?? null,
    assunto: row.assunto?.trim() || "Sem assunto",
    categoria: isFeedbackCategoria(row.categoria) ? row.categoria : "outro",
    status: isFeedbackStatus(row.status) ? row.status : "novo",
    adminVisualizado: row.admin_visualizado === true,
    usuarioVisualizado: row.usuario_visualizado === true,
    closedAt: row.closed_at ?? null,
    createdAt: row.created_at ?? new Date(0).toISOString(),
    updatedAt: row.updated_at ?? row.created_at ?? new Date(0).toISOString(),
    usuario,
    projeto: mapProjetoRow(row.projetos),
    totalMensagens: mensagens.length,
    ultimaMensagem: ultimaMensagem?.mensagem ?? null,
    ultimaMensagemAt: ultimaMensagem?.createdAt ?? row.updated_at ?? row.created_at ?? new Date(0).toISOString(),
    possuiMensagemNaoLidaAdmin: mensagens.some((mensagem) => !mensagem.lidaPeloAdmin),
    possuiMensagemNaoLidaUsuario: mensagens.some((mensagem) => !mensagem.lidaPeloUsuario),
    mensagensNaoLidasAdmin: mensagens.filter((mensagem) => !mensagem.lidaPeloAdmin).length,
    mensagensNaoLidasUsuario: mensagens.filter((mensagem) => !mensagem.lidaPeloUsuario).length,
  }
}

export function sortFeedbacks(feedbacks, ordenacao) {
  if (ordenacao === "pendentes") {
    const prioridadeStatus = {
      novo: 0,
      em_andamento: 1,
      respondido: 2,
      fechado: 3,
    }

    return [...feedbacks].sort((left, right) => {
      const leftPendente = Number(left.status === "novo" || left.possuiMensagemNaoLidaAdmin)
      const rightPendente = Number(right.status === "novo" || right.possuiMensagemNaoLidaAdmin)

      if (leftPendente !== rightPendente) {
        return rightPendente - leftPendente
      }

      const diffStatus = prioridadeStatus[left.status] - prioridadeStatus[right.status]
      if (diffStatus !== 0) {
        return diffStatus
      }

      return new Date(right.ultimaMensagemAt).getTime() - new Date(left.ultimaMensagemAt).getTime()
    })
  }

  return [...feedbacks].sort(
    (left, right) => new Date(right.ultimaMensagemAt).getTime() - new Date(left.ultimaMensagemAt).getTime(),
  )
}

function buildFeedbackSearchText(feedback) {
  return [
    feedback.assunto,
    feedback.ultimaMensagem,
    feedback.usuario?.nome,
    feedback.usuario?.email,
    feedback.projeto?.nome,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
}

async function listMensagensPorFeedbackIds(feedbackIds) {
  if (!feedbackIds.length) {
    return new Map()
  }

  const supabase = getSupabaseAdminClient()
  const { data, error } = await supabase
    .from("feedback_mensagens")
    .select("id, feedback_id, usuario_id, remetente_tipo, mensagem, lida_pelo_admin, lida_pelo_usuario, created_at, updated_at")
    .in("feedback_id", feedbackIds)
    .order("created_at", { ascending: true })

  if (error || !data) {
    console.error("[feedbacks] failed to list mensagens", error)
    return new Map()
  }

  const mensagensPorFeedback = new Map()

  for (const raw of data) {
    const mensagem = mapFeedbackMessageRow(raw)
    const bucket = mensagensPorFeedback.get(mensagem.feedbackId) ?? []
    bucket.push(mensagem)
    mensagensPorFeedback.set(mensagem.feedbackId, bucket)
  }

  return mensagensPorFeedback
}

async function getFeedbackRowById(id) {
  const supabase = getSupabaseAdminClient()
  const { data, error } = await supabase
    .from("feedbacks")
    .select("id, usuario_id, projeto_id, assunto, categoria, status, admin_visualizado, usuario_visualizado, closed_at, created_at, updated_at, usuarios(id, nome, email), projetos(id, nome)")
    .eq("id", id)
    .maybeSingle()

  if (error) {
    console.error("[feedbacks] failed to load feedback", error)
    return null
  }

  return data ?? null
}

function canAccessFeedback(user, feedback) {
  if (canAccessGlobalAdmin(user)) {
    return true
  }

  return feedback.usuario_id === user?.id
}

export async function listFeedbacks(input) {
  const supabase = getSupabaseAdminClient()
  const admin = canAccessGlobalAdmin(input.user)
  const ordenacao = isFeedbackOrdenacao(input.ordenacao) ? input.ordenacao : "recentes"
  let query = supabase
    .from("feedbacks")
    .select("id, usuario_id, projeto_id, assunto, categoria, status, admin_visualizado, usuario_visualizado, closed_at, created_at, updated_at, usuarios(id, nome, email), projetos(id, nome)")
    .order("updated_at", { ascending: false })

  if (!admin) {
    query = query.eq("usuario_id", input.user.id)
  } else if (typeof input.usuarioId === "string" && input.usuarioId.trim()) {
    query = query.eq("usuario_id", input.usuarioId.trim())
  }

  if (isFeedbackStatus(input.status)) {
    query = query.eq("status", input.status)
  }

  if (isFeedbackCategoria(input.categoria)) {
    query = query.eq("categoria", input.categoria)
  }

  const { data, error } = await query

  if (error || !data) {
    console.error("[feedbacks] failed to list feedbacks", error)
    return {
      feedbacks: [],
      filtros: { usuarios: [] },
    }
  }

  const mensagensPorFeedback = await listMensagensPorFeedbackIds(data.map((item) => item.id))
  let feedbacks = sortFeedbacks(
    data.map((row) => buildFeedbackRecord(row, mensagensPorFeedback.get(row.id) ?? [])),
    admin ? ordenacao : "recentes",
  )

  const search = String(input.busca ?? "").trim().toLowerCase()
  if (search) {
    feedbacks = feedbacks.filter((feedback) => buildFeedbackSearchText(feedback).includes(search))
  }

  const usuarios = admin
    ? Array.from(
        new Map(
          feedbacks.map((feedback) => [
            feedback.usuarioId,
            {
              id: feedback.usuarioId,
              nome: feedback.usuario.nome ?? "Usuario",
              email: feedback.usuario.email,
            },
          ]),
        ).values(),
      ).sort((left, right) => left.nome.localeCompare(right.nome, "pt-BR"))
    : []

  return {
    feedbacks,
    filtros: { usuarios },
  }
}

export async function getFeedbackDetalhe(user, feedbackId) {
  const row = await getFeedbackRowById(feedbackId)
  if (!row) {
    return null
  }

  if (!canAccessFeedback(user, row)) {
    return false
  }

  const mensagensPorFeedback = await listMensagensPorFeedbackIds([feedbackId])
  return {
    ...buildFeedbackRecord(row, mensagensPorFeedback.get(feedbackId) ?? []),
    mensagens: mensagensPorFeedback.get(feedbackId) ?? [],
  }
}

export async function marcarFeedbackComoLido(user, feedbackId) {
  const feedback = await getFeedbackDetalhe(user, feedbackId)
  if (!feedback) {
    return feedback
  }

  const supabase = getSupabaseAdminClient()
  const now = new Date().toISOString()

  if (canAccessGlobalAdmin(user)) {
    const [{ error: feedbackError }, { error: mensagensError }] = await Promise.all([
      supabase
        .from("feedbacks")
        .update({
          admin_visualizado: true,
          updated_at: now,
        })
        .eq("id", feedbackId),
      supabase
        .from("feedback_mensagens")
        .update({
          lida_pelo_admin: true,
          updated_at: now,
        })
        .eq("feedback_id", feedbackId)
        .eq("remetente_tipo", "usuario")
        .eq("lida_pelo_admin", false),
    ])

    if (feedbackError || mensagensError) {
      console.error("[feedbacks] failed to mark feedback as read by admin", feedbackError ?? mensagensError)
    }
  } else {
    const [{ error: feedbackError }, { error: mensagensError }] = await Promise.all([
      supabase
        .from("feedbacks")
        .update({
          usuario_visualizado: true,
          updated_at: now,
        })
        .eq("id", feedbackId),
      supabase
        .from("feedback_mensagens")
        .update({
          lida_pelo_usuario: true,
          updated_at: now,
        })
        .eq("feedback_id", feedbackId)
        .eq("remetente_tipo", "admin")
        .eq("lida_pelo_usuario", false),
    ])

    if (feedbackError || mensagensError) {
      console.error("[feedbacks] failed to mark feedback as read by usuario", feedbackError ?? mensagensError)
    }
  }

  return getFeedbackDetalhe(user, feedbackId)
}

export async function createFeedback(input) {
  const assunto = String(input.assunto ?? "").trim()
  const mensagemInicial = String(input.mensagemInicial ?? "").trim()

  if (!assunto || !mensagemInicial) {
    return null
  }

  const projetoId = typeof input.projetoId === "string" && input.projetoId.trim() ? input.projetoId.trim() : null
  if (projetoId && !canAccessProject(input.user, projetoId)) {
    return false
  }

  const supabase = getSupabaseAdminClient()
  const now = new Date().toISOString()
  const { data, error } = await supabase
    .from("feedbacks")
    .insert({
      usuario_id: input.user.id,
      projeto_id: projetoId,
      assunto,
      categoria: isFeedbackCategoria(input.categoria) ? input.categoria : "outro",
      status: "novo",
      admin_visualizado: canAccessGlobalAdmin(input.user),
      usuario_visualizado: true,
      created_at: now,
      updated_at: now,
    })
    .select("id")
    .single()

  if (error || !data) {
    console.error("[feedbacks] failed to create feedback", error)
    return null
  }

  const remetenteTipo = canAccessGlobalAdmin(input.user) ? "admin" : "usuario"
  const { error: mensagemError } = await supabase.from("feedback_mensagens").insert({
    feedback_id: data.id,
    usuario_id: input.user.id,
    remetente_tipo: remetenteTipo,
    mensagem: mensagemInicial,
    lida_pelo_admin: remetenteTipo === "admin",
    lida_pelo_usuario: remetenteTipo === "usuario",
    created_at: now,
    updated_at: now,
  })

  if (mensagemError) {
    console.error("[feedbacks] failed to create first mensagem", mensagemError)
    await supabase.from("feedbacks").delete().eq("id", data.id)
    return null
  }

  return getFeedbackDetalhe(input.user, data.id)
}

export async function adicionarMensagemFeedback(input) {
  const feedback = await getFeedbackDetalhe(input.user, input.feedbackId)
  if (!feedback) {
    return feedback
  }

  if (feedback.status === "fechado") {
    return false
  }

  const mensagem = String(input.mensagem ?? "").trim()
  if (!mensagem) {
    return null
  }

  const supabase = getSupabaseAdminClient()
  const now = new Date().toISOString()
  const remetenteTipo = canAccessGlobalAdmin(input.user) ? "admin" : "usuario"
  const { error: mensagemError } = await supabase.from("feedback_mensagens").insert({
    feedback_id: input.feedbackId,
    usuario_id: input.user.id,
    remetente_tipo: remetenteTipo,
    mensagem,
    lida_pelo_admin: remetenteTipo === "admin",
    lida_pelo_usuario: remetenteTipo === "usuario",
    created_at: now,
    updated_at: now,
  })

  if (mensagemError) {
    console.error("[feedbacks] failed to add mensagem", mensagemError)
    return null
  }

  const nextStatus =
    remetenteTipo === "admin"
      ? isFeedbackStatus(input.statusAdmin)
        ? input.statusAdmin
        : "respondido"
      : feedback.status === "respondido"
        ? "em_andamento"
        : feedback.status

  const { error: feedbackError } = await supabase
    .from("feedbacks")
    .update({
      status: nextStatus,
      admin_visualizado: remetenteTipo === "admin",
      usuario_visualizado: remetenteTipo !== "admin",
      closed_at: nextStatus === "fechado" ? now : null,
      updated_at: now,
    })
    .eq("id", input.feedbackId)

  if (feedbackError) {
    console.error("[feedbacks] failed to update feedback after mensagem", feedbackError)
    return null
  }

  return getFeedbackDetalhe(input.user, input.feedbackId)
}

export async function atualizarStatusFeedback(input) {
  const feedback = await getFeedbackDetalhe(input.user, input.feedbackId)
  if (!feedback) {
    return feedback
  }

  const admin = canAccessGlobalAdmin(input.user)
  const now = new Date().toISOString()
  let nextStatus = null

  if (input.acao === "reabrir") {
    if (admin || feedback.usuarioId === input.user.id) {
      nextStatus = "em_andamento"
    }
  } else if (admin && isFeedbackStatus(input.status)) {
    nextStatus = input.status
  }

  if (!nextStatus) {
    return null
  }

  const supabase = getSupabaseAdminClient()
  const { error } = await supabase
    .from("feedbacks")
    .update({
      status: nextStatus,
      closed_at: nextStatus === "fechado" ? now : null,
      updated_at: now,
    })
    .eq("id", input.feedbackId)

  if (error) {
    console.error("[feedbacks] failed to update status", error)
    return null
  }

  return getFeedbackDetalhe(input.user, input.feedbackId)
}
