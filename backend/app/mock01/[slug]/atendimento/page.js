import { notFound } from 'next/navigation'
import { AttendanceView } from '@/components/mock01/attendance-view'
import { projectCards } from '@/components/mock01/data'

export default async function Mock01ProjectAttendancePage({ params }) {
  const { slug } = await params
  const project = projectCards.find((card) => card.slug === slug)

  if (!project) {
    notFound()
  }

  return <AttendanceView card={project} />
}
