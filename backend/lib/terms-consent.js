import "server-only"

import { getSupabaseAdminClient } from "@/lib/supabase-admin"

export const TERMS_VERSION = "2026-05-15"

export function normalizeTermsConsent(row) {
  return {
    accepted: row?.terms_accepted === true,
    acceptedAt: row?.terms_accepted_at || null,
    version: row?.terms_version || null,
  }
}

function isMissingTermsColumnError(error) {
  const message = String(error?.message || error?.details || error || "")
  return /terms_accepted|terms_accepted_at|terms_version|schema cache|column/i.test(message)
}

export async function getTermsConsentForUser(user) {
  if (!user?.id) {
    return normalizeTermsConsent(null)
  }

  const supabase = getSupabaseAdminClient()
  const { data, error } = await supabase
    .from("usuarios")
    .select("terms_accepted, terms_accepted_at, terms_version")
    .eq("id", user.id)
    .maybeSingle()

  if (error) {
    if (!isMissingTermsColumnError(error)) {
      console.error("[terms-consent] failed to load user consent", error)
    }
    return normalizeTermsConsent(null)
  }

  return normalizeTermsConsent(data)
}

export async function acceptTermsForUser(user) {
  if (!user?.id) {
    return { consent: normalizeTermsConsent(null), error: "Não autenticado." }
  }

  const supabase = getSupabaseAdminClient()
  const now = new Date().toISOString()
  const { data, error } = await supabase
    .from("usuarios")
    .update({
      terms_accepted: true,
      terms_accepted_at: now,
      terms_version: TERMS_VERSION,
      updated_at: now,
    })
    .eq("id", user.id)
    .select("terms_accepted, terms_accepted_at, terms_version")
    .maybeSingle()

  if (error) {
    console.error("[terms-consent] failed to accept terms", error)
    return { consent: normalizeTermsConsent(null), error: "Não foi possível registrar o aceite dos termos." }
  }

  return { consent: normalizeTermsConsent(data), error: null }
}
