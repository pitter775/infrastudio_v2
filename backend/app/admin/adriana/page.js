import { redirect } from "next/navigation"

import { AdrianaPage } from "@/components/admin/adriana/adriana-page"
import { getSessionUser } from "@/lib/session"

export default async function Page() {
  const currentUser = await getSessionUser()

  if (currentUser?.role !== "admin") {
    redirect("/admin/projetos")
  }

  return <AdrianaPage currentUser={currentUser} />
}
