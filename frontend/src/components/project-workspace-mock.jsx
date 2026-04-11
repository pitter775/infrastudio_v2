import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import {
  ArrowLeft,
  Bot,
  ChevronDown,
  MessageSquareText,
  PanelRight,
  Sparkles,
} from 'lucide-react'
import SimpleBar from 'simplebar-react'
import { AttendancePanel } from '@/components/attendance-panel'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'

const conversations = [
  {
    id: 'julia',
    initials: 'JR',
    name: 'Julia Rodrigues',
    phone: '+55 11 97851-0655',
    time: '03:02',
    count: 48,
    preview: 'Anexo enviado.',
    lastActivity: '05/04, 03:02',
    messages: [
      { role: 'client', body: 'Oi, bom dia. Consegue me mandar o contrato atualizado?', time: '05/04, 00:02' },
      { role: 'admin', body: 'Anexo enviado.', time: '05/04, 00:06' },
      {
        role: 'admin',
        body: 'HShxhqdlxxjd\nFnfjcncnc\nNcncncnc',
        time: '05/04, 01:31',
      },
    ],
  },
  {
    id: 'servolo',
    initials: 'ST',
    name: 'Servolo Tobias',
    phone: '+55 11 99252-3662',
    time: '00:23',
    count: 20,
    preview: 'Parece que voce tem um plano bem estruturado.',
    lastActivity: '05/04, 00:23',
    messages: [
      { role: 'client', body: 'Parece que voce tem um plano bem estruturado.', time: '05/04, 00:19' },
      { role: 'admin', body: 'Tenho sim. Posso te passar os detalhes e valores agora.', time: '05/04, 00:23' },
    ],
  },
  {
    id: 'adriana',
    initials: 'AD',
    name: 'Adriana',
    phone: '+55 11 98710-8829',
    time: '23:45',
    count: 10,
    preview: 'Oi Adriana! Como posso ajudar voce hoje?',
    lastActivity: '04/04, 23:45',
    messages: [
      { role: 'admin', body: 'Oi Adriana! Como posso ajudar voce hoje?', time: '04/04, 23:40' },
      { role: 'client', body: 'Queria entender melhor o fluxo do atendimento.', time: '04/04, 23:45' },
    ],
  },
  {
    id: 'mt',
    initials: 'MT',
    name: 'Mt',
    phone: '+55 11 95485-4872',
    time: '01:59',
    count: 10,
    preview: 'Oi, tudo bem? Como posso te ajudar?',
    lastActivity: '05/04, 01:59',
    messages: [
      { role: 'admin', body: 'Oi, tudo bem? Como posso te ajudar?', time: '05/04, 01:53' },
      { role: 'client', body: 'Preciso de mais informacoes sobre os servicos.', time: '05/04, 01:59' },
    ],
  },
  {
    id: 'claro-novo',
    initials: 'CN',
    name: 'Claro Novo',
    phone: '+55 11 97061-4357',
    time: '01:59',
    count: 10,
    preview: 'Oi! Seja bem-vindo(a)! O que voce precisa?',
    lastActivity: '05/04, 01:59',
    messages: [
      { role: 'admin', body: 'Oi! Seja bem-vindo(a)! O que voce precisa?', time: '05/04, 01:49' },
      { role: 'client', body: 'Quero falar com o atendimento humano.', time: '05/04, 01:59' },
    ],
  },
]

const boardCards = [
  {
    title: 'Fluxos ativos',
    value: '12',
    description: 'Rotinas e automacoes ligadas no projeto.',
  },
  {
    title: 'Leads quentes',
    value: '07',
    description: 'Conversas abertas com alta chance de conversao.',
  },
  {
    title: 'Pendencias',
    value: '03',
    description: 'Acoes manuais aguardando validacao.',
  },
]

export function ProjectWorkspaceMock({ project, onBack, onOpenAttendance }) {
  const [attendanceOpen, setAttendanceOpen] = useState(false)
  const [activeConversationId, setActiveConversationId] = useState(conversations[0].id)

  const activeConversation = useMemo(
    () => conversations.find((conversation) => conversation.id === activeConversationId),
    [activeConversationId],
  )

  const handleOpenAttendance = () => {
    setAttendanceOpen(true)
    onOpenAttendance()
  }

  const handleBackToWorkspace = () => {
    setAttendanceOpen(false)
  }

  return (
    <main className="flex min-h-screen flex-1 flex-col">
      <header className="border-b border-white/5 px-4 py-4 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div className="flex flex-wrap items-start gap-3">
            <Button
              variant="ghost"
              size="icon"
              className="h-11 w-11 rounded-2xl border border-white/5 bg-white/[0.03] text-slate-300 hover:bg-white/[0.06] hover:text-white"
              onClick={onBack}
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>

            <div>
              <div className="text-[11px] uppercase tracking-[0.24em] text-slate-500">Projeto</div>
              <div className="mt-1 flex flex-wrap items-center gap-4">
                <h1 className="text-xl font-semibold text-white sm:text-2xl">{project}</h1>
                {!attendanceOpen && (
                  <Button
                    variant="ghost"
                    className="h-10 rounded-2xl border border-cyan-400/20 bg-cyan-500/10 px-4 text-cyan-100 hover:bg-cyan-500/15 hover:text-white"
                    onClick={handleOpenAttendance}
                  >
                    <MessageSquareText className="mr-2 h-4 w-4" />
                    Atendimento
                  </Button>
                )}
              </div>
            </div>
          </div>

          {!attendanceOpen && (
            <div className="flex flex-wrap items-center gap-2">
              <Sheet>
                <SheetTrigger asChild>
                  <Button
                    variant="ghost"
                    className="rounded-2xl border border-white/10 bg-white/[0.03] text-slate-200 hover:bg-white/[0.06] hover:text-white"
                  >
                    <Bot className="mr-2 h-4 w-4" />
                    Agente
                  </Button>
                </SheetTrigger>
                <SheetContent className="border-l border-white/5 bg-[#08111f] text-slate-200">
                  <SheetHeader>
                    <SheetTitle className="text-white">Agente do projeto</SheetTitle>
                    <SheetDescription>
                      Parametros mock para tom de voz, canais e prioridade operacional.
                    </SheetDescription>
                  </SheetHeader>
                  <div className="mt-8 space-y-4">
                    <div className="rounded-[24px] border border-white/5 bg-white/[0.03] p-5">
                      <div className="text-xs uppercase tracking-[0.2em] text-slate-500">
                        Persona
                      </div>
                      <div className="mt-2 text-lg font-semibold text-white">
                        Atendente premium
                      </div>
                      <p className="mt-3 text-sm leading-6 text-slate-400">
                        Responde com clareza, prioriza resolucao rapida e escala humano quando a
                        conversa sair do script.
                      </p>
                    </div>
                    <div className="rounded-[24px] border border-white/5 bg-white/[0.03] p-5">
                      <div className="text-xs uppercase tracking-[0.2em] text-slate-500">
                        Regras
                      </div>
                      <ul className="mt-3 space-y-3 text-sm text-slate-300">
                        <li>Validar nome e contexto antes de enviar anexos.</li>
                        <li>Priorizar WhatsApp quando houver lead em aberto.</li>
                        <li>Escalar para humano apos 2 tentativas sem resposta util.</li>
                      </ul>
                    </div>
                  </div>
                </SheetContent>
              </Sheet>

              <Sheet>
                <SheetTrigger asChild>
                  <Button
                    variant="ghost"
                    className="rounded-2xl border border-white/10 bg-white/[0.03] text-slate-200 hover:bg-white/[0.06] hover:text-white"
                  >
                    <PanelRight className="mr-2 h-4 w-4" />
                    Sheets
                  </Button>
                </SheetTrigger>
                <SheetContent className="border-l border-white/5 bg-[#08111f] text-slate-200">
                  <SheetHeader>
                    <SheetTitle className="text-white">Painel lateral</SheetTitle>
                    <SheetDescription>
                      Area reservada para midias, tarefas e atalhos do projeto.
                    </SheetDescription>
                  </SheetHeader>
                  <div className="mt-8 grid gap-4">
                    {[
                      'Uploads recentes',
                      'Checklist de onboarding',
                      'Historico de aprovacoes',
                    ].map((title) => (
                      <div
                        key={title}
                        className="rounded-[24px] border border-white/5 bg-white/[0.03] p-5"
                      >
                        <div className="text-sm font-semibold text-white">{title}</div>
                        <p className="mt-2 text-sm leading-6 text-slate-400">
                          Conteudo mock para validar estrutura, espacamento e comportamento do
                          sheet.
                        </p>
                      </div>
                    ))}
                  </div>
                </SheetContent>
              </Sheet>
            </div>
          )}
        </div>
      </header>

      <SimpleBar className="h-[calc(100vh-101px)]">
        <section className="px-4 py-6 sm:px-6 lg:px-8">
          {attendanceOpen ? (
            <AttendancePanel
              projectName={project}
              conversations={conversations}
              activeConversationId={activeConversationId}
              onConversationChange={setActiveConversationId}
              onBackToWorkspace={handleBackToWorkspace}
            />
          ) : (
            <div className="space-y-6">
              <div className="rounded-[30px] border border-white/5 bg-[linear-gradient(135deg,rgba(8,17,31,0.98),rgba(10,31,45,0.92))] p-6 shadow-[0_30px_90px_-44px_rgba(0,0,0,1)] sm:p-7">
                <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
                  <div className="max-w-2xl">
                    <Badge variant="cyan">Operacao ativa</Badge>
                    <h2 className="mt-4 text-3xl font-semibold text-white sm:text-4xl">
                      Workspace do projeto pronto para abrir o atendimento
                    </h2>
                    <p className="mt-4 text-sm leading-7 text-slate-400">
                      Aqui ficam o agente, os sheets laterais e o contexto principal. Ao abrir o
                      atendimento, o conteudo troca para uma tela dedicada ao chat dentro desta
                      mesma area principal.
                    </p>
                  </div>

                  <div className="rounded-[26px] border border-cyan-400/15 bg-cyan-500/10 p-5">
                    <div className="flex items-center gap-2 text-sm font-semibold text-cyan-100">
                      <Sparkles className="h-4 w-4" />
                      Conversa em foco
                    </div>
                    <div className="mt-3 text-lg font-semibold text-white">
                      {activeConversation?.name}
                    </div>
                    <div className="mt-1 text-sm text-slate-400">{activeConversation?.phone}</div>
                  </div>
                </div>
              </div>

              <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr),340px]">
                <div className="grid gap-5 md:grid-cols-3">
                  {boardCards.map((card, index) => (
                    <motion.article
                      key={card.title}
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.28, delay: index * 0.05 }}
                      className="rounded-[26px] border border-white/5 bg-white/[0.03] p-5"
                    >
                      <div className="text-xs uppercase tracking-[0.22em] text-slate-500">
                        {card.title}
                      </div>
                      <div className="mt-4 text-4xl font-semibold text-white">{card.value}</div>
                      <p className="mt-3 text-sm leading-6 text-slate-400">{card.description}</p>
                    </motion.article>
                  ))}
                </div>

                <div className="rounded-[26px] border border-white/5 bg-white/[0.03] p-5">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-xs uppercase tracking-[0.22em] text-slate-500">
                        Canal preferencial
                      </div>
                      <div className="mt-2 text-lg font-semibold text-white">WhatsApp</div>
                    </div>
                    <Badge variant="emerald">Online</Badge>
                  </div>
                  <p className="mt-4 text-sm leading-6 text-slate-400">
                    O botao de atendimento no topo abre a tela dedicada do chat e deixa o menu
                    lateral expandido.
                  </p>
                  <Button
                    className="mt-5 h-12 w-full rounded-2xl bg-cyan-500 text-slate-950 hover:bg-cyan-400"
                    onClick={handleOpenAttendance}
                  >
                    <MessageSquareText className="mr-2 h-4 w-4" />
                    Abrir atendimento
                  </Button>
                </div>
              </div>

              <div className="rounded-[30px] border border-white/5 bg-white/[0.03] p-5">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="text-xs uppercase tracking-[0.22em] text-slate-500">
                      Projeto selecionado
                    </div>
                    <div className="mt-2 text-lg font-semibold text-white">{project}</div>
                  </div>
                  <button
                    type="button"
                    className="flex items-center gap-2 text-sm text-slate-400 transition-colors hover:text-white"
                  >
                    <span>Ultimas atualizacoes</span>
                    <ChevronDown className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          )}
        </section>
      </SimpleBar>
    </main>
  )
}
