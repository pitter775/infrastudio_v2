import { cn } from '@/lib/utils'

function Avatar({ className, ...props }) {
  return (
    <div
      className={cn(
        'flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full border border-white/10 bg-slate-900/80',
        className,
      )}
      {...props}
    />
  )
}

function AvatarImage({ className, alt = '', ...props }) {
  return <img className={cn('h-full w-full object-cover', className)} alt={alt} {...props} />
}

function AvatarFallback({ className, ...props }) {
  return (
    <span
      className={cn(
        'flex h-full w-full items-center justify-center text-xs font-semibold uppercase tracking-[0.14em] text-slate-200',
        className,
      )}
      {...props}
    />
  )
}

export { Avatar, AvatarImage, AvatarFallback }
