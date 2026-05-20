import { getSupabaseAdminClient } from "@/lib/supabase-admin"
import { sanitizeDomain, sanitizeText } from "@/lib/mercado-livre-store-core/sanitize"

const VERCEL_API_BASE_URL = "https://api.vercel.com"

function getVercelDomainConfig() {
  const token = process.env.VERCEL_TOKEN?.trim()
  const projectId = (
    process.env.VERCEL_PROJECT_ID ||
    process.env.VERCEL_PROJECT_NAME ||
    process.env.VERCEL_PROJECT
  )?.trim()
  const teamId = process.env.VERCEL_TEAM_ID?.trim()
  const teamSlug = process.env.VERCEL_TEAM_SLUG?.trim()

  return {
    token,
    projectId,
    teamId,
    teamSlug,
    configured: Boolean(token && projectId),
  }
}

function getApexDomain(value) {
  const domain = sanitizeDomain(value)
  return domain.startsWith("www.") ? domain.slice(4) : domain
}

function getManagedDomains(value) {
  const apex = getApexDomain(value)
  if (!apex) {
    return []
  }

  return [
    { name: apex, redirect: null },
    { name: `www.${apex}`, redirect: apex },
  ]
}

function buildVercelUrl(pathname, config) {
  const url = new URL(pathname, VERCEL_API_BASE_URL)
  if (config.teamId) {
    url.searchParams.set("teamId", config.teamId)
  } else if (config.teamSlug) {
    url.searchParams.set("slug", config.teamSlug)
  }
  return url
}

async function requestVercel(pathname, options = {}) {
  const config = getVercelDomainConfig()
  if (!config.configured) {
    return {
      ok: false,
      status: 0,
      data: null,
      error: "Configure VERCEL_TOKEN e VERCEL_PROJECT_ID para automatizar domínios.",
      configured: false,
    }
  }

  const response = await fetch(buildVercelUrl(pathname, config), {
    method: options.method || "GET",
    headers: {
      authorization: `Bearer ${config.token}`,
      "content-type": "application/json",
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
    cache: "no-store",
  })

  const data = await response.json().catch(() => null)
  return {
    ok: response.ok,
    status: response.status,
    data,
    error: response.ok ? null : sanitizeText(data?.error?.message || data?.message || "Falha ao comunicar com a Vercel.", 500),
    configured: true,
  }
}

async function getProjectDomain(domain) {
  const config = getVercelDomainConfig()
  return requestVercel(`/v9/projects/${encodeURIComponent(config.projectId || "")}/domains/${encodeURIComponent(domain)}`)
}

async function addProjectDomain(domain, redirect = null) {
  const config = getVercelDomainConfig()
  const body = {
    name: domain,
    gitBranch: null,
    redirect,
    redirectStatusCode: redirect ? 308 : null,
  }

  const result = await requestVercel(`/v10/projects/${encodeURIComponent(config.projectId || "")}/domains`, {
    method: "POST",
    body,
  })

  if (result.ok) {
    return result
  }

  if ([400, 409].includes(result.status)) {
    const current = await getProjectDomain(domain)
    if (current.ok) {
      return current
    }
  }

  return result
}

async function verifyProjectDomain(domain) {
  const config = getVercelDomainConfig()
  const verified = await requestVercel(
    `/v9/projects/${encodeURIComponent(config.projectId || "")}/domains/${encodeURIComponent(domain)}/verify`,
    { method: "POST" },
  )

  if (verified.ok) {
    return verified
  }

  const current = await getProjectDomain(domain)
  return current.ok ? current : verified
}

function collectVerificationRecords(results) {
  return results.flatMap((item) =>
    (Array.isArray(item?.data?.verification) ? item.data.verification : []).map((record) => ({
      domain: sanitizeText(record?.domain, 180),
      type: sanitizeText(record?.type, 20),
      value: sanitizeText(record?.value, 500),
      reason: sanitizeText(record?.reason, 180),
    })).filter((record) => record.domain && record.type && record.value)
  )
}

function summarizeVercelDomains(results) {
  const validResults = Array.isArray(results) ? results : []
  const errors = validResults.filter((item) => item?.ok !== true).map((item) => item?.error).filter(Boolean)
  const verified = validResults.length > 0 && validResults.every((item) => item?.data?.verified === true)

  return {
    configured: validResults.every((item) => item?.configured !== false),
    verified,
    status: verified ? "active" : errors.length ? "error" : "configuring",
    errors,
    domains: validResults.map((item) => ({
      name: sanitizeText(item?.data?.name, 180),
      verified: item?.data?.verified === true,
      redirect: sanitizeText(item?.data?.redirect, 180) || null,
      verification: Array.isArray(item?.data?.verification) ? item.data.verification : [],
      error: item?.error || null,
    })),
    verificationRecords: collectVerificationRecords(validResults),
  }
}

function buildDomainNotes(summary) {
  if (!summary.configured) {
    return "Automação Vercel pendente: configure VERCEL_TOKEN e VERCEL_PROJECT_ID."
  }

  if (summary.verified) {
    return "Domínio verificado automaticamente pela Vercel."
  }

  if (summary.errors.length) {
    return `Automação Vercel: ${summary.errors[0]}`
  }

  const verificationRecord = summary.verificationRecords[0]
  if (verificationRecord) {
    return `Aguardando DNS. TXT ${verificationRecord.domain}: ${verificationRecord.value}`
  }

  return "Aguardando DNS do cliente na Vercel."
}

async function updateStoreDomainState(storeId, domain, summary, options = {}) {
  const supabase = options.supabase ?? getSupabaseAdminClient()
  const status = summary.verified ? "active" : summary.status === "error" ? "configuring" : "configuring"
  const active = summary.verified || (summary.configured && !summary.errors.length)
  const { data, error } = await supabase
    .from("mercadolivre_lojas")
    .update({
      dominio_personalizado: domain,
      dominio_status: status,
      dominio_ativo: active,
      dominio_observacoes: buildDomainNotes(summary),
      updated_at: new Date().toISOString(),
    })
    .eq("id", storeId)
    .select("id, dominio_personalizado, dominio_ativo, dominio_status, dominio_observacoes")
    .maybeSingle()

  if (error) {
    console.error("[vercel-domains] failed to update store domain state", error)
  }

  return data || null
}

async function provisionStoreDomain(store, options = {}) {
  const domain = getApexDomain(store?.customDomain || store?.dominio_personalizado)
  if (!store?.id || !domain) {
    return { ok: false, error: "Informe um domínio válido.", summary: null, storeDomain: null }
  }

  const results = []
  for (const item of getManagedDomains(domain)) {
    results.push(await addProjectDomain(item.name, item.redirect))
  }

  const summary = summarizeVercelDomains(results)
  const storeDomain = await updateStoreDomainState(store.id, domain, summary, options)
  return {
    ok: summary.configured && !summary.errors.length,
    domain,
    summary,
    storeDomain,
    error: summary.errors[0] || null,
  }
}

async function verifyStoreDomain(store, options = {}) {
  const domain = getApexDomain(store?.customDomain || store?.dominio_personalizado)
  if (!store?.id || !domain) {
    return { ok: false, error: "Informe um domínio válido.", summary: null, storeDomain: null }
  }

  const results = []
  for (const item of getManagedDomains(domain)) {
    results.push(await verifyProjectDomain(item.name))
  }

  const summary = summarizeVercelDomains(results)
  const storeDomain = await updateStoreDomainState(store.id, domain, summary, options)
  return {
    ok: summary.verified,
    domain,
    summary,
    storeDomain,
    error: summary.errors[0] || null,
  }
}

export {
  getApexDomain,
  getManagedDomains,
  getVercelDomainConfig,
  provisionStoreDomain,
  verifyStoreDomain,
}
