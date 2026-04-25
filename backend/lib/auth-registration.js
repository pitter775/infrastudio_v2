import "server-only"

import { randomUUID } from "node:crypto"

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
    avatarUrl: input.avatarUrl,
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
    emailVerificado: true,
    provider: "email",
  }).then(async (provision) => {
    if (!provision.ok) {
      return provision
    }

    return {
      ok: true,
      usuarioId: provision.usuarioId,
      projetoId: provision.projetoId,
      email: normalizedEmail,
    }
  })
}

export async function resendUsuarioVerificationEmail(email) {
  return { ok: false, reason: "disabled" }
}

export async function loginOrCreateSocialUsuario(input) {
  const normalizedEmail = String(input.email || "").trim().toLowerCase()
  const existingByProvider = await findUsuarioByProvider(input.provider, input.providerUserId)

  if (existingByProvider) {
    if (input.avatarUrl && !existingByProvider.avatarUrl) {
      await updateUsuarioProviderAndVerification({
        usuarioId: existingByProvider.id,
        provider: input.provider,
        providerId: input.providerUserId,
        avatarUrl: input.avatarUrl,
        emailVerificado: true,
      })
    }

    const refreshedUser = input.avatarUrl && !existingByProvider.avatarUrl
      ? await getUsuarioById(existingByProvider.id)
      : existingByProvider
    if (!refreshedUser) {
      return { ok: false, reason: "user_reload_failed" }
    }

    const ensuredUser = await ensureUsuarioHasProjeto(refreshedUser)
    await createSession(ensuredUser)
    return { ok: true, user: ensuredUser, created: false }
  }

  const existingByEmail = await findUsuarioWithPasswordByEmail(normalizedEmail)
  if (existingByEmail) {
    const providerUpdated = await updateUsuarioProviderAndVerification({
      usuarioId: existingByEmail.id,
      provider: input.provider,
      providerId: input.providerUserId,
      avatarUrl: input.avatarUrl,
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
    avatarUrl: input.avatarUrl,
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
