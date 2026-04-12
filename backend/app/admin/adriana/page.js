import { AdrianaPage } from "@/components/admin/adriana/adriana-page"
import { getSessionUser } from "@/lib/session"

export default async function Page() {
  const currentUser = await getSessionUser()

  return <AdrianaPage currentUser={currentUser} />
}
