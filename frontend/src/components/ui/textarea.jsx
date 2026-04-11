import { cn } from '@/lib/utils'

function Textarea({ className, ...props }) {
  return (
    <textarea
      className={cn(
        'flex min-h-[110px] w-full rounded-[22px] border border-white/10 bg-[#07111f] px-4 py-3 text-sm text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-cyan-400/45 focus:ring-2 focus:ring-cyan-500/15 disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      {...props}
    />
  )
}

export { Textarea }
