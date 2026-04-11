import { listAdminConversations } from "@/lib/admin-conversations"
import { getSessionUser } from "@/lib/session"

export async function GET() {
  const user = await getSessionUser()

  if (!user) {
    return Response.json({ error: "Nao autenticado." }, { status: 401 })
  }

  const conversations = await listAdminConversations()
  return Response.json({ conversations })
}
