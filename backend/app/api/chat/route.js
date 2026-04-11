import { handleChat } from "@/lib/chat-adapter"

export async function POST(request) {
  try {
    const body = await request.json()
    console.log("CHAT INPUT:", body)
    console.log("ENV CHECK:", {
      url: process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL,
      key: process.env.SUPABASE_SERVICE_ROLE_KEY ? "[set]" : undefined,
    })

    const conversationId = String(body.conversationId ?? "").trim()
    const texto = String(body.texto ?? "").trim()

    if (!conversationId || !texto) {
      return Response.json(
        { error: "conversationId e texto sao obrigatorios" },
        { status: 400 }
      )
    }

    console.log("CHAMANDO CHAT SERVICE...")

    const result = await handleChat({ conversationId, texto })

    console.log("CHAT OUTPUT:", result)

    return Response.json({
      reply: result.reply,
    })
  } catch (error) {
    console.error("CHAT ERROR:", error)

    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Erro interno no chat",
      },
      { status: 500 }
    )
  }
}
