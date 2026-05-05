import { NextResponse } from "next/server"

import { getSessionUser } from "@/lib/session"
import { getWhatsAppWorkerBaseUrl } from "@/lib/whatsapp-channels"

function canAccessLaboratory(user) {
  return user?.role === "admin"
}

async function callWorker(path, init = {}) {
  const response = await fetch(`${getWhatsAppWorkerBaseUrl()}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
    cache: "no-store",
  })
  const data = await response.json().catch(() => ({}))

  if (!response.ok) {
    throw new Error(data.error || `Worker WhatsApp retornou ${response.status}.`)
  }

  return data
}

export async function GET(request) {
  const user = await getSessionUser()

  if (!canAccessLaboratory(user)) {
    return NextResponse.json({ error: "Acesso negado." }, { status: 403 })
  }

  const requestUrl = request?.url ? new URL(request.url) : null
  const downloadName = requestUrl?.searchParams.get("download")?.trim() || ""

  try {
    if (downloadName) {
      const fileName = encodeURIComponent(downloadName)
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
          "Content-Disposition": `attachment; filename="${downloadName.replace(/"/g, "")}"`,
        },
      })
    }

    const payload = await callWorker("/debug/payload-dumps")
    return NextResponse.json(payload, { status: 200 })
  } catch (error) {
    return NextResponse.json({ error: error?.message || "Não foi possível carregar os dumps." }, { status: 500 })
  }
}

export async function POST(request) {
  const user = await getSessionUser()

  if (!canAccessLaboratory(user)) {
    return NextResponse.json({ error: "Acesso negado." }, { status: 403 })
  }

  const body = await request.json().catch(() => ({}))

  try {
    const payload = await callWorker("/debug/payload-dumps/toggle", {
      method: "POST",
      body: JSON.stringify({
        enabled: body.enabled === true,
      }),
    })
    return NextResponse.json(payload, { status: 200 })
  } catch (error) {
    return NextResponse.json({ error: error?.message || "Não foi possível alterar o dump." }, { status: 500 })
  }
}

export async function DELETE() {
  const user = await getSessionUser()

  if (!canAccessLaboratory(user)) {
    return NextResponse.json({ error: "Acesso negado." }, { status: 403 })
  }

  try {
    const payload = await callWorker("/debug/payload-dumps", {
      method: "DELETE",
    })
    return NextResponse.json(payload, { status: 200 })
  } catch (error) {
    return NextResponse.json({ error: error?.message || "Não foi possível limpar os dumps." }, { status: 500 })
  }
}
