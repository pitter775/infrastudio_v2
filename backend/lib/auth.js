export async function signInWithProjectAuth(email, password) {
  try {
    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email, password }),
    })
    const payload = await response.json()

    if (!response.ok) {
      return {
        mode: "custom",
        user: null,
        error: payload.error ?? "Nao foi possivel autenticar agora.",
      }
    }

    return {
      mode: "custom",
      user: payload.user,
      error: null,
    }
  } catch (error) {
    console.error("[auth] login request failed", error)

    return {
      mode: "custom",
      user: null,
      error: "Nao foi possivel autenticar agora.",
    }
  }
}

export async function registerWithProjectAuth(input) {
  try {
    const response = await fetch("/api/auth/register", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(input),
    })
    const payload = await response.json()

    if (!response.ok) {
      return {
        ok: false,
        error: payload.error ?? "Nao foi possivel concluir seu cadastro agora.",
        message: null,
      }
    }

    return {
      ok: true,
      error: null,
      message: payload.message ?? "Conta criada. Voce ja pode entrar.",
    }
  } catch (error) {
    console.error("[auth] register request failed", error)

    return {
      ok: false,
      error: "Nao foi possivel concluir seu cadastro agora.",
      message: null,
    }
  }
}

export async function signInWithSocialProvider(provider) {
  if (!["google", "github", "facebook"].includes(provider)) {
    return { ok: false, error: "Provider social invalido." }
  }

  window.location.href = `/api/auth/oauth/start?provider=${encodeURIComponent(provider)}`
  return { ok: true, error: null }
}

export async function resendVerificationEmail(email) {
  try {
    const response = await fetch("/api/auth/resend-verification", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email }),
    })
    const payload = await response.json()

    if (!response.ok) {
      return {
        ok: false,
        error: payload.error ?? "Nao foi possivel reenviar a confirmacao agora.",
        message: null,
      }
    }

    return {
      ok: true,
      error: null,
      message: payload.message ?? "Conta liberada para login.",
    }
  } catch (error) {
    console.error("[auth] resend verification request failed", error)
    return {
      ok: false,
      error: "Nao foi possivel reenviar a confirmacao agora.",
      message: null,
    }
  }
}

export async function getCurrentProjectUser() {
  try {
    const response = await fetch("/api/auth/me", {
      method: "GET",
      cache: "no-store",
    })
    const payload = await response.json()

    if (!response.ok) {
      return null
    }

    return payload.user
  } catch (error) {
    console.error("[auth] failed to load current user", error)
    return null
  }
}

export async function signOutProjectAuth() {
  try {
    await fetch("/api/auth/logout", { method: "POST" })
  } catch (error) {
    console.error("[auth] logout request failed", error)
  }
}
