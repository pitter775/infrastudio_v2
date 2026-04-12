import { redirect } from "next/navigation"

import { consumeEmailVerificationToken } from "@/lib/email-verifications"

function readSearchParam(value) {
  return Array.isArray(value) ? value[0] : value
}

export default async function VerifyEmailPage({ searchParams }) {
  const params = await searchParams
  const token = readSearchParam(params.token)?.trim() || ""
  const result = await consumeEmailVerificationToken(token)
  const url = new URL("/", "http://localhost")

  if (result.ok) {
    url.searchParams.set("auth_notice", "email_verified")
    redirect(`${url.pathname}?${url.searchParams.toString()}`)
  }

  url.searchParams.set(
    "auth_notice",
    result.reason === "expired"
      ? "email_expired"
      : result.reason === "already_used"
        ? "email_already_verified"
        : "email_invalid",
  )

  redirect(`${url.pathname}?${url.searchParams.toString()}`)
}
