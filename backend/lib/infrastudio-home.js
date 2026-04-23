import "server-only"

import { getAgenteByIdentifier } from "@/lib/agentes"
import { getChatWidgetBySlug } from "@/lib/chat-widgets"
import { getProjetoBySlug } from "@/lib/projetos"

export const INFRASTUDIO_HOME_PROJECT_SLUG = "infrastudio"
export const INFRASTUDIO_HOME_AGENT_IDENTIFIER = "infrastudio-assistente"
export const INFRASTUDIO_HOME_WIDGET_SLUG = "infrastudio-chat"

export async function getInfraStudioHomeChatConfig() {
  const projeto = await getProjetoBySlug(INFRASTUDIO_HOME_PROJECT_SLUG)

  if (!projeto?.id) {
    return null
  }

  const widget = await getChatWidgetBySlug(INFRASTUDIO_HOME_WIDGET_SLUG)

  if (!widget?.projetoId || !widget?.agenteId || widget.slug !== INFRASTUDIO_HOME_WIDGET_SLUG) {
    return null
  }

  if (widget.projetoId !== projeto.id) {
    return null
  }

  const agente = await getAgenteByIdentifier(INFRASTUDIO_HOME_AGENT_IDENTIFIER, projeto.id)
  const agenteIdentifier = agente?.slug || agente?.id || null

  if (
    !agenteIdentifier ||
    agente.id !== widget.agenteId ||
    agente.projetoId !== projeto.id ||
    !agente.active
  ) {
    return null
  }

  return {
    projeto: projeto.slug || INFRASTUDIO_HOME_PROJECT_SLUG,
    agente: agenteIdentifier,
    widget: widget?.slug || INFRASTUDIO_HOME_WIDGET_SLUG,
    title: widget?.nome || agente?.name || projeto?.nome || "InfraStudio Chat",
    theme: widget?.tema || "dark",
    accent: widget?.corPrimaria || "#2563eb",
    transparent: widget?.fundoTransparente !== false,
  }
}
