'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useRef, useState } from 'react'
import { AtSign, Camera, ChevronLeft, ChevronRight, Filter, Globe, LayoutGrid, Loader2, MapPin, MessageCircle, Phone, Play, Search, Sparkles, Store, Tag, Users } from 'lucide-react'

import { StoreHeader } from '@/components/store/store-header'
import { StoreProductCard } from '@/components/store/store-product-card'
import { AppSelect } from '@/components/ui/app-select'
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet'
import { buildStoreAccentPalette, buildStoreUrl } from '@/components/store/store-utils'

function shouldHideCategoryCode(label) {
  return /^MLB\d+$/i.test(String(label || '').trim())
}

function ProductRow({ accentColor, analyticsSource, products, storeSlug, title }) {
  const rowRef = useRef(null)
  const palette = buildStoreAccentPalette(accentColor)

  if (!products.length) {
    return null
  }

  function scrollNext() {
    const row = rowRef.current
    if (!row) {
      return
    }

    row.scrollBy({
      left: Math.max(260, row.clientWidth * 0.86),
      behavior: 'smooth',
    })
  }

  function scrollPrevious() {
    const row = rowRef.current
    if (!row) {
      return
    }

    row.scrollBy({
      left: -Math.max(260, row.clientWidth * 0.86),
      behavior: 'smooth',
    })
  }

  return (
    <section className="mt-[30px]">
      <div className="mb-3 flex items-baseline gap-2.5">
        <h2 className="text-[20px] font-normal leading-tight text-slate-700">{title}</h2>
      </div>
      <div className="relative">
        <button
          type="button"
          onClick={scrollPrevious}
          className="absolute bottom-4 left-[-18px] top-4 z-20 hidden w-[58px] items-center justify-start lg:flex"
          aria-label={`Voltar ${title}`}
        >
          <span
            className="flex h-[52px] w-[52px] items-center justify-center rounded-full bg-white shadow-[0_2px_10px_rgba(0,0,0,0.07)] transition hover:scale-105"
            style={{ color: palette.accentDark }}
          >
            <ChevronLeft className="h-6 w-6" />
          </span>
        </button>
        <div
          ref={rowRef}
          className="grid auto-cols-[calc(100%_-_56px)] snap-x snap-mandatory grid-flow-col gap-2.5 overflow-x-auto overflow-y-visible overscroll-x-contain px-2 py-5 touch-pan-x [scrollbar-width:none] sm:auto-cols-[calc((100%_-_10px)_/_2)] md:auto-cols-[calc((100%_-_20px)_/_3)] lg:auto-cols-[calc((100%_-_40px)_/_5)] [&::-webkit-scrollbar]:hidden"
        >
          {products.map((product) => (
            <StoreProductCard
              key={`${title}-${product.id}`}
              storeSlug={storeSlug}
              product={product}
              accentColor={accentColor}
              compact
              variant="marketplace"
              analyticsSource={analyticsSource}
            />
          ))}
        </div>
        <button
          type="button"
          onClick={scrollNext}
          className="absolute bottom-4 right-[-18px] top-4 z-20 hidden w-[58px] items-center justify-end lg:flex"
          aria-label={`Avancar ${title}`}
        >
          <span
            className="flex h-[52px] w-[52px] items-center justify-center rounded-full bg-white shadow-[0_2px_10px_rgba(0,0,0,0.07)] transition hover:scale-105"
            style={{ color: palette.accentDark }}
          >
            <ChevronRight className="h-6 w-6" />
          </span>
        </button>
      </div>
    </section>
  )
}

function StoreSearchFilters({
  accentColor,
  categoryId,
  categoryOptions,
  isSearching,
  onCategoryChange,
  onSearchSubmit,
  onSortChange,
  searchTerm,
  setSearchTerm,
  sortOptions,
  sortValue,
}) {
  return (
    <form onSubmit={onSearchSubmit} className="grid w-full gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
      <div className="flex min-w-0 items-center gap-2 rounded-[4px] border border-slate-200 bg-white px-3 shadow-sm">
        <Search className="h-4 w-4 text-slate-400" />
        <input
          value={searchTerm}
          onChange={(event) => setSearchTerm(event.target.value)}
          placeholder="Buscar produto"
          className="h-10 min-w-0 flex-1 bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400"
        />
      </div>
      <button
        type="submit"
        disabled={isSearching}
        className="inline-flex h-10 items-center justify-center rounded-[4px] px-4 text-sm font-semibold text-white transition disabled:opacity-70"
        style={{ backgroundColor: accentColor }}
      >
        {isSearching ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Search className="mr-2 h-4 w-4" />}
        Buscar
      </button>
      <div className={`grid gap-2 text-xs sm:col-span-2 ${categoryOptions.length > 1 ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1'}`}>
        {categoryOptions.length > 1 ? (
          <AppSelect
            options={categoryOptions}
            value={categoryId}
            onChangeValue={onCategoryChange}
            placeholder="Categorias"
            minHeight={38}
            tone="light"
            accentColor={accentColor}
          />
        ) : null}
        <AppSelect
          options={sortOptions}
          value={sortValue}
          onChangeValue={onSortChange}
          placeholder="Recentes"
          minHeight={38}
          tone="light"
          accentColor={accentColor}
        />
      </div>
    </form>
  )
}

function buildHeroBackgroundStyle(hero) {
  const mode = hero?.backgroundMode || 'solid'
  const imageMode = hero?.imageMode || 'cover'
  const baseBackground =
    mode === 'gradient'
      ? `linear-gradient(120deg, ${hero?.gradientFrom || '#ffffff'}, ${hero?.gradientTo || '#f5f5f5'})`
      : hero?.solidColor || '#ffffff'

  return {
    base: {
      background: baseBackground,
    },
    image: hero?.imageUrl
      ? {
          backgroundImage: `url(${hero.imageUrl})`,
          backgroundPosition: 'center',
          backgroundRepeat: imageMode === 'repeat-x' ? 'repeat-x' : 'no-repeat',
          backgroundSize: imageMode === 'repeat-x' ? 'auto 100%' : 'cover',
          opacity: Number(hero?.imageOpacity ?? 1),
        }
      : null,
    overlay: {
      backgroundColor: hero?.overlayColor || '#ffffff',
      opacity: Number(hero?.overlayOpacity ?? 0.18),
    },
  }
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
  const [headerSolid, setHeaderSolid] = useState(false)
  const [activeSection, setActiveSection] = useState('produtos')
  const [searchTerm, setSearchTerm] = useState(query)
  const [sortValue, setSortValue] = useState(sort)
  const [isSearching, setIsSearching] = useState(false)
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false)
  const [autoSyncChecked, setAutoSyncChecked] = useState(false)
  const palette = useMemo(() => buildStoreAccentPalette(store.accentColor), [store.accentColor])
  const recommendedProducts = useMemo(() => {
    return (featuredProducts.length ? featuredProducts : products).slice(0, 10)
  }, [featuredProducts, products])
  const visibleProducts = useMemo(() => products, [products])
  const socialEntries = useMemo(
    () => Object.entries(store.socialLinks || {}).filter(([, value]) => Boolean(value)),
    [store.socialLinks],
  )
  const visibleCategories = useMemo(
    () => categories.filter((category) => category?.id && !shouldHideCategoryCode(category.label)),
    [categories],
  )
  const categoryOptions = useMemo(
    () => [{ value: '', label: 'Categorias' }, ...visibleCategories.map((category) => ({ value: category.id, label: category.label }))],
    [visibleCategories],
  )
  const sortOptions = useMemo(
    () => [
      { value: 'recent', label: 'Recentes' },
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
  const hasCategoryContext = Boolean(categoryId && categoryLabel)
  const hasSearchContext = Boolean(query)
  const hero = store.visualConfig?.hero || {}
  const heroStyle = buildHeroBackgroundStyle(hero)

  useEffect(() => {
    setSearchTerm(query)
  }, [query])

  useEffect(() => {
    setSortValue(sort)
  }, [sort])

  useEffect(() => {
    setIsSearching(false)
  }, [query, categoryId, sort, page])

  useEffect(() => {
    function handleScroll() {
      setHeaderSolid(window.scrollY > 8)
      const productsSection = document.getElementById('produtos')
      const aboutSection = document.getElementById('sobre')
      if (aboutSection && aboutSection.getBoundingClientRect().top < window.innerHeight * 0.35) {
        setActiveSection('sobre')
      } else if (productsSection && productsSection.getBoundingClientRect().top < window.innerHeight * 0.35) {
        setActiveSection('produtos')
      } else {
        setActiveSection('topo')
      }
    }

    handleScroll()
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  useEffect(() => {
    if (autoSyncChecked || !store?.slug) {
      return
    }

    const controller = new AbortController()

    async function requestAutoSync() {
      try {
        const response = await fetch(`/api/public/loja/${encodeURIComponent(store.slug)}/snapshot-refresh`, {
          method: 'POST',
          cache: 'no-store',
          signal: controller.signal,
        })
        const data = await response.json().catch(() => ({}))
        if (!controller.signal.aborted && response.ok && data?.changed === true) {
          router.refresh()
        }
      } catch {}
      finally {
        if (!controller.signal.aborted) {
          setAutoSyncChecked(true)
        }
      }
    }

    requestAutoSync()
    return () => controller.abort()
  }, [autoSyncChecked, router, store?.slug])

  function handleAnchorNavigation(event, href) {
    if (!href || !href.startsWith('#')) {
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

  function navigateStore(nextQuery = searchTerm, nextCategoryId = categoryId, nextSort = sortValue, nextPage = 1) {
    router.push(buildStoreUrl(store.slug, nextQuery, nextPage, nextCategoryId, nextSort), { scroll: false })
  }

  function handleSearchSubmit(event) {
    event.preventDefault()
    setIsSearching(true)
    setMobileFiltersOpen(false)
    navigateStore(searchTerm, categoryId, sortValue, 1)
  }

  function handleCategoryChange(value) {
    setIsSearching(true)
    setMobileFiltersOpen(false)
    navigateStore(searchTerm, value || '', sortValue, 1)
  }

  function handleSortChange(value) {
    const nextValue = value || 'recent'
    setSortValue(nextValue)
    setIsSearching(true)
    setMobileFiltersOpen(false)
    navigateStore(searchTerm, categoryId, nextValue, 1)
  }

  function handleResetCatalog() {
    setSearchTerm('')
    setSortValue('recent')
    setIsSearching(false)
    navigateStore('', '', 'recent', 1)
  }

  return (
    <>
      <style jsx global>{`
        html {
          scrollbar-color: #d1d5db #ffffff;
        }

        body::-webkit-scrollbar {
          width: 12px;
        }

        body::-webkit-scrollbar-track {
          background: #ffffff;
        }

        body::-webkit-scrollbar-thumb {
          background: #d1d5db;
          border: 3px solid #ffffff;
          border-radius: 999px;
        }

      `}</style>
      <div className="min-h-screen scroll-smooth bg-slate-50 text-slate-950">
        <StoreHeader store={store} activeSection={activeSection} headerSolid={headerSolid} samePageNavigation />

        <main id="topo" className="pb-12">
          <section className="relative z-20 min-h-[238px] overflow-hidden pt-[86px]" style={heroStyle.base}>
            {heroStyle.image ? <div className="absolute inset-0" style={heroStyle.image} /> : null}
            <div className="absolute inset-0" style={heroStyle.overlay} />
            <div className="pointer-events-none absolute inset-x-0 bottom-[-12px] h-[28px] bg-[radial-gradient(ellipse_at_center,rgba(15,23,42,0.18),rgba(15,23,42,0.04)_58%,rgba(15,23,42,0)_78%)] blur-md" />
            <div className="relative mx-auto grid max-w-[1228px] gap-5 px-3 py-8 sm:px-4 lg:grid-cols-[minmax(0,1fr)_minmax(320px,430px)] lg:items-start lg:px-3">
              <div className="max-w-xl pr-14 lg:pr-0">
                <h1
                  className="mt-1 text-3xl font-bold leading-tight sm:text-4xl"
                  style={{ color: palette.accentDark, textShadow: '0 12px 28px rgba(255,255,255,0.55), 0 3px 12px rgba(15,23,42,0.16)' }}
                >
                  {store.name}
                </h1>
                {store.headline ? (
                  <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-700" style={{ textShadow: '0 8px 22px rgba(255,255,255,0.42), 0 2px 8px rgba(15,23,42,0.08)' }}>
                    {store.headline}
                  </p>
                ) : null}
              </div>
              <div className="hidden w-full justify-self-end lg:block">
                <StoreSearchFilters
                  accentColor={palette.accent}
                  categoryId={categoryId}
                  categoryOptions={categoryOptions}
                  isSearching={isSearching}
                  onCategoryChange={handleCategoryChange}
                  onSearchSubmit={handleSearchSubmit}
                  onSortChange={handleSortChange}
                  searchTerm={searchTerm}
                  setSearchTerm={setSearchTerm}
                  sortOptions={sortOptions}
                  sortValue={sortValue}
                />
              </div>
              <button
                type="button"
                onClick={() => setMobileFiltersOpen(true)}
                className="absolute right-4 top-8 inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/85 text-slate-900 shadow-[0_8px_18px_rgba(0,0,0,0.10)] backdrop-blur transition hover:bg-white lg:hidden"
                style={{ color: palette.accentDark }}
                aria-label="Buscar e filtrar produtos"
              >
                <Filter className="h-5 w-5" />
              </button>
            </div>
          </section>

          <section id="produtos" className="relative z-0 mx-auto -mt-4 max-w-[1228px] scroll-mt-24 px-3 sm:px-4 lg:px-3">
            {hasSearchContext || hasCategoryContext ? (
              <div className="mt-4 flex flex-wrap items-center gap-2 text-sm">
                {hasSearchContext ? <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-700">Busca: {query}</span> : null}
                {hasCategoryContext ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1 text-slate-700">
                    <Tag className="h-3.5 w-3.5" />
                    {categoryLabel}
                  </span>
                ) : null}
                <button type="button" onClick={handleResetCatalog} className="inline-flex items-center gap-1 px-1" style={{ color: palette.accentDark }}>
                  <ChevronLeft className="h-4 w-4" />
                  limpar filtros
                </button>
              </div>
            ) : null}

            <ProductRow
              title="Em destaque"
              products={recommendedProducts}
              storeSlug={store.slug}
              accentColor={store.accentColor}
              analyticsSource="featured_row"
            />

            {visibleProducts.length ? (
              <section className="mt-8">
                <div className="mb-3 flex items-baseline gap-2.5">
                  <h2 className="text-[20px] font-normal leading-tight text-slate-700">Produtos recomendados</h2>
                </div>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                  {visibleProducts.map((product) => (
                    <StoreProductCard
                      key={`grid-${product.id}`}
                      storeSlug={store.slug}
                      product={product}
                      accentColor={store.accentColor}
                      variant="marketplace"
                      analyticsSource="catalog_grid"
                    />
                  ))}
                </div>
                {hasMore ? (
                  <div className="mt-5 flex justify-center">
                    <button
                      type="button"
                      onClick={() => {
                        setIsSearching(true)
                        navigateStore(searchTerm, categoryId, sortValue, page + 1)
                      }}
                      className="inline-flex h-10 items-center justify-center rounded-[4px] border border-slate-200 bg-white px-5 text-sm font-semibold text-slate-900 transition hover:border-slate-300"
                    >
                      Carregar mais
                    </button>
                  </div>
                ) : null}
              </section>
            ) : null}

            {!products.length ? (
              <div className="mt-8 rounded-[6px] border border-dashed border-slate-200 bg-white px-6 py-14 text-center">
                <div className="text-lg font-semibold text-slate-950">Nenhum produto encontrado</div>
                <div className="mx-auto mt-2 max-w-xl text-sm leading-6 text-slate-600">Ajuste a busca ou os filtros para encontrar outros itens da loja.</div>
              </div>
            ) : null}
          </section>

          <section id="sobre" className="mx-auto mt-12 grid max-w-[1228px] scroll-mt-24 gap-4 border-t border-slate-100 px-3 pt-8 sm:px-4 lg:grid-cols-[1.1fr_0.9fr] lg:px-3">
            <div className="rounded-[6px] bg-white p-4 shadow-[0_12px_30px_-28px_rgba(15,23,42,0.3)]">
              <div className="flex items-start gap-4">
                {store.logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={store.logoUrl} alt={store.name} loading="lazy" decoding="async" className="h-20 w-20 shrink-0 rounded-2xl border border-slate-100 bg-white p-2 object-contain" />
                ) : (
                  <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl border border-slate-100 bg-slate-50 text-xl font-semibold text-slate-700">
                    {store.name.slice(0, 2).toUpperCase()}
                  </div>
                )}
                <div className="min-w-0">
                  <div className="text-[20px] font-normal leading-tight text-slate-700">Sobre {store.name}</div>
                  <div className="mt-3 text-sm leading-7 text-slate-700">{store.about}</div>
                </div>
              </div>
            </div>
            <div id="contato">
              <div className="text-xl font-bold text-slate-950">Contato</div>
              <div className="mt-3 grid gap-3 text-sm text-slate-700">
                {store.contactEmail ? <div className="inline-flex items-center gap-3"><AtSign className="h-4 w-4 text-slate-500" />{store.contactEmail}</div> : null}
                {store.contactPhone ? <div className="inline-flex items-center gap-3"><Phone className="h-4 w-4 text-slate-500" />{store.contactPhone}</div> : null}
                {store.contactWhatsApp ? <div className="inline-flex items-center gap-3"><MessageCircle className="h-4 w-4 text-slate-500" />{store.contactWhatsApp}</div> : null}
                {store.contactAddress ? <div className="inline-flex items-center gap-3"><MapPin className="h-4 w-4 text-slate-500" />{store.contactAddress}</div> : null}
              </div>

              <div className="mt-5 flex flex-wrap gap-2">
                {socialEntries.map(([key, value]) => (
                  <a key={key} href={value} target="_blank" rel="noreferrer" className="inline-flex h-9 items-center gap-2 rounded-[4px] border border-slate-200 bg-white px-3 text-sm font-medium capitalize text-slate-900 transition hover:border-slate-300">
                    {(() => {
                      const Icon = socialIcons[key] || Globe
                      return <Icon className="h-4 w-4" />
                    })()}
                    {key}
                  </a>
                ))}
              </div>
            </div>
          </section>
        </main>

        <Sheet open={mobileFiltersOpen} onOpenChange={setMobileFiltersOpen}>
          <SheetContent
            side="right"
            className="w-[min(92vw,360px)] border-l border-slate-200 bg-white p-4 text-slate-900"
            overlayClassName="bg-slate-950/30"
          >
            <SheetTitle className="pr-8 text-base font-semibold text-slate-950">Buscar produtos</SheetTitle>
            <div className="mt-4">
              <StoreSearchFilters
                accentColor={palette.accent}
                categoryId={categoryId}
                categoryOptions={categoryOptions}
                isSearching={isSearching}
                onCategoryChange={handleCategoryChange}
                onSearchSubmit={handleSearchSubmit}
                onSortChange={handleSortChange}
                searchTerm={searchTerm}
                setSearchTerm={setSearchTerm}
                sortOptions={sortOptions}
                sortValue={sortValue}
              />
            </div>
          </SheetContent>
        </Sheet>

        <footer className="border-t border-black/10" style={{ backgroundColor: palette.accentDark }}>
          <div className="mx-auto grid max-w-[1228px] gap-6 px-3 py-8 sm:px-4 lg:grid-cols-[1fr_auto]">
            <div>
              <div className="flex items-center gap-4">
                {store.logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={store.logoUrl} alt={store.name} loading="lazy" decoding="async" className="h-16 w-16 rounded-2xl bg-white/10 p-2 object-contain" />
                ) : (
                  <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white/14 text-lg font-semibold text-white">
                    {store.name.slice(0, 2).toUpperCase()}
                  </div>
                )}
                <div>
                  <div className="text-lg font-semibold text-white">{store.name}</div>
                  <div className="mt-2 max-w-2xl text-sm leading-6 text-white/72">{store.footerText}</div>
                </div>
              </div>
              <a href="https://www.infrastudio.pro" target="_blank" rel="noreferrer" className="mt-4 inline-flex flex-col items-start transition hover:opacity-80">
                <span className="text-sm font-semibold text-white">InfraStudio</span>
                <span className="text-[11px] uppercase tracking-[0.16em] text-white/60">Sistema e automacao com IA</span>
              </a>
            </div>
            <div className="flex flex-wrap gap-3">
              {store.menuLinks.map((item) => (
                <a
                  key={`${item.label}-${item.href}-footer`}
                  href={item.href}
                  onClick={(event) => handleAnchorNavigation(event, item.href)}
                  className="inline-flex items-center gap-2 text-sm text-white/72 transition hover:text-white"
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
