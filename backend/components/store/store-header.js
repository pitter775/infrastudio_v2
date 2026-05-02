'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { AtSign, Camera, Globe, LayoutGrid, Menu, Phone, Play, Sparkles, Store, Users, X } from 'lucide-react'

import { buildStoreAccentPalette } from '@/components/store/store-utils'

const socialIcons = {
  instagram: Camera,
  facebook: Users,
  youtube: Play,
  tiktok: Sparkles,
  x: AtSign,
}

const menuIconMap = {
  topo: Store,
  produtos: LayoutGrid,
  sobre: Sparkles,
  contato: Phone,
}

function resolveMenuHref(storeSlug, href, samePageNavigation) {
  if (!href || !href.startsWith('#')) {
    return href || `/loja/${storeSlug}`
  }

  if (samePageNavigation) {
    return href
  }

  return href === '#topo' ? `/loja/${storeSlug}` : `/loja/${storeSlug}${href}`
}

export function StoreHeader({ activeSection = 'topo', headerSolid, samePageNavigation = false, store }) {
  const palette = buildStoreAccentPalette(store.accentColor)
  const [scrollSolid, setScrollSolid] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const resolvedHeaderSolid = typeof headerSolid === 'boolean' ? headerSolid : scrollSolid

  useEffect(() => {
    if (typeof headerSolid === 'boolean') {
      return
    }

    function handleScroll() {
      setScrollSolid(window.scrollY > 18)
    }

    handleScroll()
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [headerSolid])

  function handleAnchorNavigation(event, href) {
    if (!samePageNavigation || !href || !href.startsWith('#')) {
      return
    }

    event.preventDefault()
    const target = document.querySelector(href)
    if (target instanceof HTMLElement) {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' })
    } else if (href === '#topo') {
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
    setMobileMenuOpen(false)
  }

  return (
    <header
      className={`fixed inset-x-0 top-0 z-40 transition-all duration-300 ${
        resolvedHeaderSolid
          ? 'bg-white/45 shadow-[0_16px_34px_-28px_rgba(15,23,42,0.2)] backdrop-blur-xl'
          : 'bg-transparent shadow-none'
      }`}
    >
      <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between gap-6 px-1 sm:px-0">
          <Link href={`/loja/${store.slug}`} className="flex items-center gap-5">
            <div
              className="flex h-12 w-12 items-center justify-center rounded-[14px] text-sm font-semibold text-white"
              style={{ backgroundColor: store.logoUrl ? undefined : store.accentColor }}
            >
              {store.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={store.logoUrl} alt={store.name} loading="lazy" decoding="async" className="h-20 w-20 max-w-none object-contain drop-shadow-[0_2px_12px_rgba(255,255,255,0.95)]" />
              ) : (
                store.name.slice(0, 2).toUpperCase()
              )}
            </div>
            <div>
              <div className="text-[1.02rem] font-semibold tracking-[-0.02em]" style={{ color: palette.accentDark, textShadow: '0 2px 10px rgba(255,255,255,0.78)' }}>{store.name}</div>
            </div>
          </Link>

          <nav className="hidden items-center gap-2 md:flex">
            {store.menuLinks.map((item) => {
              const sectionId = item.href.replace('#', '')
              const isActive = activeSection === sectionId || (item.href === '#topo' && activeSection === 'topo')
              const Icon = menuIconMap[sectionId] || Globe
              return (
                <a
                  key={`${item.label}-${item.href}`}
                  href={resolveMenuHref(store.slug, item.href, samePageNavigation)}
                  onClick={(event) => handleAnchorNavigation(event, item.href)}
                  className={`inline-flex items-center gap-2 rounded-[14px] px-4 py-2.5 text-[13px] font-semibold transition ${
                    isActive
                      ? 'text-white shadow-[0_14px_28px_-18px_rgba(15,23,42,0.28)]'
                      : 'text-[var(--store-text)] hover:bg-[var(--store-hover-bg)] hover:text-[var(--store-text)]'
                  }`}
                  style={
                    isActive
                      ? { backgroundColor: palette.accentDark, '--store-hover-bg': palette.accentBorder, '--store-text': palette.accentDark }
                      : { backgroundColor: 'transparent', '--store-hover-bg': palette.accentBorder, '--store-text': palette.accentDark }
                  }
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </a>
              )
            })}
          </nav>

          {store.menuLinks.length ? (
            <button
              type="button"
              onClick={() => setMobileMenuOpen((current) => !current)}
              className="inline-flex h-11 w-11 items-center justify-center rounded-[14px] bg-white/88 text-slate-900 shadow-[0_14px_28px_-22px_rgba(15,23,42,0.24)] md:hidden"
              aria-label={mobileMenuOpen ? 'Fechar menu' : 'Abrir menu'}
              aria-expanded={mobileMenuOpen}
            >
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          ) : null}
        </div>
      </div>
      {store.menuLinks.length && mobileMenuOpen ? (
        <div className="mx-auto max-w-7xl px-5 pb-4 sm:px-6 md:hidden lg:px-8">
          <div className="grid gap-2 rounded-[18px] border border-black/5 bg-white/94 p-2 shadow-[0_18px_42px_-28px_rgba(15,23,42,0.24)] backdrop-blur-xl">
            {store.menuLinks.map((item) => {
              const sectionId = item.href.replace('#', '')
              const isActive = activeSection === sectionId || (item.href === '#topo' && activeSection === 'topo')
              const Icon = menuIconMap[sectionId] || Globe
              return (
                <a
                  key={`${item.label}-${item.href}-mobile`}
                  href={resolveMenuHref(store.slug, item.href, samePageNavigation)}
                  onClick={(event) => handleAnchorNavigation(event, item.href)}
                  className={`inline-flex items-center gap-2 rounded-[14px] px-4 py-3 text-[12px] font-semibold uppercase tracking-[0.14em] transition-all ${
                    isActive
                      ? 'text-white shadow-[0_14px_28px_-18px_rgba(15,23,42,0.28)]'
                      : resolvedHeaderSolid
                        ? 'text-[var(--store-text)] shadow-[0_14px_28px_-24px_rgba(15,23,42,0.08)] hover:bg-[var(--store-hover-bg)]'
                        : 'text-[var(--store-text)] shadow-none hover:bg-[var(--store-hover-bg)]'
                  }`}
                  style={
                    isActive
                      ? { backgroundColor: palette.accentDark, '--store-hover-bg': palette.accentSoft, '--store-text': palette.accentDark }
                      : resolvedHeaderSolid
                        ? { backgroundColor: '#ffffff', '--store-hover-bg': palette.accentBorder, '--store-text': palette.accentDark }
                        : { backgroundColor: 'transparent', '--store-hover-bg': palette.accentBorder, '--store-text': palette.accentDark }
                  }
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </a>
              )
            })}
          </div>
        </div>
      ) : null}
    </header>
  )
}
