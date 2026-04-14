'use client'

import { cn } from '@/lib/utils'

export function AdminPageHeader({ title, description, actions, className }) {
  return (
    <div
      className={cn(
        'mb-5 flex flex-col gap-3 border-b border-white/5 px-1 pb-4 pt-2 lg:flex-row lg:items-end lg:justify-between',
        className,
      )}
    >
      <div className="min-w-0">
        <h1 className="text-lg font-semibold text-emerald-400">{title}</h1>
        {description ? <p className="mt-1 text-xs text-slate-500">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  )
}

