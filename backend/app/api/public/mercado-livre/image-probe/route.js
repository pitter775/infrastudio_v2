import { NextResponse } from "next/server"

function sanitizeUrl(value) {
  const raw = String(value || "").trim()
  if (!raw || raw.length > 700) {
    return null
  }

  try {
    const url = new URL(raw)
    const host = url.hostname.toLowerCase()
    if (!["http:", "https:"].includes(url.protocol) || !host.endsWith("mlstatic.com")) {
      return null
    }
    return url
  } catch {
    return null
  }
}

export async function GET(request) {
  const requestUrl = new URL(request.url)
  const imageUrl = sanitizeUrl(requestUrl.searchParams.get("url"))

  if (!imageUrl) {
    return NextResponse.json({ ok: false, error: "URL de imagem inválida." }, { status: 400 })
  }

  try {
    const response = await fetch(imageUrl.toString(), {
      headers: {
        Accept: "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
        Range: "bytes=0-64",
      },
      cache: "no-store",
      signal: AbortSignal.timeout(3000),
    })
    const contentType = String(response.headers.get("content-type") || "").toLowerCase()
    const contentLength = String(response.headers.get("content-length") || "")
    if (response.body?.cancel) {
      await response.body.cancel().catch(() => {})
    }

    return NextResponse.json(
      {
        ok: response.ok,
        status: response.status,
        contentType,
        contentLength,
        placeholder: response.ok && contentType === "image/gif",
      },
      {
        status: 200,
        headers: {
          "Cache-Control": "public, max-age=1800",
        },
      },
    )
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "unknown_error",
        placeholder: false,
      },
      { status: 200 },
    )
  }
}
