const AGENT_TAB_URL_VALUES = {
  edit: 'editar',
  history: 'historico',
  json: 'json',
  connections: 'conexao',
}

const AGENT_TAB_ALIASES = {
  edit: 'edit',
  editar: 'edit',
  history: 'history',
  historico: 'history',
  json: 'json',
  connections: 'connections',
  conexao: 'connections',
  conexoes: 'connections',
}

export function resolveAgentTab(value) {
  return AGENT_TAB_ALIASES[String(value || '').toLowerCase()] || null
}

function getAgentTabUrlValue(tabId) {
  return AGENT_TAB_URL_VALUES[tabId] || AGENT_TAB_URL_VALUES.edit
}

export function updateAgentTabQuery(tabId) {
  const url = new URL(window.location.href)
  url.searchParams.set('tab', getAgentTabUrlValue(tabId))
  window.history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`)
}

export function updatePanelQuery(panelId, params = {}) {
  const url = new URL(window.location.href)
  url.searchParams.set('panel', panelId)
  url.searchParams.delete('tab')
  url.searchParams.delete('api')
  url.searchParams.delete('channel')
  url.searchParams.delete('widget')
  url.searchParams.delete('ml_notice')

  Object.entries(params).forEach(([key, value]) => {
    if (value) {
      url.searchParams.set(key, value)
    }
  })

  window.history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`)
}

export function clearProjectDetailQuery() {
  const url = new URL(window.location.href)
  url.searchParams.delete('panel')
  url.searchParams.delete('tab')
  url.searchParams.delete('api')
  url.searchParams.delete('channel')
  url.searchParams.delete('widget')
  url.searchParams.delete('ml_notice')
  window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`)
}
