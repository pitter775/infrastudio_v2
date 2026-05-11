'use client'

import { Button } from '@/components/ui/button'
import { AppSelect } from '@/components/ui/app-select'
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet'

export function buildAccessRequestMessage(label, projectName) {
  const lines = [
    `Solicito a liberação de acesso ao módulo ${label}.`,
    '',
    'Entendo que essa habilitação precisa ser solicitada diretamente para a InfraStudio.',
  ]

  if (projectName) {
    lines.push('', `Projeto de referência: ${projectName}.`)
  }

  lines.push('', 'Vou acompanhar a devolutiva na central de Solicitações.')

  return lines.join('\n')
}

export function AccessRequestSheet({
  open,
  onOpenChange,
  request,
  setRequest,
  projectOptions = [],
  saving,
  setSaving,
  error,
  setError,
}) {
  async function handleSubmit(event) {
    event.preventDefault()
    setSaving(true)
    setError(null)

    const response = await fetch('/api/admin/feedbacks', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        projetoId: request.projetoId,
        categoria: 'duvida',
        assunto: request.assunto,
        mensagemInicial: request.mensagemInicial,
      }),
    })
    const data = await response.json().catch(() => null)

    if (!response.ok || !data?.feedback?.id) {
      setError(data?.error ?? 'Não foi possível abrir a solicitação.')
      setSaving(false)
      return
    }

    onOpenChange(false)
    window.location.href = `/admin/feedback/${data.feedback.id}`
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="z-[281] w-[92vw] max-w-[460px] border-l border-white/5"
        overlayClassName="z-[280]"
      >
        <form onSubmit={handleSubmit} className="flex h-full flex-col">
          <div className="border-b border-white/5 px-5 py-5">
            <SheetTitle className="text-left text-lg font-semibold text-white">Solicitar acesso</SheetTitle>
            <SheetDescription className="mt-1 text-left text-sm text-slate-400">
              Esse acesso deve ser solicitado diretamente para a InfraStudio.
            </SheetDescription>
          </div>

          <div className="flex-1 space-y-4 overflow-y-auto px-5 py-5">
            <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
              Após o envio, acompanhe a resposta na central de Solicitações.
            </div>

            <label className="block space-y-2">
              <span className="text-sm font-semibold text-slate-300">Projeto</span>
              <AppSelect
                value={request.projetoId}
                onChangeValue={(value) => setRequest((current) => ({ ...current, projetoId: value }))}
                options={projectOptions}
              />
            </label>

            <label className="block space-y-2">
              <span className="text-sm font-semibold text-slate-300">Assunto</span>
              <input
                value={request.assunto}
                onChange={(event) => setRequest((current) => ({ ...current, assunto: event.target.value }))}
                className="w-full rounded-xl border border-white/10 bg-slate-950/50 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-500"
              />
            </label>

            <label className="block space-y-2">
              <span className="text-sm font-semibold text-slate-300">Mensagem</span>
              <textarea
                value={request.mensagemInicial}
                onChange={(event) => setRequest((current) => ({ ...current, mensagemInicial: event.target.value }))}
                rows={8}
                className="w-full rounded-xl border border-white/10 bg-slate-950/50 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-500"
              />
            </label>

            {error ? (
              <div className="rounded-xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
                {error}
              </div>
            ) : null}
          </div>

          <div className="border-t border-white/5 px-5 py-4">
            <Button
              type="submit"
              disabled={saving || !request.assunto.trim() || !request.mensagemInicial.trim()}
              className="h-10 w-full rounded-xl border border-sky-500/20 bg-sky-500/10 px-4 text-sm text-sky-100 hover:bg-sky-500/15"
            >
              {saving ? 'Enviando...' : 'Enviar solicitação'}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  )
}
