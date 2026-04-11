import { redirect } from "next/navigation"

import { AppShell } from "@/components/app/layout/shell"
import { getSessionUser } from "@/lib/session"

export default async function Layout({ children }) {
  const user = await getSessionUser()

  if (!user) {
    redirect("/")
  }

  return <AppShell user={user}>{children}</AppShell>
}
