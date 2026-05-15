'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { AlertCircle, Check, LoaderCircle, ShieldCheck, Sparkles } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const TERMS_ITEMS = [
  'A InfraStudio oferece ferramentas de automação, atendimento com IA, integrações e uso de APIs para apoiar sua operação.',
  'Respostas geradas por IA e ações realizadas por APIs podem conter imprecisões, falhas de interpretação, atrasos ou depender de dados enviados por terceiros.',
  'Você continua responsável por revisar configurações, mensagens, integrações, permissões, dados cadastrados e ações executadas pelos seus projetos.',
  'Não utilize a plataforma para atividades ilegais, abusivas, discriminatórias, invasivas ou que violem direitos de terceiros.',
  'A InfraStudio poderá registrar dados técnicos de uso, eventos, logs e métricas necessários para segurança, funcionamento, suporte e melhoria da plataforma.',
  'Integrações externas, como WhatsApp, Mercado Livre, Google Calendar e APIs próprias, também seguem regras e disponibilidade dos respectivos provedores.',
]

export function TermsConsentModal({ initialAccepted = false, userName = 'usuário' }) {
  const [accepted, setAccepted] = useState(initialAccepted)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [visible, setVisible] = useState(!initialAccepted)

  if (!visible) {
    return null
  }

  async function handleConfirm() {
    if (!accepted || saving) {
      return
    }

    setSaving(true)
    setError('')

    try {
      const response = await fetch('/api/app/terms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })
      const payload = await response.json().catch(() => ({}))

      if (!response.ok) {
        setError(payload.error || 'Não foi possível registrar o aceite dos termos.')
        return
      }

      setVisible(false)
    } catch {
      setError('Não foi possível registrar o aceite dos termos.')
    } finally {
      setSaving(false)
    }
  }

  function handleCancel() {
    window.location.href = '/'
  }

  return (
    <div className="fixed inset-0 z-[180] flex items-center justify-center bg-slate-950/82 p-4 backdrop-blur-md">
      <motion.div
        initial={{ opacity: 0, y: 28, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 12, scale: 0.98 }}
        transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
        className="max-h-[calc(100dvh-32px)] w-full max-w-3xl overflow-y-auto rounded-2xl border border-cyan-300/18 bg-[#071224] shadow-[0_30px_100px_-36px_rgba(34,211,238,0.72)]"
        role="dialog"
        aria-modal="true"
        aria-label="Termos de Uso da InfraStudio"
      >
        <div className="bg-[radial-gradient(circle_at_18%_0%,rgba(56,189,248,0.24),transparent_32%),radial-gradient(circle_at_82%_12%,rgba(52,211,153,0.16),transparent_28%),linear-gradient(135deg,#08111f_0%,#07172a_58%,#05101d_100%)] p-6 md:p-7">
          <div className="flex flex-col gap-5 md:flex-row md:items-start">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-cyan-300/25 bg-cyan-400/10 text-cyan-100 shadow-[0_18px_55px_-30px_rgba(34,211,238,0.9)]">
              <ShieldCheck className="h-7 w-7" />
            </div>
            <div className="min-w-0">
              <div className="inline-flex items-center gap-2 rounded-full border border-emerald-300/20 bg-emerald-400/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-emerald-100">
                <Sparkles className="h-3.5 w-3.5" />
                Primeiro acesso
              </div>
              <h2 className="mt-4 text-2xl font-semibold tracking-[-0.02em] text-white md:text-3xl">
                Termos de Uso da InfraStudio
              </h2>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300">
                Olá, {userName}. Antes de continuar, precisamos alinhar de forma simples como a plataforma funciona para manter seu uso seguro e transparente.
              </p>
            </div>
          </div>
        </div>

        <div className="grid gap-5 p-6 md:p-7">
          <div className="grid gap-3">
            {TERMS_ITEMS.map((item) => (
              <div key={item} className="grid grid-cols-[28px_minmax(0,1fr)] gap-3 rounded-xl border border-white/10 bg-white/[0.035] px-4 py-3 text-sm leading-6 text-slate-300">
                <span className="mt-0.5 flex h-7 w-7 items-center justify-center rounded-lg border border-emerald-300/20 bg-emerald-400/10 text-emerald-100">
                  <Check className="h-4 w-4" />
                </span>
                <span>{item}</span>
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={() => setAccepted((current) => !current)}
            className="flex w-full items-center justify-between gap-4 rounded-2xl border border-cyan-300/16 bg-slate-950/42 px-4 py-4 text-left shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] transition hover:border-cyan-300/26 hover:bg-slate-950/58"
          >
            <span>
              <span className="block text-sm font-semibold text-white">Li e aceito os Termos de Uso</span>
              <span className="mt-1 block text-xs leading-5 text-slate-400">
                O aceite libera o acesso aos seus projetos e fica registrado na sua conta.
              </span>
            </span>
            <span
              className={cn(
                'relative h-8 w-14 shrink-0 rounded-full border transition-colors',
                accepted ? 'border-emerald-300/40 bg-emerald-400/22' : 'border-white/12 bg-slate-800',
              )}
              aria-hidden="true"
            >
              <span
                className={cn(
                  'absolute top-1 h-6 w-6 rounded-full bg-white shadow-[0_8px_20px_rgba(0,0,0,0.28)] transition-transform',
                  accepted ? 'translate-x-7' : 'translate-x-1',
                )}
              />
            </span>
          </button>

          {error ? (
            <div className="flex items-start gap-3 rounded-xl border border-rose-400/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          ) : null}

          <div className="flex flex-wrap justify-end gap-3">
            <Button
              type="button"
              variant="ghost"
              onClick={handleCancel}
              disabled={saving}
              className="h-10 rounded-xl border border-white/10 bg-white/[0.04] px-4 text-sm text-slate-200 hover:bg-white/[0.08]"
            >
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={handleConfirm}
              disabled={!accepted || saving}
              className="h-10 rounded-xl border border-emerald-300/30 bg-emerald-400/15 px-4 text-sm font-semibold text-emerald-50 shadow-[0_18px_50px_-28px_rgba(52,211,153,0.9)] hover:bg-emerald-400/20 disabled:opacity-45"
            >
              {saving ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <ShieldCheck className="mr-2 h-4 w-4" />}
              Continuar
            </Button>
          </div>
        </div>
      </motion.div>
    </div>
  )
}
