'use client'

import { plainTextToEditorHtml, richTextToPlainText } from './agent-rich-editor'

const AUTO_SUMMARY_MARKER = 'data-infrastudio-auto-summary'
const SITE_SUMMARY_FIELD_ORDER = [
  ['emails', 'Emails'],
  ['phones', 'Telefones'],
  ['whatsappLinks', 'WhatsApp'],
  ['people', 'Pessoas'],
  ['cnpjs', 'CNPJ'],
  ['addresses', 'Endereco'],
  ['socialLinks', 'Redes'],
  ['organizations', 'Organizacao'],
]

function normalizeSummaryValue(value) {
  if (value == null) {
    return ''
  }

  if (typeof value === 'string') {
    return value.trim()
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value)
  }

  if (Array.isArray(value)) {
    return value.map((item) => normalizeSummaryValue(item)).filter(Boolean).join(', ')
  }

  if (typeof value === 'object') {
    const preferredValues = [
      value.name,
      value.title,
      value.label,
      value.value,
      value.text,
      value.url,
      value.handle,
      value.username,
      value.description,
    ]
      .map((item) => normalizeSummaryValue(item))
      .filter(Boolean)

    if (preferredValues.length) {
      return preferredValues.join(' - ')
    }

    return Object.entries(value)
      .map(([key, item]) => {
        const normalizedItem = normalizeSummaryValue(item)
        return normalizedItem ? `${key}: ${normalizedItem}` : ''
      })
      .filter(Boolean)
      .join(', ')
  }

  return ''
}

function stripAutoSummaryBlock(value) {
  return String(value || '').replace(
    /<section[^>]*data-infrastudio-auto-summary="true"[\s\S]*?<\/section>\s*/gi,
    '',
  )
}

function normalizeStringList(value, limit = 12) {
  return [...new Set(normalizeSummaryValue(value).split(/\s*\n\s*|,\s*/).map((item) => item.trim()).filter(Boolean))].slice(0, limit)
}

function buildAutoSummaryBlock(sections) {
  if (!sections.length) {
    return ''
  }

  const html = plainTextToEditorHtml(sections.join('\n\n'))
  return `<section ${AUTO_SUMMARY_MARKER}="true">${html}</section>`
}

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

export function buildMergedAgentSummary(currentHtml, generatedSummary, promptSuggestion = '', mergedEditorDraft = '') {
  const sanitizedCurrentHtml = stripAutoSummaryBlock(currentHtml)
  const mergedDraftText = normalizeSummaryValue(mergedEditorDraft)
  const currentText = richTextToPlainText(sanitizedCurrentHtml)

  if (mergedDraftText && !currentText) {
    return plainTextToEditorHtml(mergedDraftText)
  }

  const summaryText = normalizeSummaryValue(generatedSummary)
  const promptText = normalizeSummaryValue(promptSuggestion)
  const nextSections = []

  if (summaryText) {
    nextSections.push(summaryText)
  }

  if (promptText) {
    nextSections.push(`Prompt base sugerido:\n${promptText}`)
  }

  if (!nextSections.length) {
    return sanitizedCurrentHtml
  }

  const baseHtml = currentText ? plainTextToEditorHtml(currentText) : ''
  const summaryHtml = buildAutoSummaryBlock(nextSections)
  return `${baseHtml}${summaryHtml}`
}

export function buildEditableSiteSummaryDraft(data) {
  const source = data?.source || data?.sourceData || {}
  const contacts = source.contacts || {}
  const institutionals = source.institutionalData || {}
  const structuredData = source.structuredData || {}

  return {
    title: normalizeSummaryValue(data?.source?.title || data?.title),
    summary: normalizeSummaryValue(data?.summary),
    promptSuggestion: normalizeSummaryValue(data?.promptSuggestion),
    emails: normalizeStringList(contacts.emails),
    phones: normalizeStringList(contacts.phones),
    whatsappLinks: normalizeStringList(contacts.whatsappLinks),
    people: normalizeStringList(source.people),
    cnpjs: normalizeStringList(institutionals.cnpjs),
    addresses: normalizeStringList(institutionals.addresses),
    socialLinks: normalizeStringList(source.socialLinks),
    organizations: normalizeStringList(structuredData.organizations),
    logoUrl: normalizeSummaryValue(data?.source?.logoUrl || data?.logoUrl),
  }
}

export function normalizeEditableSiteSummaryDraft(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null
  }

  const draft = {
    title: normalizeSummaryValue(value.title),
    summary: normalizeSummaryValue(value.summary),
    promptSuggestion: normalizeSummaryValue(value.promptSuggestion),
    emails: normalizeStringList(value.emails),
    phones: normalizeStringList(value.phones),
    whatsappLinks: normalizeStringList(value.whatsappLinks),
    people: normalizeStringList(value.people),
    cnpjs: normalizeStringList(value.cnpjs),
    addresses: normalizeStringList(value.addresses),
    socialLinks: normalizeStringList(value.socialLinks),
    organizations: normalizeStringList(value.organizations),
    logoUrl: normalizeSummaryValue(value.logoUrl),
  }

  const hasContent = Object.entries(draft).some(([key, item]) =>
    Array.isArray(item) ? item.length > 0 : Boolean(item && key !== 'logoUrl')
  )

  return hasContent ? draft : null
}

export function formatSiteSummaryListForTextarea(value) {
  return Array.isArray(value) ? value.join('\n') : ''
}

export function parseSiteSummaryTextarea(value) {
  return String(value || '')
    .split('\n')
    .map((item) => item.trim())
    .filter(Boolean)
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

export function buildAgentDraftConfig({ runtimeConfig, promptText, siteUrl, logoUrl, siteSummary }) {
  const config = {}
  const normalizedSiteUrl = String(siteUrl || '').trim()
  const normalizedLogoUrl = String(logoUrl || '').trim()
  const normalizedSiteSummary = normalizeEditableSiteSummaryDraft(siteSummary)
  const contactProfile = extractContactProfileFromPrompt(promptText)

  if (contactProfile) {
    config.contactProfile = contactProfile
  }

  if (normalizedSiteSummary) {
    config.siteSummary = normalizedSiteSummary

    const mergedContactProfile = {
      emails: [...new Set([...(contactProfile?.emails || []), ...normalizedSiteSummary.emails])],
      phones: [...new Set([...(contactProfile?.phones || []), ...normalizedSiteSummary.phones])],
      whatsappLinks: [...new Set([...(contactProfile?.whatsappLinks || []), ...normalizedSiteSummary.whatsappLinks])],
      addresses: [...new Set([...(contactProfile?.addresses || []), ...normalizedSiteSummary.addresses])],
    }

    if (Object.values(mergedContactProfile).some((item) => item.length > 0)) {
      config.contactProfile = mergedContactProfile
    }
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
  const draft = normalizeEditableSiteSummaryDraft(data?.source ? buildEditableSiteSummaryDraft(data) : data)

  if (!draft) {
    return []
  }

  return SITE_SUMMARY_FIELD_ORDER
    .map(([key, label]) => ({
      key,
      label,
      values: Array.isArray(draft[key]) ? draft[key] : [],
    }))
    .filter((item) => item.values.length > 0)
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
    items.push('descrição alterada')
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
