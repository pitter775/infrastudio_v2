import { useEffect, useState } from 'react'
import { Menu, X } from 'lucide-react'

import { Button } from '@/components/ui/button'
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
  bottomContent = null,
  onCancel = null,
}) {
  const statusClasses = colorClassName
    ? getToneClasses(colorClassName)
    : statusTone === 'sky'
      ? { text: 'text-sky-300', mutedText: 'text-sky-300', track: 'bg-sky-500/20', thumb: 'bg-sky-300' }
      : { text: 'text-emerald-300', mutedText: 'text-slate-500', track: 'bg-emerald-500/20', thumb: 'bg-emerald-300' }

  return (
    <div className={cn('px-6', compact ? 'pt-4 pb-3 sm:py-3' : 'pt-4 pb-2 sm:pt-5 sm:pb-5')}>
      <div className="relative flex flex-col gap-2 pr-14 sm:gap-3 sm:pr-0">
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
            {bottomContent ? <div className="mt-4">{bottomContent}</div> : null}
          </div>
        </div>

        {onCancel ? (
          <Button
            type="button"
            variant="ghost"
            onClick={onCancel}
            className={cn(
              'absolute right-0 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl p-0 text-slate-300 hover:bg-white/[0.06] hover:text-white sm:hidden',
              '-top-1 border-0 bg-transparent',
            )}
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
  const [mobileOpen, setMobileOpen] = useState(false)
  const [railOpen, setRailOpen] = useState(false)
  const [railLocked, setRailLocked] = useState(false)
  const currentTab = tabs.find((tab) => tab.id === activeTab) || tabs[0]
  const CurrentIcon = currentTab?.icon

  useEffect(() => {
    if (typeof window === 'undefined' || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return undefined
    }

    const openTimer = window.setTimeout(() => {
      setRailOpen(true)
      setRailLocked(true)
    }, 120)
    const closeTimer = window.setTimeout(() => {
      setRailOpen(false)
      setRailLocked(false)
    }, 1500)

    return () => {
      window.clearTimeout(openTimer)
      window.clearTimeout(closeTimer)
    }
  }, [])

  function handleChange(tabId) {
    onChange(tabId)
    setMobileOpen(false)
    setRailOpen(false)
    setRailLocked(true)
    if (typeof document !== 'undefined' && document.activeElement instanceof HTMLElement) {
      document.activeElement.blur()
    }
  }

  return (
    <>
      <div className="border-b border-white/5 px-4 py-3 md:hidden">
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          className="inline-flex h-10 w-full items-center justify-between rounded-xl border border-white/10 bg-[#0c1426] px-3 text-sm font-semibold text-slate-100 transition-colors hover:bg-[#101b31]"
        >
          <span className="inline-flex min-w-0 items-center gap-2">
            {CurrentIcon ? <CurrentIcon className="h-4 w-4 shrink-0 text-sky-300" /> : null}
            <span className="truncate">{currentTab?.label || 'Menu'}</span>
          </span>
          <Menu className="h-4 w-4 shrink-0 text-slate-400" />
        </button>
      </div>

      {mobileOpen ? (
        <div className="fixed inset-0 z-[120] md:hidden" role="dialog" aria-modal="true" aria-label="Menu do painel">
          <button
            type="button"
            className="absolute inset-0 bg-slate-950/72 backdrop-blur-sm"
            aria-label="Fechar menu"
            onClick={() => setMobileOpen(false)}
          />
          <div className="absolute inset-x-3 top-16 rounded-2xl border border-white/10 bg-[#080e1d] p-2 shadow-[0_24px_80px_rgba(2,6,23,0.72)]">
            <div className="flex items-center justify-between px-2 pb-2 pt-1">
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Menu</div>
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/[0.03] text-slate-300 hover:bg-white/[0.06] hover:text-white"
              >
                <X className="h-4 w-4" />
                <span className="sr-only">Fechar</span>
              </button>
            </div>
            <div className="grid gap-1">
              {tabs.map((tab) => {
                const Icon = tab.icon
                const active = tab.id === activeTab
                const amber = tab.tone === 'amber'

                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => handleChange(tab.id)}
                    className={cn(
                      'flex h-12 items-center gap-3 rounded-xl border px-3 text-left text-sm font-semibold transition-colors',
                      active
                        ? amber
                          ? 'border-amber-300/45 bg-amber-400/14 text-amber-100'
                          : 'border-sky-400/40 bg-sky-500/16 text-sky-100'
                        : 'border-transparent text-slate-300 hover:bg-[#10192b] hover:text-white',
                    )}
                  >
                    {Icon ? <Icon className={cn('h-4 w-4 shrink-0', active && amber ? 'text-amber-300' : active ? 'text-sky-300' : 'text-slate-500')} /> : null}
                    <span className="min-w-0 flex-1 truncate">{tab.label}</span>
                    {tab.badge ? (
                      <span className="rounded-lg border border-amber-300/20 bg-amber-400/10 px-1.5 py-0.5 text-[10px] font-semibold text-amber-200">
                        {tab.badge}
                      </span>
                    ) : null}
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      ) : null}

      <nav
        className="relative z-0 hidden w-0 shrink-0 md:block"
        aria-label="Menu do painel"
        onMouseEnter={() => {
          if (!railLocked) {
            setRailOpen(true)
          }
        }}
        onMouseLeave={() => {
          setRailOpen(false)
          setRailLocked(false)
        }}
        onFocus={() => {
          if (!railLocked) {
            setRailOpen(true)
          }
        }}
        onBlur={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget)) {
            setRailOpen(false)
            setRailLocked(false)
          }
        }}
      >
        <div
          className={cn(
            'absolute right-0 top-8 z-0 w-12 overflow-visible rounded-l-xl rounded-r-none border-y border-l border-white/10 border-r-0 bg-[#080e1d] py-2 shadow-[-10px_16px_34px_rgba(2,6,23,0.42)] transition-[width,box-shadow,background-color,border-color] duration-200 ease-out',
            railOpen && 'w-40 border-white/14 bg-[#0a1122] shadow-[-18px_22px_56px_rgba(2,6,23,0.66),0_0_0_1px_rgba(255,255,255,0.04)]',
          )}
        >
          <div className="grid gap-1 px-2">
        {tabs.map((tab) => {
          const Icon = tab.icon
          const active = tab.id === activeTab
          const amber = tab.tone === 'amber'
          const activeGlow = amber
            ? 'shadow-[0_0_24px_rgba(251,191,36,0.38),0_0_52px_rgba(251,191,36,0.18)]'
            : 'shadow-[0_0_24px_rgba(56,189,248,0.38),0_0_52px_rgba(56,189,248,0.18)]'

          return (
            <button
              key={tab.id}
              data-item-id={tab.id}
              type="button"
              onClick={() => handleChange(tab.id)}
              title={tab.label}
              className={cn(
                'infra-tab-motion relative flex h-9 w-full items-center gap-2 rounded-lg border border-transparent px-2.5 text-left text-xs font-semibold transition-[background-color,box-shadow,color]',
                active
                  ? amber
                    ? cn(
                        'bg-amber-400/14 text-amber-50',
                        railOpen && '-mr-2 rounded-r-none after:absolute after:-right-2 after:inset-y-0 after:w-2 after:bg-[#0a1122]',
                        railOpen && activeGlow,
                      )
                    : cn(
                        'bg-sky-500/14 text-sky-50',
                        railOpen && '-mr-2 rounded-r-none after:absolute after:-right-2 after:inset-y-0 after:w-2 after:bg-[#0a1122]',
                        railOpen && activeGlow,
                      )
                  : amber
                    ? 'bg-transparent text-amber-100/45 hover:bg-amber-400/10 hover:text-amber-50'
                    : 'bg-transparent text-slate-500 hover:bg-[#10192b] hover:text-slate-200',
              )}
            >
              {Icon ? (
                <Icon
                  className={cn(
                    'h-4 w-4 shrink-0 transition-[filter,opacity]',
                    active && (amber ? 'drop-shadow-[0_0_10px_rgba(251,191,36,0.9)]' : 'drop-shadow-[0_0_10px_rgba(56,189,248,0.9)]'),
                    !active && 'opacity-70',
                  )}
                />
              ) : null}
              <span className={cn('min-w-0 flex-1 truncate opacity-0 transition-opacity duration-150', railOpen && 'opacity-100')}>
                {tab.label}
              </span>
              {tab.badge ? (
                <span className={cn('rounded-lg border border-amber-300/20 bg-amber-400/10 px-1.5 py-0.5 text-[10px] font-semibold text-amber-200 opacity-0 transition-opacity duration-150', railOpen && 'opacity-100')}>
                  {tab.badge}
                </span>
              ) : null}
            </button>
          )
        })}
          </div>
        </div>
      </nav>
    </>
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
