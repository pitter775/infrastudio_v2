import { X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { HorizontalDragScroll } from '@/components/ui/horizontal-drag-scroll'
import { cn } from '@/lib/utils'
import { getToneClasses } from './project-detail-layout'

export function SheetPanelHeader({
  eyebrow,
  eyebrowIcon: EyebrowIcon = null,
  description,
  compact = false,
  statusLabel,
  statusTone = 'emerald',
  colorClassName = null,
  enabled = true,
  leftAction = null,
  rightAction = null,
  onCancel = null,
}) {
  const statusClasses = colorClassName
    ? getToneClasses(colorClassName)
    : statusTone === 'sky'
      ? { text: 'text-sky-300', mutedText: 'text-sky-300', track: 'bg-sky-500/20', thumb: 'bg-sky-300' }
      : { text: 'text-emerald-300', mutedText: 'text-slate-500', track: 'bg-emerald-500/20', thumb: 'bg-emerald-300' }

  return (
    <div className={cn('px-6', compact ? 'pt-4 pb-3 sm:py-3' : 'pt-8 pb-5 sm:py-5')}>
      <div className="relative flex flex-col gap-3 pr-14 sm:pr-0">
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start justify-between gap-3 pr-8 sm:pr-0">
                <p className={cn('flex items-center gap-2 text-xs uppercase tracking-[0.22em]', statusClasses.mutedText || statusClasses.text)}>
                  {EyebrowIcon ? <EyebrowIcon className="h-3.5 w-3.5" /> : null}
                  {eyebrow}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {leftAction ? <div className="flex items-center">{leftAction}</div> : null}
                {rightAction ? <div className="flex items-center">{rightAction}</div> : null}

                {!leftAction && !rightAction && statusLabel ? (
                  <div className="flex items-center gap-3">
                    <span className={cn('text-xs font-semibold uppercase tracking-[0.18em]', statusClasses.text)}>
                      {enabled ? 'Desativar' : 'Ativar'}
                    </span>
                    <div className={cn('flex h-7 w-10 items-center rounded-full p-1', statusClasses.track)}>
                      <div className={cn(enabled ? 'ml-auto' : 'mr-auto', 'h-5 w-5 rounded-full', statusClasses.thumb)} />
                    </div>
                  </div>
                ) : null}
              </div>
            </div>

            {description ? <p className="mt-2 hidden text-sm text-slate-400 sm:block">{description}</p> : null}
          </div>
        </div>

        {onCancel ? (
          <Button
            type="button"
            variant="ghost"
            onClick={onCancel}
            className="absolute right-0 top-0 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.03] p-0 text-slate-300 hover:bg-white/[0.06] hover:text-white sm:hidden"
          >
            <X className="h-4 w-4" />
            <span className="sr-only">Fechar</span>
          </Button>
        ) : null}
      </div>
    </div>
  )
}

export function SheetPowerToggle({ enabled, disabled = false, onClick, compact = false }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'group inline-flex items-center rounded-full border text-[11px] font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60',
        compact ? 'h-6 gap-1 px-1.5 pr-1.5' : 'h-7 gap-1.5 px-2 pr-2.5',
        enabled
          ? 'border-emerald-400/25 bg-emerald-500/10 text-emerald-100 hover:bg-emerald-500/20'
          : 'border-red-400/25 bg-red-500/10 text-red-100 hover:bg-red-500/20',
      )}
      title={enabled ? 'Desativar' : 'Ativar'}
    >
      <span
        className={cn(
          compact ? 'flex h-3.5 w-6 items-center rounded-full p-0.5 transition-colors' : 'flex h-4 w-7 items-center rounded-full p-0.5 transition-colors',
          enabled ? 'bg-emerald-400/25' : 'bg-red-400/25',
        )}
      >
        <span
          className={cn(
            compact ? 'h-2.5 w-2.5 rounded-full transition-transform' : 'h-3 w-3 rounded-full transition-transform',
            enabled ? (compact ? 'translate-x-2.5 bg-emerald-300' : 'translate-x-3 bg-emerald-300') : 'translate-x-0 bg-red-300',
          )}
        />
      </span>
      {compact ? null : enabled ? 'Desativar' : 'Ativar'}
    </button>
  )
}

export function SheetInternalTabs({ tabs, activeTab, onChange }) {
  return (
    <div className="border-b border-white/5 px-6 py-3">
      <HorizontalDragScroll className="-mx-1" itemClassName="px-1" scrollClassName="py-1">
        {tabs.map((tab) => {
          const Icon = tab.icon
          const active = tab.id === activeTab

          return (
            <button
              key={tab.id}
              data-item-id={tab.id}
              type="button"
              onClick={() => onChange(tab.id)}
              className={cn(
                'infra-tab-motion inline-flex h-9 items-center gap-2 whitespace-nowrap rounded-xl border px-3 text-xs font-semibold transition-[background-color,border-color,box-shadow,color]',
                active
                  ? 'border-sky-400/40 bg-sky-500/16 text-sky-100 shadow-[0_8px_0_rgba(2,6,23,0.58),0_0_22px_rgba(56,189,248,0.16)]'
                  : 'border-transparent bg-transparent text-slate-400 hover:bg-[#10192b] hover:text-slate-100',
              )}
            >
              {Icon ? <Icon className="h-3.5 w-3.5" /> : null}
              {tab.label}
              {tab.badge ? (
                <span className="rounded-lg border border-amber-300/20 bg-amber-400/10 px-1.5 py-0.5 text-[10px] font-semibold text-amber-200">
                  {tab.badge}
                </span>
              ) : null}
            </button>
          )
        })}
      </HorizontalDragScroll>
    </div>
  )
}

export function PlaceholderPanel({ title, description, items = [] }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-[#0a1020] p-5">
      <div className="text-sm font-medium text-white">{title}</div>
      <div className="mt-2 text-sm leading-6 text-slate-400">{description}</div>
      {items.length ? (
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          {items.map((item) => (
            <div key={item} className="rounded-xl border border-white/10 bg-black/10 px-3 py-2 text-xs text-slate-300">
              {item}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  )
}
