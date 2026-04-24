import { recordJsonApiUsage } from "@/lib/api-usage-metrics"
import { listAdminConversations } from "@/lib/admin-conversations"
import { getSessionUser } from "@/lib/session"

export async function GET() {
  const startedAt = Date.now()
  const user = await getSessionUser()

  if (!user) {
    const payload = { error: "Nao autenticado." }
    recordJsonApiUsage({
      route: "/api/admin/conversations",
      method: "GET",
      status: 401,
      elapsedMs: Date.now() - startedAt,
      userId: null,
      source: "admin_attendance",
      payload,
    })
    return Response.json(payload, { status: 401 })
  }

  const conversations = await listAdminConversations(user)
  const payload = { conversations }
  recordJsonApiUsage({
    route: "/api/admin/conversations",
    method: "GET",
    status: 200,
    elapsedMs: Date.now() - startedAt,
    userId: user.id,
    source: "admin_attendance",
    payload,
  })
  return Response.json(payload)
}
