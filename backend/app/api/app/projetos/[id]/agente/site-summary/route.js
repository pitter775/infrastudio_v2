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

function buildSiteDigest({ url, title, description, headings, paragraphs, keywords }) {
  return [
    `URL: ${url}`,
    title ? `Titulo: ${title}` : null,
    description ? `Descricao meta: ${description}` : null,
    keywords.length ? `Palavras-chave: ${keywords.join(", ")}` : null,
    headings.length ? `Headings:\n- ${headings.join("\n- ")}` : null,
    paragraphs.length ? `Paragrafos relevantes:\n- ${paragraphs.join("\n- ")}` : null,
  ]
    .filter(Boolean)
    .join("\n\n")
}

async function generateSummaryWithOpenAI(siteDigest) {
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
                "Voce recebe informacoes extraidas do site de um cliente. Gere um texto curto em portugues para somar ao prompt de um agente comercial. Responda em formato util para prompt, com foco em: empresa, servicos/produtos, tom, publico, diferenciais, palavras importantes e cuidados. Nao invente fatos. Se algo estiver incerto, diga que deve ser confirmado. Estruture com bullets curtos.",
            },
          ],
        },
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: siteDigest,
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

  if (!summary) {
    throw new Error("OpenAI nao retornou texto util para o resumo do site.")
  }

  return {
    summary,
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

  if (!rawUrl) {
    return NextResponse.json({ error: "URL obrigatoria." }, { status: 400 })
  }

  let parsedUrl
  try {
    parsedUrl = new URL(rawUrl)
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
    const siteDigest = buildSiteDigest({
      url: parsedUrl.toString(),
      title,
      description,
      headings,
      paragraphs,
      keywords,
    })

    const aiResult = await generateSummaryWithOpenAI(siteDigest)
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
        source: {
          url: parsedUrl.toString(),
          title,
          logoUrl,
          description,
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
