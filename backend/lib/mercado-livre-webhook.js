const DEFAULT_PUBLIC_APP_URL = "https://infrastudio.pro"

export function resolvePublicAppUrl(origin = "") {
  const candidate =
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
    process.env.APP_URL?.trim() ||
    String(origin || "").trim() ||
    DEFAULT_PUBLIC_APP_URL

  return candidate.replace(/\/$/, "")
}

export function buildMercadoLivreRedirectUri(origin = "") {
  return `${resolvePublicAppUrl(origin)}/api/admin/conectores/mercado-livre/callback`
}

export function buildMercadoLivreWebhookUrl(projectId, origin = "") {
  const normalizedProjectId = String(projectId || "").trim()
  const url = new URL(`${resolvePublicAppUrl(origin)}/api/mercado-livre/webhook`)
  url.searchParams.set("canal", "ml")

  if (normalizedProjectId) {
    url.searchParams.set("projeto", normalizedProjectId)
  }

  return url.toString()
}
