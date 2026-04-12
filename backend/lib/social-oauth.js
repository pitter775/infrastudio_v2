import "server-only"

import { SignJWT, jwtVerify } from "jose"

import { loginOrCreateSocialUsuario } from "@/lib/auth-registration"

function getAppAuthSecret() {
  const secret = process.env.APP_AUTH_SECRET?.trim()
  if (!secret) {
    throw new Error("APP_AUTH_SECRET nao configurado.")
  }

  return new TextEncoder().encode(secret)
}

function getAppUrl(origin) {
  return origin?.trim() || process.env.NEXT_PUBLIC_APP_URL?.trim() || "http://localhost:3000"
}

function assertProvider(provider) {
  if (provider !== "google" && provider !== "github" && provider !== "facebook") {
    throw new Error("Provider social invalido.")
  }

  return provider
}

async function signSocialOAuthState(payload) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("15m")
    .sign(getAppAuthSecret())
}

async function verifySocialOAuthState(token) {
  const { payload } = await jwtVerify(token, getAppAuthSecret())
  return { provider: assertProvider(String(payload.provider ?? "")) }
}

function getProviderConfig(provider, origin) {
  const appUrl = getAppUrl(origin)
  const redirectUri = `${appUrl}/api/auth/oauth/callback`

  if (provider === "google") {
    return {
      clientId: process.env.GOOGLE_CLIENT_ID?.trim() || "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET?.trim() || "",
      authorizeUrl: "https://accounts.google.com/o/oauth2/v2/auth",
      tokenUrl: "https://oauth2.googleapis.com/token",
      redirectUri,
      scope: "openid email profile",
    }
  }

  if (provider === "github") {
    return {
      clientId: process.env.GITHUB_CLIENT_ID?.trim() || "",
      clientSecret: process.env.GITHUB_CLIENT_SECRET?.trim() || "",
      authorizeUrl: "https://github.com/login/oauth/authorize",
      tokenUrl: "https://github.com/login/oauth/access_token",
      redirectUri,
      scope: "read:user user:email",
    }
  }

  return {
    clientId: process.env.FACEBOOK_CLIENT_ID?.trim() || "",
    clientSecret: process.env.FACEBOOK_CLIENT_SECRET?.trim() || "",
    authorizeUrl: "https://www.facebook.com/v19.0/dialog/oauth",
    tokenUrl: "https://graph.facebook.com/v19.0/oauth/access_token",
    redirectUri,
    scope: "email,public_profile",
  }
}

export async function buildSocialAuthorizationUrl(provider, origin) {
  const safeProvider = assertProvider(provider)
  const config = getProviderConfig(safeProvider, origin)

  if (!config.clientId || !config.clientSecret) {
    throw new Error(`OAuth ${safeProvider} nao configurado no servidor.`)
  }

  const state = await signSocialOAuthState({ provider: safeProvider })
  const url = new URL(config.authorizeUrl)
  url.searchParams.set("client_id", config.clientId)
  url.searchParams.set("redirect_uri", config.redirectUri)
  url.searchParams.set("state", state)

  if (safeProvider === "google") {
    url.searchParams.set("response_type", "code")
    url.searchParams.set("scope", config.scope)
    url.searchParams.set("access_type", "online")
    url.searchParams.set("include_granted_scopes", "true")
    url.searchParams.set("prompt", "select_account")
  } else if (safeProvider === "github") {
    url.searchParams.set("scope", config.scope)
  } else {
    url.searchParams.set("scope", config.scope)
    url.searchParams.set("response_type", "code")
  }

  return url.toString()
}

async function exchangeGoogleCode(code, origin, fetchImpl = fetch) {
  const config = getProviderConfig("google", origin)
  const tokenResponse = await fetchImpl(config.tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      code,
      grant_type: "authorization_code",
      redirect_uri: config.redirectUri,
    }),
  })

  const tokenPayload = await tokenResponse.json()
  if (!tokenResponse.ok || !tokenPayload.access_token) {
    throw new Error("Falha ao trocar codigo do Google.")
  }

  const profileResponse = await fetchImpl("https://openidconnect.googleapis.com/v1/userinfo", {
    headers: { Authorization: `Bearer ${tokenPayload.access_token}` },
  })
  const profile = await profileResponse.json()

  if (!profileResponse.ok || !profile.sub || !profile.email) {
    throw new Error("Falha ao carregar perfil do Google.")
  }

  return {
    providerUserId: profile.sub,
    email: profile.email,
    nome: profile.name?.trim() || profile.email.split("@")[0] || "Usuario",
  }
}

async function exchangeGithubCode(code, origin, fetchImpl = fetch) {
  const config = getProviderConfig("github", origin)
  const tokenResponse = await fetchImpl(config.tokenUrl, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      code,
      redirect_uri: config.redirectUri,
    }),
  })

  const tokenPayload = await tokenResponse.json()
  if (!tokenResponse.ok || !tokenPayload.access_token) {
    throw new Error("Falha ao trocar codigo do GitHub.")
  }

  const [userResponse, emailResponse] = await Promise.all([
    fetchImpl("https://api.github.com/user", {
      headers: {
        Authorization: `Bearer ${tokenPayload.access_token}`,
        Accept: "application/vnd.github+json",
        "User-Agent": "InfraStudio",
      },
    }),
    fetchImpl("https://api.github.com/user/emails", {
      headers: {
        Authorization: `Bearer ${tokenPayload.access_token}`,
        Accept: "application/vnd.github+json",
        "User-Agent": "InfraStudio",
      },
    }),
  ])

  const userPayload = await userResponse.json()
  const emailPayload = await emailResponse.json()
  const primaryEmail =
    Array.isArray(emailPayload)
      ? emailPayload.find((item) => item.primary && item.verified)?.email ||
        emailPayload.find((item) => item.verified)?.email ||
        null
      : null

  if (!userResponse.ok || !emailResponse.ok || !userPayload.id || !primaryEmail) {
    throw new Error("Falha ao carregar perfil do GitHub.")
  }

  return {
    providerUserId: String(userPayload.id),
    email: primaryEmail,
    nome: userPayload.name?.trim() || userPayload.login?.trim() || primaryEmail.split("@")[0] || "Usuario",
  }
}

async function exchangeFacebookCode(code, origin, fetchImpl = fetch) {
  const config = getProviderConfig("facebook", origin)
  const tokenUrl = new URL(config.tokenUrl)
  tokenUrl.searchParams.set("client_id", config.clientId)
  tokenUrl.searchParams.set("client_secret", config.clientSecret)
  tokenUrl.searchParams.set("redirect_uri", config.redirectUri)
  tokenUrl.searchParams.set("code", code)

  const tokenResponse = await fetchImpl(tokenUrl)
  const tokenPayload = await tokenResponse.json()
  if (!tokenResponse.ok || !tokenPayload.access_token) {
    throw new Error("Falha ao trocar codigo do Facebook.")
  }

  const profileUrl = new URL("https://graph.facebook.com/me")
  profileUrl.searchParams.set("fields", "id,name,email")
  profileUrl.searchParams.set("access_token", tokenPayload.access_token)
  const profileResponse = await fetchImpl(profileUrl)
  const profile = await profileResponse.json()

  if (!profileResponse.ok || !profile.id || !profile.email) {
    throw new Error("Falha ao carregar perfil do Facebook.")
  }

  return {
    providerUserId: profile.id,
    email: profile.email,
    nome: profile.name?.trim() || profile.email.split("@")[0] || "Usuario",
  }
}

export async function completeSocialOAuthCallback(searchParams, origin, dependencies = {}) {
  const code = searchParams.get("code")?.trim() || ""
  const state = searchParams.get("state")?.trim() || ""
  const providerError = searchParams.get("error_description")?.trim() || searchParams.get("error")?.trim() || ""

  if (providerError) {
    throw new Error(providerError)
  }

  if (!code || !state) {
    throw new Error("Retorno do OAuth social incompleto.")
  }

  const parsedState = await verifySocialOAuthState(state)
  const fetchImpl = dependencies.fetchImpl ?? fetch
  const profile =
    parsedState.provider === "google"
      ? await exchangeGoogleCode(code, origin, fetchImpl)
      : parsedState.provider === "github"
        ? await exchangeGithubCode(code, origin, fetchImpl)
        : await exchangeFacebookCode(code, origin, fetchImpl)

  const finalizeLogin = dependencies.finalizeLogin ?? loginOrCreateSocialUsuario
  const result = await finalizeLogin({
    provider: parsedState.provider,
    providerUserId: profile.providerUserId,
    email: profile.email,
    nome: profile.nome,
  })

  if (!result.ok || !result.user) {
    throw new Error("Nao foi possivel concluir o login social.")
  }

  return result.user
}
