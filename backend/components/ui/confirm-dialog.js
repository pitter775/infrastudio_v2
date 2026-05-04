"use client"

import * as Dialog from "@radix-ui/react-dialog"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export function ConfirmDialog({
  open,
  onOpenChange,
  title = "Confirmar acao",
  description = "",
  confirmLabel = "Confirmar",
  cancelLabel = "Cancelar",
  onConfirm,
  loading = false,
  confirmDisabled = false,
  danger = false,
  children,
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="infra-overlay-motion fixed inset-0 z-[120] bg-slate-950/80" />
        <Dialog.Content className="infra-dialog-motion infra-diagonal-shadow fixed left-1/2 top-1/2 z-[130] w-[calc(100vw-1.5rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-xl border border-white/10 bg-[#0b1120] p-0 text-white outline-none">
          <div className="p-5">
            <Dialog.Title className="text-base font-semibold text-white">{title}</Dialog.Title>
            {description ? (
              <Dialog.Description className="mt-2 text-sm leading-6 text-slate-400">
                {description}
              </Dialog.Description>
            ) : null}
          </div>

          {children}

          <div className="flex items-center justify-end gap-2 border-t border-white/10 bg-[#0f172a] px-5 py-4">
            <Button type="button" variant="ghost" onClick={() => onOpenChange?.(false)} disabled={loading}>
              {cancelLabel}
            </Button>
            <Button
              type="button"
              variant="ghost"
              disabled={loading || confirmDisabled}
              onClick={onConfirm}
              className={cn(
                "border px-4",
                danger
                  ? "border-red-500/20 bg-red-500/10 text-red-100 hover:bg-red-500/20"
                  : "border-sky-500/20 bg-sky-500/10 text-sky-100 hover:bg-sky-500/20",
              )}
            >
              {confirmLabel}
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
