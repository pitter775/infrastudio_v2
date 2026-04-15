import { redirect } from "next/navigation"

import { AdminProfilePage } from "@/components/admin/profile/profile-page"
import { getSessionUser } from "@/lib/session"

export default async function Page() {
  const currentUser = await getSessionUser()

  if (!currentUser) {
    redirect("/")
  }

  return <AdminProfilePage currentUser={currentUser} />
}
