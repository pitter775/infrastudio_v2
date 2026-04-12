import "server-only"

import { getAgenteById } from "@/lib/agentes"
import { getChatWidgetBySlug } from "@/lib/chat-widgets"
import { getProjetoById } from "@/lib/projetos"

export const INFRASTUDIO_HOME_PROJECT_ID = "7d965fd5-2487-4efc-b3df-1d28fa3d5377"
export const INFRASTUDIO_HOME_AGENT_ID = "e0c00703-726d-477e-926d-9e9986a67db0"
export const INFRASTUDIO_HOME_WIDGET_SLUG = "infrastudio-home"

export async function getInfraStudioHomeChatConfig() {
  const widget = await getChatWidgetBySlug(INFRASTUDIO_HOME_WIDGET_SLUG)
  const projetoId = widget?.projetoId || INFRASTUDIO_HOME_PROJECT_ID
  const projeto = await getProjetoById(projetoId)

  if (!projeto?.id) {
    return null
  }

  const agente = await getAgenteById(widget?.agenteId || INFRASTUDIO_HOME_AGENT_ID)
  const agenteIdentifier = agente?.id || null

  if (!agenteIdentifier || agente.projetoId !== projeto.id || !agente.ativo) {
    return null
  }

  return {
    projeto: projeto.id,
    agente: agenteIdentifier,
    widget: widget?.slug || INFRASTUDIO_HOME_WIDGET_SLUG,
  }
}
