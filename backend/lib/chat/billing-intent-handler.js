import { hasConfiguredWhatsAppDestination } from "@/lib/chat/whatsapp-availability"

function sanitizeString(value) {
  const normalized = String(value || "").trim()
  return normalized || ""
}

function uniqueArray(values = []) {
  return [...new Set(values.filter(Boolean))]
}

function normalizeBillingText(value) {
  return sanitizeString(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
}

function parsePriceLabelAmount(priceLabel = "") {
  const match = String(priceLabel || "").match(/r\$\s*([\d\.\,]+)/i)
  if (!match?.[1]) {
    return null
  }

  const normalized = match[1].replace(/\./g, "").replace(",", ".")
  const parsed = Number(normalized)
  return Number.isFinite(parsed) ? parsed : null
}

function normalizeFeatureList(value) {
  if (!Array.isArray(value)) {
    return []
  }

  return [...new Set(value.map((item) => sanitizeString(item)).filter(Boolean))]
}

function normalizeOptionalNumber(value) {
  if (value == null || value === "") {
    return null
  }

  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function buildPlanAliases(item = {}) {
  return [...new Set(
    [item.slug, item.name, ...(Array.isArray(item.matchAny) ? item.matchAny : [])]
      .map((entry) => normalizeBillingText(entry))
      .filter(Boolean)
  )]
}

export function getStructuredPricingItems(runtimeConfig = {}) {
  const configuredItems = Array.isArray(runtimeConfig?.pricingCatalog?.items) ? runtimeConfig.pricingCatalog.items : []
  return configuredItems
    .map((item) => {
      const slug = sanitizeString(item?.slug)
      const name = sanitizeString(item?.name)
      const priceLabel = sanitizeString(item?.priceLabel)
      const aliases = buildPlanAliases(item)
      if (!slug || !name || !priceLabel || aliases.length === 0) {
        return null
      }

      return {
        slug,
        name,
        aliases,
        priceLabel,
        amount: parsePriceLabelAmount(priceLabel),
        attendanceLimit: normalizeOptionalNumber(item?.attendanceLimit),
        agentLimit: normalizeOptionalNumber(item?.agentLimit),
        creditLimit: normalizeOptionalNumber(item?.creditLimit),
        whatsappIncluded: typeof item?.whatsappIncluded === "boolean" ? item.whatsappIncluded : null,
        supportLevel: sanitizeString(item?.supportLevel),
        features: normalizeFeatureList(item?.features),
        channels: normalizeFeatureList(item?.channels),
      }
    })
    .filter(Boolean)
}

function buildPlanMatchIndex(items = []) {
  return new Map(items.flatMap((item) => item.aliases.map((alias) => [alias, item])))
}

function resolveComparisonFocusPlans(context = {}, items = []) {
  const planSlugs = Array.isArray(context?.billing?.comparisonFocus?.plans)
    ? context.billing.comparisonFocus.plans.map((item) => sanitizeString(item?.slug)).filter(Boolean)
    : []

  if (planSlugs.length < 2) {
    return []
  }

  return planSlugs
    .map((slug) => items.find((item) => item.slug === slug))
    .filter(Boolean)
}

function resolveRequestedPlans(decision = null, items = [], context = {}) {
  const index = buildPlanMatchIndex(items)
  const requested = Array.isArray(decision?.requestedPlanNames) ? decision.requestedPlanNames : []
  const requestedItems = requested
    .map((name) => index.get(normalizeBillingText(name)))
    .filter(Boolean)

  if (requestedItems.length > 0) {
    return [...new Map(requestedItems.map((item) => [item.slug, item])).values()]
  }

  if (decision?.kind === "plan_comparison") {
    const comparisonPlans = resolveComparisonFocusPlans(context, items)
    if (comparisonPlans.length >= 2) {
      return comparisonPlans
    }
  }

  const focusedPlanSlug = sanitizeString(context?.billing?.planFocus?.slug)
  if (!focusedPlanSlug) {
    return []
  }

  return items.filter((item) => item.slug === focusedPlanSlug)
}

function formatNumberLabel(value, singular, plural = singular) {
  if (value == null) {
    return null
  }

  const formatted = new Intl.NumberFormat("pt-BR").format(Number(value || 0))
  return `${formatted} ${Number(value) === 1 ? singular : plural}`
}

function buildFactValue(plan, field) {
  if (!plan || !field) {
    return null
  }

  if (field === "attendance_limit") {
    return formatNumberLabel(plan.attendanceLimit, "atendimento", "atendimentos")
  }

  if (field === "agent_limit") {
    return formatNumberLabel(plan.agentLimit, "agente", "agentes")
  }

  if (field === "credit_limit") {
    return formatNumberLabel(plan.creditLimit, "credito", "creditos")
  }

  if (field === "whatsapp_included") {
    if (plan.whatsappIncluded == null) {
      return null
    }

    return plan.whatsappIncluded ? "Sim" : "Nao"
  }

  if (field === "support_level") {
    return plan.supportLevel || null
  }

  if (field === "price") {
    return plan.priceLabel || null
  }

  return null
}

function buildFactSentence(plan, field) {
  const factValue = buildFactValue(plan, field)
  if (!factValue) {
    return null
  }

  const fieldLabels = {
    attendance_limit: `O plano ${plan.name} comporta ${factValue}.`,
    agent_limit: `O plano ${plan.name} permite ${factValue}.`,
    credit_limit: `O plano ${plan.name} inclui ${factValue} por mes.`,
    whatsapp_included: `No plano ${plan.name}, WhatsApp: ${factValue}.`,
    support_level: `No plano ${plan.name}, o suporte e ${factValue}.`,
    price: `O plano ${plan.name} custa ${factValue}.`,
  }

  return fieldLabels[field] || `No plano ${plan.name}, ${factValue}.`
}

function buildSinglePlanSummary(plan) {
  const lines = [`- ${plan.name}: ${plan.priceLabel}`]
  const attendanceLabel = buildFactValue(plan, "attendance_limit")
  const agentLabel = buildFactValue(plan, "agent_limit")
  const creditLabel = buildFactValue(plan, "credit_limit")

  if (attendanceLabel) {
    lines.push(`- Atendimentos: ${attendanceLabel}`)
  }
  if (agentLabel) {
    lines.push(`- Agentes: ${agentLabel}`)
  }
  if (creditLabel) {
    lines.push(`- Creditos: ${creditLabel}`)
  }
  if (plan.whatsappIncluded != null) {
    lines.push(`- WhatsApp: ${plan.whatsappIncluded ? "Sim" : "Nao"}`)
  }
  if (plan.supportLevel) {
    lines.push(`- Suporte: ${plan.supportLevel}`)
  }
  if (plan.features.length) {
    lines.push(`- Recursos: ${plan.features.join(", ")}`)
  }

  return lines
}

function buildComparisonPlanSummary(plan) {
  const lines = [`${plan.name}: ${plan.priceLabel}`]
  const attendanceLabel = buildFactValue(plan, "attendance_limit")
  const agentLabel = buildFactValue(plan, "agent_limit")
  const creditLabel = buildFactValue(plan, "credit_limit")

  if (attendanceLabel) {
    lines.push(`Atendimentos: ${attendanceLabel}`)
  }
  if (agentLabel) {
    lines.push(`Agentes: ${agentLabel}`)
  }
  if (creditLabel) {
    lines.push(`Creditos: ${creditLabel}`)
  }
  if (plan.whatsappIncluded != null) {
    lines.push(`WhatsApp: ${plan.whatsappIncluded ? "Sim" : "Nao"}`)
  }
  if (plan.supportLevel) {
    lines.push(`Suporte: ${plan.supportLevel}`)
  }

  return lines.join(" | ")
}

function getComparableFactRawValue(plan, field) {
  if (!plan || !field) {
    return null
  }

  if (field === "attendance_limit") return plan.attendanceLimit
  if (field === "agent_limit") return plan.agentLimit
  if (field === "credit_limit") return plan.creditLimit
  if (field === "whatsapp_included") return plan.whatsappIncluded
  if (field === "support_level") return plan.supportLevel || null
  if (field === "price") return plan.amount
  return null
}

function buildComparisonFieldLabel(field) {
  const labels = {
    attendance_limit: "Atendimentos",
    agent_limit: "Agentes",
    credit_limit: "Creditos",
    whatsapp_included: "WhatsApp",
    support_level: "Suporte",
    price: "Preco",
  }

  return labels[field] || field
}

function rankSupportLevel(value) {
  const supportRank = {
    basico: 1,
    padrao: 2,
    prioritario: 3,
    premium: 4,
    dedicado: 5,
  }

  return supportRank[normalizeBillingText(value)] ?? 0
}

function isImprovementField(field) {
  return ["attendance_limit", "agent_limit", "credit_limit", "whatsapp_included", "support_level"].includes(field)
}

function getFieldRankingValue(plan, field) {
  if (!plan || !field) {
    return null
  }

  if (field === "support_level") {
    return rankSupportLevel(plan.supportLevel)
  }

  if (field === "whatsapp_included") {
    return Number(plan.whatsappIncluded === true)
  }

  const rawValue = getComparableFactRawValue(plan, field)
  if (rawValue == null) {
    return null
  }

  return Number.isFinite(Number(rawValue)) ? Number(rawValue) : null
}

function comparePlansByField(left, right, field) {
  const leftValue = getComparableFactRawValue(left, field)
  const rightValue = getComparableFactRawValue(right, field)

  if (field === "price") {
    if (leftValue == null || rightValue == null) return null
    return Number(leftValue) - Number(rightValue)
  }

  if (field === "support_level") {
    return rankSupportLevel(leftValue) - rankSupportLevel(rightValue)
  }

  if (field === "whatsapp_included") {
    return Number(leftValue === true) - Number(rightValue === true)
  }

  if (leftValue == null || rightValue == null) {
    return null
  }

  return Number(leftValue) - Number(rightValue)
}

function buildFocusedComparisonReply(plans = [], fields = []) {
  if (plans.length < 2 || !fields.length) {
    return null
  }

  const lines = fields.map((field) => {
    const missingPlan = plans.find((plan) => !buildFactValue(plan, field))
    if (missingPlan) {
      return buildFallbackFieldMissingReply(missingPlan, field)
    }

    const fieldLabel = buildComparisonFieldLabel(field)
    const valuesLine = `${fieldLabel}: ${plans.map((plan) => `${plan.name} ${buildFactValue(plan, field)}`).join(" | ")}.`
    const sorted = plans
      .slice()
      .sort((left, right) => {
        const delta = comparePlansByField(left, right, field)
        if (delta == null) {
          return 0
        }

        return field === "price" ? delta : -delta
      })
    const winner = sorted[0]
    if (!winner) {
      return valuesLine
    }

    const winnerLead =
      field === "price"
        ? `${winner.name} e o menor preco nesse criterio.`
        : `${winner.name} lidera em ${fieldLabel.toLowerCase()}.`

    return `${valuesLine} ${winnerLead}`
  })

  return lines.filter(Boolean).join("\n")
}

function buildFallbackFieldMissingReply(plan, field) {
  const fieldLabels = {
    attendance_limit: "limite estruturado de atendimentos",
    agent_limit: "limite estruturado de agentes",
    credit_limit: "limite estruturado de creditos",
    whatsapp_included: "informacao estruturada de WhatsApp",
    support_level: "nivel estruturado de suporte",
  }

  const label = fieldLabels[field] || "esse dado estruturado"
  return `Nao encontrei no catalogo ${label} para o plano ${plan.name}.`
}

function listStructuredFieldsForPlan(plan) {
  if (!plan) {
    return []
  }

  const fields = []
  if (plan.priceLabel) fields.push("preco")
  if (plan.attendanceLimit != null) fields.push("atendimentos")
  if (plan.agentLimit != null) fields.push("agentes")
  if (plan.creditLimit != null) fields.push("creditos")
  if (plan.whatsappIncluded != null) fields.push("whatsapp")
  if (plan.supportLevel) fields.push("suporte")
  return fields
}

function buildAvailableFieldsHint(plans = []) {
  const available = uniqueArray(plans.flatMap((plan) => listStructuredFieldsForPlan(plan)))
  if (!available.length) {
    return ""
  }

  return ` Hoje eu tenho estruturado: ${available.join(", ")}.`
}

function buildClarifyingRecommendationReply(plans = []) {
  return `Para te recomendar com seguranca, preciso que voce priorize um criterio: preco, atendimentos, agentes, WhatsApp ou suporte.${buildAvailableFieldsHint(plans)}`
}

function deriveRecommendationFieldsFromPlans(plans = []) {
  if (plans.length < 2) {
    return []
  }

  const candidateFields = ["price", "attendance_limit", "agent_limit", "credit_limit", "whatsapp_included", "support_level"]
  return candidateFields.filter((field) => {
    const values = plans.map((plan) => getComparableFactRawValue(plan, field))
    if (values.some((value) => value == null)) {
      return false
    }

    const normalized = values.map((value) => typeof value === "boolean" ? Number(value) : String(value))
    return new Set(normalized).size > 1
  })
}

function buildRecommendationFields(decision = null, context = {}, recommendationPool = []) {
  const targetField = sanitizeString(decision?.targetField)
  const targetFields = resolveDecisionTargetFields(decision)
  const comparisonPlanSlugs = Array.isArray(context?.billing?.comparisonFocus?.plans)
    ? context.billing.comparisonFocus.plans.map((plan) => sanitizeString(plan?.slug)).filter(Boolean)
    : []
  const comparisonFields = Array.isArray(context?.billing?.comparisonFocus?.fields)
    ? context.billing.comparisonFocus.fields.map((field) => sanitizeString(field)).filter(Boolean)
    : []

  if (targetFields.length) {
    return targetFields
  }

  if (targetField) {
    return [targetField]
  }

  if (comparisonFields.length) {
    const hasPriceForAll = recommendationPool.length >= 2 && recommendationPool.every((plan) => plan?.amount != null)
    return uniqueArray([...comparisonFields, ...(hasPriceForAll ? ["price"] : [])])
  }

  const derivedFields = comparisonPlanSlugs.length >= 2 ? deriveRecommendationFieldsFromPlans(recommendationPool) : []
  if (derivedFields.length) {
    return derivedFields
  }

  return []
}

function buildRecommendationLead(recommendedPlan, currentPlan, fields = [], recommendationPool = []) {
  if (!recommendedPlan) {
    return ""
  }

  if (currentPlan && currentPlan.slug !== recommendedPlan.slug) {
    if (fields.includes("price") && recommendedPlan.amount != null && currentPlan.amount != null) {
      const delta = Number(recommendedPlan.amount) - Number(currentPlan.amount)
      if (delta > 0) {
        return `Se a prioridade e equilibrar custo e capacidade, o melhor proximo encaixe e o ${recommendedPlan.name}, com diferenca de R$ ${delta.toFixed(2).replace(".", ",")} sobre o ${currentPlan.name}.`
      }
    }

    return `Se a prioridade e esse criterio, o melhor proximo encaixe e o ${recommendedPlan.name}.`
  }

  if (fields.includes("price") && recommendationPool.length >= 2) {
    return `Considerando custo-beneficio dentro do catalogo atual, o plano que mais faz sentido hoje e o ${recommendedPlan.name}.`
  }

  return `Se a prioridade e esse criterio, o plano que mais faz sentido no catalogo hoje e o ${recommendedPlan.name}.`
}

function resolveDecisionTargetFields(decision = null) {
  const primaryField = sanitizeString(decision?.targetField)
  const additionalFields = Array.isArray(decision?.targetFields) ? decision.targetFields.map((item) => sanitizeString(item)).filter(Boolean) : []
  return uniqueArray([primaryField, ...additionalFields])
}

function buildPlanRecommendation(items = [], targetField = "", currentPlan = null) {
  const comparableItems = items.filter((item) => buildFactValue(item, targetField) != null)
  if (!comparableItems.length) {
    return null
  }

  if (targetField === "whatsapp_included") {
    const enabledPlans = comparableItems.filter((item) => item.whatsappIncluded === true)
    if (!enabledPlans.length) {
      return null
    }

    return enabledPlans.sort((left, right) => {
      if (left.amount != null && right.amount != null) {
        return Number(left.amount) - Number(right.amount)
      }
      return left.name.localeCompare(right.name)
    })[0]
  }

  if (targetField === "support_level") {
    const supportRank = {
      basico: 1,
      padrao: 2,
      prioritario: 3,
      premium: 4,
      dedicado: 5,
    }

    return comparableItems
      .slice()
      .sort((left, right) => {
        const leftRank = supportRank[normalizeBillingText(left.supportLevel)] ?? 0
        const rightRank = supportRank[normalizeBillingText(right.supportLevel)] ?? 0
        if (leftRank !== rightRank) {
          return rightRank - leftRank
        }
        if (left.amount != null && right.amount != null) {
          return Number(left.amount) - Number(right.amount)
        }
        return left.name.localeCompare(right.name)
      })[0]
  }

  if (targetField === "price") {
    return comparableItems
      .filter((item) => item.amount != null)
      .sort((left, right) => Number(left.amount) - Number(right.amount))[0] ?? null
  }

  const fieldMap = {
    attendance_limit: "attendanceLimit",
    agent_limit: "agentLimit",
    credit_limit: "creditLimit",
  }

  const property = fieldMap[targetField]
  if (!property) {
    return null
  }

  const sortedItems = comparableItems
    .filter((item) => Number.isFinite(Number(item[property])))
    .slice()
    .sort((left, right) => Number(left[property]) - Number(right[property]))

  if (!sortedItems.length) {
    return null
  }

  if (currentPlan && Number.isFinite(Number(currentPlan[property]))) {
    const nextPlan = sortedItems.find((item) => Number(item[property]) > Number(currentPlan[property]))
    if (nextPlan) {
      return nextPlan
    }
  }

  return sortedItems[sortedItems.length - 1]
}

function buildRecommendationScoreContext(items = [], fields = []) {
  const normalizedFields = uniqueArray(fields.filter(Boolean))
  const fieldStats = Object.fromEntries(normalizedFields.map((field) => {
    const values = items
      .map((plan) => getFieldRankingValue(plan, field))
      .filter((value) => value != null)

    if (!values.length) {
      return [field, { min: null, max: null }]
    }

    return [field, { min: Math.min(...values), max: Math.max(...values) }]
  }))

  return {
    fields: normalizedFields,
    fieldStats,
  }
}

function scorePlanForRecommendation(plan, scoreContext = null) {
  if (!plan || !scoreContext?.fields?.length) {
    return 0
  }

  return scoreContext.fields.reduce((score, field) => {
    const stats = scoreContext.fieldStats?.[field] ?? null
    const value = getFieldRankingValue(plan, field)
    if (value == null || stats?.min == null || stats?.max == null) {
      return score
    }

    if (stats.max === stats.min) {
      return score + 1
    }

    if (field === "price") {
      return score + ((stats.max - Number(value)) / (stats.max - stats.min))
    }

    return score + ((Number(value) - stats.min) / (stats.max - stats.min))
  }, 0)
}

function isUpgradeCandidate(plan, currentPlan, fields = []) {
  if (!plan || !currentPlan || plan.slug === currentPlan.slug) {
    return false
  }

  const improvementFields = fields.filter((field) => isImprovementField(field))
  if (!improvementFields.length) {
    return false
  }

  let improved = false

  for (const field of improvementFields) {
    const planValue = getFieldRankingValue(plan, field)
    const currentValue = getFieldRankingValue(currentPlan, field)
    if (planValue == null || currentValue == null) {
      return false
    }
    if (planValue < currentValue) {
      return false
    }
    if (planValue > currentValue) {
      improved = true
    }
  }

  return improved
}

function buildMultiCriteriaRecommendation(items = [], fields = [], currentPlan = null) {
  const comparableItems = items.filter((plan) => fields.every((field) => buildFactValue(plan, field) != null))
  if (!comparableItems.length) {
    return null
  }

  const scoreContext = buildRecommendationScoreContext(comparableItems, fields)
  const priceAware = fields.includes("price")
  const compareByScore = (left, right) => {
    const scoreDelta = scorePlanForRecommendation(right, scoreContext) - scorePlanForRecommendation(left, scoreContext)
    if (scoreDelta !== 0) {
      return scoreDelta
    }

    if (left.amount != null && right.amount != null) {
      return Number(left.amount) - Number(right.amount)
    }

    return left.name.localeCompare(right.name)
  }

  if (currentPlan) {
    const upgradeCandidates = comparableItems.filter((plan) => isUpgradeCandidate(plan, currentPlan, fields))
    if (upgradeCandidates.length) {
      const rankedUpgrades = upgradeCandidates.slice().sort((left, right) => {
        if (priceAware && left.amount != null && right.amount != null) {
          const priceDelta = Number(left.amount) - Number(right.amount)
          if (priceDelta !== 0) {
            return priceDelta
          }
        }

        return compareByScore(left, right)
      })

      return rankedUpgrades[0] ?? null
    }
  }

  const rankedItems = comparableItems
    .slice()
    .sort(compareByScore)

  if (currentPlan) {
    const currentScore = scorePlanForRecommendation(currentPlan, scoreContext)
    const betterThanCurrent = rankedItems.find((plan) => scorePlanForRecommendation(plan, scoreContext) > currentScore)
    if (betterThanCurrent) {
      return betterThanCurrent
    }
  }

  return rankedItems[0] ?? null
}

export function buildBillingReplyResult(runtimeConfig = {}, context = {}, decision = null) {
  const items = getStructuredPricingItems(runtimeConfig)
  if (!items.length || !decision?.kind) {
    return null
  }

  const wantsStructured = context?.channel?.kind !== "whatsapp"
  const hasWhatsAppDestination = hasConfiguredWhatsAppDestination(context)
  const multiCta = hasWhatsAppDestination
    ? runtimeConfig?.pricingCatalog?.ctaMultiple || "Se quiser, eu comparo as opcoes e sigo com voce no WhatsApp."
    : runtimeConfig?.pricingCatalog?.ctaMultiple || "Se quiser, eu comparo as opcoes e sigo com voce por aqui."
  const singleCta = hasWhatsAppDestination
    ? runtimeConfig?.pricingCatalog?.ctaSingle || "Se quiser, eu sigo com voce por aqui ou no WhatsApp."
    : runtimeConfig?.pricingCatalog?.ctaSingle || "Se quiser, eu sigo com voce por aqui."

  const requestedPlans = resolveRequestedPlans(decision, items, context)
  const selectedPlan = requestedPlans[0] ?? null
  const targetField = sanitizeString(decision?.targetField)
  const targetFields = resolveDecisionTargetFields(decision)

  if (decision.kind === "plan_limit_question" || decision.kind === "plan_feature_question") {
    if (!selectedPlan) {
      return {
        reply: "Preciso que voce me diga qual plano voce quer consultar.",
        metadata: {
          targetPlan: null,
          targetField,
          fieldFound: false,
          replyStrategy: "missing_plan_focus",
        },
      }
    }

    const resolvedFields = targetFields.length ? targetFields : targetField ? [targetField] : []
    const missingField = resolvedFields.find((field) => !buildFactValue(selectedPlan, field))
    if (missingField) {
      return {
        reply: buildFallbackFieldMissingReply(selectedPlan, missingField) + buildAvailableFieldsHint([selectedPlan]),
        metadata: {
          targetPlan: selectedPlan.slug,
          targetField: missingField,
          targetFields: resolvedFields,
          fieldFound: false,
          replyStrategy: "missing_structured_field",
        },
      }
    }

    const sentences = resolvedFields.map((field) => buildFactSentence(selectedPlan, field)).filter(Boolean)

    return {
      reply: sentences.join("\n"),
      metadata: {
        targetPlan: selectedPlan.slug,
        targetField: targetField || resolvedFields[0] || null,
        targetFields: resolvedFields,
        fieldFound: true,
        replyStrategy: resolvedFields.length > 1 ? "structured_plan_fact_multi" : "structured_plan_fact",
      },
    }
  }

  if (decision.kind === "plan_recommendation") {
    const comparisonPlans = resolveComparisonFocusPlans(context, items)
    const recommendationPool = comparisonPlans.length >= 2 ? comparisonPlans : items
    const recommendationFields = buildRecommendationFields(decision, context, recommendationPool)
    const recommendationField = recommendationFields[0] || null
    const currentPlan = selectedPlan ?? items.find((item) => item.slug === sanitizeString(context?.billing?.planFocus?.slug)) ?? null
    if (!recommendationFields.length) {
      return {
        reply: buildClarifyingRecommendationReply(recommendationPool),
        metadata: {
          targetPlan: null,
          targetField: null,
          targetFields: [],
          fieldFound: false,
          replyStrategy: "missing_recommendation_criterion",
        },
      }
    }
    const recommendedPlan =
      recommendationFields.length > 1
        ? buildMultiCriteriaRecommendation(recommendationPool, recommendationFields, currentPlan)
        : buildPlanRecommendation(recommendationPool, recommendationField, currentPlan)
    if (!recommendedPlan) {
      return {
        reply: `Nao encontrei no catalogo dados estruturados suficientes para recomendar um plano com seguranca.${buildAvailableFieldsHint(recommendationPool)}`,
        metadata: {
          targetPlan: null,
          targetField: recommendationField,
          targetFields: recommendationFields,
          fieldFound: false,
          replyStrategy: "missing_recommendation_basis",
        },
      }
    }

    const recommendationLead = buildRecommendationLead(recommendedPlan, currentPlan, recommendationFields, recommendationPool)
    const factLines = recommendationFields.map((field) => buildFactSentence(recommendedPlan, field)).filter(Boolean)

    return {
      reply: [recommendationLead, ...factLines].filter(Boolean).join("\n"),
      metadata: {
        targetPlan: recommendedPlan.slug,
        targetField: recommendationField,
        targetFields: recommendationFields,
        fieldFound: true,
        replyStrategy: recommendationFields.length > 1 ? "structured_plan_recommendation_multi" : "structured_plan_recommendation",
      },
    }
  }

  if (decision.kind === "highest_priced_plan" || decision.kind === "lowest_priced_plan") {
    const ranked = items.filter((item) => item.amount != null).sort((left, right) =>
      decision.kind === "highest_priced_plan" ? Number(right.amount) - Number(left.amount) : Number(left.amount) - Number(right.amount)
    )
    const selected = ranked[0] || null
    if (!selected) {
      return null
    }

    return {
      reply:
        decision.kind === "highest_priced_plan"
          ? `O plano mais caro hoje e o ${selected.name}: ${selected.priceLabel}.`
          : `O plano mais barato hoje e o ${selected.name}: ${selected.priceLabel}.`,
      metadata: {
        targetPlan: selected.slug,
        targetField: "price",
        fieldFound: true,
        replyStrategy: "structured_price_rank",
      },
    }
  }

  if (decision.kind === "specific_plan_question" && selectedPlan) {
    const lines = buildSinglePlanSummary(selectedPlan)
    return {
      reply: wantsStructured ? [`**Plano solicitado**`, ...lines].join("\n") : `${selectedPlan.name}: ${selectedPlan.priceLabel}. ${singleCta}`,
      metadata: {
        targetPlan: selectedPlan.slug,
        targetField: targetField || "overview",
        fieldFound: true,
        replyStrategy: "structured_plan_summary",
      },
    }
  }

  if (decision.kind === "plan_comparison" && requestedPlans.length >= 2) {
    const comparisonFields = targetFields.filter(Boolean)
    const effectiveComparisonFields = comparisonFields.length ? comparisonFields : deriveRecommendationFieldsFromPlans(requestedPlans)
    const focusedReply = comparisonFields.length ? buildFocusedComparisonReply(requestedPlans, comparisonFields) : null
    const lines = focusedReply ? [focusedReply] : requestedPlans.map((item) => `- ${buildComparisonPlanSummary(item)}`)
    return {
      reply: wantsStructured ? [`**Comparacao de planos**`, ...lines, "", multiCta].join("\n") : `${lines.join(" | ")}. ${multiCta}`,
      metadata: {
        targetPlan: requestedPlans.map((item) => item.slug).join(","),
        targetField: targetField || effectiveComparisonFields[0] || "price",
        targetFields: effectiveComparisonFields,
        fieldFound: true,
        replyStrategy: comparisonFields.length ? "structured_plan_comparison_multi" : "structured_plan_comparison",
      },
    }
  }

  if (decision.kind === "pricing_overview" || decision.kind === "plan_comparison" || decision.kind === "specific_plan_question") {
    const lines = items.map((item) => `- ${item.name}: ${item.priceLabel}`)
    return {
      reply: wantsStructured ? [`**Valores disponiveis**`, ...lines, "", multiCta].join("\n") : `${lines.join(" | ")}. ${multiCta}`,
      metadata: {
        targetPlan: null,
        targetField: "price",
        fieldFound: true,
        replyStrategy: "structured_pricing_overview",
      },
    }
  }

  return null
}

export function buildBillingContextUpdate(decision = null, runtimeConfig = {}, context = {}) {
  const items = getStructuredPricingItems(runtimeConfig)
  if (!items.length || !decision?.kind) {
    return null
  }

  const requestedPlans = resolveRequestedPlans(decision, items, context)
  const requestedSinglePlan = requestedPlans.length === 1 ? requestedPlans[0] : null
  const targetField = sanitizeString(decision?.targetField)
  const recommendationField = targetField || resolveDecisionTargetFields(decision)[0] || "attendance_limit"
  const currentPlan = requestedSinglePlan ?? items.find((item) => item.slug === sanitizeString(context?.billing?.planFocus?.slug)) ?? null
  const requestedFields = resolveDecisionTargetFields(decision)
  const recommendationPool = resolveComparisonFocusPlans(context, items)
  const comparisonFields = Array.isArray(context?.billing?.comparisonFocus?.fields)
    ? context.billing.comparisonFocus.fields.map((field) => sanitizeString(field)).filter(Boolean)
    : []
  const effectiveRecommendationFields = buildRecommendationFields(decision, context, recommendationPool.length >= 2 ? recommendationPool : items)
  const selectedPlan =
    decision.kind === "plan_recommendation"
      ? effectiveRecommendationFields.length > 1
        ? buildMultiCriteriaRecommendation(recommendationPool.length >= 2 ? recommendationPool : items, effectiveRecommendationFields, currentPlan)
        : effectiveRecommendationFields.length === 1
          ? buildPlanRecommendation(recommendationPool.length >= 2 ? recommendationPool : items, effectiveRecommendationFields[0] || recommendationField, currentPlan)
          : null
      : requestedSinglePlan
  const shouldUpdatePlanFocus =
    Boolean(selectedPlan) &&
    [
      "specific_plan_question",
      "plan_limit_question",
      "plan_feature_question",
      "plan_recommendation",
      "highest_priced_plan",
      "lowest_priced_plan",
    ].includes(decision.kind)

  const nextUpdate = {
    lastIntent: decision.kind,
    lastField: targetField || requestedFields[0] || comparisonFields[0] || null,
    lastFields: requestedFields.length ? requestedFields : comparisonFields,
    updatedAt: new Date().toISOString(),
  }

  if (shouldUpdatePlanFocus) {
    nextUpdate.planFocus = {
      slug: selectedPlan.slug,
      name: selectedPlan.name,
      updatedAt: nextUpdate.updatedAt,
    }
  }

  if (decision.kind === "plan_comparison" && requestedPlans.length >= 2) {
    const effectiveComparisonFields = requestedFields.length ? requestedFields : deriveRecommendationFieldsFromPlans(requestedPlans)
    nextUpdate.comparisonFocus = {
      plans: requestedPlans.map((plan) => ({
        slug: plan.slug,
        name: plan.name,
      })),
      fields: effectiveComparisonFields,
      updatedAt: nextUpdate.updatedAt,
    }
  }

  return nextUpdate
}
