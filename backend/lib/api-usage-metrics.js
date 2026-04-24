import "server-only"

function getMetricsState() {
  const globalKey = "__infrastudioApiUsageMetrics"

  if (!globalThis[globalKey]) {
    globalThis[globalKey] = {
      entries: new Map(),
    }
  }

  return globalThis[globalKey]
}

function buildMetricKey(input = {}) {
  return [
    input.route || "unknown",
    input.method || "GET",
    String(input.status || 200),
  ].join(":")
}

export function measureJsonPayloadBytes(payload) {
  try {
    return Buffer.byteLength(JSON.stringify(payload), "utf8")
  } catch {
    return null
  }
}

function roundNumber(value, digits = 2) {
  if (!Number.isFinite(value)) {
    return 0
  }

  return Number(value.toFixed(digits))
}

export function recordApiUsage(input = {}) {
  const state = getMetricsState()
  const key = buildMetricKey(input)
  const bytes = Number.isFinite(input.bytes) ? input.bytes : 0
  const elapsedMs = Number.isFinite(input.elapsedMs) ? input.elapsedMs : 0
  const now = Date.now()
  const current = state.entries.get(key) || {
    route: input.route || "unknown",
    method: input.method || "GET",
    status: input.status || 200,
    requests: 0,
    totalBytes: 0,
    totalElapsedMs: 0,
    maxBytes: 0,
    lastProjectId: null,
    lastUserId: null,
    lastSource: null,
    lastLoggedAt: 0,
  }

  current.requests += 1
  current.totalBytes += bytes
  current.totalElapsedMs += elapsedMs
  current.maxBytes = Math.max(current.maxBytes, bytes)
  current.lastProjectId = input.projectId || current.lastProjectId || null
  current.lastUserId = input.userId || current.lastUserId || null
  current.lastSource = input.source || current.lastSource || null
  state.entries.set(key, current)

  const shouldLog =
    current.requests === 1 ||
    current.requests % 20 === 0 ||
    bytes >= 150 * 1024 ||
    now - current.lastLoggedAt >= 60_000

  if (!shouldLog) {
    return
  }

  current.lastLoggedAt = now

  console.info(
    "[api-usage]",
    JSON.stringify({
      route: current.route,
      method: current.method,
      status: current.status,
      requests: current.requests,
      totalKB: roundNumber(current.totalBytes / 1024),
      avgKB: roundNumber(current.totalBytes / Math.max(current.requests, 1) / 1024),
      maxKB: roundNumber(current.maxBytes / 1024),
      avgMs: roundNumber(current.totalElapsedMs / Math.max(current.requests, 1)),
      lastProjectId: current.lastProjectId,
      lastUserId: current.lastUserId,
      lastSource: current.lastSource,
    }),
  )
}

export function recordJsonApiUsage(input = {}) {
  recordApiUsage({
    ...input,
    bytes: measureJsonPayloadBytes(input.payload),
  })
}
