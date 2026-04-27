import { NextResponse } from "next/server"

import { expireStalePendingBillingRecords } from "@/lib/billing"
import { createLogEntry } from "@/lib/logs"
import { createCheckoutIntent, createTopUpCheckoutPreference } from "@/lib/mercado-pago-billing"
import { getProjectForUser } from "@/lib/projetos"
import { getServerPlanCheckoutUrl, listPublicPlans, TEST_BASIC_PLAN_CHECKOUT_URL } from "@/lib/public-planos-server"
import { normalizePlanKey } from "@/lib/public-planos"
import { getSessionUser } from "@/lib/session"
import { getSupabaseAdminClient } from "@/lib/supabase-admin"

export async function POST(request, { params }) {
  const user = await getSessionUser()

  if (!user) {
    return NextResponse.json({ error: "Nao autenticado." }, { status: 401 })
  }

  const { id } = await params
  const project = await getProjectForUser(id, user)

  if (!project) {
    return NextResponse.json({ error: "Projeto nao encontrado." }, { status: 404 })
  }

  const body = await request.json().catch(() => ({}))
  const type = body?.type === "topup" ? "topup" : "plan"
  const normalizedTestMode = String(body?.testMode || "").trim().toLowerCase()
  const isAdmin = user?.role === "admin"
  const supabase = getSupabaseAdminClient()

  await expireStalePendingBillingRecords(project.id, { supabase }).catch(() => null)

  if (type === "topup") {
    const intentResult = await createTopUpCheckoutPreference(
      {
        projectId: project.id,
        userId: user.id,
        userEmail: user.email,
        type: "topup",
        price: Number(body?.price || 0),
        tokens: Number(body?.tokens || 0),
        title: `Recarga InfraStudio - ${Number(body?.tokens || 0)} creditos`,
        source: body?.source || "app_checkout",
      },
      { supabase },
    )

    if (!intentResult.ok) {
      await createLogEntry(
        {
          projectId: project.id,
          type: "billing_topup_checkout_error",
          origin: "pagamento_checkout",
          level: "error",
          description: "Falha ao registrar checkout de recarga.",
          payload: {
            tipo: "topup",
            price: Number(body?.price || 0),
            tokens: Number(body?.tokens || 0),
          },
        },
        { supabase },
      )
      return NextResponse.json({ error: "Nao foi possivel registrar a recarga." }, { status: 500 })
    }

    await createLogEntry(
      {
        projectId: project.id,
        type: "billing_topup_checkout_pending",
        origin: "pagamento_checkout",
        level: "info",
        description: "Checkout de recarga iniciado e aguardando confirmacao.",
        payload: {
          tipo: "topup",
          intentId: intentResult.intentId,
          price: Number(body?.price || 0),
          tokens: Number(body?.tokens || 0),
          checkoutUrl: intentResult.checkoutUrl || null,
        },
      },
      { supabase },
    )

    return NextResponse.json(
      { ok: true, type: "topup", intentId: intentResult.intentId, checkoutUrl: intentResult.checkoutUrl || null },
      { status: 200 },
    )
  }

  const planKey = normalizePlanKey(body?.planKey || body?.planName || "")
  const plans = await listPublicPlans()
  const selectedPlan = plans.find((plan) => plan.key === planKey)
  const isBasicSheetTest = normalizedTestMode === "basic_sheet_test" && planKey === "basic"

  if (isBasicSheetTest && !isAdmin) {
    return NextResponse.json({ error: "Modo de teste restrito ao admin." }, { status: 403 })
  }

  const checkoutUrl =
    isBasicSheetTest
      ? TEST_BASIC_PLAN_CHECKOUT_URL
      : getServerPlanCheckoutUrl(selectedPlan?.key)
  const planPrice = isBasicSheetTest
    ? Number(body?.price || 1)
    : selectedPlan?.monthlyPrice

  if (!selectedPlan?.id) {
    return NextResponse.json({ error: "Plano invalido." }, { status: 400 })
  }

  if (!checkoutUrl) {
    return NextResponse.json({ error: "Checkout deste plano indisponivel no momento." }, { status: 400 })
  }

  const intentResult = await createCheckoutIntent(
    {
      projectId: project.id,
      userId: user.id,
      userEmail: user.email,
      type: "plan",
      planId: selectedPlan.id,
      planKey: selectedPlan.key,
      planName: selectedPlan.name,
      price: planPrice,
      checkoutUrl,
      source: body?.source || "app_checkout",
    },
    { supabase },
  )

  if (!intentResult.ok) {
    await createLogEntry(
      {
        projectId: project.id,
        type: "billing_plan_checkout_error",
        origin: "pagamento_checkout",
        level: "error",
        description: "Falha ao registrar checkout de plano.",
        payload: {
          tipo: "plan",
          planKey: selectedPlan.key,
          planName: selectedPlan.name,
        },
      },
      { supabase },
    )
    return NextResponse.json({ error: "Nao foi possivel registrar a troca de plano." }, { status: 500 })
  }

  await createLogEntry(
    {
      projectId: project.id,
      type: "billing_plan_checkout_pending",
      origin: "pagamento_checkout",
      level: "info",
      description: `Checkout do plano ${selectedPlan.name} iniciado e aguardando confirmacao.`,
      payload: {
        tipo: "plan",
        intentId: intentResult.intentId,
        planId: selectedPlan.id,
        planKey: selectedPlan.key,
        planName: selectedPlan.name,
      },
    },
    { supabase },
  )

  return NextResponse.json(
    {
      ok: true,
      type: "plan",
      intentId: intentResult.intentId,
      checkoutUrl,
      plan: {
        id: selectedPlan.id,
        key: selectedPlan.key,
        name: selectedPlan.name,
      },
    },
    { status: 200 },
  )
}
