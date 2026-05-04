import "server-only"

import { getSupabaseAdminClient } from "@/lib/supabase-admin"

function normalizeOptionalText(value) {
  const normalized = typeof value === "string" ? value.trim() : ""
  return normalized ? normalized : null
}

export function extractChatContactSnapshot(contexto, fallbackExternalIdentifier) {
  const lead =
    contexto && typeof contexto.lead === "object" && contexto.lead !== null && !Array.isArray(contexto.lead)
      ? contexto.lead
      : null
  const whatsapp =
    contexto && typeof contexto.whatsapp === "object" && contexto.whatsapp !== null && !Array.isArray(contexto.whatsapp)
      ? contexto.whatsapp
      : null

  return {
    contatoNome: normalizeOptionalText(lead?.nome) ?? normalizeOptionalText(whatsapp?.contactName),
    contatoTelefone:
      normalizeOptionalText(lead?.telefone) ??
      normalizeOptionalText(whatsapp?.remotePhone) ??
      normalizeOptionalText(whatsapp?.remetente) ??
      normalizeOptionalText(fallbackExternalIdentifier),
    contatoAvatarUrl:
      normalizeOptionalText(whatsapp?.profilePicUrl) ??
      normalizeOptionalText(whatsapp?.rawContact?.profilePicUrl),
  }
}

export function mapChat(row) {
  return {
    id: row.id,
    titulo: row.titulo?.trim() || "Nova conversa",
    contatoNome: normalizeOptionalText(row.contato_nome),
    contatoTelefone: normalizeOptionalText(row.contato_telefone),
    contatoAvatarUrl: normalizeOptionalText(row.contato_avatar_url),
    status: row.status ?? "ativo",
    createdAt: row.created_at ?? new Date().toISOString(),
    updatedAt: row.updated_at ?? new Date().toISOString(),
    totalTokens: row.total_tokens ?? 0,
    totalCusto: Number(row.total_custo ?? 0),
    agenteId: row.agente_id ?? null,
    usuarioId: row.usuario_id ?? null,
    projetoId: row.projeto_id ?? null,
    canal: row.canal?.trim() || "web",
    identificadorExterno: row.identificador_externo?.trim() || null,
    contexto: row.contexto ?? null,
    ultimaMensagem: null,
    totalMensagens: 0,
  }
}

export function mapMensagem(row) {
  return {
    id: row.id,
    chatId: row.chat_id ?? "",
    role: row.role === "assistant" ? "assistant" : row.role === "system" ? "system" : "user",
    conteudo: row.conteudo,
    canal: row.canal?.trim() || "web",
    identificadorExterno: row.identificador_externo?.trim() || null,
    tokensInput: row.tokens_input ?? null,
    tokensOutput: row.tokens_output ?? null,
    custo: row.custo ?? null,
    metadata: row.metadata ?? null,
    createdAt: row.created_at ?? new Date().toISOString(),
  }
}

export function normalizeWhatsAppLookupPhone(value) {
  const digits = String(value || "").replace(/\D/g, "")
  if (!digits) {
    return null
  }

  let normalized = digits
  while (normalized.startsWith("55") && normalized.length > 11) {
    normalized = normalized.slice(2)
  }

  if (normalized.length < 10) {
    return null
  }

  if (normalized.length > 11) {
    normalized = normalized.slice(-11)
  }

  return normalized
}

export function findChatByChannelScope(rows, channelScopeId) {
  if (!channelScopeId || !Array.isArray(rows)) {
    return null
  }

  const match = rows.find((row) => {
    const mapped = "contexto" in row && "id" in row ? row : mapChat(row)
    const whatsapp = mapped.contexto?.whatsapp ?? null
    return typeof whatsapp?.channelId === "string" && whatsapp.channelId === channelScopeId
  })

  if (!match) {
    return null
  }

  return "contexto" in match && "id" in match ? match : mapChat(match)
}

export function findChatByWhatsAppPhone(rows, input) {
  const normalizedPhone = normalizeWhatsAppLookupPhone(input?.phone)
  if (!normalizedPhone || !Array.isArray(rows)) {
    return null
  }

  const match = rows.find((row) => {
    const mapped = "contexto" in row && "id" in row ? row : mapChat(row)
    const whatsapp = mapped.contexto?.whatsapp ?? null
    const channelMatches =
      !input?.channelScopeId || (typeof whatsapp?.channelId === "string" && whatsapp.channelId === input.channelScopeId)

    if (!channelMatches) {
      return false
    }

    const contactSnapshot = extractChatContactSnapshot(mapped.contexto, mapped.identificadorExterno)
    const candidates = [
      mapped.contatoTelefone,
      mapped.identificadorExterno,
      contactSnapshot.contatoTelefone,
      typeof whatsapp?.remotePhone === "string" ? whatsapp.remotePhone : null,
      typeof whatsapp?.remetente === "string" ? whatsapp.remetente : null,
    ]

    return candidates.some((candidate) => normalizeWhatsAppLookupPhone(candidate) === normalizedPhone)
  })

  if (!match) {
    return null
  }

  return "contexto" in match && "id" in match ? match : mapChat(match)
}

export function getChatContext(chat) {
  return chat?.contexto ?? {}
}

export async function createChat(input) {
  const supabase = getSupabaseAdminClient()
  const now = new Date().toISOString()
  const contactSnapshot = extractChatContactSnapshot(input.contexto, input.identificadorExterno)
  const { data, error } = await supabase
    .from("chats")
    .insert({
      titulo: input.titulo?.trim() || "Nova conversa",
      contato_nome: normalizeOptionalText(input.contatoNome) ?? contactSnapshot.contatoNome,
      contato_telefone: normalizeOptionalText(input.contatoTelefone) ?? contactSnapshot.contatoTelefone,
      contato_avatar_url: normalizeOptionalText(input.contatoAvatarUrl) ?? contactSnapshot.contatoAvatarUrl,
      usuario_id: input.usuarioId ?? null,
      projeto_id: input.projetoId ?? null,
      agente_id: input.agenteId ?? null,
      canal: input.canal ?? "web",
      identificador_externo: input.identificadorExterno?.trim() || null,
      contexto: input.contexto ?? null,
      status: "ativo",
      total_tokens: 0,
      total_custo: 0,
      created_at: now,
      updated_at: now,
    })
    .select(
      "id, titulo, contato_nome, contato_telefone, contato_avatar_url, status, created_at, updated_at, total_tokens, total_custo, agente_id, usuario_id, projeto_id, canal, identificador_externo, contexto"
    )
    .single()

  if (error || !data) {
    console.error("[chats] failed to create chat", error)
    return null
  }

  return mapChat(data)
}

export async function getChatById(chatId) {
  const supabase = getSupabaseAdminClient()
  const { data, error } = await supabase
    .from("chats")
    .select(
      "id, titulo, contato_nome, contato_telefone, contato_avatar_url, status, created_at, updated_at, total_tokens, total_custo, agente_id, usuario_id, projeto_id, canal, identificador_externo, contexto"
    )
    .eq("id", chatId)
    .maybeSingle()

  if (error || !data) {
    if (error) {
      console.error("[chats] failed to load chat", error)
    }
    return null
  }

  return mapChat(data)
}

export async function deleteChatsByIds(chatIds) {
  const normalizedChatIds = Array.from(
    new Set((Array.isArray(chatIds) ? chatIds : [chatIds]).map((item) => String(item || "").trim()).filter(Boolean)),
  ).slice(0, 25)

  if (!normalizedChatIds.length) {
    return { ok: false, deleted: 0, error: "Nenhuma conversa informada." }
  }

  const supabase = getSupabaseAdminClient()
  const { error: messagesError } = await supabase.from("mensagens").delete().in("chat_id", normalizedChatIds)

  if (messagesError) {
    console.error("[chats] failed to delete chat messages", messagesError)
    return { ok: false, deleted: 0, error: "Nao foi possivel excluir as mensagens." }
  }

  const { error: handoffsError } = await supabase.from("chat_handoffs").delete().in("chat_id", normalizedChatIds)

  if (handoffsError) {
    console.error("[chats] failed to delete chat handoffs", handoffsError)
  }

  const { error: chatsError } = await supabase.from("chats").delete().in("id", normalizedChatIds)

  if (chatsError) {
    console.error("[chats] failed to delete chats", chatsError)
    return { ok: false, deleted: 0, error: "Nao foi possivel excluir a conversa." }
  }

  return { ok: true, deleted: normalizedChatIds.length, error: null }
}

export async function appendMessage(input) {
  const supabase = getSupabaseAdminClient()
  const now = new Date().toISOString()
  const { data, error } = await supabase
    .from("mensagens")
    .insert({
      chat_id: input.chatId,
      role: input.role,
      conteudo: input.conteudo,
      canal: input.canal ?? "web",
      identificador_externo: input.identificadorExterno?.trim() || null,
      tokens_input: input.tokensInput ?? null,
      tokens_output: input.tokensOutput ?? null,
      custo: input.custo ?? null,
      metadata: input.metadata ?? null,
      created_at: now,
    })
    .select("id, chat_id, role, conteudo, canal, identificador_externo, tokens_input, tokens_output, custo, metadata, created_at")
    .single()

  if (error || !data) {
    console.error("[chats] failed to append message", error)
    return null
  }

  return mapMensagem(data)
}

export async function listChatMessages(chatId, options = {}) {
  const supabase = getSupabaseAdminClient()
  let query = supabase
    .from("mensagens")
    .select("id, chat_id, role, conteudo, canal, identificador_externo, tokens_input, tokens_output, custo, metadata, created_at")
    .eq("chat_id", chatId)
    .order("created_at", { ascending: options.ascending !== false })

  if (Number.isFinite(options.limit) && options.limit > 0) {
    query = query.limit(options.limit)
  }

  const { data, error } = await query

  if (error || !data) {
    console.error("[chats] failed to list messages", error)
    return []
  }

  const messages = data.map((row) => mapMensagem(row))
  return options.ascending === false ? messages : messages
}

export async function listLatestChatMessages(chatIds, options = {}) {
  const normalizedChatIds = Array.from(
    new Set((Array.isArray(chatIds) ? chatIds : []).map((item) => String(item || "").trim()).filter(Boolean)),
  )

  if (!normalizedChatIds.length) {
    return new Map()
  }

  const perChatLimit = Math.min(Math.max(Number(options.perChatLimit ?? 1) || 1, 1), 5)
  const batchSize = Math.min(Math.max(Number(options.batchSize ?? normalizedChatIds.length * 4) || normalizedChatIds.length * 4, normalizedChatIds.length), 500)
  const maxRounds = Math.min(Math.max(Number(options.maxRounds ?? 4) || 4, 1), 8)
  const supabase = getSupabaseAdminClient()
  const collected = new Map()
  let cursor = null

  for (let round = 0; round < maxRounds; round += 1) {
    let query = supabase
      .from("mensagens")
      .select("id, chat_id, role, conteudo, canal, identificador_externo, tokens_input, tokens_output, custo, metadata, created_at")
      .in("chat_id", normalizedChatIds)
      .order("created_at", { ascending: false })
      .limit(batchSize)

    if (cursor) {
      query = query.lt("created_at", cursor)
    }

    const { data, error } = await query

    if (error || !Array.isArray(data) || !data.length) {
      if (error) {
        console.error("[chats] failed to list latest messages", error)
      }
      break
    }

    for (const row of data) {
      const chatId = String(row.chat_id || "").trim()
      if (!chatId) {
        continue
      }

      const currentMessages = collected.get(chatId) ?? []
      if (currentMessages.length >= perChatLimit) {
        continue
      }

      currentMessages.push(mapMensagem(row))
      collected.set(chatId, currentMessages)
    }

    if (normalizedChatIds.every((chatId) => (collected.get(chatId)?.length ?? 0) >= perChatLimit)) {
      break
    }

    cursor = data.at(-1)?.created_at ?? null
    if (!cursor) {
      break
    }
  }

  return new Map(
    normalizedChatIds.map((chatId) => [
      chatId,
      ((collected.get(chatId) ?? []).slice(0, perChatLimit)).reverse(),
    ]),
  )
}

export async function listRecentMessagesByExternalIdentifier(input) {
  const identifier = normalizeOptionalText(input?.identificadorExterno)
  if (!identifier) {
    return []
  }

  const supabase = getSupabaseAdminClient()
  let chatQuery = supabase
    .from("chats")
    .select("id, created_at, updated_at")
    .eq("identificador_externo", identifier)
    .order("updated_at", { ascending: false })
    .limit(6)

  if (input?.projetoId) {
    chatQuery = chatQuery.eq("projeto_id", input.projetoId)
  }

  if (input?.agenteId) {
    chatQuery = chatQuery.eq("agente_id", input.agenteId)
  }

  if (input?.excludeChatId) {
    chatQuery = chatQuery.neq("id", input.excludeChatId)
  }

  const { data: chats, error: chatsError } = await chatQuery
  if (chatsError || !chats?.length) {
    if (chatsError) {
      console.error("[chats] failed to load contact history chats", chatsError)
    }
    return []
  }

  const { data, error } = await supabase
    .from("mensagens")
    .select("id, chat_id, role, conteudo, canal, identificador_externo, tokens_input, tokens_output, custo, metadata, created_at")
    .in("chat_id", chats.map((chat) => chat.id))
    .order("created_at", { ascending: false })
    .limit(input?.limit ?? 18)

  if (error || !data) {
    console.error("[chats] failed to load contact history messages", error)
    return []
  }

  return data.map((row) => mapMensagem(row)).reverse()
}

export async function updateChatContext(chatId, contexto) {
  const supabase = getSupabaseAdminClient()
  const { error } = await supabase
    .from("chats")
    .update({
      contexto,
      updated_at: new Date().toISOString(),
    })
    .eq("id", chatId)

  if (error) {
    console.error("[chats] failed to update chat context", error)
  }
}

export async function updateChatStats(input) {
  const supabase = getSupabaseAdminClient()
  const { data: current, error: currentError } = await supabase
    .from("chats")
    .select("id, titulo, identificador_externo, contato_nome, contato_telefone, contato_avatar_url, total_tokens, total_custo")
    .eq("id", input.chatId)
    .single()

  if (currentError || !current) {
    console.error("[chats] failed to read current chat stats", currentError)
    return
  }

  const contactSnapshot = extractChatContactSnapshot(input.contexto, input.identificadorExterno ?? current.identificador_externo)
  const { error } = await supabase
    .from("chats")
    .update({
      titulo: input.titulo?.trim() || current.titulo,
      contato_nome:
        normalizeOptionalText(input.contatoNome) ??
        contactSnapshot.contatoNome ??
        normalizeOptionalText(current.contato_nome),
      contato_telefone:
        normalizeOptionalText(input.contatoTelefone) ??
        contactSnapshot.contatoTelefone ??
        normalizeOptionalText(current.contato_telefone),
      contato_avatar_url:
        normalizeOptionalText(input.contatoAvatarUrl) ??
        contactSnapshot.contatoAvatarUrl ??
        normalizeOptionalText(current.contato_avatar_url),
      total_tokens: (current.total_tokens ?? 0) + (input.totalTokensToAdd ?? 0),
      total_custo: Number(current.total_custo ?? 0) + Number(input.totalCustoToAdd ?? 0),
      contexto: input.contexto ?? undefined,
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.chatId)

  if (error) {
    console.error("[chats] failed to update chat stats", error)
  }
}

export async function findActiveChatByChannel(input) {
  const supabase = getSupabaseAdminClient()
  let query = supabase
    .from("chats")
    .select(
      "id, titulo, contato_nome, contato_telefone, contato_avatar_url, status, created_at, updated_at, total_tokens, total_custo, agente_id, usuario_id, projeto_id, canal, identificador_externo, contexto"
    )
    .eq("canal", input.canal)
    .eq("identificador_externo", input.identificadorExterno.trim())
    .eq("status", "ativo")
    .order("updated_at", { ascending: false })
    .limit(input.channelScopeId ? 20 : 1)

  if (input.projetoId) {
    query = query.eq("projeto_id", input.projetoId)
  }

  if (input.agenteId) {
    query = query.eq("agente_id", input.agenteId)
  }

  if (!input.channelScopeId) {
    const { data, error } = await query.maybeSingle()

    if (error || !data) {
      if (error) {
        console.error("[chats] failed to find active chat by channel", error)
      }
      return null
    }

    return mapChat(data)
  }

  const { data, error } = await query
  if (error || !data) {
    if (error) {
      console.error("[chats] failed to find active chat candidates by channel", error)
    }
    return null
  }

  const match = findChatByChannelScope(data, input.channelScopeId)

  return match
}

export async function findActiveWhatsAppChatByPhone(input) {
  const normalizedPhone = normalizeWhatsAppLookupPhone(input.phone)
  if (!normalizedPhone) {
    return null
  }

  const supabase = getSupabaseAdminClient()
  let query = supabase
    .from("chats")
    .select(
      "id, titulo, contato_nome, contato_telefone, contato_avatar_url, status, created_at, updated_at, total_tokens, total_custo, agente_id, usuario_id, projeto_id, canal, identificador_externo, contexto"
    )
    .eq("canal", "whatsapp")
    .eq("status", "ativo")
    .order("updated_at", { ascending: false })
    .limit(50)

  if (input.projetoId) {
    query = query.eq("projeto_id", input.projetoId)
  }

  if (input.agenteId) {
    query = query.eq("agente_id", input.agenteId)
  }

  const { data, error } = await query
  if (error || !data) {
    if (error) {
      console.error("[chats] failed to find active whatsapp chats by phone", error)
    }
    return null
  }

  return findChatByWhatsAppPhone(data, input)
}

export async function findActiveChatByContactPhone(input) {
  const normalizedPhone = normalizeWhatsAppLookupPhone(input.phone)
  if (!normalizedPhone) {
    return null
  }

  const supabase = getSupabaseAdminClient()
  let query = supabase
    .from("chats")
    .select(
      "id, titulo, contato_nome, contato_telefone, contato_avatar_url, status, created_at, updated_at, total_tokens, total_custo, agente_id, usuario_id, projeto_id, canal, identificador_externo, contexto"
    )
    .eq("status", "ativo")
    .neq("canal", "admin_agent_test")
    .order("updated_at", { ascending: false })
    .limit(50)

  if (input.projetoId) {
    query = query.eq("projeto_id", input.projetoId)
  }

  if (input.agenteId) {
    query = query.eq("agente_id", input.agenteId)
  }

  const { data, error } = await query
  if (error || !data) {
    if (error) {
      console.error("[chats] failed to find active chats by contact phone", error)
    }
    return null
  }

  return findChatByWhatsAppPhone(data, {
    phone: normalizedPhone,
    channelScopeId: null,
  })
}
