"use client"

import { Children, cloneElement, isValidElement, useRef } from "react"
import { ScrollMenu } from "react-horizontal-scrolling-menu"
import "react-horizontal-scrolling-menu/dist/styles.css"

import { cn } from "@/lib/utils"

function HorizontalDragScrollItem({ children }) {
  return <div>{children}</div>
}

function getClientX(event) {
  if ("touches" in event && event.touches?.[0]) {
    return event.touches[0].clientX
  }

  if ("changedTouches" in event && event.changedTouches?.[0]) {
    return event.changedTouches[0].clientX
  }

  return event.clientX ?? 0
}

export function HorizontalDragScroll({ children, className, itemClassName, scrollClassName }) {
  const dragState = useRef({
    active: false,
    startX: 0,
    scrollLeft: 0,
  })

  function startDrag(api) {
    return (event) => {
      const container = api.scrollContainer.current
      if (!container) {
        return
      }

      dragState.current = {
        active: true,
        startX: getClientX(event),
        scrollLeft: container.scrollLeft,
      }
    }
  }

  function moveDrag(api) {
    return (event) => {
      const container = api.scrollContainer.current
      if (!container || !dragState.current.active) {
        return
      }

      event.preventDefault()
      container.scrollLeft = dragState.current.scrollLeft - (getClientX(event) - dragState.current.startX)
    }
  }

  function stopDrag() {
    return () => {
      dragState.current.active = false
    }
  }

  const items = Children.toArray(children).map((child, index) => {
    const itemId =
      isValidElement(child) && (child.props.itemId || child.props["data-item-id"])
        ? child.props.itemId || child.props["data-item-id"]
        : `horizontal-item-${index}`

    return (
      <HorizontalDragScrollItem key={itemId} itemId={itemId}>
        {isValidElement(child) ? cloneElement(child, { key: child.key ?? itemId }) : child}
      </HorizontalDragScrollItem>
    )
  })

  return (
    <div className={cn("min-w-0", className)}>
      <ScrollMenu
        onMouseDown={startDrag}
        onMouseMove={moveDrag}
        onMouseLeave={stopDrag}
        onMouseUp={stopDrag}
        onTouchStart={startDrag}
        onTouchMove={moveDrag}
        onTouchEnd={stopDrag}
        itemClassName={cn("shrink-0", itemClassName)}
        scrollContainerClassName={cn("gap-3 overscroll-x-contain py-1", scrollClassName)}
        wrapperClassName="infra-horizontal-scroll"
      >
        {items}
      </ScrollMenu>
    </div>
  )
}
