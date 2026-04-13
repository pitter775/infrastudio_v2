"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { House, LayoutGrid, LogOut, Menu, ShieldCheck } from "lucide-react"

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
    <div className="flex h-full flex-col justify-between bg-[#080e1d] text-slate-400">
      <div className="px-4 py-6">
        <Link href="/app/projetos" className="flex items-center gap-3" onClick={onNavigate}>
          <img src="/logo.png" alt="InfraStudio Logo" className="h-5 w-5 object-contain" />
          <div>
            <p className="text-sm font-semibold text-white">InfraStudio</p>
            <p className="text-xs text-slate-500">Area do cliente</p>
          </div>
        </Link>

        <nav className="mt-10 space-y-1">
          {navigation.map((item) => {
            const Icon = item.icon
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`)

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onNavigate}
                className={cn(
                  "group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors duration-200",
                  active
                    ? "bg-slate-800/60 text-white"
                    : "text-slate-400 hover:bg-slate-800/40 hover:text-white",
                )}
              >
                <Icon className={cn("h-4 w-4", active ? "text-[#b084f8]" : "text-slate-400 group-hover:text-[#6f9aea]")} />
                {item.label}
              </Link>
            )
          })}

          {isAdmin ? (
            <Link
              href="/admin/projetos"
              onClick={onNavigate}
              className="group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-slate-400 transition-colors duration-200 hover:bg-slate-800/40 hover:text-white"
            >
              <ShieldCheck className="h-4 w-4 text-slate-400 group-hover:text-[#6f9aea]" />
              Admin
            </Link>
          ) : null}
        </nav>
      </div>

      <div className="border-t border-white/5 px-4 py-6">
        <div className="mb-4 flex min-w-0 items-center gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-sky-500 to-indigo-500 text-xs font-semibold text-white">
            {(user?.name?.[0] || user?.email?.[0] || "U").toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-white">{user?.name || "Usuario"}</p>
            <p className="truncate text-xs text-slate-500">{user?.email}</p>
          </div>
        </div>
        <form action="/api/auth/logout" method="post">
          <Button
            type="submit"
            variant="ghost"
            className="w-full justify-start gap-2 text-slate-400 shadow-none hover:bg-slate-800/40 hover:text-white"
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
    <div className="min-h-screen bg-[#080e1d] font-sans text-slate-400 antialiased">
      <aside className="fixed inset-y-0 left-0 hidden w-72 lg:block">
        <SidebarContent pathname={pathname} user={user} />
      </aside>

      <div className="lg:pl-72">
        <header className="sticky top-0 z-30 flex h-12 items-center justify-between bg-[#080e1d] px-4 lg:justify-end">
          <div className="lg:hidden">
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" aria-label="Abrir menu" className="text-slate-500 shadow-none hover:bg-transparent hover:text-white">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-72 border-0 bg-[#080e1d] p-0">
                <SidebarContent pathname={pathname} user={user} onNavigate={() => router.refresh()} />
              </SheetContent>
            </Sheet>
          </div>
          <Button asChild variant="ghost" size="icon" className="text-slate-500 shadow-none hover:bg-transparent hover:text-white">
            <Link href="/" aria-label="Voltar para a home publica">
              <House className="h-5 w-5" />
            </Link>
          </Button>
        </header>

        <main className="px-4 pb-4 pt-1 sm:px-6 lg:px-8">
          <div className="min-h-[calc(100vh-4rem)] rounded-none border-0 bg-zinc-100 text-zinc-950 lg:rounded-xl lg:border lg:border-white/5">
            <div className="px-4 py-6">{children}</div>
          </div>
        </main>
      </div>
    </div>
  )
}
