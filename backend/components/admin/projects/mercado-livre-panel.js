'use client'

import { useEffect, useState } from 'react'
import { Check, Copy, Files, MessageCircle, MessageSquare, PackageSearch, Store } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

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
  const [copiedField, setCopiedField] = useState('')
  const [connectorMeta, setConnectorMeta] = useState({
    id: null,
    oauthConnected: false,
    oauthNickname: '',
    oauthUserId: '',
  })
  const [feedback, setFeedback] = useState(() =>
    initialNotice === 'oauth_ok'
      ? { tone: 'success', text: 'Conta do Mercado Livre conectada. Agora voce ja pode testar a listagem da loja.' }
      : initialNotice === 'oauth_error'
        ? { tone: 'error', text: 'Nao foi possivel concluir a autenticacao do Mercado Livre.' }
        : null,
  )
  const tabs = [
    { id: 'connection', label: 'Conexao', icon: Store },
    { id: 'test', label: 'Teste', icon: PackageSearch },
    { id: 'orders', label: 'Pedidos', icon: Files },
    { id: 'questions', label: 'Perguntas', icon: MessageSquare },
    { id: 'tutorial', label: 'Tutorial', icon: Files },
  ]

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

  async function copyTutorialValue(field, value) {
    try {
      await navigator.clipboard.writeText(String(value || ''))
      setCopiedField(field)
      window.setTimeout(() => {
        setCopiedField((current) => (current === field ? '' : current))
      }, 1800)
    } catch {
      setFeedback({ tone: 'error', text: 'Nao foi possivel copiar o link.' })
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
    onFooterStateChange?.({
      step,
      activeTab: currentTab,
      saving: step === 1 ? resolvingStore : savingConnector,
    })
  }, [currentTab, onFooterStateChange, resolvingStore, savingConnector, step])

  useEffect(() => {
    if (currentTab !== 'test' || !connectorMeta.oauthConnected) {
      return
    }

    void handleLoadTestItems()
  }, [connectorMeta.oauthConnected, currentTab])

  useEffect(() => {
    if (currentTab !== 'orders' || !connectorMeta.oauthConnected) {
      return
    }

    void handleLoadOrders()
  }, [connectorMeta.oauthConnected, currentTab])

  useEffect(() => {
    if (currentTab !== 'questions' || !connectorMeta.oauthConnected) {
      return
    }

    void handleLoadQuestions()
  }, [connectorMeta.oauthConnected, currentTab])

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
            text: data.error || 'Nao foi possivel localizar o seller_id automaticamente. Preencha manualmente.',
          })
          return
        }

        setFeedback({
          tone: 'success',
          text:
            product.source === 'api'
              ? 'Loja identificada pelo item publico do Mercado Livre.'
              : product.source === 'api_html'
                ? `Loja identificada pelo item publico e confirmada pelo HTML da ${product.sourceType === 'store_page' ? 'pagina da loja' : 'pagina do produto'}.`
              : product.source === 'html_retry'
                ? `Loja identificada apos nova tentativa automatica no HTML da ${product.sourceType === 'store_page' ? 'pagina da loja' : 'pagina do produto'}.`
                : 'Loja identificada automaticamente.',
        })
      } catch {
        setSeedId('')
        setStoreName((current) => current || 'Loja Mercado Livre')
        setStep(2)
        setFeedback({
          tone: 'error',
          text: 'Nao foi possivel localizar o seller_id automaticamente. Preencha manualmente.',
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
        setFeedback({ tone: 'error', text: data.error || 'Nao foi possivel salvar a conexao do Mercado Livre.' })
        return
      }

      applyConnector(data.connector)
      setFeedback({
        tone: 'success',
        text: 'Conexao salva. O proximo passo e conectar a conta da loja no OAuth do Mercado Livre.',
      })
    } catch {
      setFeedback({ tone: 'error', text: 'Nao foi possivel salvar a conexao do Mercado Livre.' })
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
        setFeedback({ tone: 'error', text: data.error || 'Nao foi possivel iniciar a autenticacao do Mercado Livre.' })
        return
      }

      window.location.href = data.authorizationUrl
    } catch {
      setFeedback({ tone: 'error', text: 'Nao foi possivel iniciar a autenticacao do Mercado Livre.' })
    } finally {
      setStartingOAuth(false)
    }
  }

  async function handleLoadTestItems() {
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
        setFeedback({ tone: 'error', text: data.error || 'Nao foi possivel carregar os itens da loja.' })
        return
      }

      if (data.connector) {
        applyConnector(data.connector)
      }

      setTestItems(Array.isArray(data.items) ? data.items : [])
    } catch {
      setTestItems([])
      setFeedback({ tone: 'error', text: 'Nao foi possivel carregar os itens da loja.' })
    } finally {
      setLoadingTestItems(false)
    }
  }

  async function handleLoadOrders(nextOffset = 0) {
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
        setFeedback({ tone: 'error', text: data.error || 'Nao foi possivel carregar os pedidos da loja.' })
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
      setFeedback({ tone: 'error', text: 'Nao foi possivel carregar os pedidos da loja.' })
    } finally {
      setLoadingOrders(false)
    }
  }

  async function handleLoadQuestions(nextOffset = 0) {
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
        setFeedback({ tone: 'error', text: data.error || 'Nao foi possivel carregar as perguntas da loja.' })
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
      setFeedback({ tone: 'error', text: 'Nao foi possivel carregar as perguntas da loja.' })
    } finally {
      setLoadingQuestions(false)
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
        setFeedback({ tone: 'error', text: data.error || 'Nao foi possivel responder a pergunta.' })
        return
      }

      setQuestionDrafts((current) => ({ ...current, [questionId]: '' }))
      setFeedback({ tone: 'success', text: 'Pergunta respondida no Mercado Livre.' })
      await handleLoadQuestions(questionsPaging.offset || 0)
    } catch {
      setFeedback({ tone: 'error', text: 'Nao foi possivel responder a pergunta.' })
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
        setFeedback({ tone: 'error', text: data.error || 'Nao foi possivel gerar sugestao com o agente.' })
        return
      }

      setQuestionDrafts((current) => ({
        ...current,
        [question.id]: String(data.text || '').trim(),
      }))
    } catch {
      setFeedback({ tone: 'error', text: 'Nao foi possivel gerar sugestao com o agente.' })
    } finally {
      setSuggestingQuestionId('')
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
              onClick={() => {
                setActiveTab(tab.id)
                onTabChange?.(tab.id)
              }}
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

      {currentTab === 'connection' ? (
        <div className="grid gap-4">
          {loadingConnector ? (
            <div className="rounded-xl bg-white/[0.03] px-3 py-2 text-xs uppercase tracking-[0.16em] text-slate-500">
              carregando conector
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
                A resolucao tenta primeiro o item publico da API e, se necessario, refaz a leitura do HTML por alguns segundos para achar o <code className="rounded bg-white/5 px-1 py-0.5 text-sky-200">seller_id</code>.
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
                <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3 text-xs text-slate-400">
                  {seedId ? `Identificador sugerido: ${seedId}` : 'Resolucao automatica indisponivel. Preencha manualmente.'}
                </div>
                {connectorMeta.id ? (
                  <div className="rounded-xl border border-sky-400/20 bg-sky-500/10 p-3 text-sm text-sky-100">
                    {connectorMeta.oauthConnected
                      ? `Conta conectada: ${connectorMeta.oauthNickname || 'loja autorizada'}${connectorMeta.oauthUserId ? ` (${connectorMeta.oauthUserId})` : ''}`
                      : 'Conexao salva. Falta autorizar a conta da loja no OAuth do Mercado Livre.'}
                  </div>
                ) : null}
                <div className="grid gap-3">
                  <label className="block">
                    <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Nome da loja</span>
                    <input value={storeName} onChange={(event) => setStoreName(event.target.value)} className="mt-2 h-11 w-full rounded-xl border border-white/10 bg-[#080e1d] px-3 text-sm text-white outline-none" />
                  </label>
                  <label className="block">
                    <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">App ID</span>
                    <input value={appId} onChange={(event) => setAppId(event.target.value)} className="mt-2 h-11 w-full rounded-xl border border-white/10 bg-[#080e1d] px-3 text-sm text-white outline-none" />
                  </label>
                  <label className="block">
                    <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Client secret</span>
                    <input value={clientSecret} onChange={(event) => setClientSecret(event.target.value)} className="mt-2 h-11 w-full rounded-xl border border-white/10 bg-[#080e1d] px-3 text-sm text-white outline-none" />
                  </label>
                  <label className="block">
                    <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Seed ID</span>
                    <input value={seedId} onChange={(event) => setSeedId(event.target.value)} className="mt-2 h-11 w-full rounded-xl border border-white/10 bg-[#080e1d] px-3 text-sm text-white outline-none" />
                  </label>
                </div>
              </form>
              <div className="rounded-xl border border-amber-400/20 bg-amber-500/10 p-3 text-sm text-amber-100">
                <p className="font-semibold">Pegue os dados direto no Mercado Livre</p>
                <p className="mt-1 text-amber-50/80">
                  Abra o painel de apps para copiar o App ID e o Client Secret antes de salvar a loja.
                </p>
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
                    disabled={savingConnector || startingOAuth || !connectorMeta.id}
                    onClick={handleStartOAuth}
                    className="h-9 rounded-xl border border-sky-500/20 bg-sky-500/10 px-3 text-xs font-semibold uppercase tracking-[0.16em] text-sky-100 disabled:opacity-50"
                  >
                    {startingOAuth ? 'Conectando...' : connectorMeta.oauthConnected ? 'Reconectar conta' : 'Conectar conta'}
                  </Button>
                </div>
              </div>
            </>
          ) : null}
        </div>
      ) : null}

        {currentTab === 'test' ? (
        <div className="grid gap-4">
          {!connectorMeta.id ? (
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 text-sm text-slate-300">
              Salve a conexao do Mercado Livre primeiro. Depois disso voce libera a autenticacao da conta e testa os primeiros itens da loja.
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
                    Usuario Mercado Livre: {connectorMeta.oauthUserId || 'n/a'}
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
                Salve a conexao do Mercado Livre primeiro. Depois disso voce libera a autenticacao da conta e lista os pedidos.
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
                            <div className="text-sm font-semibold text-white">Pedido {order.id}</div>
                            <span className="rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1 text-[10px] uppercase tracking-[0.16em] text-slate-300">
                              {order.status || 'sem status'}
                            </span>
                            {order.statusDetail ? (
                              <span className="rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1 text-[10px] uppercase tracking-[0.16em] text-slate-400">
                                {order.statusDetail}
                              </span>
                            ) : null}
                          </div>
                          <div className="mt-1 text-sm text-slate-400">
                            {order.buyerNickname || [order.buyerFirstName, order.buyerLastName].filter(Boolean).join(' ') || 'Comprador nao identificado'}
                          </div>
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
                Salve a conexao do Mercado Livre primeiro. Depois disso voce libera a autenticacao da conta e lista as perguntas.
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
                    {questions.map((question) => (
                      <div key={question.id} className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
                        <div className="flex flex-wrap items-center gap-2">
                          <div className="text-sm font-semibold text-white">Pergunta {question.id}</div>
                          <span className="rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1 text-[10px] uppercase tracking-[0.16em] text-slate-300">
                            {question.status || 'sem status'}
                          </span>
                          {question.answerStatus ? (
                            <span className="rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1 text-[10px] uppercase tracking-[0.16em] text-slate-400">
                              resposta {question.answerStatus}
                            </span>
                          ) : null}
                        </div>
                        <div className="mt-2 text-sm leading-6 text-slate-200">{question.text || 'Pergunta sem texto.'}</div>
                        <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-300">
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
                    ))}
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
            <p className="text-slate-400">Como conectar o Mercado Livre</p>
            <p className="leading-6 text-slate-400">
              Aqui funciona em 3 etapas: primeiro voce salva a loja com os dados do app, depois conecta a conta do Mercado Livre via OAuth e por fim valida tudo na aba de teste listando os primeiros itens da loja.
            </p>
          </div>

          <div className="grid gap-4 bg-transparent p-0">
            <p className="text-sm font-semibold text-white">Painel de apps do Mercado Livre</p>
            <div className="grid gap-3">
              {[
                {
                  step: '01',
                  title: 'Cadastrar a loja',
                  description:
                    'Crie um aplicativo do tipo Web, ative as opcoes pedidas pelo Mercado Livre e copie o APP ID e o CLIENT SECRET para este cadastro.',
                },
                {
                  step: '02',
                  title: 'Conectar a conta',
                  description:
                    'Depois de salvar, clique em conectar para autorizar a conta do Mercado Livre e finalizar a integracao OAuth.',
                },
                {
                  step: '03',
                  title: 'Testar a listagem',
                  description:
                    'Abra a aba Teste para buscar os primeiros itens da loja usando a conta autorizada.',
                },
              ].map((item) => (
                <div key={item.step} className="rounded-2xl border border-white/10 bg-[#0a1020] p-4">
                  <div className="flex items-start gap-4">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-sky-500/20 bg-sky-500/10 text-sm font-semibold text-sky-100">
                      {item.step}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-white">{item.title}</p>
                      <p className="mt-2 text-sm leading-6 text-slate-400">
                        {item.description.split('APP ID').map((segment, index, array) => (
                          <span key={`${item.step}-app-${index}`}>
                            {segment.split('CLIENT SECRET').map((innerSegment, innerIndex, innerArray) => (
                              <span key={`${item.step}-secret-${index}-${innerIndex}`}>
                                {innerSegment.split('Web').map((webSegment, webIndex, webArray) => (
                                  <span key={`${item.step}-web-${index}-${innerIndex}-${webIndex}`}>
                                    {webSegment.split('Teste').map((testSegment, testIndex, testArray) => (
                                      <span key={`${item.step}-test-${index}-${innerIndex}-${webIndex}-${testIndex}`}>
                                        {testSegment}
                                        {testIndex < testArray.length - 1 ? (
                                          <code className="rounded bg-white/5 px-1 py-0.5 text-sky-200">Teste</code>
                                        ) : null}
                                      </span>
                                    ))}
                                    {webIndex < webArray.length - 1 ? (
                                      <code className="rounded bg-white/5 px-1 py-0.5 text-sky-200">Web</code>
                                    ) : null}
                                  </span>
                                ))}
                                {innerIndex < innerArray.length - 1 ? (
                                  <code className="rounded bg-white/5 px-1 py-0.5 text-sky-200">CLIENT SECRET</code>
                                ) : null}
                              </span>
                            ))}
                            {index < array.length - 1 ? (
                              <code className="rounded bg-white/5 px-1 py-0.5 text-sky-200">APP ID</code>
                            ) : null}
                          </span>
                        ))}
                      </p>
                    </div>
                  </div>
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
            <p className="text-sm font-semibold text-white">Links para configurar no Mercado Livre</p>
            <p className="text-sm leading-6 text-slate-400">
              Copie exatamente estes enderecos para o app do Mercado Livre.
            </p>
          </div>

          <div className="grid gap-4">
            {[
              {
                id: 'redirect',
                label: 'Link de retorno',
                value: 'https://infrastudio.pro/api/admin/conectores/mercado-livre/callback',
                helper: 'Use este link no campo de redirect URI do aplicativo.',
              },
              {
                id: 'webhook',
                label: 'Link de notificacoes',
                value: 'https://infrastudio.pro/api/mercado-livre/webhook?canal=ml',
                helper: 'Em alguns casos, o Mercado Livre pode nao aceitar esse endereco direto nesse campo.',
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

