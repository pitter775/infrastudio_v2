'use client'

import { buildAgentRuntimeConfigTemplate } from '@/lib/agent-runtime-config'
import { plainTextToEditorHtml, richTextToPlainText } from './agent-rich-editor'

export function resolveEntityAvatarUrl(primaryUrl, siteUrl) {
  if (primaryUrl) {
    return primaryUrl
  }

  if (!siteUrl) {
    return ''
  }

  try {
    return new URL('/favicon.ico', siteUrl).toString()
  } catch {
    return ''
  }
}

export function buildMergedAgentSummary(currentHtml, generatedSummary, promptSuggestion = '') {
  const currentText = richTextToPlainText(currentHtml)
  const summaryText = String(generatedSummary || '').trim()
  const promptText = String(promptSuggestion || '').trim()
  const nextSections = []

  if (summaryText) {
    nextSections.push(summaryText)
  }

  if (promptText) {
    nextSections.push(`Prompt base sugerido:\n${promptText}`)
  }

  if (!nextSections.length) {
    return currentHtml
  }

  const mergedText = currentText ? `${currentText}\n\n${nextSections.join('\n\n')}` : nextSections.join('\n\n')
  return plainTextToEditorHtml(mergedText)
}

function slugifyPricingValue(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
}

function uniquePromptValues(values, limit = 8) {
  return [...new Set(values.map((item) => String(item || '').trim()).filter(Boolean))].slice(0, limit)
}

function isLikelyAddressLine(line) {
  const normalizedLine = String(line || '').trim()
  if (!normalizedLine) {
    return false
  }

  if (!/(?:rua|avenida|av\.|travessa|alameda|rodovia|estrada|bairro|cep|n(?:o|\u00ba|\u00b0)?)/i.test(normalizedLine)) {
    return false
  }

  return /\b\d{1,5}\b/.test(normalizedLine) || /\bcep\b/i.test(normalizedLine) || /,\s*\d/.test(normalizedLine)
}

function extractContactProfileFromPrompt(promptText) {
  const text = String(promptText || '')
  const lines = text
    .split('\n')
    .map((line) => line.replace(/^[-*]\s+/, '').trim())
    .filter(Boolean)

  const emails = uniquePromptValues(text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) || [], 6)
  const phones = uniquePromptValues(
    text.match(/(?:\+?55\s*)?(?:\(?\d{2}\)?\s*)?(?:9?\d{4})[-\s]?\d{4}/g) || [],
    6,
  )
  const whatsappLinks = uniquePromptValues(text.match(/https?:\/\/(?:wa\.me|api\.whatsapp\.com)[^\s]+/gi) || [], 4)
  const addresses = uniquePromptValues(lines.filter((line) => isLikelyAddressLine(line)), 4)

  const contactProfile = {}

  if (emails.length) {
    contactProfile.emails = emails
  }

  if (phones.length) {
    contactProfile.phones = phones
  }

  if (whatsappLinks.length) {
    contactProfile.whatsappLinks = whatsappLinks
  }

  if (addresses.length) {
    contactProfile.addresses = addresses
  }

  return Object.keys(contactProfile).length ? contactProfile : null
}

function buildPricingCatalogFromPrompt(promptText, fallbackPricingCatalog = null) {
  const lines = String(promptText || '')
    .split('\n')
    .map((line) => line.replace(/^[-*]\s+/, '').trim())
    .filter(Boolean)

  const items = []

  lines.forEach((line) => {
    if (!/r\$\s*\d/i.test(line)) {
      return
    }

    const match =
      line.match(/^(.{2,80}?)(?:\s*(?:-|\u2014|\u2013|:)\s*|\s{2,})(R\$\s*.+)$/i) ||
      line.match(/^(.{2,80}?)\s+(R\$\s*.+)$/i)

    if (!match) {
      return
    }

    const name = String(match[1] || '').trim().replace(/[.:;-]+$/, '')
    const priceLabel = String(match[2] || '').trim()

    if (!name || !priceLabel) {
      return
    }

    const matchAny = name
      .toLowerCase()
      .split(/[^\p{L}\p{N}]+/u)
      .map((item) => item.trim())
      .filter((item) => item.length >= 3)
      .slice(0, 4)

    items.push({
      slug: slugifyPricingValue(name) || `item-${items.length + 1}`,
      name,
      matchAny,
      priceLabel,
    })
  })

  if (!items.length) {
    return fallbackPricingCatalog && typeof fallbackPricingCatalog === 'object' ? fallbackPricingCatalog : null
  }

  const templatePricingCatalog = buildAgentRuntimeConfigTemplate().pricingCatalog || {}
  return {
    enabled: true,
    ctaSingle: fallbackPricingCatalog?.ctaSingle || templatePricingCatalog.ctaSingle,
    ctaMultiple: fallbackPricingCatalog?.ctaMultiple || templatePricingCatalog.ctaMultiple,
    items,
  }
}

export function buildAgentDraftConfig({ runtimeConfig, promptText, siteUrl, logoUrl }) {
  const config = {}
  const normalizedRuntimeConfig = runtimeConfig && typeof runtimeConfig === 'object' ? runtimeConfig : null
  const normalizedSiteUrl = String(siteUrl || '').trim()
  const normalizedLogoUrl = String(logoUrl || '').trim()
  const nextPricingCatalog = buildPricingCatalogFromPrompt(promptText, normalizedRuntimeConfig?.pricingCatalog || null)
  const contactProfile = extractContactProfileFromPrompt(promptText)

  if (nextPricingCatalog) {
    config.runtimeConfig = {
      pricingCatalog: nextPricingCatalog,
    }
  }

  if (contactProfile) {
    config.contactProfile = contactProfile
  }

  if (normalizedSiteUrl || normalizedLogoUrl) {
    config.brand = {}

    if (normalizedSiteUrl) {
      config.brand.siteUrl = normalizedSiteUrl
    }

    if (normalizedLogoUrl) {
      config.brand.logoUrl = normalizedLogoUrl
    }
  }

  return config
}

export function buildSiteSummaryHighlights(data) {
  if (!data?.source) {
    return []
  }

  const source = data.source
  const contacts = source.contacts || {}
  const institutionals = source.institutionalData || {}
  const structuredData = source.structuredData || {}

  return [
    contacts.emails?.length ? { label: 'Emails', values: contacts.emails } : null,
    contacts.phones?.length ? { label: 'Telefones', values: contacts.phones } : null,
    contacts.whatsappLinks?.length ? { label: 'WhatsApp', values: contacts.whatsappLinks } : null,
    source.people?.length ? { label: 'Pessoas', values: source.people } : null,
    institutionals.cnpjs?.length ? { label: 'CNPJ', values: institutionals.cnpjs } : null,
    institutionals.addresses?.length ? { label: 'Endereco', values: institutionals.addresses } : null,
    source.socialLinks?.length ? { label: 'Redes', values: source.socialLinks } : null,
    structuredData.organizations?.length ? { label: 'Organizacao', values: structuredData.organizations } : null,
  ].filter(Boolean)
}

function normalizeVersionText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim()
}

function buildPromptDiffSummary(currentValue, previousValue) {
  const current = normalizeVersionText(currentValue)
  const previous = normalizeVersionText(previousValue)

  if (!current && !previous) {
    return { changed: false, delta: 0, preview: 'sem alteracao de prompt' }
  }

  const delta = current.length - previous.length
  if (current === previous) {
    return { changed: false, delta, preview: 'sem alteracao de prompt' }
  }

  return {
    changed: true,
    delta,
    preview:
      delta === 0
        ? 'prompt reescrito'
        : delta > 0
          ? `prompt expandido (+${delta} chars)`
          : `prompt reduzido (${delta} chars)`,
  }
}

function buildRuntimeConfigDiffSummary(currentConfig, previousConfig) {
  const currentKeys = Object.keys(currentConfig && typeof currentConfig === 'object' ? currentConfig : {})
  const previousKeys = Object.keys(previousConfig && typeof previousConfig === 'object' ? previousConfig : {})
  const added = currentKeys.filter((key) => !previousKeys.includes(key))
  const removed = previousKeys.filter((key) => !currentKeys.includes(key))

  if (!added.length && !removed.length) {
    return 'runtime sem mudanca estrutural'
  }

  return [
    added.length ? `+ ${added.slice(0, 3).join(', ')}` : '',
    removed.length ? `- ${removed.slice(0, 3).join(', ')}` : '',
  ]
    .filter(Boolean)
    .join(' | ')
}

export function buildVersionChangeNote(version, compareVersion) {
  const items = []

  if (normalizeVersionText(version.name) !== normalizeVersionText(compareVersion?.name)) {
    items.push('nome alterado')
  }

  if (normalizeVersionText(version.description) !== normalizeVersionText(compareVersion?.description)) {
    items.push('descricao alterada')
  }

  const promptDiff = buildPromptDiffSummary(version.prompt, compareVersion?.prompt)
  if (promptDiff.changed) {
    items.push(promptDiff.preview)
  }

  const runtimeDiff = buildRuntimeConfigDiffSummary(version.runtimeConfig, compareVersion?.runtimeConfig)
  if (runtimeDiff !== 'runtime sem mudanca estrutural') {
    items.push(runtimeDiff)
  }

  if (normalizeVersionText(version.note)) {
    items.push(`nota: ${normalizeVersionText(version.note)}`)
  }

  return items.length ? items.join(' | ') : 'sem diferenca relevante visivel'
}
