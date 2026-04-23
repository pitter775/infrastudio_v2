'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Files, History, MessageSquare, PackageSearch, PlugZap, Store, Users, Wand2 } from 'lucide-react'

import { ApiSheetManager } from '@/components/app/apis/api-sheet-manager'
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
      { id: 'history', label: 'Historico', icon: History },
    ]
  }

  if (panelId === 'whatsapp') {
    return [
      { id: 'channels', label: 'Canais', icon: MessageSquare },
      { id: 'qr', label: 'QR Code', icon: Store },
      { id: 'session', label: 'Sessao', icon: PlugZap },
      { id: 'events', label: 'Eventos', icon: History },
      { id: 'json', label: 'Config JSON', icon: Files },
    ]
  }

  if (panelId === 'chat-widget') {
    return [
      { id: 'widgets', label: 'Widgets', icon: PackageSearch },
      { id: 'install', label: 'Instalacao', icon: PlugZap },
      { id: 'behavior', label: 'Comportamento', icon: Wand2 },
      { id: 'events', label: 'Eventos', icon: History },
      { id: 'json', label: 'Config JSON', icon: Files },
    ]
  }

  return [
    { id: 'overview', label: 'Visao geral', icon: Store },
    { id: 'catalog', label: 'Catalogo', icon: PackageSearch },
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
  const [whatsappFooter, setWhatsappFooter] = useState({})
  const [widgetFooter, setWidgetFooter] = useState({})
  const [mercadoFooter, setMercadoFooter] = useState({})
  const [integrationStats, setIntegrationStats] = useState({})

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
        { id: 'tutorial', label: 'Tutorial', icon: Files },
      ]
    }

    if (panel.id === 'chat-widget') {
      return [
        { id: 'edit', label: 'Editar', icon: Wand2 },
        { id: 'code', label: 'Ver codigo fonte', icon: Files },
        { id: 'docs', label: 'Documentacao', icon: MessageSquare },
      ]
    }

      if (panel.id === 'mercado-livre') {
        return [
          { id: 'connection', label: 'Conexao', icon: Store },
          { id: 'test', label: 'Teste', icon: PackageSearch },
          { id: 'orders', label: 'Pedidos', icon: Files },
          { id: 'questions', label: 'Perguntas', icon: MessageSquare },
          { id: 'tutorial', label: 'Tutorial', icon: Files },
        ]
      }

    return buildIntegrationTabs(panel.id)
  }, [panel.id])
  const [activeTab, setActiveTab] = useState(
    deepLink?.tab && tabs.some((tab) => tab.id === deepLink.tab) ? deepLink.tab : tabs[0]?.id || 'overview',
  )

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
        activeTab={activeTab}
        onTabChange={setActiveTab}
        onFooterStateChange={setMercadoFooter}
        compact
        initialNotice={deepLink?.notice || ''}
      />
    ) : null
  const contentKey = realPanel ? `${panel.id}:manager` : `${panel.id}:${activeTab}`

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
              className="hidden h-7 rounded-lg border border-white/10 bg-white/[0.03] px-2.5 text-xs text-slate-300 md:inline-flex"
              onClick={() => setApiResetSignal((value) => value + 1)}
            >
              Voltar para lista
            </Button>
          ) : null
        }
        onCancel={onCloseSheet}
      />
      {panel.id === 'apis' ? null : (
        <SheetInternalTabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />
      )}

      <div
        className={cn(
          "min-h-0 flex-1",
          panel.id === 'apis' ? "overflow-hidden px-0 pb-0 pt-0" : "overflow-y-auto px-6 pb-6 pt-6",
        )}
      >
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={contentKey}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
            className={cn(panel.id === 'apis' && "flex h-full min-h-0 flex-col")}
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
            <div className="mt-2 text-xs text-slate-500">Aba ativa: {tabs.find((tab) => tab.id === activeTab)?.label}</div>
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
      {panel.id === 'apis' && apiDetailOpen ? (
        <div className="border-t border-white/5 px-6 py-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <Button
                type="button"
                variant="ghost"
                className="h-10 rounded-xl border border-white/10 bg-white/[0.03] px-4 text-sm text-slate-300"
                onClick={() => setApiResetSignal((value) => value + 1)}
              >
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
          <div className="flex justify-end">
            {activeTab === 'attendants' ? (
              <Button type="submit" form="whatsapp-contact-form" variant="ghost" className="h-10 rounded-xl border border-sky-500/20 bg-sky-500/10 px-4 text-sm text-sky-100">
                Salvar atendente
              </Button>
            ) : null}
          </div>
        </div>
      ) : null}
      {panel.id === 'chat-widget' && (widgetFooter.canSave || widgetFooter.canCopy) ? (
        <div className="border-t border-white/5 px-6 py-4">
          <div className="flex justify-end">
            {activeTab === 'edit' ? (
              <Button type="submit" form="widget-editor-form" variant="ghost" className="h-10 rounded-xl border border-sky-500/20 bg-sky-500/10 px-4 text-sm text-sky-100">
                Salvar widget
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
      {panel.id === 'mercado-livre' && activeTab === 'connection' ? (
        <div className="border-t border-white/5 px-6 py-4">
          <div className="flex justify-end">
            {mercadoFooter.step === 1 ? (
              <Button type="submit" form="mercado-livre-resolve-form" variant="ghost" className="h-10 rounded-xl border border-sky-500/20 bg-sky-500/10 px-4 text-sm text-sky-100">
                Avancar
              </Button>
            ) : null}
            {mercadoFooter.step === 2 ? (
              <Button type="submit" form="mercado-livre-save-form" variant="ghost" className="h-10 rounded-xl border border-sky-500/20 bg-sky-500/10 px-4 text-sm text-sky-100">
                Salvar conexao
              </Button>
            ) : null}
          </div>
        </div>
      ) : null}
    </>
  )
}

