import { NextResponse } from "next/server"

import { cleanupAdminLogs } from "@/lib/logs"

export async function GET(request) {
  const authHeader = request.headers.get("authorization")
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const result = await cleanupAdminLogs({
    mode: "retention",
    dryRun: false,
    limit: 1000,
  })

  if (!result) {
    return NextResponse.json({ error: "Nao foi possivel executar a limpeza de logs." }, { status: 500 })
  }

  return NextResponse.json(
    {
      ok: true,
      mode: result.mode ?? "retention",
      deleted: result.deleted ?? 0,
      protected: result.protected ?? 0,
      matched: result.matched ?? 0,
      policies: Array.isArray(result.policies) ? result.policies : [],
    },
    { status: 200 },
  )
}
