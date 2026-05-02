'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

const STORE_REFRESH_INTERVAL_MS = 30 * 60 * 1000

function getRefreshStorageKey(storeSlug) {
  return `infrastudio-ml-store-refresh:${storeSlug}`
}

function shouldRequestRefresh(storeSlug) {
  if (typeof window === 'undefined' || !storeSlug) {
    return false
  }

  try {
    const storageKey = getRefreshStorageKey(storeSlug)
    const previous = Number(window.sessionStorage.getItem(storageKey) || 0) || 0
    const now = Date.now()
    if (previous && previous > now - STORE_REFRESH_INTERVAL_MS) {
      return false
    }
    window.sessionStorage.setItem(storageKey, String(now))
    return true
  } catch {
    return true
  }
}

export function StoreSnapshotRefresh({ storeSlug }) {
  const router = useRouter()

  useEffect(() => {
    if (!shouldRequestRefresh(storeSlug)) {
      return
    }

    const controller = new AbortController()

    async function requestRefresh() {
      try {
        const response = await fetch(`/api/public/loja/${encodeURIComponent(storeSlug)}/snapshot-refresh`, {
          method: 'POST',
          cache: 'no-store',
          signal: controller.signal,
        })
        const data = await response.json().catch(() => ({}))
        if (!controller.signal.aborted && response.ok && data?.changed === true) {
          router.refresh()
        }
      } catch {}
    }

    requestRefresh()
    return () => controller.abort()
  }, [router, storeSlug])

  return null
}
