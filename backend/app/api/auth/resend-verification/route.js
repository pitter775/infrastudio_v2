import { NextResponse } from "next/server"

import { resendUsuarioVerificationEmail } from "@/lib/auth-registration"

export async function POST(request) {
  try {
    const { email } = await request.json()
    const normalizedEmail = String(email || "").trim().toLowerCase()

    if (!normalizedEmail) {
      return NextResponse.json({ error: "Informe seu email para reenviar a confirmacao." }, { status: 400 })
    }

    const result = await resendUsuarioVerificationEmail(normalizedEmail)
    if (!result.ok) {
      const status =
        result.reason === "user_not_found" ? 404 : result.reason === "already_verified" ? 409 : 500
      const error =
        result.reason === "user_not_found"
          ? "Nao encontramos uma conta com este email."
          : result.reason === "already_verified"
            ? "Este email ja foi confirmado."
            : "Nao foi possivel reenviar o email agora."

      return NextResponse.json({ error }, { status })
    }

    return NextResponse.json({ message: "Enviamos um novo email de confirmacao." }, { status: 200 })
  } catch (error) {
    console.error("[auth] resend verification failed", error)
    return NextResponse.json({ error: "Nao foi possivel reenviar a confirmacao agora." }, { status: 500 })
  }
}
