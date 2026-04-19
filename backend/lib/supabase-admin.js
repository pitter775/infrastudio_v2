import "server-only"

import { createClient } from "@supabase/supabase-js"

let adminClient = null

function getSupabaseAdminEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim()
  const key = serviceRoleKey || anonKey

  if (!url || !key) {
    throw new Error("Supabase server environment variables are not configured.")
  }

  return {
    url,
    key,
    usingServiceRole: Boolean(serviceRoleKey),
  }
}

export function getSupabaseAdminClient() {
  if (!adminClient) {
    const { url, key } = getSupabaseAdminEnv()

    adminClient = createClient(url, key, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })
  }

  return adminClient
}
