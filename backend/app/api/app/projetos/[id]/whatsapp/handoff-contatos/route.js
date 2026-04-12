import { NextResponse } from "next/server"

import {
  deleteWhatsAppHandoffContactForUser,
  listWhatsAppHandoffContactsForUser,
  saveWhatsAppHandoffContactForUser,
} from "@/lib/whatsapp-handoff-contatos"
import { getProjectForUser } from "@/lib/projetos"
import { getSessionUser } from "@/lib/session"

async function loadProject(identifier) {
  const user = await getSessionUser()

  if (!user) {
    return { response: NextResponse.json({ error: "Nao autenticado." }, { status: 401 }) }
  }

  const project = await getProjectForUser(identifier, user)

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

  const contacts = await listWhatsAppHandoffContactsForUser(loaded.project, loaded.user)
  return NextResponse.json({ contacts }, { status: 200 })
}

export async function POST(request, context) {
  const { id } = await context.params
  const loaded = await loadProject(id)

  if (loaded.response) {
    return loaded.response
  }

  const body = await request.json().catch(() => ({}))

  if (body.action === "delete") {
    const ok = await deleteWhatsAppHandoffContactForUser(loaded.project, body.contactId, loaded.user)
    return NextResponse.json({ success: ok }, { status: ok ? 200 : 500 })
  }

  const { contact, error } = await saveWhatsAppHandoffContactForUser(loaded.project, body, loaded.user)

  if (error) {
    return NextResponse.json({ error }, { status: 400 })
  }

  return NextResponse.json({ contact }, { status: body.id ? 200 : 201 })
}
