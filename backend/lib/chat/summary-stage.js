export function shouldRefreshSummary(messageCount) {
  return Number(messageCount) > 0 && Number(messageCount) % 4 === 0
}

export async function summarizeConversation(history = [], currentSummary = null) {
  const recent = Array.isArray(history) ? history.slice(-6) : []
  const compact = recent
    .map((item) => {
      const role = item?.role === "assistant" ? "assistente" : "cliente"
      const content = String(item?.content ?? item?.conteudo ?? "").replace(/\s+/g, " ").trim()
      return content ? `${role}:${content}` : ""
    })
    .filter(Boolean)
    .join(" | ")
    .slice(0, 320)

  return JSON.stringify({
    objetivo: null,
    lead: null,
    restricoes: compact || null,
    proximo_passo: currentSummary ? String(currentSummary).slice(0, 180) : null,
  })
}
