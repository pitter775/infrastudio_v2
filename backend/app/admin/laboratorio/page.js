import { AdminLaboratoryPage } from "@/components/admin/laboratory/laboratory-page"
import { listAdminLogs } from "@/lib/logs"
import { listProjectsForUser } from "@/lib/projetos"
import { getSessionUser } from "@/lib/session"

export default async function Page() {
  const currentUser = await getSessionUser()
  const [projects, logs] =
    currentUser?.role === "admin"
      ? await Promise.all([listProjectsForUser(currentUser), listAdminLogs({ limit: 100 })])
      : [[], []]

  return <AdminLaboratoryPage initialLogs={logs} projects={projects} currentUser={currentUser} />
}
