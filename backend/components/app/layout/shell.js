"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { LayoutGrid, LogOut, Menu, ShieldCheck } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"
import { cn } from "@/lib/utils"

const navigation = [
  {
    label: "Projetos",
    href: "/app/projetos",
    icon: LayoutGrid,
  },
]

function SidebarContent({ pathname, user, onNavigate }) {
  const isAdmin = user?.role === "admin"

  return (
    <div className="flex h-full flex-col bg-zinc-950 text-white">
      <div className="border-b border-white/10 px-5 py-5">
        <Link href="/app/projetos" className="flex items-center gap-3" onClick={onNavigate}>
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white text-zinc-950">
            IS
          </div>
          <div>
            <p className="text-sm font-semibold">Infra Studio</p>
            <p className="text-xs text-zinc-400">Area do cliente</p>
          </div>
        </Link>
      </div>

      <nav className="flex-1 space-y-1 px-3 py-4">
        {navigation.map((item) => {
          const Icon = item.icon
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`)

          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-zinc-300 transition hover:bg-white/10 hover:text-white",
                active && "bg-white text-zinc-950 hover:bg-white hover:text-zinc-950",
              )}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </Link>
          )
        })}

        {isAdmin ? (
          <Link
            href="/admin/projetos"
            onClick={onNavigate}
            className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-zinc-300 transition hover:bg-white/10 hover:text-white"
          >
            <ShieldCheck className="h-4 w-4" />
            Admin
          </Link>
        ) : null}
      </nav>

      <div className="border-t border-white/10 p-4">
        <div className="mb-3 min-w-0">
          <p className="truncate text-sm font-medium">{user?.name || "Usuario"}</p>
          <p className="truncate text-xs text-zinc-400">{user?.email}</p>
        </div>
        <form action="/api/auth/logout" method="post">
          <Button
            type="submit"
            variant="ghost"
            className="w-full justify-start gap-2 text-zinc-300 hover:bg-white/10 hover:text-white"
          >
            <LogOut className="h-4 w-4" />
            Sair
          </Button>
        </form>
      </div>
    </div>
  )
}

export function AppShell({ children, user }) {
  const pathname = usePathname()
  const router = useRouter()

  return (
    <div className="min-h-screen bg-zinc-100 text-zinc-950">
      <aside className="fixed inset-y-0 left-0 hidden w-72 lg:block">
        <SidebarContent pathname={pathname} user={user} />
      </aside>

      <div className="lg:pl-72">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-zinc-200 bg-white/90 px-4 backdrop-blur lg:hidden">
          <Link href="/app/projetos" className="text-sm font-semibold">
            Infra Studio
          </Link>
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="outline" size="icon" aria-label="Abrir menu">
                <Menu className="h-4 w-4" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-72 border-0 bg-zinc-950 p-0">
              <SidebarContent pathname={pathname} user={user} onNavigate={() => router.refresh()} />
            </SheetContent>
          </Sheet>
        </header>

        <main className="min-h-screen px-4 py-6 sm:px-6 lg:px-8">{children}</main>
      </div>
    </div>
  )
}
