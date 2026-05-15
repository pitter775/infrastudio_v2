import { notFound } from "next/navigation"

import { AdminProjectDetailPage } from "@/components/admin/projects/project-detail-page"
import { getProjectForUser } from "@/lib/projetos"
import { getSessionUser } from "@/lib/session"
import { getTermsConsentForUser } from "@/lib/terms-consent"

export default async function Page({ params }) {
  const { id } = await params
  const user = await getSessionUser()
  const [project, termsConsent] = await Promise.all([
    getProjectForUser(id, user),
    getTermsConsentForUser(user),
  ])

  if (!project) {
    notFound()
  }

  return <AdminProjectDetailPage project={project} user={user} termsConsent={termsConsent} />
}
