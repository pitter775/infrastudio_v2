import { NextResponse } from "next/server"

import { getSessionUser } from "@/lib/session"
import { getWhatsAppWorkerBaseUrl } from "@/lib/whatsapp-channels"

function canAccessLaboratory(user) {
  return user?.role === "admin"
}

export async function GET(request, { params }) {
  const user = await getSessionUser()

  if (!canAccessLaboratory(user)) {
    return NextResponse.json({ error: "Acesso negado." }, { status: 403 })
  }

  const fileName = encodeURIComponent(String(params?.name || "").trim())

  try {
    const response = await fetch(`${getWhatsAppWorkerBaseUrl()}/debug/payload-dumps/${fileName}`, {
      cache: "no-store",
    })

    if (!response.ok) {
      const payload = await response.json().catch(() => ({}))
      return NextResponse.json({ error: payload.error || "Não foi possível baixar o dump." }, { status: response.status })
    }

    const buffer = await response.arrayBuffer()
    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="${String(params?.name || "payload.json").replace(/"/g, "")}"`,
      },
    })
  } catch (error) {
    return NextResponse.json({ error: error?.message || "Não foi possível baixar o dump." }, { status: 500 })
  }
}
