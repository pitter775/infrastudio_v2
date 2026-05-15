import { NextResponse } from "next/server"

import { acceptTermsForUser, getTermsConsentForUser } from "@/lib/terms-consent"
import { getSessionUser } from "@/lib/session"

export async function GET() {
  const user = await getSessionUser()

  if (!user) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 })
  }

  const consent = await getTermsConsentForUser(user)
  return NextResponse.json({ consent }, { status: 200 })
}

export async function POST() {
  const user = await getSessionUser()

  if (!user) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 })
  }

  const { consent, error } = await acceptTermsForUser(user)

  if (error) {
    return NextResponse.json({ error, consent }, { status: 400 })
  }

  return NextResponse.json({ consent }, { status: 200 })
}
