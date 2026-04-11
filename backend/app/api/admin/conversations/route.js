import { conversations } from "@/components/admin/attendance/mock-data"

export async function GET() {
  return Response.json({ conversations })
}
