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
  const { error } = await supabase
    .from("avisos_leituras")
    .upsert(rows, { onConflict: "usuario_id,aviso_chave" })

  if (error) {
    console.error("[avisos] failed to mark notices as read", error)
    return false
  }

  return true
}
