import { NextResponse } from "next/server"

import { consumeEmailVerificationToken } from "@/lib/email-verifications"

export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const token = searchParams.get("token")?.trim() || ""
  const result = await consumeEmailVerificationToken(token)

  if (!result.ok) {
    const status = result.reason === "invalid_token" ? 400 : 409
    return NextResponse.json(
      {
        error:
          result.reason === "expired"
            ? "Seu link de verificacao expirou."
            : result.reason === "already_used"
              ? "Este email ja foi confirmado."
              : "Token de verificacao invalido.",
      },
      { status },
    )
  }

  return NextResponse.json({ ok: true }, { status: 200 })
}
