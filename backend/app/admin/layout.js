import { redirect } from "next/navigation"

import { AdminShell } from "@/components/admin/layout/shell"
import { getSessionUser } from "@/lib/session"

export default async function Layout({ children }) {
  const user = await getSessionUser()

  if (!user) {
    redirect("/")
  }

  return <AdminShell user={user}>{children}</AdminShell>
}
