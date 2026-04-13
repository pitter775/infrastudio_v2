import { redirect } from "next/navigation"

export default async function Page({ params }) {
  const { id } = await params

  redirect(`/admin/projetos/${id}`)
}
