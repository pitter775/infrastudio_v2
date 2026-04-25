'use client'

import { Package, ShieldCheck, Tag, X } from 'lucide-react'

import { StoreProductActions } from '@/components/store/store-product-actions'
import { StoreProductCard } from '@/components/store/store-product-card'
import { formatStoreCurrency } from '@/components/store/store-utils'
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
  return (
    <Sheet open={open} onOpenChange={(nextOpen) => (!nextOpen ? onClose() : null)}>
      <SheetContent
        side="right"
        className="w-full max-w-2xl border-l border-black/10 bg-[#f7f3eb] p-0 text-slate-900"
        overlayClassName="bg-slate-950/50"
      >
        <SheetTitle className="sr-only">{data?.product?.title || 'Produto da loja'}</SheetTitle>
        <div className="flex h-full min-h-0 flex-col">
          <div className="flex items-center justify-between border-b border-black/5 px-6 py-4">
            <div className="text-sm font-medium text-slate-600">{store.name}</div>
            <button type="button" onClick={onClose} className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-black/10 bg-white text-slate-700">
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6 sm:py-6">
            {loading ? (
              <div className="rounded-[24px] border border-black/10 bg-white px-6 py-12 text-center text-sm text-slate-500">
                Carregando produto...
              </div>
            ) : product ? (
              <div className="grid gap-8">
                <div className="overflow-hidden rounded-[28px] border border-black/5 bg-white p-4">
                  <div className="aspect-[4/3] overflow-hidden rounded-[22px] bg-[#efe8da]">
                    {product.thumbnail ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={product.thumbnail} alt={product.title} loading="lazy" decoding="async" className="h-full w-full object-cover" />
                    ) : null}
                  </div>
                </div>

                <div className="rounded-[28px] border border-black/5 bg-white p-5 sm:p-6">
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
                  <div className="mt-5 grid gap-3 rounded-[22px] border border-black/5 bg-[#faf7f0] p-4 text-sm text-slate-700">
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
                        />
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="rounded-[24px] border border-black/10 bg-white px-6 py-12 text-center text-sm text-slate-500">
                Nao foi possivel carregar o produto.
              </div>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
