"use client"

import { useMemo, useState } from "react"
import {
  BadgeCheck,
  LoaderCircle,
  Pencil,
  Plus,
  Shield,
  Trash2,
  UserRound,
  Users,
} from "lucide-react"

import { AdminPageHeader } from "@/components/admin/page-header"
import { AppSelect } from "@/components/ui/app-select"
import { Button } from "@/components/ui/button"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { cn } from "@/lib/utils"

const emptyForm = {
  nome: "",
  email: "",
  senha: "",
  ativo: true,
  papel: "viewer",
  projetoIds: [],
}

function projectName(projects, projectId) {
  return projects.find((project) => project.id === projectId)?.name ?? "Projeto"
}

export function AdminUsersPage({ initialUsers, projects, currentUser }) {
  const [users, setUsers] = useState(initialUsers)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [feedback, setFeedback] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const isAllowed = currentUser?.role === "admin"

  const stats = useMemo(
    () => ({
      total: users.length,
      admins: users.filter((user) => user.role === "admin").length,
      active: users.filter((user) => user.status === "ativo").length,
    }),
    [users]
  )

  async function refreshUsers() {
    const response = await fetch("/api/admin/usuarios", { cache: "no-store" })
    const data = await response.json()

    if (response.ok) {
      setUsers(data.users)
    }
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setSaving(true)
    setFeedback(null)

    const response = await fetch("/api/admin/usuarios", {
      method: form.id ? "PUT" : "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(form),
    })
    const payload = await response.json()

    if (!response.ok) {
      setFeedback(payload.error ?? "Nao foi possivel salvar o usuario.")
      setSaving(false)
      return
    }

    await refreshUsers()
    setForm(emptyForm)
    setFeedback(form.id ? "Usuario atualizado com sucesso." : "Usuario criado com sucesso.")
    setSaving(false)
  }

  function handleEdit(user) {
    setForm({
      id: user.id,
      nome: user.name,
      email: user.email,
      senha: "",
      ativo: user.status === "ativo",
      papel: user.role === "admin" ? "admin" : "viewer",
      projetoIds: (user.memberships ?? [])
        .map((membership) => membership.projetoId)
        .filter(Boolean),
    })
    setFeedback(null)
  }

  function toggleProject(projectId) {
    setForm((current) => {
      const exists = current.projetoIds.includes(projectId)
      const projetoIds = exists
        ? current.projetoIds.filter((id) => id !== projectId)
        : [...current.projetoIds, projectId]

      return {
        ...current,
        projetoIds,
      }
    })
  }

  async function handleToggleStatus(user) {
    const response = await fetch(`/api/admin/usuarios/${user.id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ ativo: user.status !== "ativo" }),
    })
    const payload = await response.json()

    if (!response.ok) {
      setFeedback(payload.error ?? "Nao foi possivel alterar o status.")
      return
    }

    await refreshUsers()
    setFeedback(`Status de ${user.name} atualizado.`)
  }

  async function handleDelete(user) {
    const response = await fetch(`/api/admin/usuarios/${user.id}`, {
      method: "DELETE",
    })
    const payload = await response.json()

    if (!response.ok) {
      setFeedback(payload.error ?? "Nao foi possivel excluir o usuario.")
      return
    }

    await refreshUsers()
    setFeedback("Usuario excluido com sucesso.")
    setDeleteTarget(null)
  }

  if (!isAllowed) {
    return (
      <div className="rounded-xl border border-rose-500/20 bg-rose-500/10 p-8">
        <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-rose-400/20 bg-slate-950/20 px-3 py-1 text-xs font-bold uppercase tracking-[0.2em] text-rose-200">
          <Shield className="h-3.5 w-3.5" />
          Permissao insuficiente
        </div>
        <h1 className="text-2xl font-semibold text-white">Seu perfil nao tem acesso administrativo</h1>
        <p className="mt-3 max-w-xl text-sm text-slate-300">
          Este painel libera acesso apenas para usuarios com role admin.
        </p>
      </div>
    )
  }

  return (
    <div>
      <AdminPageHeader
        title="Usuarios"
        description="Gestao de acessos usando JWT, cookie HTTP-only e tabela usuarios do Supabase."
        actions={
          <Button
            type="button"
            onClick={() => {
              setForm(emptyForm)
              setFeedback(null)
            }}
            className="h-8 rounded-lg bg-emerald-500 px-3 text-xs font-medium text-slate-950 hover:bg-emerald-400"
          >
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            Novo
          </Button>
        }
      />

      <div className="mb-6 grid gap-4 md:grid-cols-3">
        {[
          ["Total", stats.total],
          ["Admins", stats.admins],
          ["Ativos", stats.active],
        ].map(([label, value]) => (
          <div key={label} className="rounded-xl border border-white/5 bg-[#0b1120] p-4">
            <div className="text-xs uppercase tracking-[0.18em] text-slate-500">{label}</div>
            <div className="mt-2 text-2xl font-semibold text-white">{value}</div>
          </div>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-[380px_minmax(0,1fr)]">
        <form onSubmit={handleSubmit} className="rounded-xl border border-white/5 bg-[#0b1120] p-5">
          <div className="mb-5 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-white">
                {form.id ? "Editar usuario" : "Novo usuario"}
              </h2>
              <p className="mt-1 text-xs text-slate-500">
                Senha com hash bcrypt, sem Supabase Auth.
              </p>
            </div>
            <div className="rounded-xl border border-blue-500/15 bg-blue-500/10 p-3 text-blue-200">
              <UserRound className="h-5 w-5" />
            </div>
          </div>

          <div className="space-y-4">
            <input
              value={form.nome}
              onChange={(event) => setForm((current) => ({ ...current, nome: event.target.value }))}
              placeholder="Nome completo"
              className="w-full rounded-xl border border-white/10 bg-slate-950/50 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-500"
            />
            <input
              value={form.email}
              onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
              placeholder="email@dominio.com"
              className="w-full rounded-xl border border-white/10 bg-slate-950/50 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-500"
            />
            <input
              type="password"
              value={form.senha}
              onChange={(event) => setForm((current) => ({ ...current, senha: event.target.value }))}
              placeholder={form.id ? "Nova senha (opcional)" : "Senha inicial"}
              className="w-full rounded-xl border border-white/10 bg-slate-950/50 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-500"
            />

            <label className="space-y-2 block">
              <span className="text-sm font-semibold text-slate-300">Perfil</span>
              <AppSelect
                value={form.papel}
                onChangeValue={(value) => setForm((current) => ({ ...current, papel: value }))}
                options={[
                  { value: "viewer", label: "Usuario comum" },
                  { value: "admin", label: "Admin" },
                ]}
              />
            </label>

            <label className="space-y-2 block">
              <span className="text-sm font-semibold text-slate-300">Projetos</span>
              <div className="max-h-56 space-y-2 overflow-y-auto rounded-xl border border-white/10 bg-slate-950/40 p-3">
                {projects.map((project) => {
                  const checked = form.projetoIds.includes(project.id)

                  return (
                    <label
                      key={project.id}
                      className={cn(
                        "flex cursor-pointer items-center justify-between gap-3 rounded-xl border px-3 py-2 text-sm transition",
                        checked
                          ? "border-cyan-400/30 bg-cyan-400/10 text-cyan-100"
                          : "border-white/10 bg-white/[0.03] text-slate-300 hover:border-white/15 hover:bg-white/[0.06]"
                      )}
                    >
                      <span className="truncate">{project.name}</span>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleProject(project.id)}
                        className="h-4 w-4 rounded border-white/20 bg-slate-950/50 text-cyan-400"
                      />
                    </label>
                  )
                })}
              </div>
            </label>

            <label className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-slate-950/40 px-4 py-3 text-sm text-slate-300">
              <span>
                <span className="block text-sm font-semibold text-white">Usuario</span>
                <span
                  className={cn(
                    "mt-1 block text-[11px] uppercase tracking-[0.16em]",
                    form.ativo ? "text-emerald-200" : "text-slate-500"
                  )}
                >
                  {form.ativo ? "Ativo" : "Inativo"}
                </span>
              </span>
              <input
                type="checkbox"
                checked={form.ativo}
                onChange={(event) => setForm((current) => ({ ...current, ativo: event.target.checked }))}
                className="h-4 w-4"
              />
            </label>

            <div className="flex gap-3">
              <Button
                type="submit"
                disabled={saving}
                className="h-10 rounded-xl border border-sky-500/20 bg-sky-500/10 px-4 text-sm text-sky-100 hover:bg-sky-500/15"
              >
                {saving ? (
                  <LoaderCircle className="mr-1.5 h-4 w-4 animate-spin" />
                ) : form.id ? (
                  <Pencil className="mr-1.5 h-4 w-4" />
                ) : (
                  <Plus className="mr-1.5 h-4 w-4" />
                )}
                {form.id ? "Salvar" : "Criar"}
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setForm(emptyForm)
                  setFeedback(null)
                }}
                className="h-10 rounded-xl border border-white/10 bg-white/[0.03] px-4 text-sm text-slate-300"
              >
                Novo
              </Button>
            </div>

            {feedback ? (
              <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
                {feedback}
              </div>
            ) : null}
          </div>
        </form>

        <div className="overflow-hidden rounded-xl border border-white/5 bg-[#0b1120]">
          <div className="flex items-center justify-between gap-3 border-b border-white/5 px-5 py-4">
            <div>
              <h3 className="text-lg font-semibold text-white">Usuarios cadastrados</h3>
              <p className="mt-1 text-xs text-slate-500">Editar, ativar, inativar e excluir.</p>
            </div>
            <div className="hidden items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-emerald-200 sm:flex">
              <BadgeCheck className="h-3.5 w-3.5" />
              CRUD ativo
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full text-left">
              <thead className="bg-slate-950/30 text-xs uppercase tracking-[0.18em] text-slate-500">
                <tr>
                  <th className="px-5 py-4 font-semibold">Nome</th>
                  <th className="px-5 py-4 font-semibold">Email</th>
                  <th className="px-5 py-4 font-semibold">Perfil</th>
                  <th className="px-5 py-4 font-semibold">Projetos</th>
                  <th className="px-5 py-4 font-semibold">Status</th>
                  <th className="px-5 py-4 font-semibold">Acoes</th>
                </tr>
              </thead>
              <tbody>
                {users.length > 0 ? (
                  users.map((user) => (
                    <tr key={user.id} className="border-t border-white/5 text-sm text-slate-300">
                      <td className="px-5 py-4 font-semibold text-white">{user.name}</td>
                      <td className="px-5 py-4">{user.email}</td>
                      <td className="px-5 py-4">
                        <span
                          className={cn(
                            "rounded-full px-3 py-1 text-xs font-semibold",
                            user.role === "admin"
                              ? "bg-cyan-500/15 text-cyan-200"
                              : "bg-slate-800 text-slate-300"
                          )}
                        >
                          {user.role === "admin" ? "admin" : "comum"}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <div className="max-w-[220px] truncate text-xs text-slate-400">
                          {user.memberships?.length
                            ? user.memberships
                                .map((membership) =>
                                  membership.projetoNome ||
                                  projectName(projects, membership.projetoId)
                                )
                                .join(", ")
                            : "Sem projetos"}
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <button
                          type="button"
                          onClick={() => handleToggleStatus(user)}
                          className={cn(
                            "rounded-full px-3 py-1 text-xs font-semibold",
                            user.status === "ativo"
                              ? "bg-emerald-500/15 text-emerald-300"
                              : "bg-amber-500/15 text-amber-300"
                          )}
                        >
                          {user.status}
                        </button>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex gap-2">
                          <Button
                            type="button"
                            variant="ghost"
                            onClick={() => handleEdit(user)}
                            className="h-8 rounded-lg border border-amber-400/20 bg-amber-500/10 px-3 text-amber-100 hover:bg-amber-500/15"
                            title="Editar"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            onClick={() => setDeleteTarget(user)}
                            className="h-8 rounded-lg border border-rose-400/20 bg-rose-400/10 px-3 text-rose-100 hover:bg-rose-400/15"
                            title="Excluir"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr className="border-t border-white/5 text-sm text-slate-300">
                    <td colSpan={6} className="px-5 py-8 text-center text-slate-400">
                      Nenhum usuario encontrado.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => {
          if (!open) {
            setDeleteTarget(null)
          }
        }}
        title="Excluir usuario"
        description={deleteTarget ? `O usuario ${deleteTarget.name} sera removido permanentemente.` : ""}
        confirmLabel="Excluir usuario"
        danger
        onConfirm={() => deleteTarget ? handleDelete(deleteTarget) : null}
      />
    </div>
  )
}
