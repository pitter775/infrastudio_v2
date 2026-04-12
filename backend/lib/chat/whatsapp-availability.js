function hasText(value) {
  return typeof value === "string" && value.trim().length > 0
}

export function hasConfiguredWhatsAppDestination(context = {}) {
  return Boolean(getConfiguredWhatsAppDestination(context))
}

export function getConfiguredWhatsAppDestination(context = {}) {
  const channelKind = String(context?.channel?.kind ?? context?.canal ?? "").toLowerCase()
  if (channelKind === "whatsapp") {
    return "current_channel"
  }

  const widget = context?.widget
  if (widget && typeof widget === "object") {
    if (hasText(widget.whatsapp_celular)) return widget.whatsapp_celular.trim()
    if (hasText(widget.whatsappCelular)) return widget.whatsappCelular.trim()
    if (hasText(widget.whatsapp)) return widget.whatsapp.trim()
  }

  const whatsapp = context?.whatsapp
  if (whatsapp && typeof whatsapp === "object") {
    if (hasText(whatsapp.numero)) return whatsapp.numero.trim()
    if (hasText(whatsapp.number)) return whatsapp.number.trim()
    if (hasText(whatsapp.channelId)) return whatsapp.channelId.trim()
  }

  return null
}

export function buildWhatsAppUnavailableInstruction() {
  return "WhatsApp nao disponivel: nao prometa, nao direcione e nao peca para continuar no WhatsApp sem numero/canal cadastrado. Continue o atendimento neste chat."
}
