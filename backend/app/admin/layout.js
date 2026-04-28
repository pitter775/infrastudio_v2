import { redirect } from "next/navigation"

import { AdminShell } from "@/components/admin/layout/shell"
import { APP_BUILD_LABEL } from "@/lib/build-info"
import { getSessionUser } from "@/lib/session"

export default async function Layout({ children }) {
  const user = await getSessionUser()

  if (!user) {
    redirect("/")
  }

  return <AdminShell user={user} buildLabel={APP_BUILD_LABEL}>{children}</AdminShell>
}
