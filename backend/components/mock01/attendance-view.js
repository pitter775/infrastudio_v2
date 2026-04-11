'use client'

import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  Globe,
  MessageSquareText,
  LayoutGrid,
  ListTodo,
  ImagePlus,
  Paperclip,
  SendHorizonal,
  Sparkles,
  Trash2,
  KanbanSquare,
  X,
} from 'lucide-react'
import { MockPageHeader } from '@/components/mock01/mock-page-header'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const conversations = [
  {
    id: 'julia',
    initials: 'JR',
    name: 'Julia Rodrigues',
    phone: '+55 11 97851-0655',
    time: '03:02',
    count: 48,
    source: 'whatsapp',
    preview: 'Anexo enviado.',
    lastActivity: '05/04/2026, 03:02',
    messages: [
      { role: 'admin', body: 'Anexo enviado.', time: '05/04, 00:06' },
      { role: 'admin', body: 'HShxhddjpojd\nFnfjcncnc\nNcncncnc', time: '05/04, 01:31' },
    ],
  },
  {
    id: 'servolo',
    initials: 'ST',
    name: 'Servolo Tobias',
    phone: '+55 11 99252-3662',
    time: '00:23',
    count: 20,
    source: 'whatsapp',
    preview: 'Parece que voce tem um plano bem estruturado.',
    lastActivity: '05/04/2026, 00:23',
    messages: [],
  },
  {
    id: 'adriana',
    initials: 'AD',
    name: 'Adriana',
    phone: '+55 11 98710-8829',
    time: '23:45',
    count: 10,
    source: 'site',
    preview: 'Oi Adriana! Como posso ajudar voce hoje?',
    lastActivity: '04/04/2026, 23:45',
    messages: [],
  },
  {
    id: 'mt',
    initials: 'MT',
    name: 'Mt',
    phone: '+55 11 95485-4872',
    time: '01:59',
    count: 10,
    source: 'site',
    preview: 'Oi, tudo bem? Como posso te ajudar?',
    lastActivity: '05/04/2026, 01:59',
    messages: [],
  },
  {
    id: 'claro',
    initials: 'CN',
    name: 'Claro Novo',
    phone: '+55 11 97061-4357',
    time: '01:59',
    count: 10,
    source: 'whatsapp',
    preview: 'Oi 🙂 Seja bem-vindo(a)! O que voce precisa?',
    lastActivity: '05/04/2026, 01:59',
    messages: [],
  },
  {
    id: 'felipe',
    initials: 'FS',
    name: 'Felipe Santos',
    phone: '+55 11 97061-4357',
    time: '01:59',
    count: 2,
    source: 'site',
    preview: 'Oi 🙂 O que voce gostaria de saber?',
    lastActivity: '05/04/2026, 01:59',
    messages: [],
  },
]

const attendanceNav = [
  { label: 'Atendimento', icon: MessageSquareText, active: true },
  { label: 'Dashboard', icon: LayoutGrid, active: false },
  { label: 'Leads', icon: ListTodo, active: false },
  { label: 'CRM Kanbam', icon: KanbanSquare, active: false },
]

const conversationFilters = [
  { id: 'all', icon: MessageSquareText, label: 'Todos' },
  { id: 'site', icon: Globe, label: 'Site' },
  { id: 'whatsapp', icon: MessageSquareText, label: 'WhatsApp' },
]

function Tag({ children, className }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.18em]',
        className,
      )}
    >
      {children}
    </span>
  )
}

function ConversationItem({ conversation, active, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'w-full rounded-[12px] border px-2.5 py-2 text-left transition-all duration-200',
        active
          ? 'border-sky-500/30 bg-sky-500/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]'
          : 'border-white/5 bg-white/[0.02] hover:border-white/10 hover:bg-white/[0.04]',
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-start gap-2.5">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-white/10 bg-[#182235] text-[9px] font-semibold uppercase text-slate-200">
            {conversation.initials}
          </div>
          <div className="min-w-0">
            <div className="truncate text-[12px] font-semibold leading-4 text-slate-100">{conversation.name}</div>
            <div className="truncate text-[10px] leading-4 text-slate-400">{conversation.phone}</div>
          </div>
        </div>
        <div className="shrink-0 text-right">
          <div className="text-[10px] text-slate-500">{conversation.time}</div>
          <div className="mt-1 text-[9px] font-bold uppercase tracking-[0.12em] text-sky-400">
            {conversation.count} msg
          </div>
        </div>
      </div>

      <p className="mt-1.5 truncate text-[10px] leading-4 text-slate-400">{conversation.preview}</p>
    </button>
  )
}

function MessageBubble({ message }) {
  return (
    <div className="flex justify-end">
      <div className="max-w-[78%] rounded-[18px] border border-amber-400/25 bg-[#2a241e] px-4 py-3 text-amber-50 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
        <div className="text-[10px] font-semibold uppercase tracking-[0.24em] text-slate-400">
          Administrador
        </div>
        <div className="mt-3 whitespace-pre-line text-sm leading-6">{message.body}</div>
        <div className="mt-3 text-xs text-slate-400">{message.time}</div>
      </div>
    </div>
  )
}

export function AttendanceView({ card }) {
  const [activeConversationId, setActiveConversationId] = useState(conversations[0].id)
  const [mobileChatOpen, setMobileChatOpen] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  const [activeFilter, setActiveFilter] = useState('all')

  useEffect(() => {
    function syncMobile() {
      setIsMobile(window.innerWidth < 1024)
    }

    syncMobile()
    window.addEventListener('resize', syncMobile)

    return () => window.removeEventListener('resize', syncMobile)
  }, [])

  useEffect(() => {
    if (!isMobile) {
      setMobileChatOpen(false)
    }
  }, [isMobile])

  const filteredConversations = conversations.filter((conversation) =>
    activeFilter === 'all' ? true : conversation.source === activeFilter,
  )

  const activeConversation =
    filteredConversations.find((conversation) => conversation.id === activeConversationId) ??
    filteredConversations[0] ??
    conversations[0]

  const filterCounts = {
    all: conversations.length,
    site: conversations.filter((conversation) => conversation.source === 'site').length,
    whatsapp: conversations.filter((conversation) => conversation.source === 'whatsapp').length,
  }

  useEffect(() => {
    if (!filteredConversations.some((conversation) => conversation.id === activeConversationId)) {
      setActiveConversationId(filteredConversations[0]?.id ?? conversations[0].id)
    }
  }, [activeConversationId, filteredConversations])

  function handleConversationSelect(conversationId) {
    setActiveConversationId(conversationId)
    if (isMobile) {
      setMobileChatOpen(true)
    }
  }

  return (
    <div className="h-full min-h-0">
      <div className="flex h-full min-h-0 flex-col">
        <MockPageHeader
          title="Central de Atendimento"
          description={`Fila ativa de conversas${card?.name ? ` do projeto ${card.name}` : ''}.`}
        />

        <div className="relative flex min-h-0 flex-1 flex-col gap-3 lg:grid lg:grid-cols-[104px,320px,minmax(0,1fr)]">
          <aside className="min-h-0 lg:block">
            <div className="flex h-full flex-col px-1 py-1">
              <div className="grid grid-cols-4 gap-2 lg:hidden">
                {attendanceNav.map((item) => {
                  const Icon = item.icon

                  return (
                    <button
                      key={item.label}
                      type="button"
                      className={cn(
                        'flex h-11 w-full items-center justify-center rounded-[14px] transition-all duration-200',
                        item.active
                          ? 'bg-sky-500/10 text-white'
                          : 'text-slate-400 hover:bg-white/[0.04] hover:text-white',
                      )}
                    >
                      <Icon
                        className={cn(
                          'h-4 w-4',
                          item.active ? 'text-sky-300' : 'text-slate-500',
                        )}
                      />
                    </button>
                  )
                })}
              </div>

              <div className="hidden space-y-2 lg:block">
                {attendanceNav.map((item) => {
                  const Icon = item.icon

                  return (
                    <button
                      key={item.label}
                      type="button"
                      className={cn(
                        'flex w-full flex-col items-center gap-2 rounded-[16px] px-1.5 py-3 text-center text-[10px] font-medium transition-all duration-200 lg:px-2 lg:text-[11px]',
                        item.active
                          ? 'bg-sky-500/10 text-white'
                          : 'text-slate-400 hover:bg-white/[0.04] hover:text-white',
                      )}
                    >
                      <Icon
                        className={cn(
                          'h-4 w-4',
                          item.active ? 'text-sky-300' : 'text-slate-500',
                        )}
                      />
                      <span className="hidden leading-4 lg:block">{item.label}</span>
                    </button>
                  )
                })}
              </div>
            </div>
          </aside>

          <section className="rounded-[12px] border border-white/5 bg-[#0d1424] overflow-visible lg:min-h-0 lg:overflow-hidden">
            <div className="border-b border-white/5 px-3 py-3">
              <div className="text-sm font-semibold text-slate-100">Conversas do projeto</div>
              <p className="mt-1 text-[11px] text-slate-500">Site e WhatsApp no mesmo feed.</p>
              <div className="mt-3 flex items-center gap-2">
                {conversationFilters.map((filter) => {
                  const Icon = filter.icon
                  const active = activeFilter === filter.id

                  return (
                    <button
                      key={filter.id}
                      type="button"
                      onClick={() => setActiveFilter(filter.id)}
                      className={cn(
                        'inline-flex items-center gap-1.5 rounded-full border px-2 py-1 text-[10px] font-semibold transition-all duration-200',
                        active
                          ? 'border-sky-400/15 bg-sky-400/10 text-sky-200'
                          : 'border-white/10 bg-white/[0.04] text-slate-300 hover:bg-white/[0.07]',
                      )}
                      title={filter.label}
                    >
                      <Icon className="h-3 w-3" />
                      <span>{filterCounts[filter.id]}</span>
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="px-2 py-2 lg:h-[calc(100%-104px)] lg:overflow-y-auto">
              <div className="space-y-2">
                {filteredConversations.map((conversation) => (
                  <ConversationItem
                    key={conversation.id}
                    conversation={conversation}
                    active={conversation.id === activeConversation.id}
                    onClick={() => handleConversationSelect(conversation.id)}
                  />
                ))}
              </div>
            </div>
          </section>

          <section
            className={cn(
              'hidden min-h-0 flex-col overflow-hidden rounded-[12px] border border-white/5 bg-[#0c1322] lg:flex',
            )}
          >
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={activeConversation.id}
                initial={{ opacity: 0, x: 48 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 48 }}
                transition={{ duration: 0.22, ease: 'easeInOut' }}
                className="flex h-full min-h-0 flex-col"
              >
                <div className="border-b border-white/5 px-4 py-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex min-w-0 items-center gap-3">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/10 bg-[#182235] text-[10px] font-semibold uppercase text-slate-200">
                          {activeConversation.initials}
                        </div>
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <h2 className="truncate text-sm font-semibold text-slate-100">{activeConversation.name}</h2>
                            <Tag className="border-emerald-400/15 bg-emerald-400/10 text-emerald-200">
                              WhatsApp
                            </Tag>
                            <Tag className="border-slate-500/20 bg-slate-500/10 text-slate-200">
                              IA atendendo
                            </Tag>
                          </div>
                          <p className="mt-1 truncate text-[11px] text-slate-400">
                            {activeConversation.phone} - Ultima atividade em {activeConversation.lastActivity}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <Button
                        className="h-8 rounded-lg bg-transparent px-3 text-[11px] text-emerald-300 shadow-none hover:bg-emerald-500/16 hover:text-white"
                      >
                        <MessageSquareText className="mr-1.5 h-3.5 w-3.5" />
                        Assumir atendimento
                      </Button>
                      <Button
                        variant="ghost"
                        className="h-8 rounded-lg px-2.5 text-[11px] text-sky-300 hover:bg-sky-500/16 hover:text-white"
                      >
                        <ImagePlus className="mr-1.5 h-3.5 w-3.5" />
                        Midias
                      </Button>
                      <Button
                        variant="ghost"
                        className="h-8 rounded-lg px-2.5 text-[11px] text-rose-200 hover:bg-rose-500/16 hover:text-white"
                      >
                        <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                        Limpar
                      </Button>
                    </div>
                  </div>
                </div>

                <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
                  <div className="space-y-5">
                    {activeConversation.messages.slice(0, 1).map((message, index) => (
                      <motion.div
                        key={`${message.time}-${index}`}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.18 }}
                      >
                        <MessageBubble message={message} />
                      </motion.div>
                    ))}

                    <div className="rounded-[18px] border border-amber-500/25 bg-[#2a241e] p-4">
                      <div className="text-[10px] font-semibold uppercase tracking-[0.24em] text-slate-400">
                        Administrador
                      </div>
                      <div className="mt-3 overflow-hidden rounded-[14px] border border-amber-500/25 bg-[#091120]">
                        <div className="h-[210px] bg-[radial-gradient(circle_at_top,rgba(56,189,248,0.08),transparent_26%),linear-gradient(180deg,#091120_0%,#0b1324_100%)]" />
                        <div className="border-t border-white/5 bg-[#0b1324] p-4">
                          <div className="mb-3 flex items-center gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-10 w-10 rounded-2xl border border-white/10 bg-white/[0.03] text-slate-300 hover:bg-white/[0.06] hover:text-white"
                            >
                              <Paperclip className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-10 w-10 rounded-2xl border border-white/10 bg-white/[0.03] text-slate-300 hover:bg-white/[0.06] hover:text-white"
                            >
                              <Sparkles className="h-4 w-4" />
                            </Button>
                          </div>

                          <textarea
                            defaultValue={'HShxhddjpojd\nFnfjcncnc\nNcncncnc'}
                            className="min-h-[86px] w-full resize-none rounded-[18px] border border-sky-500/30 bg-[#04101f] px-4 py-3 text-sm text-slate-100 outline-none"
                          />
                        </div>
                      </div>
                      <div className="mt-3 text-xs text-slate-400">05/04, 01:31</div>
                    </div>
                  </div>
                </div>

                <div className="border-t border-white/5 px-4 py-3">
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 rounded-xl border border-white/10 bg-white/[0.03] text-slate-300 hover:bg-white/[0.06] hover:text-white"
                    >
                      <Paperclip className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 rounded-xl border border-white/10 bg-white/[0.03] text-slate-300 hover:bg-white/[0.06] hover:text-white"
                    >
                      <Sparkles className="h-4 w-4" />
                    </Button>
                    <input
                      defaultValue="Digite sua resposta manual..."
                      className="h-8 w-full rounded-xl border border-white/10 bg-[#09111f] px-3 text-xs text-slate-400 outline-none"
                    />
                    <Button className="h-8 rounded-xl bg-[#11233a] px-4 text-xs text-slate-100 hover:bg-[#17304f]">
                      <SendHorizonal className="mr-1.5 h-3.5 w-3.5" />
                      Enviar
                    </Button>
                  </div>
                </div>
              </motion.div>
            </AnimatePresence>
          </section>

          <AnimatePresence initial={false}>
            {mobileChatOpen ? (
              <motion.section
                key="mobile-chat"
                initial={{ x: '100%' }}
                animate={{ x: 0 }}
                exit={{ x: '100%' }}
                transition={{ duration: 0.24, ease: 'easeInOut' }}
                className="absolute inset-0 z-20 flex min-h-0 flex-col overflow-hidden rounded-[12px] border border-white/5 bg-[#0c1322] lg:hidden"
              >
                <div className="border-b border-white/5 px-4 py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex min-w-0 items-center gap-3">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/10 bg-[#182235] text-[10px] font-semibold uppercase text-slate-200">
                          {activeConversation.initials}
                        </div>
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <h2 className="truncate text-sm font-semibold text-slate-100">{activeConversation.name}</h2>
                            <Tag className="border-emerald-400/15 bg-emerald-400/10 text-emerald-200">
                              WhatsApp
                            </Tag>
                          </div>
                          <p className="mt-1 truncate text-[11px] text-slate-400">
                            {activeConversation.phone}
                          </p>
                        </div>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 rounded-xl border border-white/10 bg-white/[0.03] text-slate-300 hover:bg-white/[0.06] hover:text-white"
                      onClick={() => setMobileChatOpen(false)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
                  <div className="space-y-5">
                    {activeConversation.messages.slice(0, 1).map((message, index) => (
                      <motion.div
                        key={`${message.time}-${index}-mobile`}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.18 }}
                      >
                        <MessageBubble message={message} />
                      </motion.div>
                    ))}

                    <div className="rounded-[18px] border border-amber-500/25 bg-[#2a241e] p-4">
                      <div className="text-[10px] font-semibold uppercase tracking-[0.24em] text-slate-400">
                        Administrador
                      </div>
                      <div className="mt-3 overflow-hidden rounded-[14px] border border-amber-500/25 bg-[#091120]">
                        <div className="h-[200px] bg-[radial-gradient(circle_at_top,rgba(56,189,248,0.08),transparent_26%),linear-gradient(180deg,#091120_0%,#0b1324_100%)]" />
                        <div className="border-t border-white/5 bg-[#0b1324] p-4">
                          <div className="mb-3 flex items-center gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-10 w-10 rounded-2xl border border-white/10 bg-white/[0.03] text-slate-300 hover:bg-white/[0.06] hover:text-white"
                            >
                              <Paperclip className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-10 w-10 rounded-2xl border border-white/10 bg-white/[0.03] text-slate-300 hover:bg-white/[0.06] hover:text-white"
                            >
                              <Sparkles className="h-4 w-4" />
                            </Button>
                          </div>

                          <textarea
                            defaultValue={'HShxhddjpojd\nFnfjcncnc\nNcncncnc'}
                            className="min-h-[86px] w-full resize-none rounded-[18px] border border-sky-500/30 bg-[#04101f] px-4 py-3 text-sm text-slate-100 outline-none"
                          />
                        </div>
                      </div>
                      <div className="mt-3 text-xs text-slate-400">05/04, 01:31</div>
                    </div>
                  </div>
                </div>

                <div className="border-t border-white/5 px-4 py-3">
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 rounded-xl border border-white/10 bg-white/[0.03] text-slate-300 hover:bg-white/[0.06] hover:text-white"
                    >
                      <Paperclip className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 rounded-xl border border-white/10 bg-white/[0.03] text-slate-300 hover:bg-white/[0.06] hover:text-white"
                    >
                      <Sparkles className="h-4 w-4" />
                    </Button>
                    <input
                      defaultValue="Digite sua resposta manual..."
                      className="h-8 w-full rounded-xl border border-white/10 bg-[#09111f] px-3 text-xs text-slate-400 outline-none"
                    />
                    <Button className="h-8 rounded-xl bg-[#11233a] px-4 text-xs text-slate-100 hover:bg-[#17304f]">
                      <SendHorizonal className="mr-1.5 h-3.5 w-3.5" />
                      Enviar
                    </Button>
                  </div>
                </div>
              </motion.section>
            ) : null}
          </AnimatePresence>
        </div>
      </div>
    </div>
  )
}
