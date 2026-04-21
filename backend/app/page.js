import { LandingPage } from '@/components/home/landing-page'
import { HomeChatWidgetLoader } from "@/components/home/home-chat-widget-loader"
import { getInfraStudioHomeChatConfig } from "@/lib/infrastudio-home"
import { getPublicTopUpOffer, listPublicPlans } from "@/lib/public-planos-server"
import { getSessionUser } from "@/lib/session"

const HOME_CHAT_WIDGET_FALLBACK = {
  widget: "infrastudio-home",
  agente: "e0c00703-726d-477e-926d-9e9986a67db0",
  title: "InfraStudio Home",
  theme: "dark",
  accent: "#2563eb",
  transparent: true,
  src: "https://www.infrastudio.pro/chat-widget.js",
  apiBase: "https://www.infrastudio.pro",
}

export default async function Home() {
  const [chatConfig, currentUser, plans, topUpOffer] = await Promise.all([
    getInfraStudioHomeChatConfig(),
    getSessionUser(),
    listPublicPlans(),
    getPublicTopUpOffer(),
  ])
  const homeChatConfig = chatConfig?.widget ? { ...HOME_CHAT_WIDGET_FALLBACK, ...chatConfig } : HOME_CHAT_WIDGET_FALLBACK

  return (
    <>
      <LandingPage currentUser={currentUser} plans={plans} topUpOffer={topUpOffer} />
      <HomeChatWidgetLoader config={homeChatConfig} />
    </>
  )
}
