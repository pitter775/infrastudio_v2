"use client"

import { useRef, useState } from "react"
import { Camera, LoaderCircle, Save, UserCog } from "lucide-react"

import { AdminPageHeader } from "@/components/admin/page-header"
import { Button } from "@/components/ui/button"
import { UserAvatar } from "@/components/ui/user-avatar"

const MAX_AVATAR_BYTES = 500 * 1024

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = String(reader.result || "")
      const [, base64 = ""] = result.split(",")
      resolve(base64)
    }
    reader.onerror = () => reject(new Error("Nao foi possivel ler a foto selecionada."))
    reader.readAsDataURL(file)
  })
}

export function AdminProfilePage({ currentUser }) {
  const [form, setForm] = useState({
    nome: currentUser?.name || "",
    email: currentUser?.email || "",
    telefone: currentUser?.telefone || "",
    avatarUrl: currentUser?.avatarUrl || "",
    senha: "",
  })
  const [saving, setSaving] = useState(false)
  const [feedback, setFeedback] = useState(null)
  const [avatarUpload, setAvatarUpload] = useState(null)
  const inputRef = useRef(null)

  async function handleAvatarChange(event) {
    const file = event.target.files?.[0]
    if (!file) {
      return
    }

    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setFeedback("Use JPG, PNG ou WEBP na foto de perfil.")
      event.target.value = ""
      return
    }

    if (file.size > MAX_AVATAR_BYTES) {
      setFeedback("A foto de perfil deve ter no maximo 500 KB.")
      event.target.value = ""
      return
    }

    const dataBase64 = await fileToBase64(file)
    const previewUrl = URL.createObjectURL(file)

    setAvatarUpload({
      name: file.name,
      type: file.type,
      dataBase64,
      previewUrl,
    })
    setForm((current) => ({ ...current, avatarUrl: previewUrl }))
    setFeedback(null)
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setSaving(true)
    setFeedback(null)

    const response = await fetch("/api/admin/perfil", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        nome: form.nome,
        telefone: form.telefone,
        senha: form.senha,
        avatarUpload: avatarUpload
          ? {
              name: avatarUpload.name,
              type: avatarUpload.type,
              dataBase64: avatarUpload.dataBase64,
            }
          : null,
      }),
    })
    const data = await response.json().catch(() => null)

    if (!response.ok) {
      setFeedback(data?.error ?? "Nao foi possivel atualizar o perfil.")
      setSaving(false)
      return
    }

    setForm((current) => ({
      ...current,
      senha: "",
      avatarUrl: data?.user?.avatarUrl || current.avatarUrl,
    }))
    setAvatarUpload(null)
    if (inputRef.current) {
      inputRef.current.value = ""
    }
    setFeedback("Perfil atualizado com sucesso.")
    setSaving(false)
  }

  return (
    <div>
      <AdminPageHeader
        title="Perfil"
        description="Atualize seu nome, telefone e senha de acesso."
      />

      <div className="grid gap-6 xl:grid-cols-[380px_minmax(0,1fr)]">
        <div className="rounded-xl border border-white/5 bg-[#0b1120] p-5">
          <div className="mb-5 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-white">Minha conta</h2>
              <p className="mt-1 text-xs text-slate-500">Telefone opcional. Foto de perfil ate 500 KB.</p>
            </div>
            <div className="rounded-xl border border-cyan-500/15 bg-cyan-500/10 p-3 text-cyan-200">
              <UserCog className="h-5 w-5" />
            </div>
          </div>

          <div className="mb-5 flex items-center gap-4 rounded-xl border border-white/10 bg-slate-950/35 p-4">
            <UserAvatar src={form.avatarUrl} label={form.nome || form.email} className="h-16 w-16 text-sm" />
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold text-white">Foto de perfil</div>
              <div className="mt-1 text-xs text-slate-500">JPG, PNG ou WEBP com no maximo 500 KB.</div>
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={() => inputRef.current?.click()}
              className="rounded-xl border-white/10 bg-slate-950/50 text-slate-200 hover:bg-slate-900"
            >
              <Camera className="mr-1.5 h-4 w-4" />
              Enviar
            </Button>
            <input
              ref={inputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={handleAvatarChange}
            />
          </div>

          <dl className="space-y-3 text-sm">
            <div>
              <dt className="text-slate-500">Email</dt>
              <dd className="mt-1 font-medium text-white">{form.email}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Perfil</dt>
              <dd className="mt-1 font-medium capitalize text-white">{currentUser?.role === "admin" ? "Admin" : "Usuario"}</dd>
            </div>
          </dl>
        </div>

        <form onSubmit={handleSubmit} className="rounded-xl border border-white/5 bg-[#0b1120] p-5">
          <div className="space-y-4">
            <input
              value={form.nome}
              onChange={(event) => setForm((current) => ({ ...current, nome: event.target.value }))}
              placeholder="Nome completo"
              className="w-full rounded-xl border border-white/10 bg-slate-950/50 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-500"
            />

            <input
              value={form.email}
              disabled
              className="w-full rounded-xl border border-white/10 bg-slate-950/30 px-4 py-3 text-sm text-slate-400 outline-none"
            />

            <input
              value={form.telefone}
              onChange={(event) => setForm((current) => ({ ...current, telefone: event.target.value }))}
              placeholder="Telefone (opcional)"
              className="w-full rounded-xl border border-white/10 bg-slate-950/50 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-500"
            />

            <input
              type="password"
              value={form.senha}
              onChange={(event) => setForm((current) => ({ ...current, senha: event.target.value }))}
              placeholder="Nova senha (opcional)"
              className="w-full rounded-xl border border-white/10 bg-slate-950/50 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-500"
            />

            <Button
              type="submit"
              disabled={saving || !form.nome.trim()}
              className="h-10 rounded-xl border border-sky-500/20 bg-sky-500/10 px-4 text-sm text-sky-100 hover:bg-sky-500/15"
            >
              {saving ? <LoaderCircle className="mr-1.5 h-4 w-4 animate-spin" /> : <Save className="mr-1.5 h-4 w-4" />}
              Salvar perfil
            </Button>

            {feedback ? (
              <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
                {feedback}
              </div>
            ) : null}
          </div>
        </form>
      </div>
    </div>
  )
}
