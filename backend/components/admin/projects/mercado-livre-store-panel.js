'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Check, CreditCard, ExternalLink, Globe, ImageIcon, LayoutTemplate, Save, Share2, Store, Truck } from 'lucide-react'

import { AccessRequestSheet, buildAccessRequestMessage } from '@/components/admin/access-request-sheet'
import {
  StoreAppearanceSection,
  StoreFeaturedSection,
  StoreGeneralSection,
  StoreMenuSection,
  StoreSocialSection,
  StoreDomainSection,
} from '@/components/admin/projects/mercado-livre-store-panel-sections'
import { MAX_STORE_ASSET_BYTES, STORE_ASSETS_BUCKET, STORE_LOGO_MAX_WIDTH } from '@/lib/store-assets-constants'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const STORE_TABS = [
  { id: 'general', label: 'Geral', icon: Store },
  { id: 'appearance', label: 'Visual', icon: ImageIcon },
  { id: 'featured', label: 'Destaques', icon: LayoutTemplate },
  { id: 'social', label: 'Redes', icon: Share2 },
  { id: 'menu', label: 'Menu', icon: Globe },
  { id: 'payment', label: 'Pagamento', icon: CreditCard, accessRequest: true },
  { id: 'freight', label: 'Frete', icon: Truck, accessRequest: true },
  { id: 'domain', label: 'Dominio', icon: ExternalLink },
]

const DEFAULT_MENU_LINKS = [
  { label: 'Produtos', href: '#produtos' },
  { label: 'Sobre nos', href: '#sobre' },
  { label: 'Contato', href: '#contato' },
]

const DEFAULT_VISUAL_CONFIG = {
  logoStoragePath: '',
  catalog: {
    useLatestProducts: true,
  },
  hero: {
    backgroundMode: 'solid',
    imageUrl: '',
    imageStoragePath: '',
    imageOpacity: 1,
    imageMode: 'cover',
    solidColor: '#ffffff',
    gradientFrom: '#ffffff',
    gradientTo: '#f5f5f5',
    overlayColor: '#ffffff',
    overlayOpacity: 0.18,
  },
}

function replaceFileExtension(fileName, nextExtension) {
  const baseName = String(fileName || 'arquivo').replace(/\.[^.]+$/, '')
  return `${baseName}.${nextExtension}`
}

function isSvgAsset(file) {
  return String(file?.type || '').trim().toLowerCase() === 'image/svg+xml' || /\.svg$/i.test(String(file?.name || ''))
}

function canvasToBlob(canvas, type, quality) {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), type, quality)
  })
}

function loadImageFromObjectUrl(objectUrl) {
  return new Promise((resolve, reject) => {
    const image = new window.Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('Não foi possível processar a imagem.'))
    image.src = objectUrl
  })
}

async function optimizeLogoFile(file) {
  if (!file || isSvgAsset(file)) {
    return file
  }

  const objectUrl = URL.createObjectURL(file)

  try {
    const image = await loadImageFromObjectUrl(objectUrl)
    const sourceWidth = Number(image.naturalWidth || image.width || 0)
    const sourceHeight = Number(image.naturalHeight || image.height || 0)
    if (!sourceWidth || !sourceHeight) {
      throw new Error('Não foi possível ler o tamanho do logo.')
    }

    const targetWidth = Math.min(STORE_LOGO_MAX_WIDTH, sourceWidth)
    const targetHeight = Math.max(1, Math.round((sourceHeight / sourceWidth) * targetWidth))
    const canvas = document.createElement('canvas')
    canvas.width = targetWidth
    canvas.height = targetHeight

    const context = canvas.getContext('2d')
    if (!context) {
      throw new Error('Não foi possível preparar o logo para upload.')
    }

    context.clearRect(0, 0, targetWidth, targetHeight)
    context.drawImage(image, 0, 0, targetWidth, targetHeight)

    let blob = await canvasToBlob(canvas, 'image/webp', 0.86)
    let nextName = replaceFileExtension(file.name, 'webp')
    if (!blob) {
      blob = await canvasToBlob(canvas, 'image/png')
      nextName = replaceFileExtension(file.name, 'png')
    }
    if (!blob) {
      throw new Error('Não foi possível gerar a versão otimizada do logo.')
    }

    if (blob.size > MAX_STORE_ASSET_BYTES) {
      let quality = 0.8
      while (blob.size > MAX_STORE_ASSET_BYTES && quality >= 0.45) {
        const nextBlob = await canvasToBlob(canvas, 'image/webp', quality)
        if (!nextBlob) {
          break
        }
        blob = nextBlob
        nextName = replaceFileExtension(file.name, 'webp')
        quality -= 0.1
      }
    }

    return new File([blob], nextName, {
      type: blob.type || 'image/webp',
      lastModified: Date.now(),
    })
  } finally {
    URL.revokeObjectURL(objectUrl)
  }
}

function buildVisualConfig(store) {
  const hero = store?.visualConfig?.hero || {}
  const catalog = store?.visualConfig?.catalog || {}
  return {
    logoStoragePath: store?.visualConfig?.logoStoragePath || '',
    catalog: {
      ...DEFAULT_VISUAL_CONFIG.catalog,
      ...catalog,
      useLatestProducts: catalog.useLatestProducts !== false,
    },
    hero: {
      ...DEFAULT_VISUAL_CONFIG.hero,
      ...hero,
    },
  }
}

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
  return `https://www.infrastudio.pro/loja/${normalizedSlug}`
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
    visualConfig: buildVisualConfig(store),
    chatWidgetActive: store?.chatWidgetActive !== false,
    chatWidgetId: store?.chatWidgetId || project.chatWidgets?.[0]?.id || '',
    chatContextFull: store?.chatContextFull === true,
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

function buildDeveloperUploadError(stage, message, fallbackText) {
  const normalizedStage = String(stage || 'upload').trim()
  const normalizedMessage = String(message || '').trim()

  return {
    tone: 'error',
    text: fallbackText || 'Não foi possível enviar a imagem.',
    detail: normalizedMessage ? `[${normalizedStage}] ${normalizedMessage}` : `[${normalizedStage}] sem detalhe adicional`,
  }
}

export function MercadoLivreStorePanel({ project, active = false, onFooterStateChange, showTabs = true }) {
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
  const [restoringDefaults, setRestoringDefaults] = useState(false)
  const [assetUploading, setAssetUploading] = useState(null)
  const [slugAvailability, setSlugAvailability] = useState({ status: 'idle', slug: '', available: false, error: '' })
  const [accessSheetOpen, setAccessSheetOpen] = useState(false)
  const [accessSaving, setAccessSaving] = useState(false)
  const [accessError, setAccessError] = useState(null)
  const [domainAutomation, setDomainAutomation] = useState(null)
  const [domainChecking, setDomainChecking] = useState(false)
  const [accessRequest, setAccessRequest] = useState({
    featureKey: '',
    label: '',
    projetoId: project.id || '',
    assunto: '',
    mensagemInicial: '',
  })

  const publicUrl = useMemo(() => buildPublicStoreUrl(project, draft.slug), [draft.slug, project])
  const projectOptions = useMemo(
    () => [
      {
        value: project.id || '',
        label: project.name || project.nome || project.slug || 'Projeto',
      },
    ],
    [project],
  )

  const handleAccessTabClick = useCallback((tab) => {
    const label = `${tab.label} da loja Mercado Livre`
    const projectName = project.name || project.nome || project.slug || ''
    setAccessError(null)
    setAccessRequest({
      featureKey: `mercado_livre_${tab.id}`,
      label,
      projetoId: project.id || '',
      assunto: `Solicitação de acesso: ${label}`,
      mensagemInicial: buildAccessRequestMessage(label, projectName),
    })
    setAccessSheetOpen(true)
  }, [project.id, project.name, project.nome, project.slug])

  const handleSubTabChange = useCallback((tab) => {
    if (tab.accessRequest) {
      handleAccessTabClick(tab)
      return
    }

    setActiveSubTab(tab.id)
  }, [handleAccessTabClick])

  useEffect(() => {
    onFooterStateChange?.({
      canSave: true,
      saving,
      activeTab: activeSubTab,
      publicUrl,
      storeTabs: STORE_TABS,
      activeStoreTab: activeSubTab,
      onStoreTabChange: handleSubTabChange,
    })
  }, [activeSubTab, handleSubTabChange, onFooterStateChange, publicUrl, saving])

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
    const normalizedSlug = normalizeStoreSlug(draft.slug)
    if (!normalizedSlug) {
      setSlugAvailability({ status: 'invalid', slug: '', available: false, error: 'Informe um slug válido.' })
      return
    }

    let activeRequest = true
    setSlugAvailability({ status: 'checking', slug: normalizedSlug, available: false, error: '' })

    const timeout = window.setTimeout(async () => {
      try {
        const response = await fetch(
          `/api/app/projetos/${projectIdentifier}/conectores/mercado-livre/store?checkSlug=${encodeURIComponent(normalizedSlug)}`,
          { cache: 'no-store' },
        )
        const data = await response.json().catch(() => ({}))
        if (!activeRequest) {
          return
        }

        setSlugAvailability({
          status: data.available ? 'available' : 'unavailable',
          slug: data.slug || normalizedSlug,
          available: data.available === true,
          error: data.error || '',
        })
      } catch {
        if (activeRequest) {
          setSlugAvailability({ status: 'error', slug: normalizedSlug, available: false, error: 'Não foi possível validar o slug.' })
        }
      }
    }, 350)

    return () => {
      activeRequest = false
      window.clearTimeout(timeout)
    }
  }, [draft.slug, projectIdentifier])

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

  useEffect(() => {
    if (activeSubTab !== 'domain' || !String(draft.customDomain || '').trim() || draft.customDomainStatus === 'active') {
      return undefined
    }

    let activeRequest = true
    let timeoutId = null

    async function checkDomain() {
      setDomainChecking(true)
      try {
        const response = await fetch(`/api/app/projetos/${projectIdentifier}/conectores/mercado-livre/store/domain`, {
          cache: 'no-store',
        })
        const data = await response.json().catch(() => ({}))
        if (!activeRequest || !response.ok) {
          return
        }

        setDomainAutomation(data.domainAutomation || null)
        const storeDomain = data.domainAutomation?.storeDomain
        if (storeDomain) {
          setDraft((current) => ({
            ...current,
            customDomain: storeDomain.dominio_personalizado || current.customDomain,
            customDomainActive: storeDomain.dominio_ativo === true,
            customDomainStatus: storeDomain.dominio_status || current.customDomainStatus,
            customDomainNotes: storeDomain.dominio_observacoes || current.customDomainNotes,
          }))
        }
      } catch {
      } finally {
        if (activeRequest) {
          setDomainChecking(false)
          timeoutId = window.setTimeout(checkDomain, 45000)
        }
      }
    }

    checkDomain()
    return () => {
      activeRequest = false
      if (timeoutId) {
        window.clearTimeout(timeoutId)
      }
    }
  }, [activeSubTab, draft.customDomain, draft.customDomainStatus, projectIdentifier])

  async function handleDomainVerifyNow() {
    if (!String(draft.customDomain || '').trim()) {
      setFeedback({ tone: 'error', text: 'Informe um domínio antes de verificar.' })
      return
    }

    setDomainChecking(true)
    setFeedback(null)
    try {
      const response = await fetch(`/api/app/projetos/${projectIdentifier}/conectores/mercado-livre/store/domain`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action: 'provision' }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) {
        setFeedback({ tone: 'error', text: data.error || 'Não foi possível verificar o domínio.' })
        return
      }

      setDomainAutomation(data.domainAutomation || null)
      const storeDomain = data.domainAutomation?.storeDomain
      if (storeDomain) {
        setDraft((current) => ({
          ...current,
          customDomain: storeDomain.dominio_personalizado || current.customDomain,
          customDomainActive: storeDomain.dominio_ativo === true,
          customDomainStatus: storeDomain.dominio_status || current.customDomainStatus,
          customDomainNotes: storeDomain.dominio_observacoes || current.customDomainNotes,
        }))
      }

      setFeedback({
        tone: data.domainAutomation?.ok ? 'success' : 'error',
        text: data.domainAutomation?.ok ? 'Domínio validado e ativado.' : 'Domínio ainda aguardando DNS do cliente.',
      })
    } catch {
      setFeedback({ tone: 'error', text: 'Não foi possível verificar o domínio.' })
    } finally {
      setDomainChecking(false)
    }
  }

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

      if (slugAvailability.slug === normalizedSlug && slugAvailability.available === false) {
        setFeedback({ tone: 'error', text: slugAvailability.error || 'Este slug não está disponível.' })
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
        setFeedback({ tone: 'error', text: data.error || 'Não foi possível salvar a loja.' })
        return
      }

      setDraft(buildInitialDraft(project, data.store))
      setDomainAutomation(data.domainAutomation || null)

      let nextFeedback = { tone: 'success', text: 'Loja salva.' }
      if (data.domainAutomation?.summary) {
        nextFeedback = {
          tone: data.domainAutomation.summary.errors?.length ? 'error' : 'success',
          text: data.domainAutomation.summary.verified
            ? 'Loja salva. Domínio configurado e ativado automaticamente.'
            : 'Loja salva. Domínio configurado na Vercel e aguardando DNS do cliente.',
        }
      }
      const shouldBootstrapSnapshot = (data.store?.active === true) && Number(snapshot?.total || 0) === 0

      if (shouldBootstrapSnapshot) {
        setSnapshotSyncing(true)
        try {
          const snapshotResponse = await fetch(`/api/app/projetos/${projectIdentifier}/conectores/mercado-livre/snapshot`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ limit: 20, offset: 0, fullSync: true }),
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
      setFeedback({ tone: 'error', text: 'Não foi possível salvar a loja.' })
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
        setFeedback({ tone: 'error', text: data.error || 'Não foi possível buscar produtos.' })
        return
      }

      setCatalogItems(Array.isArray(data.items) ? data.items : [])
      if (!Array.isArray(data.items) || data.items.length === 0) {
        setFeedback({ tone: 'error', text: 'Nenhum produto encontrado no snapshot com esse termo.' })
      }
    } catch {
      setCatalogItems([])
      setFeedback({ tone: 'error', text: 'Não foi possível buscar produtos.' })
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
        body: JSON.stringify({ limit: 20, offset: 0, fullSync: true }),
      })
      const data = await response.json().catch(() => ({}))

      if (!response.ok) {
        setFeedback({ tone: 'error', text: data.error || 'Não foi possível sincronizar o snapshot.' })
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
      setFeedback({ tone: 'error', text: 'Não foi possível sincronizar o snapshot.' })
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
      setFeedback({ tone: 'error', text: 'Não foi possível copiar o link público.' })
    }
  }

  async function handleAssetUpload(kind, file) {
    if (!file) {
      return
    }

    setAssetUploading(kind)
    setFeedback(null)

    try {
      const uploadFile = kind === 'logo' ? await optimizeLogoFile(file) : file
      if (!uploadFile) {
        setFeedback(buildDeveloperUploadError('prepare-client', 'arquivo retornou vazio após preprocessamento', 'Arquivo inválido para upload.'))
        return
      }

      if (uploadFile.size > MAX_STORE_ASSET_BYTES) {
        setFeedback(
          buildDeveloperUploadError(
            'prepare-client',
            `arquivo final com ${uploadFile.size} bytes excede o limite de ${MAX_STORE_ASSET_BYTES} bytes`,
            'A imagem deve ter no maximo 1 MB.',
          ),
        )
        return
      }

      const prepareResponse = await fetch(`/api/app/projetos/${projectIdentifier}/conectores/mercado-livre/store/assets`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          kind,
          fileName: uploadFile.name,
          fileSize: uploadFile.size,
          contentType: uploadFile.type,
        }),
      })
      const prepareData = await prepareResponse.json().catch(() => ({}))

      if (!prepareResponse.ok) {
        setFeedback(
          buildDeveloperUploadError(
            'prepare-server',
            prepareData.error || `HTTP ${prepareResponse.status}`,
            'Não foi possível preparar o upload.',
          ),
        )
        return
      }

      const asset = prepareData.asset || {}
      if (!asset.storagePath || !asset.signedUrl) {
        setFeedback(buildDeveloperUploadError('prepare-server', 'asset sem storagePath ou signedUrl', 'Upload preparado sem credenciais validas.'))
        return
      }

      const normalizedStoragePath = String(asset.storagePath || '').replace(`${STORE_ASSETS_BUCKET}/`, '').replace(/^\/+/, '')
      const uploadFormData = new FormData()
      uploadFormData.append('cacheControl', '3600')
      uploadFormData.append('', uploadFile)
      const uploadResponse = await fetch(asset.signedUrl, {
        method: 'PUT',
        body: uploadFormData,
        headers: {
          'x-upsert': 'false',
        },
      })
      if (!uploadResponse.ok) {
        const uploadText = await uploadResponse.text().catch(() => '')
        setFeedback(
          buildDeveloperUploadError(
            'storage-upload',
            uploadText || `HTTP ${uploadResponse.status}`,
            'Não foi possível enviar a imagem.',
          ),
        )
        return
      }

      const commitResponse = await fetch(`/api/app/projetos/${projectIdentifier}/conectores/mercado-livre/store/assets`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          kind,
          storagePath: normalizedStoragePath,
          previousUrl: kind === 'logo' ? draft.logoUrl || '' : draft.visualConfig?.hero?.imageUrl || '',
          previousStoragePath:
            kind === 'logo' ? draft.visualConfig?.logoStoragePath || '' : draft.visualConfig?.hero?.imageStoragePath || '',
        }),
      })
      const commitData = await commitResponse.json().catch(() => ({}))

      if (!commitResponse.ok) {
        setFeedback(
          buildDeveloperUploadError(
            'commit-server',
            commitData.error || `HTTP ${commitResponse.status}`,
            'Não foi possível publicar a imagem.',
          ),
        )
        return
      }

      const publicUrl = commitData.asset?.publicUrl || asset.publicUrl || ''
      const nextStoragePath = commitData.asset?.storagePath || normalizedStoragePath
      if (!publicUrl) {
        setFeedback(buildDeveloperUploadError('commit-server', 'asset salvo sem publicUrl', 'Upload concluído sem URL pública.'))
        return
      }

      if (kind === 'logo') {
        setDraft((current) => ({
          ...current,
          logoUrl: publicUrl,
          visualConfig: {
            ...(current.visualConfig || DEFAULT_VISUAL_CONFIG),
            logoStoragePath: nextStoragePath,
          },
        }))
      } else {
        setDraft((current) => ({
          ...current,
          visualConfig: {
            ...(current.visualConfig || DEFAULT_VISUAL_CONFIG),
            hero: {
              ...DEFAULT_VISUAL_CONFIG.hero,
              ...(current.visualConfig?.hero || {}),
              backgroundMode: 'image',
              imageUrl: publicUrl,
              imageStoragePath: nextStoragePath,
            },
          },
        }))
      }

      setFeedback({ tone: 'success', text: 'Imagem enviada e publicada na loja.' })
    } catch (error) {
      setFeedback(
        buildDeveloperUploadError(
          'unexpected',
          error instanceof Error ? error.message : String(error || 'erro desconhecido'),
          'Não foi possível enviar a imagem.',
        ),
      )
    } finally {
      setAssetUploading(null)
    }
  }

  async function handleRestoreDefaults() {
    setRestoringDefaults(true)
    setFeedback(null)

    try {
      const response = await fetch(`/api/app/projetos/${projectIdentifier}/conectores/mercado-livre/store`, {
        method: 'POST',
      })
      const data = await response.json().catch(() => ({}))

      if (!response.ok) {
        setFeedback({ tone: 'error', text: data.error || 'Não foi possível restaurar os padrões da loja.' })
        return
      }

      setDraft(buildInitialDraft(project, data.store))
      setFeedback({
        tone: 'success',
        text: 'Padroes restaurados. Loja e slug principal foram reativados.',
      })
    } catch {
      setFeedback({ tone: 'error', text: 'Não foi possível restaurar os padrões da loja.' })
    } finally {
      setRestoringDefaults(false)
    }
  }

  if (loading) {
    return <div className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-5 text-sm text-slate-400">Carregando loja...</div>
  }

  return (
    <form id="mercado-livre-store-form" className="grid gap-4" onSubmit={handleSave}>
      {showTabs ? (
      <div className="-mt-2 flex flex-nowrap items-center gap-1 overflow-hidden pb-1">
        {STORE_TABS.map((tab) => {
          const Icon = tab.icon
          const activeTab = activeSubTab === tab.id

          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => handleSubTabChange(tab)}
              className={cn(
                'inline-flex h-8 min-w-0 shrink items-center gap-1.5 rounded-lg px-2 text-xs font-normal transition-[background-color,color,box-shadow]',
                activeTab
                  ? 'bg-sky-500/14 text-sky-100 shadow-[0_0_18px_rgba(56,189,248,0.16)]'
                  : 'bg-transparent text-slate-500 hover:bg-[#10192b] hover:text-slate-200',
              )}
            >
              <Icon className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{tab.label}</span>
            </button>
          )
        })}
      </div>
      ) : null}

      {feedback ? (
        <div
          className={cn(
            'rounded-xl border px-3 py-3 text-sm',
            feedback.tone === 'success'
              ? 'border-emerald-400/20 bg-emerald-500/10 text-emerald-100'
              : 'border-rose-400/20 bg-rose-500/10 text-rose-100',
          )}
        >
          <div>{feedback.text}</div>
          {feedback.detail ? (
            <div className="mt-2 break-all rounded-lg border border-current/10 bg-black/10 px-2 py-2 font-mono text-[11px] leading-5 opacity-90">
              {feedback.detail}
            </div>
          ) : null}
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
          onRestoreDefaults={handleRestoreDefaults}
          restoringDefaults={restoringDefaults}
          slugAvailability={slugAvailability}
        />
      ) : null}

      {activeSubTab === 'appearance' ? (
        <StoreAppearanceSection
          assetUploading={assetUploading}
          draft={draft}
          setDraft={setDraft}
          onAssetUpload={handleAssetUpload}
        />
      ) : null}

      {activeSubTab === 'featured' ? (
        <StoreFeaturedSection
          catalogItems={catalogItems}
          catalogLoading={catalogLoading}
          catalogQuery={catalogQuery}
          draft={draft}
          setDraft={setDraft}
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

      {activeSubTab === 'social' ? <StoreSocialSection draft={draft} setDraft={setDraft} /> : null}

      {activeSubTab === 'menu' ? <StoreMenuSection draft={draft} onUpdateMenuLink={updateMenuLink} /> : null}

      {activeSubTab === 'domain' ? (
        <StoreDomainSection
          draft={draft}
          setDraft={setDraft}
          publicUrl={publicUrl}
          domainAutomation={domainAutomation}
          domainChecking={domainChecking}
          onVerifyNow={handleDomainVerifyNow}
        />
      ) : null}

      {active ? (
        <div className="flex justify-end">
          <Button type="submit" disabled={saving} variant="ghost" className="h-10 rounded-xl border border-sky-500/20 bg-sky-500/10 px-4 text-sm text-sky-100">
            {saving ? <Save className="mr-2 h-4 w-4" /> : <Check className="mr-2 h-4 w-4" />}
            {saving ? 'Salvando...' : 'Salvar loja'}
          </Button>
        </div>
      ) : null}

      <AccessRequestSheet
        open={accessSheetOpen}
        onOpenChange={setAccessSheetOpen}
        request={accessRequest}
        setRequest={setAccessRequest}
        projectOptions={projectOptions}
        saving={accessSaving}
        setSaving={setAccessSaving}
        error={accessError}
        setError={setAccessError}
      />
    </form>
  )
}
