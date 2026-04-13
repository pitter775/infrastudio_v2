"use client"

import { cn } from "@/lib/utils"

export function ToggleSwitchButton({ checked, onChange, labelOn = "Ativo", labelOff = "Inativo", disabled = false }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onChange?.(!checked)}
      className={cn(
        "inline-flex h-8 w-fit items-center gap-2 rounded-full border px-2 pr-3 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50",
        checked
          ? "border-emerald-400/25 bg-emerald-500/10 text-emerald-100"
          : "border-red-400/25 bg-red-500/10 text-red-100",
      )}
    >
      <span className={cn("flex h-4 w-7 items-center rounded-full p-0.5", checked ? "bg-emerald-400/25" : "bg-red-400/25")}>
        <span className={cn("h-3 w-3 rounded-full transition-transform", checked ? "translate-x-3 bg-emerald-300" : "translate-x-0 bg-red-300")} />
      </span>
      {checked ? labelOn : labelOff}
    </button>
  )
}
