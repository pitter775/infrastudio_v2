import { cva } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const badgeVariants = cva(
  'inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.18em]',
  {
    variants: {
      variant: {
        default: 'border-white/10 bg-white/5 text-slate-200',
        cyan: 'border-cyan-400/20 bg-cyan-400/10 text-cyan-200',
        emerald: 'border-emerald-400/20 bg-emerald-400/10 text-emerald-200',
        amber: 'border-amber-400/20 bg-amber-400/10 text-amber-200',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
)

function Badge({ className, variant, ...props }) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />
}

export { Badge, badgeVariants }
