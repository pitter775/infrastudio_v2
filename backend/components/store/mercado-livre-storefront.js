'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { ArrowRight, AtSign, Camera, ChevronLeft, ChevronRight, Globe, LayoutGrid, MapPin, MessageCircle, Phone, Play, Search, Sparkles, Store, Tag, Users } from 'lucide-react'

import { StoreHeader } from '@/components/store/store-header'
import { StoreProductCard } from '@/components/store/store-product-card'
import { AppSelect } from '@/components/ui/app-select'
import { buildStoreAccentPalette, buildStoreUrl, formatStoreCurrency, getStoreProductImages, trackStoreEvent } from '@/components/store/store-utils'

function shouldHideCategoryCode(label) {
  return /^MLB\d+$/i.test(String(label || '').trim())
}

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
  const router = useRouter()
  const [activeIndex, setActiveIndex] = useState(0)
  const [activeSlideImageState, setActiveSlideImageState] = useState({ slideId: null, index: 0 })
  const [headerSolid, setHeaderSolid] = useState(false)
  const [activeSection, setActiveSection] = useState('topo')
  const [searchTerm, setSearchTerm] = useState(query)
  const [sortValue, setSortValue] = useState(sort)
  const slides = featuredProducts.length ? featuredProducts : products.slice(0, 4)
  const activeSlide = slides[activeIndex] || null
  const palette = useMemo(() => buildStoreAccentPalette(store.accentColor), [store.accentColor])
  const socialEntries = useMemo(
    () => Object.entries(store.socialLinks || {}).filter(([, value]) => Boolean(value)),
    [store.socialLinks],
  )
  const visibleCategories = useMemo(
    () => categories.filter((category) => category?.id && !shouldHideCategoryCode(category.label)),
    [categories],
  )
  const categoryOptions = useMemo(
    () => [{ value: '', label: 'Todas categorias' }, ...visibleCategories.map((category) => ({ value: category.id, label: category.label }))],
    [visibleCategories],
  )
  const sortOptions = useMemo(
    () => [
      { value: 'recent', label: 'Mais recentes' },
      { value: 'price_asc', label: 'Menor preco' },
      { value: 'price_desc', label: 'Maior preco' },
      { value: 'title', label: 'Nome' },
    ],
    [],
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
    setSearchTerm(query)
  }, [query])

  useEffect(() => {
    setSortValue(sort)
  }, [sort])

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

  function navigateStore(nextQuery = searchTerm, nextCategoryId = categoryId, nextSort = sortValue, nextPage = 1) {
    router.push(buildStoreUrl(store.slug, nextQuery, nextPage, nextCategoryId, nextSort), { scroll: false })
  }

  function handleSearchSubmit(event) {
    event.preventDefault()
    navigateStore(searchTerm, categoryId, sortValue, 1)
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

  function goToPreviousSlide(event) {
    event?.preventDefault?.()
    event?.stopPropagation?.()
    if (!slides.length) return
    setActiveIndex((current) => (current - 1 + slides.length) % slides.length)
    setActiveSlideImageState({ slideId: null, index: 0 })
  }

  function goToNextSlide(event) {
    event?.preventDefault?.()
    event?.stopPropagation?.()
    if (!slides.length) return
    setActiveIndex((current) => (current + 1) % slides.length)
    setActiveSlideImageState({ slideId: null, index: 0 })
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
        <StoreHeader store={store} activeSection={activeSection} headerSolid={headerSolid} samePageNavigation />

        <main>
          <section id="topo" className="relative -mt-[112px] overflow-hidden pt-[136px] md:-mt-[108px] md:pt-[132px]">
            <div
              className="absolute inset-0"
              style={{
                background: `radial-gradient(circle at top left, ${palette.accentMuted}, transparent 30%), linear-gradient(180deg, rgba(255,255,255,0.72), rgba(247,244,238,0.42))`,
              }}
            />
            <div className="relative mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:px-6 lg:grid-cols-[1.05fr_0.95fr] lg:px-8 lg:py-20">
              <motion.div
                initial={{ opacity: 0, y: 22 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.25 }}
                transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                className="max-w-2xl"
              >
                <div
                  className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em]"
                  style={{ backgroundColor: palette.accentSoft, color: palette.accentDark }}
                >
                  {hasCategoryContext ? `Categoria ${categoryLabel}` : hasSearchContext ? 'Busca ativa' : 'Vitrine conectada'}
                  <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: palette.accent }} />
                </div>
                <h1 className="mt-5 max-w-xl text-4xl font-semibold leading-[0.95] tracking-[-0.04em] text-slate-950 sm:text-6xl">
                  {heroTitle}
                </h1>
                <p className="mt-5 max-w-xl text-base leading-7 text-slate-600 sm:text-lg sm:leading-8">{heroDescription}</p>

                <div className="mt-8 flex flex-wrap gap-3">
                  <a
                    href="#produtos"
                    onClick={(event) => handleAnchorNavigation(event, '#produtos')}
                    className="inline-flex h-12 items-center justify-center rounded-xl px-5 text-sm font-semibold text-white shadow-[0_18px_28px_-20px_rgba(15,23,42,0.34)] backdrop-blur-md"
                    style={{ backgroundColor: `${palette.accentDark}e6` }}
                  >
                    <LayoutGrid className="mr-2 h-4 w-4" />
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
                <div className="p-2">
                  {activeSlide ? (
                    <Link
                      href={`/loja/${store.slug}/produto/${activeSlide.slug}`}
                      onClick={() => {
                        trackStoreEvent({
                          storeSlug: store.slug,
                          type: 'product_open',
                          source: 'featured',
                          product: activeSlide,
                          dedupeKey: `${store.slug}:product_open:featured:${activeSlide.slug}`,
                        })
                      }}
                      className="grid w-full gap-4 text-left"
                    >
                      <div className="relative aspect-[4/3] overflow-hidden rounded-[12px] bg-[#e8edf4] shadow-[8px_10px_18px_rgba(15,23,42,0.18)]">
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
                      </div>
                      <div className="rounded-[14px] px-1 py-1">
                        <div className="mb-4 flex items-center justify-between gap-3">
                          <div className="flex items-center gap-2">
                            {slides.map((item, index) => (
                              <button
                                key={`${item.id}-slide-${index}`}
                                type="button"
                                onClick={(event) => {
                                  event.preventDefault()
                                  event.stopPropagation()
                                  setActiveIndex(index)
                                  setActiveSlideImageState({ slideId: null, index: 0 })
                                }}
                                className="h-2.5 rounded-full transition-all"
                                style={{
                                  width: index === activeIndex ? 28 : 10,
                                  backgroundColor: index === activeIndex ? palette.accentDark : '#cbd5e1',
                                }}
                                aria-label={`Ver destaque ${index + 1}`}
                              />
                            ))}
                          </div>
                          {slides.length > 1 ? (
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={goToPreviousSlide}
                                className="inline-flex h-9 w-9 items-center justify-center rounded-[12px] bg-white text-slate-900 shadow-[0_8px_18px_-12px_rgba(15,23,42,0.28)] transition hover:-translate-y-0.5"
                                aria-label="Destaque anterior"
                              >
                                <ChevronLeft className="h-4 w-4" />
                              </button>
                              <button
                                type="button"
                                onClick={goToNextSlide}
                                className="inline-flex h-9 w-9 items-center justify-center rounded-[12px] bg-white text-slate-900 shadow-[0_8px_18px_-12px_rgba(15,23,42,0.28)] transition hover:-translate-y-0.5"
                                aria-label="Proximo destaque"
                              >
                                <ChevronRight className="h-4 w-4" />
                              </button>
                            </div>
                          ) : null}
                        </div>
                        <div className="flex items-start justify-between gap-4">
                          <div className="min-w-0">
                            <div className="text-[11px] font-semibold uppercase tracking-[0.24em]" style={{ color: palette.accentDark }}>
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
                                    className="h-2.5 rounded-full transition-all"
                                    style={{
                                      width: index === activeSlideImageIndex ? 28 : 10,
                                      backgroundColor: index === activeSlideImageIndex ? palette.accentDark : '#cbd5e1',
                                    }}
                                  />
                                ))
                              : null}
                          </div>
                          <span className="inline-flex items-center gap-1 rounded-xl px-3 py-1.5 text-xs font-semibold text-white" style={{ backgroundColor: palette.accentDark }}>
                            Ver produto
                            <ChevronRight className="h-3.5 w-3.5" />
                          </span>
                        </div>
                      </div>
                    </Link>
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
                  <div className="text-xs font-semibold uppercase tracking-[0.18em]" style={{ color: palette.accentDark }}>{productsEyebrow}</div>
                  <h2 className="mt-2 text-3xl font-semibold text-slate-950">{productsHeading}</h2>
                </div>

                <form onSubmit={handleSearchSubmit} className="flex w-full max-w-3xl flex-col gap-3 rounded-2xl p-2 shadow-[0_18px_36px_-32px_rgba(15,23,42,0.12)] md:flex-row md:items-center">
                  <div className="flex min-w-0 flex-1 items-center gap-3 px-3">
                    <Search className="h-4 w-4 text-slate-400" />
                    <input
                      value={searchTerm}
                      onChange={(event) => setSearchTerm(event.target.value)}
                      placeholder="Buscar produto na loja"
                      className="h-11 min-w-0 flex-1 bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400"
                    />
                  </div>
                  {categoryOptions.length > 1 ? (
                    <div className="min-w-[220px]">
                      <AppSelect
                        options={categoryOptions}
                        value={categoryId}
                        onChangeValue={(value) => navigateStore(searchTerm, value || '', sortValue, 1)}
                        placeholder="Categoria"
                        minHeight={44}
                        tone="light"
                        accentColor={palette.accent}
                      />
                    </div>
                  ) : null}
                  <div className="min-w-[220px]">
                    <AppSelect
                      options={sortOptions}
                      value={sortValue}
                      onChangeValue={(value) => {
                        const nextValue = value || 'recent'
                        setSortValue(nextValue)
                        navigateStore(searchTerm, categoryId, nextValue, 1)
                      }}
                      placeholder="Ordenar"
                      minHeight={44}
                      tone="light"
                      accentColor={palette.accent}
                    />
                  </div>
                  <button
                    type="submit"
                    className="inline-flex h-11 items-center justify-center rounded-xl px-5 text-sm font-semibold text-white shadow-[0_18px_30px_-22px_rgba(15,23,42,0.24)]"
                    style={{ backgroundColor: palette.accentDark }}
                  >
                    <Search className="mr-2 h-4 w-4" />
                    Buscar
                  </button>
                </form>
              </div>

              {categoryId && categoryLabel ? (
                <div className="inline-flex w-fit items-center gap-2 rounded-xl bg-white px-4 py-2 text-sm text-slate-700 shadow-[0_10px_20px_-16px_rgba(15,23,42,0.2)]">
                  <Tag className="h-4 w-4" style={{ color: palette.accentDark }} />
                  {categoryLabel}
                </div>
              ) : null}
            </div>

            {products.length ? (
              <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {products.map((product) => (
                  <StoreProductCard
                    key={product.id}
                    storeSlug={store.slug}
                    product={product}
                    accentColor={store.accentColor}
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
                  <button
                    type="button"
                    onClick={() => navigateStore(searchTerm, categoryId, sortValue, page - 1)}
                    className="inline-flex h-11 flex-1 items-center justify-center rounded-xl bg-white px-5 text-sm font-semibold text-slate-900 shadow-[0_14px_30px_-28px_rgba(15,23,42,0.18)] sm:flex-none"
                  >
                    <ChevronLeft className="mr-2 h-4 w-4" />
                    Anterior
                  </button>
                ) : null}
                {hasMore ? (
                  <button
                    type="button"
                    onClick={() => navigateStore(searchTerm, categoryId, sortValue, page + 1)}
                    className="inline-flex h-11 flex-1 items-center justify-center rounded-xl px-5 text-sm font-semibold text-white shadow-[0_18px_30px_-22px_rgba(15,23,42,0.24)] sm:flex-none"
                    style={{ backgroundColor: palette.accentDark }}
                  >
                    Proxima
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </button>
                ) : null}
              </div>
            </div>
          </section>

          <section id="sobre" className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
            <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
              <div className="rounded-[24px] bg-white p-8 shadow-[0_20px_46px_-38px_rgba(15,23,42,0.16)]">
                <div className="text-xs uppercase tracking-[0.22em] text-slate-500">Sobre nos</div>
                <div className="mt-4 text-lg leading-8 text-slate-700">{store.about}</div>
              </div>
              <div id="contato" className="rounded-[24px] bg-white p-8 shadow-[0_20px_46px_-38px_rgba(15,23,42,0.16)]">
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

        <footer className="mt-16" style={{ backgroundColor: palette.accentSoft }}>
          <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:px-6 lg:grid-cols-[1fr_auto] lg:px-8">
            <div>
              <div className="text-lg font-semibold text-slate-950">{store.name}</div>
              <div className="mt-3 max-w-2xl text-sm leading-7 text-slate-600">{store.footerText}</div>
              <a
                href="https://www.infrastudio.pro"
                target="_blank"
                rel="noreferrer"
                className="mt-6 inline-flex flex-col items-start transition hover:opacity-100"
              >
                <span className="text-base font-semibold tracking-[-0.02em] text-slate-950">InfraStudio</span>
                <span className="text-xs uppercase tracking-[0.18em] text-slate-500">Sistema e automacao com IA</span>
              </a>
            </div>
            <div className="flex flex-wrap gap-3">
              {store.menuLinks.map((item) => (
                <a
                  key={`${item.label}-${item.href}-footer`}
                  href={item.href}
                  onClick={(event) => handleAnchorNavigation(event, item.href)}
                  className="inline-flex items-center gap-2 text-sm text-slate-500 transition hover:text-slate-950"
                >
                  {(() => {
                    const sectionId = item.href.replace('#', '')
                    const Icon = menuIconMap[sectionId] || Globe
                    return <Icon className="h-4 w-4" />
                  })()}
                  {item.label}
                </a>
              ))}
            </div>
          </div>
        </footer>
      </div>

    </>
  )
}

