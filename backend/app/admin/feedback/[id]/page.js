import { notFound } from "next/navigation"

import { AdminFeedbackDetailPage } from "@/components/admin/feedback/feedback-detail-page"
import { FEEDBACK_STATUSES, marcarFeedbackComoLido } from "@/lib/feedbacks"
import { getSessionUser } from "@/lib/session"

export default async function Page({ params }) {
  const currentUser = await getSessionUser()
  const { id } = await params
  const feedback = currentUser ? await marcarFeedbackComoLido(currentUser, id) : null

  if (!feedback || feedback === false) {
    notFound()
  }

  return <AdminFeedbackDetailPage initialFeedback={feedback} currentUser={currentUser} statuses={FEEDBACK_STATUSES} />
}
