'use client'

import { ChevronLeft, ChevronRight, Package, ShieldCheck, Tag, X } from 'lucide-react'
import { useMemo, useState } from 'react'

import { StoreProductActions } from '@/components/store/store-product-actions'
import { StoreProductCard } from '@/components/store/store-product-card'
import { formatStoreCurrency, getStoreProductImages } from '@/components/store/store-utils'
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet'

export function StoreProductSheet({
  store,
  open,
  loading,
  data,
  onClose,
  onOpenProduct,
}) {
  const product = data?.product || null
  const relatedProducts = Array.isArray(data?.relatedProducts) ? data.relatedProducts : []
  const images = useMemo(() => getStoreProductImages(product), [product])
  const [activeImageState, setActiveImageState] = useState({ productId: null, index: 0 })
  const activeImageIndex = activeImageState.productId === product?.id ? activeImageState.index : 0

  function goToPreviousImage() {
    if (!images.length) return
    setActiveImageState({
      productId: product?.id ?? null,
      index: (activeImageIndex - 1 + images.length) % images.length,
    })
  }

  function goToNextImage() {
    if (!images.length) return
    setActiveImageState({
      productId: product?.id ?? null,
      index: (activeImageIndex + 1) % images.length,
    })
  }

  return (
    <Sheet open={open} onOpenChange={(nextOpen) => (!nextOpen ? onClose() : null)}>
      <SheetContent
        side="right"
        className="w-full max-w-[46rem] border-l border-slate-200/80 bg-[#f4efe6] p-0 text-slate-900"
        overlayClassName="bg-slate-950/26"
        showCloseButton={false}
        closeOnInteractOutside={false}
      >
        <SheetTitle className="sr-only">{data?.product?.title || 'Produto da loja'}</SheetTitle>
        <div className="flex h-full min-h-0 flex-col">
          <div className="flex items-center justify-between border-b border-slate-200/80 px-5 py-4">
            <div className="text-sm font-medium text-slate-600">{store.name}</div>
            <button type="button" onClick={onClose} className="inline-flex h-10 w-10 items-center justify-center rounded-[14px] border border-slate-200 bg-white text-slate-700 transition hover:bg-slate-950 hover:text-white">
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6 sm:py-6">
            {loading ? (
              <div className="rounded-[18px] border border-black/10 bg-white px-6 py-12 text-center text-sm text-slate-500">
                Carregando produto...
              </div>
            ) : product ? (
              <div className="grid gap-8">
                <div className="overflow-hidden rounded-[24px] border border-slate-200 bg-white p-4 shadow-[0_20px_42px_-30px_rgba(15,23,42,0.14)]">
                  <div className="relative aspect-[4/3] overflow-hidden rounded-[20px] bg-[#e9eef5]">
                    {images[activeImageIndex] ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={images[activeImageIndex]} alt={product.title} loading="lazy" decoding="async" className="h-full w-full object-cover" />
                    ) : null}
                    {images.length > 1 ? (
                      <>
                        <button type="button" onClick={goToPreviousImage} className="absolute left-3 top-1/2 inline-flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/92 text-slate-900 shadow-[0_16px_32px_-20px_rgba(15,23,42,0.32)] backdrop-blur transition hover:scale-105">
                          <ChevronLeft className="h-4 w-4" />
                        </button>
                        <button type="button" onClick={goToNextImage} className="absolute right-3 top-1/2 inline-flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/92 text-slate-900 shadow-[0_16px_32px_-20px_rgba(15,23,42,0.32)] backdrop-blur transition hover:scale-105">
                          <ChevronRight className="h-4 w-4" />
                        </button>
                        <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 items-center gap-2 rounded-full bg-slate-950/62 px-3 py-1.5 backdrop-blur">
                          {images.map((image, index) => (
                            <button
                              key={`${image}-${index}`}
                              type="button"
                              onClick={() =>
                                setActiveImageState({
                                  productId: product?.id ?? null,
                                  index,
                                })
                              }
                              className={`h-2.5 rounded-full transition-all ${index === activeImageIndex ? 'w-6 bg-white' : 'w-2.5 bg-white/45'}`}
                              aria-label={`Ver imagem ${index + 1}`}
                            />
                          ))}
                        </div>
                      </>
                    ) : null}
                  </div>
                </div>

                <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-[0_18px_40px_-32px_rgba(15,23,42,0.14)] sm:p-6">
                  <div className="flex flex-wrap gap-2">
                    <span className="inline-flex items-center gap-2 rounded-full border border-black/10 bg-[#faf7f0] px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-slate-600">
                      <Package className="h-3.5 w-3.5" />
                      Produto da loja
                    </span>
                    {product.categoryId ? (
                      <span className="inline-flex items-center gap-2 rounded-full border border-black/10 bg-[#faf7f0] px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-slate-600">
                        <Tag className="h-3.5 w-3.5" />
                        {product.categoryId}
                      </span>
                    ) : null}
                    {product.status ? (
                      <span className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-emerald-700">
                        <ShieldCheck className="h-3.5 w-3.5" />
                        {product.status}
                      </span>
                    ) : null}
                  </div>
                  <h3 className="mt-4 text-2xl font-semibold leading-tight text-slate-950 sm:text-3xl">{product.title}</h3>
                  <div className="mt-4 text-xl font-semibold sm:text-2xl" style={{ color: store.accentColor }}>
                    {formatStoreCurrency(product.price, product.currencyId)}
                  </div>
                  {product.originalPrice > product.price ? (
                    <div className="mt-2 text-sm text-slate-500 line-through">
                      {formatStoreCurrency(product.originalPrice, product.currencyId)}
                    </div>
                  ) : null}
                  <div className="mt-5 grid gap-3 rounded-[18px] border border-slate-200 bg-[#faf8f3] p-4 text-sm text-slate-700">
                    <div className="flex items-center justify-between gap-4">
                      <span>Compra final</span>
                      <span className="font-medium text-slate-950">Mercado Livre</span>
                    </div>
                    {typeof product.stock === 'number' && product.stock > 0 ? (
                      <div className="flex items-center justify-between gap-4">
                        <span>Estoque informado</span>
                        <span className="font-medium text-slate-950">{product.stock}</span>
                      </div>
                    ) : null}
                  </div>
                  <StoreProductActions
                    accentColor={store.accentColor}
                    openPageHref={`/loja/${store.slug}/produto/${product.slug}`}
                    permalink={product.permalink}
                    product={product}
                    storeSlug={store.slug}
                    widgetId={store?.widget?.id}
                    widgetSlug={store?.widget?.slug}
                  />
                </div>

                {relatedProducts.length ? (
                  <div className="grid gap-4">
                    <div className="text-lg font-semibold text-slate-950">Outros produtos</div>
                    <div className="grid gap-4 sm:grid-cols-2">
                      {relatedProducts.map((relatedProduct) => (
                        <StoreProductCard
                          key={relatedProduct.id}
                          storeSlug={store.slug}
                          product={relatedProduct}
                          accentColor={store.accentColor}
                          onOpenSheet={onOpenProduct}
                          compact
                          analyticsSource="sheet_related"
                        />
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="rounded-[18px] border border-black/10 bg-white px-6 py-12 text-center text-sm text-slate-500">
                Nao foi possivel carregar o produto.
              </div>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
