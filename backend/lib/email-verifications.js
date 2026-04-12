import "server-only"

import { randomBytes } from "node:crypto"

import { sendEmail } from "@/lib/email"
import { getSupabaseAdminClient } from "@/lib/supabase-admin"

const EMAIL_VERIFICATION_TTL_HOURS = 24

function getAppUrl() {
  return (
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
    "http://localhost:3000"
  )
}

function buildVerificationLink(token) {
  const url = new URL("/verificar-email", getAppUrl())
  url.searchParams.set("token", token)
  return url.toString()
}

export async function createEmailVerificationToken(input) {
  const supabase = getSupabaseAdminClient()
  const token = randomBytes(32).toString("base64url")
  const expiresAt = new Date(Date.now() + EMAIL_VERIFICATION_TTL_HOURS * 60 * 60 * 1000).toISOString()

  await supabase.from("email_verifications").delete().eq("usuario_id", input.usuarioId)

  const { error } = await supabase.from("email_verifications").insert({
    token,
    usuario_id: input.usuarioId,
    email: input.email.trim().toLowerCase(),
    expires_at: expiresAt,
    created_at: new Date().toISOString(),
  })

  if (error) {
    throw new Error(error.message || "Nao foi possivel criar o token de verificacao.")
  }

  return { token, expiresAt }
}

export async function sendEmailVerification(input) {
  const verificationUrl = buildVerificationLink(input.token)
  const firstName = input.nome.trim().split(/\s+/)[0] || "cliente"

  await sendEmail({
    to: input.email,
    subject: "Confirme seu email na InfraStudio",
    html: `
      <div style="font-family:Arial,sans-serif;background:#0f172a;color:#e2e8f0;padding:32px;">
        <div style="max-width:560px;margin:0 auto;background:#111827;border:1px solid rgba(255,255,255,0.08);border-radius:8px;padding:32px;">
          <p style="font-size:12px;letter-spacing:0.18em;text-transform:uppercase;color:#7dd3fc;margin:0 0 16px;">InfraStudio</p>
          <h1 style="font-size:28px;line-height:1.2;color:#ffffff;margin:0 0 16px;">Confirme seu email</h1>
          <p style="font-size:15px;line-height:1.7;color:#cbd5e1;margin:0 0 24px;">
            Ola, ${firstName}. Clique no botao abaixo para ativar sua conta e acessar seu projeto inicial.
          </p>
          <a href="${verificationUrl}" style="display:inline-block;background:#0ea5e9;color:#ffffff;text-decoration:none;padding:14px 22px;border-radius:8px;font-weight:700;">
            Confirmar email
          </a>
          <p style="font-size:13px;line-height:1.7;color:#94a3b8;margin:24px 0 0;">
            Se o botao nao abrir, use este link:<br />
            <a href="${verificationUrl}" style="color:#7dd3fc;word-break:break-all;">${verificationUrl}</a>
          </p>
        </div>
      </div>
    `,
  })
}

export async function consumeEmailVerificationToken(token) {
  const cleanToken = String(token || "").trim()
  if (!cleanToken) {
    return { ok: false, reason: "invalid_token" }
  }

  const supabase = getSupabaseAdminClient()
  const { data, error } = await supabase
    .from("email_verifications")
    .select("token, usuario_id, email, expires_at, used_at")
    .eq("token", cleanToken)
    .maybeSingle()

  if (error || !data) {
    return { ok: false, reason: "invalid_token" }
  }

  if (data.used_at) {
    return { ok: false, reason: "already_used" }
  }

  if (new Date(data.expires_at).getTime() < Date.now()) {
    return { ok: false, reason: "expired" }
  }

  const now = new Date().toISOString()
  const { error: usuarioError } = await supabase
    .from("usuarios")
    .update({
      email_verificado: true,
      ativo: true,
      updated_at: now,
    })
    .eq("id", data.usuario_id)

  if (usuarioError) {
    return { ok: false, reason: "user_update_failed" }
  }

  const { error: verificationError } = await supabase
    .from("email_verifications")
    .update({ used_at: now })
    .eq("token", cleanToken)

  if (verificationError) {
    return { ok: false, reason: "verification_update_failed" }
  }

  return { ok: true, usuarioId: data.usuario_id, email: data.email }
}
