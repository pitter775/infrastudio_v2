"use client"

import { ChevronDown, Download, Plus, Search, Settings2 } from "lucide-react"

import { AdminPageHeader } from "@/components/admin/page-header"
import { Button } from "@/components/ui/button"

function BlockTitle({ title, subtitle }) {
  return (
    <div>
      <h3 className="text-lg font-semibold text-white">{title}</h3>
      <p className="mt-1 text-xs text-slate-500">{subtitle}</p>
    </div>
  )
}

export function AdminTemplatePage() {
  return (
    <div>
      <AdminPageHeader
        title="Template"
        description="Mock visual de botoes, dropdowns e padroes de titulo/subtitulo."
      />

      <div className="space-y-6">
        <section className="rounded-xl border border-white/5 bg-[#0b1120] p-5">
          <BlockTitle title="Titulos e subtitulos" subtitle="Padroes base para mock de cabecalho e secoes." />

          <div className="mt-5 grid gap-4 lg:grid-cols-2">
            <div className="rounded-2xl border border-white/10 bg-slate-950/35 p-5">
              <div className="text-[11px] uppercase tracking-[0.18em] text-cyan-300">Titulo principal</div>
              <h1 className="mt-3 text-2xl font-semibold text-white">Painel de operacao</h1>
              <p className="mt-2 text-sm text-slate-400">Subtitulo explicando contexto e o que a tela entrega.</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-slate-950/35 p-5">
              <div className="text-[11px] uppercase tracking-[0.18em] text-emerald-300">Titulo de secao</div>
              <h2 className="mt-3 text-lg font-semibold text-white">Resumo rapido</h2>
              <p className="mt-2 text-xs text-slate-500">Subtitulo curto para cards, grids e listas.</p>
            </div>
          </div>
        </section>

        <section className="rounded-xl border border-white/5 bg-[#0b1120] p-5">
          <BlockTitle title="Botoes" subtitle="Variacoes principais para uso no sistema." />

          <div className="mt-5 flex flex-wrap gap-3">
            <Button>Primario</Button>
            <Button variant="outline">Outline</Button>
            <Button variant="ghost">Ghost</Button>
            <Button size="sm">Small</Button>
            <Button size="lg">Large</Button>
            <Button size="icon" aria-label="Adicionar">
              <Plus className="h-4 w-4" />
            </Button>
            <Button className="gap-2 bg-emerald-500 text-slate-950 hover:bg-emerald-400">
              <Download className="h-4 w-4" />
              Exportar
            </Button>
            <Button className="gap-2 border border-sky-500/20 bg-sky-500/10 text-sky-100 hover:bg-sky-500/15">
              <Settings2 className="h-4 w-4" />
              Configurar
            </Button>
          </div>
        </section>

        <section className="rounded-xl border border-white/5 bg-[#0b1120] p-5">
          <BlockTitle title="Dropdowns em mock" subtitle="Com select nativo e botoes de trigger para referencia visual." />

          <div className="mt-5 grid gap-4 lg:grid-cols-2">
            <div className="space-y-3">
              <label className="block text-sm font-semibold text-slate-300">Select simples</label>
              <select className="w-full rounded-xl border border-white/10 bg-slate-950/50 px-4 py-3 text-sm text-white outline-none">
                <option>Selecione um template</option>
                <option>Padrao comercial</option>
                <option>Padrao operacional</option>
                <option>Padrao suporte</option>
              </select>
            </div>

            <div className="space-y-3">
              <label className="block text-sm font-semibold text-slate-300">Trigger mock</label>
              <button
                type="button"
                className="flex w-full items-center justify-between rounded-xl border border-white/10 bg-slate-950/50 px-4 py-3 text-sm text-white"
              >
                <span className="inline-flex items-center gap-2">
                  <Search className="h-4 w-4 text-slate-400" />
                  Buscar acao
                </span>
                <ChevronDown className="h-4 w-4 text-slate-400" />
              </button>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}
