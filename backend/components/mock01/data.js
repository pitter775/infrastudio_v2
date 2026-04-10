import { ChartColumn, FileText, LayoutGrid, Users } from 'lucide-react'

export const primaryNav = [
  { label: 'Projects', icon: LayoutGrid, active: true },
  { label: 'Templates', icon: FileText },
]

export const resourceNav = [
  { label: 'Usage', icon: ChartColumn },
  { label: 'People', icon: Users },
]

export const projectCards = [
  {
    slug: 'equilibramente',
    name: 'EquilibraMente',
    status: 'production',
    details: '2/2 services online',
    statusDotClassName: 'bg-emerald-500',
    icons: ['workflow', 'github'],
  },
  {
    slug: 'airy-beauty',
    name: 'airy-beauty',
    status: 'No services',
    details: '',
    statusDotClassName: 'bg-slate-600',
    icons: [],
  },
  {
    slug: 'pleasant-joy',
    name: 'pleasant-joy',
    status: 'production',
    details: '1/1 services online',
    statusDotClassName: 'bg-emerald-500',
    icons: ['github'],
  },
]
