import { conversations } from "@/components/admin/attendance/mock-data"
import { USE_ORCHESTRATOR, buildConversationHistory } from "@/lib/chat/orchestrator"
import { processChatRequest } from "@/lib/chat/service"

export async function handleChat(input) {
  const conversationId = String(input.conversationId ?? "").trim()
  const texto = String(input.texto ?? "").trim()
  const conversation = conversations.find((item) => item.id === conversationId)

  if (USE_ORCHESTRATOR) {
    const history = buildConversationHistory(conversation, texto)

    throw new Error(
      `Orquestrador direto ainda não está ativo. Histórico preparado com ${history.length} mensagens.`
    )
  }

  const result = await processChatRequest({
    message: texto,
    canal: "web",
    identificadorExterno: conversationId,
    source: "admin_attendance_v2",
  })

  return {
    reply: result.reply,
  }
}
