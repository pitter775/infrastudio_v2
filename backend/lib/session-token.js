import { SignJWT, jwtVerify } from "jose"

export const SESSION_COOKIE = "infrastudio-session"

function getSessionSecret() {
  const secret = process.env.APP_AUTH_SECRET

  if (!secret) {
    throw new Error("APP_AUTH_SECRET is not configured.")
  }

  return new TextEncoder().encode(secret)
}

export async function signSessionToken(user) {
  return new SignJWT({
    email: user.email,
    name: user.name,
    role: user.role,
    status: user.status,
    currentProjectId: user.currentProjectId ?? null,
    memberships: user.memberships ?? [],
  })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(user.id)
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(getSessionSecret())
}

export async function verifySessionToken(token) {
  const { payload } = await jwtVerify(token, getSessionSecret())

  return {
    id: String(payload.sub),
    email: String(payload.email),
    name: String(payload.name),
    role: payload.role === "admin" ? "admin" : "viewer",
    status: payload.status === "pendente" ? "pendente" : "ativo",
    currentProjectId:
      typeof payload.currentProjectId === "string"
        ? payload.currentProjectId
        : null,
    memberships: Array.isArray(payload.memberships) ? payload.memberships : [],
  }
}
