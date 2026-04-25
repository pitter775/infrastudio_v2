'use client'

import Link from 'next/link'

import { formatStoreCurrency } from '@/components/store/store-utils'

export function StoreProductCard({ storeSlug, product, accentColor, onOpenSheet, compact = false }) {
  const href = `/loja/${storeSlug}/produto/${product.slug}`

  return (
    <Link
      href={href}
      onClick={(event) => {
        event.preventDefault()
        onOpenSheet(product.slug)
      }}
      className={
        compact
          ? 'group rounded-[24px] border border-black/5 bg-white p-4 shadow-[0_24px_70px_-44px_rgba(15,23,42,0.42)] transition hover:-translate-y-1'
          : 'group rounded-[28px] border border-black/5 bg-white p-4 shadow-[0_28px_70px_-42px_rgba(15,23,42,0.45)] transition hover:-translate-y-1'
      }
    >
      <div className={compact ? 'aspect-[4/3] overflow-hidden rounded-[18px] bg-[#f4efe6]' : 'aspect-[4/3] overflow-hidden rounded-[24px] bg-[#f4efe6]'}>
        {product.thumbnail ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={product.thumbnail} alt={product.title} loading="lazy" decoding="async" className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]" />
        ) : null}
      </div>
      <div className={compact ? 'mt-4 grid gap-2' : 'mt-4 grid gap-3'}>
        <div className={compact ? 'line-clamp-2 text-sm font-semibold leading-6 text-slate-950' : 'line-clamp-2 text-lg font-semibold leading-7 text-slate-950'}>
          {product.title}
        </div>
        <div className="flex items-center justify-between gap-4">
          <span className={compact ? 'text-base font-semibold' : 'text-xl font-semibold'} style={{ color: accentColor }}>
            {formatStoreCurrency(product.price, product.currencyId)}
          </span>
          {!compact ? (
            <span className="rounded-full border border-black/10 px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-slate-500">
              Mercado Livre
            </span>
          ) : null}
        </div>
      </div>
    </Link>
  )
}
