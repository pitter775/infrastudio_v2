import "server-only"

import { cookies } from "next/headers"

import { ensureUsuarioHasProjeto } from "@/lib/usuario-project-bootstrap"
import { SESSION_COOKIE, signSessionToken, verifySessionToken } from "@/lib/session-token"

export async function createSession(user) {
  const cookieStore = await cookies()
  const token = await signSessionToken(user)

  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  })
}

export async function clearSession() {
  const cookieStore = await cookies()
  cookieStore.delete(SESSION_COOKIE)
}

export async function getSessionUser() {
  const cookieStore = await cookies()
  const token = cookieStore.get(SESSION_COOKIE)?.value

  if (!token) {
    return null
  }

  try {
    const user = await verifySessionToken(token)
    const ensuredUser = await ensureUsuarioHasProjeto(user)

    if (
      ensuredUser &&
      JSON.stringify(ensuredUser.memberships ?? []) !== JSON.stringify(user.memberships ?? [])
    ) {
      await createSession(ensuredUser)
    }

    return ensuredUser
  } catch (error) {
    console.error("[session] failed to verify session", error)
    return null
  }
}
