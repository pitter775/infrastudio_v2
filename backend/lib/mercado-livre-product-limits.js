import "server-only"

import { formatMercadoLivreProductLimit, getMercadoLivreProductLimitForPlan, normalizePlanKey } from "@/lib/public-planos"
import { getSupabaseAdminClient } from "@/lib/supabase-admin"

function readProjectPlanName(project) {
  const projectPlanName = String(project?.billing?.projectPlan?.planName || "").trim()
  const subscriptionPlanName = String(project?.billing?.subscription?.plan?.name || "").trim()
  const directPlanName = String(project?.planName || project?.planoNome || "").trim()

  return projectPlanName || subscriptionPlanName || directPlanName
}

async function loadProjectPlanName(projectId, supabase) {
  if (!projectId) {
    return ""
  }

  const projectPlanResult = await supabase
    .from("projetos_planos")
    .select("nome_plano, plano_id")
    .eq("projeto_id", projectId)
    .maybeSingle()

  const projectPlanName = String(projectPlanResult.data?.nome_plano || "").trim()
  if (projectPlanName) {
    return projectPlanName
  }

  const planId = projectPlanResult.data?.plano_id || null
  if (!planId) {
    return ""
  }

  const planResult = await supabase.from("planos").select("nome").eq("id", planId).maybeSingle()
  return String(planResult.data?.nome || "").trim()
}

export async function getMercadoLivreProductLimitForProject(project, deps = {}) {
  const supabase = deps.supabase ?? getSupabaseAdminClient()
  const planName = readProjectPlanName(project) || (await loadProjectPlanName(project?.id, supabase))
  const planKey = normalizePlanKey(planName || "free") || "free"
  const limit = getMercadoLivreProductLimitForPlan(planKey)

  return {
    planKey,
    planName: planName || "Free",
    limit,
    label: formatMercadoLivreProductLimit(limit),
  }
}
