'use client'

import * as Dialog from '@radix-ui/react-dialog'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowRight, Loader2, Lock, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import {
  registerWithProjectAuth,
  resendVerificationEmail,
  signInWithProjectAuth,
  signInWithSocialProvider,
} from '@/lib/auth'
import { cn } from '@/lib/utils'

const fieldClassName =
  'h-12 w-full rounded-lg border border-slate-200/80 bg-white/90 px-4 text-sm text-slate-900 placeholder:text-slate-400 shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 dark:border-white/10 dark:bg-white/[0.04] dark:text-white dark:placeholder:text-slate-500'

const socialButtonClassName =
  'inline-flex h-12 min-w-0 items-center justify-center gap-2 rounded-lg border border-slate-200/80 bg-white/90 px-3 text-sm font-medium text-slate-800 shadow-sm transition hover:border-cyan-400/25 hover:bg-cyan-500/10 hover:text-slate-950 disabled:cursor-not-allowed disabled:opacity-60 dark:border-white/10 dark:bg-white/[0.04] dark:text-white'

function GoogleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.73 1.22 9.24 3.6l6.91-6.91C35.64 2.2 30.23 0 24 0 14.82 0 6.86 5.48 2.69 13.44l8.06 6.26C12.54 13.12 17.83 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.1 24.55c0-1.63-.15-3.2-.43-4.71H24v9h12.5c-.54 2.9-2.2 5.36-4.7 7.02l7.2 5.6C43.94 37.36 46.1 31.45 46.1 24.55z" />
      <path fill="#FBBC05" d="M10.75 28.7a14.5 14.5 0 0 1 0-9.4l-8.06-6.26A23.93 23.93 0 0 0 0 24c0 3.8.91 7.38 2.69 10.44l8.06-6.26z" />
      <path fill="#34A853" d="M24 48c6.23 0 11.46-2.06 15.28-5.6l-7.2-5.6c-2 1.35-4.55 2.14-8.08 2.14-6.17 0-11.46-3.62-13.25-8.7l-8.06 6.26C6.86 42.52 14.82 48 24 48z" />
    </svg>
  )
}

function FacebookIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#1877F2"
        d="M24 12.07C24 5.4 18.63 0 12 0S0 5.4 0 12.07C0 18.1 4.39 23.1 10.13 24v-8.44H7.08v-3.49h3.05V9.41c0-3.03 1.79-4.7 4.54-4.7 1.31 0 2.68.24 2.68.24v2.97h-1.51c-1.49 0-1.95.93-1.95 1.88v2.26h3.31l-.53 3.49h-2.78V24C19.61 23.1 24 18.1 24 12.07Z"
      />
    </svg>
  )
}

function Field({ label, id, type, value, onChange, placeholder, autoComplete, inputRef }) {
  return (
    <label htmlFor={id} className="block space-y-2">
      <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">{label}</span>
      <input
        ref={inputRef}
        id={id}
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={fieldClassName}
        placeholder={placeholder}
        autoComplete={autoComplete}
      />
    </label>
  )
}

function Feedback({ type, children }) {
  if (!children) {
    return null
  }

  return (
    <div
      className={cn(
        'rounded-lg border px-4 py-3 text-sm',
        type === 'error'
          ? 'border-rose-500/25 bg-rose-500/10 text-rose-700 dark:text-rose-200'
          : 'border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-200',
      )}
    >
      {children}
    </div>
  )
}

function SocialButtons({ socialLoadingProvider, onSocialLogin, dividerText }) {
  const providers = [
    { id: 'google', label: 'Google', icon: GoogleIcon },
    { id: 'facebook', label: 'Facebook', icon: FacebookIcon, disabled: true, badge: 'Bloqueado' },
  ]

  return (
    <div className="space-y-3">
      <p className="text-sm font-medium text-slate-600 dark:text-slate-300">Continuar com</p>
      <div className="grid grid-cols-2 gap-3">
        {providers.map((provider) => {
          const Icon = provider.icon
          const loading = socialLoadingProvider === provider.id
          const disabled = socialLoadingProvider !== null || provider.disabled

          return (
            <button
              key={provider.id}
              type="button"
              onClick={disabled ? undefined : () => onSocialLogin(provider.id)}
              disabled={disabled}
              className={socialButtonClassName}
              title={provider.disabled ? 'Login com Facebook temporariamente indisponivel.' : undefined}
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Icon className="h-4 w-4" />}
              <span className="truncate">{provider.label}</span>
              {provider.badge ? (
                <span className="rounded-full border border-slate-200 bg-slate-100 px-2 py-0.5 text-[10px] uppercase tracking-[0.14em] text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-300">
                  {provider.badge}
                </span>
              ) : null}
            </button>
          )
        })}
      </div>

      {dividerText ? (
        <div className="flex items-center gap-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">
          <span className="h-px flex-1 bg-slate-200 dark:bg-white/10" />
          <span>{dividerText}</span>
          <span className="h-px flex-1 bg-slate-200 dark:bg-white/10" />
        </div>
      ) : null}
    </div>
  )
}

export function LoginModal({ open, onOpenChange, initialNotice = '' }) {
  const [mode, setMode] = useState('login')
  const [loginEmail, setLoginEmail] = useState('')
  const [loginPassword, setLoginPassword] = useState('')
  const [loginError, setLoginError] = useState('')
  const [notice, setNotice] = useState('')
  const [loginLoading, setLoginLoading] = useState(false)

  const [name, setName] = useState('')
  const [registerEmail, setRegisterEmail] = useState('')
  const [registerPassword, setRegisterPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [registerError, setRegisterError] = useState('')
  const [registerLoading, setRegisterLoading] = useState(false)

  const [socialLoadingProvider, setSocialLoadingProvider] = useState(null)
  const [resendingVerification, setResendingVerification] = useState(false)
  const loginEmailRef = useRef(null)
  const nameRef = useRef(null)

  useEffect(() => {
    if (open) {
      return undefined
    }

    const timer = window.setTimeout(() => {
      setMode('login')
      setLoginError('')
      setRegisterError('')
      setNotice('')
      setLoginLoading(false)
      setRegisterLoading(false)
      setSocialLoadingProvider(null)
      setResendingVerification(false)
    }, 0)

    return () => window.clearTimeout(timer)
  }, [open])

  useEffect(() => {
    if (!open || !initialNotice) {
      return undefined
    }

    const timer = window.setTimeout(() => {
      setMode('login')
      setLoginError('')
      setRegisterError('')
      setNotice(initialNotice)
    }, 0)

    return () => window.clearTimeout(timer)
  }, [initialNotice, open])

  useEffect(() => {
    if (!open) {
      return
    }

    const timer = window.setTimeout(() => {
      if (mode === 'login') {
        loginEmailRef.current?.focus()
      } else {
        nameRef.current?.focus()
      }
    }, 180)

    return () => window.clearTimeout(timer)
  }, [mode, open])

  function goToRegister() {
    setMode('cadastro')
    setLoginError('')
    setNotice('')
  }

  function goToLogin() {
    setMode('login')
    setRegisterError('')
  }

  async function handleLoginSubmit(event) {
    event.preventDefault()
    if (loginLoading) {
      return
    }

    setLoginLoading(true)
    setLoginError('')
    setNotice('')

    const result = await signInWithProjectAuth(loginEmail, loginPassword)

    if (result.user) {
      window.location.href = result.user.role === 'admin' ? '/admin/dashboard' : '/app/projetos'
      return
    }

    setLoginError(result.error ?? 'Nao foi possivel entrar agora.')
    setLoginLoading(false)
  }

  async function handleRegisterSubmit(event) {
    event.preventDefault()
    if (registerLoading) {
      return
    }

    setRegisterError('')

    if (!name.trim() || !registerEmail.trim() || !registerPassword || !confirmPassword) {
      setRegisterError('Preencha nome, email, senha e confirmacao.')
      return
    }

    if (registerPassword.length < 6) {
      setRegisterError('A senha precisa ter pelo menos 6 caracteres.')
      return
    }

    if (registerPassword !== confirmPassword) {
      setRegisterError('A confirmacao de senha nao confere.')
      return
    }

    setRegisterLoading(true)
    const result = await registerWithProjectAuth({
      nome: name,
      email: registerEmail,
      senha: registerPassword,
      confirmarSenha: confirmPassword,
    })

    if (!result.ok) {
      setRegisterError(result.error ?? 'Nao foi possivel concluir seu cadastro agora.')
      setRegisterLoading(false)
      return
    }

    setName('')
    setRegisterEmail('')
    setRegisterPassword('')
    setConfirmPassword('')
    setLoginEmail(registerEmail)
    setNotice(result.message ?? 'Conta criada. Voce ja pode entrar.')
    setRegisterLoading(false)
    setMode('login')
  }

  async function handleSocialLogin(provider) {
    setLoginError('')
    setRegisterError('')
    setNotice('')
    setSocialLoadingProvider(provider)

    const result = await signInWithSocialProvider(provider)
    if (!result.ok) {
      if (mode === 'login') {
        setLoginError(result.error ?? 'Nao foi possivel iniciar o login social.')
      } else {
        setRegisterError(result.error ?? 'Nao foi possivel iniciar o login social.')
      }
      setSocialLoadingProvider(null)
    }
  }

  async function handleResendVerification() {
    if (!loginEmail.trim()) {
      setLoginError('Informe seu email para reenviar a confirmacao.')
      return
    }

    setLoginError('')
    setNotice('')
    setResendingVerification(true)

    const result = await resendVerificationEmail(loginEmail)
    if (!result.ok) {
      setLoginError(result.error ?? 'Nao foi possivel reenviar a confirmacao agora.')
      setResendingVerification(false)
      return
    }

    setNotice(result.message ?? 'Conta liberada para login.')
    setResendingVerification(false)
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="infra-overlay-motion fixed inset-0 z-[90] bg-slate-950/35 dark:bg-slate-950/80" />
        <Dialog.Content className="infra-dialog-motion infra-diagonal-shadow fixed left-1/2 top-1/2 z-[100] max-h-[calc(100vh-2rem)] w-[calc(100vw-1.5rem)] max-w-md -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-lg border border-slate-200/90 bg-white text-slate-900 dark:border-white/15 dark:bg-[#0f172a] dark:text-white">
          <Dialog.Close className="absolute right-4 top-4 z-10 rounded-lg border border-slate-200 bg-white/90 p-2 text-slate-500 transition hover:border-cyan-400/25 hover:bg-cyan-500/10 hover:text-slate-900 dark:border-white/10 dark:bg-white/5 dark:text-slate-300 dark:hover:text-white">
            <X className="h-4 w-4" />
          </Dialog.Close>

          <div className="border-b border-slate-200 bg-slate-50/90 px-6 py-5 dark:border-white/10 dark:bg-white/5">
            <div className="mb-3 inline-flex items-center gap-2 rounded-lg border border-blue-500/20 bg-blue-500/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.22em] text-blue-300">
              <Lock className="h-3.5 w-3.5" />
              {mode === 'login' ? 'Acesso rapido' : 'Criar conta'}
            </div>
            <Dialog.Title className="pr-10 text-2xl font-semibold text-slate-900 dark:text-white">
              {mode === 'login' ? 'Acesse sua conta' : 'Crie sua conta'}
            </Dialog.Title>
            <Dialog.Description className="mt-2 text-sm leading-relaxed text-slate-500 dark:text-slate-400">
              {mode === 'login' ? 'Entre para gerenciar seus projetos.' : 'Crie seu acesso e comece pelo projeto inicial.'}
            </Dialog.Description>
          </div>

          <div className="px-6 py-6">
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={mode}
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
              >
                {mode === 'login' ? (
                  <form onSubmit={handleLoginSubmit} className="space-y-4">
                    <SocialButtons
                      socialLoadingProvider={socialLoadingProvider}
                      onSocialLogin={handleSocialLogin}
                      dividerText="ou entre com email"
                    />

                    <Field
                      label="Email"
                      id="auth-login-email"
                      type="email"
                      value={loginEmail}
                      onChange={setLoginEmail}
                      placeholder="voce@empresa.com"
                      autoComplete="email"
                      inputRef={loginEmailRef}
                    />
                    <Field
                      label="Senha"
                      id="auth-login-password"
                      type="password"
                      value={loginPassword}
                      onChange={setLoginPassword}
                      placeholder="Digite sua senha"
                      autoComplete="current-password"
                    />

                    <Feedback type="error">{loginError}</Feedback>
                    <Feedback type="notice">{notice}</Feedback>

                    <button
                      type="submit"
                      disabled={loginLoading}
                      className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-blue-600 to-cyan-500 px-5 font-semibold text-white transition hover:from-blue-500 hover:to-cyan-400 disabled:cursor-not-allowed disabled:opacity-70"
                    >
                      {loginLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                      {loginLoading ? 'Entrando...' : 'Entrar'}
                      <ArrowRight className="h-4 w-4" />
                    </button>

                    <div className="flex items-center justify-between gap-3 text-sm">
                      <button type="button" onClick={goToRegister} className="font-medium text-cyan-700 transition hover:text-cyan-600 dark:text-cyan-200 dark:hover:text-cyan-100">
                        Criar conta
                      </button>
                      <button
                        type="button"
                        onClick={handleResendVerification}
                        disabled={resendingVerification}
                        className="font-medium text-slate-500 transition hover:text-slate-700 disabled:opacity-60 dark:text-slate-400 dark:hover:text-slate-200"
                      >
                        {resendingVerification ? 'Reenviando...' : 'Reenviar confirmacao'}
                      </button>
                    </div>

                  </form>
                ) : (
                  <form onSubmit={handleRegisterSubmit} className="space-y-4">
                    <SocialButtons
                      socialLoadingProvider={socialLoadingProvider}
                      onSocialLogin={handleSocialLogin}
                      dividerText="ou cadastre com email"
                    />

                    <Field
                      label="Nome"
                      id="auth-register-name"
                      type="text"
                      value={name}
                      onChange={setName}
                      placeholder="Seu nome"
                      autoComplete="name"
                      inputRef={nameRef}
                    />
                    <Field
                      label="Email"
                      id="auth-register-email"
                      type="email"
                      value={registerEmail}
                      onChange={setRegisterEmail}
                      placeholder="voce@empresa.com"
                      autoComplete="email"
                    />
                    <Field
                      label="Senha"
                      id="auth-register-password"
                      type="password"
                      value={registerPassword}
                      onChange={setRegisterPassword}
                      placeholder="Minimo 6 caracteres"
                      autoComplete="new-password"
                    />
                    <Field
                      label="Confirmar senha"
                      id="auth-register-password-confirm"
                      type="password"
                      value={confirmPassword}
                      onChange={setConfirmPassword}
                      placeholder="Repita a senha"
                      autoComplete="new-password"
                    />

                    <Feedback type="error">{registerError}</Feedback>

                    <button
                      type="submit"
                      disabled={registerLoading}
                      className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-blue-600 to-cyan-500 px-5 font-semibold text-white transition hover:from-blue-500 hover:to-cyan-400 disabled:cursor-not-allowed disabled:opacity-70"
                    >
                      {registerLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                      {registerLoading ? 'Criando...' : 'Criar conta'}
                      <ArrowRight className="h-4 w-4" />
                    </button>

                    <button type="button" onClick={goToLogin} className="text-sm font-medium text-cyan-700 transition hover:text-cyan-600 dark:text-cyan-200 dark:hover:text-cyan-100">
                      Voltar para login
                    </button>
                  </form>
                )}
              </motion.div>
            </AnimatePresence>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

