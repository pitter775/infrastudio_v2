import { resolveRecentCatalogProductReference } from "@/lib/chat/catalog-follow-up"
import { buildProductSearchCandidates, isMercadoLivreListingIntent } from "@/lib/chat/sales-heuristics"

export function isMercadoLivrePurchaseIntent(message) {
  return /\b(gostei|quero|comprar|manda o link|vou querer)\b/i.test(String(message || ""))
}

export function isMercadoLivreDetailIntent(message) {
  return /\b(garantia|frete|estoque|detalhes|cor|material|serve|combina)\b/i.test(String(message || ""))
}

export function resolveMercadoLivreFlowState(input = {}) {
  const referencedCatalogProducts =
    input.catalogFollowUpDecision?.matchedProducts ??
    (input.resolveRecentCatalogProductReference ?? resolveRecentCatalogProductReference)(input.latestUserMessage, input.context)
  const productSearchCandidates = (input.buildProductSearchCandidates ?? buildProductSearchCandidates)(input.latestUserMessage)

  return {
    productSearchRequested: Boolean(input.detectProductSearch?.(input.latestUserMessage) || productSearchCandidates.length),
    genericMercadoLivreListingRequested: Boolean(input.isMercadoLivreListingIntent?.(input.latestUserMessage) ?? isMercadoLivreListingIntent(input.latestUserMessage)),
    loadMoreCatalogRequested: /\b(mais|outras|outros|opcoes|modelos)\b/i.test(String(input.latestUserMessage || "")),
    referencedCatalogProducts,
    currentCatalogProduct: referencedCatalogProducts?.[0] ?? input.context?.catalogo?.produtoAtual ?? null,
    catalogFollowUpDecision: input.catalogFollowUpDecision ?? null,
    productSearchTerm: productSearchCandidates[0] ?? "",
  }
}

export async function resolveMercadoLivreHeuristicState(input = {}) {
  const product = input.currentCatalogProduct ?? input.referencedCatalogProducts?.[0] ?? input.context?.catalogo?.produtoAtual
  return {
    selectedProductSalesReply: product
      ? `Esse ${product.nome} pode fazer sentido para voce. Posso te passar detalhes, preco e link.`
      : null,
    mercadoLivreHeuristicReply: null,
    mercadoLivreProducts: input.mercadoLivreProducts ?? [],
  }
}

export function resolveMercadoLivreHeuristicReply(state) {
  return state?.selectedProductSalesReply ?? state?.mercadoLivreHeuristicReply ?? null
}

export async function resolveMercadoLivreSearch() {
  return []
}
