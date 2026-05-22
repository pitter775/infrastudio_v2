'use client'

import { useState } from 'react'
import { Loader2, Search } from 'lucide-react'
import { useRouter } from 'next/navigation'

import { buildStoreUrl, navigateStoreHref } from '@/components/store/store-utils'

function ProductSearchForm({
  accentColor,
  isSearching,
  onSearchSubmit,
  searchTerm,
  setSearchTerm,
}) {
  return (
    <form onSubmit={onSearchSubmit} className="flex w-full min-w-0 items-center gap-1.5 min-[390px]:gap-2">
      <div className="flex min-w-0 flex-1 items-center gap-2 rounded-[14px] border border-slate-200 bg-white/88 px-2.5 shadow-sm backdrop-blur min-[390px]:rounded-[16px] min-[390px]:px-3">
        <Search className="h-4 w-4 shrink-0 text-slate-400" />
        <input
          value={searchTerm}
          onChange={(event) => setSearchTerm(event.target.value)}
          placeholder="Buscar produto"
          className="h-10 min-w-0 flex-1 bg-transparent text-[13px] text-slate-900 outline-none placeholder:text-slate-400 min-[390px]:text-sm"
        />
      </div>
      <button
        type="submit"
        disabled={isSearching}
        className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] border border-slate-200 bg-white/88 px-0 text-sm font-semibold text-[var(--store-accent)] shadow-sm backdrop-blur transition hover:border-transparent hover:bg-[var(--store-accent)] hover:text-white disabled:opacity-70 min-[390px]:w-auto min-[390px]:rounded-[16px] min-[390px]:px-4"
        style={{ '--store-accent': accentColor }}
      >
        {isSearching ? <Loader2 className="h-4 w-4 animate-spin min-[390px]:mr-2" /> : <Search className="h-4 w-4 min-[390px]:mr-2" />}
        <span className="hidden min-[390px]:inline">Buscar</span>
      </button>
    </form>
  )
}

export function StoreProductTopSearch({ accentColor = '#0f172a', store, storeSlug }) {
  const router = useRouter()
  const [searchTerm, setSearchTerm] = useState('')
  const [isSearching, setIsSearching] = useState(false)

  function navigateStore(nextQuery = searchTerm) {
    if (!storeSlug && !store?.slug) {
      return
    }

    navigateStoreHref(router, buildStoreUrl(store || storeSlug, nextQuery, 1), { scroll: false })
  }

  function handleSearchSubmit(event) {
    event.preventDefault()
    setIsSearching(true)
    navigateStore(searchTerm)
  }

  return (
    <ProductSearchForm
      accentColor={accentColor}
      isSearching={isSearching}
      onSearchSubmit={handleSearchSubmit}
      searchTerm={searchTerm}
      setSearchTerm={setSearchTerm}
    />
  )
}
