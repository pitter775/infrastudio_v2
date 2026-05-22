'use client'

import { CheckCircle2, Copy, Database, ExternalLink, Globe, ImageUp, Phone, RefreshCcw, Search, XCircle } from 'lucide-react'
import Image from 'next/image'

import { Button } from '@/components/ui/button'
import { AppSelect } from '@/components/ui/app-select'

import { StorePanelField, StorePanelInput, StorePanelTextarea, StorePanelToggle } from '@/components/admin/projects/mercado-livre-store-panel-fields'

const HERO_BACKGROUND_OPTIONS = [
  { value: 'solid', label: 'Cor sólida' },
  { value: 'gradient', label: 'Gradiente' },
  { value: 'image', label: 'Imagem' },
]

const HERO_IMAGE_MODE_OPTIONS = [
  { value: 'cover', label: 'Cobrir hero' },
  { value: 'repeat-x', label: 'Infinito lateral' },
]

const DOMAIN_STATUS_OPTIONS = [
  { value: 'pending', label: 'Pendente' },
  { value: 'configuring', label: 'Configurando DNS' },
  { value: 'active', label: 'Ativo' },
]

function normalizeStoreSlugInput(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+/g, '')
    .slice(0, 80)
}

export function StoreGeneralSection({
  draft,
  setDraft,
  project,
  publicUrl,
  publicUrlCopied,
  slugAvailability,
  snapshotTotal = 0,
  onCopyPublicUrl,
  onOpenDomainSettings,
}) {
  const normalizedSlug = String(slugAvailability?.slug || draft.slug || '').trim()
  const slugStatus = slugAvailability?.status || 'idle'
  const isSlugAvailable = slugStatus === 'available'
  const isSlugUnavailable = ['unavailable', 'invalid', 'error'].includes(slugStatus)
  const customDomain = String(draft.customDomain || '').trim()
  const customDomainUrl = customDomain
    ? customDomain.startsWith('http://') || customDomain.startsWith('https://')
      ? customDomain
      : `https://${customDomain}`
    : ''

  return (
    <div className="grid gap-4 md:grid-cols-2 md:items-start">
      <div className="md:col-span-2 rounded-2xl border border-white/10 bg-white/[0.025] p-3 text-sm text-slate-300 sm:p-4">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className={`rounded-full px-3 py-1 ${draft.active ? 'bg-emerald-500/10 text-emerald-100' : 'bg-amber-500/10 text-amber-100'}`}>
            {draft.active ? 'Loja pública ativa' : 'Loja pública desativada'}
          </span>
          <span className="rounded-full bg-white/[0.03] px-3 py-1 text-slate-300">
            {snapshotTotal > 0 ? `${snapshotTotal} produtos no snapshot` : 'Snapshot ainda vazio'}
          </span>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span>Link Infrastudio:</span>
          <a href={publicUrl} target="_blank" rel="noreferrer" className="break-all text-sky-200 underline-offset-4 hover:underline">
            {publicUrl}
          </a>
        </div>
        {customDomainUrl ? (
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span>Domínio próprio:</span>
            <a href={customDomainUrl} target="_blank" rel="noreferrer" className="break-all text-emerald-200 underline-offset-4 hover:underline">
              {customDomainUrl}
            </a>
          </div>
        ) : null}
        <div className="mt-3 flex flex-wrap gap-2">
          <a
            href={publicUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-9 items-center gap-2 rounded-xl bg-sky-500/10 px-3 text-sm font-medium text-sky-100"
          >
            <ExternalLink className="h-4 w-4" />
            Abrir loja
          </a>
          <button
            type="button"
            onClick={onCopyPublicUrl}
            className="inline-flex h-9 items-center gap-2 rounded-xl bg-white/[0.03] px-3 text-sm font-medium text-slate-100"
          >
            <Copy className="h-4 w-4" />
            {publicUrlCopied ? 'Link copiado' : 'Copiar link'}
          </button>
          <button
            type="button"
            onClick={onOpenDomainSettings}
            className="inline-flex h-9 items-center gap-2 rounded-xl bg-white/[0.03] px-3 text-sm font-medium text-slate-100 transition hover:bg-white/[0.06]"
          >
            <Globe className="h-4 w-4" />
            Configurar domínio próprio
          </button>
        </div>
        <div className="mt-2 text-xs leading-5 text-slate-400">
          A loja fica ativa por padrão ao salvar. Se desligar manualmente, o link público volta a responder `404`.
        </div>
      </div>
      <StorePanelField label="Slug da loja">
        <div className="grid gap-2">
          <div className="relative">
            <input
              type="text"
              value={draft.slug}
              onChange={(event) => setDraft((current) => ({ ...current, slug: normalizeStoreSlugInput(event.target.value) }))}
              placeholder="minha-loja-ml"
              className={`h-11 w-full rounded-xl border bg-[#080e1d] px-3 pr-10 text-sm text-white outline-none transition focus:border-sky-400/30 ${
                isSlugAvailable
                  ? 'border-emerald-400/40'
                  : isSlugUnavailable
                    ? 'border-rose-400/40'
                    : 'border-white/10'
              }`}
            />
            {isSlugAvailable ? <CheckCircle2 className="absolute right-3 top-3 h-5 w-5 text-emerald-300" /> : null}
            {isSlugUnavailable ? <XCircle className="absolute right-3 top-3 h-5 w-5 text-rose-300" /> : null}
          </div>
          <div className={`min-h-4 text-xs ${isSlugAvailable ? 'text-emerald-200' : isSlugUnavailable ? 'text-rose-200' : 'text-slate-400'}`}>
            {slugStatus === 'checking'
              ? 'Verificando disponibilidade...'
              : isSlugAvailable
                ? `Disponível: /loja/${normalizedSlug}`
                : slugAvailability?.error || 'Use letras, números e hifens.'}
          </div>
        </div>
      </StorePanelField>
      <StorePanelField label="Nome da loja">
        <div className="grid gap-2">
          <input
            type="text"
            value={draft.name}
            onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))}
            placeholder="Nome da loja"
            className="h-11 rounded-xl border border-white/10 bg-[#080e1d] px-3 text-sm text-white outline-none transition focus:border-sky-400/30"
          />
          <div className="min-h-4" />
        </div>
      </StorePanelField>
      <StorePanelInput
        label="Titulo"
        value={draft.title}
        onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))}
        placeholder="Compre com atendimento direto"
      />
      <StorePanelToggle
        checked={draft.active}
        onChange={(value) => setDraft((current) => ({ ...current, active: value }))}
        labelOn="Ligada"
        labelOff="Desligada"
      >
        Loja pública
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
      <div className="md:col-span-2 px-1 py-2">
        <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-white">
          <Phone className="h-4 w-4 text-sky-300" />
          Contato da loja
        </div>
        <StoreContactSection draft={draft} setDraft={setDraft} />
      </div>
    </div>
  )
}

function updateHeroConfig(setDraft, patch) {
  setDraft((current) => ({
    ...current,
    visualConfig: {
      ...(current.visualConfig || {}),
      hero: {
        ...(current.visualConfig?.hero || {}),
        ...patch,
      },
    },
  }))
}

function StoreAssetUpload({ accept = 'image/avif,image/png,image/jpeg,image/svg+xml,image/webp,.svg', disabled, label, onChange }) {
  return (
    <label className="inline-flex h-10 cursor-pointer items-center justify-center gap-2 rounded-xl bg-white/[0.04] px-4 text-sm font-medium text-slate-100 transition hover:bg-white/[0.07]">
      <ImageUp className="h-4 w-4" />
      {disabled ? 'Enviando...' : label}
      <input
        type="file"
        accept={accept}
        disabled={disabled}
        onChange={(event) => {
          const file = event.target.files?.[0]
          event.target.value = ''
          if (file) onChange(file)
        }}
        className="sr-only"
      />
    </label>
  )
}

export function StoreAppearanceSection({ assetUploading = null, draft, setDraft, onAssetUpload }) {
  const hero = draft.visualConfig?.hero || {}
  const heroBackgroundMode = hero.backgroundMode || 'solid'
  const heroImageMode = hero.imageMode || 'cover'

  return (
    <div className="grid gap-4 md:grid-cols-2 md:items-start">
      <StorePanelField label="Cor predominante">
        <div className="grid gap-3">
          <div className="flex items-center gap-3 px-1 py-2">
            <input
              type="color"
              value={draft.accentColor}
              onChange={(event) => setDraft((current) => ({ ...current, accentColor: event.target.value }))}
              className="h-8 w-10 cursor-pointer rounded border-0 bg-transparent p-0"
            />
            <span className="text-sm text-slate-300">{draft.accentColor}</span>
          </div>
        </div>
      </StorePanelField>
      <StorePanelField label="Upload do logo">
        <div className="grid gap-3 px-1 py-2">
          <StoreAssetUpload
            disabled={assetUploading === 'logo'}
            label="Enviar logo"
            onChange={(file) => onAssetUpload?.('logo', file)}
          />
          {draft.logoUrl ? (
            <div className="flex items-center gap-3">
              <Image src={draft.logoUrl} alt="Preview do logo" width={48} height={48} unoptimized className="h-12 w-12 rounded-xl object-cover" />
              <span className="text-xs text-slate-400">Preview do logo atualizado</span>
            </div>
          ) : null}
        </div>
      </StorePanelField>
      <StorePanelToggle
        checked={draft.chatWidgetActive}
        onChange={(value) => setDraft((current) => ({ ...current, chatWidgetActive: value }))}
        labelOn="Ligado"
        labelOff="Desligado"
      >
        Chat widget na loja
      </StorePanelToggle>
      <StorePanelToggle
        checked={draft.chatContextFull}
        onChange={(value) => setDraft((current) => ({ ...current, chatContextFull: value }))}
        labelOn="Ligado"
        labelOff="Desligado"
      >
        Contexto completo no chat do produto
      </StorePanelToggle>
      <div className="md:col-span-2 px-1 py-2 text-xs leading-6 text-slate-400">
        Quando ligar, a página de detalhe do produto envia a descrição longa completa e uma ficha mais ampla do anuncio para o agente. Desligado, o chat continua no modo resumido atual.
      </div>
      <div className="md:col-span-2 rounded-2xl border border-white/10 bg-white/[0.025] p-3 sm:p-4">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-2 border-b border-white/10 pb-3">
          <div className="text-sm font-semibold text-white">Hero da loja</div>
          <div className="text-xs text-slate-500">Fundo, imagem e leitura do texto</div>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          <StorePanelField label="Tipo de fundo">
            <AppSelect
              value={heroBackgroundMode}
              onChangeValue={(value) => updateHeroConfig(setDraft, { backgroundMode: value || 'solid' })}
              options={HERO_BACKGROUND_OPTIONS}
              minHeight={44}
              placeholder="Tipo de fundo"
            />
          </StorePanelField>
          <StorePanelField label="Cor sólida">
            <input
              type="color"
              value={hero.solidColor || '#ffffff'}
              onChange={(event) => updateHeroConfig(setDraft, { solidColor: event.target.value })}
              className="h-11 w-full cursor-pointer rounded-xl border border-white/10 bg-[#080e1d] px-3 py-2"
            />
          </StorePanelField>
          <StorePanelField label="Modo da imagem">
            <AppSelect
              value={heroImageMode}
              onChangeValue={(value) => updateHeroConfig(setDraft, { imageMode: value || 'cover' })}
              options={HERO_IMAGE_MODE_OPTIONS}
              minHeight={44}
              placeholder="Modo da imagem"
            />
          </StorePanelField>
          <StorePanelField label="Gradiente inicio">
            <input
              type="color"
              value={hero.gradientFrom || '#ffffff'}
              onChange={(event) => updateHeroConfig(setDraft, { gradientFrom: event.target.value })}
              className="h-11 w-full cursor-pointer rounded-xl border border-white/10 bg-[#080e1d] px-3 py-2"
            />
          </StorePanelField>
          <StorePanelField label="Gradiente fim">
            <input
              type="color"
              value={hero.gradientTo || '#f5f5f5'}
              onChange={(event) => updateHeroConfig(setDraft, { gradientTo: event.target.value })}
              className="h-11 w-full cursor-pointer rounded-xl border border-white/10 bg-[#080e1d] px-3 py-2"
            />
          </StorePanelField>
          <StorePanelField label="Upload do fundo">
            <StoreAssetUpload
              disabled={assetUploading === 'hero'}
              label="Enviar fundo"
              onChange={(file) => onAssetUpload?.('hero', file)}
            />
          </StorePanelField>
          <div className="md:col-span-3">
            <StorePanelInput
              label="Imagem do hero URL"
              value={hero.imageUrl || ''}
              onChange={(event) => updateHeroConfig(setDraft, { imageUrl: event.target.value, imageStoragePath: '' })}
              placeholder="https://..."
            />
          </div>
          <StorePanelField label={`Transparencia da imagem ${Math.round(Number(hero.imageOpacity ?? 1) * 100)}%`}>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={Number(hero.imageOpacity ?? 1)}
              onChange={(event) => updateHeroConfig(setDraft, { imageOpacity: Number(event.target.value) })}
              className="h-11 w-full"
            />
          </StorePanelField>
          <StorePanelField label={`Overlay ${Math.round(Number(hero.overlayOpacity ?? 0.18) * 100)}%`}>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={Number(hero.overlayOpacity ?? 0.18)}
              onChange={(event) => updateHeroConfig(setDraft, { overlayOpacity: Number(event.target.value) })}
              className="h-11 w-full"
            />
          </StorePanelField>
        </div>
        <div className="mt-4 overflow-hidden rounded-2xl border border-white/10 bg-[#080e1d]">
          <div
            className="relative min-h-[150px]"
            style={{
              background:
                heroBackgroundMode === 'gradient'
                  ? `linear-gradient(120deg, ${hero.gradientFrom || '#ffffff'}, ${hero.gradientTo || '#f5f5f5'})`
                  : hero.solidColor || '#ffffff',
            }}
          >
            {hero.imageUrl ? (
              <div
                className="absolute inset-0"
                style={{
                  backgroundImage: `url(${hero.imageUrl})`,
                  backgroundPosition: 'center',
                  backgroundRepeat: heroImageMode === 'repeat-x' ? 'repeat-x' : 'no-repeat',
                  backgroundSize: heroImageMode === 'repeat-x' ? 'auto 100%' : 'cover',
                  opacity: Number(hero.imageOpacity ?? 1),
                }}
              />
            ) : null}
            <div
              className="absolute inset-0"
              style={{
                backgroundColor: hero.overlayColor || '#ffffff',
                opacity: Number(hero.overlayOpacity ?? 0.18),
              }}
            />
          </div>
        </div>
      </div>
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
  setDraft,
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
  const useLatestProducts = draft.visualConfig?.catalog?.useLatestProducts !== false

  return (
    <div className="grid gap-4">
      <div className="grid gap-3 px-1 py-2 md:grid-cols-[minmax(0,1fr)_auto]">
        <div className="grid gap-3">
          <div className="inline-flex items-center gap-2 text-sm font-semibold text-white">
            <Database className="h-4 w-4 text-sky-300" />
            Snapshot da loja
          </div>
          <div className="flex flex-wrap gap-3 text-xs text-slate-400">
            <span className="rounded-full bg-white/[0.03] px-3 py-1">
              {snapshotLoading ? 'Carregando...' : `${Number(snapshot?.total || 0)} produtos`}
            </span>
            <span className="rounded-full bg-white/[0.03] px-3 py-1">
              Ultima sync: {snapshot?.lastSyncAt ? new Date(snapshot.lastSyncAt).toLocaleString('pt-BR') : 'nunca'}
            </span>
            <span className="rounded-full bg-white/[0.03] px-3 py-1">
              {isSnapshotEmpty ? 'Pronto para primeira sync' : 'Snapshot ativo'}
            </span>
          </div>
          {isSnapshotEmpty ? (
            <div className="rounded-xl border border-amber-400/20 bg-amber-500/10 px-3 py-3 text-xs leading-6 text-amber-100">
              A vitrine pública usa apenas o snapshot local. Sincronize agora para trazer os produtos da conta conectada.
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
        <div className="grid gap-3 px-1 py-2">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="text-sm font-semibold text-white">Ultimos produtos do snapshot</div>
              <div className="mt-1 text-xs leading-5 text-slate-400">
                Quando ativado, a home usa os ultimos produtos adicionados no Mercado Livre no bloco principal.
              </div>
            </div>
            <StorePanelToggle
              checked={useLatestProducts}
              onChange={(value) =>
                setDraft((current) => ({
                  ...current,
                  visualConfig: {
                    ...(current.visualConfig || {}),
                    catalog: {
                      ...(current.visualConfig?.catalog || {}),
                      useLatestProducts: value,
                    },
                  },
                }))
              }
              labelOn="Ligado"
              labelOff="Desligado"
            >
              Usar ultimos adicionados
            </StorePanelToggle>
          </div>
          <div className="grid gap-2">
            {latestProducts.map((item) => (
              <div key={item.ml_item_id || item.slug} className="flex items-center justify-between gap-4 rounded-xl bg-white/[0.025] px-3 py-3">
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

      <div className="grid gap-3 px-1 py-2 md:grid-cols-[minmax(0,1fr)_auto]">
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
            <div key={item.id} className="rounded-2xl bg-white/[0.025] p-4">
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
                className="mt-4 h-9 rounded-xl bg-white/[0.04] px-4 text-xs text-slate-100"
              >
                Adicionar no rotativo
              </Button>
            </div>
          ))}
        </div>
      ) : isSnapshotEmpty ? (
        <div className="px-1 py-4 text-sm text-slate-400">
          Depois da primeira sync, a busca vai listar os produtos locais para escolher o rotativo.
        </div>
      ) : null}

      <div className="grid gap-3">
        <div className="text-sm font-semibold text-white">Produtos em destaque</div>
        {draft.featuredProducts.length ? (
          <div className="grid gap-3 md:grid-cols-2">
            {draft.featuredProducts.map((item) => (
              <div key={item.id} className="rounded-2xl bg-white/[0.025] p-4">
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
          <div className="px-1 py-4 text-sm text-slate-400">
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
    <div className="grid gap-4 md:grid-cols-2 md:items-start">
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
    <div className="grid gap-3">
      {draft.menuLinks.map((item, index) => (
        <div key={`${index}-${item.label}`} className="grid gap-3 rounded-2xl border border-white/10 bg-white/[0.025] p-3 md:grid-cols-2 md:items-start">
          <StorePanelInput label={`Label ${index + 1}`} value={item.label} onChange={(event) => onUpdateMenuLink(index, 'label', event.target.value)} placeholder="Produtos" />
          <StorePanelInput label={`Destino ${index + 1}`} value={item.href} onChange={(event) => onUpdateMenuLink(index, 'href', event.target.value)} placeholder="#produtos" />
        </div>
      ))}
    </div>
  )
}

export function StoreDomainSection({ draft, setDraft, publicUrl, domainAutomation = null, domainChecking = false, onVerifyNow }) {
  const hasCustomDomain = Boolean(String(draft.customDomain || '').trim())
  const domainPreview = hasCustomDomain ? `https://${draft.customDomain}` : ''
  const domainStatus = String(draft.customDomainStatus || 'pending').trim()
  const summary = domainAutomation?.summary || null
  const verificationRecords = Array.isArray(domainAutomation?.summary?.verificationRecords)
    ? domainAutomation.summary.verificationRecords
    : []
  const managedDomains = Array.isArray(domainAutomation?.summary?.domains)
    ? domainAutomation.summary.domains
    : []
  const dnsReady = summary?.dns?.ready === true
  const vercelVerified = summary?.vercelVerified === true || managedDomains.length > 0 && managedDomains.every((item) => item.verified)
  const effectiveDomainStatus = domainStatus === 'active' && summary && !dnsReady ? 'configuring' : domainStatus
  const statusLabel = effectiveDomainStatus === 'active'
    ? 'Domínio ativo'
    : effectiveDomainStatus === 'configuring'
      ? 'Aguardando DNS do cliente'
      : 'Domínio pendente'
  const statusDescription = effectiveDomainStatus === 'active'
    ? 'Liberado. Se ainda não abrir, aguarde a propagação do Registro.br.'
    : hasCustomDomain
      ? 'Configure os registros abaixo e use Verificar DNS após a propagação.'
      : 'Informe o domínio para preparar a automação.'
  const StatusIcon = effectiveDomainStatus === 'active' ? CheckCircle2 : XCircle

  return (
    <div className="grid gap-4">
      <div className="grid gap-3 rounded-2xl border border-white/10 bg-white/[0.025] p-3 text-sm text-slate-300 sm:p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="inline-flex items-center gap-2 text-sm font-semibold text-white">
              <Globe className="h-4 w-4 text-sky-300" />
              Domínio próprio da loja
            </div>
            <p className="mt-1 text-xs leading-5 text-slate-400">
              No Registro.br, abra <span className="text-slate-200">DNS</span>, crie os registros e depois verifique aqui.
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={!hasCustomDomain || domainChecking}
            onClick={onVerifyNow}
            className="h-8 gap-2 rounded-lg px-2.5 text-xs"
          >
            <RefreshCcw className={`h-3.5 w-3.5 ${domainChecking ? 'animate-spin' : ''}`} />
            {domainChecking ? 'Verificando' : 'Verificar DNS'}
          </Button>
        </div>

        <div className="grid gap-2 text-xs text-slate-400 md:grid-cols-2">
          <div className="rounded-xl bg-slate-950/35 px-3 py-2">
            <div className="font-semibold text-slate-200">A</div>
            <div className="mt-1 break-all">Nome: {String(draft.customDomain || '').trim() || 'seudominio.com.br'}</div>
            <div>Valor: 76.76.21.21</div>
          </div>
          <div className="rounded-xl bg-slate-950/35 px-3 py-2">
            <div className="font-semibold text-slate-200">CNAME</div>
            <div className="mt-1">Nome: www</div>
            <div className="break-all">Valor: cname.vercel-dns.com</div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
          <span className="rounded-full bg-white/[0.04] px-2.5 py-1">Padrão: {publicUrl}</span>
          {domainPreview ? (
            <a href={domainPreview} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-full bg-sky-500/10 px-2.5 py-1 text-sky-200 transition hover:bg-sky-500/15">
              <ExternalLink className="h-3.5 w-3.5" />
              {domainPreview}
            </a>
          ) : null}
        </div>

        <div className={`rounded-xl border px-3 py-2 text-xs ${effectiveDomainStatus === 'active' ? 'border-emerald-400/20 bg-emerald-500/10 text-emerald-100' : 'border-amber-400/20 bg-amber-500/10 text-amber-100'}`}>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="inline-flex items-center gap-1.5 font-semibold">
              <StatusIcon className="h-3.5 w-3.5" />
              {statusLabel}
            </span>
            <span className="text-slate-300">{statusDescription}</span>
          </div>
          {hasCustomDomain ? (
            <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-slate-300">
              <span className="rounded-full bg-black/10 px-2 py-0.5">Vercel: {vercelVerified ? 'validado' : 'aguardando'}</span>
              <span className="rounded-full bg-black/10 px-2 py-0.5">DNS: {dnsReady ? 'ok' : 'propagando'}</span>
              {managedDomains.length ? (
                <span className="rounded-full bg-black/10 px-2 py-0.5">
                  {managedDomains.every((item) => item.verified) ? 'domínios verificados' : 'aguardando propagação'}
                </span>
              ) : null}
            </div>
          ) : null}
          {summary?.configured === false ? (
            <div className="mt-2 text-amber-100">Automação da Vercel ainda não configurada no ambiente.</div>
          ) : null}
        </div>
        {verificationRecords.length ? (
          <div className="grid gap-1 rounded-xl border border-amber-400/20 bg-amber-500/10 p-3 text-xs text-amber-50">
            <div className="font-semibold">Verificação adicional da Vercel:</div>
            {verificationRecords.map((record) => (
              <div key={`${record.type}-${record.domain}-${record.value}`} className="break-all">
                {record.type} {record.domain}: {record.value}
              </div>
            ))}
          </div>
        ) : null}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="grid gap-2">
          <StorePanelInput
            label="Domínio personalizado"
            value={draft.customDomain}
            onChange={(event) => setDraft((current) => ({ ...current, customDomain: event.target.value }))}
            placeholder="www.sualoja.com.br"
          />
        </div>

        <StorePanelField label="Status do domínio">
          <AppSelect
            value={draft.customDomainStatus}
            onChangeValue={(value) => setDraft((current) => ({ ...current, customDomainStatus: value || 'pending' }))}
            options={DOMAIN_STATUS_OPTIONS}
            minHeight={44}
            placeholder="Status do domínio"
          />
        </StorePanelField>
      </div>

      <StorePanelToggle
        checked={draft.customDomainActive}
        onChange={(value) => setDraft((current) => ({ ...current, customDomainActive: value }))}
        labelOn="Ligado"
        labelOff="Desligado"
      >
        Domínio próprio nesta loja
      </StorePanelToggle>

      <StorePanelTextarea
        label="Observações de domínio"
        value={draft.customDomainNotes}
        onChange={(event) => setDraft((current) => ({ ...current, customDomainNotes: event.target.value }))}
        className="min-h-[110px]"
      />
    </div>
  )
}
