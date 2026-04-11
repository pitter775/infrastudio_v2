'use client'

import * as Dialog from '@radix-ui/react-dialog'
import { Loader2, X } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { signInWithProjectAuth } from '@/lib/auth'
import { cn } from '@/lib/utils'

export function LoginModal({ open, onOpenChange }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(event) {
    event.preventDefault()

    if (loading) {
      return
    }

    setLoading(true)
    setError('')

    const result = await signInWithProjectAuth(email, password)

    if (result.user) {
      window.location.href = '/admin'
      return
    }

    setError(result.error ?? 'Nao foi possivel entrar agora.')
    setLoading(false)
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[90] bg-black/70 backdrop-blur-sm" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-[100] w-[calc(100vw-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-lg border border-white/10 bg-[#07111f] p-6 text-white shadow-2xl">
          <div className="flex items-start justify-between gap-4">
            <div>
              <Dialog.Title className="text-xl font-semibold">Entrar</Dialog.Title>
              <Dialog.Description className="mt-2 text-sm text-slate-400">
                Acesse sua area administrativa.
              </Dialog.Description>
            </div>

            <Dialog.Close className="rounded-lg p-2 text-slate-400 transition hover:bg-white/10 hover:text-white">
              <X className="h-4 w-4" />
            </Dialog.Close>
          </div>

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <label className="block space-y-2">
              <span className="text-sm font-medium text-slate-200">Email</span>
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className={cn(
                  'h-11 w-full rounded-lg border border-white/10 bg-white/[0.04] px-3 text-sm text-white',
                  'placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400',
                )}
                placeholder="seu@email.com"
                autoComplete="email"
              />
            </label>

            <label className="block space-y-2">
              <span className="text-sm font-medium text-slate-200">Senha</span>
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className={cn(
                  'h-11 w-full rounded-lg border border-white/10 bg-white/[0.04] px-3 text-sm text-white',
                  'placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400',
                )}
                placeholder="Sua senha"
                autoComplete="current-password"
              />
            </label>

            {error ? <p className="text-sm text-red-300">{error}</p> : null}

            <Button type="submit" disabled={loading} className="w-full gap-2">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Entrar
            </Button>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
