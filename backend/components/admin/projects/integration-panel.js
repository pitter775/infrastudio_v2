'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowLeft, ArrowRight, BarChart3, BookOpen, CalendarDays, Check, ExternalLink, Files, History, LoaderCircle, MessageSquare, PackageSearch, PlugZap, Store, Users, Wand2 } from 'lucide-react'

import { ApiSheetManager } from '@/components/app/apis/api-sheet-manager'
import { GoogleCalendarManager } from '@/components/app/google-calendar/google-calendar-manager'
import { WhatsAppManager } from '@/components/app/whatsapp/whatsapp-manager'
import { WidgetManager } from '@/components/app/widgets/widget-manager'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { MercadoLivrePanel } from './mercado-livre-panel'
import { SheetInternalTabs, SheetPanelHeader } from './project-detail-sheet'

export function mergeIntegrationStats(current, next) {
  if (!next || typeof next !== 'object') {
    return current
  }

  let changed = false
  const merged = { ...current }

  for (const [key, value] of Object.entries(next)) {
    if (value == null || merged[key] === value) {
      continue
    }

    merged[key] = value
    changed = true
  }

  return changed ? merged : current
}


function buildIntegrationTabs(panelId) {
  if (panelId === 'apis') {
    return [
      { id: 'list', label: 'Lista', icon: PlugZap },
      { id: 'edit', label: 'Criar/editar', icon: Wand2 },
      { id: 'json', label: 'Ver JSON', icon: Files },
      { id: 'test', label: 'Testar', icon: MessageSquare },
      { id: 'history', label: 'Histórico', icon: History },
    ]
  }

  if (panelId === 'whatsapp') {
    return [
      { id: 'channels', label: 'Canais', icon: MessageSquare },
      { id: 'qr', label: 'QR Code', icon: Store },
      { id: 'session', label: 'Sessão', icon: PlugZap },
      { id: 'events', label: 'Eventos', icon: History },
      { id: 'json', label: 'Config JSON', icon: Files },
    ]
  }

  if (panelId === 'chat-widget') {
    return [
      { id: 'widgets', label: 'Widgets', icon: PackageSearch },
      { id: 'install', label: 'Instalação', icon: PlugZap },
      { id: 'behavior', label: 'Comportamento', icon: Wand2 },
      { id: 'events', label: 'Eventos', icon: History },
      { id: 'json', label: 'Config JSON', icon: Files },
    ]
  }

  if (panelId === 'google-calendar') {
    return [
      { id: 'connection', label: 'Conexão', icon: CalendarDays },
      { id: 'settings', label: 'Configuração', icon: Wand2 },
      { id: 'json', label: 'Config JSON', icon: Files },
    ]
  }

  return [
    { id: 'overview', label: 'Visão geral', icon: Store },
    { id: 'catalog', label: 'Catálogo', icon: PackageSearch },
    { id: 'orders', label: 'Pedidos', icon: Files },
    { id: 'questions', label: 'Perguntas', icon: MessageSquare },
    { id: 'json', label: 'Config JSON', icon: Files },
  ]
}

function ManagerFrame({ children }) {
  return (
    <div className="flex h-full min-h-0 flex-col text-slate-300">
      {children}
    </div>
  )
}

function StoreHeaderTabs({ activeTab, onChange, tabs = [] }) {
  if (!tabs.length || !onChange) {
    return null
  }

  return (
    <div className="flex flex-nowrap items-start gap-1 overflow-x-auto overflow-y-hidden pb-0.5 [scrollbar-width:none] md:items-center md:overflow-hidden [&::-webkit-scrollbar]:hidden">
      {tabs.map((tab) => {
        const Icon = tab.icon
        const active = activeTab === tab.id

        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onChange(tab)}
            className={cn(
              'inline-flex min-w-0 shrink-0 items-center justify-center rounded-lg text-xs font-normal transition-[background-color,color,box-shadow] md:h-8 md:shrink md:gap-1.5 md:px-2',
              'h-12 w-12 flex-col gap-0.5 px-1 md:w-auto md:flex-row',
              active
                ? 'bg-[#10192b] text-amber-300'
                : 'bg-transparent text-slate-500 hover:bg-[#10192b] hover:text-slate-200',
            )}
            title={tab.label}
          >
            {Icon ? <Icon className="h-3.5 w-3.5 shrink-0" /> : null}
            <span className={cn('max-w-11 truncate text-[10px] leading-3 md:max-w-none md:text-xs', active ? 'block' : 'hidden md:block')}>
              {tab.label}
            </span>
          </button>
        )
      })}
    </div>
  )
}

export function resolveProjectPlanSummary(project) {
  const projectPlanName = project.billing?.projectPlan?.planName?.trim?.() || ''
  const subscriptionPlanName = project.billing?.subscription?.plan?.name?.trim?.() || ''
  const rawPlanName = projectPlanName || subscriptionPlanName
  const normalizedPlanName = rawPlanName.toLowerCase()
  const hasValidPaidPlan =
    Boolean(project.billing?.projectPlan?.planId || project.billing?.subscription?.plan?.id) &&
    Boolean(normalizedPlanName) &&
    !['padrao', 'padrÃ£o', 'default'].includes(normalizedPlanName)

  return {
    planId: hasValidPaidPlan
      ? project.billing?.projectPlan?.planId || project.billing?.subscription?.plan?.id || null
      : 'free',
    planName: hasValidPaidPlan ? rawPlanName : 'Free',
    isFree:
      Boolean(project.billing?.subscription?.plan?.isFree) ||
      normalizedPlanName === 'free' ||
      !hasValidPaidPlan,
  }
}

export function IntegrationPanel({ panel, sheetItems, project, deepLink, onCloseSheet = null, enabled = true, onIntegrationStatsChange = null }) {
  const [apiDetailOpen, setApiDetailOpen] = useState(Boolean(deepLink?.api))
  const [apiFooter, setApiFooter] = useState({})
  const [apiResetSignal, setApiResetSignal] = useState(0)
  const [apiGuideSignal, setApiGuideSignal] = useState(0)
  const [whatsappFooter, setWhatsappFooter] = useState({})
  const [widgetFooter, setWidgetFooter] = useState({})
  const [mercadoFooter, setMercadoFooter] = useState({})
  const [integrationStats, setIntegrationStats] = useState({})
  const mercadoDashboardAutoOpenRef = useRef(false)
  const hasMercadoLivreConnection =
    panel.id === 'mercado-livre' &&
    (mercadoFooter.hasSavedConnector === true || Number(project.directConnections?.mercadoLivre || 0) > 0)

  const handleStatsChange = useCallback((stats) => {
    setIntegrationStats((current) => mergeIntegrationStats(current, stats))
  }, [])

  useEffect(() => {
    if (Object.keys(integrationStats).length > 0) {
      onIntegrationStatsChange?.(integrationStats)
    }
  }, [integrationStats, onIntegrationStatsChange])
  const tabs = useMemo(() => {
    if (panel.id === 'apis') {
      return []
    }

    if (panel.id === 'whatsapp') {
      return [
        { id: 'connect', label: 'Conectar', icon: MessageSquare },
        { id: 'attendants', label: 'Atendentes', icon: Users },
      ]
    }

    if (panel.id === 'chat-widget') {
      return [
        { id: 'edit', label: 'Editar', icon: Wand2 },
        { id: 'code', label: 'Ver codigo fonte', icon: Files },
        { id: 'docs', label: 'Documentação', icon: MessageSquare },
      ]
    }

      if (panel.id === 'mercado-livre') {
        const mercadoTabs = [
          { id: 'dashboard', label: 'Dashboard', icon: BarChart3 },
          { id: 'connection', label: 'Conexão', icon: Store },
          { id: 'tutorial', label: 'Ajuda', icon: BookOpen },
          { id: 'store', label: 'Loja', icon: Wand2, tone: 'amber' },
          { id: 'test', label: 'Teste', icon: PackageSearch },
          { id: 'orders', label: 'Pedidos', icon: Files },
          { id: 'questions', label: 'Perguntas', icon: MessageSquare },
        ]

        return hasMercadoLivreConnection ? mercadoTabs : mercadoTabs.filter((tab) => tab.id === 'connection')
      }

    return buildIntegrationTabs(panel.id)
  }, [hasMercadoLivreConnection, panel.id])
  const [activeTab, setActiveTab] = useState(
    deepLink?.tab && tabs.some((tab) => tab.id === deepLink.tab) ? deepLink.tab : tabs[0]?.id || 'overview',
  )
  const currentActiveTab = tabs.some((tab) => tab.id === activeTab) ? activeTab : tabs[0]?.id || 'overview'

  const handleMercadoFooterStateChange = useCallback((nextFooter) => {
    setMercadoFooter((current) => ({
      ...current,
      ...(nextFooter || {}),
    }))
    if (
      nextFooter?.hasSavedConnector &&
      nextFooter?.activeTab === 'connection' &&
      activeTab === 'connection' &&
      !deepLink?.tab &&
      !mercadoDashboardAutoOpenRef.current
    ) {
      mercadoDashboardAutoOpenRef.current = true
      setActiveTab('dashboard')
    }
  }, [activeTab, deepLink?.tab])

  const realPanel =
    panel.id === 'apis' ? (
      <ManagerFrame>
        <ApiSheetManager
          project={project}
          initialApiId={deepLink?.api || null}
          onDetailOpenChange={setApiDetailOpen}
          onFooterStateChange={setApiFooter}
          onStatsChange={handleStatsChange}
          resetSignal={apiResetSignal}
          guideOpenSignal={apiGuideSignal}
          compact
        />
      </ManagerFrame>
    ) : panel.id === 'whatsapp' ? (
      <ManagerFrame>
        <WhatsAppManager project={project} initialChannelId={deepLink?.channel || null} activeTab={activeTab} onTabChange={setActiveTab} onFooterStateChange={setWhatsappFooter} onStatsChange={handleStatsChange} compact />
      </ManagerFrame>
    ) : panel.id === 'chat-widget' ? (
      <ManagerFrame>
        <WidgetManager project={project} initialWidgetId={deepLink?.widget || null} activeTab={activeTab} onTabChange={setActiveTab} onFooterStateChange={setWidgetFooter} onStatsChange={handleStatsChange} compact />
      </ManagerFrame>
    ) : panel.id === 'mercado-livre' ? (
      <MercadoLivrePanel
        project={project}
        activeTab={currentActiveTab}
        onTabChange={setActiveTab}
        onFooterStateChange={handleMercadoFooterStateChange}
        compact
        initialNotice={deepLink?.notice || ''}
      />
    ) : panel.id === 'google-calendar' ? (
      <ManagerFrame>
        <GoogleCalendarManager
          project={project}
          activeTab={currentActiveTab}
          onStatsChange={handleStatsChange}
          compact
        />
      </ManagerFrame>
    ) : null
  const contentKey = realPanel ? `${panel.id}:manager` : `${panel.id}:${currentActiveTab}`

  return (
    <>
      <SheetPanelHeader
        eyebrow={panel.title || panel.label}
        eyebrowIcon={panel.icon}
        description={panel.description}
        compact={panel.id === 'apis'}
        statusTone="sky"
        colorClassName={panel.colorClassName}
        leftAction={
          panel.id === 'apis' && apiDetailOpen ? (
            <Button
              type="button"
              variant="ghost"
              className="hidden h-7 gap-1.5 rounded-lg border border-sky-500/20 bg-sky-500/10 px-2.5 text-xs text-sky-100 hover:bg-sky-500/15 md:inline-flex"
              onClick={() => setApiResetSignal((value) => value + 1)}
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Voltar para lista
            </Button>
          ) : null
        }
        rightAction={
          panel.id === 'apis' && apiDetailOpen ? (
            <Button
              type="button"
              variant="ghost"
              className="h-9 gap-2 rounded-xl border border-sky-500/20 bg-sky-500/10 px-3 text-xs font-semibold text-sky-100 hover:bg-sky-500/15"
              onClick={() => setApiGuideSignal((value) => value + 1)}
            >
              <BookOpen className="h-3.5 w-3.5" />
              Guia
            </Button>
          ) : panel.id === 'mercado-livre' && currentActiveTab === 'store' && mercadoFooter.publicUrl ? (
            <a
              href={mercadoFooter.publicUrl}
              target="_blank"
              rel="noreferrer"
              className="hidden h-9 items-center gap-2 rounded-xl border border-sky-500/20 bg-sky-500/10 px-3 text-xs font-semibold text-sky-100 hover:bg-sky-500/15 sm:inline-flex"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              Abrir loja
            </a>
          ) : null
        }
        onCancel={onCloseSheet}
      />
      <div className={cn("min-h-0 flex-1", panel.id === 'apis' ? "flex flex-col overflow-hidden" : "flex flex-col overflow-hidden md:overflow-visible md:flex-row")}>
        {panel.id === 'apis' ? null : (
          <SheetInternalTabs tabs={tabs} activeTab={currentActiveTab} onChange={setActiveTab} tone={panel.colorClassName} />
        )}
        <div className="relative z-10 flex min-h-0 min-w-0 flex-1 flex-col bg-[#080e1d]">
          {panel.id === 'mercado-livre' && currentActiveTab === 'store' ? (
            <div className="shrink-0 border-b border-white/5 bg-[#080e1d] px-4 py-2 md:border-b-0">
              <StoreHeaderTabs
                tabs={mercadoFooter.storeTabs}
                activeTab={mercadoFooter.activeStoreTab}
                onChange={mercadoFooter.onStoreTabChange}
              />
            </div>
          ) : null}

          <div
            className={cn(
              "min-h-0 flex-1",
              panel.id === 'apis'
                ? "overflow-hidden px-0 pb-0 pt-0"
                : panel.id === 'mercado-livre' && currentActiveTab === 'dashboard'
                  ? "overflow-x-hidden overflow-y-auto px-0 pb-24 pt-4 md:px-6 md:pb-6 md:pt-6"
                  : "overflow-x-hidden overflow-y-auto px-4 pb-24 pt-5 md:px-6 md:pb-6 md:pt-6",
              panel.id === 'mercado-livre' && (currentActiveTab === 'connection' || currentActiveTab === 'store') && 'md:pb-24',
            )}
          >
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={contentKey}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
                className={cn("w-full min-w-0", panel.id === 'apis' && "flex h-full min-h-0 flex-col")}
              >
            {realPanel ? (
              realPanel
            ) : (
            <div className="space-y-6 text-sm text-slate-300">
            <div className="rounded-2xl border border-white/5 bg-white/[0.03] p-5">
              <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Status</div>
              <div className="mt-3 text-base font-medium text-white">{panel.statusLabel}</div>
              <div className="mt-2 text-sm text-slate-400">{panel.description}</div>
            </div>

            <div className="rounded-2xl border border-white/5 bg-white/[0.03] p-5">
              <div className="text-xs uppercase tracking-[0.18em] text-slate-500">
                Modulos conectados
              </div>
              <div className="mt-2 text-xs text-slate-500">Aba ativa: {tabs.find((tab) => tab.id === currentActiveTab)?.label}</div>
              <div className="mt-4 space-y-3">
                {sheetItems.map((item) => (
                  <div
                    key={item}
                    className="flex items-center justify-between rounded-xl border border-white/5 bg-slate-950/40 px-4 py-3"
                  >
                    <span className="text-sm text-slate-200">{item}</span>
                    <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 text-[11px] uppercase tracking-[0.14em] text-emerald-300">
                      ok
                    </span>
                  </div>
                ))}
              </div>
            </div>
            </div>
            )}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>
      {panel.id === 'apis' && apiDetailOpen ? (
        <div className="border-t border-white/5 px-6 py-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <Button
                type="button"
                variant="ghost"
                className="h-10 gap-2 rounded-xl border border-sky-500/20 bg-sky-500/10 px-4 text-sm text-sky-100 hover:bg-sky-500/15"
                onClick={() => setApiResetSignal((value) => value + 1)}
              >
                <ArrowLeft className="h-4 w-4" />
                Voltar para lista
              </Button>
            </div>
            <div className="flex items-center gap-3">
              <Button
                type="button"
                variant="ghost"
                className="h-10 rounded-xl border border-white/10 bg-white/[0.03] px-4 text-sm text-slate-300"
                onClick={() => setApiResetSignal((value) => value + 1)}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                form="api-postman-form"
                disabled={apiFooter.saving}
                variant="ghost"
                className="h-10 rounded-xl border border-sky-500/20 bg-sky-500/10 px-4 text-sm text-sky-100 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {apiFooter.saving ? 'Salvando...' : 'Salvar API'}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
      {panel.id === 'whatsapp' && whatsappFooter.canSaveContact ? (
        <div className="border-t border-white/5 px-6 py-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            {activeTab === 'attendants' ? (
              <>
                <div className="flex flex-wrap items-center gap-3">
                  {whatsappFooter.canCreateContact ? (
                    <Button
                      type="reset"
                      form="whatsapp-contact-form"
                      variant="ghost"
                      className="h-10 rounded-xl border border-white/10 bg-white/[0.03] px-4 text-sm text-slate-300"
                    >
                      Cadastrar novo atendente
                    </Button>
                  ) : null}
                  {whatsappFooter.canCancelContact ? (
                    <Button
                      type="reset"
                      form="whatsapp-contact-form"
                      variant="ghost"
                      className="h-10 rounded-xl border border-white/10 bg-white/[0.03] px-4 text-sm text-slate-300"
                    >
                      Cancelar
                    </Button>
                  ) : null}
                </div>
                <Button
                  type="submit"
                  form="whatsapp-contact-form"
                  disabled={whatsappFooter.savingContact}
                  variant="ghost"
                  className="h-10 rounded-xl border border-sky-500/20 bg-sky-500/10 px-4 text-sm text-sky-100 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {whatsappFooter.savingContact ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : null}
                  {whatsappFooter.savingContact ? 'Salvando...' : 'Salvar atendente'}
                </Button>
              </>
            ) : null}
          </div>
        </div>
      ) : null}
      {panel.id === 'chat-widget' && (widgetFooter.canSave || widgetFooter.canCopy) ? (
        <div className="border-t border-white/5 px-6 py-4">
          <div className="flex justify-end">
            {activeTab === 'edit' ? (
              <Button
                type="submit"
                form="widget-editor-form"
                disabled={widgetFooter.saving}
                variant="ghost"
                className="h-10 rounded-xl border border-sky-500/20 bg-sky-500/10 px-4 text-sm text-sky-100 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {widgetFooter.saving ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : null}
                {widgetFooter.saving ? 'Salvando...' : 'Salvar widget'}
              </Button>
            ) : null}
            {activeTab === 'code' ? (
              <Button type="submit" form="widget-copy-form" variant="ghost" className="h-10 rounded-xl border border-sky-500/20 bg-sky-500/10 px-4 text-sm text-sky-100">
                Copiar codigo
              </Button>
            ) : null}
          </div>
        </div>
      ) : null}
      {panel.id === 'mercado-livre' && (currentActiveTab === 'connection' || currentActiveTab === 'store') ? (
        <div className="shrink-0 border-t border-white/5 bg-[#080e1d] px-4 py-4 md:px-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              {currentActiveTab === 'connection' && mercadoFooter.step === 2 && mercadoFooter.canSaveConnection !== false ? (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => mercadoFooter.onBackToProductUrl?.()}
                  disabled={mercadoFooter.saving}
                  className="h-10 rounded-xl border border-white/10 bg-white/[0.04] px-4 text-sm text-slate-200 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Voltar e trocar link do produto
                </Button>
              ) : null}
            </div>
            <div className="flex justify-end">
              {currentActiveTab === 'connection' && mercadoFooter.step === 1 ? (
                <Button
                  type="submit"
                  form="mercado-livre-resolve-form"
                  disabled={mercadoFooter.saving}
                  variant="ghost"
                  className="h-10 rounded-xl border border-sky-500/20 bg-sky-500/10 px-4 text-sm text-sky-100 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {mercadoFooter.saving ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : null}
                  {!mercadoFooter.saving ? <ArrowRight className="mr-2 h-4 w-4" /> : null}
                  {mercadoFooter.saving ? 'Localizando...' : 'Avancar'}
                </Button>
              ) : null}
              {currentActiveTab === 'connection' && mercadoFooter.step === 2 ? (
                <Button
                  type="submit"
                  form="mercado-livre-save-form"
                  disabled={mercadoFooter.saving}
                  variant="ghost"
                  className="h-10 rounded-xl border border-sky-500/20 bg-sky-500/10 px-4 text-sm text-sky-100 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {mercadoFooter.saving ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : null}
                  {!mercadoFooter.saving ? <Check className="mr-2 h-4 w-4" /> : null}
                  {mercadoFooter.saving ? 'Salvando...' : 'Salvar conexão'}
                </Button>
              ) : null}
              {currentActiveTab === 'store' ? (
                <Button
                  type="submit"
                  form="mercado-livre-store-form"
                  disabled={mercadoFooter.saving}
                  variant="ghost"
                  className="h-10 rounded-xl border border-sky-500/20 bg-sky-500/10 px-4 text-sm text-sky-100 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {mercadoFooter.saving ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : null}
                  {!mercadoFooter.saving ? <Store className="mr-2 h-4 w-4" /> : null}
                  {mercadoFooter.saving ? 'Salvando...' : 'Salvar loja'}
                </Button>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}

