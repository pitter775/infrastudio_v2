'use client'

import Link from 'next/link'
import { ExternalLink, MessageCircle } from 'lucide-react'

import { openStoreChat } from '@/components/store/store-utils'

export function StoreProductActions({
  accentColor,
  chatDescription = null,
  openPageHref = null,
  permalink,
  widgetSlug,
}) {
  const hasWidget = Boolean(widgetSlug)

  return (
    <>
      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        <a
          href={permalink}
          target="_blank"
          rel="noreferrer"
          className="inline-flex h-12 items-center justify-center gap-2 rounded-[18px] px-5 text-sm font-semibold text-white"
          style={{ backgroundColor: accentColor }}
        >
          <ExternalLink className="h-4 w-4" />
          Comprar no Mercado Livre
        </a>
        <button
          type="button"
          onClick={() => openStoreChat(widgetSlug)}
          disabled={!hasWidget}
          className="inline-flex h-12 items-center justify-center gap-2 rounded-[18px] border border-black/10 bg-[#faf7f0] px-5 text-sm font-semibold text-slate-900 disabled:opacity-60"
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
