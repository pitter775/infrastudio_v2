import "server-only"

import { randomUUID } from "crypto"

import { getSupabaseAdminClient } from "@/lib/supabase-admin"

export const USER_AVATARS_BUCKET = "user-avatars"
export const MAX_USER_AVATAR_BYTES = 500 * 1024

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
    .slice(0, 8) || "x"
}

async function ensureBucket() {
  if (bucketReady) {
    return
  }

  const supabase = getSupabaseAdminClient()
  const { data } = await supabase.storage.listBuckets()

  if (!data?.some((bucket) => bucket.name === USER_AVATARS_BUCKET)) {
    const createResult = await supabase.storage.createBucket(USER_AVATARS_BUCKET, {
      public: true,
      fileSizeLimit: MAX_USER_AVATAR_BYTES,
      allowedMimeTypes: ["image/jpeg", "image/png", "image/webp"],
    })

    if (createResult.error && !String(createResult.error.message || "").toLowerCase().includes("already")) {
      throw createResult.error
    }
  }

  bucketReady = true
}

export async function uploadUserAvatar({ usuarioId, dataBase64, type, name }) {
  const base64 = String(dataBase64 || "").trim()
  const mimeType = String(type || "").trim().toLowerCase()

  if (!usuarioId || !base64) {
    throw new Error("Upload de avatar invalido.")
  }

  if (!["image/jpeg", "image/png", "image/webp"].includes(mimeType)) {
    throw new Error("Formato de avatar invalido. Use JPG, PNG ou WEBP.")
  }

  const fileBuffer = Buffer.from(base64, "base64")
  if (!fileBuffer.byteLength) {
    throw new Error("Arquivo de avatar invalido.")
  }

  if (fileBuffer.byteLength > MAX_USER_AVATAR_BYTES) {
    throw new Error("A foto de perfil deve ter no maximo 500 KB.")
  }

  await ensureBucket()

  const supabase = getSupabaseAdminClient()
  const originalName = String(name || "avatar").trim()
  const extension = originalName.includes(".") ? originalName.split(".").pop() ?? "" : mimeType.split("/")[1] ?? ""
  const safeExtension = sanitizeFileName(extension)
  const compactFileName = `${Date.now().toString(36)}-${randomUUID().replace(/-/g, "").slice(0, 10)}${safeExtension ? `.${safeExtension}` : ""}`
  const storagePath = `u-${shortenId(usuarioId)}/${compactFileName}`

  const uploadResult = await supabase.storage.from(USER_AVATARS_BUCKET).upload(storagePath, fileBuffer, {
    contentType: mimeType,
    upsert: false,
  })

  if (uploadResult.error) {
    throw uploadResult.error
  }

  return supabase.storage.from(USER_AVATARS_BUCKET).getPublicUrl(storagePath).data.publicUrl
}
