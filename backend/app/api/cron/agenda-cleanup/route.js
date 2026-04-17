import { NextResponse } from "next/server"

import { cleanupExpiredAgendaSlots } from "@/lib/agenda"

export async function GET(request) {
  const authHeader = request.headers.get("authorization")
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const result = await cleanupExpiredAgendaSlots()
  if (result.error) {
    return NextResponse.json({ error: result.error }, { status: 500 })
  }

  return NextResponse.json({ ok: true, deleted: result.deleted }, { status: 200 })
}
