import { notFound } from "next/navigation"

import { AppProjectDetailPage } from "@/components/app/projects/project-detail-page"
import { getProjectForUser } from "@/lib/projetos"
import { getSessionUser } from "@/lib/session"

export default async function Page({ params }) {
  const { id } = await params
  const user = await getSessionUser()
  const project = await getProjectForUser(id, user)

  if (!project) {
    notFound()
  }

  return <AppProjectDetailPage project={project} user={user} />
}
