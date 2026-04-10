'use client'

import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { ProjectCard } from '@/components/mock01/project-card'
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet'

export function ProjectDetailView({ card }) {
  const [isPanelOpen, setIsPanelOpen] = useState(false)
  const [cardDockStyle, setCardDockStyle] = useState({ x: 0, y: 0, scale: 1 })
  const stageRef = useRef(null)
  const checklist = [
    'Webhook health monitor',
    'Deploy pipeline status',
    'Queue worker metrics',
    'Runtime environment variables',
    'API latency snapshot',
    'Error tracking review',
  ]
  const updates = [
    'Refino do layout principal para navegacao por projeto.',
    'Revisao de estrutura para drawer lateral contextual.',
    'Ajustes de contraste e hierarquia visual no dashboard.',
    'Testes de comportamento mobile e desktop.',
    'Preparacao para integrar dados reais do projeto.',
  ]

  useEffect(() => {
    function syncCardDock() {
      if (!stageRef.current) {
        return
      }

      if (!isPanelOpen) {
        setCardDockStyle({ x: 0, y: 0, scale: 1 })
        return
      }

      const stageRect = stageRef.current.getBoundingClientRect()
      const cardElement = stageRef.current.querySelector('[data-project-card-root]')

      if (!cardElement) {
        return
      }

      const cardRect = cardElement.getBoundingClientRect()
      const viewportWidth = window.innerWidth
      const viewportHeight = window.innerHeight
      const sheetRight = 19
      const sheetTop = 54
      const sheetBottom = 18
      const safeGap = 24
      const sheetWidth = Math.max(viewportWidth * 0.5, 680)
      const sheetLeft = viewportWidth - sheetRight - sheetWidth
      const availableLeft = stageRect.left + safeGap
      const availableRight = Math.max(
        availableLeft,
        Math.min(stageRect.right, sheetLeft) - safeGap,
      )
      const availableTop = Math.max(stageRect.top + safeGap, sheetTop + safeGap)
      const availableBottom = Math.max(
        availableTop,
        Math.min(stageRect.bottom, viewportHeight - sheetBottom) - safeGap,
      )
      const scale = viewportWidth < 1300 ? 0.84 : 0.88
      const scaledWidth = cardRect.width * scale
      const scaledHeight = cardRect.height * scale
      const cardCenterX = cardRect.left + cardRect.width / 2
      const cardCenterY = cardRect.top + cardRect.height / 2
      const minCenterX = availableLeft + scaledWidth / 2
      const maxCenterX = Math.max(minCenterX, availableRight - scaledWidth / 2)
      const minCenterY = availableTop + scaledHeight / 2
      const maxCenterY = Math.max(minCenterY, availableBottom - scaledHeight / 2)
      const targetCenterX = Math.min(Math.max(cardCenterX, minCenterX), maxCenterX)
      const targetCenterY = Math.min(Math.max(cardCenterY, minCenterY), maxCenterY)

      setCardDockStyle({
        x: targetCenterX - cardCenterX,
        y: targetCenterY - cardCenterY,
        scale,
      })
    }

    let timeoutId
    const frame = window.requestAnimationFrame(() => {
      syncCardDock()
      timeoutId = window.setTimeout(syncCardDock, 60)
    })
    window.addEventListener('resize', syncCardDock)

    return () => {
      window.cancelAnimationFrame(frame)
      window.clearTimeout(timeoutId)
      window.removeEventListener('resize', syncCardDock)
    }
  }, [isPanelOpen])

  return (
    <div className="min-h-full px-8 py-10">
      <div
        ref={stageRef}
        className="flex min-h-[420px] items-start justify-center lg:min-h-full lg:items-center"
      >
        <motion.div
          animate={cardDockStyle}
          transition={{ duration: 0.28, ease: 'easeInOut' }}
          className="w-full max-w-[320px] origin-center sm:max-w-[340px]"
        >
          <ProjectCard
            card={card}
            interactive
            draggableHeader
            onSelect={() => setIsPanelOpen(true)}
          />
        </motion.div>
      </div>

      <Sheet open={isPanelOpen} onOpenChange={setIsPanelOpen} modal={false}>
        <SheetContent
          side="right"
          showOverlay={false}
          closeOnInteractOutside={false}
          closeOnEscapeKeyDown={false}
          className="right-[19px] top-[54px] bottom-[18px] h-auto w-[50vw] min-w-[680px] max-w-[50vw] overflow-hidden rounded-l-lg border-l border-white/10 bg-[#080e1d] p-0 text-slate-300 shadow-none"
        >
          <SheetTitle className="sr-only">{card.name}</SheetTitle>
          <SheetDescription className="sr-only">
            Painel lateral com detalhes contextuais do projeto selecionado.
          </SheetDescription>
          <div className="flex h-full min-h-0 flex-col">
            <div className="border-b border-white/5 px-6 py-4">
              <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Project Panel</p>
              <h2 className="mt-2 text-xl font-semibold text-white">{card.name}</h2>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-6 py-6">
              <div className="space-y-6 text-sm text-slate-300">
                <div className="rounded-2xl border border-white/5 bg-white/[0.03] p-5">
                  <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Status</div>
                  <div className="mt-3 text-base font-medium text-white">{card.status}</div>
                  {card.details ? (
                    <div className="mt-2 text-sm text-slate-400">{card.details}</div>
                  ) : null}
                </div>

                <div className="rounded-2xl border border-white/5 bg-white/[0.03] p-5">
                  <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Mock content</div>
                  <p className="mt-3 leading-6 text-slate-300">
                    Painel lateral para testar navegacao contextual, acoes rapidas e informacoes
                    detalhadas do projeto sem sair da tela.
                  </p>
                </div>

                <div className="rounded-2xl border border-white/5 bg-white/[0.03] p-5">
                  <div className="text-xs uppercase tracking-[0.18em] text-slate-500">
                    Environment checklist
                  </div>
                  <div className="mt-4 space-y-3">
                    {checklist.map((item) => (
                      <div
                        key={item}
                        className="flex items-center justify-between rounded-xl border border-white/5 bg-slate-950/40 px-4 py-3"
                      >
                        <span className="text-sm text-slate-200">{item}</span>
                        <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 text-[11px] uppercase tracking-[0.14em] text-emerald-300">
                          ok
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-2xl border border-white/5 bg-white/[0.03] p-5">
                  <div className="text-xs uppercase tracking-[0.18em] text-slate-500">
                    Recent updates
                  </div>
                  <div className="mt-4 space-y-4">
                    {updates.map((item, index) => (
                      <div key={item} className="flex gap-4">
                        <div className="flex flex-col items-center">
                          <div className="h-2.5 w-2.5 rounded-full bg-sky-400" />
                          {index < updates.length - 1 ? (
                            <div className="mt-2 h-full w-px bg-white/10" />
                          ) : null}
                        </div>
                        <div className="pb-5">
                          <div className="text-sm font-medium text-white">Atualizacao {index + 1}</div>
                          <p className="mt-1 leading-6 text-slate-400">{item}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-2xl border border-white/5 bg-white/[0.03] p-5">
                  <div className="text-xs uppercase tracking-[0.18em] text-slate-500">
                    Notes
                  </div>
                  <div className="mt-4 space-y-3 text-sm leading-6 text-slate-400">
                    <p>
                      Este espaco serve para testar como o painel lateral se comporta com bastante
                      informacao, blocos repetidos, cards e scroll interno isolado.
                    </p>
                    <p>
                      A ideia aqui e validar legibilidade, contraste, hierarquia e tambem a
                      experiencia de navegacao quando o usuario abre um drawer contextual a partir
                      do detalhe do projeto.
                    </p>
                    <p>
                      Quando esse mock evoluir para algo real, este painel pode receber tabs,
                      configuracoes, logs, observabilidade, eventos recentes, pipelines e qualquer
                      outro dado operacional do projeto selecionado.
                    </p>
                  </div>
                </div>

                <div className="rounded-2xl border border-white/5 bg-white/[0.03] p-5">
                  <div className="text-xs uppercase tracking-[0.18em] text-slate-500">
                    Long list
                  </div>
                  <div className="mt-4 grid gap-3">
                    {Array.from({ length: 10 }, (_, index) => (
                      <div
                        key={index}
                        className="rounded-xl border border-white/5 bg-slate-950/30 px-4 py-3"
                      >
                        <div className="text-sm font-medium text-white">
                          Registro operacional {index + 1}
                        </div>
                        <div className="mt-1 text-sm text-slate-400">
                          Item adicional para forcar scroll e validar a experiencia de leitura dentro
                          do painel lateral.
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
}
