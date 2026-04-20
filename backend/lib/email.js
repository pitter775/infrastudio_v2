import "server-only"

const RESEND_API_URL = "https://api.resend.com/emails"
const DEFAULT_FROM = "onboarding@resend.dev"
const DEFAULT_REPLY_TO = "pitter775@gmail.com"
const HARDCODED_RESEND_API_KEY = "re_GASo3ffB_3GGH9PvagKxrtUEwpL6GieDf"

export async function sendEmail(input) {
  const apiKey = process.env.RESEND_API_KEY?.trim() || HARDCODED_RESEND_API_KEY

  if (!apiKey) {
    throw new Error("RESEND_API_KEY nao configurada.")
  }

  const response = await fetch(RESEND_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: process.env.RESEND_FROM_EMAIL?.trim() || DEFAULT_FROM,
      reply_to: process.env.RESEND_REPLY_TO?.trim() || DEFAULT_REPLY_TO,
      to: [input.to],
      subject: input.subject,
      html: input.html,
    }),
  })

  if (!response.ok) {
    const errorBody = await response.text().catch(() => "")
    throw new Error(`Falha ao enviar email via Resend: ${response.status} ${errorBody}`.trim())
  }
}
