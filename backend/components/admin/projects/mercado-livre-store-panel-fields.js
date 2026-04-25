'use client'

export function StorePanelField({ label, children }) {
  return (
    <label className="grid gap-2">
      <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{label}</span>
      {children}
    </label>
  )
}

export function StorePanelInput({ label, value, onChange, placeholder, type = 'text' }) {
  return (
    <StorePanelField label={label}>
      <input
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className="h-11 rounded-xl border border-white/10 bg-[#080e1d] px-3 text-sm text-white outline-none transition focus:border-sky-400/30"
      />
    </StorePanelField>
  )
}

export function StorePanelTextarea({ label, value, onChange, className = 'min-h-[110px]' }) {
  return (
    <StorePanelField label={label}>
      <textarea
        value={value}
        onChange={onChange}
        className={`${className} rounded-xl border border-white/10 bg-[#080e1d] px-3 py-3 text-sm text-white outline-none transition focus:border-sky-400/30`}
      />
    </StorePanelField>
  )
}

export function StorePanelToggle({ checked, onChange, children }) {
  return (
    <label className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-slate-200">
      <input type="checkbox" checked={checked} onChange={onChange} />
      {children}
    </label>
  )
}
