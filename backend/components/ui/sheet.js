'use client'

import { useRef, useState } from 'react'
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
      className={cn('infra-overlay-motion fixed inset-0 z-[80] bg-slate-950/60', className)}
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
  overlayClassName,
  ...props
}) {
  const closeRef = useRef(null)
  const touchStateRef = useRef({ startX: 0, startY: 0, active: false })
  const [dragOffset, setDragOffset] = useState(0)
  const isSwipeEnabled = typeof window !== 'undefined' && window.innerWidth < 1024
  const sideClassName =
    side === 'left'
      ? 'infra-sheet-left inset-y-0 left-0 h-full w-[280px] border-r'
      : 'infra-sheet-right inset-y-0 right-0 h-full w-[280px] border-l'

  function resetSwipeState() {
    touchStateRef.current = { startX: 0, startY: 0, active: false }
    setDragOffset(0)
  }

  function handleTouchStart(event) {
    if (!isSwipeEnabled || event.touches.length !== 1) {
      return
    }

    const touch = event.touches[0]
    touchStateRef.current = {
      startX: touch.clientX,
      startY: touch.clientY,
      active: false,
    }
  }

  function handleTouchMove(event) {
    if (!isSwipeEnabled || event.touches.length !== 1) {
      return
    }

    const touch = event.touches[0]
    const deltaX = touch.clientX - touchStateRef.current.startX
    const deltaY = touch.clientY - touchStateRef.current.startY

    if (Math.abs(deltaY) > Math.abs(deltaX)) {
      return
    }

    const directionalOffset = side === 'right' ? Math.max(deltaX, 0) : Math.max(-deltaX, 0)
    if (directionalOffset <= 0) {
      return
    }

    touchStateRef.current.active = true
    setDragOffset(Math.min(directionalOffset, 180))
  }

  function handleTouchEnd() {
    if (!touchStateRef.current.active) {
      resetSwipeState()
      return
    }

    if (dragOffset >= 96) {
      closeRef.current?.click()
    }

    resetSwipeState()
  }

  return (
    <SheetPortal>
      {showOverlay ? <SheetOverlay className={overlayClassName} /> : null}
      <DialogPrimitive.Content
        className={cn(
          'infra-diagonal-shadow fixed z-[81] bg-[#080e1d] p-0 text-slate-400 outline-none border-white/5',
          sideClassName,
          className,
        )}
        style={{
          ...(props.style || {}),
          transform: dragOffset ? `translateX(${side === 'right' ? dragOffset : -dragOffset}px)` : props.style?.transform,
          transition: dragOffset ? 'none' : props.style?.transition,
        }}
        onInteractOutside={
          closeOnInteractOutside ? props.onInteractOutside : (event) => event.preventDefault()
        }
        onPointerDownOutside={
          closeOnInteractOutside ? props.onPointerDownOutside : (event) => event.preventDefault()
        }
        onEscapeKeyDown={
          closeOnEscapeKeyDown ? props.onEscapeKeyDown : (event) => event.preventDefault()
        }
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        {...props}
      >
        {children}
        <SheetClose ref={closeRef} className="sr-only">
          Fechar
        </SheetClose>
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
