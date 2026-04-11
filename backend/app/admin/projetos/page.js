import { AdminProjectsPage } from "@/components/admin/projects/projects-page"
import { getSessionUser } from "@/lib/session"
import { listProjectsForUser } from "@/lib/projetos"

export default async function Page() {
  const user = await getSessionUser()
  const projects = await listProjectsForUser(user)

  return <AdminProjectsPage projects={projects} user={user} />
}
