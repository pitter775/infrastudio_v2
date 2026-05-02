'use client'

import { ExternalLink, MessageCircle } from 'lucide-react'

import { buildStoreProductExternalUrl, openStoreChat, trackStoreEvent } from '@/components/store/store-utils'

export function StoreProductActions({
  accentColor,
  chatDescription = null,
  permalink,
  product = null,
  storeSlug = null,
  widgetId = null,
  widgetSlug,
}) {
  const hasWidget = Boolean(widgetId || widgetSlug)
  const externalUrl = buildStoreProductExternalUrl(product || { permalink })

  return (
    <>
      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        <a
          href={externalUrl}
          target="_blank"
          rel="noreferrer"
          onClick={() =>
            trackStoreEvent({
              storeSlug,
              type: 'product_buy_click',
              source: 'product_detail',
              product,
              dedupeKey: `${storeSlug}:product_buy_click:${product?.slug || 'unknown'}`,
            })
          }
          className="inline-flex h-12 items-center justify-center gap-2 rounded-[6px] border border-[#ffe600] bg-[#ffe600] px-5 text-sm font-semibold text-[#333333] shadow-[0_12px_24px_-18px_rgba(15,23,42,0.16)] transition hover:bg-[#fff159] hover:shadow-[0_14px_28px_-18px_rgba(15,23,42,0.28)]"
        >
          <ExternalLink className="h-4 w-4" />
          Mercado Livre
        </a>
        <button
          type="button"
          onClick={() => {
            trackStoreEvent({
              storeSlug,
              type: 'product_chat_click',
              source: 'product_detail',
              product,
              dedupeKey: `${storeSlug}:product_chat_click:${product?.slug || 'unknown'}`,
            })
            openStoreChat({ widgetId, widgetSlug })
          }}
          disabled={!hasWidget}
          className="inline-flex h-12 items-center justify-center gap-2 rounded-[6px] border border-[var(--store-accent)] bg-[var(--store-accent)] px-5 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-60"
          style={{ '--store-accent': accentColor }}
        >
          <MessageCircle className="h-4 w-4" />
          Tirar duvida
        </button>
      </div>
      <div className="mt-4 text-sm leading-7 text-slate-600">
        {chatDescription ||
          (hasWidget
            ? 'O chat da loja sera aberto para continuar o atendimento sem sair da vitrine.'
            : 'Use a pagina do produto ou o contato da loja para continuar o atendimento.')}
      </div>
    </>
  )
}
