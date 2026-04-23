import "server-only"

import { getSupabaseAdminClient } from "@/lib/supabase-admin"

const DEFAULT_MODEL_PROVIDER = "openai"
const DEFAULT_MODEL_NAME = "GPT-4o Mini"
const DEFAULT_MODEL_SLUG = "gpt-4o-mini"

function buildDefaultModelConfig() {
  return {
    model: DEFAULT_MODEL_SLUG,
    label: DEFAULT_MODEL_NAME,
    fallback: true,
  }
}

export async function getOrCreateDefaultModelId(deps = {}) {
  try {
    const supabase = deps.supabase ?? getSupabaseAdminClient()

    const { data: existingActiveModel, error: existingActiveModelError } = await supabase
      .from("modelos")
      .select("id, nome, provider, configuracoes, ativo")
      .eq("ativo", true)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle()

    if (existingActiveModelError) {
      console.error("[modelos] failed to read active model", existingActiveModelError)
      return null
    }

    if (existingActiveModel?.id) {
      return existingActiveModel.id
    }

    const { data: existingFallbackModel, error: existingFallbackModelError } = await supabase
      .from("modelos")
      .select("id")
      .eq("nome", DEFAULT_MODEL_NAME)
      .eq("provider", DEFAULT_MODEL_PROVIDER)
      .limit(1)
      .maybeSingle()

    if (existingFallbackModelError) {
      console.error("[modelos] failed to read fallback model", existingFallbackModelError)
      return null
    }

    if (existingFallbackModel?.id) {
      const { error: reactivateError } = await supabase
        .from("modelos")
        .update({
          ativo: true,
          configuracoes: buildDefaultModelConfig(),
        })
        .eq("id", existingFallbackModel.id)

      if (reactivateError) {
        console.error("[modelos] failed to reactivate fallback model", reactivateError)
      }

      return existingFallbackModel.id
    }

    const now = new Date().toISOString()
    const { data: createdModel, error: createModelError } = await supabase
      .from("modelos")
      .insert({
        nome: DEFAULT_MODEL_NAME,
        provider: DEFAULT_MODEL_PROVIDER,
        ativo: true,
        configuracoes: buildDefaultModelConfig(),
        created_at: now,
      })
      .select("id")
      .maybeSingle()

    if (createModelError) {
      console.error("[modelos] failed to create fallback model", createModelError)
      return null
    }

    return createdModel?.id ?? null
  } catch (error) {
    console.error("[modelos] failed to resolve default model", error)
    return null
  }
}
