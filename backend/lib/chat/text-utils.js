export function normalizeText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
}

export function buildSearchTokens(value) {
  return normalizeText(value)
    .split(/\s+/)
    .filter((item) => item.length >= 2)
}

export function singularizeToken(value) {
  return String(value || "").replace(/s$/i, "")
}

export function isWhatsAppChannel(contextOrKind) {
  const kind =
    typeof contextOrKind === "string"
      ? contextOrKind
      : contextOrKind?.channel?.kind ?? contextOrKind?.canal

  return normalizeText(kind) === "whatsapp"
}
