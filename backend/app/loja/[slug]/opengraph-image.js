import { ImageResponse } from "next/og"

import { getPublicMercadoLivreStoreBySlug } from "@/lib/mercado-livre-store"

export const runtime = "nodejs"
export const size = {
  width: 1200,
  height: 630,
}
export const contentType = "image/png"

function sanitizeColor(value, fallback) {
  const normalized = String(value || "").trim()
  return /^#([0-9a-f]{6}|[0-9a-f]{3})$/i.test(normalized) ? normalized : fallback
}

export default async function Image({ params }) {
  const { slug } = await params
  const result = await getPublicMercadoLivreStoreBySlug(slug, { page: 1 })
  const store = result?.store

  const storeName = String(store?.name || "Loja").trim()
  const storeHeadline = String(store?.headline || "Produtos da loja com atendimento direto.").trim()
  const accent = sanitizeColor(store?.accentColor, "#0f766e")
  const accentSoft = `${accent}18`

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "linear-gradient(135deg, #f8f5ef 0%, #fffdf8 52%, #f4efe5 100%)",
          color: "#0f172a",
          padding: "56px 64px",
          fontFamily: "Arial, sans-serif",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 16,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              borderRadius: 999,
              padding: "10px 18px",
              background: accentSoft,
              color: accent,
              fontSize: 24,
              fontWeight: 700,
              letterSpacing: "0.24em",
              textTransform: "uppercase",
            }}
          >
            Loja
          </div>
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 22,
            maxWidth: "88%",
          }}
        >
          <div
            style={{
              fontSize: 74,
              lineHeight: 1.02,
              fontWeight: 700,
              letterSpacing: "-0.05em",
            }}
          >
            {storeName}
          </div>
          <div
            style={{
              fontSize: 30,
              lineHeight: 1.4,
              color: "#475569",
            }}
          >
            {storeHeadline}
          </div>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            borderTop: "1px solid rgba(15,23,42,0.08)",
            paddingTop: 28,
          }}
        >
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 8,
            }}
          >
            <div
              style={{
                fontSize: 20,
                color: "#64748b",
                textTransform: "uppercase",
                letterSpacing: "0.22em",
              }}
            >
              Atendimento direto
            </div>
            <div
              style={{
                fontSize: 26,
                color: "#0f172a",
              }}
            >
              Produtos e detalhes da loja
            </div>
          </div>

          <div
            style={{
              width: 132,
              height: 132,
              borderRadius: 28,
              background: `linear-gradient(135deg, ${accent}, #ffffff)`,
              boxShadow: "0 20px 40px -24px rgba(15,23,42,0.24)",
            }}
          />
        </div>
      </div>
    ),
    size
  )
}
