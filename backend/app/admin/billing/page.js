import { redirect } from "next/navigation"

import { AdminBillingPage } from "@/components/admin/billing/billing-page"
import { listAdminBillingProjects, listBillingPlans } from "@/lib/billing"
import { getSessionUser } from "@/lib/session"

export default async function Page() {
  const currentUser = await getSessionUser()

  if (currentUser?.role !== "admin") {
    redirect("/admin/projetos")
  }

  const [plans, projects] =
    currentUser?.role === "admin"
      ? await Promise.all([listBillingPlans(), listAdminBillingProjects()])
      : [[], []]

  return <AdminBillingPage initialPlans={plans} initialProjects={projects} currentUser={currentUser} />
}
