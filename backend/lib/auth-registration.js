import "server-only"

import { randomUUID } from "node:crypto"

import {
  createEmailVerificationToken,
  sendEmailVerification,
} from "@/lib/email-verifications"
import { createSession } from "@/lib/session"
import { createInitialProjectForUsuario, ensureUsuarioHasProjeto, rollbackProvisionedUsuario } from "@/lib/usuario-project-bootstrap"
import {
  createUsuario,
  findUsuarioByProvider,
  findUsuarioWithPasswordByEmail,
  getUsuarioById,
  updateUsuarioProviderAndVerification,
} from "@/lib/usuarios"

async function provisionUsuarioInicial(input) {
  const usuario = await createUsuario({
    nome: input.nome,
    email: input.email,
    senha: input.senha || randomUUID(),
    ativo: true,
    emailVerificado: input.emailVerificado,
    papel: "viewer",
    provider: input.provider,
    providerId: input.providerId,
  })

  if (!usuario?.id) {
    return { ok: false, reason: "user_create_failed" }
  }

  const projetoId = await createInitialProjectForUsuario({
    usuarioId: usuario.id,
    nome: input.nome,
  })

  if (!projetoId) {
    await rollbackProvisionedUsuario(usuario.id, null)
    return { ok: false, reason: "project_create_failed" }
  }

  return { ok: true, usuarioId: usuario.id, projetoId }
}

export { ensureUsuarioHasProjeto }

export async function registerUsuarioWithProjeto(input) {
  const normalizedEmail = String(input.email || "").trim().toLowerCase()
  const existing = await findUsuarioWithPasswordByEmail(normalizedEmail)

  if (existing) {
    return { ok: false, reason: "email_already_exists" }
  }

  return provisionUsuarioInicial({
    nome: input.nome,
    email: normalizedEmail,
    senha: input.senha,
    emailVerificado: false,
    provider: "email",
  }).then(async (provision) => {
    if (!provision.ok) {
      return provision
    }

    try {
      const { token } = await createEmailVerificationToken({
        usuarioId: provision.usuarioId,
        email: normalizedEmail,
      })

      await sendEmailVerification({
        nome: input.nome,
        email: normalizedEmail,
        token,
      })

      return {
        ok: true,
        usuarioId: provision.usuarioId,
        projetoId: provision.projetoId,
        email: normalizedEmail,
      }
    } catch (error) {
      console.error("[auth-registration] failed to send verification email", error)
      await rollbackProvisionedUsuario(provision.usuarioId, provision.projetoId)
      return { ok: false, reason: "verification_send_failed" }
    }
  })
}

export async function resendUsuarioVerificationEmail(email) {
  const normalizedEmail = String(email || "").trim().toLowerCase()
  const usuario = await findUsuarioWithPasswordByEmail(normalizedEmail)

  if (!usuario) {
    return { ok: false, reason: "user_not_found" }
  }

  if (usuario.email_verificado === true) {
    return { ok: false, reason: "already_verified" }
  }

  try {
    const { token } = await createEmailVerificationToken({
      usuarioId: usuario.id,
      email: normalizedEmail,
    })

    await sendEmailVerification({
      nome: usuario.nome?.trim() || "Usuario",
      email: normalizedEmail,
      token,
    })

    return { ok: true }
  } catch (error) {
    console.error("[auth-registration] failed to resend verification email", error)
    return { ok: false, reason: "resend_failed" }
  }
}

export async function loginOrCreateSocialUsuario(input) {
  const normalizedEmail = String(input.email || "").trim().toLowerCase()
  const existingByProvider = await findUsuarioByProvider(input.provider, input.providerUserId)

  if (existingByProvider) {
    const ensuredUser = await ensureUsuarioHasProjeto(existingByProvider)
    await createSession(ensuredUser)
    return { ok: true, user: ensuredUser, created: false }
  }

  const existingByEmail = await findUsuarioWithPasswordByEmail(normalizedEmail)
  if (existingByEmail) {
    const providerUpdated = await updateUsuarioProviderAndVerification({
      usuarioId: existingByEmail.id,
      provider: input.provider,
      providerId: input.providerUserId,
      emailVerificado: true,
    })

    if (!providerUpdated) {
      return { ok: false, reason: "provider_link_failed" }
    }

    const appUser = await getUsuarioById(existingByEmail.id)
    if (!appUser) {
      return { ok: false, reason: "user_reload_failed" }
    }

    const ensuredUser = await ensureUsuarioHasProjeto(appUser)
    await createSession(ensuredUser)
    return { ok: true, user: ensuredUser, created: false }
  }

  const provision = await provisionUsuarioInicial({
    nome: input.nome,
    email: normalizedEmail,
    provider: input.provider,
    providerId: input.providerUserId,
    emailVerificado: true,
  })

  if (!provision.ok) {
    return provision
  }

  const appUser = await getUsuarioById(provision.usuarioId)
  if (!appUser) {
    return { ok: false, reason: "user_reload_failed" }
  }

  const ensuredUser = await ensureUsuarioHasProjeto(appUser)
  await createSession(ensuredUser)
  return { ok: true, user: ensuredUser, created: true }
}
