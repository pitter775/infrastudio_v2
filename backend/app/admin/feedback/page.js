import { AdminFeedbackPage } from "@/components/admin/feedback/feedback-central-page"
import { FEEDBACK_CATEGORIAS, FEEDBACK_ORDENACOES, FEEDBACK_STATUSES, listFeedbacks } from "@/lib/feedbacks"
import { listProjectsForUser } from "@/lib/projetos"
import { getSessionUser } from "@/lib/session"

export default async function Page() {
  const currentUser = await getSessionUser()
  const [projects, result] = currentUser
    ? await Promise.all([
        listProjectsForUser(currentUser),
        listFeedbacks({ user: currentUser, ordenacao: currentUser.role === "admin" ? "pendentes" : "recentes" }),
      ])
    : [[], { feedbacks: [], filtros: { usuarios: [] } }]

  return (
    <AdminFeedbackPage
      initialFeedbacks={result.feedbacks}
      initialUsers={result.filtros.usuarios}
      projects={projects}
      currentUser={currentUser}
      statuses={FEEDBACK_STATUSES}
      categorias={FEEDBACK_CATEGORIAS}
      ordenacoes={FEEDBACK_ORDENACOES}
    />
  )
}
