import { WidgetContractTestClient } from "@/components/widget-contract/widget-contract-test-client"

const defaultApiBase = "https://www.infrastudio.pro"

export default function WidgetContractTestPage() {
  return (
    <main className="min-h-screen bg-slate-950 px-6 py-10 text-slate-100">
      <div className="mx-auto max-w-3xl space-y-8">
        <div className="space-y-3">
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-cyan-300">
            InfraStudio v2
          </p>
          <h1 className="text-3xl font-semibold">Teste de contrato do widget</h1>
          <p className="text-slate-300">
            Use esta pagina local para validar os scripts publicos antes da troca de dominio.
          </p>
        </div>

        <WidgetContractTestClient />

        <section className="space-y-3 rounded-lg border border-slate-800 bg-slate-900/60 p-5">
          <h2 className="text-lg font-semibold">Script atual</h2>
          <code className="block whitespace-pre-wrap rounded-md bg-slate-950 p-4 text-sm text-slate-200">
            {`<script src="${defaultApiBase}/chat.js" data-projeto="PROJETO" data-agente="AGENTE"></script>`}
          </code>
        </section>

        <section className="space-y-3 rounded-lg border border-slate-800 bg-slate-900/60 p-5">
          <h2 className="text-lg font-semibold">Script antigo</h2>
          <code className="block whitespace-pre-wrap rounded-md bg-slate-950 p-4 text-sm text-slate-200">
            {`<script src="${defaultApiBase}/chat-widget.js" data-widget="WIDGET"></script>`}
          </code>
        </section>

        <section className="space-y-3 rounded-lg border border-slate-800 bg-slate-900/60 p-5">
          <h2 className="text-lg font-semibold">Checklist manual</h2>
          <ul className="list-disc space-y-2 pl-5 text-slate-300">
            <li>abrir o widget</li>
            <li>enviar mensagem</li>
            <li>confirmar resposta com `chatId`</li>
            <li>recarregar a pagina e continuar no mesmo chat</li>
            <li>validar conversa no admin</li>
          </ul>
        </section>
      </div>
    </main>
  )
}
