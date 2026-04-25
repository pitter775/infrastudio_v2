'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { AtSign, Camera, ChevronRight, Globe, LayoutGrid, MapPin, MessageCircle, Phone, Play, Search, ShieldCheck, Sparkles, Store, Users } from 'lucide-react'

import { StoreProductCard } from '@/components/store/store-product-card'
import { StoreProductSheet } from '@/components/store/store-product-sheet'
import { buildStoreUrl, formatStoreCurrency, getStoreProductImages, trackStoreEvent } from '@/components/store/store-utils'

export function MercadoLivreStorefront({
  store,
  featuredProducts,
  products,
  query,
  page,
  hasMore,
  categoryId = '',
  categoryLabel = '',
  sort = 'recent',
  categories = [],
}) {
  const [activeIndex, setActiveIndex] = useState(0)
  const [activeSlideImageState, setActiveSlideImageState] = useState({ slideId: null, index: 0 })
  const [sheetOpen, setSheetOpen] = useState(false)
  const [sheetLoading, setSheetLoading] = useState(false)
  const [sheetData, setSheetData] = useState(null)
  const [headerSolid, setHeaderSolid] = useState(false)
  const [activeSection, setActiveSection] = useState('topo')
  const slides = featuredProducts.length ? featuredProducts : products.slice(0, 4)
  const activeSlide = slides[activeIndex] || null
  const socialEntries = useMemo(
    () => Object.entries(store.socialLinks || {}).filter(([, value]) => Boolean(value)),
    [store.socialLinks],
  )
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
  const storeUrl = buildStoreUrl(store.slug, query, page, categoryId, sort)
  const activeSlideImages = getStoreProductImages(activeSlide)
  const activeSlideImageIndex = activeSlideImageState.slideId === activeSlide?.id ? activeSlideImageState.index : 0
  const hasCategoryContext = Boolean(categoryId && categoryLabel)
  const hasSearchContext = Boolean(query)
  const heroTitle = hasCategoryContext
    ? `${categoryLabel} com atendimento direto e compra segura`
    : hasSearchContext
      ? `Resultados para ${query}`
      : store.title
  const heroDescription = hasCategoryContext
    ? `Explore a selecao de ${categoryLabel} da ${store.name} com suporte direto da loja e compra final no Mercado Livre.`
    : hasSearchContext
      ? `Veja os produtos encontrados para ${query} na ${store.name} e continue o atendimento pelo chat quando precisar.`
      : store.headline
  const productsHeading = hasCategoryContext ? `${categoryLabel} da loja` : hasSearchContext ? 'Resultados da busca' : 'Produtos da loja'
  const productsEyebrow = hasCategoryContext ? 'Categoria' : hasSearchContext ? 'Busca' : 'Catalogo'

  useEffect(() => {
    if (slides.length <= 1) {
      return undefined
    }

    const interval = window.setInterval(() => {
      setActiveIndex((current) => (current + 1) % slides.length)
    }, 4200)

    return () => window.clearInterval(interval)
  }, [slides.length])

  useEffect(() => {
    function handleScroll() {
      setHeaderSolid(window.scrollY > 18)
    }

    handleScroll()
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  useEffect(() => {
    const sectionIds = ['topo', 'produtos', 'sobre', 'contato']

    function updateActiveSection() {
      const viewportAnchor = window.innerHeight * 0.24
      let nextSection = 'topo'

      for (const sectionId of sectionIds.slice(1)) {
        const section = document.getElementById(sectionId)
        if (!section) continue
        const rect = section.getBoundingClientRect()
        if (rect.top - viewportAnchor <= 0) {
          nextSection = sectionId
        }
      }

      setActiveSection(nextSection)
    }

    updateActiveSection()
    window.addEventListener('scroll', updateActiveSection, { passive: true })
    window.addEventListener('resize', updateActiveSection)
    return () => {
      window.removeEventListener('scroll', updateActiveSection)
      window.removeEventListener('resize', updateActiveSection)
    }
  }, [])

  useEffect(() => {
    function handlePopState() {
      const pathname = window.location.pathname
      if (pathname === storeUrl.split('?')[0] || pathname === `/loja/${store.slug}`) {
        setSheetOpen(false)
        setSheetData(null)
      }
    }

    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [store.slug, storeUrl])

  async function handleOpenSheet(productSlug) {
    setSheetLoading(true)
    setSheetOpen(true)

    try {
      const response = await fetch(`/api/loja/${store.slug}/produto/${productSlug}`, {
        cache: 'no-store',
      })
      const data = await response.json().catch(() => ({}))

      if (!response.ok) {
        setSheetData(null)
        setSheetOpen(false)
        window.location.href = `/loja/${store.slug}/produto/${productSlug}`
        return
      }

      setSheetData(data)
      window.history.pushState({ lojaSheet: true }, '', `/loja/${store.slug}/produto/${productSlug}`)
    } catch {
      setSheetData(null)
      setSheetOpen(false)
      window.location.href = `/loja/${store.slug}/produto/${productSlug}`
    } finally {
      setSheetLoading(false)
    }
  }

  function handleCloseSheet() {
    setSheetOpen(false)
    setSheetData(null)
    window.history.replaceState(window.history.state, '', storeUrl)
  }

  function handleAnchorNavigation(event, href) {
    if (!href || !href.startsWith('#')) {
      return
    }

    event.preventDefault()
    setActiveSection(href.replace('#', '') || 'topo')
    const target = document.querySelector(href)
    if (target instanceof HTMLElement) {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' })
    } else if (href === '#topo') {
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }

  function goToPreviousFeaturedImage() {
    if (!activeSlideImages.length) {
      return
    }
    setActiveSlideImageState({
      slideId: activeSlide?.id ?? null,
      index: (activeSlideImageIndex - 1 + activeSlideImages.length) % activeSlideImages.length,
    })
  }

  function goToNextFeaturedImage() {
    if (!activeSlideImages.length) {
      return
    }
    setActiveSlideImageState({
      slideId: activeSlide?.id ?? null,
      index: (activeSlideImageIndex + 1) % activeSlideImages.length,
    })
  }

  return (
    <>
      <style jsx global>{`
        html {
          scrollbar-color: #cbd5e1 #f8fafc;
        }

        body::-webkit-scrollbar {
          width: 12px;
        }

        body::-webkit-scrollbar-track {
          background: #f8fafc;
        }

        body::-webkit-scrollbar-thumb {
          background: #cbd5e1;
          border: 3px solid #f8fafc;
          border-radius: 999px;
        }

        body::-webkit-scrollbar-thumb:hover {
          background: #94a3b8;
        }
      `}</style>
      <div
        className="min-h-screen scroll-smooth bg-[#f7f4ee] text-slate-900"
        style={{ fontFamily: 'Inter, ui-sans-serif, system-ui, sans-serif' }}
      >
        <header
          className={`fixed inset-x-0 top-0 z-40 transition-all duration-300 ${
            headerSolid
              ? 'bg-[rgba(247,244,238,0.86)] shadow-[0_16px_34px_-28px_rgba(15,23,42,0.16)] backdrop-blur-xl'
              : 'bg-transparent shadow-none'
          }`}
        >
          <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between gap-6 px-1 sm:px-0">
              <Link href={`/loja/${store.slug}`} className="flex items-center gap-3">
                <div
                  className="flex h-12 w-12 items-center justify-center rounded-[14px] text-sm font-semibold text-white shadow-[0_16px_30px_-20px_rgba(15,23,42,0.24)]"
                  style={{ backgroundColor: store.accentColor }}
                >
                  {store.logoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={store.logoUrl} alt={store.name} loading="lazy" decoding="async" className="h-full w-full rounded-[14px] object-cover" />
                  ) : (
                    store.name.slice(0, 2).toUpperCase()
                  )}
                </div>
                <div>
                  <div className="text-[11px] uppercase tracking-[0.22em] text-slate-500">Loja Mercado Livre</div>
                  <div className="text-[1.02rem] font-semibold tracking-[-0.02em]">{store.name}</div>
                </div>
              </Link>

              <nav className="hidden items-center gap-2 md:flex">
                {store.menuLinks.map((item) => (
                  <a
                    key={`${item.label}-${item.href}`}
                    href={item.href}
                    onClick={(event) => handleAnchorNavigation(event, item.href)}
                    className={`inline-flex items-center gap-2 rounded-[14px] px-4 py-2.5 text-[13px] font-semibold transition ${
                      activeSection === item.href.replace('#', '') || (item.href === '#topo' && activeSection === 'topo')
                        ? 'bg-[#155eef] text-white shadow-[0_14px_28px_-18px_rgba(21,94,239,0.5)]'
                        : 'border border-transparent text-slate-600 hover:border-slate-200 hover:bg-white/72 hover:text-slate-950'
                    }`}
                  >
                    {(() => {
                      const Icon = menuIconMap[item.href.replace('#', '')] || Globe
                      return <Icon className="h-4 w-4" />
                    })()}
                    {item.label}
                  </a>
                ))}
              </nav>
            </div>
          </div>
          {store.menuLinks.length ? (
            <div className="mx-auto max-w-7xl px-4 pb-3 sm:px-6 md:hidden lg:px-8">
              <div className="flex gap-2 overflow-x-auto [&::-webkit-scrollbar]:hidden">
                {store.menuLinks.map((item) => (
                  <a
                    key={`${item.label}-${item.href}-mobile`}
                    href={item.href}
                    onClick={(event) => handleAnchorNavigation(event, item.href)}
                    className={`shrink-0 rounded-[14px] px-4 py-2.5 text-[11px] font-semibold uppercase tracking-[0.16em] transition-all ${
                      activeSection === item.href.replace('#', '') || (item.href === '#topo' && activeSection === 'topo')
                        ? 'bg-[#155eef] text-white shadow-[0_14px_28px_-18px_rgba(21,94,239,0.5)]'
                        : headerSolid
                          ? 'bg-white/72 text-slate-700 shadow-[0_14px_28px_-24px_rgba(15,23,42,0.12)] backdrop-blur-xl'
                          : 'bg-transparent text-slate-700 shadow-none'
                    }`}
                  >
                    {item.label}
                  </a>
                ))}
              </div>
            </div>
          ) : null}
        </header>

        <main className="pt-[112px] md:pt-[108px]">
          <section id="topo" className="relative overflow-hidden">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(21,94,239,0.1),transparent_30%),linear-gradient(180deg,rgba(255,255,255,0.72),rgba(247,244,238,0.42))]" />
            <div className="relative mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:px-6 lg:grid-cols-[1.05fr_0.95fr] lg:px-8 lg:py-20">
              <motion.div
                initial={{ opacity: 0, y: 22 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.25 }}
                transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                className="max-w-2xl"
              >
                <div className="inline-flex items-center gap-2 rounded-full border border-primary/10 bg-primary/5 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-[#155eef]">
                  {hasCategoryContext ? `Categoria ${categoryLabel}` : hasSearchContext ? 'Busca ativa' : 'Vitrine conectada'}
                  <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: store.accentColor }} />
                </div>
                <h1 className="mt-5 max-w-xl text-4xl font-semibold leading-[0.95] tracking-[-0.04em] text-slate-950 sm:text-6xl">
                  {heroTitle}
                </h1>
                <p className="mt-5 max-w-xl text-base leading-7 text-slate-600 sm:text-lg sm:leading-8">{heroDescription}</p>

                <div className="mt-8 flex flex-wrap gap-3">
                  <a
                    href="#produtos"
                    onClick={(event) => handleAnchorNavigation(event, '#produtos')}
                    className="inline-flex h-12 items-center justify-center rounded-xl px-5 text-sm font-semibold text-white shadow-[0_20px_34px_-24px_rgba(21,94,239,0.32)]"
                    style={{ backgroundColor: store.accentColor }}
                  >
                    Ver produtos
                    <ChevronRight className="ml-2 h-4 w-4" />
                  </a>
                  {store.contactWhatsApp ? (
                    <a
                      href={`https://wa.me/${String(store.contactWhatsApp).replace(/\D/g, '')}`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex h-12 items-center justify-center rounded-xl border border-slate-200 bg-white px-5 text-sm font-semibold text-slate-900"
                    >
                      <MessageCircle className="mr-2 h-4 w-4" />
                      Falar no WhatsApp
                    </a>
                  ) : null}
                </div>

                <div className="mt-8 flex flex-wrap gap-4 text-sm text-slate-600">
                  {store.contactPhone ? (
                    <div className="inline-flex items-center gap-2 rounded-full border border-black/10 bg-white/70 px-3 py-2">
                      <Phone className="h-4 w-4" />
                      {store.contactPhone}
                    </div>
                  ) : null}
                  {store.contactAddress ? (
                    <div className="inline-flex items-center gap-2 rounded-full border border-black/10 bg-white/70 px-3 py-2">
                      <MapPin className="h-4 w-4" />
                      {store.contactAddress}
                    </div>
                  ) : null}
                </div>

              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 26 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.2 }}
                transition={{ duration: 0.52, ease: [0.22, 1, 0.36, 1], delay: 0.05 }}
                className="grid gap-4"
              >
                <div className="rounded-[24px] p-4">
                  {activeSlide ? (
                    <button
                      type="button"
                      onClick={() => {
                        trackStoreEvent({
                          storeSlug: store.slug,
                          type: 'product_open',
                          source: 'featured',
                          product: activeSlide,
                          dedupeKey: `${store.slug}:product_open:featured:${activeSlide.slug}`,
                        })
                        handleOpenSheet(activeSlide.slug)
                      }}
                      className="relative grid w-full text-left"
                    >
                      <div className="relative aspect-[4/3] overflow-hidden rounded-[24px] bg-[#e8edf4] shadow-[0_28px_60px_-40px_rgba(15,23,42,0.18)]">
                        {activeSlideImages[activeSlideImageIndex] ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={activeSlideImages[activeSlideImageIndex]}
                            alt={activeSlide.title}
                            loading="lazy"
                            decoding="async"
                            className="h-full w-full object-cover"
                          />
                        ) : null}
                        {activeSlideImages.length > 1 ? (
                          <>
                            <button
                              type="button"
                              onClick={(event) => {
                                event.preventDefault()
                                event.stopPropagation()
                                goToPreviousFeaturedImage()
                              }}
                              className="absolute left-3 top-1/2 inline-flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/94 text-slate-900 shadow-[0_16px_32px_-20px_rgba(15,23,42,0.24)] transition hover:scale-105"
                              aria-label="Imagem anterior"
                            >
                              <ChevronRight className="h-4 w-4 rotate-180" />
                            </button>
                            <button
                              type="button"
                              onClick={(event) => {
                                event.preventDefault()
                                event.stopPropagation()
                                goToNextFeaturedImage()
                              }}
                              className="absolute right-3 top-1/2 inline-flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/94 text-slate-900 shadow-[0_16px_32px_-20px_rgba(15,23,42,0.24)] transition hover:scale-105"
                              aria-label="Proxima imagem"
                            >
                              <ChevronRight className="h-4 w-4" />
                            </button>
                          </>
                        ) : null}
                        <div className="absolute inset-x-0 bottom-0 p-4 sm:p-5">
                          <div className="rounded-[22px] border border-white/80 bg-white/96 p-5 shadow-[0_28px_50px_-34px_rgba(15,23,42,0.22)] backdrop-blur">
                            <div className="flex items-start justify-between gap-4">
                              <div className="min-w-0">
                                <div className="text-[11px] font-semibold uppercase tracking-[0.24em]" style={{ color: store.accentColor }}>
                                  Em destaque
                                </div>
                                <div className="mt-2 line-clamp-2 text-xl font-semibold leading-tight text-slate-950">
                                  {activeSlide.title}
                                </div>
                              </div>
                              <div className="shrink-0 text-right">
                                <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Preco</div>
                                <div className="mt-2 text-lg font-semibold text-slate-950">
                                  {formatStoreCurrency(activeSlide.price, activeSlide.currencyId)}
                                </div>
                              </div>
                            </div>
                            <div className="mt-4 flex items-center justify-between gap-4">
                              <div className="flex items-center gap-2">
                                {activeSlideImages.length > 1
                                  ? activeSlideImages.map((image, index) => (
                                      <span
                                        key={`${image}-${index}`}
                                        className={`h-2.5 rounded-full transition-all ${
                                          index === activeSlideImageIndex ? 'w-7 bg-blue-600' : 'w-2.5 bg-slate-300'
                                        }`}
                                      />
                                    ))
                                  : slides.map((item, index) => (
                                      <span
                                        key={`${item.id}-${index}`}
                                        className={`h-2.5 rounded-full transition-all ${
                                          index === activeIndex ? 'w-7 bg-blue-600' : 'w-2.5 bg-slate-300'
                                        }`}
                                      />
                                    ))}
                              </div>
                              <span className="inline-flex items-center gap-1 rounded-xl bg-slate-950 px-3 py-1.5 text-xs font-semibold text-white">
                                Ver produto
                                <ChevronRight className="h-3.5 w-3.5" />
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </button>
                  ) : (
                    <div className="rounded-[18px] border border-dashed border-slate-200 px-6 py-12 text-center text-sm text-slate-500">
                      Escolha produtos em destaque na aba Loja do Mercado Livre.
                    </div>
                  )}
                </div>
              </motion.div>
            </div>
          </section>

          <section id="produtos" className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
            <div className="flex flex-col gap-6">
              <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-[0.18em] text-[#155eef]">{productsEyebrow}</div>
                  <h2 className="mt-2 text-3xl font-semibold text-slate-950">{productsHeading}</h2>
                </div>

                <form action={`/loja/${store.slug}`} method="get" className="flex w-full max-w-3xl flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-2 shadow-[0_18px_36px_-32px_rgba(15,23,42,0.18)] md:flex-row md:items-center">
                  <div className="flex min-w-0 flex-1 items-center gap-3 px-3">
                    <Search className="h-4 w-4 text-slate-400" />
                    <input
                      name="q"
                      defaultValue={query}
                      placeholder="Buscar produto na loja"
                      className="h-11 min-w-0 flex-1 bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400"
                    />
                  </div>
                  <select
                    name="sort"
                    defaultValue={sort}
                    className="h-11 rounded-xl border border-slate-200 bg-[#faf7f0] px-4 text-sm text-slate-900 outline-none"
                  >
                    <option value="recent">Mais recentes</option>
                    <option value="price_asc">Menor preco</option>
                    <option value="price_desc">Maior preco</option>
                    <option value="title">Nome</option>
                  </select>
                  {categoryId ? <input type="hidden" name="cat" value={categoryId} /> : null}
                  <button
                    type="submit"
                    className="inline-flex h-11 items-center justify-center rounded-xl px-5 text-sm font-semibold text-white shadow-[0_18px_30px_-22px_rgba(21,94,239,0.3)]"
                    style={{ backgroundColor: store.accentColor }}
                  >
                    Buscar
                  </button>
                </form>
              </div>

              {categories.length ? (
                <div className="flex flex-wrap gap-3">
                  <Link
                    href={buildStoreUrl(store.slug, query, 1, '', sort)}
                    className={`rounded-xl border px-4 py-2 text-sm font-medium ${
                      !categoryId ? 'border-slate-900 bg-slate-900 text-white' : 'border-black/10 bg-white text-slate-700'
                    }`}
                  >
                    Todas
                  </Link>
                  {categories.map((category) => (
                    <Link
                      key={category.id}
                      href={buildStoreUrl(store.slug, query, 1, category.id, sort)}
                      className={`rounded-xl border px-4 py-2 text-sm font-medium ${
                        categoryId === category.id ? 'border-slate-900 bg-slate-900 text-white' : 'border-black/10 bg-white text-slate-700'
                      }`}
                    >
                      {category.label}
                    </Link>
                  ))}
                </div>
              ) : null}
            </div>

            {products.length ? (
              <div className="mt-8 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
                {products.map((product) => (
                  <StoreProductCard
                    key={product.id}
                    storeSlug={store.slug}
                    product={product}
                    accentColor={store.accentColor}
                    onOpenSheet={handleOpenSheet}
                    analyticsSource="catalog_grid"
                  />
                ))}
              </div>
            ) : (
              <div className="mt-8 rounded-[24px] border border-dashed border-black/10 bg-white/90 px-6 py-14 text-center shadow-[0_18px_40px_-38px_rgba(15,23,42,0.16)]">
                <div className="text-lg font-semibold text-slate-950">Nenhum produto encontrado</div>
                <div className="mx-auto mt-3 max-w-xl text-sm leading-7 text-slate-600">
                  Ajuste a busca ou os filtros para encontrar outros itens da loja.
                </div>
              </div>
            )}

            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-sm text-slate-500">Pagina {page}</div>
              <div className="flex w-full gap-3 sm:w-auto">
                {page > 1 ? (
                  <Link
                    href={buildStoreUrl(store.slug, query, page - 1, categoryId, sort)}
                    className="inline-flex h-11 flex-1 items-center justify-center rounded-xl border border-black/10 bg-white px-5 text-sm font-semibold text-slate-900 shadow-[0_14px_30px_-28px_rgba(15,23,42,0.18)] sm:flex-none"
                  >
                    Anterior
                  </Link>
                ) : null}
                {hasMore ? (
                  <Link
                    href={buildStoreUrl(store.slug, query, page + 1, categoryId, sort)}
                    className="inline-flex h-11 flex-1 items-center justify-center rounded-xl px-5 text-sm font-semibold text-white shadow-[0_18px_30px_-22px_rgba(21,94,239,0.3)] sm:flex-none"
                    style={{ backgroundColor: store.accentColor }}
                  >
                    Proxima
                  </Link>
                ) : null}
              </div>
            </div>
          </section>

          <section id="sobre" className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
            <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
              <div className="rounded-[24px] border border-slate-200 bg-white p-8 shadow-[0_20px_46px_-38px_rgba(15,23,42,0.16)]">
                <div className="text-xs uppercase tracking-[0.22em] text-slate-500">Sobre nos</div>
                <div className="mt-4 text-lg leading-8 text-slate-700">{store.about}</div>
              </div>
              <div id="contato" className="rounded-[24px] border border-slate-200 bg-white p-8 shadow-[0_20px_46px_-38px_rgba(15,23,42,0.16)]">
                <div className="text-xs uppercase tracking-[0.22em] text-slate-500">Contato</div>
                <div className="mt-4 grid gap-4 text-sm text-slate-700">
                  {store.contactEmail ? <div className="inline-flex items-center gap-3"><AtSign className="h-4 w-4 text-slate-500" />{store.contactEmail}</div> : null}
                  {store.contactPhone ? <div className="inline-flex items-center gap-3"><Phone className="h-4 w-4 text-slate-500" />{store.contactPhone}</div> : null}
                  {store.contactWhatsApp ? <div className="inline-flex items-center gap-3"><MessageCircle className="h-4 w-4 text-slate-500" />{store.contactWhatsApp}</div> : null}
                  {store.contactAddress ? <div className="inline-flex items-center gap-3"><MapPin className="h-4 w-4 text-slate-500" />{store.contactAddress}</div> : null}
                </div>

                <div className="mt-6 flex flex-wrap gap-3">
                  {socialEntries.map(([key, value]) => (
                    <a key={key} href={value} target="_blank" rel="noreferrer" className="inline-flex h-11 items-center gap-2 rounded-xl border border-black/10 bg-[#faf7f0] px-4 text-sm font-medium capitalize text-slate-900 transition hover:-translate-y-0.5 hover:bg-white">
                      {(() => {
                        const Icon = socialIcons[key] || Globe
                        return <Icon className="h-4 w-4" />
                      })()}
                      {key}
                    </a>
                  ))}
                </div>
              </div>
            </div>
          </section>
        </main>

        <footer className="mt-16 border-t border-black/5 bg-white">
          <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:px-6 lg:grid-cols-[1fr_auto] lg:px-8">
            <div>
              <div className="text-lg font-semibold text-slate-950">{store.name}</div>
              <div className="mt-3 max-w-2xl text-sm leading-7 text-slate-600">{store.footerText}</div>
              <a
                href="https://www.infrastudio.pro"
                target="_blank"
                rel="noreferrer"
                className="mt-6 inline-flex items-center transition hover:opacity-100"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/infra.png" alt="InfraStudio" loading="lazy" decoding="async" className="h-7 w-auto opacity-80" />
              </a>
            </div>
            <div className="flex flex-wrap gap-3">
              {store.menuLinks.map((item) => (
                <a
                  key={`${item.label}-${item.href}-footer`}
                  href={item.href}
                  onClick={(event) => handleAnchorNavigation(event, item.href)}
                  className="text-sm text-slate-500 transition hover:text-slate-950"
                >
                  {item.label}
                </a>
              ))}
            </div>
          </div>
        </footer>
      </div>

      <StoreProductSheet
        store={store}
        open={sheetOpen}
        loading={sheetLoading}
        data={sheetData}
        onClose={handleCloseSheet}
        onOpenProduct={handleOpenSheet}
      />
    </>
  )
}

