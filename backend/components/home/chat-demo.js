'use client'

import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowLeft, CheckCheck, Paperclip, Phone, Send, Smile, Video } from 'lucide-react'
import { cn } from '@/lib/utils'

const CHAT_SCRIPT = [
  { id: 'user-1', text: 'Você troca disco de freio?', isAi: false },
  {
    id: 'ai-1',
    text: 'Trocamos sim.\n\nQual o seu carro e ano para eu te passar os valores?',
    isAi: true,
  },
  { id: 'user-2', text: 'Ford Focus 2006', isAi: false },
  {
    id: 'ai-2',
    text: 'Para o seu Focus 2006, temos:\n\nPar de discos dianteiros: R$ 280\nMão de obra: R$ 120\n\nTotal estimado: R$ 400\n\nPosso agendar isso para você agora pelo WhatsApp.',
    isAi: true,
  },
]

const WHATSAPP_MESSAGES = [
  {
    id: 'wa-1',
    text: 'Olá, tenho um Ford Focus 2006 e quero trocar o par de discos dianteiros.',
    own: true,
    time: '12:36',
  },
  {
    id: 'wa-2',
    text: 'Perfeito. Já recebi o contexto do atendimento e o orçamento estimado.',
    own: false,
    time: '12:37',
  },
  {
    id: 'wa-3',
    text: 'Veículo: Focus 2006\nServiço: Par de discos dianteiros\nValor estimado: R$ 400',
    own: false,
    time: '12:37',
  },
  {
    id: 'wa-4',
    text: 'Já deixei tudo pronto para você.\n\nDeseja que eu continue com o atendimento?',
    own: false,
    time: '12:38',
  },
  {
    id: 'wa-5',
    text: 'Perfeito. Já estou chamando um responsável para te atender agora.',
    own: false,
    time: '12:39',
  },
]

const FLIP_DURATION_MS = 1050
const FACE_SETTLE_MS = 260

export function PremiumHomeChatDemo() {
  const [cycle, setCycle] = useState(0)
  const [face, setFace] = useState('front')
  const [messages, setMessages] = useState([])
  const [isTyping, setIsTyping] = useState(false)
  const [showWhatsappButton, setShowWhatsappButton] = useState(false)
  const [chatCtaPressed, setChatCtaPressed] = useState(false)
  const [whatsVisibleCount, setWhatsVisibleCount] = useState(0)
  const [whatsTyping, setWhatsTyping] = useState(false)
  const [showWhatsActions, setShowWhatsActions] = useState(false)
  const [pressedAction, setPressedAction] = useState(null)
  const [isVisible, setIsVisible] = useState(true)
  const rootRef = useRef(null)
  const chatScrollRef = useRef(null)
  const whatsappScrollRef = useRef(null)
  const timersRef = useRef([])
  const pausedRef = useRef(false)

  const armTimer = (entry, delay) => {
    entry.remaining = delay
    entry.dueAt = Date.now() + delay
    entry.id = window.setTimeout(() => {
      timersRef.current = timersRef.current.filter((timer) => timer !== entry)
      entry.id = null
      entry.callback()
    }, delay)
  }

  const clearTimers = () => {
    timersRef.current.forEach((timer) => {
      if (timer.id !== null) {
        window.clearTimeout(timer.id)
      }
    })
    timersRef.current = []
  }

  const schedule = (callback, delay) => {
    const entry = {
      callback,
      dueAt: Date.now() + delay,
      id: null,
      remaining: delay,
    }

    timersRef.current.push(entry)

    if (!pausedRef.current) {
      armTimer(entry, delay)
    }
  }

  const pauseTimers = () => {
    if (pausedRef.current) return

    pausedRef.current = true
    const now = Date.now()

    timersRef.current.forEach((timer) => {
      if (timer.id !== null) {
        window.clearTimeout(timer.id)
        timer.id = null
      }

      timer.remaining = Math.max(0, timer.dueAt - now)
    })
  }

  const resumeTimers = () => {
    if (!pausedRef.current) return

    pausedRef.current = false

    timersRef.current.forEach((timer) => {
      if (timer.id === null) {
        armTimer(timer, timer.remaining)
      }
    })
  }

  const startNextCycle = () => {
    clearTimers()
    setFace('front')
    setMessages([])
    setIsTyping(false)
    setShowWhatsappButton(false)
    setChatCtaPressed(false)
    setWhatsVisibleCount(0)
    setWhatsTyping(false)
    setShowWhatsActions(false)
    setPressedAction(null)
    setCycle((current) => current + 1)
  }

  const clearFrontFace = () => {
    setMessages([])
    setIsTyping(false)
    setShowWhatsappButton(false)
    setChatCtaPressed(false)
  }

  const confirmWhatsappSequence = () => {
    clearTimers()
    setShowWhatsActions(false)
    setPressedAction('continue')

    schedule(() => {
      setWhatsVisibleCount(5)
    }, 520)

    schedule(() => {
      clearFrontFace()
    }, 3200)

    schedule(() => {
      setFace('front')
    }, 3600)

    schedule(() => {
      startNextCycle()
    }, 3600 + FLIP_DURATION_MS + 280)
  }

  const startWhatsappSequence = () => {
    clearTimers()
    setShowWhatsappButton(false)
    setIsTyping(false)
    setChatCtaPressed(true)
    setFace('back')
    setWhatsVisibleCount(0)
    setWhatsTyping(false)
    setShowWhatsActions(false)
    setPressedAction(null)

    schedule(() => {
      setWhatsVisibleCount(1)
    }, FLIP_DURATION_MS + FACE_SETTLE_MS)

    schedule(() => {
      setWhatsTyping(true)
    }, FLIP_DURATION_MS + 1050)

    schedule(() => {
      setWhatsTyping(false)
      setWhatsVisibleCount(2)
    }, FLIP_DURATION_MS + 2100)

    schedule(() => {
      setWhatsVisibleCount(3)
    }, FLIP_DURATION_MS + 2900)

    schedule(() => {
      setWhatsVisibleCount(4)
    }, FLIP_DURATION_MS + 3800)

    schedule(() => {
      setShowWhatsActions(true)
    }, FLIP_DURATION_MS + 4600)

    schedule(() => {
      confirmWhatsappSequence()
    }, FLIP_DURATION_MS + 6500)
  }

  useEffect(() => {
    const node = rootRef.current
    if (!node) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsVisible(entry.isIntersecting)
      },
      { threshold: 0.35 },
    )

    observer.observe(node)

    return () => {
      observer.disconnect()
    }
  }, [])

  useEffect(() => {
    if (isVisible) {
      resumeTimers()
      return
    }

    pauseTimers()
  }, [isVisible])

  useEffect(() => {
    clearTimers()
    setFace('front')
    setMessages([])
    setIsTyping(false)
    setShowWhatsappButton(false)
    setChatCtaPressed(false)
    setWhatsVisibleCount(0)
    setWhatsTyping(false)
    setShowWhatsActions(false)
    setPressedAction(null)

    let elapsed = 450

    CHAT_SCRIPT.forEach((message, index) => {
      if (message.isAi) {
        schedule(() => {
          setIsTyping(true)
        }, elapsed)
      }

      elapsed += message.isAi ? 1500 : index === 0 ? 900 : 1050

      schedule(() => {
        setIsTyping(false)
        setMessages((current) => [...current, message])
      }, elapsed)
    })

    elapsed += 700

    schedule(() => {
      setShowWhatsappButton(true)
    }, elapsed)

    elapsed += 2400

    schedule(() => {
      startWhatsappSequence()
    }, elapsed)

    return () => {
      clearTimers()
    }
  }, [cycle])

  useEffect(() => {
    if (!chatScrollRef.current || face !== 'front') return

    chatScrollRef.current.scrollTo({
      top: chatScrollRef.current.scrollHeight,
      behavior: 'smooth',
    })
  }, [face, messages, isTyping, showWhatsappButton])

  useEffect(() => {
    if (!whatsappScrollRef.current || face !== 'back') return

    whatsappScrollRef.current.scrollTo({
      top: whatsappScrollRef.current.scrollHeight,
      behavior: 'smooth',
    })
  }, [face, whatsVisibleCount, whatsTyping, showWhatsActions])

  return (
    <div ref={rootRef} className="relative mx-auto w-full max-w-[420px] [perspective:2400px] lg:mx-0">
      <div className="pointer-events-none absolute inset-0 -z-10 rounded-[36px] bg-[radial-gradient(circle_at_top,rgba(37,99,235,0.16),transparent_42%),radial-gradient(circle_at_bottom,rgba(16,185,129,0.12),transparent_32%)]" />

      <motion.div
        animate={{ rotateY: face === 'back' ? 180 : 0 }}
        transition={{ duration: 1.05, ease: [0.22, 1, 0.36, 1] }}
        style={{ transformStyle: 'preserve-3d' }}
        className="relative h-[590px] w-full"
      >
        <div
          style={{ backfaceVisibility: 'hidden', transformStyle: 'preserve-3d' }}
          className="absolute inset-0 flex flex-col overflow-hidden rounded-[28px] border border-slate-200/90 bg-white/98 shadow-[0_22px_80px_-34px_rgba(15,23,42,0.14)] backdrop-blur-xl dark:border-white/10 dark:bg-[#0d1428]/92 dark:shadow-[0_22px_80px_-34px_rgba(15,23,42,0.9)]"
        >
          <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50/90 px-5 py-4 dark:border-white/5 dark:bg-white/[0.045]">
            <div>
              <div className="text-[24px] font-bold leading-none text-slate-900 dark:text-white">Atendimento</div>
              <div className="mt-2 inline-flex rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-semibold text-slate-500 dark:border-white/5 dark:bg-white/5 dark:text-slate-300">
                Novo
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="rounded-full border border-slate-200 bg-white p-3 text-slate-400 dark:border-white/10 dark:bg-white/5">
                <div className="h-3.5 w-3.5 rounded-[4px] border border-current" />
              </div>
              <div className="rounded-full border border-slate-200 bg-white p-3 text-slate-400 dark:border-white/10 dark:bg-white/5">
                <div className="relative h-3.5 w-3.5">
                  <div className="absolute left-1/2 top-0 h-full w-px -translate-x-1/2 bg-current" />
                  <div className="absolute left-0 top-1/2 h-px w-full -translate-y-1/2 bg-current" />
                </div>
              </div>
            </div>
          </div>

          <div
            ref={chatScrollRef}
            className="chat-demo-scroll min-h-0 flex-1 space-y-4 overflow-y-auto bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(248,250,252,0.98))] px-6 py-5 dark:bg-[linear-gradient(180deg,rgba(10,18,36,0.96),rgba(8,14,31,0.98))]"
          >
            <AnimatePresence initial={false} mode="popLayout">
              {messages.map((message) => (
                <motion.div
                  key={message.id}
                  initial={{ opacity: 0, y: 16, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ duration: 0.42, ease: [0.22, 1, 0.36, 1] }}
                  className={cn(
                    'max-w-[88%] whitespace-pre-line rounded-[24px] px-4 py-3 text-[15px] leading-relaxed',
                    message.isAi
                      ? 'mr-auto border border-white/8 bg-[#121d34] text-slate-100 shadow-[0_18px_30px_-24px_rgba(2,6,23,0.92)]'
                      : 'ml-auto rounded-br-lg border border-sky-300/35 bg-[linear-gradient(180deg,rgba(238,244,255,0.92),rgba(229,238,255,0.86))] text-sky-950 shadow-[0_12px_30px_-20px_rgba(15,23,42,0.12)] dark:border-blue-300/10 dark:bg-[linear-gradient(180deg,rgba(78,127,255,0.28),rgba(59,104,219,0.18))] dark:text-blue-50 dark:shadow-[0_12px_30px_-20px_rgba(15,23,42,0.9)]',
                  )}
                >
                  {message.text}
                </motion.div>
              ))}

              {showWhatsappButton ? (
                <motion.button
                  key="cta"
                  type="button"
                  onClick={startWhatsappSequence}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8, scale: 0.97, filter: 'blur(6px)' }}
                  className={cn(
                    'inline-flex rounded-full border border-emerald-300/45 bg-[linear-gradient(180deg,rgba(236,253,245,0.94),rgba(220,252,231,0.88))] px-4 py-2.5 text-sm font-semibold text-emerald-700 shadow-[0_14px_28px_-20px_rgba(16,185,129,0.22)] transition-all duration-200 hover:scale-[1.01] hover:border-emerald-300/55 hover:bg-[linear-gradient(180deg,rgba(236,253,245,0.98),rgba(220,252,231,0.94))] active:scale-[0.98] dark:border-emerald-400/16 dark:bg-[linear-gradient(180deg,rgba(16,185,129,0.18),rgba(16,185,129,0.12))] dark:text-emerald-100 dark:shadow-[0_14px_28px_-20px_rgba(16,185,129,0.55)]',
                    chatCtaPressed ? 'scale-[0.985] shadow-[0_8px_18px_-18px_rgba(16,185,129,0.85)]' : '',
                  )}
                >
                  Continuar no WhatsApp...
                </motion.button>
              ) : null}

              {isTyping ? (
                <motion.div
                  key="typing"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="mr-auto inline-flex rounded-[20px] bg-transparent px-4 py-3"
                >
                  <div className="flex items-center gap-1.5">
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400" />
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400 [animation-delay:0.14s]" />
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400 [animation-delay:0.28s]" />
                  </div>
                </motion.div>
              ) : null}
            </AnimatePresence>
          </div>

          <div className="flex items-end gap-3 border-t border-slate-200 bg-slate-50/90 px-5 py-4 dark:border-white/5 dark:bg-[#0d1428]">
            <div className="flex-1 rounded-[20px] border border-slate-200 bg-white px-4 py-3 text-base text-slate-400 dark:border-white/5 dark:bg-white/[0.045] dark:text-slate-500">
              {isTyping ? 'Atendente está digitando...' : 'Digite sua mensagem...'}
            </div>
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#2f6fff] text-white shadow-[0_18px_40px_-22px_rgba(47,111,255,0.95)]">
              <Send size={18} />
            </div>
          </div>
        </div>

        <div
          style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)', transformStyle: 'preserve-3d' }}
          className="absolute inset-0"
        >
          <div className="flex h-full flex-col overflow-hidden rounded-[28px] border border-black/10 bg-[#151515] p-[10px] shadow-[0_24px_90px_-34px_rgba(0,0,0,0.95)]">
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-[22px] bg-[#ece5dd]">
              <div className="flex items-center justify-between bg-[#0d8b73] px-4 pb-3 pt-4 text-white">
                <div className="flex items-center gap-3">
                  <ArrowLeft size={18} />
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white/20 text-sm font-semibold">
                    IS
                  </div>
                  <div>
                    <div className="text-sm font-semibold">InfraStudio</div>
                    <div className="text-[11px] text-white/80">online agora</div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Video size={17} />
                  <Phone size={17} />
                </div>
              </div>

              <div
                ref={whatsappScrollRef}
                className="chat-demo-scroll min-h-0 flex-1 overflow-y-auto bg-[#ece5dd] bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.24),transparent_32%),linear-gradient(180deg,rgba(236,229,221,0.98),rgba(232,225,215,0.98))] px-3 py-4"
              >
                <AnimatePresence initial={false}>
                  {WHATSAPP_MESSAGES.slice(0, whatsVisibleCount).map((line) => (
                    <motion.div
                      key={line.id}
                      initial={{ opacity: 0, y: 12, scale: 0.97 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      className={cn('mb-3 flex', line.own ? 'justify-end' : 'justify-start')}
                    >
                      <div
                        className={cn(
                          'max-w-[86%] rounded-[14px] px-3 py-2 text-[12px] leading-relaxed shadow-[0_10px_18px_-16px_rgba(0,0,0,0.55)]',
                          line.own
                            ? 'rounded-tr-[4px] bg-[#dcf8c6] text-[#202c33]'
                            : 'rounded-tl-[4px] bg-white text-[#202c33]',
                        )}
                      >
                        <div className="whitespace-pre-line">{line.text}</div>
                        <div className="mt-1 flex items-center justify-end gap-1 text-[10px] text-[#667781]">
                          <span>{line.time}</span>
                          {line.own ? <CheckCheck size={12} className="text-[#53bdeb]" /> : null}
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>

                {whatsTyping ? (
                  <div className="mb-3 flex justify-start">
                    <div className="inline-flex rounded-[16px] rounded-tl-[4px] bg-white px-3 py-2.5 shadow-[0_10px_18px_-16px_rgba(0,0,0,0.55)]">
                      <div className="flex items-center gap-1.5">
                        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#667781]" />
                        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#667781] [animation-delay:0.14s]" />
                        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#667781] [animation-delay:0.28s]" />
                      </div>
                    </div>
                  </div>
                ) : null}

                <AnimatePresence initial={false} mode="wait">
                  {showWhatsActions ? (
                    <motion.div
                      key="whatsapp-actions"
                      initial={{ opacity: 0, y: 12, scale: 0.98 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -10, scale: 0.96, filter: 'blur(6px)' }}
                      transition={{ duration: 0.34, ease: [0.22, 1, 0.36, 1] }}
                      className="space-y-2"
                    >
                      <button
                        type="button"
                        onClick={confirmWhatsappSequence}
                        className={cn(
                          'inline-flex rounded-full bg-[#25d366] px-3 py-2.5 text-[12px] font-semibold text-[#123524] shadow-[0_12px_24px_-18px_rgba(37,211,102,0.9)] transition-all duration-200 hover:scale-[1.01] active:scale-[0.98]',
                          pressedAction === 'continue'
                            ? 'scale-[0.985] shadow-[0_8px_18px_-18px_rgba(37,211,102,0.9)]'
                            : '',
                        )}
                      >
                        Pode continuar
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setPressedAction('edit')
                          window.setTimeout(() => {
                            startNextCycle()
                          }, 140)
                        }}
                        className={cn(
                          'inline-flex rounded-full border border-amber-500/25 bg-amber-500/10 px-3 py-2.5 text-[12px] font-medium text-amber-900 transition-all duration-200 hover:bg-amber-500/20 hover:text-amber-950 active:scale-[0.985]',
                          pressedAction === 'edit' ? 'scale-[0.985] bg-amber-500/20' : '',
                        )}
                      >
                        Editar informações
                      </button>
                    </motion.div>
                  ) : null}
                </AnimatePresence>
              </div>

              <div className="flex items-center gap-2 bg-[#f0efec] px-3 py-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-full text-[#667781]">
                  <Smile size={20} />
                </div>
                <div className="flex-1 rounded-full bg-white px-4 py-2.5 text-[12px] text-[#94a3b8] shadow-[0_8px_18px_-16px_rgba(0,0,0,0.3)]">
                  Digite sua mensagem...
                </div>
                <div className="flex h-9 w-9 items-center justify-center rounded-full text-[#667781]">
                  <Paperclip size={18} />
                </div>
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#0d8b73] text-white shadow-[0_12px_24px_-16px_rgba(13,139,115,0.85)]">
                  <Send size={16} />
                </div>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  )
}
