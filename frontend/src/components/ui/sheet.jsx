import * as DialogPrimitive from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

const Sheet = DialogPrimitive.Root
const SheetTrigger = DialogPrimitive.Trigger
const SheetClose = DialogPrimitive.Close
const SheetPortal = DialogPrimitive.Portal

const SheetOverlay = ({ className, ...props }) => (
  <DialogPrimitive.Overlay
    className={cn('fixed inset-0 z-50 bg-slate-950/40 backdrop-blur-sm', className)}
    {...props}
  />
)

const sheetVariants = {
  right:
    'left-1/2 top-1/2 w-[min(92vw,24rem)] -translate-x-1/2 -translate-y-1/2 rounded-[28px] border sm:inset-y-0 sm:right-0 sm:left-auto sm:top-0 sm:h-full sm:w-full sm:max-w-lg sm:translate-x-0 sm:translate-y-0 sm:rounded-none sm:border-l',
  left:
    'left-1/2 top-1/2 w-[min(92vw,24rem)] -translate-x-1/2 -translate-y-1/2 rounded-[28px] border sm:inset-y-0 sm:left-0 sm:top-0 sm:h-full sm:w-full sm:max-w-lg sm:translate-x-0 sm:translate-y-0 sm:rounded-none sm:border-r',
  top: 'inset-x-0 top-0 border-b',
  bottom: 'inset-x-0 bottom-0 border-t',
}

const SheetContent = ({ side = 'right', className, children, ...props }) => (
  <SheetPortal>
    <SheetOverlay />
    <DialogPrimitive.Content
      className={cn(
        'fixed z-50 bg-card px-5 pb-5 pt-14 shadow-panel transition ease-in-out sm:p-6',
        sheetVariants[side],
        className,
      )}
      {...props}
    >
      {children}
      <DialogPrimitive.Close className="absolute right-4 top-4 rounded-full border border-white/10 bg-white/[0.03] p-2 opacity-70 transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none">
        <X className="h-4 w-4" />
        <span className="sr-only">Close</span>
      </DialogPrimitive.Close>
    </DialogPrimitive.Content>
  </SheetPortal>
)

const SheetHeader = ({ className, ...props }) => (
  <div className={cn('flex flex-col space-y-2 text-left', className)} {...props} />
)

const SheetFooter = ({ className, ...props }) => (
  <div
    className={cn('mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end', className)}
    {...props}
  />
)

const SheetTitle = ({ className, ...props }) => (
  <DialogPrimitive.Title
    className={cn('text-lg font-semibold text-foreground', className)}
    {...props}
  />
)

const SheetDescription = ({ className, ...props }) => (
  <DialogPrimitive.Description
    className={cn('hidden text-sm text-muted-foreground sm:block', className)}
    {...props}
  />
)

export {
  Sheet,
  SheetPortal,
  SheetOverlay,
  SheetTrigger,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetFooter,
  SheetTitle,
  SheetDescription,
}
