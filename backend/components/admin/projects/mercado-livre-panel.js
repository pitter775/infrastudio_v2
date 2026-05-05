'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { BookOpen, Check, ChevronDown, Copy, Files, LoaderCircle, MessageCircle, MessageSquare, PackageSearch, RefreshCcw, Store } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { buildMercadoLivreRedirectUri, buildMercadoLivreWebhookUrl } from '@/lib/mercado-livre-webhook'
import { MercadoLivreStorePanel } from './mercado-livre-store-panel'

export function MercadoLivrePanel({
  project,
  activeTab: controlledActiveTab,
  onTabChange,
  onFooterStateChange,
  compact = false,
  initialNotice = '',
}) {
  const activeCount = project.directConnections?.mercadoLivre ?? 0
  const projectIdentifier = project.routeKey || project.slug || project.id
  const [activeTab, setActiveTab] = useState('connection')
  const currentTab = controlledActiveTab || activeTab
  const [step, setStep] = useState(activeCount ? 2 : 1)
  const [productUrl, setProductUrl] = useState('')
  const [storeName, setStoreName] = useState('')
  const [appId, setAppId] = useState('')
  const [clientSecret, setClientSecret] = useState('')
  const [seedId, setSeedId] = useState('')
  const [loadingConnector, setLoadingConnector] = useState(false)
  const [resolvingStore, setResolvingStore] = useState(false)
  const [savingConnector, setSavingConnector] = useState(false)
  const [startingOAuth, setStartingOAuth] = useState(false)
  const [loadingTestItems, setLoadingTestItems] = useState(false)
  const [testItems, setTestItems] = useState([])
  const [loadingOrders, setLoadingOrders] = useState(false)
  const [orders, setOrders] = useState([])
  const [ordersPaging, setOrdersPaging] = useState({ total: 0, offset: 0, limit: 10 })
  const [loadingQuestions, setLoadingQuestions] = useState(false)
  const [questions, setQuestions] = useState([])
  const [questionsPaging, setQuestionsPaging] = useState({ total: 0, offset: 0, limit: 10 })
  const [questionDrafts, setQuestionDrafts] = useState({})
  const [answeringQuestionId, setAnsweringQuestionId] = useState('')
  const [suggestingQuestionId, setSuggestingQuestionId] = useState('')
  const [syncingStoreSnapshot, setSyncingStoreSnapshot] = useState(false)
  const [loadingSnapshotStatus, setLoadingSnapshotStatus] = useState(false)
  const [expandedQuestionId, setExpandedQuestionId] = useState('')
  const [copiedField, setCopiedField] = useState('')
  const [snapshotStatus, setSnapshotStatus] = useState({
    total: 0,
    lastSyncAt: null,
  })
  const [connectorMeta, setConnectorMeta] = useState({
    id: null,
    oauthConnected: false,
    oauthNickname: '',
    oauthUserId: '',
  })
  const [feedback, setFeedback] = useState(() =>
    initialNotice === 'oauth_ok'
      ? { tone: 'success', text: 'Conta do Mercado Livre conectada. Agora você já pode testar a listagem da loja.' }
      : initialNotice === 'oauth_error'
        ? { tone: 'error', text: 'Não foi possível concluir a autenticação do Mercado Livre.' }
        : null,
  )
  const tabs = [
    { id: 'connection', label: 'Conexão', icon: Store },
    { id: 'tutorial', label: 'Tutorial', icon: BookOpen },
    { id: 'store', label: 'Loja', icon: Store },
    { id: 'test', label: 'Teste', icon: PackageSearch },
    { id: 'orders', label: 'Pedidos', icon: Files },
    { id: 'questions', label: 'Perguntas', icon: MessageSquare },
  ]
  const redirectUri = useMemo(() => buildMercadoLivreRedirectUri(), [])
  const webhookUrl = useMemo(() => buildMercadoLivreWebhookUrl(project.id), [project.id])

  const loadSnapshotStatus = useCallback(async () => {
    if (!connectorMeta.id) {
      setSnapshotStatus({ total: 0, lastSyncAt: null })
      return
    }

    setLoadingSnapshotStatus(true)

    try {
      const response = await fetch(`/api/app/projetos/${projectIdentifier}/conectores/mercado-livre/snapshot`, {
        cache: 'no-store',
      })
      const data = await response.json().catch(() => ({}))

      if (!response.ok) {
        return
      }

      const snapshot = data?.snapshot && typeof data.snapshot === 'object' ? data.snapshot : {}
      setSnapshotStatus({
        total: Number(snapshot.total || 0) || 0,
        lastSyncAt: snapshot.lastSyncAt || null,
      })
    } catch {
    } finally {
      setLoadingSnapshotStatus(false)
    }
  }, [connectorMeta.id, projectIdentifier])

  function applyConnector(connector) {
    if (!connector || typeof connector !== 'object') {
      return
    }

    const config = connector.config && typeof connector.config === 'object' ? connector.config : {}
    setStoreName((current) => current || connector.name || 'Loja Mercado Livre')
    setAppId((current) => current || String(config.appId || config.app_id || config.clientId || config.client_id || ''))
    setClientSecret((current) => current || String(config.clientSecret || config.client_secret || config.secret || ''))
    setSeedId((current) => current || String(config.seedId || config.seed_id || config.sellerId || config.seller_id || ''))
    setConnectorMeta({
      id: connector.id || null,
      oauthConnected: Boolean((config.oauthAccessToken || config.access_token) && (config.oauthUserId || config.user_id || config.sellerUserId)),
      oauthNickname: String(config.oauthNickname || config.nickname || ''),
      oauthUserId: String(config.oauthUserId || config.user_id || config.sellerUserId || ''),
    })
    setStep(2)
  }

  function getOrderDisplayName(order) {
    const fullName = [order?.buyerFirstName, order?.buyerLastName].filter(Boolean).join(' ').trim()
    if (fullName) {
      return fullName
    }

    const nickname = String(order?.buyerNickname || '').trim()
    if (nickname && !/^\d+$/.test(nickname)) {
      return nickname
    }

    return 'Comprador'
  }

  function getQuestionDisplayName(question) {
    const nickname = String(question?.fromNickname || '').trim()
    if (nickname && !/^\d+$/.test(nickname)) {
      return nickname
    }

    return 'Cliente'
  }

  async function copyTutorialValue(field, value) {
    try {
      await navigator.clipboard.writeText(String(value || ''))
      setCopiedField(field)
      window.setTimeout(() => {
        setCopiedField((current) => (current === field ? '' : current))
      }, 1800)
    } catch {
      setFeedback({ tone: 'error', text: 'Não foi possível copiar o link.' })
    }
  }

  useEffect(() => {
    let active = true

    async function loadMercadoLivreConnector() {
      setLoadingConnector(true)

      try {
        const response = await fetch(`/api/app/projetos/${projectIdentifier}/conectores`, {
          cache: 'no-store',
        })
        const data = await response.json().catch(() => ({}))

        if (!active || !response.ok) {
          return
        }

        const connector = (data.connectors || []).find((item) => {
          const haystack = `${item.slug || ''} ${item.type || ''} ${item.name || ''}`.toLowerCase()
          return haystack.includes('mercado') || haystack.includes('ml')
        })

        if (!connector) {
          return
        }

        applyConnector(connector)
      } catch {}
      finally {
        if (active) {
          setLoadingConnector(false)
        }
      }
    }

    loadMercadoLivreConnector()

    return () => {
      active = false
    }
  }, [projectIdentifier])

  useEffect(() => {
    if (currentTab === 'store') {
      return
    }

    onFooterStateChange?.({
      step,
      activeTab: currentTab,
      saving: step === 1 ? resolvingStore : savingConnector,
    })
  }, [currentTab, onFooterStateChange, resolvingStore, savingConnector, step])

  const handleLoadTestItems = useCallback(async () => {
    setLoadingTestItems(true)
    setFeedback(null)

    try {
      const response = await fetch(`/api/app/projetos/${projectIdentifier}/conectores/mercado-livre/test?limit=8`, {
        cache: 'no-store',
      })
      const data = await response.json().catch(() => ({}))

      if (!response.ok) {
        setTestItems([])
        if (data.connector) {
          applyConnector(data.connector)
        }
        setFeedback({ tone: 'error', text: data.error || 'Não foi possível carregar os itens da loja.' })
        return
      }

      if (data.connector) {
        applyConnector(data.connector)
      }

      setTestItems(Array.isArray(data.items) ? data.items : [])
    } catch {
      setTestItems([])
      setFeedback({ tone: 'error', text: 'Não foi possível carregar os itens da loja.' })
    } finally {
      setLoadingTestItems(false)
    }
  }, [projectIdentifier])

  useEffect(() => {
    void loadSnapshotStatus()
  }, [loadSnapshotStatus])

  const handleLoadOrders = useCallback(async (nextOffset = 0) => {
    setLoadingOrders(true)
    setFeedback(null)

    try {
      const response = await fetch(
        `/api/app/projetos/${projectIdentifier}/conectores/mercado-livre/orders?limit=10&offset=${nextOffset}`,
        {
          cache: 'no-store',
        },
      )
      const data = await response.json().catch(() => ({}))

      if (!response.ok) {
        setOrders([])
        setOrdersPaging({ total: 0, offset: 0, limit: 10 })
        if (data.connector) {
          applyConnector(data.connector)
        }
        setFeedback({ tone: 'error', text: data.error || 'Não foi possível carregar os pedidos da loja.' })
        return
      }

      if (data.connector) {
        applyConnector(data.connector)
      }

      setOrders(Array.isArray(data.orders) ? data.orders : [])
      setOrdersPaging({
        total: Number(data?.paging?.total || 0),
        offset: Number(data?.paging?.offset || 0),
        limit: Number(data?.paging?.limit || 10),
      })
    } catch {
      setOrders([])
      setOrdersPaging({ total: 0, offset: 0, limit: 10 })
      setFeedback({ tone: 'error', text: 'Não foi possível carregar os pedidos da loja.' })
    } finally {
      setLoadingOrders(false)
    }
  }, [projectIdentifier])

  const handleLoadQuestions = useCallback(async (nextOffset = 0) => {
    setLoadingQuestions(true)
    setFeedback(null)

    try {
      const response = await fetch(
        `/api/app/projetos/${projectIdentifier}/conectores/mercado-livre/questions?limit=10&offset=${nextOffset}`,
        {
          cache: 'no-store',
        },
      )
      const data = await response.json().catch(() => ({}))

      if (!response.ok) {
        setQuestions([])
        setQuestionsPaging({ total: 0, offset: 0, limit: 10 })
        if (data.connector) {
          applyConnector(data.connector)
        }
        setFeedback({ tone: 'error', text: data.error || 'Não foi possível carregar as perguntas da loja.' })
        return
      }

      if (data.connector) {
        applyConnector(data.connector)
      }

      setQuestions(Array.isArray(data.questions) ? data.questions : [])
      setQuestionsPaging({
        total: Number(data?.paging?.total || 0),
        offset: Number(data?.paging?.offset || 0),
        limit: Number(data?.paging?.limit || 10),
      })
    } catch {
      setQuestions([])
      setQuestionsPaging({ total: 0, offset: 0, limit: 10 })
      setFeedback({ tone: 'error', text: 'Não foi possível carregar as perguntas da loja.' })
    } finally {
      setLoadingQuestions(false)
    }
  }, [projectIdentifier])

  useEffect(() => {
    if (currentTab !== 'test' || !connectorMeta.oauthConnected) {
      return
    }

    void handleLoadTestItems()
  }, [connectorMeta.oauthConnected, currentTab, handleLoadTestItems])

  useEffect(() => {
    if (currentTab !== 'orders' || !connectorMeta.oauthConnected) {
      return
    }

    void handleLoadOrders()
  }, [connectorMeta.oauthConnected, currentTab, handleLoadOrders])

  useEffect(() => {
    if (currentTab !== 'questions' || !connectorMeta.oauthConnected) {
      return
    }

    void handleLoadQuestions()
  }, [connectorMeta.oauthConnected, currentTab, handleLoadQuestions])

  function handleResolveStore(event) {
    event.preventDefault()

    void (async () => {
      setResolvingStore(true)
      setFeedback(null)

      try {
        const response = await fetch(`/api/app/projetos/${projectIdentifier}/conectores/mercado-livre/resolve`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            productUrl,
          }),
        })
        const data = await response.json().catch(() => ({}))
        const product = data?.product && typeof data.product === 'object' ? data.product : {}

        setSeedId(String(product.seedId || ''))
        setStoreName((current) => current || String(product.storeName || '') || 'Loja Mercado Livre')
        setStep(2)

        if (!response.ok) {
          setFeedback({
            tone: 'error',
            text: data.error || 'Não foi possível localizar o seller_id automaticamente. Preencha manualmente.',
          })
          return
        }

        setFeedback({
          tone: 'success',
          text:
            product.source === 'api'
              ? 'Loja identificada pelo item público do Mercado Livre.'
              : product.source === 'api_html'
                ? `Loja identificada pelo item público e confirmada pelo HTML da ${product.sourceType === 'store_page' ? 'página da loja' : 'página do produto'}.`
              : product.source === 'html_retry'
                ? `Loja identificada após nova tentativa automática no HTML da ${product.sourceType === 'store_page' ? 'página da loja' : 'página do produto'}.`
                : 'Loja identificada automaticamente.',
        })
      } catch {
        setSeedId('')
        setStoreName((current) => current || 'Loja Mercado Livre')
        setStep(2)
        setFeedback({
          tone: 'error',
          text: 'Não foi possível localizar o seller_id automaticamente. Preencha manualmente.',
        })
      } finally {
        setResolvingStore(false)
      }
    })()
  }

  async function handleSaveConnection(event) {
    event.preventDefault()
    setSavingConnector(true)
    setFeedback(null)

    try {
      const response = await fetch(`/api/app/projetos/${projectIdentifier}/conectores`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          provider: 'mercado_livre',
          storeName,
          appId,
          clientSecret,
          seedId,
        }),
      })
      const data = await response.json().catch(() => ({}))

      if (!response.ok) {
        setFeedback({ tone: 'error', text: data.error || 'Não foi possível salvar a conexão do Mercado Livre.' })
        return
      }

      applyConnector(data.connector)
      setFeedback({
        tone: 'success',
        text: 'Conexão salva. O próximo passo é conectar a conta da loja no OAuth do Mercado Livre.',
      })
    } catch {
      setFeedback({ tone: 'error', text: 'Não foi possível salvar a conexão do Mercado Livre.' })
    } finally {
      setSavingConnector(false)
    }
  }

  async function handleStartOAuth() {
    setStartingOAuth(true)
    setFeedback(null)

    try {
      const response = await fetch(`/api/app/projetos/${projectIdentifier}/conectores/mercado-livre/oauth/start`, {
        cache: 'no-store',
      })
      const data = await response.json().catch(() => ({}))

      if (!response.ok || !data.authorizationUrl) {
        setFeedback({ tone: 'error', text: data.error || 'Não foi possível iniciar a autenticação do Mercado Livre.' })
        return
      }

      let authorizationUrl = null

      try {
        authorizationUrl = new URL(String(data.authorizationUrl || ''), window.location.origin)
      } catch {
        setFeedback({ tone: 'error', text: 'OAuth do Mercado Livre retornou uma URL inválida.' })
        return
      }

      const currentUrl = new URL(window.location.href)
      const isMercadoLivreHost = /mercadolivre\.com(?:\.[a-z]{2})?$|mercadolibre\.com(?:\.[a-z]{2})?$/i.test(
        authorizationUrl.hostname,
      )
      const isSameScreenRedirect =
        authorizationUrl.origin === currentUrl.origin &&
        authorizationUrl.pathname === currentUrl.pathname

      if (!isMercadoLivreHost || isSameScreenRedirect) {
        setFeedback({
          tone: 'error',
          text: 'O OAuth retornou um destino inesperado. Revise App ID, redirect URI e configuração do app no Mercado Livre.',
        })
        return
      }

      window.location.assign(authorizationUrl.toString())
    } catch {
      setFeedback({ tone: 'error', text: 'Não foi possível iniciar a autenticação do Mercado Livre.' })
    } finally {
      setStartingOAuth(false)
    }
  }

  async function handleAnswerQuestion(questionId) {
    const nextText = String(questionDrafts?.[questionId] || '').trim()
    if (!questionId || !nextText) {
      setFeedback({ tone: 'error', text: 'Escreva a resposta antes de enviar.' })
      return
    }

    setAnsweringQuestionId(questionId)
    setFeedback(null)

    try {
      const response = await fetch(`/api/app/projetos/${projectIdentifier}/conectores/mercado-livre/questions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          questionId,
          text: nextText,
        }),
      })
      const data = await response.json().catch(() => ({}))

      if (!response.ok) {
        setFeedback({ tone: 'error', text: data.error || 'Não foi possível responder a pergunta.' })
        return
      }

      setQuestionDrafts((current) => ({ ...current, [questionId]: '' }))
      setFeedback({ tone: 'success', text: 'Pergunta respondida no Mercado Livre.' })
      await handleLoadQuestions(questionsPaging.offset || 0)
    } catch {
      setFeedback({ tone: 'error', text: 'Não foi possível responder a pergunta.' })
    } finally {
      setAnsweringQuestionId('')
    }
  }

  async function handleSuggestQuestion(question) {
    if (!question?.id) {
      return
    }

    setSuggestingQuestionId(question.id)
    setFeedback(null)

    try {
      const response = await fetch(`/api/app/projetos/${projectIdentifier}/conectores/mercado-livre/questions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'suggest',
          questionText: question.text,
          itemId: question.itemId,
          itemTitle: question.itemTitle || '',
        }),
      })
      const data = await response.json().catch(() => ({}))

      if (!response.ok || !String(data?.text || '').trim()) {
        setFeedback({ tone: 'error', text: data.error || 'Não foi possível gerar sugestão com o agente.' })
        return
      }

      setQuestionDrafts((current) => ({
        ...current,
        [question.id]: String(data.text || '').trim(),
      }))
    } catch {
      setFeedback({ tone: 'error', text: 'Não foi possível gerar sugestão com o agente.' })
    } finally {
      setSuggestingQuestionId('')
    }
  }

  function handlePanelTabChange(tabId) {
    setActiveTab(tabId)
    onTabChange?.(tabId)
  }

  async function handleSyncStoreSnapshot() {
    setSyncingStoreSnapshot(true)
    setFeedback(null)

    try {
      const response = await fetch(`/api/app/projetos/${projectIdentifier}/conectores/mercado-livre/snapshot`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ fullSync: true, limit: 20, offset: 0 }),
      })
      const data = await response.json().catch(() => ({}))

      if (!response.ok) {
        const stage = String(data?.stage || '').trim()
        const detailError = String(data?.details?.error || '').trim()
        const detailCode = String(data?.details?.errorCode || '').trim()
        const detailSuffix = [stage ? `etapa: ${stage}` : '', detailCode ? `codigo: ${detailCode}` : '', detailError ? `detalhe: ${detailError}` : '']
          .filter(Boolean)
          .join(' | ')
        setFeedback({
          tone: 'error',
          text: `${data.error || 'Não foi possível atualizar a loja no banco.'}${detailSuffix ? ` (${detailSuffix})` : ''}`,
        })
        return
      }

      const snapshot = data?.snapshot && typeof data.snapshot === 'object' ? data.snapshot : {}
      setSnapshotStatus({
        total: Number(snapshot.total || 0) || 0,
        lastSyncAt: snapshot.lastSyncAt || null,
      })
      setFeedback({
        tone: 'success',
        text:
          Number(data.synced || 0) > 0
            ? `Loja atualizada no banco com ${Number(snapshot.total || data.synced || 0)} produtos ativos e com estoque.`
            : 'Loja atualizada. Nenhum produto ativo com estoque ficou elegivel para o snapshot.',
      })
    } catch {
      setFeedback({ tone: 'error', text: 'Não foi possível atualizar a loja no banco.' })
    } finally {
      setSyncingStoreSnapshot(false)
    }
  }

  return (
    <div className="grid gap-4">
      <div className={cn("flex flex-wrap gap-2", compact && "hidden")}>
        {tabs.map((tab) => {
          const Icon = tab.icon
          const active = currentTab === tab.id

          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => handlePanelTabChange(tab.id)}
              className={cn(
                'infra-tab-motion inline-flex h-9 items-center gap-2 rounded-lg border px-3 text-sm font-medium',
                active
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

      {currentTab === 'store' ? (
        <MercadoLivreStorePanel project={project} onFooterStateChange={onFooterStateChange} />
      ) : null}

      {currentTab === 'connection' ? (
        <div className="grid gap-4">
          {loadingConnector ? (
            <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-4 text-sm text-slate-300">
              <LoaderCircle className="h-4 w-4 animate-spin text-sky-300" />
              Carregando integração do Mercado Livre...
            </div>
          ) : null}
          {step === 1 ? (
            <form id="mercado-livre-resolve-form" className="grid gap-4" onSubmit={handleResolveStore}>
              <label className="block">
                <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Produto cadastrado na loja
                </span>
                <input
                  value={productUrl}
                  onChange={(event) => setProductUrl(event.target.value)}
                  placeholder="Cole a URL de qualquer produto da loja"
                  disabled={resolvingStore}
                  className="mt-2 h-11 w-full rounded-xl border border-white/10 bg-[#080e1d] px-3 text-sm text-white outline-none transition focus:border-amber-300/40"
                />
              </label>
              <div className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-slate-400">
                A resolução tenta primeiro o item público da API e, se necessário, refaz a leitura do HTML por alguns segundos para achar o <code className="rounded bg-white/5 px-1 py-0.5 text-sky-200">seller_id</code>.
              </div>
              {!compact ? (
                <div className="flex justify-end">
                  <Button type="submit" className="rounded-xl" disabled={resolvingStore}>
                    {resolvingStore ? 'Localizando...' : 'Avancar'}
                  </Button>
                </div>
              ) : null}
            </form>
          ) : null}

          {step === 2 ? (
            <>
              <div className="rounded-xl border border-amber-400/20 bg-amber-500/10 p-3 text-sm text-amber-100">
                <p className="font-semibold">Pegue os dados direto no Mercado Livre</p>
                <p className="mt-1 text-amber-50/80">
                  Abra o painel de apps para copiar o App ID e o Client Secret antes de salvar a loja.
                </p>
                {connectorMeta.oauthConnected ? (
                  <div className="mt-2 text-sm text-amber-50/80">
                    Produtos no banco:{' '}
                    {loadingSnapshotStatus && !syncingStoreSnapshot ? 'carregando...' : Number(snapshotStatus.total || 0)}
                    {snapshotStatus.lastSyncAt ? ` | ultima atualizacao: ${new Date(snapshotStatus.lastSyncAt).toLocaleString('pt-BR')}` : ''}
                  </div>
                ) : null}
                <div className="mt-3 flex flex-wrap gap-3">
                  <a
                    href="https://developers.mercadolivre.com.br/devcenter"
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex h-9 items-center rounded-xl border border-amber-300/30 bg-amber-400/10 px-3 text-xs font-semibold uppercase tracking-[0.16em] text-amber-100 transition hover:bg-amber-400/20"
                  >
                    Abrir painel do Mercado Livre
                  </a>
                  <Button
                    type="button"
                    variant="ghost"
                    disabled={savingConnector || startingOAuth || !connectorMeta.id || connectorMeta.oauthConnected}
                    onClick={handleStartOAuth}
                    className={`h-9 rounded-xl px-3 text-xs font-semibold uppercase tracking-[0.16em] disabled:opacity-50 ${
                      connectorMeta.oauthConnected
                        ? 'border border-emerald-500/20 bg-emerald-500/10 text-emerald-100'
                        : 'border border-sky-500/20 bg-sky-500/10 text-sky-100'
                    }`}
                  >
                    {startingOAuth ? 'Conectando...' : connectorMeta.oauthConnected ? 'Conta conectada' : 'Conectar conta'}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={handleSyncStoreSnapshot}
                    disabled={syncingStoreSnapshot || !connectorMeta.oauthConnected}
                    className="h-9 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-3 text-xs font-semibold uppercase tracking-[0.16em] text-emerald-100 disabled:opacity-50"
                  >
                    <RefreshCcw className={`mr-2 h-4 w-4 ${syncingStoreSnapshot ? 'animate-spin' : ''}`} />
                    {syncingStoreSnapshot ? 'Atualizando...' : 'Atualizar loja'}
                  </Button>
                </div>
              </div>
              <form id="mercado-livre-save-form" className="grid gap-4" onSubmit={handleSaveConnection}>
                <div className="flex justify-start">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setStep(1)}
                    className="h-10 rounded-xl border border-white/10 bg-white/[0.04] px-4 text-sm text-slate-200"
                  >
                    Voltar e trocar link do produto
                  </Button>
                </div>
                <div className="grid gap-3">
                  <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_220px]">
                    <label className="block">
                      <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Nome da loja</span>
                      <input value={storeName} onChange={(event) => setStoreName(event.target.value)} className="mt-2 h-11 w-full rounded-xl border border-white/10 bg-[#080e1d] px-3 text-sm text-white outline-none" />
                    </label>
                    <label className="block">
                      <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Seed ID</span>
                      <input value={seedId} onChange={(event) => setSeedId(event.target.value)} className="mt-2 h-11 w-full rounded-xl border border-white/10 bg-[#080e1d] px-3 text-sm text-white outline-none" />
                    </label>
                  </div>
                  <div className="grid gap-3 md:grid-cols-2">
                    <label className="block">
                      <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">App ID</span>
                      <input value={appId} onChange={(event) => setAppId(event.target.value)} className="mt-2 h-11 w-full rounded-xl border border-white/10 bg-[#080e1d] px-3 text-sm text-white outline-none" />
                    </label>
                    <label className="block">
                      <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Client secret</span>
                      <input value={clientSecret} onChange={(event) => setClientSecret(event.target.value)} className="mt-2 h-11 w-full rounded-xl border border-white/10 bg-[#080e1d] px-3 text-sm text-white outline-none" />
                    </label>
                  </div>
                </div>
              </form>
            </>
          ) : null}
        </div>
      ) : null}

        {currentTab === 'test' ? (
        <div className="grid gap-4">
          {!connectorMeta.id ? (
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 text-sm text-slate-300">
              Salve a conexão do Mercado Livre primeiro. Depois disso você libera a autenticação da conta e testa os primeiros itens da loja.
            </div>
          ) : !connectorMeta.oauthConnected ? (
            <div className="rounded-xl border border-sky-400/20 bg-sky-500/10 p-4 text-sm text-sky-100">
              <p className="font-semibold">Falta conectar a conta da loja</p>
              <p className="mt-1 text-sky-100/80">
                Os dados do aplicativo ja podem estar salvos, mas a listagem dos itens so funciona depois do OAuth com a conta do Mercado Livre.
              </p>
              <Button
                type="button"
                variant="ghost"
                disabled={startingOAuth}
                onClick={handleStartOAuth}
                className="mt-3 h-10 rounded-xl border border-sky-500/20 bg-sky-500/10 px-4 text-sm text-sky-100"
              >
                {startingOAuth ? 'Conectando...' : 'Conectar conta agora'}
              </Button>
            </div>
          ) : (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-4">
                <div>
                  <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Conta conectada</div>
                  <div className="mt-2 text-base font-semibold text-white">
                    {connectorMeta.oauthNickname || storeName || 'Loja Mercado Livre'}
                  </div>
                  <div className="mt-1 text-sm text-slate-400">
                    Usuário Mercado Livre: {connectorMeta.oauthUserId || 'n/a'}
                  </div>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  disabled={loadingTestItems}
                  onClick={handleLoadTestItems}
                  className="h-10 rounded-xl border border-sky-500/20 bg-sky-500/10 px-4 text-sm text-sky-100"
                >
                  {loadingTestItems ? 'Atualizando...' : 'Atualizar listagem'}
                </Button>
              </div>

              {loadingTestItems ? (
                <div className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-5 text-sm text-slate-400">
                  Carregando os primeiros itens da loja...
                </div>
              ) : null}

              {!loadingTestItems && testItems.length === 0 ? (
                <div className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-5 text-sm text-slate-400">
                  Nenhum item retornado pelo Mercado Livre para esta conta ainda.
                </div>
              ) : null}

              {testItems.length > 0 ? (
                <div className="grid gap-3">
                  {testItems.map((item) => (
                    <a
                      key={item.id}
                      href={item.permalink || '#'}
                      target="_blank"
                      rel="noreferrer"
                      className="grid gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-4 transition hover:border-sky-400/30 hover:bg-white/[0.05] md:grid-cols-[72px_minmax(0,1fr)_auto]"
                    >
                      <div className="h-[72px] w-[72px] overflow-hidden rounded-xl border border-white/10 bg-[#080e1d]">
                        {item.thumbnail ? (
                          <img src={item.thumbnail} alt={item.title} className="h-full w-full object-cover" />
                        ) : (
                          <div className="flex h-full items-center justify-center text-xs text-slate-500">sem foto</div>
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold text-white">{item.title || item.id}</div>
                        <div className="mt-1 text-xs uppercase tracking-[0.18em] text-slate-500">{item.id}</div>
                        <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-300">
                          <span className="rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1">
                            {item.currencyId || 'BRL'} {Number(item.price || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </span>
                          <span className="rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1">
                            estoque {Number(item.availableQuantity || 0)}
                          </span>
                          <span className="rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1">
                            {item.status || 'sem status'}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-start justify-end text-xs uppercase tracking-[0.16em] text-sky-200">
                        abrir
                      </div>
                    </a>
                  ))}
                </div>
              ) : null}
            </>
          )}
        </div>
      ) : null}

        {currentTab === 'orders' ? (
          <div className="grid gap-4">
            {!connectorMeta.id ? (
              <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 text-sm text-slate-300">
                Salve a conexão do Mercado Livre primeiro. Depois disso você libera a autenticação da conta e lista os pedidos.
              </div>
            ) : !connectorMeta.oauthConnected ? (
              <div className="rounded-xl border border-sky-400/20 bg-sky-500/10 p-4 text-sm text-sky-100">
                <p className="font-semibold">Falta conectar a conta da loja</p>
                <p className="mt-1 text-sky-100/80">
                  A leitura de pedidos so funciona depois do OAuth com a conta do Mercado Livre.
                </p>
                <Button
                  type="button"
                  variant="ghost"
                  disabled={startingOAuth}
                  onClick={handleStartOAuth}
                  className="mt-3 h-10 rounded-xl border border-sky-500/20 bg-sky-500/10 px-4 text-sm text-sky-100"
                >
                  {startingOAuth ? 'Conectando...' : 'Conectar conta agora'}
                </Button>
              </div>
            ) : (
              <>
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-4">
                  <div>
                    <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Pedidos da conta conectada</div>
                    <div className="mt-2 text-base font-semibold text-white">
                      {connectorMeta.oauthNickname || storeName || 'Loja Mercado Livre'}
                    </div>
                    <div className="mt-1 text-sm text-slate-400">
                      Total encontrado: {ordersPaging.total || 0}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="ghost"
                      disabled={loadingOrders}
                      onClick={() => handleLoadOrders(0)}
                      className="h-10 rounded-xl border border-sky-500/20 bg-sky-500/10 px-4 text-sm text-sky-100"
                    >
                      {loadingOrders ? 'Atualizando...' : 'Atualizar pedidos'}
                    </Button>
                    {ordersPaging.total > ordersPaging.offset + ordersPaging.limit ? (
                      <Button
                        type="button"
                        variant="ghost"
                        disabled={loadingOrders}
                        onClick={() => handleLoadOrders(ordersPaging.offset + ordersPaging.limit)}
                        className="h-10 rounded-xl border border-white/10 bg-white/[0.03] px-4 text-sm text-slate-200"
                      >
                        Proximos pedidos
                      </Button>
                    ) : null}
                  </div>
                </div>

                {loadingOrders ? (
                  <div className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-5 text-sm text-slate-400">
                    Carregando pedidos da loja...
                  </div>
                ) : null}

                {!loadingOrders && orders.length === 0 ? (
                  <div className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-5 text-sm text-slate-400">
                    Nenhum pedido retornado pelo Mercado Livre para esta conta ainda.
                  </div>
                ) : null}

                {orders.length > 0 ? (
                  <div className="grid gap-3">
                    {orders.map((order) => (
                      <div
                        key={order.id}
                        className="grid gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-4 md:grid-cols-[minmax(0,1fr)_auto]"
                      >
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <div className="text-sm font-semibold text-white">{getOrderDisplayName(order)}</div>
                            <span className="rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1 text-[10px] uppercase tracking-[0.16em] text-slate-300">
                              {order.status || 'sem status'}
                            </span>
                            {order.statusDetail ? (
                              <span className="rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1 text-[10px] uppercase tracking-[0.16em] text-slate-400">
                                {order.statusDetail}
                              </span>
                            ) : null}
                          </div>
                          <div className="mt-1 text-sm text-slate-400">Pedido {order.id}</div>
                          <div className="mt-3 text-sm text-slate-300">
                            {order.firstItemTitle || 'Pedido sem item principal identificado'}
                          </div>
                          <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-300">
                            <span className="rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1">
                              {order.currencyId || 'BRL'} {Number(order.totalAmount || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                            <span className="rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1">
                              itens {Number(order.totalItems || 0)}
                            </span>
                            <span className="rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1">
                              {order.dateCreated ? new Date(order.dateCreated).toLocaleString('pt-BR') : 'sem data'}
                            </span>
                          </div>
                        </div>
                        <div className="text-right text-xs uppercase tracking-[0.16em] text-slate-500">
                          {order.shippingId ? `envio ${order.shippingId}` : 'pedido'}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : null}
              </>
            )}
          </div>
        ) : null}

        {currentTab === 'questions' ? (
          <div className="grid gap-4">
            {!connectorMeta.id ? (
              <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 text-sm text-slate-300">
                Salve a conexão do Mercado Livre primeiro. Depois disso você libera a autenticação da conta e lista as perguntas.
              </div>
            ) : !connectorMeta.oauthConnected ? (
              <div className="rounded-xl border border-sky-400/20 bg-sky-500/10 p-4 text-sm text-sky-100">
                <p className="font-semibold">Falta conectar a conta da loja</p>
                <p className="mt-1 text-sky-100/80">
                  A leitura de perguntas so funciona depois do OAuth com a conta do Mercado Livre.
                </p>
                <Button
                  type="button"
                  variant="ghost"
                  disabled={startingOAuth}
                  onClick={handleStartOAuth}
                  className="mt-3 h-10 rounded-xl border border-sky-500/20 bg-sky-500/10 px-4 text-sm text-sky-100"
                >
                  {startingOAuth ? 'Conectando...' : 'Conectar conta agora'}
                </Button>
              </div>
            ) : (
              <>
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-4">
                  <div>
                    <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Perguntas da conta conectada</div>
                    <div className="mt-2 text-base font-semibold text-white">
                      {connectorMeta.oauthNickname || storeName || 'Loja Mercado Livre'}
                    </div>
                    <div className="mt-1 text-sm text-slate-400">
                      Total encontrado: {questionsPaging.total || 0}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="ghost"
                      disabled={loadingQuestions}
                      onClick={() => handleLoadQuestions(0)}
                      className="h-10 rounded-xl border border-sky-500/20 bg-sky-500/10 px-4 text-sm text-sky-100"
                    >
                      {loadingQuestions ? 'Atualizando...' : 'Atualizar perguntas'}
                    </Button>
                    {questionsPaging.total > questionsPaging.offset + questionsPaging.limit ? (
                      <Button
                        type="button"
                        variant="ghost"
                        disabled={loadingQuestions}
                        onClick={() => handleLoadQuestions(questionsPaging.offset + questionsPaging.limit)}
                        className="h-10 rounded-xl border border-white/10 bg-white/[0.03] px-4 text-sm text-slate-200"
                      >
                        Proximas perguntas
                      </Button>
                    ) : null}
                  </div>
                </div>

                {loadingQuestions ? (
                  <div className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-5 text-sm text-slate-400">
                    Carregando perguntas da loja...
                  </div>
                ) : null}

                {!loadingQuestions && questions.length === 0 ? (
                  <div className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-5 text-sm text-slate-400">
                    Nenhuma pergunta retornada pelo Mercado Livre para esta conta ainda.
                  </div>
                ) : null}

                {questions.length > 0 ? (
                  <div className="grid gap-3">
                    {questions.map((question) => {
                      const expanded = expandedQuestionId === question.id

                      return (
                        <div key={question.id} className="overflow-hidden rounded-xl border border-white/10 bg-white/[0.03]">
                          <button
                            type="button"
                            onClick={() => setExpandedQuestionId((current) => (current === question.id ? '' : question.id))}
                            className="flex w-full items-center gap-3 px-4 py-4 text-left transition hover:bg-white/[0.04]"
                          >
                            <div className="h-14 w-14 shrink-0 overflow-hidden rounded-xl border border-white/10 bg-[#080e1d]">
                              {question.itemThumbnail ? (
                                <img src={question.itemThumbnail} alt={question.itemTitle || question.itemId || 'Produto'} className="h-full w-full object-cover" />
                              ) : (
                                <div className="flex h-full items-center justify-center text-[10px] uppercase tracking-[0.16em] text-slate-500">sem foto</div>
                              )}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <div className="text-sm font-semibold text-white">{getQuestionDisplayName(question)}</div>
                                <span className="rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1 text-[10px] uppercase tracking-[0.16em] text-slate-300">
                                  {question.status || 'sem status'}
                                </span>
                                {question.answerStatus ? (
                                  <span className="rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1 text-[10px] uppercase tracking-[0.16em] text-slate-400">
                                    resposta {question.answerStatus}
                                  </span>
                                ) : null}
                              </div>
                              <div className="mt-1 truncate text-sm text-slate-300">{question.itemTitle || question.itemId || 'Produto da pergunta'}</div>
                              <div className="mt-2 line-clamp-2 text-sm leading-6 text-slate-200">{question.text || 'Pergunta sem texto.'}</div>
                            </div>
                            <ChevronDown className={cn('h-4 w-4 shrink-0 text-slate-400 transition-transform', expanded && 'rotate-180')} />
                          </button>

                          {expanded ? (
                            <div className="border-t border-white/10 px-4 pb-4 pt-3">
                              <div className="flex flex-wrap gap-2 text-xs text-slate-300">
                                <span className="rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1">
                                  pergunta {question.id}
                                </span>
                                {question.fromNickname ? (
                                  <span className="rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1">
                                    {question.fromNickname}
                                  </span>
                                ) : null}
                                {question.itemId ? (
                                  <span className="rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1">
                                    item {question.itemId}
                                  </span>
                                ) : null}
                                <span className="rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1">
                                  {question.dateCreated ? new Date(question.dateCreated).toLocaleString('pt-BR') : 'sem data'}
                                </span>
                              </div>
                              {question.answerText ? (
                                <div className="mt-3 rounded-xl border border-emerald-400/15 bg-emerald-500/5 p-3">
                                  <div className="text-[10px] uppercase tracking-[0.16em] text-emerald-300">Resposta</div>
                                  <div className="mt-2 text-sm leading-6 text-slate-200">{question.answerText}</div>
                                </div>
                              ) : (
                                <div className="mt-3 rounded-xl border border-amber-400/15 bg-amber-500/5 p-3">
                                  <div className="flex flex-wrap items-center justify-between gap-2">
                                    <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.16em] text-amber-300">
                                      <MessageCircle className="h-3.5 w-3.5" />
                                      Responder agora
                                    </div>
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      disabled={suggestingQuestionId === question.id}
                                      onClick={() => handleSuggestQuestion(question)}
                                      className="h-8 rounded-xl border border-emerald-400/20 bg-emerald-500/10 px-3 text-[11px] text-emerald-100"
                                    >
                                      {suggestingQuestionId === question.id ? 'Gerando...' : 'Sugerir com agente'}
                                    </Button>
                                  </div>
                                  <textarea
                                    value={questionDrafts?.[question.id] || ''}
                                    onChange={(event) =>
                                      setQuestionDrafts((current) => ({
                                        ...current,
                                        [question.id]: event.target.value,
                                      }))
                                    }
                                    placeholder="Digite a resposta que sera publicada no Mercado Livre"
                                    className="mt-3 min-h-[108px] w-full rounded-xl border border-white/10 bg-[#080e1d] px-3 py-3 text-sm text-white outline-none transition focus:border-sky-400/30"
                                  />
                                  <div className="mt-3 flex justify-end">
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      disabled={answeringQuestionId === question.id}
                                      onClick={() => handleAnswerQuestion(question.id)}
                                      className="h-10 rounded-xl border border-sky-500/20 bg-sky-500/10 px-4 text-sm text-sky-100"
                                    >
                                      {answeringQuestionId === question.id ? 'Enviando...' : 'Responder no Mercado Livre'}
                                    </Button>
                                  </div>
                                </div>
                              )}
                            </div>
                          ) : null}
                        </div>
                      )
                    })}
                  </div>
                ) : null}
              </>
            )}
          </div>
        ) : null}

      {currentTab === 'tutorial' ? (
        <div className="grid gap-7 bg-transparent p-0 text-sm text-slate-300">
          <div className="grid gap-2">
            <p className="text-base font-semibold text-white">Tutorial rapido</p>
            <p className="text-slate-400">Como conectar o Mercado Livre sem complicacao</p>
          </div>

          <div className="grid gap-4 bg-transparent p-0">
            <p className="text-sm font-semibold text-white">O que e cada coisa</p>
            <div className="grid gap-3">
              {[
                {
                  step: '01',
                  title: 'APP ID',
                  description: 'E o numero do seu aplicativo no Mercado Livre.',
                },
                {
                  step: '02',
                  title: 'CLIENT SECRET',
                  description: 'E a senha do aplicativo. Copie e cole sem alterar nada.',
                },
                {
                  step: '03',
                  title: 'OAuth',
                  description: 'É a tela onde você permite que seu sistema acesse sua loja.',
                },
              ].map((item) => (
                <div key={item.step} className="rounded-2xl border border-white/10 bg-[#0a1020] p-4">
                  <div className="flex items-start gap-4">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-sky-500/20 bg-sky-500/10 text-sm font-semibold text-sky-100">
                      {item.step}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-white">{item.title}</p>
                      <p className="mt-2 text-sm leading-6 text-slate-400">{item.description}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="grid gap-4">
            <p className="text-sm font-semibold text-white">Passo a passo</p>
            <div className="grid gap-3">
              {[
                '1. Clique em Abrir painel do Mercado Livre.',
                '2. Entre na sua conta.',
                '3. Clique em Meus aplicativos.',
                '4. Clique em Criar aplicativo.',
                '5. Escolha o tipo Web.',
                '6. No Redirect URI, cole o Link de retorno abaixo.',
                '7. No Webhook, cole o Link de notificacoes abaixo.',
                '8. Salve o aplicativo.',
                '9. Copie o APP ID e cole no campo APP ID aqui no sistema.',
                '10. Copie o CLIENT SECRET e cole no campo CLIENT SECRET aqui no sistema.',
                '11. Clique em Salvar conexão.',
                '12. Clique em Conectar conta.',
                '13. Quando o Mercado Livre abrir, clique em Permitir.',
                '14. Volte na aba Teste e clique em Atualizar listagem.',
              ].map((item) => (
                <div key={item} className="rounded-2xl border border-white/10 bg-[#0a1020] px-4 py-3 text-sm leading-6 text-slate-300">
                  {item}
                </div>
              ))}
            </div>
          </div>

          <div className="grid gap-4">
            <p className="text-sm font-semibold text-white">Erros comuns</p>
            <div className="grid gap-3">
              {[
                'Colar o Redirect URI errado. Tem que ser exatamente igual.',
                'Colar um Webhook sem o parametro do projeto no final.',
                'Trocar APP ID com CLIENT SECRET.',
                'Salvar a conexão e esquecer de clicar em Conectar conta.',
                'Tentar testar antes de permitir o acesso no OAuth.',
              ].map((item) => (
                <div key={item} className="rounded-2xl border border-white/10 bg-[#0a1020] px-4 py-3 text-sm leading-6 text-slate-300">
                  {item}
                </div>
              ))}
            </div>
            <a
              href="https://developers.mercadolivre.com.br/devcenter"
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-11 items-center justify-center rounded-xl border border-sky-500/20 bg-sky-500/10 px-4 text-sm font-medium text-sky-100 transition hover:bg-sky-500/20"
            >
              Abrir painel do Mercado Livre
            </a>
          </div>

          <div className="grid gap-4">
            {[
              {
                id: 'redirect',
                label: 'Link de retorno',
                value: redirectUri,
                helper: 'Use este link no campo de redirect URI do aplicativo.',
              },
              {
                id: 'webhook',
                label: 'Link de notificacoes',
                value: webhookUrl,
                helper: 'Use este link no campo de webhook. Ele ja vai com a identificacao deste projeto.',
              },
            ].map((item) => (
              <div key={item.id} className="rounded-2xl border border-white/10 bg-[#0a1020] p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{item.label}</p>
                    <p className="mt-2 text-sm leading-6 text-slate-400">{item.helper}</p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => copyTutorialValue(item.id, item.value)}
                    className="h-9 shrink-0 rounded-xl border border-sky-500/20 bg-sky-500/10 px-3 text-xs text-sky-100"
                  >
                    {copiedField === item.id ? <Check className="mr-1.5 h-3.5 w-3.5" /> : <Copy className="mr-1.5 h-3.5 w-3.5" />}
                    {copiedField === item.id ? 'Copiado' : 'Copiar'}
                  </Button>
                </div>

                <div className="mt-3 rounded-xl border border-white/10 bg-[#08101f] px-3 py-3 font-mono text-xs leading-6 text-sky-200 break-all whitespace-pre-wrap">
                  {item.value}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  )
}

