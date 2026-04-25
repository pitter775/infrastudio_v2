'use client'

import Link from 'next/link'
import { ExternalLink, MessageCircle } from 'lucide-react'

import { openStoreChat, trackStoreEvent } from '@/components/store/store-utils'

export function StoreProductActions({
  accentColor,
  chatDescription = null,
  openPageHref = null,
  permalink,
  product = null,
  storeSlug = null,
  widgetId = null,
  widgetSlug,
}) {
  const hasWidget = Boolean(widgetId || widgetSlug)

  return (
    <>
      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        <a
          href={permalink}
          target="_blank"
          rel="noreferrer"
          onClick={() =>
            trackStoreEvent({
              storeSlug,
              type: 'product_buy_click',
              source: openPageHref ? 'product_detail' : 'sheet',
              product,
              dedupeKey: `${storeSlug}:product_buy_click:${product?.slug || 'unknown'}`,
            })
          }
          className="inline-flex h-12 items-center justify-center gap-2 rounded-[14px] px-5 text-sm font-semibold text-white shadow-[0_18px_38px_-24px_rgba(37,99,235,0.45)] transition hover:-translate-y-0.5"
          style={{ backgroundColor: accentColor }}
        >
          <ExternalLink className="h-4 w-4" />
          Comprar no Mercado Livre
        </a>
        <button
          type="button"
          onClick={() => {
            trackStoreEvent({
              storeSlug,
              type: 'product_chat_click',
              source: openPageHref ? 'product_detail' : 'sheet',
              product,
              dedupeKey: `${storeSlug}:product_chat_click:${product?.slug || 'unknown'}`,
            })
            openStoreChat({ widgetId, widgetSlug })
          }}
          disabled={!hasWidget}
          className="inline-flex h-12 items-center justify-center gap-2 rounded-[14px] border border-slate-200 bg-[#faf8f3] px-5 text-sm font-semibold text-slate-900 transition hover:border-slate-300 hover:bg-white disabled:opacity-60"
        >
          <MessageCircle className="h-4 w-4" />
          Tirar duvida sobre este produto
        </button>
      </div>
      {openPageHref ? (
        <Link href={openPageHref} className="mt-4 inline-flex text-sm font-medium text-slate-600 underline-offset-4 hover:underline">
          Abrir pagina do produto
        </Link>
      ) : null}
      <div className="mt-4 text-sm leading-7 text-slate-600">
        {chatDescription ||
          (hasWidget
            ? 'O chat da loja sera aberto para continuar o atendimento sem sair da vitrine.'
            : 'Use a pagina do produto ou o contato da loja para continuar o atendimento.')}
      </div>
    </>
  )
}
