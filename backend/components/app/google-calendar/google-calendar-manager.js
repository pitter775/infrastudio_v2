'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { CalendarDays, Check, LoaderCircle, PlugZap, Power, RefreshCw, Trash2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const defaultConfig = {
  durationMinutes: 60,
  minimumNoticeMinutes: 60,
  timezone: 'America/Sao_Paulo',
  allowedDays: [1, 2, 3, 4, 5],
  allowedStartTime: '09:00',
  allowedEndTime: '18:00',
  sendInvite: true,
  eventSummaryTemplate: 'Atendimento via InfraStudio',
  eventDescriptionTemplate: 'Evento criado automaticamente pelo agente da InfraStudio.',
}

const weekDays = [
  { id: 0, label: 'Dom' },
  { id: 1, label: 'Seg' },
  { id: 2, label: 'Ter' },
  { id: 3, label: 'Qua' },
  { id: 4, label: 'Qui' },
  { id: 5, label: 'Sex' },
  { id: 6, label: 'Sáb' },
]

function buildProjectIdentifier(project) {
  return project?.routeKey || project?.slug || project?.id || ''
}

function mergeConfig(config) {
  return {
    ...defaultConfig,
    ...(config && typeof config === 'object' ? config : {}),
  }
}

function Field({ label, children, description = '' }) {
  return (
    <label className="grid gap-2">
      <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">{label}</span>
      {children}
      {description ? <span className="text-xs text-slate-500">{description}</span> : null}
    </label>
  )
}

function inputClassName() {
  return 'h-10 rounded-xl border border-white/10 bg-slate-950/60 px-3 text-sm text-slate-100 outline-none transition focus:border-sky-400/50'
}

export function GoogleCalendarManager({ project, activeTab = 'connection', onStatsChange = null, compact = false }) {
  const projectIdentifier = buildProjectIdentifier(project)
  const agenteId = project?.agent?.id || null
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [connecting, setConnecting] = useState(false)
  const [connection, setConnection] = useState(null)
  const [calendars, setCalendars] = useState([])
  const [form, setForm] = useState(defaultConfig)
  const [calendarId, setCalendarId] = useState('')
  const [status, setStatus] = useState(null)

  const connected = connection?.status === 'connected'
  const selectedCalendar = useMemo(
    () => calendars.find((calendar) => calendar.id === calendarId) || null,
    [calendarId, calendars],
  )

  const loadConnection = useCallback(async () => {
    if (!projectIdentifier) return

    setLoading(true)
    try {
      const response = await fetch(`/api/app/projetos/${projectIdentifier}/google-calendar`, {
        cache: 'no-store',
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(data.error || 'Não foi possível carregar o Google Agenda.')
      }

      setConnection(data.connection || null)
      setCalendars(Array.isArray(data.calendars) ? data.calendars : [])
      setCalendarId(data.connection?.calendarId || data.calendars?.find?.((item) => item.primary)?.id || data.calendars?.[0]?.id || '')
      setForm(mergeConfig(data.connection?.configuracoes))
      onStatsChange?.({ googleCalendar: data.connection?.status === 'connected' ? 1 : 0 })
    } catch (error) {
      setStatus({ type: 'error', message: error?.message || 'Não foi possível carregar o Google Agenda.' })
    } finally {
      setLoading(false)
    }
  }, [onStatsChange, projectIdentifier])

  useEffect(() => {
    void loadConnection()
  }, [loadConnection])

  async function startOAuth() {
    setConnecting(true)
    setStatus(null)

    try {
      const response = await fetch(`/api/app/projetos/${projectIdentifier}/google-calendar/oauth/start`)
      const data = await response.json().catch(() => ({}))
      if (!response.ok || !data.authorizationUrl) {
        throw new Error(data.error || 'Não foi possível iniciar a conexão com Google.')
      }

      window.location.href = data.authorizationUrl
    } catch (error) {
      setStatus({ type: 'error', message: error?.message || 'Não foi possível iniciar a conexão com Google.' })
      setConnecting(false)
    }
  }

  async function saveConfig(event) {
    event?.preventDefault?.()
    setSaving(true)
    setStatus(null)

    try {
      const calendar = selectedCalendar
      const response = await fetch(`/api/app/projetos/${projectIdentifier}/google-calendar`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agenteId,
          calendarId,
          calendarName: calendar?.name || connection?.calendarName || calendarId,
          configuracoes: form,
        }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(data.error || 'Não foi possível salvar o Google Agenda.')
      }

      setConnection(data.connection)
      setStatus({ type: 'success', message: 'Google Agenda salvo.' })
      onStatsChange?.({ googleCalendar: data.connection?.status === 'connected' ? 1 : 0 })
    } catch (error) {
      setStatus({ type: 'error', message: error?.message || 'Não foi possível salvar o Google Agenda.' })
    } finally {
      setSaving(false)
    }
  }

  async function disconnect() {
    setSaving(true)
    setStatus(null)

    try {
      const response = await fetch(`/api/app/projetos/${projectIdentifier}/google-calendar`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agenteId }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(data.error || 'Não foi possível desconectar o Google Agenda.')
      }

      setConnection(null)
      setCalendars([])
      setCalendarId('')
      onStatsChange?.({ googleCalendar: 0 })
      setStatus({ type: 'success', message: 'Google Agenda desconectado.' })
    } catch (error) {
      setStatus({ type: 'error', message: error?.message || 'Não foi possível desconectar o Google Agenda.' })
    } finally {
      setSaving(false)
    }
  }

  function toggleDay(dayId) {
    setForm((current) => {
      const days = Array.isArray(current.allowedDays) ? current.allowedDays : []
      const nextDays = days.includes(dayId) ? days.filter((item) => item !== dayId) : [...days, dayId].sort()
      return { ...current, allowedDays: nextDays }
    })
  }

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-slate-400">
        <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
        Carregando Google Agenda...
      </div>
    )
  }

  return (
    <div className={cn('grid gap-5', compact && 'pb-6')}>
      {status ? (
        <div
          className={cn(
            'rounded-xl border px-4 py-3 text-sm',
            status.type === 'success'
              ? 'border-emerald-400/20 bg-emerald-500/10 text-emerald-100'
              : 'border-rose-400/20 bg-rose-500/10 text-rose-100',
          )}
        >
          {status.message}
        </div>
      ) : null}

      {activeTab === 'connection' ? (
        <div className="grid gap-5">
          <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 text-base font-semibold text-white">
                  <CalendarDays className="h-4 w-4 text-sky-300" />
                  Google Agenda
                </div>
                <p className="mt-2 max-w-xl text-sm text-slate-400">
                  Conecte a agenda que o agente vai usar para criar eventos e confirmar horários com clientes.
                </p>
              </div>
              <span
                className={cn(
                  'rounded-full border px-3 py-1 text-xs font-semibold',
                  connected
                    ? 'border-emerald-400/20 bg-emerald-500/10 text-emerald-200'
                    : 'border-slate-500/20 bg-slate-500/10 text-slate-300',
                )}
              >
                {connected ? 'Conectado' : 'Desconectado'}
              </span>
            </div>

            <div className="mt-5 grid gap-3 rounded-xl border border-white/5 bg-slate-950/40 p-4 text-sm">
              <div className="flex items-center justify-between gap-3">
                <span className="text-slate-500">Conta</span>
                <span className="text-right font-medium text-slate-100">{connection?.googleAccountEmail || 'Nenhuma conta conectada'}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-slate-500">Calendário</span>
                <span className="text-right font-medium text-slate-100">{connection?.calendarName || selectedCalendar?.name || 'Não selecionado'}</span>
              </div>
            </div>

            <div className="mt-5 flex flex-wrap gap-3">
              <Button
                type="button"
                onClick={startOAuth}
                disabled={connecting}
                variant="ghost"
                className="h-10 gap-2 rounded-xl border border-sky-500/20 bg-sky-500/10 px-4 text-sm text-sky-100 hover:bg-sky-500/15 disabled:opacity-50"
              >
                {connecting ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <PlugZap className="h-4 w-4" />}
                {connected ? 'Reconectar Google' : 'Conectar Google'}
              </Button>
              <Button
                type="button"
                onClick={loadConnection}
                variant="ghost"
                className="h-10 gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-4 text-sm text-slate-300"
              >
                <RefreshCw className="h-4 w-4" />
                Atualizar
              </Button>
              {connected ? (
                <Button
                  type="button"
                  onClick={disconnect}
                  disabled={saving}
                  variant="ghost"
                  className="h-10 gap-2 rounded-xl border border-rose-400/20 bg-rose-500/10 px-4 text-sm text-rose-100 disabled:opacity-50"
                >
                  <Trash2 className="h-4 w-4" />
                  Desconectar
                </Button>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      {activeTab === 'settings' ? (
        <form className="grid gap-5" onSubmit={saveConfig}>
          {!connected ? (
            <div className="rounded-xl border border-amber-400/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
              Conecte uma conta Google antes de configurar a agenda.
            </div>
          ) : null}

          <div className="grid gap-4 rounded-2xl border border-white/8 bg-white/[0.03] p-5">
            <Field label="Calendário">
              <select
                className={inputClassName()}
                value={calendarId}
                disabled={!connected}
                onChange={(event) => setCalendarId(event.target.value)}
              >
                {calendars.length ? null : <option value="">Nenhum calendário carregado</option>}
                {calendars.map((calendar) => (
                  <option key={calendar.id} value={calendar.id}>
                    {calendar.name}{calendar.primary ? ' (principal)' : ''}
                  </option>
                ))}
              </select>
            </Field>

            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Duração padrão">
                <input
                  type="number"
                  min="15"
                  step="15"
                  className={inputClassName()}
                  value={form.durationMinutes}
                  onChange={(event) => setForm((current) => ({ ...current, durationMinutes: Number(event.target.value) }))}
                />
              </Field>
              <Field label="Antecedência mínima">
                <input
                  type="number"
                  min="0"
                  step="15"
                  className={inputClassName()}
                  value={form.minimumNoticeMinutes}
                  onChange={(event) => setForm((current) => ({ ...current, minimumNoticeMinutes: Number(event.target.value) }))}
                />
              </Field>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <Field label="Timezone">
                <input
                  className={inputClassName()}
                  value={form.timezone}
                  onChange={(event) => setForm((current) => ({ ...current, timezone: event.target.value }))}
                />
              </Field>
              <Field label="Início">
                <input
                  type="time"
                  className={inputClassName()}
                  value={form.allowedStartTime}
                  onChange={(event) => setForm((current) => ({ ...current, allowedStartTime: event.target.value }))}
                />
              </Field>
              <Field label="Fim">
                <input
                  type="time"
                  className={inputClassName()}
                  value={form.allowedEndTime}
                  onChange={(event) => setForm((current) => ({ ...current, allowedEndTime: event.target.value }))}
                />
              </Field>
            </div>

            <Field label="Dias permitidos">
              <div className="flex flex-wrap gap-2">
                {weekDays.map((day) => {
                  const active = form.allowedDays?.includes(day.id)
                  return (
                    <button
                      key={day.id}
                      type="button"
                      onClick={() => toggleDay(day.id)}
                      className={cn(
                        'h-9 rounded-lg border px-3 text-xs font-semibold',
                        active
                          ? 'border-sky-400/35 bg-sky-500/15 text-sky-100'
                          : 'border-white/10 bg-slate-950/40 text-slate-400',
                      )}
                    >
                      {day.label}
                    </button>
                  )
                })}
              </div>
            </Field>
          </div>

          <div className="grid gap-4 rounded-2xl border border-white/8 bg-white/[0.03] p-5">
            <Field label="Título do evento">
              <input
                className={inputClassName()}
                value={form.eventSummaryTemplate}
                onChange={(event) => setForm((current) => ({ ...current, eventSummaryTemplate: event.target.value }))}
              />
            </Field>
            <Field label="Descrição padrão">
              <textarea
                className="min-h-24 rounded-xl border border-white/10 bg-slate-950/60 px-3 py-3 text-sm text-slate-100 outline-none transition focus:border-sky-400/50"
                value={form.eventDescriptionTemplate}
                onChange={(event) => setForm((current) => ({ ...current, eventDescriptionTemplate: event.target.value }))}
              />
            </Field>
            <label className="flex items-center gap-3 rounded-xl border border-white/8 bg-slate-950/40 px-4 py-3 text-sm text-slate-300">
              <input
                type="checkbox"
                checked={form.sendInvite}
                onChange={(event) => setForm((current) => ({ ...current, sendInvite: event.target.checked }))}
              />
              Enviar convite para o cliente quando houver email
            </label>
          </div>

          <div className="flex justify-end">
            <Button
              type="submit"
              disabled={!connected || saving}
              variant="ghost"
              className="h-10 gap-2 rounded-xl border border-sky-500/20 bg-sky-500/10 px-4 text-sm text-sky-100 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              {saving ? 'Salvando...' : 'Salvar Google Agenda'}
            </Button>
          </div>
        </form>
      ) : null}

      {activeTab === 'json' ? (
        <div className="rounded-2xl border border-white/8 bg-slate-950/70 p-4">
          <pre className="overflow-auto text-xs text-slate-300">
            {JSON.stringify({ connection, calendars: calendars.map(({ id, name, primary }) => ({ id, name, primary })) }, null, 2)}
          </pre>
        </div>
      ) : null}
    </div>
  )
}
