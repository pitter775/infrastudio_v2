import { redirect } from "next/navigation"

import { AdminUsersPage } from "@/components/admin/users/users-page"
import { listProjectsForUser } from "@/lib/projetos"
import { getSessionUser } from "@/lib/session"
import { listUsuarios } from "@/lib/usuarios"

export default async function Page() {
  const currentUser = await getSessionUser()

  if (currentUser?.role !== "admin") {
    redirect("/admin/projetos")
  }

  const [users, projects] =
    currentUser?.role === "admin"
      ? await Promise.all([listUsuarios(), listProjectsForUser(currentUser)])
      : [[], []]

  return <AdminUsersPage initialUsers={users} projects={projects} currentUser={currentUser} />
}
