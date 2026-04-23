import "server-only"

import { getSupabaseAdminClient } from "@/lib/supabase-admin"

const connectorFields =
  "id, projeto_id, agente_id, slug, nome, tipo, descricao, endpoint_base, metodo_auth, configuracoes, ativo, created_at, updated_at"

function userCanAccessProject(user, projectId) {
  if (user?.role === "admin") {
    return true
  }

  return user?.memberships?.some((item) => item.projetoId === projectId) ?? false
}

function mapConnector(row) {
  return {
    id: row.id,
    projetoId: row.projeto_id,
    agenteId: row.agente_id,
    slug: row.slug || "",
    name: row.nome || "Conector sem nome",
    type: row.tipo || "custom",
    description: row.descricao || "",
    endpointBase: row.endpoint_base || "",
    authMethod: row.metodo_auth || "",
    config: row.configuracoes ?? {},
    active: row.ativo !== false,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function isMercadoLivreConnector(row) {
  const value = `${row?.slug || ""} ${row?.tipo || ""} ${row?.nome || ""}`.toLowerCase()
  return value.includes("mercado") || value.includes("ml")
}

export async function listConnectorsForUser(projetoId, user) {
  if (!projetoId || !userCanAccessProject(user, projetoId)) {
    return []
  }

  try {
    const supabase = getSupabaseAdminClient()
    const { data, error } = await supabase
      .from("conectores")
      .select(connectorFields)
      .eq("projeto_id", projetoId)
      .order("updated_at", { ascending: false, nullsFirst: false })

    if (error) {
      console.error("[conectores] failed to list connectors", error)
      return []
    }

    let mercadoLivreKept = false
    const filtered = (data ?? []).filter((row) => {
      if (!isMercadoLivreConnector(row)) {
        return true
      }

      if (mercadoLivreKept) {
        return false
      }

      mercadoLivreKept = true
      return true
    })

    return filtered.map(mapConnector)
  } catch (error) {
    console.error("[conectores] failed to list connectors", error)
    return []
  }
}
