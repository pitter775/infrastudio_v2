import { readFileSync } from "node:fs";
import path from "node:path";

function fixturesDir() {
  return path.join(process.cwd(), "tests", "fixtures");
}

function readFixtureJson(filename: string) {
  const content = readFileSync(path.join(fixturesDir(), filename), "utf-8");
  return JSON.parse(content);
}

function materializeCatalogFixture<T extends Record<string, any>>(fixture: T): T {
  if (!fixture.catalogo) {
    return fixture;
  }

  return {
    ...fixture,
    memoria: {
      ...fixture.memoria,
    },
    catalogo: {
      ...fixture.catalogo,
      snapshotCreatedAt: new Date().toISOString(),
      produtoAtual: fixture.catalogo.produtoAtual ? { ...fixture.catalogo.produtoAtual } : null,
      ultimosProdutos: Array.isArray(fixture.catalogo.ultimosProdutos)
        ? fixture.catalogo.ultimosProdutos.map((item: Record<string, any>) => ({ ...item }))
        : [],
    },
  };
}

export function loadCatalogContextFixture() {
  return materializeCatalogFixture(readFixtureJson("catalog-context.base.json"));
}

export function loadApiRuntimeFixture() {
  return readFixtureJson("api-runtime-context.products.json");
}

export function loadApiRuntimeRealEstateFixture() {
  return readFixtureJson("api-runtime-context.real-estate.json");
}

export function loadLeadContextFixture() {
  return readFixtureJson("lead-context.base.json");
}

export function loadWhatsAppContextFixture() {
  return materializeCatalogFixture(readFixtureJson("whatsapp-context.base.json"));
}

export function loadHandoffFixture() {
  return readFixtureJson("handoff-cases.json");
}

export function createFixtureSearchDeps() {
  return {
    buildProductSearchCandidates: (message: string) => {
      const normalized = normalizeFixtureText(message);
      if (!normalized || ["oi", "ola", "ok"].includes(normalized)) return [];
      if (normalized.includes("prato azul")) return ["prato azul"];
      if (normalized.includes("sopeira")) return ["sopeira"];
      if (normalized.includes("soperia")) return ["sopeira"];
      if (normalized.includes("garantia")) return [];
      return normalized.split(/\s+/).length >= 2 ? [normalized] : [];
    },
    shouldSearchProducts: (message: string) =>
      /\b(tem|procuro|buscar|mostra|me mostra|preciso de|busco)\b/i.test(message),
    isMercadoLivrePurchaseIntent: (message: string) =>
      /\b(gostei|quero|comprar|manda o link|vou querer)\b/i.test(message),
    isMercadoLivreDetailIntent: (message: string) =>
      /\b(garantia|frete|estoque|detalhes|cor|material)\b/i.test(message),
  };
}

export function normalizeFixtureText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}
