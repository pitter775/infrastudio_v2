import { compareSync } from "bcryptjs"

import { createSession } from "@/lib/session"
import {
  findUsuarioWithPasswordByEmail,
  mapUsuarioToAppUser,
  touchUsuarioLogin,
} from "@/lib/usuarios"

function passwordMatches(inputPassword, storedPassword) {
  if (!storedPassword) {
    return false
  }

  if (
    storedPassword.startsWith("$2a$") ||
    storedPassword.startsWith("$2b$") ||
    storedPassword.startsWith("$2y$")
  ) {
    try {
      return compareSync(inputPassword, storedPassword)
    } catch (error) {
      console.error("[auth] password hash validation failed", error)
      return false
    }
  }

  if (storedPassword === inputPassword) {
    console.warn("[auth] usuario with plaintext password detected; migrate this record to bcrypt.")
    return true
  }

  return false
}

export async function POST(request) {
  try {
    const { email, password } = await request.json()
    const rawEmail = email?.trim() ?? ""
    const normalizedEmail = rawEmail.toLowerCase()

    if (!rawEmail || !password) {
      return Response.json(
        { error: "Email e senha sao obrigatorios." },
        { status: 400 }
      )
    }

    const usuario = await findUsuarioWithPasswordByEmail(normalizedEmail)
    const passwordOk = usuario ? passwordMatches(password, usuario.senha) : false

    if (!usuario || !passwordOk) {
      return Response.json({ error: "Email ou senha invalidos." }, { status: 401 })
    }

    if (usuario.email_verificado === false) {
      return Response.json(
        { error: "Confirme seu email antes de acessar a plataforma." },
        { status: 403 }
      )
    }

    if (usuario.ativo === false) {
      return Response.json({ error: "Usuario inativo." }, { status: 403 })
    }

    const appUser = mapUsuarioToAppUser(usuario)
    await createSession(appUser)
    await touchUsuarioLogin(usuario.id)

    return Response.json({ user: appUser }, { status: 200 })
  } catch (error) {
    console.error("[auth] login failed", error)

    if (
      error instanceof Error &&
      /Supabase server environment variables are not configured/i.test(error.message)
    ) {
      return Response.json(
        { error: "Configuracao do banco nao foi carregada no servidor." },
        { status: 503 }
      )
    }

    return Response.json(
      { error: "Nao foi possivel autenticar agora." },
      { status: 500 }
    )
  }
}
