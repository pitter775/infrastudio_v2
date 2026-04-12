import Script from "next/script"

import { LandingPage } from '@/components/home/landing-page'
import { getInfraStudioHomeChatConfig } from "@/lib/infrastudio-home"
import { getSessionUser } from "@/lib/session"

export default async function Home() {
  const [chatConfig, currentUser] = await Promise.all([
    getInfraStudioHomeChatConfig(),
    getSessionUser(),
  ])

  return (
    <>
      <LandingPage currentUser={currentUser} />
      {chatConfig ? (
        <Script
          id="infrastudio-home-chat"
          src="/chat.js"
          strategy="afterInteractive"
          data-projeto={chatConfig.projeto}
          data-agente={chatConfig.agente}
          data-widget={chatConfig.widget}
        />
      ) : null}
    </>
  )
}
