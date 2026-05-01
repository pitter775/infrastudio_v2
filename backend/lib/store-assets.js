import "server-only"

import { randomUUID } from "crypto"

import { getSupabaseAdminClient } from "@/lib/supabase-admin"
import { MAX_STORE_ASSET_BYTES, STORE_ASSETS_BUCKET } from "@/lib/store-assets-constants"

const ALLOWED_STORE_ASSET_MIME_TYPES = [
  "image/avif",
  "image/jpeg",
  "image/png",
  "image/svg+xml",
  "image/webp",
]
const STORE_ASSET_EXTENSION_TO_MIME = {
  avif: "image/avif",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  svg: "image/svg+xml",
  webp: "image/webp",
}

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

export function buildStoreAssetPrefix({ projectId, storeId }) {
  return `p-${shortenId(projectId)}/lojas/${shortenId(storeId)}/`
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

function resolveStoreAssetMimeType(file, normalizedKind) {
  const rawMimeType = String(file?.type || "").trim().toLowerCase()
  if (ALLOWED_STORE_ASSET_MIME_TYPES.includes(rawMimeType)) {
    return rawMimeType
  }

  const originalName = String(file?.name || normalizedKind).trim().toLowerCase()
  const extension = originalName.includes(".") ? originalName.split(".").pop() ?? "" : ""
  return STORE_ASSET_EXTENSION_TO_MIME[extension] || ""
}

function buildStoreAssetFileName({ fileName, kind, mimeType }) {
  const originalName = String(fileName || kind).trim()
  const extension = originalName.includes(".") ? originalName.split(".").pop() ?? "" : mimeType.split("/")[1] ?? ""
  const safeExtension = sanitizeFileName(extension)
  return `${kind}-${Date.now().toString(36)}-${randomUUID().replace(/-/g, "").slice(0, 10)}${safeExtension ? `.${safeExtension}` : ""}`
}

function validateStoreAssetInput({ fileSize, mimeType, projectId, storeId }) {
  if (!projectId || !storeId) {
    throw new Error("Upload da loja invalido.")
  }

  if (!ALLOWED_STORE_ASSET_MIME_TYPES.includes(mimeType)) {
    throw new Error("Formato invalido. Use AVIF, JPG, PNG, SVG ou WEBP.")
  }

  if (Number(fileSize || 0) > MAX_STORE_ASSET_BYTES) {
    throw new Error("A imagem deve ter no maximo 1 MB.")
  }
}

export function isStoreAssetPathOwnedByStore({ projectId, storeId, storagePath }) {
  const normalizedPath = normalizeStoreAssetPath(storagePath)
  return normalizedPath.startsWith(buildStoreAssetPrefix({ projectId, storeId }))
}

export function getStoreAssetPublicUrl(storagePath) {
  const supabase = getSupabaseAdminClient()
  return supabase.storage.from(STORE_ASSETS_BUCKET).getPublicUrl(normalizeStoreAssetPath(storagePath)).data.publicUrl
}

export async function createStoreAssetSignedUpload({ projectId, storeId, kind, fileName, fileSize, contentType }) {
  const normalizedKind = kind === "logo" ? "logo" : "hero"
  const mimeType = resolveStoreAssetMimeType({ name: fileName, type: contentType }, normalizedKind)
  validateStoreAssetInput({ fileSize, mimeType, projectId, storeId })
  const supabase = getSupabaseAdminClient()
  const storagePath = `${buildStoreAssetPrefix({ projectId, storeId })}${buildStoreAssetFileName({ fileName, kind: normalizedKind, mimeType })}`
  const { data, error } = await supabase.storage.from(STORE_ASSETS_BUCKET).createSignedUploadUrl(storagePath, {
    upsert: false,
  })
  if (error) {
    throw error
  }

  return {
    token: data.token,
    signedUrl: data.signedUrl,
    publicUrl: getStoreAssetPublicUrl(storagePath),
    storagePath,
    kind: normalizedKind,
    contentType: mimeType,
  }
}

export async function removeStoreAsset(value) {
  const storagePath = normalizeStoreAssetPath(value)
  if (!storagePath || storagePath.includes("..") || storagePath.startsWith("http")) {
    return { removed: false }
  }

  const supabase = getSupabaseAdminClient()
  const result = await supabase.storage.from(STORE_ASSETS_BUCKET).remove([storagePath])
  if (result.error) {
    throw result.error
  }

  return { removed: true, storagePath }
}
