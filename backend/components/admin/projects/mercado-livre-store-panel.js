'use client'

import { useEffect, useMemo, useState } from 'react'
import { ExternalLink, Globe, ImageIcon, LayoutTemplate, Phone, Share2, Store } from 'lucide-react'

import {
  StoreAppearanceSection,
  StoreContactSection,
  StoreFeaturedSection,
  StoreGeneralSection,
  StoreMenuSection,
  StoreSocialSection,
  StoreDomainSection,
} from '@/components/admin/projects/mercado-livre-store-panel-sections'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const STORE_TABS = [
  { id: 'general', label: 'Geral', icon: Store },
  { id: 'appearance', label: 'Visual', icon: ImageIcon },
  { id: 'featured', label: 'Destaques', icon: LayoutTemplate },
  { id: 'contact', label: 'Contato', icon: Phone },
  { id: 'social', label: 'Redes', icon: Share2 },
  { id: 'menu', label: 'Menu', icon: Globe },
  { id: 'domain', label: 'Dominio', icon: ExternalLink },
]

const DEFAULT_MENU_LINKS = [
  { label: 'Produtos', href: '#produtos' },
  { label: 'Sobre nos', href: '#sobre' },
  { label: 'Contato', href: '#contato' },
]

function normalizeStoreSlug(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
}

function buildPublicStoreUrl(project, slug) {
  const normalizedSlug = normalizeStoreSlug(slug || `${project.slug || project.id}-ml`)
  return `https://infrastudio.pro/loja/${normalizedSlug}`
}

function buildInitialDraft(project, store) {
  return {
    active: store ? store.active === true : true,
    slug: store?.slug || `${project.slug || project.id}-ml`,
    name: store?.name || project.name || 'Loja',
    title: store?.title || '',
    headline: store?.headline || '',
    about: store?.about || '',
    accentColor: store?.accentColor || '#0ea5e9',
    logoUrl: store?.logoUrl || '',
    chatWidgetActive: store?.chatWidgetActive !== false,
    chatWidgetId: store?.chatWidgetId || project.chatWidgets?.[0]?.id || '',
    contactEmail: store?.contactEmail || '',
    contactPhone: store?.contactPhone || '',
    contactWhatsApp: store?.contactWhatsApp || '',
    contactAddress: store?.contactAddress || '',
    customDomain: store?.customDomain || '',
    customDomainActive: store?.customDomainActive === true,
    customDomainStatus: store?.customDomainStatus || 'pending',
    customDomainNotes: store?.customDomainNotes || '',
    footerText: store?.footerText || '',
    socialLinks: {
      instagram: store?.socialLinks?.instagram || '',
      facebook: store?.socialLinks?.facebook || '',
      tiktok: store?.socialLinks?.tiktok || '',
      youtube: store?.socialLinks?.youtube || '',
      x: store?.socialLinks?.x || '',
    },
    menuLinks: Array.isArray(store?.menuLinks) && store.menuLinks.length ? store.menuLinks : DEFAULT_MENU_LINKS,
    featuredProducts: Array.isArray(store?.featuredProducts) ? store.featuredProducts : [],
  }
}

function copyDraftForSave(draft) {
  return {
    ...draft,
    menuLinks: draft.menuLinks.map((item) => ({
      label: String(item?.label || '').trim(),
      href: String(item?.href || '').trim(),
    })),
    featuredProducts: draft.featuredProducts.map((item, index) => ({
      ...item,
      order: index,
    })),
  }
}

export function MercadoLivreStorePanel({ project, active = false, onFooterStateChange }) {
  const projectIdentifier = project.routeKey || project.slug || project.id
  const [activeSubTab, setActiveSubTab] = useState('general')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [feedback, setFeedback] = useState(null)
  const [draft, setDraft] = useState(() => buildInitialDraft(project, null))
  const [catalogQuery, setCatalogQuery] = useState('')
  const [catalogLoading, setCatalogLoading] = useState(false)
  const [catalogItems, setCatalogItems] = useState([])
  const [snapshotLoading, setSnapshotLoading] = useState(true)
  const [snapshotSyncing, setSnapshotSyncing] = useState(false)
  const [snapshot, setSnapshot] = useState(null)
  const [publicUrlCopied, setPublicUrlCopied] = useState(false)

  const widgetOptions = useMemo(
    () => (Array.isArray(project.chatWidgets) ? project.chatWidgets : []).map((widget) => ({
      id: widget.id,
      label: widget.nome || widget.slug || widget.id,
    })),
    [project.chatWidgets],
  )
  const publicUrl = useMemo(() => buildPublicStoreUrl(project, draft.slug), [draft.slug, project])

  useEffect(() => {
    onFooterStateChange?.({
      canSave: true,
      saving,
      activeTab: activeSubTab,
    })
  }, [activeSubTab, onFooterStateChange, saving])

  useEffect(() => {
    let activeRequest = true

    async function loadStore() {
      setLoading(true)
      try {
        const response = await fetch(`/api/app/projetos/${projectIdentifier}/conectores/mercado-livre/store`, {
          cache: 'no-store',
        })
        const data = await response.json().catch(() => ({}))
        if (!activeRequest || !response.ok) {
          return
        }

        setDraft(buildInitialDraft(project, data.store))
      } catch {
      } finally {
        if (activeRequest) {
          setLoading(false)
        }
      }
    }

    loadStore()
    return () => {
      activeRequest = false
    }
  }, [project, projectIdentifier])

  useEffect(() => {
    let activeRequest = true

    async function loadSnapshot() {
      setSnapshotLoading(true)
      try {
        const response = await fetch(`/api/app/projetos/${projectIdentifier}/conectores/mercado-livre/snapshot`, {
          cache: 'no-store',
        })
        const data = await response.json().catch(() => ({}))
        if (!activeRequest || !response.ok) {
          return
        }

        setSnapshot(data.snapshot || null)
      } catch {
      } finally {
        if (activeRequest) {
          setSnapshotLoading(false)
        }
      }
    }

    loadSnapshot()
    return () => {
      activeRequest = false
    }
  }, [projectIdentifier])

  async function handleSave(event) {
    event.preventDefault()
    setSaving(true)
    setFeedback(null)

    try {
      const normalizedSlug = normalizeStoreSlug(draft.slug)
      if (!normalizedSlug) {
        setFeedback({ tone: 'error', text: 'Informe um slug valido para publicar a loja.' })
        return
      }

      if (!String(draft.name || '').trim()) {
        setFeedback({ tone: 'error', text: 'Informe o nome da loja.' })
        return
      }

      const response = await fetch(`/api/app/projetos/${projectIdentifier}/conectores/mercado-livre/store`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(copyDraftForSave({ ...draft, slug: normalizedSlug })),
      })
      const data = await response.json().catch(() => ({}))

      if (!response.ok) {
        setFeedback({ tone: 'error', text: data.error || 'Nao foi possivel salvar a loja.' })
        return
      }

      setDraft(buildInitialDraft(project, data.store))

      let nextFeedback = { tone: 'success', text: 'Loja salva.' }
      const shouldBootstrapSnapshot = (data.store?.active === true) && Number(snapshot?.total || 0) === 0

      if (shouldBootstrapSnapshot) {
        setSnapshotSyncing(true)
        try {
          const snapshotResponse = await fetch(`/api/app/projetos/${projectIdentifier}/conectores/mercado-livre/snapshot`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ limit: 20, offset: 0 }),
          })
          const snapshotData = await snapshotResponse.json().catch(() => ({}))

          if (snapshotResponse.ok) {
            setSnapshot(snapshotData.snapshot || null)
            nextFeedback = {
              tone: 'success',
              text: `Loja salva e snapshot sincronizado com ${Number(snapshotData.synced || 0)} produtos.`,
            }
          } else {
            nextFeedback = {
              tone: 'success',
              text: 'Loja salva. Agora sincronize o snapshot para publicar os produtos na vitrine.',
            }
          }
        } catch {
          nextFeedback = {
            tone: 'success',
            text: 'Loja salva. Agora sincronize o snapshot para publicar os produtos na vitrine.',
          }
        } finally {
          setSnapshotSyncing(false)
        }
      }

      setFeedback(nextFeedback)
    } catch {
      setFeedback({ tone: 'error', text: 'Nao foi possivel salvar a loja.' })
    } finally {
      setSaving(false)
    }
  }

  async function handleCatalogSearch() {
    if (Number(snapshot?.total || 0) === 0) {
      setCatalogItems([])
      setFeedback({ tone: 'error', text: 'Sincronize o snapshot antes de buscar produtos para o rotativo.' })
      return
    }

    setCatalogLoading(true)
    setFeedback(null)

    try {
      const response = await fetch(
        `/api/app/projetos/${projectIdentifier}/conectores/mercado-livre/catalog?q=${encodeURIComponent(catalogQuery)}&limit=6`,
        { cache: 'no-store' },
      )
      const data = await response.json().catch(() => ({}))

      if (!response.ok) {
        setCatalogItems([])
        setFeedback({ tone: 'error', text: data.error || 'Nao foi possivel buscar produtos.' })
        return
      }

      setCatalogItems(Array.isArray(data.items) ? data.items : [])
      if (!Array.isArray(data.items) || data.items.length === 0) {
        setFeedback({ tone: 'error', text: 'Nenhum produto encontrado no snapshot com esse termo.' })
      }
    } catch {
      setCatalogItems([])
      setFeedback({ tone: 'error', text: 'Nao foi possivel buscar produtos.' })
    } finally {
      setCatalogLoading(false)
    }
  }

  async function handleSnapshotSync() {
    setSnapshotSyncing(true)
    setFeedback(null)

    try {
      const response = await fetch(`/api/app/projetos/${projectIdentifier}/conectores/mercado-livre/snapshot`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ limit: 20, offset: 0 }),
      })
      const data = await response.json().catch(() => ({}))

      if (!response.ok) {
        setFeedback({ tone: 'error', text: data.error || 'Nao foi possivel sincronizar o snapshot.' })
        return
      }

      setSnapshot(data.snapshot || null)
      setFeedback({
        tone: 'success',
        text:
          Number(data.synced || 0) > 0
            ? `Snapshot sincronizado com ${Number(data.synced || 0)} produtos.`
            : 'Snapshot sincronizado, mas nenhum produto elegivel foi encontrado nessa conta.',
      })
    } catch {
      setFeedback({ tone: 'error', text: 'Nao foi possivel sincronizar o snapshot.' })
    } finally {
      setSnapshotSyncing(false)
    }
  }

  function updateMenuLink(index, key, value) {
    setDraft((current) => ({
      ...current,
      menuLinks: current.menuLinks.map((item, itemIndex) =>
        itemIndex === index
          ? {
              ...item,
              [key]: value,
            }
          : item,
      ),
    }))
  }

  function addFeaturedProduct(item) {
    setDraft((current) => {
      if (current.featuredProducts.some((product) => product.id === item.id)) {
        return current
      }

      return {
        ...current,
        featuredProducts: [
          ...current.featuredProducts,
          {
            id: item.itemId || item.id,
            title: item.title,
            thumbnail: item.thumbnail,
            permalink: item.permalink,
            price: item.price,
            currencyId: item.currencyId,
          },
        ].slice(0, 8),
      }
    })
  }

  function removeFeaturedProduct(productId) {
    setDraft((current) => ({
      ...current,
      featuredProducts: current.featuredProducts.filter((item) => item.id !== productId),
    }))
  }

  async function handleCopyPublicUrl() {
    try {
      await navigator.clipboard.writeText(publicUrl)
      setPublicUrlCopied(true)
      window.setTimeout(() => setPublicUrlCopied(false), 1600)
    } catch {
      setFeedback({ tone: 'error', text: 'Nao foi possivel copiar o link publico.' })
    }
  }

  if (loading) {
    return <div className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-5 text-sm text-slate-400">Carregando loja...</div>
  }

  return (
    <form id="mercado-livre-store-form" className="grid gap-5" onSubmit={handleSave}>
      <div className="flex flex-wrap gap-2">
        {STORE_TABS.map((tab) => {
          const Icon = tab.icon
          const activeTab = activeSubTab === tab.id

          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveSubTab(tab.id)}
              className={cn(
                'inline-flex h-9 items-center gap-2 rounded-lg border px-3 text-sm font-medium',
                activeTab
                  ? 'border-sky-400/40 bg-sky-500/15 text-sky-100 shadow-[6px_6px_0_rgba(8,15,38,0.16)]'
                  : 'border-transparent bg-transparent text-slate-400 hover:bg-[#10192b] hover:text-white',
              )}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
            </button>
          )
        })}
      </div>

      {feedback ? (
        <div
          className={cn(
            'rounded-xl border px-3 py-3 text-sm',
            feedback.tone === 'success'
              ? 'border-emerald-400/20 bg-emerald-500/10 text-emerald-100'
              : 'border-rose-400/20 bg-rose-500/10 text-rose-100',
          )}
        >
          {feedback.text}
        </div>
      ) : null}

      {activeSubTab === 'general' ? (
        <StoreGeneralSection
          draft={draft}
          setDraft={setDraft}
          project={project}
          publicUrl={publicUrl}
          publicUrlCopied={publicUrlCopied}
          snapshotTotal={Number(snapshot?.total || 0)}
          onCopyPublicUrl={handleCopyPublicUrl}
        />
      ) : null}

      {activeSubTab === 'appearance' ? <StoreAppearanceSection draft={draft} setDraft={setDraft} widgetOptions={widgetOptions} /> : null}

      {activeSubTab === 'featured' ? (
        <StoreFeaturedSection
          catalogItems={catalogItems}
          catalogLoading={catalogLoading}
          catalogQuery={catalogQuery}
          draft={draft}
          snapshot={snapshot}
          snapshotLoading={snapshotLoading}
          snapshotSyncing={snapshotSyncing}
          onAddFeaturedProduct={addFeaturedProduct}
          onCatalogQueryChange={(event) => setCatalogQuery(event.target.value)}
          onCatalogSearch={handleCatalogSearch}
          onRemoveFeaturedProduct={removeFeaturedProduct}
          onSnapshotSync={handleSnapshotSync}
        />
      ) : null}

      {activeSubTab === 'contact' ? <StoreContactSection draft={draft} setDraft={setDraft} /> : null}

      {activeSubTab === 'social' ? <StoreSocialSection draft={draft} setDraft={setDraft} /> : null}

      {activeSubTab === 'menu' ? <StoreMenuSection draft={draft} onUpdateMenuLink={updateMenuLink} /> : null}

      {activeSubTab === 'domain' ? (
        <StoreDomainSection draft={draft} setDraft={setDraft} publicUrl={publicUrl} />
      ) : null}

      {active ? (
        <div className="flex justify-end">
          <Button type="submit" disabled={saving} variant="ghost" className="h-10 rounded-xl border border-sky-500/20 bg-sky-500/10 px-4 text-sm text-sky-100">
            {saving ? 'Salvando...' : 'Salvar loja'}
          </Button>
        </div>
      ) : null}
    </form>
  )
}
