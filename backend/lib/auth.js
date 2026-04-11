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
