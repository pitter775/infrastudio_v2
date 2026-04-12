import "server-only"

import { randomUUID } from "node:crypto"

import { createSession } from "@/lib/session"
import { getSupabaseAdminClient } from "@/lib/supabase-admin"
import {
  createEmailVerificationToken,
  sendEmailVerification,
} from "@/lib/email-verifications"
import {
  createUsuario,
  deleteUsuario,
  findUsuarioByProvider,
  findUsuarioWithPasswordByEmail,
  getUsuarioById,
  updateUsuarioProviderAndVerification,
} from "@/lib/usuarios"

function slugify(value) {
  return String(value || "projeto")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48) || "projeto"
}

async function createInitialProjectForUsuario({ usuarioId, nome }) {
  const supabase = getSupabaseAdminClient()
  const now = new Date().toISOString()
  const baseName = String(nome || "Usuario").trim() || "Usuario"
  const { data: project, error: projectError } = await supabase
    .from("projetos")
    .insert({
      nome: `Projeto ${baseName}`,
      slug: `${slugify(baseName)}-${Date.now().toString(36)}`,
      tipo: "Geral",
      descricao: "Projeto criado no cadastro.",
      status: "ativo",
      modo_cobranca: "plano",
      owner_user_id: usuarioId,
      configuracoes: {},
      created_at: now,
      updated_at: now,
    })
    .select("id")
    .single()

  if (projectError || !project?.id) {
    console.error("[auth-registration] failed to create initial project", projectError)
    return null
  }

  const { error: membershipError } = await supabase.from("usuarios_projetos").insert({
    usuario_id: usuarioId,
    projeto_id: project.id,
    papel: "viewer",
    created_at: now,
  })

  if (membershipError) {
    console.error("[auth-registration] failed to create initial membership", membershipError)
    await supabase.from("projetos").delete().eq("id", project.id)
    return null
  }

  return project.id
}

async function deleteInitialProject(projetoId) {
  if (!projetoId) {
    return
  }

  const supabase = getSupabaseAdminClient()
  await supabase.from("usuarios_projetos").delete().eq("projeto_id", projetoId)
  await supabase.from("projetos").delete().eq("id", projetoId)
}

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
    await deleteUsuario(usuario.id)
    return { ok: false, reason: "project_create_failed" }
  }

  return { ok: true, usuarioId: usuario.id, projetoId }
}

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
      await deleteInitialProject(provision.projetoId)
      await deleteUsuario(provision.usuarioId)
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
    await createSession(existingByProvider)
    return { ok: true, user: existingByProvider, created: false }
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

    await createSession(appUser)
    return { ok: true, user: appUser, created: false }
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

  await createSession(appUser)
  return { ok: true, user: appUser, created: true }
}
