import "server-only"

import { getSupabaseAdminClient } from "@/lib/supabase-admin"

function normalizeNoticeKey(value) {
  return String(value || "").trim()
}

export async function listReadNoticeKeys(userId, keys, deps = {}) {
  const normalizedUserId = String(userId || "").trim()
  const normalizedKeys = Array.from(new Set((Array.isArray(keys) ? keys : []).map(normalizeNoticeKey).filter(Boolean)))

  if (!normalizedUserId || normalizedKeys.length === 0) {
    return new Set()
  }

  const supabase = deps.supabase ?? getSupabaseAdminClient()
  const { data, error } = await supabase
    .from("avisos_leituras")
    .select("aviso_chave")
    .eq("usuario_id", normalizedUserId)
    .in("aviso_chave", normalizedKeys)

  if (error) {
    console.error("[avisos] failed to list read notice keys", error)
    return new Set()
  }

  return new Set((data ?? []).map((item) => item.aviso_chave).filter(Boolean))
}

export async function markNoticeKeysAsRead(userId, items, deps = {}) {
  const normalizedUserId = String(userId || "").trim()
  const now = new Date().toISOString()
  const rows = Array.from(new Map(
    (Array.isArray(items) ? items : [])
      .map((item) => ({
        usuario_id: normalizedUserId,
        aviso_chave: normalizeNoticeKey(item?.readKey),
        aviso_tipo: String(item?.kind || "").trim() || null,
        destino: String(item?.href || "").trim() || null,
        lido_em: now,
        created_at: now,
        updated_at: now,
      }))
      .filter((item) => item.usuario_id && item.aviso_chave)
      .map((item) => [item.aviso_chave, item]),
  ).values())

  if (!rows.length) {
    return true
  }

  const supabase = deps.supabase ?? getSupabaseAdminClient()
  const keys = rows.map((item) => item.aviso_chave)
  const { data: existingRows, error: existingError } = await supabase
    .from("avisos_leituras")
    .select("aviso_chave")
    .eq("usuario_id", normalizedUserId)
    .in("aviso_chave", keys)

  if (existingError) {
    console.error("[avisos] failed to read existing notices before mark as read", existingError)
    return false
  }

  const existingKeys = new Set((existingRows ?? []).map((item) => item.aviso_chave).filter(Boolean))
  const missingRows = rows.filter((item) => !existingKeys.has(item.aviso_chave))

  if (missingRows.length) {
    const { error: insertError } = await supabase
      .from("avisos_leituras")
      .insert(missingRows)

    if (insertError) {
      console.error("[avisos] failed to insert read notices", insertError)
      return false
    }
  }

  if (existingKeys.size) {
    const { error: updateError } = await supabase
      .from("avisos_leituras")
      .update({ lido_em: now, updated_at: now })
      .eq("usuario_id", normalizedUserId)
      .in("aviso_chave", Array.from(existingKeys))

    if (updateError) {
      console.error("[avisos] failed to update read notices", updateError)
      return false
    }
  }

  return true
}
