import "server-only"

import { randomUUID } from "crypto"

import { getSupabaseAdminClient } from "@/lib/supabase-admin"

export const STORE_ASSETS_BUCKET = "store-assets"
export const MAX_STORE_ASSET_BYTES = 2 * 1024 * 1024

const ALLOWED_STORE_ASSET_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"]

let bucketReady = false

function sanitizeFileName(name) {
  return String(name || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase()
}

function shortenId(value) {
  return String(value || "")
    .replace(/[^a-zA-Z0-9]/g, "")
    .toLowerCase()
    .slice(0, 10) || "x"
}

function normalizeStoreAssetPath(value) {
  const rawValue = String(value || "").trim()
  if (!rawValue) {
    return ""
  }

  const publicMarker = `/storage/v1/object/public/${STORE_ASSETS_BUCKET}/`
  const signedMarker = `/storage/v1/object/sign/${STORE_ASSETS_BUCKET}/`
  const marker = rawValue.includes(publicMarker) ? publicMarker : rawValue.includes(signedMarker) ? signedMarker : ""

  if (marker) {
    try {
      const url = new URL(rawValue)
      return decodeURIComponent(url.pathname.split(marker)[1] || "").replace(/^\/+/, "")
    } catch {
      return decodeURIComponent(rawValue.split(marker)[1] || "").replace(/^\/+/, "")
    }
  }

  return rawValue
    .replace(new RegExp(`^${STORE_ASSETS_BUCKET}/`), "")
    .replace(/^\/+/, "")
}

async function ensureStoreAssetsBucket() {
  if (bucketReady) {
    return
  }

  const supabase = getSupabaseAdminClient()
  const { data, error } = await supabase.storage.listBuckets()
  if (error) {
    throw error
  }

  if (!data?.some((bucket) => bucket.name === STORE_ASSETS_BUCKET)) {
    const createResult = await supabase.storage.createBucket(STORE_ASSETS_BUCKET, {
      public: true,
      fileSizeLimit: MAX_STORE_ASSET_BYTES,
      allowedMimeTypes: ALLOWED_STORE_ASSET_MIME_TYPES,
    })

    if (createResult.error && !String(createResult.error.message || "").toLowerCase().includes("already")) {
      throw createResult.error
    }
  }

  bucketReady = true
}

export async function uploadStoreAsset({ file, projectId, storeId, kind }) {
  const normalizedKind = kind === "logo" ? "logo" : "hero"
  const mimeType = String(file?.type || "").trim().toLowerCase()

  if (!projectId || !storeId || !file) {
    throw new Error("Upload da loja invalido.")
  }

  if (!ALLOWED_STORE_ASSET_MIME_TYPES.includes(mimeType)) {
    throw new Error("Formato invalido. Use JPG, PNG ou WEBP.")
  }

  if (Number(file.size || 0) > MAX_STORE_ASSET_BYTES) {
    throw new Error("A imagem deve ter no maximo 2 MB.")
  }

  const bytes = Buffer.from(await file.arrayBuffer())
  if (!bytes.byteLength) {
    throw new Error("Arquivo invalido.")
  }

  await ensureStoreAssetsBucket()

  const supabase = getSupabaseAdminClient()
  const originalName = String(file.name || normalizedKind).trim()
  const extension = originalName.includes(".") ? originalName.split(".").pop() ?? "" : mimeType.split("/")[1] ?? ""
  const safeExtension = sanitizeFileName(extension)
  const fileName = `${normalizedKind}-${Date.now().toString(36)}-${randomUUID().replace(/-/g, "").slice(0, 10)}${safeExtension ? `.${safeExtension}` : ""}`
  const storagePath = `p-${shortenId(projectId)}/lojas/${shortenId(storeId)}/${fileName}`

  const uploadResult = await supabase.storage.from(STORE_ASSETS_BUCKET).upload(storagePath, bytes, {
    contentType: mimeType,
    upsert: false,
  })

  if (uploadResult.error) {
    throw uploadResult.error
  }

  const publicUrl = supabase.storage.from(STORE_ASSETS_BUCKET).getPublicUrl(storagePath).data.publicUrl

  return {
    publicUrl,
    storagePath,
    kind: normalizedKind,
  }
}

export async function removeStoreAsset(value) {
  const storagePath = normalizeStoreAssetPath(value)
  if (!storagePath || storagePath.includes("..") || storagePath.startsWith("http")) {
    return { removed: false }
  }

  await ensureStoreAssetsBucket()

  const supabase = getSupabaseAdminClient()
  const result = await supabase.storage.from(STORE_ASSETS_BUCKET).remove([storagePath])
  if (result.error) {
    throw result.error
  }

  return { removed: true, storagePath }
}
