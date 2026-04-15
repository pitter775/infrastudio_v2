import { redirect } from "next/navigation"

import { AdminTemplatePage } from "@/components/admin/template/template-page"
import { getSessionUser } from "@/lib/session"

export default async function Page() {
  const currentUser = await getSessionUser()

  if (currentUser?.role !== "admin") {
    redirect("/admin/projetos")
  }

  return <AdminTemplatePage />
}
