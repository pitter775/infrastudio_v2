import * as DropdownMenuPrimitive from '@radix-ui/react-dropdown-menu'
import { Check, ChevronRight, Circle } from 'lucide-react'
import { cn } from '@/lib/utils'

const DropdownMenu = DropdownMenuPrimitive.Root
const DropdownMenuTrigger = DropdownMenuPrimitive.Trigger
const DropdownMenuGroup = DropdownMenuPrimitive.Group
const DropdownMenuPortal = DropdownMenuPrimitive.Portal
const DropdownMenuSub = DropdownMenuPrimitive.Sub
const DropdownMenuRadioGroup = DropdownMenuPrimitive.RadioGroup

const DropdownMenuSubTrigger = ({ className, inset, children, ...props }) => (
  <DropdownMenuPrimitive.SubTrigger
    className={cn(
      'flex cursor-default select-none items-center rounded-md px-2 py-1.5 text-sm outline-none focus:bg-secondary data-[state=open]:bg-secondary',
      inset && 'pl-8',
      className,
    )}
    {...props}
  >
    {children}
    <ChevronRight className="ml-auto h-4 w-4" />
  </DropdownMenuPrimitive.SubTrigger>
)

const DropdownMenuSubContent = ({ className, ...props }) => (
  <DropdownMenuPrimitive.SubContent
    className={cn(
      'z-50 min-w-[8rem] overflow-hidden rounded-xl border bg-card p-1 text-card-foreground shadow-panel',
      className,
    )}
    {...props}
  />
)

const DropdownMenuContent = ({ className, sideOffset = 6, ...props }) => (
  <DropdownMenuPrimitive.Portal>
    <DropdownMenuPrimitive.Content
      sideOffset={sideOffset}
      className={cn(
        'z-50 min-w-[8rem] overflow-hidden rounded-xl border bg-card p-1 text-card-foreground shadow-panel',
        className,
      )}
      {...props}
    />
  </DropdownMenuPrimitive.Portal>
)

const DropdownMenuItem = ({ className, inset, ...props }) => (
  <DropdownMenuPrimitive.Item
    className={cn(
      'relative flex cursor-default select-none items-center rounded-lg px-2 py-1.5 text-sm outline-none transition-colors focus:bg-secondary data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
      inset && 'pl-8',
      className,
    )}
    {...props}
  />
)

const DropdownMenuCheckboxItem = ({ className, children, checked, ...props }) => (
  <DropdownMenuPrimitive.CheckboxItem
    className={cn(
      'relative flex cursor-default select-none items-center rounded-lg py-1.5 pl-8 pr-2 text-sm outline-none transition-colors focus:bg-secondary data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
      className,
    )}
    checked={checked}
    {...props}
  >
    <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
      <DropdownMenuPrimitive.ItemIndicator>
        <Check className="h-4 w-4" />
      </DropdownMenuPrimitive.ItemIndicator>
    </span>
    {children}
  </DropdownMenuPrimitive.CheckboxItem>
)

const DropdownMenuRadioItem = ({ className, children, ...props }) => (
  <DropdownMenuPrimitive.RadioItem
    className={cn(
      'relative flex cursor-default select-none items-center rounded-lg py-1.5 pl-8 pr-2 text-sm outline-none transition-colors focus:bg-secondary data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
      className,
    )}
    {...props}
  >
    <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
      <DropdownMenuPrimitive.ItemIndicator>
        <Circle className="h-2 w-2 fill-current" />
      </DropdownMenuPrimitive.ItemIndicator>
    </span>
    {children}
  </DropdownMenuPrimitive.RadioItem>
)

const DropdownMenuLabel = ({ className, inset, ...props }) => (
  <DropdownMenuPrimitive.Label
    className={cn('px-2 py-1.5 text-sm font-semibold', inset && 'pl-8', className)}
    {...props}
  />
)

const DropdownMenuSeparator = ({ className, ...props }) => (
  <DropdownMenuPrimitive.Separator
    className={cn('-mx-1 my-1 h-px bg-border', className)}
    {...props}
  />
)

const DropdownMenuShortcut = ({ className, ...props }) => (
  <span
    className={cn('ml-auto text-xs tracking-widest text-muted-foreground', className)}
    {...props}
  />
)

export {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuCheckboxItem,
  DropdownMenuRadioItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuGroup,
  DropdownMenuPortal,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuRadioGroup,
}
