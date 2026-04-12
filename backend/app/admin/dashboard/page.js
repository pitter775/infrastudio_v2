import { AdminDashboardPage } from "@/components/admin/dashboard/dashboard-page"
import { getDashboardOverview } from "@/lib/dashboard"
import { getSessionUser } from "@/lib/session"

export default async function Page() {
  const currentUser = await getSessionUser()
  const overview = currentUser ? await getDashboardOverview(currentUser) : null

  return <AdminDashboardPage overview={overview} currentUser={currentUser} />
}
