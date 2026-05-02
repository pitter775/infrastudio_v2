'use client'

import { useMemo, useState } from 'react'
import { Filter, Loader2, Search } from 'lucide-react'
import { useRouter } from 'next/navigation'

import { AppSelect } from '@/components/ui/app-select'
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet'
import { buildStoreUrl } from '@/components/store/store-utils'

function shouldHideCategoryCode(label) {
  return /^MLB\d+$/i.test(String(label || '').trim())
}

function ProductSearchForm({
  accentColor,
  categoryId,
  categoryOptions,
  isSearching,
  onCategoryChange,
  onSearchSubmit,
  onSortChange,
  searchTerm,
  selectMenuPortalDisabled = false,
  setSearchTerm,
  sortOptions,
  sortValue,
}) {
  return (
    <form onSubmit={onSearchSubmit} className="grid w-full gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
      <div className="flex min-w-0 items-center gap-2 rounded-[16px] border border-slate-200 bg-white/88 px-3 shadow-sm backdrop-blur">
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
        className="inline-flex h-10 items-center justify-center rounded-[16px] border border-slate-200 bg-white/88 px-4 text-sm font-semibold text-[var(--store-accent)] shadow-sm backdrop-blur transition hover:border-transparent hover:bg-[var(--store-accent)] hover:text-white disabled:opacity-70"
        style={{ '--store-accent': accentColor }}
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
            disablePortal={selectMenuPortalDisabled}
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
          disablePortal={selectMenuPortalDisabled}
        />
      </div>
    </form>
  )
}

export function StoreProductTopSearch({ accentColor = '#0f172a', categories = [], storeSlug }) {
  const router = useRouter()
  const [searchTerm, setSearchTerm] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [sortValue, setSortValue] = useState('recent')
  const [isSearching, setIsSearching] = useState(false)
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false)
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

  function navigateStore(nextQuery = searchTerm, nextCategoryId = categoryId, nextSort = sortValue) {
    if (!storeSlug) {
      return
    }

    router.push(buildStoreUrl(storeSlug, nextQuery, 1, nextCategoryId, nextSort), { scroll: false })
  }

  function handleSearchSubmit(event) {
    event.preventDefault()
    setIsSearching(true)
    setMobileFiltersOpen(false)
    navigateStore(searchTerm, categoryId, sortValue)
  }

  function handleCategoryChange(value) {
    const nextValue = value || ''
    setCategoryId(nextValue)
    setIsSearching(true)
    setMobileFiltersOpen(false)
    navigateStore(searchTerm, nextValue, sortValue)
  }

  function handleSortChange(value) {
    const nextValue = value || 'recent'
    setSortValue(nextValue)
    setIsSearching(true)
    setMobileFiltersOpen(false)
    navigateStore(searchTerm, categoryId, nextValue)
  }

  return (
    <>
      <div className="hidden w-full lg:block">
        <ProductSearchForm
          accentColor={accentColor}
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
        className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/90 text-slate-900 shadow-[0_8px_18px_rgba(0,0,0,0.10)] backdrop-blur transition hover:bg-white lg:hidden"
        style={{ color: accentColor }}
        aria-label="Buscar e filtrar produtos"
      >
        <Filter className="h-5 w-5" />
      </button>
      <Sheet open={mobileFiltersOpen} onOpenChange={setMobileFiltersOpen}>
        <SheetContent
          side="right"
          className="w-[min(92vw,360px)] border-l border-slate-200 bg-white p-4 text-slate-900"
          overlayClassName="bg-slate-950/30"
        >
          <SheetTitle className="pr-8 text-base font-semibold text-slate-950">Buscar produtos</SheetTitle>
          <div className="mt-4">
            <ProductSearchForm
              accentColor={accentColor}
              categoryId={categoryId}
              categoryOptions={categoryOptions}
              isSearching={isSearching}
              onCategoryChange={handleCategoryChange}
              onSearchSubmit={handleSearchSubmit}
              onSortChange={handleSortChange}
              searchTerm={searchTerm}
              selectMenuPortalDisabled
              setSearchTerm={setSearchTerm}
              sortOptions={sortOptions}
              sortValue={sortValue}
            />
          </div>
        </SheetContent>
      </Sheet>
    </>
  )
}
