'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { AtSign, Camera, ChevronRight, Globe, MapPin, MessageCircle, Phone, Play, Search, ShieldCheck, Sparkles, Store, Users } from 'lucide-react'

import { StoreProductCard } from '@/components/store/store-product-card'
import { StoreProductSheet } from '@/components/store/store-product-sheet'
import { buildStoreUrl, formatStoreCurrency } from '@/components/store/store-utils'

export function MercadoLivreStorefront({
  store,
  featuredProducts,
  products,
  query,
  page,
  hasMore,
  categoryId = '',
  sort = 'recent',
  categories = [],
}) {
  const [activeIndex, setActiveIndex] = useState(0)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [sheetLoading, setSheetLoading] = useState(false)
  const [sheetData, setSheetData] = useState(null)
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
  const storeUrl = buildStoreUrl(store.slug, query, page, categoryId, sort)

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

  return (
    <>
      <div className="min-h-screen bg-[#f7f3eb] text-slate-900">
        <header className="sticky top-0 z-30 border-b border-black/5 bg-[rgba(247,243,235,0.92)] backdrop-blur">
          <div className="mx-auto flex max-w-7xl items-center justify-between gap-6 px-4 py-4 sm:px-6 lg:px-8">
            <Link href={`/loja/${store.slug}`} className="flex items-center gap-3">
              <div
                className="flex h-12 w-12 items-center justify-center rounded-2xl text-sm font-semibold text-white shadow-[0_18px_45px_-24px_rgba(15,23,42,0.5)]"
                style={{ backgroundColor: store.accentColor }}
              >
                {store.logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={store.logoUrl} alt={store.name} loading="lazy" decoding="async" className="h-full w-full rounded-2xl object-cover" />
                ) : (
                  store.name.slice(0, 2).toUpperCase()
                )}
              </div>
              <div>
                <div className="text-[11px] uppercase tracking-[0.22em] text-slate-500">Loja Mercado Livre</div>
                <div className="text-lg font-semibold">{store.name}</div>
              </div>
            </Link>

            <nav className="hidden items-center gap-6 md:flex">
              {store.menuLinks.map((item) => (
                <a key={`${item.label}-${item.href}`} href={item.href} className="text-sm text-slate-600 transition hover:text-slate-950">
                  {item.label}
                </a>
              ))}
            </nav>
          </div>
          {store.menuLinks.length ? (
            <div className="border-t border-black/5 md:hidden">
              <div className="mx-auto flex max-w-7xl gap-2 overflow-x-auto px-4 py-3 sm:px-6 [&::-webkit-scrollbar]:hidden">
                {store.menuLinks.map((item) => (
                  <a
                    key={`${item.label}-${item.href}-mobile`}
                    href={item.href}
                    className="shrink-0 rounded-full border border-black/10 bg-white/80 px-4 py-2 text-xs font-medium uppercase tracking-[0.18em] text-slate-700"
                  >
                    {item.label}
                  </a>
                ))}
              </div>
            </div>
          ) : null}
        </header>

        <main>
          <section className="relative overflow-hidden">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(14,165,233,0.18),transparent_38%),radial-gradient(circle_at_bottom_right,rgba(249,115,22,0.12),transparent_35%)]" />
            <div className="relative mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:px-6 lg:grid-cols-[1.05fr_0.95fr] lg:px-8 lg:py-20">
              <div className="max-w-2xl">
                <div className="inline-flex items-center gap-2 rounded-full border border-black/10 bg-white/70 px-3 py-1 text-xs font-medium uppercase tracking-[0.2em] text-slate-600">
                  Loja clara
                  <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: store.accentColor }} />
                </div>
                <h1 className="mt-5 max-w-xl text-3xl font-semibold leading-tight text-slate-950 sm:text-5xl">{store.title}</h1>
                <p className="mt-5 max-w-xl text-base leading-7 text-slate-600 sm:text-lg sm:leading-8">{store.headline}</p>

                <div className="mt-8 flex flex-wrap gap-3">
                  <a
                    href="#produtos"
                    className="inline-flex h-12 items-center justify-center rounded-2xl px-5 text-sm font-semibold text-white shadow-[0_18px_45px_-24px_rgba(15,23,42,0.5)]"
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
                      className="inline-flex h-12 items-center justify-center rounded-2xl border border-black/10 bg-white/70 px-5 text-sm font-semibold text-slate-900"
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

                <div className="mt-10 grid gap-3 sm:grid-cols-3">
                  <div className="rounded-[24px] border border-black/5 bg-white/80 p-4 shadow-[0_20px_60px_-40px_rgba(15,23,42,0.45)]">
                    <div className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-950 text-white">
                      <Store className="h-4 w-4" />
                    </div>
                    <div className="mt-4 text-sm font-semibold text-slate-950">Vitrine organizada</div>
                    <div className="mt-2 text-sm leading-6 text-slate-600">Produtos destacados, busca rapida e acesso direto pela loja.</div>
                  </div>
                  <div className="rounded-[24px] border border-black/5 bg-white/80 p-4 shadow-[0_20px_60px_-40px_rgba(15,23,42,0.45)]">
                    <div className="inline-flex h-10 w-10 items-center justify-center rounded-2xl text-white" style={{ backgroundColor: store.accentColor }}>
                      <MessageCircle className="h-4 w-4" />
                    </div>
                    <div className="mt-4 text-sm font-semibold text-slate-950">Atendimento direto</div>
                    <div className="mt-2 text-sm leading-6 text-slate-600">O cliente navega na loja e tira duvidas pelo chat do projeto.</div>
                  </div>
                  <div className="rounded-[24px] border border-black/5 bg-white/80 p-4 shadow-[0_20px_60px_-40px_rgba(15,23,42,0.45)]">
                    <div className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-500 text-white">
                      <ShieldCheck className="h-4 w-4" />
                    </div>
                    <div className="mt-4 text-sm font-semibold text-slate-950">Compra segura</div>
                    <div className="mt-2 text-sm leading-6 text-slate-600">A compra final continua no Mercado Livre com o fluxo oficial.</div>
                  </div>
                </div>
              </div>

              <div className="grid gap-4">
                <div className="rounded-[30px] border border-black/5 bg-white p-4 shadow-[0_28px_90px_-36px_rgba(15,23,42,0.45)]">
                  {activeSlide ? (
                    <button type="button" onClick={() => handleOpenSheet(activeSlide.slug)} className="grid w-full gap-4 text-left">
                      <div className="relative aspect-[4/3] overflow-hidden rounded-[24px] bg-[#f4efe6]">
                        {activeSlide.thumbnail ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={activeSlide.thumbnail} alt={activeSlide.title} loading="lazy" decoding="async" className="h-full w-full object-cover" />
                        ) : null}
                        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-950/65 via-slate-950/10 to-transparent px-5 py-5">
                          <div className="inline-flex rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[11px] uppercase tracking-[0.2em] text-white">
                            Produto em destaque
                          </div>
                        </div>
                      </div>
                      <div className="grid gap-2">
                        <div className="text-xs uppercase tracking-[0.22em] text-slate-500">Destaque da loja</div>
                        <div className="text-2xl font-semibold leading-tight text-slate-950">{activeSlide.title}</div>
                        <div className="text-lg font-semibold" style={{ color: store.accentColor }}>
                          {formatStoreCurrency(activeSlide.price, activeSlide.currencyId)}
                        </div>
                        <div className="text-sm leading-6 text-slate-600">Clique para abrir detalhes rapidos sem sair da navegacao da loja.</div>
                      </div>
                    </button>
                  ) : (
                    <div className="rounded-[24px] border border-dashed border-black/10 px-6 py-12 text-center text-sm text-slate-500">
                      Escolha produtos em destaque na aba Loja do Mercado Livre.
                    </div>
                  )}
                </div>

                {slides.length > 1 ? (
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    {slides.map((item, index) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setActiveIndex(index)}
                        className={`rounded-2xl border p-2 text-left transition ${
                          activeIndex === index ? 'border-slate-900 bg-slate-900 text-white' : 'border-black/10 bg-white text-slate-900'
                        }`}
                      >
                        <div className="line-clamp-2 text-xs font-medium">{item.title}</div>
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            </div>
          </section>

          <section id="produtos" className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
            <div className="flex flex-col gap-6">
              <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
                <div>
                  <div className="text-xs uppercase tracking-[0.22em] text-slate-500">Catalogo</div>
                  <h2 className="mt-2 text-3xl font-semibold text-slate-950">Produtos da loja</h2>
                </div>

                <form action={`/loja/${store.slug}`} method="get" className="flex w-full max-w-3xl flex-col gap-3 rounded-[24px] border border-black/10 bg-white p-2 md:flex-row md:items-center">
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
                    className="h-11 rounded-[18px] border border-black/10 bg-[#faf7f0] px-4 text-sm text-slate-900 outline-none"
                  >
                    <option value="recent">Mais recentes</option>
                    <option value="price_asc">Menor preco</option>
                    <option value="price_desc">Maior preco</option>
                    <option value="title">Nome</option>
                  </select>
                  {categoryId ? <input type="hidden" name="cat" value={categoryId} /> : null}
                  <button
                    type="submit"
                    className="inline-flex h-11 items-center justify-center rounded-[18px] px-5 text-sm font-semibold text-white"
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
                    className={`rounded-full border px-4 py-2 text-sm font-medium ${
                      !categoryId ? 'border-slate-900 bg-slate-900 text-white' : 'border-black/10 bg-white text-slate-700'
                    }`}
                  >
                    Todas
                  </Link>
                  {categories.map((category) => (
                    <Link
                      key={category.id}
                      href={buildStoreUrl(store.slug, query, 1, category.id, sort)}
                      className={`rounded-full border px-4 py-2 text-sm font-medium ${
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
                  />
                ))}
              </div>
            ) : (
              <div className="mt-8 rounded-[30px] border border-dashed border-black/10 bg-white/70 px-6 py-14 text-center">
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
                    className="inline-flex h-11 flex-1 items-center justify-center rounded-[18px] border border-black/10 bg-white px-5 text-sm font-semibold text-slate-900 sm:flex-none"
                  >
                    Anterior
                  </Link>
                ) : null}
                {hasMore ? (
                  <Link
                    href={buildStoreUrl(store.slug, query, page + 1, categoryId, sort)}
                    className="inline-flex h-11 flex-1 items-center justify-center rounded-[18px] px-5 text-sm font-semibold text-white sm:flex-none"
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
              <div className="rounded-[30px] border border-black/5 bg-white p-8">
                <div className="text-xs uppercase tracking-[0.22em] text-slate-500">Sobre nos</div>
                <div className="mt-4 text-lg leading-8 text-slate-700">{store.about}</div>
              </div>
              <div id="contato" className="rounded-[30px] border border-black/5 bg-white p-8">
                <div className="text-xs uppercase tracking-[0.22em] text-slate-500">Contato</div>
                <div className="mt-4 grid gap-4 text-sm text-slate-700">
                  {store.contactEmail ? <div>{store.contactEmail}</div> : null}
                  {store.contactPhone ? <div>{store.contactPhone}</div> : null}
                  {store.contactWhatsApp ? <div>{store.contactWhatsApp}</div> : null}
                  {store.contactAddress ? <div>{store.contactAddress}</div> : null}
                </div>

                <div className="mt-6 flex flex-wrap gap-3">
                  {socialEntries.map(([key, value]) => (
                    <a key={key} href={value} target="_blank" rel="noreferrer" className="inline-flex h-11 items-center gap-2 rounded-[18px] border border-black/10 bg-[#faf7f0] px-4 text-sm font-medium capitalize text-slate-900">
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
            </div>
            <div className="flex flex-wrap gap-3">
              {store.menuLinks.map((item) => (
                <a key={`${item.label}-${item.href}-footer`} href={item.href} className="text-sm text-slate-500 transition hover:text-slate-950">
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

