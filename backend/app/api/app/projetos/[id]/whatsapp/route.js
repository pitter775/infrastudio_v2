import { NextResponse } from "next/server"

import { createWhatsAppChannelForUser, listWhatsAppChannelsForUser } from "@/lib/whatsapp-channels"
import { getProjectAccessForUser } from "@/lib/projetos"
import { getSessionUser } from "@/lib/session"

async function loadProject(identifier) {
  const user = await getSessionUser()

  if (!user) {
    return { response: NextResponse.json({ error: "Nao autenticado." }, { status: 401 }) }
  }

  const project = await getProjectAccessForUser(identifier, user)

  if (!project) {
    return { response: NextResponse.json({ error: "Projeto nao encontrado." }, { status: 404 }) }
  }

  return { user, project }
}

export async function GET(_request, context) {
  const { id } = await context.params
  const loaded = await loadProject(id)

  if (loaded.response) {
    return loaded.response
  }

  const channels = await listWhatsAppChannelsForUser(loaded.project, loaded.user)
  return NextResponse.json({ channels }, { status: 200 })
}

export async function POST(request, context) {
  const { id } = await context.params
  const loaded = await loadProject(id)

  if (loaded.response) {
    return loaded.response
  }

  const body = await request.json()
  const { channel, contact, error } = await createWhatsAppChannelForUser(loaded.project, body, loaded.user)

  if (error) {
    return NextResponse.json({ error }, { status: 400 })
  }

  return NextResponse.json({ channel, contact }, { status: 201 })
}
