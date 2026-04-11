import Link from "next/link"
import { ArrowRight, Bot, MonitorPlay, Sparkles } from "lucide-react"

import { Button } from "@/components/ui/button"

export default function DemoPage() {
  return (
    <main className="min-h-screen bg-zinc-950 px-4 py-10 text-white sm:px-6 lg:px-8">
      <div className="mx-auto flex min-h-[calc(100vh-80px)] max-w-5xl flex-col justify-center">
        <div className="mb-6 inline-flex w-fit items-center gap-2 rounded-lg border border-cyan-300/20 bg-cyan-300/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-cyan-100">
          <Sparkles className="h-3.5 w-3.5" />
          Demo isolada
        </div>

        <h1 className="max-w-3xl text-4xl font-semibold tracking-tight sm:text-5xl">
          Teste o atendimento antes de publicar.
        </h1>
        <p className="mt-4 max-w-2xl text-base leading-7 text-zinc-300">
          Use o ambiente de demo para validar o widget, o chat e o visual sem depender do legado.
        </p>

        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          <Link
            href="/widget-contract-test"
            className="rounded-lg border border-white/10 bg-white/[0.04] p-5 transition hover:border-cyan-300/30 hover:bg-white/[0.07]"
          >
            <Bot className="h-7 w-7 text-cyan-200" />
            <h2 className="mt-4 text-lg font-semibold">Testar widget</h2>
            <p className="mt-2 text-sm leading-6 text-zinc-400">
              Carrega `/chat.js` e `/chat-widget.js` contra o host atual.
            </p>
          </Link>

          <Link
            href="/mock01"
            className="rounded-lg border border-white/10 bg-white/[0.04] p-5 transition hover:border-cyan-300/30 hover:bg-white/[0.07]"
          >
            <MonitorPlay className="h-7 w-7 text-cyan-200" />
            <h2 className="mt-4 text-lg font-semibold">Laboratorio visual</h2>
            <p className="mt-2 text-sm leading-6 text-zinc-400">
              Mantem o `mock01` disponivel para testar ideias de interface.
            </p>
          </Link>
        </div>

        <div className="mt-8 flex flex-wrap gap-3">
          <Button asChild>
            <Link href="/widget-contract-test" className="gap-2">
              Abrir teste do widget
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
          <Button asChild variant="outline" className="border-white/15 bg-transparent text-white hover:bg-white/10">
            <Link href="/">Voltar para home</Link>
          </Button>
        </div>
      </div>
    </main>
  )
}
