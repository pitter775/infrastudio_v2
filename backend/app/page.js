import { Suspense } from "react"
import { LandingPage } from '@/components/home/landing-page'
import { HomeChatWidgetLoader } from "@/components/home/home-chat-widget-loader"
import { getInfraStudioHomeChatConfig } from "@/lib/infrastudio-home"
import { getPublicTopUpOffer, listPublicPlans } from "@/lib/public-planos-server"
import { getSessionUser } from "@/lib/session"

export const dynamic = "force-dynamic"

const HOME_CHAT_WIDGET_FALLBACK = {
  widget: "infrastudio-home",
  projeto: "infrastudio",
  agente: "e0c00703-726d-477e-926d-9e9986a67db0",
  title: "InfraStudio Home",
  theme: "dark",
  accent: "#2563eb",
  transparent: true,
  src: "/chat-widget.js",
  apiBase:
    process.env.NODE_ENV === "development"
      ? "https://www.infrastudio.pro"
      : undefined,
}

const HOME_DATA_TIMEOUT_MS = 3500

function withTimeout(promise, fallback, label) {
  return Promise.race([
    Promise.resolve(promise).catch((error) => {
      console.error(`[home] failed to load ${label}`, error)
      return fallback
    }),
    new Promise((resolve) => {
      setTimeout(() => {
        console.error(`[home] timed out loading ${label}`)
        resolve(fallback)
      }, HOME_DATA_TIMEOUT_MS)
    }),
  ])
}

export default async function Home() {
  const [chatConfig, currentUser, plans, topUpOffer] = await Promise.all([
    withTimeout(getInfraStudioHomeChatConfig(), null, "home chat config"),
    withTimeout(getSessionUser(), null, "session user"),
    withTimeout(listPublicPlans(), [], "public plans"),
    Promise.resolve(getPublicTopUpOffer()),
  ])
  const homeChatConfig = chatConfig?.widget ? { ...HOME_CHAT_WIDGET_FALLBACK, ...chatConfig } : HOME_CHAT_WIDGET_FALLBACK

  return (
    <>
      <Suspense fallback={null}>
        <LandingPage currentUser={currentUser} plans={plans} topUpOffer={topUpOffer} />
      </Suspense>
      <HomeChatWidgetLoader config={homeChatConfig} />
    </>
  )
}
