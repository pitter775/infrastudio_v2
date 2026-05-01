import { NextResponse } from "next/server"
import { revalidatePath } from "next/cache"

import { getMercadoLivreStoreSettingsForProject } from "@/lib/mercado-livre-store"
import { getProjectForUser } from "@/lib/projetos"
import { getSessionUser } from "@/lib/session"
import { getSupabaseAdminClient } from "@/lib/supabase-admin"
import {
  createStoreAssetSignedUpload,
  getStoreAssetPublicUrl,
  isStoreAssetPathOwnedByStore,
  removeStoreAsset,
} from "@/lib/store-assets"

async function resolveProjectStore(context) {
  const user = await getSessionUser()
  if (!user) {
    return { error: NextResponse.json({ error: "Nao autenticado." }, { status: 401 }) }
  }

  const { id } = await context.params
  const project = await getProjectForUser(id, user)
  if (!project) {
    return { error: NextResponse.json({ error: "Projeto nao encontrado." }, { status: 404 }) }
  }

  const store = await getMercadoLivreStoreSettingsForProject(project)
  if (!store?.id) {
    return { error: NextResponse.json({ error: "Salve a loja antes de enviar imagens." }, { status: 400 }) }
  }

  return { project, store }
}

export async function POST(request, context) {
  const resolved = await resolveProjectStore(context)
  if (resolved.error) {
    return resolved.error
  }

  const { project, store } = resolved
  const body = await request.json().catch(() => ({}))

  try {
    const asset = await createStoreAssetSignedUpload({
      kind: body?.kind,
      fileName: body?.fileName,
      fileSize: body?.fileSize,
      contentType: body?.contentType,
      projectId: project.id,
      storeId: store.id,
    })

    return NextResponse.json({ asset }, { status: 200 })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Nao foi possivel preparar o upload." },
      { status: 400 },
    )
  }
}

export async function PATCH(request, context) {
  const resolved = await resolveProjectStore(context)
  if (resolved.error) {
    return resolved.error
  }

  const { project, store } = resolved
  const body = await request.json().catch(() => ({}))
  const kind = String(body?.kind || "").trim()
  const previousStoragePath = String(body?.previousStoragePath || "").trim()
  const previousUrl = String(body?.previousUrl || "").trim()
  const storagePath = String(body?.storagePath || "").trim()

  if (!storagePath || !isStoreAssetPathOwnedByStore({ projectId: project.id, storeId: store.id, storagePath })) {
    return NextResponse.json({ error: "Arquivo invalido para esta loja." }, { status: 400 })
  }

  const publicUrl = getStoreAssetPublicUrl(storagePath)
  const supabase = getSupabaseAdminClient()
  const currentVisualConfig = store.visualConfig || {}
  const currentHero = currentVisualConfig.hero || {}
  const nextVisualConfig =
    kind === "logo"
      ? {
          ...currentVisualConfig,
          logoStoragePath: storagePath,
        }
      : {
          ...currentVisualConfig,
          hero: {
            ...currentHero,
            backgroundMode: "image",
            imageUrl: publicUrl,
            imageStoragePath: storagePath,
          },
        }

  const updatePayload = {
    visual_config: nextVisualConfig,
    updated_at: new Date().toISOString(),
  }

  if (kind === "logo") {
    updatePayload.logo_url = publicUrl
  }

  const { error: updateError } = await supabase
    .from("mercadolivre_lojas")
    .update(updatePayload)
    .eq("id", store.id)
    .eq("projeto_id", project.id)

  if (updateError) {
    await removeStoreAsset(storagePath).catch(() => {})
    return NextResponse.json({ error: updateError.message || "Nao foi possivel salvar a imagem." }, { status: 400 })
  }

  revalidatePath(`/loja/${store.slug}`)

  const previousAsset =
    kind === "logo"
      ? previousStoragePath || currentVisualConfig.logoStoragePath || previousUrl || store.logoUrl
      : previousStoragePath || currentHero.imageStoragePath || previousUrl || currentHero.imageUrl
  if (previousAsset && previousAsset !== storagePath && previousAsset !== publicUrl) {
    await removeStoreAsset(previousAsset).catch(() => {})
  }

  return NextResponse.json(
    {
      asset: {
        kind: kind === "logo" ? "logo" : "hero",
        publicUrl,
        storagePath,
      },
      visualConfig: nextVisualConfig,
    },
    { status: 200 },
  )
}
