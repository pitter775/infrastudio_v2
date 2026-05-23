'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AnimatePresence, motion } from 'framer-motion'
import { Bot, CalendarDays, Check, ChevronRight, ClipboardCopy, Files, History, MessageCircle, MessageSquare, PackageSearch, PlugZap, RotateCcw, Sparkles, Store, Wand2, X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { JsonCodeBlock } from '@/components/ui/json-code-block'
import { cn } from '@/lib/utils'
import { AgentRichEditor, plainTextToEditorHtml, richTextToPlainText } from './agent-rich-editor'
import { buildAgentDraftConfig, buildMergedAgentSummary, buildVersionChangeNote, resolveEntityAvatarUrl } from './agent-config-utils'
import { getPanelAccentClasses, getToneClasses } from './project-detail-layout'
import { PlaceholderPanel, SheetInternalTabs, SheetPanelHeader } from './project-detail-sheet'
import { resolveAgentTab } from './project-detail-query'

function TinyEntityAvatar({ src, label }) {
  if (!src) {
    return null
  }

  return (
    <span
      className="inline-flex h-4 w-4 shrink-0 overflow-hidden rounded-full bg-slate-800"
      style={{
        backgroundImage: `url(${src})`,
        backgroundPosition: 'center',
        backgroundSize: 'cover',
      }}
      aria-hidden="true"
      title={label || ""}
    />
  )
}

function buildAgentLlmGuidePrompt({ project, agent, draftAgentJson, connectionItems, hasUnsavedChanges }) {
  return [
    'Contrato da aba Agente do InfraStudio.',
    'Use este contrato como fonte de verdade para orientar dúvidas sobre configuração, capacidades e integrações do agente neste projeto.',
    'Não invente opções fora deste contrato. Se algum dado faltar, peça o dado exato que falta.',
    '',
    'Objetivo da aba Agente:',
    '- Configurar identidade, prompt/base de atendimento, site, logo, status e conexões do agente.',
    '- O agente só responde bem quando o prompt explica o negócio, limites, tom, oferta, regras e quando usar integrações.',
    '- O agente pode depender de APIs, WhatsApp, Chat widget, Mercado Livre e Google Agenda vinculados ao projeto.',
    '- O prompt não substitui configuração técnica: cada integração precisa ser cadastrada, vinculada, ativa e salva no painel correto.',
    '',
    'Abas internas da aba Agente:',
    '- Editar agente: ajusta nome, site, logo e prompt/base de conhecimento do agente.',
    '- Conexões: mostra integrações disponíveis para abrir e configurar APIs, WhatsApp, Chat widget, Mercado Livre e Google Agenda.',
    '- Histórico: mostra versões anteriores do agente e permite restaurar versão quando necessário.',
    '- Ver JSON: mostra o rascunho técnico atual do agente, incluindo configuracoes/runtimeConfig.',
    '- Botão Copiar para LLM: copia este contrato e o estado atual para tirar dúvidas fora do InfraStudio. Não abre nova aba.',
    '',
    'Políticas de preenchimento do agente:',
    '- Nome: deve identificar claramente o assistente do projeto.',
    '- Site: use a URL oficial do negócio quando existir. Ajuda a compor identidade e contexto.',
    '- Logo: use URL pública da marca ou deixe vazio quando não houver asset confiável.',
    '- Prompt/base: deve conter fatos reais do negócio, o que o agente pode ou não prometer, tom de voz, serviços/produtos, regras comerciais e instruções de atendimento.',
    '- Não colocar segredos, tokens, chaves privadas ou credenciais no prompt.',
    '- Não usar o prompt para corrigir integração mal configurada. APIs, WhatsApp e widgets devem ser configurados nas abas próprias.',
    '- Se o agente usa APIs parecidas, o prompt pode reforçar limites, mas a decisão principal deve vir do runtime configurado de cada API.',
    '- Se o agente agenda horários, o prompt deve explicar quando oferecer agenda, mas disponibilidade, duração, dias, horários, antecedência e convite vêm da aba Google Agenda.',
    '- Se o agente vende por Mercado Livre, o prompt deve explicar política comercial, tom e limites, mas catálogo, vitrine, pedidos, perguntas e respostas publicadas dependem da aba Mercado Livre.',
    '- Alterações locais precisam ser salvas para virar estado real do agente.',
    '',
    'Políticas de conexões:',
    '- APIs: usadas quando o agente precisa consultar, buscar catálogo ou enviar dados externos.',
    '- WhatsApp: usado para atendimento e continuidade fora do widget, quando canal estiver ativo/conectado.',
    '- Chat widget: controla o chat público/embutido e contexto enviado pelo site.',
    '- Mercado Livre: usado quando há loja/conector com catálogo real, snapshot local, loja pública e rotas de produto.',
    '- Google Agenda: usado quando há conexão OAuth ativa para consultar disponibilidade e criar, remarcar ou cancelar eventos.',
    '- Conexões precisam estar ativas e corretamente vinculadas ao agente para participar do runtime.',
    '',
    'Capacidades atuais do sistema:',
    '- Simulador do agente usa runtime real efêmero: IA real, APIs reais, custo/token ativo e sem gravar chats/mensagens.',
    '- Runtime do chat é fail-closed quando faltar agente válido, promptBase, chave OpenAI ou resposta útil do modelo.',
    '- Runtime de API usa contrato salvo: headers, responsePath, previewPath, fields, presentation e responseShape quando configurados.',
    '- Mercado Livre já cobre OAuth, snapshot de produtos, loja pública em /loja/{slug}, página /loja/{slug}/produto/{produtoSlug}, chat widget na loja, pedidos, perguntas, sugestão com IA e dashboard analítico mediante ativação.',
    '- A loja Mercado Livre pode usar domínio próprio do cliente; a configuração de DNS/domínio fica na aba Mercado Livre > Loja > Domínio.',
    '- Google Agenda já cobre OAuth, seleção de calendário, duração padrão, antecedência mínima, dias/horários permitidos, timezone, convite por email e criação de eventos pelo agente.',
    '- WhatsApp só deve ser oferecido quando existir canal ativo/conectado no agente/projeto.',
    '- Billing é por projeto e pode bloquear uso quando o plano/limite não permitir a capacidade desejada.',
    '',
    'Políticas de histórico:',
    '- Versões servem para comparar e restaurar configurações anteriores.',
    '- Restaurar versão deve ser usado quando uma edição piorou o comportamento.',
    '- Antes de restaurar, confira se a versão antiga ainda faz sentido com as integrações atuais.',
    '',
    'Checklist de qualidade do prompt:',
    '- Diz quem é o agente e qual negócio representa.',
    '- Explica o público atendido.',
    '- Lista serviços/produtos reais.',
    '- Define tom de voz.',
    '- Define limites do que não deve responder ou prometer.',
    '- Orienta quando pedir dados do cliente.',
    '- Orienta quando consultar integrações, sem inventar dados se a integração não retornar informação.',
    '- Evita conteúdo genérico demais.',
    '',
    'Estado atual do projeto e agente:',
    JSON.stringify(
      {
        projeto: {
          id: project?.id || null,
          nome: project?.name || project?.nome || '',
          slug: project?.slug || '',
          routeKey: project?.routeKey || '',
        },
        agenteSalvo: {
          id: agent?.id || null,
          nome: agent?.name || agent?.nome || '',
          ativo: agent?.active !== false,
          siteUrl: agent?.siteUrl || '',
          logoUrl: agent?.logoUrl || '',
          runtimeConfig: agent?.runtimeConfig ?? null,
        },
        rascunhoAtual: draftAgentJson,
        haAlteracoesNaoSalvas: hasUnsavedChanges,
        capacidadesDetectadas: {
          apis: Number(project?.directConnections?.apis || project?.integrations?.apis || project?.apis?.length || 0),
          whatsapp: Number(project?.directConnections?.whatsapp || project?.integrations?.whatsapp || project?.whatsappChannels?.length || 0),
          chatWidget: Number(project?.directConnections?.chatWidget || project?.integrations?.chatWidget || project?.chatWidgets?.length || 0),
          mercadoLivre: Number(project?.directConnections?.mercadoLivre || 0),
          googleAgenda: Number(project?.directConnections?.googleCalendar || 0),
        },
        billing: project?.billing ?? null,
        conexoes: connectionItems.map((item) => ({
          tipo: item.type,
          titulo: item.title,
          descricao: item.description,
          painel: item.panel,
        })),
      },
      null,
      2,
    ),
    '',
    'Ao responder, use português do Brasil e indique exatamente o que o usuário deve revisar no painel do InfraStudio.',
  ].join('\n')
}

export function ProjectPanel({
  project,
  initialAgentTab = 'edit',
  onAgentTabChange,
  onOpenConnection,
  onCloseSheet = null,
}) {
  const router = useRouter()
  const agent = project.agent
  const projectIdentifier = project.routeKey || project.slug || project.id
  const agentServerSnapshot = useMemo(
    () =>
      JSON.stringify({
        id: agent?.id || '',
        name: agent?.name || '',
        prompt: agent?.prompt || agent?.description || '',
        structuredConfig: agent?.structuredConfig ?? null,
        structuredConfigDraft: agent?.structuredConfigDraft ?? null,
        logoUrl: agent?.logoUrl || '',
        siteUrl: agent?.siteUrl || '',
        active: agent?.active !== false,
        versions: Array.isArray(agent?.versions)
          ? agent.versions.map((item) => ({
              id: item?.id || '',
              versionNumber: item?.versionNumber || '',
              createdAt: item?.createdAt || '',
              source: item?.source || '',
            }))
          : [],
      }),
    [agent],
  )
  const initialAgentName = agent?.name || ''
  const initialPrompt = agent?.prompt || agent?.description || ''
  const initialLogoUrl = agent?.logoUrl || ''
  const initialSiteUrl = agent?.siteUrl || ''
  const [agentActive, setAgentActive] = useState(agent?.active !== false)
  const [versions, setVersions] = useState(agent?.versions || [])
  const [restoringId, setRestoringId] = useState('')
  const [restoreConfirmId, setRestoreConfirmId] = useState('')
  const [savingActive, setSavingActive] = useState(false)
  const [savingDraft, setSavingDraft] = useState(false)
  const [structuringAgent, setStructuringAgent] = useState(false)
  const [applyingStructure, setApplyingStructure] = useState(false)
  const [creatingAgent, setCreatingAgent] = useState(false)
  const [generatingSiteSummary, setGeneratingSiteSummary] = useState(false)
  const [agentName, setAgentName] = useState(initialAgentName)
  const [siteUrl, setSiteUrl] = useState(initialSiteUrl)
  const [logoUrl, setLogoUrl] = useState(initialLogoUrl)
  const [promptValue, setPromptValue] = useState(() => plainTextToEditorHtml(initialPrompt))
  const [structuredDraft, setStructuredDraft] = useState(agent?.structuredConfigDraft || null)
  const [promptAutofillPendingClear, setPromptAutofillPendingClear] = useState(false)
  const [promptEditedByUser, setPromptEditedByUser] = useState(false)
  const [rollbackStatus, setRollbackStatus] = useState({ type: 'idle', message: '' })
  const [editorStatus, setEditorStatus] = useState({ type: 'idle', message: '' })
  const [siteSummaryStatus, setSiteSummaryStatus] = useState({ type: 'idle', message: '' })
  const [activeAgentTab, setActiveAgentTab] = useState(resolveAgentTab(initialAgentTab) || 'edit')
  const agentTabs = [
    { id: 'edit', label: 'Editar agente', icon: Wand2 },
    { id: 'structure', label: 'Estrutura', icon: Sparkles },
    { id: 'connections', label: 'Conexões', icon: PlugZap },
    { id: 'history', label: 'Histórico', icon: History },
    { id: 'json', label: 'Ver JSON', icon: Files },
  ]
  const normalizedPrompt = useMemo(() => richTextToPlainText(promptValue), [promptValue])
  const [structuredEditor, setStructuredEditor] = useState(agent?.structuredConfig || agent?.structuredConfigDraft || null)
  const activeStructuredConfig = structuredEditor || structuredDraft || agent?.structuredConfig || null
  const draftAgentConfig = useMemo(
    () =>
      buildAgentDraftConfig({
        runtimeConfig: agent?.runtimeConfig ?? null,
        structuredConfig: structuredEditor || agent?.structuredConfig || null,
        structuredConfigDraft: structuredDraft,
        promptText: normalizedPrompt,
        siteUrl,
        logoUrl,
      }),
    [agent?.runtimeConfig, agent?.structuredConfig, logoUrl, normalizedPrompt, siteUrl, structuredDraft, structuredEditor],
  )
  const draftAgentJson = useMemo(
    () => ({
      id: agent?.id || null,
      slug: agent?.slug || null,
      name: agentName.trim() || initialAgentName || agent?.name || agent?.nome || '',
      description: agent?.description || agent?.descricao || '',
      prompt: normalizedPrompt,
      configuracoes: draftAgentConfig,
      siteUrl: draftAgentConfig.brand?.siteUrl || '',
      logoUrl: draftAgentConfig.brand?.logoUrl || '',
      active: agentActive,
    }),
    [agent?.description, agent?.descricao, agent?.id, agent?.name, agent?.nome, agent?.slug, agentActive, agentName, draftAgentConfig, initialAgentName, normalizedPrompt],
  )
  const hasUnsavedChanges =
    agentName.trim() !== initialAgentName.trim() ||
    normalizedPrompt !== initialPrompt.trim() ||
    siteUrl.trim() !== initialSiteUrl.trim() ||
    logoUrl.trim() !== initialLogoUrl.trim()
  const canSaveAgent =
    activeAgentTab === 'edit' &&
    Boolean(agent?.id) &&
    !savingDraft &&
    Boolean(agentName.trim()) &&
    Boolean(normalizedPrompt.trim()) &&
    hasUnsavedChanges
  const currentVersionSnapshot = useMemo(
    () => ({
      id: 'current',
      versionNumber: 'Atual',
      name: agentName.trim() || initialAgentName,
      description: '',
      prompt: normalizedPrompt,
      runtimeConfig: draftAgentConfig.runtimeConfig ?? null,
      configuracoes: draftAgentConfig,
      note: hasUnsavedChanges ? 'rascunho local' : 'estado atual salvo',
      source: hasUnsavedChanges ? 'draft' : 'current',
      createdAt: '',
      active: agentActive,
    }),
    [agentActive, agentName, draftAgentConfig, hasUnsavedChanges, initialAgentName, normalizedPrompt],
  )

  useEffect(() => {
    setAgentName(initialAgentName)
    setSiteUrl(initialSiteUrl)
    setLogoUrl(initialLogoUrl)
    setPromptValue(plainTextToEditorHtml(initialPrompt))
    setStructuredDraft(agent?.structuredConfigDraft || null)
    setStructuredEditor(agent?.structuredConfig || agent?.structuredConfigDraft || null)
    setPromptAutofillPendingClear(false)
    setPromptEditedByUser(false)
    setAgentActive(agent?.active !== false)
    setVersions(agent?.versions || [])
    setEditorStatus({ type: 'idle', message: '' })
  }, [agent?.active, agent?.structuredConfig, agent?.structuredConfigDraft, agent?.versions, agentServerSnapshot, initialAgentName, initialLogoUrl, initialPrompt, initialSiteUrl])

  useEffect(() => {
    const nextTab = resolveAgentTab(initialAgentTab)
    if (nextTab && nextTab !== activeAgentTab) {
      setActiveAgentTab(nextTab)
    }
  }, [activeAgentTab, initialAgentTab])

  async function copyAgentGuidePromptForLlm() {
    const prompt = buildAgentLlmGuidePrompt({
      project,
      agent,
      draftAgentJson,
      connectionItems,
      hasUnsavedChanges,
    })

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(prompt)
      } else {
        const textarea = document.createElement('textarea')
        textarea.value = prompt
        textarea.setAttribute('readonly', '')
        textarea.style.position = 'fixed'
        textarea.style.opacity = '0'
        document.body.appendChild(textarea)
        textarea.select()
        document.execCommand('copy')
        textarea.remove()
      }

      setEditorStatus({ type: 'success', message: 'Contrato da aba Agente copiado para LLM.' })
    } catch {
      setEditorStatus({ type: 'error', message: 'Não foi possível copiar o contrato da aba Agente.' })
    }
  }

  function handleAgentTabChange(tabId) {
    setActiveAgentTab(tabId)
    onAgentTabChange?.(tabId)
  }

  function parseLines(value) {
    return String(value || '')
      .split(/\r?\n/)
      .map((item) => item.trim())
      .filter(Boolean)
  }

  function formatLines(value) {
    return Array.isArray(value) ? value.filter(Boolean).join('\n') : ''
  }

  function patchStructuredConfig(updater) {
    setStructuredEditor((currentValue) => {
      const base = currentValue || structuredDraft || agent?.structuredConfig || { structuredConfigVersion: 1 }
      const nextValue = typeof updater === 'function' ? updater(base) : updater
      return nextValue && typeof nextValue === 'object' && !Array.isArray(nextValue) ? nextValue : base
    })
  }

  function patchStructuredSection(sectionKey, patch) {
    patchStructuredConfig((currentValue) => ({
      ...currentValue,
      [sectionKey]: {
        ...(currentValue?.[sectionKey] && typeof currentValue[sectionKey] === 'object' && !Array.isArray(currentValue[sectionKey])
          ? currentValue[sectionKey]
          : {}),
        ...patch,
      },
    }))
  }

  function updatePricingItem(index, patch) {
    patchStructuredConfig((currentValue) => {
      const currentItems = Array.isArray(currentValue?.pricingCatalog?.items) ? currentValue.pricingCatalog.items : []
      const items = currentItems.map((item, itemIndex) => (itemIndex === index ? { ...item, ...patch } : item))
      return {
        ...currentValue,
        pricingCatalog: {
          ...(currentValue?.pricingCatalog || {}),
          enabled: true,
          items,
        },
      }
    })
  }

  function addPricingItem() {
    patchStructuredConfig((currentValue) => {
      const currentItems = Array.isArray(currentValue?.pricingCatalog?.items) ? currentValue.pricingCatalog.items : []
      return {
        ...currentValue,
        pricingCatalog: {
          ...(currentValue?.pricingCatalog || {}),
          enabled: true,
          items: [
            ...currentItems,
            {
              slug: `plano-${currentItems.length + 1}`,
              name: 'Novo plano',
              matchAny: [],
              priceLabel: '',
              features: [],
              channels: [],
            },
          ],
        },
      }
    })
  }

  function removePricingItem(index) {
    patchStructuredConfig((currentValue) => ({
      ...currentValue,
      pricingCatalog: {
        ...(currentValue?.pricingCatalog || {}),
        items: (Array.isArray(currentValue?.pricingCatalog?.items) ? currentValue.pricingCatalog.items : []).filter((_, itemIndex) => itemIndex !== index),
      },
    }))
  }

  function updateKnowledgeItem(index, patch) {
    patchStructuredConfig((currentValue) => {
      const items = Array.isArray(currentValue?.knowledgeBase) ? currentValue.knowledgeBase : []
      return {
        ...currentValue,
        knowledgeBase: items.map((item, itemIndex) => (itemIndex === index ? { ...item, ...patch } : item)),
      }
    })
  }

  function addKnowledgeItem() {
    patchStructuredConfig((currentValue) => ({
      ...currentValue,
      knowledgeBase: [
        ...(Array.isArray(currentValue?.knowledgeBase) ? currentValue.knowledgeBase : []),
        {
          title: 'Novo bloco',
          content: '',
          tags: [],
          contentType: 'generic',
          confidence: 1,
        },
      ],
    }))
  }

  function removeKnowledgeItem(index) {
    patchStructuredConfig((currentValue) => ({
      ...currentValue,
      knowledgeBase: (Array.isArray(currentValue?.knowledgeBase) ? currentValue.knowledgeBase : []).filter((_, itemIndex) => itemIndex !== index),
    }))
  }

  const connectionItems = [
    ...(project.apis || []).map((api) => ({
      id: api.id,
      type: 'api',
      title: api.name,
      description: api.url || `${api.method || 'GET'} cadastrado`,
      icon: PlugZap,
      colorClassName: 'sky',
      panel: 'apis',
      params: { api: api.id },
    })),
    ...(project.whatsappChannels || []).map((channel) => ({
      id: channel.id,
      type: 'channel',
      title: channel.number || 'Canal WhatsApp',
      description: channel.connectionStatus || channel.status || 'Canal cadastrado',
      icon: MessageCircle,
      colorClassName: 'emerald',
      panel: 'whatsapp',
      params: { channel: channel.id },
    })),
    ...(project.chatWidgets || []).map((widget) => ({
      id: widget.id,
      type: 'widget',
      title: widget.name || widget.nome || 'Chat widget',
      description: widget.slug || 'Widget cadastrado',
      icon: PackageSearch,
      colorClassName: 'violet',
      panel: 'chat-widget',
      params: { widget: widget.id },
    })),
    ...(project.directConnections?.mercadoLivre
      ? [
          {
            id: 'mercado-livre',
            type: 'connector',
            title: 'Mercado Livre',
            description: `${project.directConnections.mercadoLivre} conector ativo`,
            icon: Store,
            colorClassName: 'amber',
            panel: 'mercado-livre',
            params: {},
          },
        ]
      : []),
    ...(project.directConnections?.googleCalendar
      ? [
          {
            id: 'google-calendar',
            type: 'connector',
            title: 'Google Agenda',
            description: 'Agenda conectada ao agente',
            icon: CalendarDays,
            colorClassName: 'sky',
            panel: 'google-calendar',
            params: {},
          },
        ]
      : []),
  ]

  async function handleCreateAgent() {
    if (agent?.id || creatingAgent) {
      return
    }

    setCreatingAgent(true)
    setEditorStatus({ type: 'idle', message: '' })

    try {
      const response = await fetch(`/api/app/projetos/${projectIdentifier}/agente`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'create_agent',
          nome: agentName.trim() || `${project.name} Assistente`,
          businessContext: normalizedPrompt,
        }),
      })
      const data = await response.json().catch(() => ({}))

      if (!response.ok) {
        throw new Error(data.error || 'Não foi possível criar o agente.')
      }

      setEditorStatus({ type: 'success', message: 'Agente e chat widget criados.' })
      router.refresh()
    } catch (error) {
      setEditorStatus({ type: 'error', message: error.message })
    } finally {
      setCreatingAgent(false)
    }
  }

  async function handleToggleAgentActive() {
    if (!agent?.id || savingActive) {
      return
    }

    const nextActive = !agentActive
    setSavingActive(true)
    setRollbackStatus({ type: 'idle', message: '' })

    try {
      const response = await fetch(`/api/app/projetos/${projectIdentifier}/agente`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          agenteId: agent.id,
          nome: agent.name,
          descricao: agent.description,
          promptBase: agent.prompt,
          runtimeConfig: agent.runtimeConfig ?? null,
          configuracoes: buildAgentDraftConfig({
            runtimeConfig: agent.runtimeConfig ?? null,
            structuredConfig: structuredEditor || agent.structuredConfig || null,
            structuredConfigDraft: structuredDraft,
            promptText: agent.prompt,
            siteUrl,
            logoUrl,
          }),
          ativo: nextActive,
        }),
      })
      const data = await response.json().catch(() => ({}))

      if (!response.ok) {
        throw new Error(data.error || 'Não foi possível alterar o status do agente.')
      }

      setAgentActive(nextActive)
      if (Array.isArray(data.versions)) {
        setVersions(data.versions)
      }
      setRollbackStatus({
        type: 'success',
        message: nextActive ? 'Agente ativado.' : 'Agente desativado.',
      })
      router.refresh()
    } catch (error) {
      setRollbackStatus({ type: 'error', message: error.message })
    } finally {
      setSavingActive(false)
    }
  }

  async function handleRestoreVersion(versionId) {
    if (!versionId || restoringId) {
      return
    }

    setRestoringId(versionId)
    setRollbackStatus({ type: 'idle', message: '' })

    try {
      const response = await fetch(`/api/app/projetos/${projectIdentifier}/agente`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'restore_version',
          versionId,
        }),
      })
      const data = await response.json().catch(() => ({}))

      if (!response.ok) {
        throw new Error(data.error || 'Não foi possível restaurar a versão.')
      }

      setVersions(Array.isArray(data.versions) ? data.versions : [])
      setRollbackStatus({ type: 'success', message: 'Versao restaurada.' })
      setRestoreConfirmId('')
      router.refresh()
    } catch (error) {
      setRollbackStatus({ type: 'error', message: error.message })
    } finally {
      setRestoringId('')
    }
  }

  async function handleSaveAgent() {
    if (!agent?.id || savingDraft) {
      return
    }

    const nextName = agentName.trim()
    const nextPrompt = normalizedPrompt

    if (!nextName || !nextPrompt) {
      setEditorStatus({ type: 'error', message: 'Nome e comportamento do agente sao obrigatorios.' })
      return
    }

    setSavingDraft(true)
    setEditorStatus({ type: 'idle', message: '' })

    try {
      const response = await fetch(`/api/app/projetos/${projectIdentifier}/agente`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          agenteId: agent.id,
          nome: nextName,
          descricao: agent.description || '',
          promptBase: nextPrompt,
          runtimeConfig: draftAgentConfig.runtimeConfig ?? null,
          configuracoes: draftAgentConfig,
          ativo: agentActive,
        }),
      })
      const data = await response.json().catch(() => ({}))

      if (!response.ok) {
        throw new Error(data.error || 'Não foi possível salvar o agente.')
      }

      if (Array.isArray(data.versions)) {
        setVersions(data.versions)
      }

      if (typeof window !== 'undefined') {
        window.localStorage.setItem(
          `infrastudio:onboarding-project:${project.id || project.slug || project.routeKey}`,
          'done',
        )
      }

      setEditorStatus({ type: 'success', message: 'Agente salvo.' })
      router.refresh()
    } catch (error) {
      setEditorStatus({ type: 'error', message: error.message })
    } finally {
      setSavingDraft(false)
    }
  }

  async function handleStructureAgent(mode = 'analyze') {
    if (!agent?.id || structuringAgent || !normalizedPrompt.trim()) {
      return
    }

    setStructuringAgent(true)
    setEditorStatus({ type: 'idle', message: '' })

    try {
      const response = await fetch(`/api/app/projetos/${projectIdentifier}/agente`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'structure_agent_text',
          mode,
          sourceText: normalizedPrompt,
        }),
      })
      const data = await response.json().catch(() => ({}))

      if (!response.ok) {
        throw new Error(data.error || 'Não foi possível organizar o agente.')
      }

      const nextStructuredDraft = data.draft?.structuredConfig || data.agent?.structuredConfigDraft || null
      setStructuredDraft(nextStructuredDraft)
      setStructuredEditor(nextStructuredDraft)
      setActiveAgentTab('structure')
      if (Array.isArray(data.versions)) {
        setVersions(data.versions)
      }
      setEditorStatus({ type: 'success', message: 'Rascunho estruturado criado. Revise e aplique quando estiver correto.' })
      router.refresh()
    } catch (error) {
      setEditorStatus({ type: 'error', message: error.message })
    } finally {
      setStructuringAgent(false)
    }
  }

  async function handleApplyStructuredConfig() {
    const configToApply = structuredEditor || structuredDraft
    if (!agent?.id || !configToApply || applyingStructure) {
      return
    }

    setApplyingStructure(true)
    setEditorStatus({ type: 'idle', message: '' })

    try {
      const response = await fetch(`/api/app/projetos/${projectIdentifier}/agente`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'apply_structured_config',
          structuredConfig: configToApply,
        }),
      })
      const data = await response.json().catch(() => ({}))

      if (!response.ok) {
        throw new Error(data.error || 'Não foi possível aplicar a estrutura.')
      }

      setStructuredDraft(null)
      setStructuredEditor(data.agent?.structuredConfig || configToApply)
      if (Array.isArray(data.versions)) {
        setVersions(data.versions)
      }
      setEditorStatus({ type: 'success', message: 'Estrutura aplicada ao agente.' })
      router.refresh()
    } catch (error) {
      setEditorStatus({ type: 'error', message: error.message })
    } finally {
      setApplyingStructure(false)
    }
  }

  async function handleDiscardStructuredDraft() {
    if (!agent?.id || !structuredDraft || applyingStructure) {
      return
    }

    setApplyingStructure(true)
    setEditorStatus({ type: 'idle', message: '' })

    try {
      const response = await fetch(`/api/app/projetos/${projectIdentifier}/agente`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'discard_structured_config_draft',
        }),
      })
      const data = await response.json().catch(() => ({}))

      if (!response.ok) {
        throw new Error(data.error || 'Não foi possível descartar o rascunho.')
      }

      setStructuredDraft(null)
      if (Array.isArray(data.versions)) {
        setVersions(data.versions)
      }
      setEditorStatus({ type: 'success', message: 'Rascunho estruturado descartado.' })
      router.refresh()
    } catch (error) {
      setEditorStatus({ type: 'error', message: error.message })
    } finally {
      setApplyingStructure(false)
    }
  }

  function handleResetAgentDraft() {
    setAgentName(initialAgentName)
    setSiteUrl(initialSiteUrl)
    setLogoUrl(initialLogoUrl)
    setPromptValue(plainTextToEditorHtml(initialPrompt))
    setStructuredDraft(agent?.structuredConfigDraft || null)
    setPromptAutofillPendingClear(false)
    setPromptEditedByUser(false)
    setEditorStatus({ type: 'idle', message: '' })
  }

  async function handleGenerateSiteSummary() {
    const normalizedUrl = siteUrl.trim()

    if (!normalizedUrl || generatingSiteSummary) {
      return
    }

    setGeneratingSiteSummary(true)
    setSiteSummaryStatus({ type: 'idle', message: '' })

    try {
      const response = await fetch(`/api/app/projetos/${projectIdentifier}/agente/site-summary`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          url: normalizedUrl,
          currentPrompt: normalizedPrompt,
        }),
      })
      const data = await response.json().catch(() => ({}))

      if (!response.ok) {
        throw new Error(data.error || 'Não foi possível gerar o resumo do site.')
      }

      setPromptValue((currentValue) =>
        buildMergedAgentSummary(currentValue, data.summary, data.promptSuggestion, data.mergedEditorDraft),
      )
      if (!promptEditedByUser) {
        setPromptAutofillPendingClear(true)
      }
      if (data?.source?.logoUrl) {
        setLogoUrl(data.source.logoUrl)
      }
      setSiteSummaryStatus({ type: 'success', message: 'Conteúdo do site adicionado ao editor sem remover seu texto.' })
    } catch (error) {
      setSiteSummaryStatus({ type: 'error', message: error.message })
    } finally {
      setGeneratingSiteSummary(false)
    }
  }

  return (
    <>
      <SheetPanelHeader
        eyebrow="Agente"
        eyebrowIcon={Bot}
        description="Edite seu agente com suas políticas e regras."
        statusTone="sky"
        onCancel={onCloseSheet}
      />
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden md:overflow-visible md:flex-row">
        <SheetInternalTabs tabs={agentTabs} activeTab={activeAgentTab} onChange={handleAgentTabChange} activeGlow={false} />

        <div className="relative z-10 min-h-0 flex-1 overflow-y-auto bg-[#080e1d]">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={`agent-tab:${activeAgentTab}`}
              initial={{ opacity: 0.985, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0.985, y: -3 }}
              transition={{ duration: 0.14, ease: [0.22, 1, 0.36, 1] }}
            >
        {activeAgentTab === 'edit' ? (
        <div className="min-h-full px-6 py-5">
          {!agent?.id ? (
            <div className="mb-5 rounded-2xl border border-sky-500/20 bg-sky-500/10 p-4">
              <div className="text-sm font-medium text-sky-100">Projeto sem agente ativo.</div>
              <div className="mt-1 text-sm leading-6 text-slate-400">
                Crie o agente inicial e o chat widget padrão automaticamente.
              </div>
              <Button
                type="button"
                variant="ghost"
                disabled={creatingAgent}
                onClick={handleCreateAgent}
                className="mt-4 h-10 rounded-xl border border-sky-500/20 bg-sky-500/10 px-4 text-sm text-sky-100 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {creatingAgent ? 'Criando...' : 'Criar agente + widget'}
              </Button>
            </div>
          ) : null}
          <div>
            <div className="space-y-5">
                <div>
                  <label className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                    Nome do agente
                  </label>
                  <div className="mt-3 flex items-center gap-2">
                    <TinyEntityAvatar src={resolveEntityAvatarUrl(logoUrl, siteUrl)} label={agentName || 'Agente'} />
                    <input
                      value={agentName}
                      onChange={(event) => setAgentName(event.target.value)}
                      className="h-12 w-full rounded-xl border border-white/10 bg-[#0a1020] px-4 text-sm text-white outline-none transition focus:border-sky-400/40 focus:ring-2 focus:ring-sky-500/10"
                      placeholder="Nome do agente"
                    />
                  </div>
                </div>

              <div>
                <label className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                  URL do site para leitura automatica
                </label>

                <div className="mt-3 grid gap-3 xl:grid-cols-[minmax(0,1fr)_260px]">
                  <input
                    value={siteUrl}
                    onChange={(event) => setSiteUrl(event.target.value)}
                    className="h-12 flex-1 rounded-xl border border-white/10 bg-[#0a1020] px-4 text-sm text-white outline-none transition focus:border-sky-400/40 focus:ring-2 focus:ring-sky-500/10"
                    placeholder="https://seudominio.com.br"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    disabled={!siteUrl.trim() || generatingSiteSummary}
                    onClick={handleGenerateSiteSummary}
                    className="h-12 rounded-xl border border-sky-500/20 bg-sky-500/10 px-4 text-sm text-sky-100 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {generatingSiteSummary ? 'Lendo site...' : 'Gerar resumo automatico'}
                  </Button>
                </div>

                  <p className="mt-2 text-xs text-slate-500">
                    O sistema busca informações do site e soma esse contexto.
                  </p>
                  {logoUrl ? (
                    <div className="mt-2 flex items-center gap-2 text-xs text-slate-500">
                      <TinyEntityAvatar src={resolveEntityAvatarUrl(logoUrl, siteUrl)} label={agentName || 'Agente'} />
                      <span>Logo capturado do site.</span>
                    </div>
                  ) : null}

                {siteSummaryStatus.message ? (
                  <div
                    className={cn(
                      'mt-3 rounded-xl border px-3 py-2 text-xs',
                      siteSummaryStatus.type === 'success'
                        ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-200'
                        : 'border-red-500/20 bg-red-500/10 text-red-200',
                    )}
                  >
                    {siteSummaryStatus.message}
                  </div>
                ) : null}

              </div>

              <div>
                <div className="flex items-center justify-between gap-3">
                  <label className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                    Escreva suas políticas e regras do seu negócio.
                  </label>
                  <div className="flex shrink-0 items-center gap-2">
                    <Button
                      type="button"
                      variant="ghost"
                      className="h-8 rounded-xl border border-sky-500/20 bg-sky-500/10 px-3 text-xs text-sky-100 hover:bg-sky-500/15"
                      onClick={copyAgentGuidePromptForLlm}
                    >
                      <ClipboardCopy className="mr-1.5 h-3.5 w-3.5" />
                      Copiar para LLM
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      className="h-8 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-3 text-xs text-emerald-200"
                      onClick={handleResetAgentDraft}
                    >
                      <Wand2 className="mr-1.5 h-3.5 w-3.5" />
                      Voltar
                    </Button>
                  </div>
                </div>

                <div className="mt-3">
                  <AgentRichEditor
                    value={promptValue}
                    onChange={(nextValue) => {
                      setPromptValue(nextValue)
                      if (!promptAutofillPendingClear) {
                        setPromptEditedByUser(true)
                      }
                    }}
                    placeholder="Descreva seu negócio, os serviços ou produtos que oferece, seus diferenciais, valores, regras, limites e como você gosta de atender seus clientes. Quanto mais claro e detalhado, melhor o agente vai conversar."
                    clearOnFirstInput={promptAutofillPendingClear}
                    onFirstInputClear={() => {
                      setPromptAutofillPendingClear(false)
                      setPromptEditedByUser(true)
                    }}
                  />
                </div>

                <div className="mt-4 rounded-2xl border border-sky-400/20 bg-sky-500/10 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold text-sky-100">Estrutura do agente</div>
                      <div className="mt-1 text-xs leading-5 text-sky-200/80">
                        Organize o texto em dados estruturados para reduzir prompt gigante e melhorar respostas factuais.
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Button
                        type="button"
                        variant="ghost"
                        className="h-8 rounded-xl border border-sky-400/25 bg-white/5 px-3 text-xs text-sky-100 hover:bg-sky-500/15"
                        disabled={structuringAgent || !normalizedPrompt.trim()}
                        onClick={() => handleStructureAgent(agent?.structuredConfig ? 'update' : 'analyze')}
                      >
                        <Sparkles className="mr-1.5 h-3.5 w-3.5" />
                        {structuringAgent ? 'Organizando...' : agent?.structuredConfig ? 'Atualizar com IA' : 'Organizar com IA'}
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        className="h-8 rounded-xl border border-sky-400/25 bg-white/5 px-3 text-xs text-sky-100 hover:bg-sky-500/15"
                        disabled={structuringAgent || !normalizedPrompt.trim()}
                        onClick={() => handleStructureAgent('reset')}
                      >
                        Resetar e importar
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        className="h-8 rounded-xl border border-emerald-400/25 bg-emerald-500/10 px-3 text-xs text-emerald-100 hover:bg-emerald-500/15"
                        disabled={applyingStructure || !structuredDraft}
                        onClick={handleApplyStructuredConfig}
                      >
                        <Check className="mr-1.5 h-3.5 w-3.5" />
                        {applyingStructure ? 'Aplicando...' : 'Aplicar estrutura'}
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        className="h-8 rounded-xl border border-white/10 bg-white/[0.03] px-3 text-xs text-slate-300 hover:bg-white/[0.06]"
                        disabled={applyingStructure || !structuredDraft}
                        onClick={handleDiscardStructuredDraft}
                      >
                        Descartar
                      </Button>
                    </div>
                  </div>

                  {structuredDraft ? (
                    <div className="mt-3 rounded-xl border border-white/10 bg-[#08111f] p-3">
                      <div className="grid gap-2 text-xs text-slate-300 sm:grid-cols-4">
                        <span>Tipo: {structuredDraft.diagnostics?.detectedType || 'detectado por IA'}</span>
                        <span>Planos: {structuredDraft.pricingCatalog?.items?.length || 0}</span>
                        <span>Conhecimento: {structuredDraft.knowledgeBase?.length || 0}</span>
                        <span>Módulos: {structuredDraft.diagnostics?.modules?.length || 0}</span>
                      </div>
                      <details className="mt-3">
                        <summary className="cursor-pointer text-xs font-medium text-sky-200">Ver JSON do rascunho</summary>
                        <pre className="mt-2 max-h-64 overflow-auto rounded-xl bg-black/40 p-3 text-xs text-slate-100">
                          {JSON.stringify(structuredDraft, null, 2)}
                        </pre>
                      </details>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        </div>
        ) : null}

        {activeAgentTab === 'structure' ? (
          <div className="space-y-4 px-6 py-5">
            {activeStructuredConfig ? (
              <>
                <div className="rounded-2xl border border-white/10 bg-[#0a1020] p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2 text-sm font-semibold text-white">
                        <Sparkles className="h-4 w-4 text-sky-300" />
                        Estrutura ativa do agente
                      </div>
                      <p className="mt-1 text-xs leading-5 text-slate-500">
                        Edite os blocos estruturados que o runtime usa antes de recorrer ao texto livre.
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        variant="ghost"
                        className="h-8 rounded-xl border border-sky-400/25 bg-sky-500/10 px-3 text-xs text-sky-100 hover:bg-sky-500/15"
                        disabled={structuringAgent || !normalizedPrompt.trim()}
                        onClick={() => handleStructureAgent(agent?.structuredConfig ? 'update' : 'analyze')}
                      >
                        {structuringAgent ? 'Atualizando...' : 'Atualizar pelo texto'}
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        className="h-8 rounded-xl border border-emerald-400/25 bg-emerald-500/10 px-3 text-xs text-emerald-100 hover:bg-emerald-500/15"
                        disabled={applyingStructure || !structuredEditor}
                        onClick={handleApplyStructuredConfig}
                      >
                        <Check className="mr-1.5 h-3.5 w-3.5" />
                        {applyingStructure ? 'Salvando...' : 'Salvar estrutura'}
                      </Button>
                    </div>
                  </div>
                </div>

                <div className="grid gap-4 xl:grid-cols-2">
                  <div className="rounded-2xl border border-white/10 bg-[#0a1020] p-4">
                    <div className="text-sm font-semibold text-white">Identidade</div>
                    <div className="mt-4 grid gap-3">
                      <input
                        value={activeStructuredConfig.identity?.businessName || ''}
                        onChange={(event) => patchStructuredSection('identity', { businessName: event.target.value })}
                        className="h-10 rounded-xl border border-white/10 bg-[#080e1d] px-3 text-sm text-white outline-none focus:border-sky-400/40"
                        placeholder="Nome do negócio"
                      />
                      <input
                        value={activeStructuredConfig.identity?.name || ''}
                        onChange={(event) => patchStructuredSection('identity', { name: event.target.value })}
                        className="h-10 rounded-xl border border-white/10 bg-[#080e1d] px-3 text-sm text-white outline-none focus:border-sky-400/40"
                        placeholder="Nome estrutural do agente"
                      />
                      <input
                        value={activeStructuredConfig.identity?.role || ''}
                        onChange={(event) => patchStructuredSection('identity', { role: event.target.value })}
                        className="h-10 rounded-xl border border-white/10 bg-[#080e1d] px-3 text-sm text-white outline-none focus:border-sky-400/40"
                        placeholder="Papel do agente"
                      />
                    </div>
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-[#0a1020] p-4">
                    <div className="text-sm font-semibold text-white">Comportamento</div>
                    <div className="mt-4 grid gap-3">
                      <input
                        value={activeStructuredConfig.behavior?.tone || ''}
                        onChange={(event) => patchStructuredSection('behavior', { tone: event.target.value })}
                        className="h-10 rounded-xl border border-white/10 bg-[#080e1d] px-3 text-sm text-white outline-none focus:border-sky-400/40"
                        placeholder="Tom de voz"
                      />
                      <textarea
                        value={formatLines(activeStructuredConfig.behavior?.rules)}
                        onChange={(event) => patchStructuredSection('behavior', { rules: parseLines(event.target.value) })}
                        className="min-h-28 rounded-xl border border-white/10 bg-[#080e1d] px-3 py-2 text-sm text-white outline-none focus:border-sky-400/40"
                        placeholder="Regras, uma por linha"
                      />
                      <textarea
                        value={formatLines(activeStructuredConfig.behavior?.avoid)}
                        onChange={(event) => patchStructuredSection('behavior', { avoid: parseLines(event.target.value) })}
                        className="min-h-20 rounded-xl border border-white/10 bg-[#080e1d] px-3 py-2 text-sm text-white outline-none focus:border-sky-400/40"
                        placeholder="Evitar, um item por linha"
                      />
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border border-white/10 bg-[#0a1020] p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold text-white">Planos e preços</div>
                      <p className="mt-1 text-xs text-slate-500">Campos factuais usados por billing e perguntas de planos.</p>
                    </div>
                    <Button type="button" variant="ghost" className="h-8 rounded-xl border border-white/10 px-3 text-xs text-slate-200" onClick={addPricingItem}>
                      Adicionar plano
                    </Button>
                  </div>
                  <div className="mt-4 space-y-3">
                    {(activeStructuredConfig.pricingCatalog?.items || []).map((item, index) => (
                      <div key={`${item.slug || item.name}-${index}`} className="rounded-xl border border-white/10 bg-[#080e1d] p-3">
                        <div className="grid gap-2 lg:grid-cols-4">
                          <input value={item.name || ''} onChange={(event) => updatePricingItem(index, { name: event.target.value })} className="h-9 rounded-lg border border-white/10 bg-black/20 px-2 text-xs text-white outline-none" placeholder="Nome" />
                          <input value={item.slug || ''} onChange={(event) => updatePricingItem(index, { slug: event.target.value })} className="h-9 rounded-lg border border-white/10 bg-black/20 px-2 text-xs text-white outline-none" placeholder="slug" />
                          <input value={item.priceLabel || ''} onChange={(event) => updatePricingItem(index, { priceLabel: event.target.value })} className="h-9 rounded-lg border border-white/10 bg-black/20 px-2 text-xs text-white outline-none" placeholder="Preço" />
                          <input value={item.creditLimit ?? ''} onChange={(event) => updatePricingItem(index, { creditLimit: event.target.value ? Number(event.target.value) : null })} className="h-9 rounded-lg border border-white/10 bg-black/20 px-2 text-xs text-white outline-none" placeholder="Créditos" />
                          <input value={item.attendanceLimit ?? ''} onChange={(event) => updatePricingItem(index, { attendanceLimit: event.target.value ? Number(event.target.value) : null })} className="h-9 rounded-lg border border-white/10 bg-black/20 px-2 text-xs text-white outline-none" placeholder="Atendimentos" />
                          <input value={item.agentLimit ?? ''} onChange={(event) => updatePricingItem(index, { agentLimit: event.target.value ? Number(event.target.value) : null })} className="h-9 rounded-lg border border-white/10 bg-black/20 px-2 text-xs text-white outline-none" placeholder="Agentes" />
                          <input value={item.marketplaceProductLimit ?? ''} onChange={(event) => updatePricingItem(index, { marketplaceProductLimit: event.target.value })} className="h-9 rounded-lg border border-white/10 bg-black/20 px-2 text-xs text-white outline-none" placeholder="Produtos ML ou unlimited" />
                          <select value={item.whatsappIncluded == null ? '' : String(item.whatsappIncluded)} onChange={(event) => updatePricingItem(index, { whatsappIncluded: event.target.value === '' ? null : event.target.value === 'true' })} className="h-9 rounded-lg border border-white/10 bg-black/20 px-2 text-xs text-white outline-none">
                            <option value="">WhatsApp?</option>
                            <option value="true">WhatsApp sim</option>
                            <option value="false">WhatsApp não</option>
                          </select>
                        </div>
                        <div className="mt-2 flex justify-end">
                          <Button type="button" variant="ghost" className="h-7 px-2 text-xs text-red-200" onClick={() => removePricingItem(index)}>
                            Remover
                          </Button>
                        </div>
                      </div>
                    ))}
                    {!(activeStructuredConfig.pricingCatalog?.items || []).length ? (
                      <div className="rounded-xl border border-dashed border-white/10 px-3 py-4 text-sm text-slate-500">Nenhum plano estruturado.</div>
                    ) : null}
                  </div>
                </div>

                <div className="grid gap-4 xl:grid-cols-2">
                  <div className="rounded-2xl border border-white/10 bg-[#0a1020] p-4">
                    <div className="text-sm font-semibold text-white">Integrações previstas</div>
                    <div className="mt-4 space-y-3 text-sm text-slate-300">
                      {[
                        ['whatsapp', 'WhatsApp'],
                        ['googleAgenda', 'Google Agenda'],
                        ['apis', 'APIs externas'],
                      ].map(([key, label]) => (
                        <label key={key} className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-[#080e1d] px-3 py-2">
                          <span>{label}</span>
                          <input
                            type="checkbox"
                            checked={activeStructuredConfig.integrations?.[key]?.enabled === true}
                            onChange={(event) =>
                              patchStructuredSection('integrations', {
                                ...(activeStructuredConfig.integrations || {}),
                                [key]: {
                                  ...(activeStructuredConfig.integrations?.[key] || {}),
                                  enabled: event.target.checked,
                                },
                              })
                            }
                          />
                        </label>
                      ))}
                    </div>
                    <textarea
                      value={formatLines(activeStructuredConfig.integrations?.apis?.expectedContent)}
                      onChange={(event) =>
                        patchStructuredSection('integrations', {
                          ...(activeStructuredConfig.integrations || {}),
                          apis: {
                            ...(activeStructuredConfig.integrations?.apis || {}),
                            enabled: true,
                            expectedContent: parseLines(event.target.value),
                          },
                        })
                      }
                      className="mt-3 min-h-20 w-full rounded-xl border border-white/10 bg-[#080e1d] px-3 py-2 text-sm text-white outline-none focus:border-sky-400/40"
                      placeholder="Conteúdos esperados das APIs, um por linha"
                    />
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-[#0a1020] p-4">
                    <div className="text-sm font-semibold text-white">Atendimento humano</div>
                    <div className="mt-4 space-y-3">
                      <label className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-[#080e1d] px-3 py-2 text-sm text-slate-300">
                        <span>Handoff ativo</span>
                        <input
                          type="checkbox"
                          checked={activeStructuredConfig.handoff?.enabled === true}
                          onChange={(event) => patchStructuredSection('handoff', { enabled: event.target.checked })}
                        />
                      </label>
                      <textarea
                        value={activeStructuredConfig.handoff?.policy || ''}
                        onChange={(event) => patchStructuredSection('handoff', { policy: event.target.value })}
                        className="min-h-24 w-full rounded-xl border border-white/10 bg-[#080e1d] px-3 py-2 text-sm text-white outline-none focus:border-sky-400/40"
                        placeholder="Política de atendimento humano"
                      />
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border border-white/10 bg-[#0a1020] p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold text-white">Base de conhecimento</div>
                      <p className="mt-1 text-xs text-slate-500">Blocos longos que o agente pode usar quando forem relevantes.</p>
                    </div>
                    <Button type="button" variant="ghost" className="h-8 rounded-xl border border-white/10 px-3 text-xs text-slate-200" onClick={addKnowledgeItem}>
                      Adicionar bloco
                    </Button>
                  </div>
                  <div className="mt-4 space-y-3">
                    {(activeStructuredConfig.knowledgeBase || []).map((item, index) => (
                      <div key={`${item.title}-${index}`} className="rounded-xl border border-white/10 bg-[#080e1d] p-3">
                        <input value={item.title || ''} onChange={(event) => updateKnowledgeItem(index, { title: event.target.value })} className="h-9 w-full rounded-lg border border-white/10 bg-black/20 px-2 text-xs text-white outline-none" placeholder="Título" />
                        <textarea value={item.content || ''} onChange={(event) => updateKnowledgeItem(index, { content: event.target.value })} className="mt-2 min-h-28 w-full rounded-lg border border-white/10 bg-black/20 px-2 py-2 text-xs text-white outline-none" placeholder="Conteúdo" />
                        <div className="mt-2 flex items-center justify-between gap-2">
                          <input value={formatLines(item.tags)} onChange={(event) => updateKnowledgeItem(index, { tags: parseLines(event.target.value) })} className="h-8 min-w-0 flex-1 rounded-lg border border-white/10 bg-black/20 px-2 text-xs text-white outline-none" placeholder="Tags, uma por linha" />
                          <Button type="button" variant="ghost" className="h-8 px-2 text-xs text-red-200" onClick={() => removeKnowledgeItem(index)}>
                            Remover
                          </Button>
                        </div>
                      </div>
                    ))}
                    {!(activeStructuredConfig.knowledgeBase || []).length ? (
                      <div className="rounded-xl border border-dashed border-white/10 px-3 py-4 text-sm text-slate-500">Nenhum bloco de conhecimento.</div>
                    ) : null}
                  </div>
                </div>
              </>
            ) : (
              <PlaceholderPanel
                title="Sem estrutura aplicada"
                description="Use Organizar com IA na aba Editar agente para gerar um rascunho estruturado a partir do texto atual."
              />
            )}
          </div>
        ) : null}

        {activeAgentTab === 'json' ? (
          <div className="px-6 py-5">
            <JsonCodeBlock value={{ projectId: project.id, agent: draftAgentJson }} />
          </div>
        ) : null}

        {activeAgentTab === 'connections' ? (
          <div className="grid gap-3 px-6 py-5 md:grid-cols-2">
            {connectionItems.length ? (
              connectionItems.map((item) => {
                const Icon = item.icon
                const accent = getPanelAccentClasses(item.colorClassName)
                const toneClasses = getToneClasses(item.colorClassName)
                const isWhatsApp = item.panel === 'whatsapp'

                return (
                  <button
                    key={`${item.type}-${item.id}`}
                    type="button"
                    onClick={() => onOpenConnection?.(item.panel, item.params)}
                    className={cn(
                      'group flex items-center gap-3 rounded-[22px] border bg-[#0c1426] p-4 text-left shadow-[0_8px_0_rgba(2,6,23,0.64)] transition-[background-color,border-color,box-shadow]',
                      accent.button,
                    )}
                  >
                    <span
                      className={cn(
                        'flex h-10 w-10 shrink-0 items-center justify-center border border-white/10 bg-white/[0.06]',
                        isWhatsApp ? 'rounded-full' : 'rounded-xl',
                      )}
                    >
                      <Icon className="h-5 w-5" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-white">{item.title}</span>
                      <span className={cn('mt-1 block truncate text-xs', toneClasses.text)}>{item.description}</span>
                    </span>
                    <ChevronRight className={cn('h-4 w-4 shrink-0', accent.icon)} />
                  </button>
                )
              })
            ) : (
              <PlaceholderPanel title="Sem conexoes" description="Cadastre APIs, WhatsApp, widget ou conectores para liberar atalhos diretos." />
            )}
          </div>
        ) : null}

        {activeAgentTab === 'history' ? (
          <div className="px-6 py-5">
            <div className="rounded-2xl border border-white/10 bg-[#0a1020] p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 text-sm font-medium text-white">
                    <History className="h-4 w-4 text-sky-300" />
                    Histórico e rollback
                  </div>
                  <div className="mt-1 text-xs leading-5 text-slate-500">
                    Restaure uma versão anterior do prompt e runtimeConfig.
                  </div>
                </div>
              </div>

              {rollbackStatus.message ? (
                <div
                  className={cn(
                    'mt-3 rounded-xl border px-3 py-2 text-xs',
                    rollbackStatus.type === 'success'
                      ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-200'
                      : 'border-red-500/20 bg-red-500/10 text-red-200',
                  )}
                >
                  {rollbackStatus.message}
                </div>
              ) : null}

              {versions.length ? (
                <div className="mt-4 space-y-2">
                  {[currentVersionSnapshot, ...versions.slice(0, 8)].map((version, index, list) => {
                    const isCurrent = version.id === 'current'
                    const compareVersion = list[index + 1] ?? null
                    const changeNote = buildVersionChangeNote(version, compareVersion)

                    return (
                      <div
                        key={version.id}
                        className={cn(
                          "rounded-xl border px-3 py-3",
                          isCurrent ? "border-emerald-400/20 bg-emerald-500/5" : "border-white/10 bg-black/10",
                        )}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <div className="truncate text-sm font-medium text-white">
                                {isCurrent ? version.versionNumber : `v${version.versionNumber}`} - {version.name}
                              </div>
                              <span
                                className={cn(
                                  "rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.16em]",
                                  isCurrent
                                    ? "border-emerald-400/20 bg-emerald-500/10 text-emerald-200"
                                    : "border-white/10 bg-white/[0.04] text-slate-300",
                                )}
                              >
                                {isCurrent ? "versão atual" : version.source === 'rollback' ? 'rollback' : 'salvamento'}
                              </span>
                              {!isCurrent && version.active === true ? (
                                <span className="rounded-full border border-sky-400/20 bg-sky-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-sky-100">
                                  ativa na epoca
                                </span>
                              ) : null}
                            </div>
                            <div className="mt-1 text-xs text-slate-500">
                              {isCurrent ? 'referencia atual para comparacao' : new Date(version.createdAt).toLocaleString('pt-BR')}
                            </div>
                            <div className="mt-2 text-xs leading-5 text-slate-400">
                              {changeNote}
                            </div>
                          </div>

                          {!isCurrent ? (
                            <Button
                              type="button"
                              variant="ghost"
                              disabled={Boolean(restoringId)}
                              onClick={() => setRestoreConfirmId(version.id)}
                              className="h-8 shrink-0 rounded-xl border border-sky-500/20 bg-sky-500/10 px-3 text-xs text-sky-100"
                            >
                              <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
                              {restoringId === version.id ? 'Restaurando...' : 'Rollback'}
                            </Button>
                          ) : null}
                        </div>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <div className="mt-4 rounded-xl border border-dashed border-white/10 bg-black/10 px-4 py-3 text-sm text-slate-500">
                  Nenhuma versão salva ainda. O historico sera criado antes do proximo salvamento.
                </div>
              )}
            </div>
          </div>
        ) : null}

            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      <div className="border-t border-white/5 px-6 py-4">
        {editorStatus.message && activeAgentTab === 'edit' ? (
          <div
            className={cn(
              'mb-3 rounded-xl border px-3 py-2 text-xs',
              editorStatus.type === 'success'
                ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-200'
                : 'border-red-500/20 bg-red-500/10 text-red-200',
            )}
          >
            {editorStatus.message}
          </div>
        ) : null}

        <div className="flex items-center gap-3">
          <Button
            type="button"
            variant="ghost"
            disabled={!canSaveAgent}
            onClick={handleSaveAgent}
            className="h-10 rounded-xl border border-sky-500/20 bg-sky-500/10 px-4 text-sm text-sky-100 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Check className="mr-2 h-4 w-4" />
            {savingDraft ? 'Salvando...' : 'Salvar'}
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={onCloseSheet}
            className="h-10 rounded-xl border border-white/10 bg-white/[0.03] px-4 text-sm text-slate-300"
          >
            <X className="mr-2 h-4 w-4" />
            Cancelar
          </Button>
        </div>
      </div>

      <ConfirmDialog
        open={Boolean(restoreConfirmId)}
        onOpenChange={(open) => {
          if (!open) {
            setRestoreConfirmId('')
          }
        }}
        title="Restaurar versão do agente"
        description="O estado atual será salvo no histórico antes do rollback."
        confirmLabel="Restaurar versão"
        loading={Boolean(restoringId)}
        onConfirm={() => (restoreConfirmId ? handleRestoreVersion(restoreConfirmId) : null)}
      />
    </>
  )
}

