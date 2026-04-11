import { AppProjectsPage } from "@/components/app/projects/projects-page"
import { listProjectsForUser } from "@/lib/projetos"
import { getSessionUser } from "@/lib/session"

export default async function Page() {
  const user = await getSessionUser()
  const projects = await listProjectsForUser(user)

  return <AppProjectsPage projects={projects} user={user} />
}
