import { motion } from 'framer-motion'
import {
  ImagePlus,
  Paperclip,
  Phone,
  SendHorizonal,
  Sparkles,
  Trash2,
} from 'lucide-react'
import SimpleBar from 'simplebar-react'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'

function ConversationItem({ conversation, active, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'w-full rounded-[22px] border p-4 text-left transition-all duration-200',
        active
          ? 'border-cyan-400/30 bg-cyan-500/10 shadow-[0_18px_40px_-28px_rgba(34,211,238,0.8)]'
          : 'border-white/5 bg-white/[0.02] hover:border-white/10 hover:bg-white/[0.04]',
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <Avatar className="h-11 w-11 bg-[#10233a]">
            <AvatarFallback>{conversation.initials}</AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold text-white">{conversation.name}</div>
            <div className="truncate text-xs text-slate-400">{conversation.phone}</div>
          </div>
        </div>
        <div className="text-xs text-slate-500">{conversation.time}</div>
      </div>

      <div className="mt-3 flex items-center gap-2">
        <Badge variant="emerald" className="text-[10px]">
          WhatsApp
        </Badge>
        <span className="rounded-full bg-white/5 px-2 py-1 text-[10px] font-semibold text-slate-300">
          {conversation.count} msg
        </span>
      </div>

      <p className="mt-3 truncate text-xs text-slate-400">{conversation.preview}</p>
    </button>
  )
}

function MessageBubble({ message }) {
  const own = message.role === 'admin'

  return (
    <div className={cn('flex', own ? 'justify-end' : 'justify-start')}>
      <div
        className={cn(
          'max-w-[78%] rounded-[26px] border px-5 py-4',
          own
            ? 'border-amber-400/20 bg-[#2a221c] text-amber-50'
            : 'border-cyan-400/20 bg-[#0d2130] text-cyan-50',
        )}
      >
        <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">
          {own ? 'Administrador' : 'Cliente'}
        </div>
        <div className="mt-3 whitespace-pre-line text-sm leading-6">{message.body}</div>
        <div className="mt-3 text-xs text-slate-400">{message.time}</div>
      </div>
    </div>
  )
}

export function AttendancePanel({
  projectName,
  conversations,
  activeConversationId,
  onConversationChange,
  onBackToWorkspace,
}) {
  const activeConversation =
    conversations.find((conversation) => conversation.id === activeConversationId) ??
    conversations[0]

  return (
    <div className="flex h-full min-h-0 flex-col rounded-[30px] border border-white/5 bg-[#07101d]/92 shadow-[0_30px_90px_-46px_rgba(0,0,0,1)]">
      <div className="border-b border-white/5 px-5 py-4 sm:px-6">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="cyan">Atendimento</Badge>
              <span className="text-[11px] uppercase tracking-[0.22em] text-slate-500">
                {projectName}
              </span>
            </div>
            <p className="mt-3 text-sm text-slate-400">
              Tela dedicada ao chat e atendimento com lista de conversas, timeline e composer.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Badge>23 abertas</Badge>
            <Badge>11 DDD em destaque</Badge>
            <Button
              variant="ghost"
              className="rounded-2xl border border-white/10 bg-white/[0.03] text-slate-200 hover:bg-white/[0.06] hover:text-white"
              onClick={onBackToWorkspace}
            >
              Voltar ao workspace
            </Button>
          </div>
        </div>
      </div>

      <div className="grid min-h-0 flex-1 gap-4 p-4 lg:grid-cols-[310px,minmax(0,1fr)] xl:p-5">
        <section className="min-h-0 overflow-hidden rounded-[26px] border border-white/5 bg-white/[0.02]">
          <div className="border-b border-white/5 px-4 py-4">
            <div className="text-sm font-semibold text-white">Conversas do projeto</div>
            <p className="mt-1 text-xs text-slate-500">Site e WhatsApp no mesmo feed.</p>
          </div>

          <SimpleBar className="px-3 py-3 md:h-[calc(100vh-350px)] md:min-h-[420px]">
            <div className="space-y-3">
              {conversations.map((conversation) => (
                <ConversationItem
                  key={conversation.id}
                  conversation={conversation}
                  active={conversation.id === activeConversation.id}
                  onClick={() => onConversationChange(conversation.id)}
                />
              ))}
            </div>
          </SimpleBar>
        </section>

        <section className="flex min-h-0 flex-col overflow-hidden rounded-[26px] border border-white/5 bg-[#08111f]">
          <div className="border-b border-white/5 px-4 py-4 sm:px-5">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
              <div className="flex min-w-0 items-center gap-3">
                <Avatar className="h-12 w-12 bg-[#10233a]">
                  <AvatarFallback>{activeConversation.initials}</AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="truncate text-lg font-semibold text-white">
                      {activeConversation.name}
                    </h2>
                    <Badge variant="emerald">WhatsApp</Badge>
                  </div>
                  <p className="mt-1 truncate text-sm text-slate-400">
                    {activeConversation.phone} - ultima atividade em {activeConversation.lastActivity}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Badge className="border-cyan-400/20 bg-cyan-500/12 text-cyan-100">
                  IA atendendo
                </Badge>
                <Button
                  variant="ghost"
                  className="rounded-2xl border border-rose-500/20 bg-rose-500/10 text-rose-100 hover:bg-rose-500/16 hover:text-white"
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Limpar conversa
                </Button>
                <Button
                  variant="ghost"
                  className="rounded-2xl border border-white/10 bg-white/[0.03] text-slate-200 hover:bg-white/[0.06] hover:text-white"
                >
                  <ImagePlus className="mr-2 h-4 w-4" />
                  Midias
                </Button>
                <Button className="rounded-2xl bg-emerald-600 px-5 text-white hover:bg-emerald-500">
                  Assumir atendimento
                </Button>
              </div>
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-hidden">
            <SimpleBar className="px-4 py-5 sm:px-5 md:h-[calc(100vh-470px)] md:min-h-[320px]">
              <div className="space-y-4">
                {activeConversation.messages.map((message, index) => (
                  <motion.div
                    key={`${message.time}-${index}`}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.22, delay: index * 0.04 }}
                  >
                    <MessageBubble message={message} />
                  </motion.div>
                ))}
              </div>
            </SimpleBar>
          </div>

          <div className="border-t border-white/5 p-4 sm:p-5">
            <div className="rounded-[28px] border border-cyan-400/10 bg-[#071626] p-4">
              <div className="mb-4 flex flex-wrap items-center gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-12 w-12 rounded-2xl border border-white/10 bg-white/[0.03] text-slate-300 hover:bg-white/[0.06] hover:text-white"
                >
                  <Paperclip className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-12 w-12 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 text-emerald-100 hover:bg-emerald-500/15 hover:text-white"
                >
                  <Sparkles className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="ml-auto h-12 w-12 rounded-2xl border border-white/10 bg-white/[0.03] text-slate-300 hover:bg-white/[0.06] hover:text-white"
                >
                  <Phone className="h-4 w-4" />
                </Button>
              </div>

              <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr),260px]">
                <Textarea
                  defaultValue={'HShxhqdlxxjd\nFnfjcncnc\nNcncncnc'}
                  className="min-h-[92px] resize-none"
                />
                <div className="rounded-[22px] border border-white/10 bg-[#07111f] p-3">
                  <div className="flex items-center gap-2 text-sm font-medium text-white">
                    <Sparkles className="h-4 w-4 text-emerald-300" />
                    Sugestao da IA
                  </div>
                  <p className="mt-3 text-sm leading-6 text-slate-400">
                    Posso seguir com uma resposta curta, confirmar o numero do pedido e oferecer
                    envio do anexo.
                  </p>
                </div>
              </div>

              <div className="mt-3 flex flex-col gap-3 lg:flex-row">
                <Input
                  defaultValue="Digite sua resposta manual..."
                  className="h-12 rounded-2xl bg-[#050d1b] text-slate-400"
                />
                <Button className="h-12 rounded-2xl bg-cyan-500 px-5 text-slate-950 hover:bg-cyan-400">
                  <SendHorizonal className="mr-2 h-4 w-4" />
                  Enviar
                </Button>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}
