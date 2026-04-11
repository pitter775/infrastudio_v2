'use client'

import { motion } from 'framer-motion'
import {
  Activity,
  BarChart3,
  Clock3,
  MessageSquareText,
  TrendingUp,
  Users,
} from 'lucide-react'
import { MockPageHeader } from '@/components/mock01/mock-page-header'
import { cn } from '@/lib/utils'

const summaryCards = [
  { label: 'Conversas hoje', value: '24', note: 'Atendidas nas ultimas 24h', icon: MessageSquareText },
  { label: 'Leads ativos', value: '21', note: 'Equipe em atendimento', icon: Users },
  { label: 'Acoes abertas', value: '157', note: 'Pendencias operacionais', icon: Activity },
  { label: 'Volume mensal', value: '162,3 mil', note: 'Mensagens processadas', icon: TrendingUp },
  { label: 'Custo medio', value: 'US$ 0,0263', note: 'Por conversa ativa', icon: BarChart3 },
  { label: 'Alertas', value: '21', note: 'Itens em revisao', icon: Clock3 },
]

const dailySeries = [26, 82, 31, 18, 54, 20, 16, 14, 22, 19, 17, 21]
const channelBars = [
  { label: 'WhatsApp', value: '81,1 mil', height: 86, color: 'bg-emerald-500' },
  { label: 'Site', value: '56,2 mil', height: 62, color: 'bg-sky-500' },
]

const topProjects = [
  { name: 'Reliquia de familia', value: '88,4 mil', progress: 'w-[84%]' },
  { name: 'Novo atendimento', value: '47,3 mil', progress: 'w-[58%]' },
  { name: 'InfraStudio', value: '42,8 mil', progress: 'w-[50%]' },
  { name: 'Teste botao', value: '3,5 mil', progress: 'w-[18%]' },
]

const topAgents = [
  { name: 'Reliquia de familia', value: '185,4 mil', progress: 'w-[88%]' },
  { name: 'Agente de Demonstracao', value: '96,2 mil', progress: 'w-[52%]' },
  { name: 'Agente de Inovox', value: '39,6 mil', progress: 'w-[31%]' },
  { name: 'Agente do site', value: '13,1 mil', progress: 'w-[14%]' },
]

const latestMessages = [
  { name: 'Oi', project: 'Canal Site', amount: 'US$ 4,0021' },
  { name: 'Andre', project: 'Agente de Demonstracao', amount: 'US$ 3,518' },
  { name: 'Andre', project: 'Agente de Demonstracao', amount: 'US$ 2,791' },
  { name: 'Andre', project: 'Agente de Demonstracao', amount: 'US$ 2,442' },
  { name: 'Andre', project: 'Agente de Demonstracao', amount: 'US$ 1,2037' },
]

function Card({ className, children }) {
  return (
    <section className={cn('rounded-[12px] border border-white/5 bg-[#121a2a] p-4', className)}>
      {children}
    </section>
  )
}

function CardTitle({ eyebrow, title, meta }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div>
        {eyebrow ? (
          <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
            {eyebrow}
          </div>
        ) : null}
        <h2 className="mt-1 text-sm font-semibold text-slate-100">{title}</h2>
      </div>
      {meta ? <div className="text-[10px] text-slate-500">{meta}</div> : null}
    </div>
  )
}

export function DashboardView({ card }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: 56 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.22, ease: 'easeInOut' }}
      className="min-h-full"
    >
      <MockPageHeader
        title="Dashboard"
        description={`Visao geral da operacao${card?.name ? ` de ${card.name}` : ' do workspace'}.`}
      />

      <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr),300px]">
        <div className="space-y-3">
          <Card>
            <CardTitle eyebrow="Dashboard do projeto" title="Visao geral da operacao" meta="Hoje" />
            <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {summaryCards.map((item) => {
                const Icon = item.icon
                return (
                  <div key={item.label} className="rounded-[10px] border border-white/5 bg-[#0f1624] p-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                        {item.label}
                      </div>
                      <Icon className="h-3.5 w-3.5 text-slate-500" />
                    </div>
                    <div className="mt-3 text-xl font-semibold text-slate-100">{item.value}</div>
                    <div className="mt-1 text-[11px] text-slate-500">{item.note}</div>
                  </div>
                )
              })}
            </div>
          </Card>

          <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr),260px]">
            <Card>
              <CardTitle eyebrow="Resumo rapido" title="Consumo por canal" meta="2 canais" />
              <div className="mt-4 grid grid-cols-2 gap-4">
                {channelBars.map((item) => (
                  <div key={item.label} className="rounded-[10px] border border-white/5 bg-[#0f1624] p-3">
                    <div className="flex h-32 items-end">
                      <div className={cn('w-full rounded-[8px] opacity-90', item.color)} style={{ height: `${item.height}%` }} />
                    </div>
                    <div className="mt-3 text-xs font-semibold text-slate-100">{item.label}</div>
                    <div className="mt-1 text-[11px] text-slate-500">{item.value}</div>
                  </div>
                ))}
              </div>
            </Card>

            <Card>
              <CardTitle eyebrow="Consumo" title="Ritmo diario atual" />
              <div className="mt-5 flex h-36 items-end gap-2">
                {dailySeries.map((value, index) => (
                  <div key={`${value}-${index}`} className="flex flex-1 items-end">
                    <div
                      className={cn(
                        'w-full rounded-[6px]',
                        index % 3 === 0 ? 'bg-sky-500' : 'bg-slate-600',
                      )}
                      style={{ height: `${value}%` }}
                    />
                  </div>
                ))}
              </div>
              <div className="mt-4 flex items-center justify-between text-[10px] text-slate-500">
                <span>7 dias</span>
                <span>28 dias</span>
                <span>90 dias</span>
              </div>
            </Card>
          </div>

          <div className="grid gap-3 lg:grid-cols-2">
            <Card>
              <CardTitle eyebrow="Ranking" title="Top projetos por consumo" meta="5 projetos" />
              <div className="mt-4 space-y-3">
                {topProjects.map((item) => (
                  <div key={item.name} className="rounded-[10px] border border-white/5 bg-[#0f1624] p-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-xs font-medium text-slate-200">{item.name}</div>
                      <div className="text-[11px] text-slate-400">{item.value}</div>
                    </div>
                    <div className="mt-3 h-1.5 rounded-full bg-white/5">
                      <div className={cn('h-1.5 rounded-full bg-sky-500', item.progress)} />
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            <Card>
              <CardTitle eyebrow="Consumo" title="Chats com mais peso em IA" meta="6 chats" />
              <div className="mt-4 space-y-3">
                {topProjects.map((item, index) => (
                  <div key={`${item.name}-${index}`} className="rounded-[10px] border border-white/5 bg-[#0f1624] p-3">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="text-xs font-medium text-slate-200">{item.name}</div>
                        <div className="mt-1 text-[10px] text-slate-500">Atendente IA ativo</div>
                      </div>
                      <div className="text-[11px] text-emerald-300">{item.value}</div>
                    </div>
                    <div className="mt-3 h-1.5 rounded-full bg-white/5">
                      <div className={cn('h-1.5 rounded-full bg-cyan-500', item.progress)} />
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </div>

        <div className="space-y-3">
          <Card>
            <CardTitle eyebrow="Atividade" title="Ultimas mensagens com consumo" meta="ao vivo" />
            <div className="mt-4 space-y-3">
              {latestMessages.map((item, index) => (
                <div key={`${item.name}-${index}`} className="rounded-[10px] border border-white/5 bg-[#0f1624] p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-xs font-medium text-slate-200">{item.name}</div>
                      <div className="mt-1 text-[10px] text-slate-500">{item.project}</div>
                    </div>
                    <div className="text-[11px] text-emerald-300">{item.amount}</div>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <Card>
            <CardTitle eyebrow="Agentes" title="Top agentes" meta="4 agentes" />
            <div className="mt-4 space-y-3">
              {topAgents.map((item) => (
                <div key={item.name} className="rounded-[10px] border border-white/5 bg-[#0f1624] p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-xs font-medium text-slate-200">{item.name}</div>
                    <div className="text-[11px] text-slate-400">{item.value}</div>
                  </div>
                  <div className="mt-3 h-1.5 rounded-full bg-white/5">
                    <div className={cn('h-1.5 rounded-full bg-emerald-500', item.progress)} />
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </motion.div>
  )
}
