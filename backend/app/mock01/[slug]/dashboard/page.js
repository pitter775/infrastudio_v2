import { notFound } from 'next/navigation'
import { DashboardView } from '@/components/mock01/dashboard-view'
import { projectCards } from '@/components/mock01/data'

export default async function Mock01ProjectDashboardPage({ params }) {
  const { slug } = await params
  const project = projectCards.find((card) => card.slug === slug)

  if (!project) {
    notFound()
  }

  return <DashboardView card={project} />
}
