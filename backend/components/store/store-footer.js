'use client'

import { buildStoreAccentPalette } from '@/components/store/store-utils'
import { Globe, LayoutGrid, Phone, Sparkles, Store } from 'lucide-react'

const menuIconMap = {
  topo: Store,
  produtos: LayoutGrid,
  sobre: Sparkles,
  contato: Phone,
}

function resolveFooterHref(storeSlug, href, samePageNavigation) {
  if (!href || !href.startsWith('#')) {
    return href || `/loja/${storeSlug}`
  }

  if (samePageNavigation) {
    return href
  }

  return href === '#topo' ? `/loja/${storeSlug}` : `/loja/${storeSlug}${href}`
}

export function StoreFooter({ store, samePageNavigation = false }) {
  const palette = buildStoreAccentPalette(store.accentColor)
  const footerText = String(store.headline || store.footerText || '').trim()

  function handleAnchorNavigation(event, href) {
    if (!samePageNavigation || !href || !href.startsWith('#')) {
      return
    }

    event.preventDefault()
    const target = document.querySelector(href === '#topo' ? '#produtos' : href)
    if (target instanceof HTMLElement) {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' })
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }

  return (
    <footer className="border-t border-black/10" style={{ backgroundColor: palette.accentSoft }}>
      <div className="mx-auto grid max-w-[1228px] gap-8 px-3 py-8 text-slate-800 sm:px-4 lg:grid-cols-[1fr_auto]">
        <div>
          <div className="flex items-center gap-5">
            {store.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={store.logoUrl} alt={store.name} loading="lazy" decoding="async" className="h-32 w-32 shrink-0 rounded-[10px] object-contain" />
            ) : (
              <div className="flex h-32 w-32 shrink-0 items-center justify-center rounded-[10px] text-3xl font-semibold text-slate-800">
                {store.name.slice(0, 2).toUpperCase()}
              </div>
            )}
            <div className="min-w-0">
              <div className="text-lg font-semibold text-slate-950">{store.name}</div>
              {footerText ? <div className="mt-2 max-w-2xl text-sm leading-6 text-slate-700">{footerText}</div> : null}
              <a href="https://www.infrastudio.pro" target="_blank" rel="noreferrer" className="mt-4 inline-flex opacity-70 transition hover:opacity-90">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/infrastudio-preto.png" alt="InfraStudio" loading="lazy" decoding="async" className="h-2.5 w-auto object-contain" />
              </a>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-3 lg:justify-end">
          {store.menuLinks.map((item) => {
            const sectionId = item.href.replace('#', '')
            const Icon = menuIconMap[sectionId] || Globe

            return (
              <a
                key={`${item.label}-${item.href}-footer`}
                href={resolveFooterHref(store.slug, item.href, samePageNavigation)}
                onClick={(event) => handleAnchorNavigation(event, item.href)}
                className="inline-flex items-center gap-2 rounded-[8px] px-3 py-2 text-sm text-slate-700 transition hover:bg-[var(--store-footer-hover)] hover:text-slate-950"
                style={{ '--store-footer-hover': palette.accentBorder }}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </a>
            )
          })}
        </div>
      </div>
    </footer>
  )
}
