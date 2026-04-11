import { getAgenteAtivo } from "../../../infrastudio/lib/agentes.ts"
import { processIncomingChatMessage } from "../../../infrastudio/lib/chat-service.ts"
import { listProjetos } from "../../../infrastudio/lib/projetos.ts"
import { conversations } from "@/components/admin/attendance/mock-data"

// Preparado para alternar direto para o orquestrador depois:
// import { generateSalesReply } from "../../../infrastudio/lib/chat-orchestrator.ts"

const USE_ORCHESTRATOR = false

const simulatedAgent = {
  name: "Assistente InfraStudio",
  prompt:
    "Voce e um assistente de vendas simpatico, direto e util. Sempre responda o usuario de forma clara e objetiva.",
}

function mapMessageRole(autor) {
  return autor === "atendente" ? "assistant" : "user"
}

function buildConversationHistory(conversation, texto) {
  const messages = conversation?.mensagens ?? []
  const history = messages.map((message) => ({
    role: mapMessageRole(message.autor),
    content: message.texto,
  }))

  return [
    {
      role: "system",
      content: simulatedAgent.prompt,
    },
    ...history,
    {
      role: "user",
      content: texto,
    },
  ]
}

async function resolveProjectAgent() {
  try {
    const projetos = await listProjetos()

    for (const projeto of projetos) {
      const agente = await getAgenteAtivo(projeto.id)

      if (agente) {
        return { projeto, agente }
      }
    }
  } catch (error) {
    console.error("CHAT PROJECT/AGENT FALLBACK:", error)
  }

  return {
    projeto: null,
    agente: null,
  }
}

export async function handleChat(input) {
  const conversationId = String(input.conversationId ?? "").trim()
  const texto = String(input.texto ?? "").trim()
  const conversation = conversations.find((item) => item.id === conversationId)

  if (USE_ORCHESTRATOR) {
    const history = buildConversationHistory(conversation, texto)

    throw new Error(
      `Orquestrador direto ainda nao esta ativo. Historico preparado com ${history.length} mensagens.`
    )
  }

  const { projeto, agente } = await resolveProjectAgent()
  const result = await processIncomingChatMessage({
    message: texto,
    canal: "web",
    identificadorExterno: conversationId,
    source: "admin_attendance_v2",
    ...(projeto?.id ? { projeto: projeto.id } : {}),
    ...(agente?.id ? { agente: agente.id } : {}),
  })

  return {
    reply: result.reply,
  }
}
