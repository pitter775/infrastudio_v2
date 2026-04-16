import { LandingPage } from '@/components/home/landing-page'
import { HomeChatWidgetLoader } from "@/components/home/home-chat-widget-loader"
import { getInfraStudioHomeChatConfig } from "@/lib/infrastudio-home"
import { getPublicTopUpOffer, listPublicPlans } from "@/lib/public-planos-server"
import { getSessionUser } from "@/lib/session"

export default async function Home() {
  const [chatConfig, currentUser, plans, topUpOffer] = await Promise.all([
    getInfraStudioHomeChatConfig(),
    getSessionUser(),
    listPublicPlans(),
    getPublicTopUpOffer(),
  ])

  return (
    <>
      <LandingPage currentUser={currentUser} plans={plans} topUpOffer={topUpOffer} />
      {chatConfig ? <HomeChatWidgetLoader config={chatConfig} /> : null}
    </>
  )
}
