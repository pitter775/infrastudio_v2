import { recordJsonApiUsage } from "@/lib/api-usage-metrics"
import { listAdminConversations } from "@/lib/admin-conversations"
import { getSessionUser } from "@/lib/session"

export async function GET(request) {
  const startedAt = Date.now()
  const user = await getSessionUser()

  if (!user) {
    const payload = { error: "Não autenticado." }
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

  const url = new URL(request.url)
  const limit = Math.min(Math.max(Number(url.searchParams.get("limit") ?? 10) || 10, 1), 30)
  const offset = Math.max(Number(url.searchParams.get("offset") ?? 0) || 0, 0)
  const result = await listAdminConversations(user, { limit, offset })
  const payload = {
    conversations: result.conversations,
    pagination: {
      limit,
      offset,
      nextOffset: result.nextOffset,
      hasMore: result.hasMore,
    },
  }
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
