import { AdminProjectsPage } from "@/components/admin/projects/projects-page"
import { listUsuarios } from "@/lib/usuarios"
import { getSessionUser } from "@/lib/session"
import { listProjectsForUser } from "@/lib/projetos"

export default async function Page() {
  const user = await getSessionUser()
  const [projects, users] = await Promise.all([
    listProjectsForUser(user),
    user?.role === "admin" ? listUsuarios() : Promise.resolve([]),
  ])

  return <AdminProjectsPage projects={projects} user={user} users={users} />
}
