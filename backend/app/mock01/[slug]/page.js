import { notFound } from 'next/navigation'
import { ProjectDetailView } from '@/components/mock01/project-detail-view'
import { projectCards } from '@/components/mock01/data'

export default async function Mock01ProjectPage({ params }) {
  const { slug } = await params
  const project = projectCards.find((card) => card.slug === slug)

  if (!project) {
    notFound()
  }

  return <ProjectDetailView card={project} />
}
