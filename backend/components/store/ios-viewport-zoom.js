'use client'

function isIosSafari() {
  if (typeof navigator === 'undefined') {
    return false
  }

  const userAgent = navigator.userAgent || ''
  const platform = navigator.platform || ''
  const isIos = /iP(ad|hone|od)/.test(userAgent) || (platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  const isSafariEngine = /WebKit/i.test(userAgent)
  const isOtherIosBrowser = /(CriOS|FxiOS|EdgiOS|OPiOS)/i.test(userAgent)

  return isIos && isSafariEngine && !isOtherIosBrowser
}

export function resetIosInputZoom() {
  if (typeof document === 'undefined' || !isIosSafari()) {
    return
  }

  const viewport = document.querySelector('meta[name="viewport"]')
  if (!viewport) {
    return
  }

  const previousContent = viewport.getAttribute('content') || 'width=device-width, initial-scale=1'

  window.setTimeout(() => {
    viewport.setAttribute('content', `${previousContent}, maximum-scale=1`)

    window.setTimeout(() => {
      viewport.setAttribute('content', previousContent)
    }, 360)
  }, 80)
}
