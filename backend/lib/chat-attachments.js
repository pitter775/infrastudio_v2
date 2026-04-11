import "server-only"

import { randomUUID } from "crypto"

import { getSupabaseAdminClient } from "@/lib/supabase-admin"

export const CHAT_ATTACHMENTS_BUCKET = "chat-attachments"

export function getChatAttachmentsMetadata(attachments) {
  return (attachments ?? []).map((attachment) => ({
    name: attachment.name,
    type: attachment.type,
    size: attachment.size,
    publicUrl: attachment.publicUrl,
    storagePath: attachment.storagePath,
    category: attachment.category,
  }))
}

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
  const normalized = String(value || "")
    .replace(/[^a-zA-Z0-9]/g, "")
    .toLowerCase()

  return normalized.slice(0, 8) || "x"
}

function inferCategory(type) {
  if (String(type || "").startsWith("image/")) {
    return "image"
  }

  if (String(type || "").startsWith("video/")) {
    return "video"
  }

  return "file"
}

async function ensureBucket() {
  if (bucketReady) {
    return
  }

  const supabase = getSupabaseAdminClient()
  const { data } = await supabase.storage.listBuckets()

  if (!data?.some((bucket) => bucket.name === CHAT_ATTACHMENTS_BUCKET)) {
    const createResult = await supabase.storage.createBucket(CHAT_ATTACHMENTS_BUCKET, {
      public: true,
      fileSizeLimit: 20 * 1024 * 1024,
    })

    if (createResult.error && !String(createResult.error.message || "").toLowerCase().includes("already")) {
      throw createResult.error
    }
  }

  bucketReady = true
}

export async function uploadChatAttachmentPayloads(input) {
  const supabase = getSupabaseAdminClient()
  await ensureBucket()

  const uploaded = []

  for (const attachment of input.attachments ?? []) {
    const base64 = String(attachment.dataBase64 || "").trim()
    if (!base64) {
      continue
    }

    const fileBuffer = Buffer.from(base64, "base64")
    if (!fileBuffer.byteLength) {
      continue
    }

    const rawName = attachment.name?.trim() || "arquivo"
    const extension = rawName.includes(".") ? rawName.split(".").pop() ?? "" : ""
    const compactStamp = Date.now().toString(36)
    const compactToken = randomUUID().replace(/-/g, "").slice(0, 10)
    const safeExtension = extension ? sanitizeFileName(extension) : ""
    const compactFileName = `${compactStamp}-${compactToken}${safeExtension ? `.${safeExtension}` : ""}`
    const storagePath = `p-${shortenId(input.projetoId)}/c-${shortenId(input.chatId)}/${compactFileName}`
    const mimeType = attachment.type?.trim() || "application/octet-stream"

    const uploadResult = await supabase.storage.from(CHAT_ATTACHMENTS_BUCKET).upload(storagePath, fileBuffer, {
      contentType: mimeType,
      upsert: false,
    })

    if (uploadResult.error) {
      throw uploadResult.error
    }

    const publicUrl = supabase.storage.from(CHAT_ATTACHMENTS_BUCKET).getPublicUrl(storagePath).data.publicUrl
    uploaded.push({
      name: rawName,
      type: mimeType,
      size: fileBuffer.byteLength,
      publicUrl,
      storagePath,
      category: inferCategory(mimeType),
    })
  }

  return uploaded
}
