import { NextResponse } from "next/server"
import { revalidatePath } from "next/cache"

import { getMercadoLivreStoreSettingsForProject } from "@/lib/mercado-livre-store"
import { getProjectForUser } from "@/lib/projetos"
import { getSessionUser } from "@/lib/session"
import { getSupabaseAdminClient } from "@/lib/supabase-admin"
import { removeStoreAsset, uploadStoreAsset } from "@/lib/store-assets"

export async function POST(request, context) {
  const user = await getSessionUser()
  if (!user) {
    return NextResponse.json({ error: "Nao autenticado." }, { status: 401 })
  }

  const { id } = await context.params
  const project = await getProjectForUser(id, user)
  if (!project) {
    return NextResponse.json({ error: "Projeto nao encontrado." }, { status: 404 })
  }

  const store = await getMercadoLivreStoreSettingsForProject(project)
  if (!store?.id) {
    return NextResponse.json({ error: "Salve a loja antes de enviar imagens." }, { status: 400 })
  }

  const formData = await request.formData().catch(() => null)
  const file = formData?.get("file")
  const kind = String(formData?.get("kind") || "").trim()
  const previousStoragePath = String(formData?.get("previousStoragePath") || "").trim()
  const previousUrl = String(formData?.get("previousUrl") || "").trim()

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Arquivo obrigatorio." }, { status: 400 })
  }

  try {
    const asset = await uploadStoreAsset({
      file,
      kind,
      projectId: project.id,
      storeId: store.id,
    })

    const supabase = getSupabaseAdminClient()
    const currentVisualConfig = store.visualConfig || {}
    const currentHero = currentVisualConfig.hero || {}
    const nextVisualConfig =
      kind === "logo"
        ? {
            ...currentVisualConfig,
            logoStoragePath: asset.storagePath,
          }
        : {
            ...currentVisualConfig,
            hero: {
              ...currentHero,
              backgroundMode: "image",
              imageUrl: asset.publicUrl,
              imageStoragePath: asset.storagePath,
            },
          }
    const updatePayload = {
      visual_config: nextVisualConfig,
      updated_at: new Date().toISOString(),
    }

    if (kind === "logo") {
      updatePayload.logo_url = asset.publicUrl
    }

    const { error: updateError } = await supabase
      .from("mercadolivre_lojas")
      .update(updatePayload)
      .eq("id", store.id)
      .eq("projeto_id", project.id)

    if (updateError) {
      await removeStoreAsset(asset.storagePath).catch(() => {})
      throw updateError
    }

    revalidatePath(`/loja/${store.slug}`)

    const previousAsset =
      kind === "logo"
        ? previousStoragePath || currentVisualConfig.logoStoragePath || previousUrl || store.logoUrl
        : previousStoragePath || currentHero.imageStoragePath || previousUrl || currentHero.imageUrl
    if (previousAsset && previousAsset !== asset.storagePath && previousAsset !== asset.publicUrl) {
      await removeStoreAsset(previousAsset).catch((error) => {
        console.warn("[mercado-livre-store] failed to remove previous store asset", {
          kind,
          message: error instanceof Error ? error.message : String(error || ""),
        })
      })
    }

    return NextResponse.json({ asset, visualConfig: nextVisualConfig }, { status: 200 })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Nao foi possivel enviar a imagem." },
      { status: 400 },
    )
  }
}
