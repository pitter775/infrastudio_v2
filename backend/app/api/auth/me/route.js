import { getSessionUser } from "@/lib/session"

export async function GET() {
  const user = await getSessionUser()
  return Response.json({ user }, { status: 200 })
}
