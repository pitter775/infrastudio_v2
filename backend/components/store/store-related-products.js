'use client'

import { useState } from 'react'

import { ChevronDown, Loader2 } from 'lucide-react'

import { StoreProductCard } from '@/components/store/store-product-card'
import { buildStoreAccentPalette } from '@/components/store/store-utils'

const RELATED_PAGE_SIZE = 10

export function StoreRelatedProducts({ accentColor, products, storeSlug }) {
  const [visibleCount, setVisibleCount] = useState(RELATED_PAGE_SIZE)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const palette = buildStoreAccentPalette(accentColor)
  const items = Array.isArray(products) ? products : []
  const visibleItems = items.slice(0, visibleCount)

  return (
    <>
      <div className="mt-6 grid grid-cols-2 gap-2.5 sm:gap-3 lg:grid-cols-5">
        {visibleItems.map((product) => (
          <StoreProductCard
            key={product.slug}
            storeSlug={storeSlug}
            product={product}
            accentColor={accentColor}
            compact
            variant="marketplace"
            analyticsSource="product_page_related"
          />
        ))}
      </div>
      {visibleCount < items.length ? (
        <div className="mt-6 flex justify-center">
          <button
            type="button"
            disabled={isLoadingMore}
            onClick={() => {
              setIsLoadingMore(true)
              window.setTimeout(() => {
                setVisibleCount((current) => Math.min(current + RELATED_PAGE_SIZE, items.length))
                setIsLoadingMore(false)
              }, 180)
            }}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-[4px] border border-slate-200 bg-white px-5 text-sm font-semibold text-slate-900 transition hover:border-transparent hover:bg-[var(--store-related-hover)] disabled:cursor-wait disabled:opacity-70"
            style={{ '--store-related-hover': palette.accentBorder }}
          >
            {isLoadingMore ? <Loader2 className="h-4 w-4 animate-spin" /> : <ChevronDown className="h-4 w-4" />}
            {isLoadingMore ? 'Carregando' : 'Ver mais'}
          </button>
        </div>
      ) : null}
    </>
  )
}
