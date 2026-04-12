import { LandingPage } from '@/components/home/landing-page'
import { HomeChatWidgetLoader } from "@/components/home/home-chat-widget-loader"
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
      {chatConfig ? <HomeChatWidgetLoader config={chatConfig} /> : null}
    </>
  )
}
