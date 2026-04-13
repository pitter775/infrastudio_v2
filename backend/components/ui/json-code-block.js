"use client"

function tokenizeJson(value) {
  return String(value || "").split(/("(?:\\.|[^"\\])*"(?=\s*:)|"(?:\\.|[^"\\])*"|true|false|null|-?\d+(?:\.\d+)?(?:e[+-]?\d+)?)/gi)
}

function tokenClassName(token) {
  if (/^"(?:\\.|[^"\\])*"$/.test(token.trim())) {
    return "text-emerald-200"
  }

  if (/^(true|false)$/i.test(token)) {
    return "text-sky-300"
  }

  if (/^null$/i.test(token)) {
    return "text-slate-500"
  }

  if (/^-?\d/.test(token)) {
    return "text-amber-200"
  }

  return "text-slate-300"
}

export function JsonCodeBlock({ value, className = "" }) {
  const text = typeof value === "string" ? value : JSON.stringify(value, null, 2)

  return (
    <pre
      className={`whitespace-pre-wrap break-all rounded-xl border border-white/10 bg-[#0a1020] p-4 font-mono text-xs leading-5 text-slate-300 ${className}`}
    >
      {tokenizeJson(text).map((token, index) => (
        <span key={`${index}-${token}`} className={tokenClassName(token)}>
          {token}
        </span>
      ))}
    </pre>
  )
}
