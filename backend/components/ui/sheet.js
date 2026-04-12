'use client'

import * as DialogPrimitive from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

function Sheet(props) {
  return <DialogPrimitive.Root {...props} />
}

function SheetTrigger(props) {
  return <DialogPrimitive.Trigger {...props} />
}

function SheetPortal(props) {
  return <DialogPrimitive.Portal {...props} />
}

function SheetClose(props) {
  return <DialogPrimitive.Close {...props} />
}

function SheetTitle(props) {
  return <DialogPrimitive.Title {...props} />
}

function SheetDescription(props) {
  return <DialogPrimitive.Description {...props} />
}

function SheetOverlay({ className, ...props }) {
  return (
    <DialogPrimitive.Overlay
      className={cn('fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm', className)}
      {...props}
    />
  )
}

function SheetContent({
  className,
  children,
  side = 'left',
  showOverlay = true,
  showCloseButton = true,
  closeOnInteractOutside = true,
  closeOnEscapeKeyDown = true,
  ...props
}) {
  const sideClassName =
    side === 'left'
      ? 'inset-y-0 left-0 h-full w-[280px] border-r'
      : 'inset-y-0 right-0 h-full w-[280px] border-l'

  return (
    <SheetPortal>
      {showOverlay ? <SheetOverlay /> : null}
      <DialogPrimitive.Content
        className={cn(
          'fixed z-50 bg-[#080e1d] p-0 text-slate-400 outline-none border-white/5 will-change-transform data-[state=open]:animate-[sheet-in_360ms_cubic-bezier(0.22,1,0.36,1)] data-[state=closed]:animate-[sheet-out_280ms_cubic-bezier(0.4,0,1,1)]',
          sideClassName,
          className,
        )}
        onInteractOutside={
          closeOnInteractOutside ? props.onInteractOutside : (event) => event.preventDefault()
        }
        onPointerDownOutside={
          closeOnInteractOutside ? props.onPointerDownOutside : (event) => event.preventDefault()
        }
        onEscapeKeyDown={
          closeOnEscapeKeyDown ? props.onEscapeKeyDown : (event) => event.preventDefault()
        }
        {...props}
      >
        {children}
        {showCloseButton ? (
          <SheetClose className="absolute right-4 top-4 rounded-md p-1 text-slate-500 transition-colors hover:text-white focus:outline-none">
            <X className="h-4 w-4" />
            <span className="sr-only">Fechar menu</span>
          </SheetClose>
        ) : null}
      </DialogPrimitive.Content>
    </SheetPortal>
  )
}

export {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetOverlay,
  SheetPortal,
  SheetTitle,
  SheetTrigger,
}
