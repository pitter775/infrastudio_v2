import { sendEmail } from "@/lib/email"
import { getSessionUser } from "@/lib/session"

function buildHtml(targetEmail) {
  const sentAt = new Date().toLocaleString("pt-BR", {
    dateStyle: "short",
    timeStyle: "medium",
  })

  return `
    <div style="font-family:Arial,sans-serif;padding:24px;background:#0b1120;color:#e2e8f0">
      <h1 style="margin:0 0 12px;font-size:20px">Teste de email InfraStudio</h1>
      <p style="margin:0 0 10px">Se voce recebeu esta mensagem, o envio esta funcionando.</p>
      <p style="margin:0 0 10px"><strong>Destino:</strong> ${targetEmail}</p>
      <p style="margin:0"><strong>Enviado em:</strong> ${sentAt}</p>
    </div>
  `
}

async function handleSend(request) {
  const user = await getSessionUser()

  if (!user) {
    return Response.json({ success: false, error: "Nao autenticado." }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const targetEmail = String(searchParams.get("to") || "pitter775@gmail.com").trim().toLowerCase()

  if (!targetEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(targetEmail)) {
    return Response.json({ success: false, error: "Email invalido." }, { status: 400 })
  }

  await sendEmail({
    to: targetEmail,
    subject: "Teste de envio InfraStudio",
    html: buildHtml(targetEmail),
  })

  return Response.json({
    success: true,
    to: targetEmail,
    sentBy: user.email || user.id || null,
  })
}

export async function GET(request) {
  try {
    return await handleSend(request)
  } catch (error) {
    return Response.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Falha ao enviar email.",
      },
      { status: 500 },
    )
  }
}

export async function POST(request) {
  try {
    return await handleSend(request)
  } catch (error) {
    return Response.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Falha ao enviar email.",
      },
      { status: 500 },
    )
  }
}
