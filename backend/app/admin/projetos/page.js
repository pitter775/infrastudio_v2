import { AdminProjectsPage } from "@/components/admin/projects/projects-page"
import { listUsuarios } from "@/lib/usuarios"
import { getSessionUser } from "@/lib/session"
import { listProjectsForUser } from "@/lib/projetos"
import { getTermsConsentForUser } from "@/lib/terms-consent"

export default async function Page() {
  const user = await getSessionUser()
  const [projects, users, termsConsent] = await Promise.all([
    listProjectsForUser(user),
    user?.role === "admin" ? listUsuarios() : Promise.resolve([]),
    getTermsConsentForUser(user),
  ])

  return <AdminProjectsPage projects={projects} user={user} users={users} termsConsent={termsConsent} />
}
