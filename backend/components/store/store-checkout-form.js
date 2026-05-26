'use client'

import Image from 'next/image'
import { useMemo, useState } from 'react'
import { Loader2, Truck } from 'lucide-react'

import { buildStoreAccentPalette, formatStoreCurrency, getStoreProductImages } from '@/components/store/store-utils'

const fieldClassName = 'h-11 w-full rounded-[6px] border border-slate-200 bg-white px-3 text-base text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-400 sm:text-sm'

function onlyDigits(value) {
  return String(value || '').replace(/\D/g, '')
}

function Field({ label, value, onChange, placeholder = '', autoComplete = '', type = 'text' }) {
  return (
    <label className="grid gap-1.5">
      <span className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        autoComplete={autoComplete}
        className={fieldClassName}
      />
    </label>
  )
}

export function StoreCheckoutForm({ store, product }) {
  const palette = useMemo(() => buildStoreAccentPalette(store.accentColor), [store.accentColor])
  const image = getStoreProductImages(product)[0] || product.thumbnail || ''
  const variations = useMemo(() => (Array.isArray(product.variations) ? product.variations : []).filter((variation) => Number(variation.availableQuantity || 0) > 0), [product.variations])
  const [selectedVariationId, setSelectedVariationId] = useState(() => variations[0]?.id || '')
  const selectedVariation = variations.find((variation) => variation.id === selectedVariationId) || null
  const [buyer, setBuyer] = useState({ name: '', email: '', phone: '', document: '' })
  const [address, setAddress] = useState({ zipCode: '', street: '', number: '', complement: '', neighborhood: '', city: '', state: '' })
  const [shippingOptions, setShippingOptions] = useState([])
  const [selectedShippingId, setSelectedShippingId] = useState('')
  const [freightLoading, setFreightLoading] = useState(false)
  const [checkoutLoading, setCheckoutLoading] = useState(false)
  const [error, setError] = useState('')
  const selectedShipping = shippingOptions.find((item) => item.id === selectedShippingId) || null
  const subtotal = Number(selectedVariation?.price || product.price || 0)
  const shippingAmount = Number(selectedShipping?.amount || 0)
  const total = subtotal + shippingAmount

  function updateBuyer(key, value) {
    setBuyer((current) => ({ ...current, [key]: value }))
  }

  function updateAddress(key, value) {
    setAddress((current) => ({ ...current, [key]: key === 'zipCode' ? onlyDigits(value).slice(0, 8) : value }))
  }

  async function calculateFreight() {
    setError('')
    setFreightLoading(true)
    setShippingOptions([])
    setSelectedShippingId('')

    const response = await fetch(`/api/loja/${store.slug}/frete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        productSlug: `${product.itemId || product.id}-${product.slug}`,
        zipCode: address.zipCode,
      }),
    }).catch(() => null)

    const payload = await response?.json().catch(() => ({}))
    setFreightLoading(false)

    if (!response?.ok) {
      setError(payload?.error || 'Não foi possível calcular o frete.')
      return
    }

    const options = Array.isArray(payload?.options) ? payload.options : []
    setShippingOptions(options)
    setSelectedShippingId(options[0]?.id || '')
  }

  async function startCheckout(event) {
    event.preventDefault()
    setError('')

    if (!buyer.name.trim() || !buyer.email.trim()) {
      setError('Informe nome e email para continuar.')
      return
    }

    if (onlyDigits(address.zipCode).length !== 8) {
      setError('Informe um CEP válido.')
      return
    }

    if (variations.length && !selectedVariationId) {
      setError('Selecione uma variação para continuar.')
      return
    }

    setCheckoutLoading(true)
    const response = await fetch(`/api/loja/${store.slug}/checkout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        productSlug: `${product.itemId || product.id}-${product.slug}`,
        quantity: 1,
        variationId: selectedVariationId || null,
        buyer,
        shippingAddress: address,
        shippingOption: selectedShipping || { id: 'sem_frete_calculado', name: 'Frete a combinar', amount: 0, currencyId: product.currencyId || 'BRL' },
      }),
    }).catch(() => null)

    const payload = await response?.json().catch(() => ({}))
    setCheckoutLoading(false)

    if (!response?.ok || !payload?.checkoutUrl) {
      setError(payload?.error || 'Não foi possível iniciar o pagamento.')
      return
    }

    window.location.href = payload.checkoutUrl
  }

  return (
    <form onSubmit={startCheckout} className="mx-auto grid max-w-[1120px] gap-6 px-4 py-8 lg:grid-cols-[minmax(0,1fr)_380px]">
      <section className="grid gap-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-950">Finalizar compra</h1>
          <p className="mt-2 text-sm leading-6 text-slate-600">Pagamento seguro via Mercado Pago para a loja {store.name}.</p>
        </div>

        <div className="grid gap-4 rounded-[8px] border border-slate-200 bg-white p-4">
          <h2 className="text-base font-semibold text-slate-950">Seus dados</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Nome" value={buyer.name} onChange={(value) => updateBuyer('name', value)} autoComplete="name" />
            <Field label="Email" value={buyer.email} onChange={(value) => updateBuyer('email', value)} type="email" autoComplete="email" />
            <Field label="Telefone" value={buyer.phone} onChange={(value) => updateBuyer('phone', value)} autoComplete="tel" />
            <Field label="CPF/CNPJ" value={buyer.document} onChange={(value) => updateBuyer('document', onlyDigits(value))} />
          </div>
        </div>

        {variations.length ? (
          <div className="grid gap-4 rounded-[8px] border border-slate-200 bg-white p-4">
            <h2 className="text-base font-semibold text-slate-950">Variação</h2>
            <div className="grid gap-2 sm:grid-cols-2">
              {variations.map((variation) => {
                const label = Array.isArray(variation.attributeCombinations)
                  ? variation.attributeCombinations.map((attribute) => `${attribute.name}: ${attribute.valueName}`).join(' / ')
                  : variation.id

                return (
                  <label key={variation.id} className="flex cursor-pointer items-center justify-between gap-3 rounded-[6px] border border-slate-200 px-3 py-3 text-sm">
                    <span className="flex items-center gap-3">
                      <input
                        type="radio"
                        checked={selectedVariationId === variation.id}
                        onChange={() => setSelectedVariationId(variation.id)}
                      />
                      <span className="font-semibold text-slate-950">{label || variation.id}</span>
                    </span>
                    <span className="text-xs text-slate-500">{Number(variation.availableQuantity || 0)} un.</span>
                  </label>
                )
              })}
            </div>
          </div>
        ) : null}

        <div className="grid gap-4 rounded-[8px] border border-slate-200 bg-white p-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <h2 className="text-base font-semibold text-slate-950">Entrega</h2>
            <button
              type="button"
              onClick={calculateFreight}
              disabled={freightLoading || onlyDigits(address.zipCode).length !== 8}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-[6px] border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-900 transition hover:border-slate-300 disabled:opacity-60"
            >
              {freightLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Truck className="h-4 w-4" />}
              Calcular frete
            </button>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="CEP" value={address.zipCode} onChange={(value) => updateAddress('zipCode', value)} autoComplete="postal-code" />
            <Field label="Rua" value={address.street} onChange={(value) => updateAddress('street', value)} autoComplete="address-line1" />
            <Field label="Número" value={address.number} onChange={(value) => updateAddress('number', value)} autoComplete="address-line2" />
            <Field label="Complemento" value={address.complement} onChange={(value) => updateAddress('complement', value)} />
            <Field label="Bairro" value={address.neighborhood} onChange={(value) => updateAddress('neighborhood', value)} />
            <Field label="Cidade" value={address.city} onChange={(value) => updateAddress('city', value)} autoComplete="address-level2" />
            <Field label="Estado" value={address.state} onChange={(value) => updateAddress('state', value.slice(0, 2).toUpperCase())} autoComplete="address-level1" />
          </div>

          {shippingOptions.length ? (
            <div className="grid gap-2">
              {shippingOptions.map((option) => (
                <label key={option.id} className="flex cursor-pointer items-center justify-between gap-3 rounded-[6px] border border-slate-200 px-3 py-3 text-sm">
                  <span className="flex items-center gap-3">
                    <input
                      type="radio"
                      checked={selectedShippingId === option.id}
                      onChange={() => setSelectedShippingId(option.id)}
                    />
                    <span>
                      <span className="font-semibold text-slate-950">{option.name}</span>
                      {option.estimatedDeliveryTime ? <span className="ml-2 text-slate-500">{option.estimatedDeliveryTime}</span> : null}
                    </span>
                  </span>
                  <span className="font-semibold text-slate-950">{formatStoreCurrency(option.amount, option.currencyId)}</span>
                </label>
              ))}
            </div>
          ) : null}
        </div>
      </section>

      <aside className="h-fit rounded-[8px] border border-slate-200 bg-white p-4">
        <div className="flex gap-3">
          <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-[6px] bg-slate-100">
            {image ? <Image src={image} alt={product.title} fill sizes="96px" unoptimized className="object-contain" /> : null}
          </div>
          <div className="min-w-0">
            <div className="line-clamp-3 text-sm font-semibold leading-5 text-slate-950">{product.title}</div>
            {selectedVariation ? (
              <div className="mt-1 text-xs text-slate-500">
                {selectedVariation.attributeCombinations?.map((attribute) => `${attribute.name}: ${attribute.valueName}`).join(' / ')}
              </div>
            ) : null}
            <div className="mt-2 text-sm text-slate-600">Quantidade: 1</div>
          </div>
        </div>

        <div className="mt-5 grid gap-2 border-t border-slate-200 pt-4 text-sm">
          <div className="flex justify-between"><span>Produto</span><span>{formatStoreCurrency(subtotal, product.currencyId)}</span></div>
          <div className="flex justify-between"><span>Frete</span><span>{formatStoreCurrency(shippingAmount, product.currencyId)}</span></div>
          <div className="flex justify-between border-t border-slate-200 pt-3 text-base font-semibold text-slate-950">
            <span>Total</span>
            <span style={{ color: palette.accentDark }}>{formatStoreCurrency(total, product.currencyId)}</span>
          </div>
        </div>

        {error ? <div className="mt-4 rounded-[6px] border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div> : null}

        <button
          type="submit"
          disabled={checkoutLoading}
          className="mt-4 inline-flex h-12 w-full items-center justify-center gap-2 rounded-[6px] px-5 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-60"
          style={{ backgroundColor: palette.accentDark }}
        >
          {checkoutLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Pagar com Mercado Pago
        </button>
      </aside>
    </form>
  )
}
