"use client"

import { useEffect, useMemo, useState } from "react"
import { CalendarClock, ChevronDown, Clock, LoaderCircle, Save } from "lucide-react"

import { AdminPageHeader } from "@/components/admin/page-header"
import { AppSelect } from "@/components/ui/app-select"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

const statusOptions = [
  { value: "reservado", label: "Reservado" },
  { value: "confirmado", label: "Confirmado" },
  { value: "cancelado", label: "Cancelado" },
  { value: "concluido", label: "Concluido" },
]

const initialGenerator = {
  dataInicio: new Date().toISOString().slice(0, 10),
  dataFim: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
  horaInicio: "08:00",
  horaFim: "20:00",
  duracaoMinutos: 60,
  capacidade: 1,
}

function getProjectOptions(projects) {
  return projects.map((project) => ({
    value: project.id,
    label: project.name || project.nome || project.slug || "Projeto",
  }))
}

function formatDate(value) {
  if (!value) return "Sem data"
  const normalized = String(value).slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) return "Sem data"
  return new Intl.DateTimeFormat("pt-BR", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    timeZone: "UTC",
  }).format(new Date(`${normalized}T00:00:00.000Z`))
}

function formatDateTime(value) {
  if (!value) return "-"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "-"
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date)
}

function formatTime(value) {
  return String(value || "").slice(0, 5).replace(":00", "h")
}

function getSlotStatus(slot, reservedIds) {
  if (slot.ativo === false) return "blocked"
  if (reservedIds.has(slot.id)) return "reserved"
  return "available"
}

function getMonthKey(value) {
  const date = new Date(`${String(value).slice(0, 10)}T00:00:00.000Z`)
  return Number.isNaN(date.getTime()) ? "sem-mes" : date.toISOString().slice(0, 7)
}

function getMonthLabel(value) {
  if (value === "sem-mes") return "Sem mes"
  return new Intl.DateTimeFormat("pt-BR", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${value}-01T00:00:00.000Z`))
}

function getWeekStart(value) {
  const date = new Date(`${String(value).slice(0, 10)}T00:00:00.000Z`)
  if (Number.isNaN(date.getTime())) return "sem-semana"
  const day = date.getUTCDay()
  const diff = day === 0 ? -6 : 1 - day
  date.setUTCDate(date.getUTCDate() + diff)
  return date.toISOString().slice(0, 10)
}

function getWeekLabel(value) {
  if (value === "sem-semana") return "Sem semana"
  const start = new Date(`${value}T00:00:00.000Z`)
  const end = new Date(start)
  end.setUTCDate(end.getUTCDate() + 6)
  return `${formatDate(start.toISOString().slice(0, 10))} ate ${formatDate(end.toISOString().slice(0, 10))}`
}

function groupSlotsByMonthWeek(slots) {
  const months = new Map()

  for (const slot of slots) {
    const dateKey = String(slot.dataInicio || "sem-data").slice(0, 10)
    const monthKey = getMonthKey(dateKey)
    const weekKey = getWeekStart(dateKey)
    const month = months.get(monthKey) ?? { key: monthKey, label: getMonthLabel(monthKey), count: 0, weeks: new Map() }
    const week = month.weeks.get(weekKey) ?? { key: weekKey, label: getWeekLabel(weekKey), count: 0, days: new Map() }

    week.days.set(dateKey, [...(week.days.get(dateKey) ?? []), slot])
    week.count += 1
    month.count += 1
    month.weeks.set(weekKey, week)
    months.set(monthKey, month)
  }

  return Array.from(months.values()).map((month) => ({
    ...month,
    weeks: Array.from(month.weeks.values()).map((week) => ({
      ...week,
      days: Array.from(week.days.entries()),
    })),
  }))
}

export default function AgendaPage() {
  const [projects, setProjects] = useState([])
  const [projectId, setProjectId] = useState("")
  const [slots, setSlots] = useState([])
  const [reservations, setReservations] = useState([])
  const [selectedSlotIds, setSelectedSlotIds] = useState([])
  const [generator, setGenerator] = useState(initialGenerator)
  const [replicationProjectId, setReplicationProjectId] = useState("")
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [feedback, setFeedback] = useState(null)
  const [openMonths, setOpenMonths] = useState({})
  const [openWeeks, setOpenWeeks] = useState({})
  const projectOptions = useMemo(() => getProjectOptions(projects), [projects])
  const selectedProject = useMemo(() => projects.find((project) => project.id === projectId) ?? null, [projects, projectId])
  const selectedAgentId = selectedProject?.agent?.id ?? ""
  const replicationOptions = useMemo(
    () => projectOptions.filter((option) => option.value !== projectId),
    [projectOptions, projectId]
  )
  const reservedIds = useMemo(
    () =>
      new Set(
        reservations
          .filter((reservation) => ["reservado", "confirmado"].includes(reservation.status))
          .map((reservation) => reservation.horarioId)
          .filter(Boolean)
      ),
    [reservations]
  )
  const groupedSlots = useMemo(() => groupSlotsByMonthWeek(slots), [slots])

  useEffect(() => {
    async function loadProjects() {
      const response = await fetch("/api/admin/projetos", { cache: "no-store" })
      const data = await response.json().catch(() => ({}))

      if (response.ok) {
        setProjects(data.projects ?? [])
        setProjectId(data.projects?.[0]?.id ?? "")
        setReplicationProjectId(data.projects?.[1]?.id ?? "")
      } else {
        setFeedback(data.error || "Nao foi possivel carregar projetos.")
        setLoading(false)
      }
    }

    void loadProjects()
  }, [])

  async function loadAgenda() {
    if (!projectId) return

    setLoading(true)
    const response = await fetch(`/api/admin/agenda?projetoId=${encodeURIComponent(projectId)}`, {
      cache: "no-store",
    })
    const data = await response.json().catch(() => ({}))

    if (response.ok) {
      setSlots(data.slots ?? [])
      setReservations(data.reservations ?? [])
      setSelectedSlotIds([])
      const nextMonths = {}
      const nextWeeks = {}
      for (const month of groupSlotsByMonthWeek(data.slots ?? []).slice(0, 1)) {
        nextMonths[month.key] = true
        if (month.weeks[0]) nextWeeks[month.weeks[0].key] = true
      }
      setOpenMonths(nextMonths)
      setOpenWeeks(nextWeeks)
      setFeedback(null)
    } else {
      setFeedback(data.error || "Nao foi possivel carregar agenda.")
    }

    setLoading(false)
  }

  useEffect(() => {
    void loadAgenda()
  }, [projectId])

  useEffect(() => {
    if (!replicationOptions.length) {
      setReplicationProjectId("")
      return
    }

    if (!replicationOptions.some((option) => option.value === replicationProjectId)) {
      setReplicationProjectId(replicationOptions[0]?.value ?? "")
    }
  }, [replicationOptions, replicationProjectId])

  function updateGenerator(field, value) {
    setGenerator((current) => ({ ...current, [field]: value }))
  }

  function toggleSlot(slot) {
    setSelectedSlotIds((current) =>
      current.includes(slot.id) ? current.filter((id) => id !== slot.id) : [...current, slot.id]
    )
  }

  function toggleMonth(key) {
    setOpenMonths((current) => ({ ...current, [key]: !current[key] }))
  }

  function toggleWeek(key) {
    setOpenWeeks((current) => ({ ...current, [key]: !current[key] }))
  }

  async function generateSlots(event) {
    event.preventDefault()
    if (!projectId) return

    setSaving(true)
    setFeedback(null)

    const response = await fetch("/api/admin/agenda", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...generator,
        projetoId: projectId,
        agenteId: selectedAgentId || null,
      }),
    })
    const data = await response.json().catch(() => ({}))

    if (!response.ok) {
      setFeedback(data.error || "Nao foi possivel gerar horarios.")
      setSaving(false)
      return
    }

    setFeedback(`${data.created ?? 0} horarios gerados.`)
    await loadAgenda()
    setSaving(false)
  }

  async function replicateAgenda() {
    if (!projectId || !replicationProjectId) return

    setSaving(true)
    setFeedback(null)
    const response = await fetch("/api/admin/agenda", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "replicate_to_project",
        projetoId: projectId,
        targetProjetoId: replicationProjectId,
      }),
    })
    const data = await response.json().catch(() => ({}))

    if (!response.ok) {
      setFeedback(data.error || "Nao foi possivel replicar a agenda.")
      setSaving(false)
      return
    }

    setFeedback(`Agenda replicada. ${data.created ?? 0} horarios criados no projeto destino.`)
    setSaving(false)
  }

  async function clearAgenda() {
    if (!projectId || saving) return
    if (typeof window !== "undefined" && !window.confirm("Remover todos os horarios e reservas deste projeto?")) {
      return
    }

    setSaving(true)
    setFeedback(null)
    const response = await fetch("/api/admin/agenda", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        projetoId: projectId,
      }),
    })
    const data = await response.json().catch(() => ({}))

    if (!response.ok) {
      setFeedback(data.error || "Nao foi possivel limpar a agenda.")
      setSaving(false)
      return
    }

    setFeedback(`Agenda limpa. ${data.deletedSlots ?? 0} horarios e ${data.deletedReservations ?? 0} reservas removidos.`)
    await loadAgenda()
    setSaving(false)
  }

  async function updateSelectedSlots(active) {
    if (!selectedSlotIds.length || !projectId) return

    setSaving(true)
    const response = await fetch("/api/admin/agenda", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        projetoId: projectId,
        ids: selectedSlotIds,
        ativo: active,
      }),
    })
    const data = await response.json().catch(() => ({}))

    if (!response.ok) {
      setFeedback(data.error || "Nao foi possivel atualizar horarios.")
    } else {
      setFeedback(active ? "Horarios liberados." : "Horarios bloqueados.")
      await loadAgenda()
    }

    setSaving(false)
  }

  async function reserveSelectedSlots() {
    if (!selectedSlotIds.length || !projectId) return

    setSaving(true)
    const response = await fetch("/api/admin/agenda", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "reserve_slots",
        projetoId: projectId,
        ids: selectedSlotIds,
      }),
    })
    const data = await response.json().catch(() => ({}))

    if (!response.ok) {
      setFeedback(data.error || "Nao foi possivel reservar horarios.")
    } else {
      setFeedback(`${data.reservations?.length ?? 0} horarios reservados.`)
      await loadAgenda()
    }

    setSaving(false)
  }

  async function updateReservationStatus(reservation, status) {
    const response = await fetch("/api/admin/agenda", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "reservation",
        id: reservation.id,
        projetoId: projectId,
        status,
      }),
    })
    const data = await response.json().catch(() => ({}))

    if (response.ok) {
      setReservations((current) => current.map((item) => (item.id === data.reservation.id ? data.reservation : item)))
    } else {
      setFeedback(data.error || "Nao foi possivel atualizar reserva.")
    }
  }

  return (
    <div className="space-y-5">
      <AdminPageHeader
        title="Agenda"
        description="Gere slots reais de atendimento por periodo."
        actions={
          <div className="w-full min-w-[220px] lg:w-[300px]">
            <AppSelect
              value={projectId}
              onChangeValue={setProjectId}
              options={projectOptions}
              placeholder="Selecione o projeto"
              minHeight={38}
            />
          </div>
        }
      />

      {feedback ? (
        <div className="rounded-xl border border-sky-400/15 bg-sky-500/10 px-4 py-3 text-sm text-sky-100">
          {feedback}
        </div>
      ) : null}

      <form onSubmit={generateSlots} className="rounded-xl border border-white/5 bg-[#0d1424] p-4">
        <div className="flex items-center gap-2 text-sm font-semibold text-white">
          <CalendarClock className="h-4 w-4 text-sky-300" />
          Gerar horarios
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-6">
          <label className="grid gap-1.5 text-xs text-slate-400">
            Data inicial
            <input
              type="date"
              value={generator.dataInicio}
              onChange={(event) => updateGenerator("dataInicio", event.target.value)}
              className="h-10 rounded-lg border border-white/10 bg-white/[0.03] px-3 text-sm text-white outline-none focus:border-sky-400/30"
            />
          </label>
          <label className="grid gap-1.5 text-xs text-slate-400">
            Data final
            <input
              type="date"
              value={generator.dataFim}
              onChange={(event) => updateGenerator("dataFim", event.target.value)}
              className="h-10 rounded-lg border border-white/10 bg-white/[0.03] px-3 text-sm text-white outline-none focus:border-sky-400/30"
            />
          </label>
          <label className="grid gap-1.5 text-xs text-slate-400">
            Hora inicio
            <input
              type="time"
              value={generator.horaInicio}
              onChange={(event) => updateGenerator("horaInicio", event.target.value)}
              className="h-10 rounded-lg border border-white/10 bg-white/[0.03] px-3 text-sm text-white outline-none focus:border-sky-400/30"
            />
          </label>
          <label className="grid gap-1.5 text-xs text-slate-400">
            Hora fim
            <input
              type="time"
              value={generator.horaFim}
              onChange={(event) => updateGenerator("horaFim", event.target.value)}
              className="h-10 rounded-lg border border-white/10 bg-white/[0.03] px-3 text-sm text-white outline-none focus:border-sky-400/30"
            />
          </label>
          <label className="grid gap-1.5 text-xs text-slate-400">
            Duracao
            <select
              value={generator.duracaoMinutos}
              onChange={(event) => updateGenerator("duracaoMinutos", Number(event.target.value))}
              className="h-10 rounded-lg border border-white/10 bg-[#111827] px-3 text-sm text-white outline-none focus:border-sky-400/30"
            >
              <option value={30}>30 min</option>
              <option value={45}>45 min</option>
              <option value={60}>60 min</option>
              <option value={90}>90 min</option>
              <option value={120}>120 min</option>
            </select>
          </label>
          <label className="grid gap-1.5 text-xs text-slate-400">
            Capacidade
            <input
              type="number"
              min="1"
              value={generator.capacidade}
              onChange={(event) => updateGenerator("capacidade", event.target.value)}
              className="h-10 rounded-lg border border-white/10 bg-white/[0.03] px-3 text-sm text-white outline-none focus:border-sky-400/30"
            />
          </label>
        </div>

        <div className="mt-4">
          <div className="flex flex-wrap gap-2">
            <Button type="submit" disabled={saving || !projectId} className="gap-2">
              {saving ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Gerar horarios
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={saving || !projectId || (!slots.length && !reservations.length)}
              onClick={clearAgenda}
              className="border-red-500/25 bg-red-500/10 text-red-100 hover:border-red-400/35 hover:bg-red-500/15 hover:text-red-50"
            >
              Limpar agenda
            </Button>
          </div>
        </div>

        {replicationOptions.length ? (
          <div className="mt-5 border-t border-white/5 pt-4">
            <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_220px]">
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Replicar para projeto</div>
                <p className="mt-1 text-sm text-slate-400">
                  Replica todos os horarios deste projeto para outro projeto e cadastra automaticamente as APIs de agenda no agente ativo do destino.
                </p>
              </div>
              <div className="grid gap-2">
                <AppSelect
                  value={replicationProjectId}
                  onChangeValue={setReplicationProjectId}
                  options={replicationOptions}
                  placeholder="Selecione o projeto destino"
                  minHeight={42}
                />
                <Button type="button" disabled={saving || !replicationProjectId || !projectId} onClick={replicateAgenda}>
                  Replicar agenda
                </Button>
              </div>
            </div>
          </div>
        ) : null}
      </form>

      <section className="rounded-xl border border-white/5 bg-[#0d1424]">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/5 px-4 py-3">
          <div>
            <div className="text-sm font-semibold text-white">Horarios disponiveis</div>
            <div className="mt-1 text-xs text-slate-500">{slots.length} horarios cadastrados</div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="ghost" disabled={!selectedSlotIds.length || saving} onClick={reserveSelectedSlots}>
              Reservar
            </Button>
            <Button type="button" variant="ghost" disabled={!selectedSlotIds.length || saving} onClick={() => updateSelectedSlots(false)}>
              Bloquear
            </Button>
            <Button type="button" variant="ghost" disabled={!selectedSlotIds.length || saving} onClick={() => updateSelectedSlots(true)}>
              Liberar
            </Button>
          </div>
        </div>

        <div className="grid gap-4 p-4">
          {loading ? (
            <div className="flex items-center gap-2 px-2 py-4 text-sm text-slate-400">
              <LoaderCircle className="h-4 w-4 animate-spin" />
              Carregando agenda...
            </div>
          ) : groupedSlots.length ? (
            groupedSlots.map((month) => (
              <div key={month.key} className="overflow-hidden rounded-lg border border-white/10 bg-white/[0.02]">
                <button
                  type="button"
                  onClick={() => toggleMonth(month.key)}
                  className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
                >
                  <span>
                    <span className="block text-sm font-semibold capitalize text-white">{month.label}</span>
                    <span className="text-xs text-slate-500">{month.count} horarios</span>
                  </span>
                  <ChevronDown className={cn("h-4 w-4 text-slate-400 transition", openMonths[month.key] && "rotate-180")} />
                </button>

                {openMonths[month.key] ? (
                  <div className="grid gap-3 border-t border-white/5 p-3">
                    {month.weeks.map((week) => (
                      <div key={week.key} className="rounded-lg border border-white/5 bg-[#0a1020]">
                        <button
                          type="button"
                          onClick={() => toggleWeek(week.key)}
                          className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left"
                        >
                          <span>
                            <span className="block text-xs font-semibold text-slate-200">{week.label}</span>
                            <span className="text-[11px] text-slate-500">{week.count} horarios</span>
                          </span>
                          <ChevronDown className={cn("h-4 w-4 text-slate-500 transition", openWeeks[week.key] && "rotate-180")} />
                        </button>

                        {openWeeks[week.key] ? (
                          <div className="grid gap-3 border-t border-white/5 p-3">
                            {week.days.map(([date, daySlots]) => (
                              <div key={date} className="grid gap-2">
                                <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
                                  {formatDate(date)}
                                </div>
                                <div className="flex flex-wrap gap-2">
                                  {daySlots.map((slot) => {
                                    const status = getSlotStatus(slot, reservedIds)
                                    const selected = selectedSlotIds.includes(slot.id)
                                    return (
                                      <button
                                        key={slot.id}
                                        type="button"
                                        onClick={() => toggleSlot(slot)}
                                        className={cn(
                                          "rounded-lg border px-3 py-2 text-xs font-semibold transition",
                                          status === "available" && "border-emerald-400/20 bg-emerald-500/10 text-emerald-100",
                                          status === "reserved" && "border-slate-500/20 bg-slate-500/10 text-slate-300",
                                          status === "blocked" && "border-red-400/20 bg-red-500/10 text-red-100",
                                          selected && "ring-2 ring-sky-300/40"
                                        )}
                                      >
                                        {formatTime(slot.horaInicio)} - {formatTime(slot.horaFim)}
                                      </button>
                                    )
                                  })}
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            ))
          ) : (
            <div className="rounded-lg border border-dashed border-white/10 px-4 py-8 text-sm text-slate-500">
              Nenhum slot gerado.
            </div>
          )}
        </div>
      </section>

      <section className="rounded-xl border border-white/5 bg-[#0d1424]">
        <div className="flex items-center justify-between border-b border-white/5 px-4 py-3">
          <div className="text-sm font-semibold text-white">Reservas</div>
          <div className="text-xs text-slate-500">{reservations.length} recentes</div>
        </div>
        <div className="grid gap-2 p-3">
          {reservations.length ? (
            reservations.map((reservation) => (
              <div key={reservation.id} className="rounded-lg border border-white/5 bg-white/[0.02] p-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 text-sm font-semibold text-white">
                      <Clock className="h-4 w-4 text-sky-300" />
                      {formatDateTime(reservation.horarioReservado)}
                    </div>
                    <div className="mt-1 text-xs text-slate-400">
                      {reservation.contatoNome || reservation.contatoEmail || reservation.contatoTelefone || "Contato nao informado"}
                    </div>
                  </div>
                  <AppSelect
                    value={reservation.status}
                    onChangeValue={(value) => updateReservationStatus(reservation, value)}
                    options={statusOptions}
                    minHeight={34}
                  />
                </div>
                {reservation.resumoConversa ? (
                  <p className="mt-3 text-sm leading-6 text-slate-300">{reservation.resumoConversa}</p>
                ) : null}
                <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-slate-500">
                  <span>{reservation.contatoEmail || "sem email"}</span>
                  <span>{reservation.contatoTelefone || "sem celular"}</span>
                  <span>{reservation.origem}</span>
                </div>
              </div>
            ))
          ) : (
            <div className="rounded-lg border border-dashed border-white/10 px-4 py-8 text-sm text-slate-500">
              Nenhuma reserva recente.
            </div>
          )}
        </div>
      </section>
    </div>
  )
}
