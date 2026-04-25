'use client'

import { Copy, Database, ExternalLink, RefreshCcw, Search } from 'lucide-react'

import { Button } from '@/components/ui/button'

import { StorePanelField, StorePanelInput, StorePanelTextarea, StorePanelToggle } from '@/components/admin/projects/mercado-livre-store-panel-fields'

export function StoreGeneralSection({ draft, setDraft, project, publicUrl, publicUrlCopied, snapshotTotal = 0, onCopyPublicUrl }) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div className="md:col-span-2 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-4 text-sm text-slate-300">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className={`rounded-full border px-3 py-1 ${draft.active ? 'border-emerald-400/20 bg-emerald-500/10 text-emerald-100' : 'border-amber-400/20 bg-amber-500/10 text-amber-100'}`}>
            {draft.active ? 'Loja publica ativa' : 'Loja publica desativada'}
          </span>
          <span className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-slate-300">
            {snapshotTotal > 0 ? `${snapshotTotal} produtos no snapshot` : 'Snapshot ainda vazio'}
          </span>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <span>Link publico:</span>
          <a href={publicUrl} target="_blank" rel="noreferrer" className="break-all text-sky-200 underline-offset-4 hover:underline">
            {publicUrl}
          </a>
        </div>
        <div className="mt-4 flex flex-wrap gap-3">
          <a
            href={publicUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-10 items-center gap-2 rounded-xl border border-sky-500/20 bg-sky-500/10 px-4 text-sm font-medium text-sky-100"
          >
            <ExternalLink className="h-4 w-4" />
            Abrir loja
          </a>
          <button
            type="button"
            onClick={onCopyPublicUrl}
            className="inline-flex h-10 items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-4 text-sm font-medium text-slate-100"
          >
            <Copy className="h-4 w-4" />
            {publicUrlCopied ? 'Link copiado' : 'Copiar link'}
          </button>
        </div>
        <div className="mt-2 text-xs text-slate-400">
          A loja so abre sem `404` depois de marcar `Ativar landing publica da loja` e salvar. O link acima ja usa o slug normalizado.
        </div>
      </div>
      <StorePanelInput
        label="Slug da loja"
        value={draft.slug}
        onChange={(event) => setDraft((current) => ({ ...current, slug: event.target.value }))}
        placeholder="minha-loja-ml"
      />
      <StorePanelInput
        label="Nome da loja"
        value={draft.name}
        onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))}
        placeholder="Nome da loja"
      />
      <StorePanelInput
        label="Titulo"
        value={draft.title}
        onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))}
        placeholder="Compre com atendimento direto"
      />
      <StorePanelToggle
        checked={draft.active}
        onChange={(event) => setDraft((current) => ({ ...current, active: event.target.checked }))}
      >
        Ativar landing publica da loja
      </StorePanelToggle>
      <div className="md:col-span-2">
        <StorePanelTextarea
          label="Texto principal"
          value={draft.headline}
          onChange={(event) => setDraft((current) => ({ ...current, headline: event.target.value }))}
        />
      </div>
      <div className="md:col-span-2">
        <StorePanelTextarea
          label="Sobre nos"
          value={draft.about}
          onChange={(event) => setDraft((current) => ({ ...current, about: event.target.value }))}
          className="min-h-[160px]"
        />
      </div>
    </div>
  )
}

export function StoreAppearanceSection({ draft, setDraft, widgetOptions }) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <StorePanelInput
        label="Cor predominante"
        value={draft.accentColor}
        onChange={(event) => setDraft((current) => ({ ...current, accentColor: event.target.value }))}
        placeholder="#0ea5e9"
      />
      <StorePanelInput
        label="Logo URL"
        value={draft.logoUrl}
        onChange={(event) => setDraft((current) => ({ ...current, logoUrl: event.target.value }))}
        placeholder="https://..."
      />
      <StorePanelToggle
        checked={draft.chatWidgetActive}
        onChange={(event) => setDraft((current) => ({ ...current, chatWidgetActive: event.target.checked }))}
      >
        Exibir chat widget na loja
      </StorePanelToggle>
      <StorePanelField label="Widget vinculado">
        <select
          value={draft.chatWidgetId}
          onChange={(event) => setDraft((current) => ({ ...current, chatWidgetId: event.target.value }))}
          className="h-11 rounded-xl border border-white/10 bg-[#080e1d] px-3 text-sm text-white outline-none transition focus:border-sky-400/30"
        >
          <option value="">Widget padrao do projeto</option>
          {widgetOptions.map((widget) => (
            <option key={widget.id} value={widget.id}>
              {widget.label}
            </option>
          ))}
        </select>
      </StorePanelField>
      <div className="md:col-span-2">
        <StorePanelTextarea
          label="Texto do footer"
          value={draft.footerText}
          onChange={(event) => setDraft((current) => ({ ...current, footerText: event.target.value }))}
          className="min-h-[96px]"
        />
      </div>
    </div>
  )
}

export function StoreFeaturedSection({
  catalogItems,
  catalogLoading,
  catalogQuery,
  draft,
  snapshot,
  snapshotLoading,
  snapshotSyncing,
  onAddFeaturedProduct,
  onCatalogQueryChange,
  onCatalogSearch,
  onRemoveFeaturedProduct,
  onSnapshotSync,
}) {
  const latestProducts = Array.isArray(snapshot?.latestProducts) ? snapshot.latestProducts : []
  const isSnapshotEmpty = !snapshotLoading && Number(snapshot?.total || 0) === 0

  return (
    <div className="grid gap-4">
      <div className="grid gap-3 rounded-2xl border border-white/10 bg-[#0a1020] p-4 md:grid-cols-[minmax(0,1fr)_auto]">
        <div className="grid gap-3">
          <div className="inline-flex items-center gap-2 text-sm font-semibold text-white">
            <Database className="h-4 w-4 text-sky-300" />
            Snapshot da loja
          </div>
          <div className="flex flex-wrap gap-3 text-xs text-slate-400">
            <span className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1">
              {snapshotLoading ? 'Carregando...' : `${Number(snapshot?.total || 0)} produtos`}
            </span>
            <span className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1">
              Ultima sync: {snapshot?.lastSyncAt ? new Date(snapshot.lastSyncAt).toLocaleString('pt-BR') : 'nunca'}
            </span>
            <span className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1">
              {isSnapshotEmpty ? 'Pronto para primeira sync' : 'Snapshot ativo'}
            </span>
          </div>
          {isSnapshotEmpty ? (
            <div className="rounded-xl border border-amber-400/20 bg-amber-500/10 px-3 py-3 text-xs leading-6 text-amber-100">
              A vitrine publica usa apenas o snapshot local. Sincronize agora para trazer os produtos da conta conectada.
            </div>
          ) : null}
        </div>
        <div className="flex items-center">
          <Button
            type="button"
            variant="ghost"
            onClick={onSnapshotSync}
            disabled={snapshotSyncing}
            className="h-11 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 text-sm text-emerald-100"
          >
            <RefreshCcw className={`mr-2 h-4 w-4 ${snapshotSyncing ? 'animate-spin' : ''}`} />
            {snapshotSyncing ? 'Sincronizando...' : isSnapshotEmpty ? 'Fazer primeira sync' : 'Sincronizar snapshot'}
          </Button>
        </div>
      </div>

      {latestProducts.length ? (
        <div className="grid gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          <div className="text-sm font-semibold text-white">Ultimos produtos do snapshot</div>
          <div className="grid gap-2">
            {latestProducts.map((item) => (
              <div key={item.ml_item_id || item.slug} className="flex items-center justify-between gap-4 rounded-xl border border-white/10 bg-[#0a1020] px-3 py-3">
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium text-white">{item.titulo}</div>
                  <div className="mt-1 text-xs text-slate-400">{item.slug}</div>
                </div>
                <div className="text-xs text-slate-500">{item.updated_at ? new Date(item.updated_at).toLocaleDateString('pt-BR') : ''}</div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <div className="grid gap-3 rounded-2xl border border-white/10 bg-[#0a1020] p-4 md:grid-cols-[minmax(0,1fr)_auto]">
        <StorePanelInput label="Buscar produto" value={catalogQuery} onChange={onCatalogQueryChange} placeholder="Digite o nome do produto" />
        <div className="flex items-end">
          <Button type="button" variant="ghost" onClick={onCatalogSearch} disabled={catalogLoading} className="h-11 rounded-xl border border-sky-500/20 bg-sky-500/10 px-4 text-sm text-sky-100">
            <Search className="mr-2 h-4 w-4" />
            {catalogLoading ? 'Buscando...' : 'Buscar'}
          </Button>
        </div>
      </div>

      {catalogItems.length ? (
        <div className="grid gap-3 md:grid-cols-2">
          {catalogItems.map((item) => (
            <div key={item.id} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <div className="text-sm font-semibold text-white">{item.title}</div>
              <div className="mt-2 text-sm text-slate-400">
                {Number(item.price || 0).toLocaleString('pt-BR', {
                  style: 'currency',
                  currency: item.currencyId || 'BRL',
                })}
              </div>
              <Button
                type="button"
                variant="ghost"
                onClick={() => onAddFeaturedProduct(item)}
                className="mt-4 h-9 rounded-xl border border-white/10 bg-white/[0.03] px-4 text-xs text-slate-100"
              >
                Adicionar no rotativo
              </Button>
            </div>
          ))}
        </div>
      ) : isSnapshotEmpty ? (
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-5 text-sm text-slate-400">
          Depois da primeira sync, a busca vai listar os produtos locais para escolher o rotativo.
        </div>
      ) : null}

      <div className="grid gap-3">
        <div className="text-sm font-semibold text-white">Produtos em destaque</div>
        {draft.featuredProducts.length ? (
          <div className="grid gap-3 md:grid-cols-2">
            {draft.featuredProducts.map((item) => (
              <div key={item.id} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <div className="text-sm font-semibold text-white">{item.title}</div>
                <div className="mt-2 text-xs text-slate-400">{item.id}</div>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => onRemoveFeaturedProduct(item.id)}
                  className="mt-4 h-9 rounded-xl border border-rose-400/20 bg-rose-500/10 px-4 text-xs text-rose-100"
                >
                  Remover
                </Button>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-5 text-sm text-slate-400">
            Escolha os produtos que vao aparecer no rotativo da hero depois da sync do snapshot.
          </div>
        )}
      </div>
    </div>
  )
}

export function StoreContactSection({ draft, setDraft }) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <StorePanelInput
        label="Email"
        value={draft.contactEmail}
        onChange={(event) => setDraft((current) => ({ ...current, contactEmail: event.target.value }))}
        placeholder="contato@loja.com"
      />
      <StorePanelInput
        label="Telefone"
        value={draft.contactPhone}
        onChange={(event) => setDraft((current) => ({ ...current, contactPhone: event.target.value }))}
        placeholder="(11) 3333-3333"
      />
      <StorePanelInput
        label="WhatsApp"
        value={draft.contactWhatsApp}
        onChange={(event) => setDraft((current) => ({ ...current, contactWhatsApp: event.target.value }))}
        placeholder="(11) 99999-9999"
      />
      <StorePanelInput
        label="Endereco"
        value={draft.contactAddress}
        onChange={(event) => setDraft((current) => ({ ...current, contactAddress: event.target.value }))}
        placeholder="Cidade, estado ou endereco"
      />
    </div>
  )
}

export function StoreSocialSection({ draft, setDraft }) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {['instagram', 'facebook', 'tiktok', 'youtube', 'x'].map((key) => (
        <StorePanelInput
          key={key}
          label={key}
          value={draft.socialLinks[key] || ''}
          onChange={(event) =>
            setDraft((current) => ({
              ...current,
              socialLinks: {
                ...current.socialLinks,
                [key]: event.target.value,
              },
            }))
          }
          placeholder={`https://${key}.com/...`}
        />
      ))}
    </div>
  )
}

export function StoreMenuSection({ draft, onUpdateMenuLink }) {
  return (
    <div className="grid gap-4">
      {draft.menuLinks.map((item, index) => (
        <div key={`${index}-${item.label}`} className="grid gap-4 rounded-2xl border border-white/10 bg-[#0a1020] p-4 md:grid-cols-2">
          <StorePanelInput label={`Label ${index + 1}`} value={item.label} onChange={(event) => onUpdateMenuLink(index, 'label', event.target.value)} placeholder="Produtos" />
          <StorePanelInput label={`Destino ${index + 1}`} value={item.href} onChange={(event) => onUpdateMenuLink(index, 'href', event.target.value)} placeholder="#produtos" />
        </div>
      ))}
    </div>
  )
}
