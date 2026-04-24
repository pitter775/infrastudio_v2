import { NextResponse } from "next/server"

import { updateAgentBrandingForUser } from "@/lib/agentes"
import { buildChatUsageTelemetry } from "@/lib/chat-usage-metrics"
import { estimateOpenAICostUsd } from "@/lib/openai-pricing"
import { getProjectForUser } from "@/lib/projetos"
import { getSessionUser } from "@/lib/session"
import { getSupabaseAdminClient } from "@/lib/supabase-admin"

const SITE_SUMMARY_MODEL = process.env.OPENAI_CHAT_MODEL?.trim() || "gpt-4o-mini"
const STOP_WORDS = new Set([
  "a", "as", "o", "os", "de", "da", "do", "das", "dos", "e", "em", "no", "na", "nos", "nas",
  "por", "para", "com", "sem", "uma", "um", "uns", "umas", "que", "se", "ao", "aos", "ou",
  "site", "home", "mais", "sua", "seu", "seus", "suas", "sobre", "como", "sao", "ser", "the",
  "and", "for", "with", "your", "you", "our", "are", "this", "that", "from",
])

function isPlainObject(value) {
  return Boolean(value && typeof value === "object" && !Array.isArray(value))
}

function stripTags(value) {
  return String(value || "")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/\s+/g, " ")
    .trim()
}

function extractTagContent(html, tagName) {
  const match = html.match(new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)<\\/${tagName}>`, "i"))
  return stripTags(match?.[1] || "")
}

function extractMetaContent(html, key) {
  const patterns = [
    new RegExp(`<meta[^>]+name=["']${key}["'][^>]+content=["']([^"']+)["'][^>]*>`, "i"),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+name=["']${key}["'][^>]*>`, "i"),
    new RegExp(`<meta[^>]+property=["']${key}["'][^>]+content=["']([^"']+)["'][^>]*>`, "i"),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+property=["']${key}["'][^>]*>`, "i"),
  ]

  for (const pattern of patterns) {
    const match = html.match(pattern)
    if (match?.[1]) {
      return stripTags(match[1])
    }
  }

  return ""
}

function extractLogoUrl(html, baseUrl) {
  const linkMatches = [...html.matchAll(/<link[^>]+rel=["']([^"']+)["'][^>]*>/gi)]

  for (const match of linkMatches) {
    const fullTag = match[0] || ""
    const relValue = String(match[1] || "").toLowerCase()
    if (!/(icon|apple-touch-icon)/.test(relValue)) {
      continue
    }

    const hrefMatch =
      fullTag.match(/href=["']([^"']+)["']/i) ||
      fullTag.match(/href=([^\s>]+)/i)

    if (!hrefMatch?.[1]) {
      continue
    }

    try {
      return new URL(hrefMatch[1], baseUrl).toString()
    } catch {}
  }

  const ogImage = extractMetaContent(html, "og:image") || extractMetaContent(html, "twitter:image")
  if (ogImage) {
    try {
      return new URL(ogImage, baseUrl).toString()
    } catch {}
  }

  try {
    return new URL("/favicon.ico", baseUrl).toString()
  } catch {}

  return ""
}

function extractHeadings(html) {
  return [...html.matchAll(/<h[1-3][^>]*>([\s\S]*?)<\/h[1-3]>/gi)]
    .map((match) => stripTags(match[1]))
    .filter(Boolean)
    .slice(0, 10)
}

function extractParagraphs(html) {
  return [...html.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)]
    .map((match) => stripTags(match[1]))
    .filter((item) => item.length > 40)
    .slice(0, 20)
}

function uniqueValues(values, limit = 8) {
  return [...new Set(values.map((item) => String(item || "").trim()).filter(Boolean))].slice(0, limit)
}

function cleanInlineText(value) {
  return String(value || "").replace(/\s+/g, " ").trim()
}

function extractJsonLdObjects(html) {
  const blocks = [...html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)]
  const items = []

  for (const block of blocks) {
    const raw = cleanInlineText(block?.[1] || "")
    if (!raw) {
      continue
    }

    try {
      items.push(JSON.parse(raw))
    } catch {}
  }

  return items
}

function flattenJsonLdNodes(input) {
  if (!input) {
    return []
  }

  if (Array.isArray(input)) {
    return input.flatMap((item) => flattenJsonLdNodes(item))
  }

  if (!isPlainObject(input)) {
    return []
  }

  const nestedGraph = Array.isArray(input["@graph"]) ? input["@graph"] : []
  return [input, ...nestedGraph.flatMap((item) => flattenJsonLdNodes(item))]
}

function extractStructuredData(html) {
  const nodes = extractJsonLdObjects(html).flatMap((item) => flattenJsonLdNodes(item))
  const organizations = []
  const people = []
  const contacts = []
  const institutionals = []

  for (const node of nodes) {
    const typeValue = Array.isArray(node["@type"]) ? node["@type"].join(" ") : String(node["@type"] || "")
    const normalizedType = typeValue.toLowerCase()
    const name = cleanInlineText(node.name)
    const description = cleanInlineText(node.description)

    if (/(organization|localbusiness|corporation|store|professionalservice)/i.test(normalizedType)) {
      organizations.push({
        name,
        description,
        foundingDate: cleanInlineText(node.foundingDate),
        slogan: cleanInlineText(node.slogan),
      })

      const contactPoint = Array.isArray(node.contactPoint) ? node.contactPoint : node.contactPoint ? [node.contactPoint] : []
      for (const item of contactPoint) {
        if (!isPlainObject(item)) {
          continue
        }

        contacts.push(
          cleanInlineText(
            [
              cleanInlineText(item.contactType),
              cleanInlineText(item.telephone),
              cleanInlineText(item.email),
            ]
              .filter(Boolean)
              .join(" | "),
          ),
        )
      }

      const address = isPlainObject(node.address)
        ? cleanInlineText(
            [
              node.address.streetAddress,
              node.address.addressLocality,
              node.address.addressRegion,
              node.address.postalCode,
            ]
              .map((item) => cleanInlineText(item))
              .filter(Boolean)
              .join(" - "),
          )
        : ""
      if (address) {
        institutionals.push(`endereco: ${address}`)
      }

      const sameAs = Array.isArray(node.sameAs) ? uniqueValues(node.sameAs, 8) : []
      if (sameAs.length) {
        institutionals.push(`redes: ${sameAs.join(", ")}`)
      }
    }

    if (/(person|employee|founder)/i.test(normalizedType)) {
      people.push(
        cleanInlineText(
          [name, cleanInlineText(node.jobTitle), description]
            .filter(Boolean)
            .join(" - "),
        ),
      )
    }
  }

  return {
    organizations: uniqueValues(organizations.map((item) => [item.name, item.description].filter(Boolean).join(" - ")), 6),
    people: uniqueValues(people, 8),
    contacts: uniqueValues(contacts, 8),
    institutionals: uniqueValues(institutionals, 8),
  }
}

function extractContactInfo(html) {
  const text = stripTags(html)
  const emails = uniqueValues(text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) || [], 6)
  const phones = uniqueValues(
    text.match(/(?:\+?55\s?)?(?:\(?\d{2}\)?\s?)?(?:9\s?)?\d{4}[-.\s]?\d{4}/g) || [],
    6,
  )
  const whatsappLinks = uniqueValues(
    [...html.matchAll(/href=["']([^"']*(?:wa\.me|api\.whatsapp\.com|web\.whatsapp\.com)[^"']*)["']/gi)].map((match) =>
      stripTags(match[1]),
    ),
    4,
  )

  return { emails, phones, whatsappLinks }
}

function extractSocialLinks(html, baseUrl) {
  const socialPatterns = [
    { kind: "instagram", test: /instagram\.com/i },
    { kind: "linkedin", test: /linkedin\.com/i },
    { kind: "facebook", test: /facebook\.com/i },
    { kind: "youtube", test: /youtube\.com|youtu\.be/i },
    { kind: "tiktok", test: /tiktok\.com/i },
    { kind: "x", test: /twitter\.com|x\.com/i },
  ]
  const links = []

  for (const match of html.matchAll(/<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    const href = String(match[1] || "").trim()
    const label = stripTags(match[2])
    let url = ""

    try {
      url = new URL(href, baseUrl).toString()
    } catch {
      continue
    }

    const found = socialPatterns.find((pattern) => pattern.test.test(url))
    if (found) {
      links.push(`${found.kind}: ${label || url} (${url})`)
    }
  }

  return uniqueValues(links, 10)
}

function extractInstitutionalData(html) {
  const text = stripTags(html)
  const cnpjs = uniqueValues(text.match(/\b\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}\b/g) || [], 4)
  const addresses = uniqueValues(
    text.match(
      /\b(?:rua|avenida|av\.|travessa|alameda|rodovia|estrada|pra[çc]a)\s+[a-z0-9à-ÿ.,\- ]{12,120}/gi,
    ) || [],
    4,
  )
  const policies = uniqueValues(
    [...html.matchAll(/<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)]
      .map((match) => `${stripTags(match[2])} ${match[1]}`)
      .filter((item) => /privacidade|politica|termos|troca|devolu[cç][aã]o|garantia/i.test(item)),
    6,
  )

  return {
    cnpjs,
    addresses: addresses.map((item) => cleanInlineText(item)),
    policies: policies.map((item) => cleanInlineText(item)),
  }
}

function extractPeopleInfo(html) {
  const candidates = uniqueValues(
    [...html.matchAll(/<(h[1-6]|strong|b)[^>]*>([\s\S]*?)<\/\1>/gi)]
      .map((match) => stripTags(match[2]))
      .filter((item) => /^[A-ZÀ-Ý][A-Za-zÀ-ÿ' -]{4,60}$/.test(item)),
    8,
  )

  return candidates
}

function extractUsefulLinks(html, baseUrl) {
  const links = []
  const patterns = [
    { kind: "instagram", test: /instagram\.com/i },
    { kind: "linkedin", test: /linkedin\.com/i },
    { kind: "facebook", test: /facebook\.com/i },
    { kind: "youtube", test: /youtube\.com|youtu\.be/i },
    { kind: "contato", test: /contato|contact|atendimento|suporte/i },
    { kind: "sobre", test: /sobre|empresa|quem-somos|about/i },
  ]

  for (const match of html.matchAll(/<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    const href = String(match[1] || "").trim()
    const label = stripTags(match[2])
    let url = ""

    try {
      url = new URL(href, baseUrl).toString()
    } catch {
      continue
    }

    const kind = patterns.find((pattern) => pattern.test.test(`${url} ${label}`))?.kind
    if (kind) {
      links.push(`${kind}: ${label || url} (${url})`)
    }
  }

  return uniqueValues(links, 10)
}

function extractKeywords(text) {
  const counts = new Map()
  const normalized = stripTags(text)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")

  for (const word of normalized.match(/[a-z0-9]{4,}/g) || []) {
    if (STOP_WORDS.has(word)) continue
    counts.set(word, (counts.get(word) || 0) + 1)
  }

  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([word]) => word)
}

function buildSiteDigest({
  url,
  title,
  description,
  headings,
  paragraphs,
  keywords,
  contacts,
  usefulLinks,
  socialLinks,
  institutionalData,
  people,
  structuredData,
}) {
  return [
    `URL: ${url}`,
    title ? `Titulo: ${title}` : null,
    description ? `Descricao meta: ${description}` : null,
    keywords.length ? `Palavras-chave: ${keywords.join(", ")}` : null,
    contacts.emails.length ? `Emails encontrados: ${contacts.emails.join(", ")}` : null,
    contacts.phones.length ? `Telefones encontrados: ${contacts.phones.join(", ")}` : null,
    contacts.whatsappLinks.length ? `Links de WhatsApp: ${contacts.whatsappLinks.join(", ")}` : null,
    institutionalData.cnpjs.length ? `CNPJs encontrados: ${institutionalData.cnpjs.join(", ")}` : null,
    institutionalData.addresses.length ? `Enderecos encontrados: ${institutionalData.addresses.join(", ")}` : null,
    institutionalData.policies.length ? `Paginas institucionais: ${institutionalData.policies.join(", ")}` : null,
    people.length ? `Pessoas/equipe mencionadas:\n- ${people.join("\n- ")}` : null,
    structuredData.organizations.length ? `Organizacoes estruturadas:\n- ${structuredData.organizations.join("\n- ")}` : null,
    structuredData.contacts.length ? `Contatos estruturados:\n- ${structuredData.contacts.join("\n- ")}` : null,
    structuredData.institutionals.length ? `Dados institucionais estruturados:\n- ${structuredData.institutionals.join("\n- ")}` : null,
    structuredData.people.length ? `Pessoas estruturadas:\n- ${structuredData.people.join("\n- ")}` : null,
    socialLinks.length ? `Redes sociais:\n- ${socialLinks.join("\n- ")}` : null,
    usefulLinks.length ? `Links institucionais e sociais:\n- ${usefulLinks.join("\n- ")}` : null,
    headings.length ? `Headings:\n- ${headings.join("\n- ")}` : null,
    paragraphs.length ? `Paragrafos relevantes:\n- ${paragraphs.join("\n- ")}` : null,
  ]
    .filter(Boolean)
    .join("\n\n")
}

function parseJsonModelOutput(value) {
  const raw = String(value || "").trim()
  if (!raw) {
    return null
  }

  const normalized = raw
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim()

  try {
    return JSON.parse(normalized)
  } catch {
    return null
  }
}

async function generateSummaryWithOpenAI(siteDigest, currentPrompt = "") {
  const openAiKey = process.env.OPENAI_API_KEY?.trim()

  if (!openAiKey) {
    throw new Error("OPENAI_API_KEY nao configurada para gerar resumo automatico.")
  }

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${openAiKey}`,
    },
    body: JSON.stringify({
      model: SITE_SUMMARY_MODEL,
      input: [
        {
          role: "system",
          content: [
            {
              type: "input_text",
              text:
                "Voce recebe informacoes extraidas do site de um cliente e opcionalmente um texto ja escrito no editor do agente. Responda apenas JSON valido com as chaves summary, promptSuggestion e mergedEditorDraft. summary deve ser em portugues, enxuto, com secoes curtas: empresa, produtos/servicos, publico, diferenciais, contato, pessoas/equipe, dados institucionais, tom recomendado, palavras importantes, limites/cuidados e perguntas de qualificacao. promptSuggestion deve ser um prompt-base sugerido para um agente comercial desse negocio, sem markdown. mergedEditorDraft deve ser o melhor texto final para ficar no editor do usuario: consolidado, organizado, sem repeticoes, preservando informacoes relevantes que ja existiam e incorporando o que veio do site. Estruture bem em portugues, com blocos curtos e listas quando fizer sentido. Nao invente fatos. Se algo estiver incerto, diga que precisa de confirmacao.",
            },
          ],
        },
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: [
                currentPrompt ? `Texto atual do editor:\n${String(currentPrompt).trim()}` : null,
                `Informacoes extraidas do site:\n${siteDigest}`,
              ]
                .filter(Boolean)
                .join("\n\n"),
            },
          ],
        },
      ],
    }),
  })

  if (!response.ok) {
    throw new Error(`OpenAI retornou ${response.status} ao gerar resumo do site.`)
  }

  const payload = await response.json()
  const summary =
    payload.output_text?.trim() ||
    payload.output
      ?.flatMap((item) => item?.content || [])
      ?.map((item) => item?.text || "")
      ?.join("\n")
      ?.trim() ||
    ""
  const parsed = parseJsonModelOutput(summary)

  if (parsed?.summary) {
    return {
      summary: String(parsed.summary).trim(),
      promptSuggestion: String(parsed.promptSuggestion || "").trim(),
      mergedEditorDraft: String(parsed.mergedEditorDraft || "").trim(),
      inputTokens: payload.usage?.input_tokens ?? 0,
      outputTokens: payload.usage?.output_tokens ?? 0,
      model: payload.model || SITE_SUMMARY_MODEL,
    }
  }

  if (!summary) {
    throw new Error("OpenAI nao retornou texto util para o resumo do site.")
  }

  return {
    summary,
    promptSuggestion: "",
    mergedEditorDraft: "",
    inputTokens: payload.usage?.input_tokens ?? 0,
    outputTokens: payload.usage?.output_tokens ?? 0,
    model: payload.model || SITE_SUMMARY_MODEL,
  }
}

async function recordUsage(projectId, userId, usage) {
  const inputTokens = Math.max(0, Number(usage.inputTokens ?? 0))
  const outputTokens = Math.max(0, Number(usage.outputTokens ?? 0))
  const estimatedCostUsd = estimateOpenAICostUsd(inputTokens, outputTokens, usage.model)
  const usageTelemetry = buildChatUsageTelemetry({
    channelKind: "admin_agent_site_summary",
    provider: "openai",
    model: usage.model,
    routeStage: "agent_editor",
    domainStage: "site_summary",
    inputTokens,
    outputTokens,
    estimatedCostUsd,
  })

  const supabase = getSupabaseAdminClient()
  const { error } = await supabase.from("consumos").insert({
    projeto_id: projectId,
    usuario_id: userId ?? null,
    origem: usageTelemetry.billingOrigin,
    tokens_input: inputTokens,
    tokens_output: outputTokens,
    custo_total: estimatedCostUsd,
    referencia_id: null,
  })

  if (error) {
    console.error("[agente] failed to record site summary usage", error)
  }

  return {
    estimatedCostUsd,
    usageTelemetry,
  }
}

export async function POST(request, context) {
  const user = await getSessionUser()

  if (!user) {
    return NextResponse.json({ error: "Nao autenticado." }, { status: 401 })
  }

  const { id } = await context.params
  const project = await getProjectForUser(id, user)

  if (!project) {
    return NextResponse.json({ error: "Projeto nao encontrado." }, { status: 404 })
  }

  const body = await request.json().catch(() => ({}))
  const rawUrl = String(body?.url || "").trim()
  const currentPrompt = String(body?.currentPrompt || "").trim()

  if (!rawUrl) {
    return NextResponse.json({ error: "URL obrigatoria." }, { status: 400 })
  }

  let parsedUrl
  try {
    parsedUrl = new URL(/^https?:\/\//i.test(rawUrl) ? rawUrl : `https://${rawUrl}`)
  } catch {
    return NextResponse.json({ error: "URL invalida." }, { status: 400 })
  }

  if (!["http:", "https:"].includes(parsedUrl.protocol)) {
    return NextResponse.json({ error: "Use uma URL http ou https." }, { status: 400 })
  }

  try {
    const response = await fetch(parsedUrl.toString(), {
      headers: {
        "User-Agent": "InfraStudioBot/1.0",
        Accept: "text/html,application/xhtml+xml",
      },
      redirect: "follow",
      cache: "no-store",
    })

    if (!response.ok) {
      return NextResponse.json({ error: `Nao foi possivel ler o site (${response.status}).` }, { status: 400 })
    }

    const html = await response.text()
    const title = extractTagContent(html, "title")
    const logoUrl = extractLogoUrl(html, parsedUrl)
    const description =
      extractMetaContent(html, "description") ||
      extractMetaContent(html, "og:description") ||
      extractMetaContent(html, "twitter:description")
    const headings = extractHeadings(html)
    const paragraphs = extractParagraphs(html)
    const keywords = extractKeywords(`${title} ${description} ${headings.join(" ")} ${paragraphs.join(" ")}`)
    const contacts = extractContactInfo(html)
    const usefulLinks = extractUsefulLinks(html, parsedUrl)
    const socialLinks = extractSocialLinks(html, parsedUrl)
    const institutionalData = extractInstitutionalData(html)
    const people = extractPeopleInfo(html)
    const structuredData = extractStructuredData(html)
    const siteDigest = buildSiteDigest({
      url: parsedUrl.toString(),
      title,
      description,
      headings,
      paragraphs,
      keywords,
      contacts,
      usefulLinks,
      socialLinks,
      institutionalData,
      people,
      structuredData,
    })

    const aiResult = await generateSummaryWithOpenAI(siteDigest, currentPrompt)
    const usage = await recordUsage(project.id, user.id, aiResult)
    const brandingAgent =
      project.agent?.id
        ? await updateAgentBrandingForUser(
            {
              agenteId: project.agent.id,
              projetoId: project.id,
              siteUrl: parsedUrl.toString(),
              logoUrl,
            },
            user,
          )
        : null

    return NextResponse.json(
      {
        summary: aiResult.summary,
        promptSuggestion: aiResult.promptSuggestion,
        mergedEditorDraft: aiResult.mergedEditorDraft,
        source: {
          url: parsedUrl.toString(),
          title,
          logoUrl,
          description,
          contacts,
          socialLinks,
          usefulLinks,
          institutionalData,
          people,
          structuredData,
        },
        usage: {
          inputTokens: aiResult.inputTokens,
          outputTokens: aiResult.outputTokens,
          totalTokens: aiResult.inputTokens + aiResult.outputTokens,
          estimatedCostUsd: usage.estimatedCostUsd,
          billingOrigin: usage.usageTelemetry.billingOrigin,
          model: aiResult.model,
        },
        brandingSaved: Boolean(brandingAgent),
      },
      { status: 200 },
    )
  } catch (error) {
    console.error("[agente] failed to generate site summary", error)
    return NextResponse.json({ error: error.message || "Nao foi possivel processar o site informado." }, { status: 500 })
  }
}
