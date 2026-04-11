import "server-only"

import { getSupabaseAdminClient } from "@/lib/supabase-admin"

function mapAgent(row) {
  return {
    id: row.id,
    nome: row.nome?.trim() || "Agente sem nome",
    slug: row.slug?.trim() || null,
    descricao: row.descricao?.trim() || "",
    promptBase: row.prompt_base?.trim() || "",
    configuracoes: row.configuracoes ?? null,
    ativo: row.ativo !== false,
    projetoId: row.projeto_id ?? null,
    modeloId: row.modelo_id ?? null,
    apiIds: [],
    arquivos: [],
    createdAt: row.created_at ?? new Date().toISOString(),
  }
}

export async function getAgenteAtivo(projetoId) {
  if (!projetoId) {
    return null
  }

  try {
    const supabase = getSupabaseAdminClient()
    const { data, error } = await supabase
      .from("agentes")
      .select("id, slug, nome, descricao, prompt_base, configuracoes, ativo, projeto_id, modelo_id, created_at")
      .eq("projeto_id", projetoId)
      .eq("ativo", true)
      .order("updated_at", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false, nullsFirst: false })
      .limit(1)
      .maybeSingle()

    if (error || !data) {
      if (error) {
        console.error("[agentes] failed to get active agent", error)
      }
      return null
    }

    return mapAgent(data)
  } catch (error) {
    console.error("[agentes] failed to get active agent", error)
    return null
  }
}

export async function getAgenteById(id) {
  if (!id) {
    return null
  }

  try {
    const supabase = getSupabaseAdminClient()
    const { data, error } = await supabase
      .from("agentes")
      .select("id, slug, nome, descricao, prompt_base, configuracoes, ativo, projeto_id, modelo_id, created_at")
      .eq("id", id)
      .maybeSingle()

    if (error || !data) {
      if (error) {
        console.error("[agentes] failed to get agent by id", error)
      }
      return null
    }

    return mapAgent(data)
  } catch (error) {
    console.error("[agentes] failed to get agent by id", error)
    return null
  }
}

export async function getAgenteByIdentifier(identifier, projetoId) {
  const value = String(identifier || "").trim()
  if (!value) {
    return null
  }

  try {
    const supabase = getSupabaseAdminClient()
    let slugQuery = supabase
      .from("agentes")
      .select("id, slug, nome, descricao, prompt_base, configuracoes, ativo, projeto_id, modelo_id, created_at")
      .eq("slug", value)
      .limit(1)

    if (projetoId) {
      slugQuery = slugQuery.eq("projeto_id", projetoId)
    }

    const { data: slugData, error: slugError } = await slugQuery.maybeSingle()
    if (slugData) {
      return mapAgent(slugData)
    }
    if (slugError) {
      console.error("[agentes] failed to get agent by slug", slugError)
    }

    const byId = await getAgenteById(value)
    if (!byId) {
      return null
    }

    if (projetoId && byId.projetoId !== projetoId) {
      return null
    }

    return byId
  } catch (error) {
    console.error("[agentes] failed to get agent by identifier", error)
    return null
  }
}
