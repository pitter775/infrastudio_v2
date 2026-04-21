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

  const whatsapp = context?.whatsapp
  if (whatsapp && typeof whatsapp === "object") {
    if (whatsapp.ctaEnabled === false) {
      return null
    }

    if (whatsapp.ctaEnabled === true) {
      if (hasText(whatsapp.numero)) return whatsapp.numero.trim()
      if (hasText(whatsapp.number)) return whatsapp.number.trim()
      if (hasText(whatsapp.channelId)) return whatsapp.channelId.trim()
    }
  }

  return null
}

export function buildWhatsAppUnavailableInstruction() {
  return "Sem canal de WhatsApp configurado. Nao ofereca migracao para WhatsApp, nao mencione indisponibilidade e siga normalmente neste chat."
}
