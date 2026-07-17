'use client'

import { useCallback, useSyncExternalStore } from 'react'

const STORAGE_KEY = 'gunpla-price-checker:selected-store'

let cachedValue: string | null = null

function readSelectedStore(): string | null {
  if (typeof window === 'undefined') return null
  return window.localStorage.getItem(STORAGE_KEY)
}

function getSnapshot(): string | null {
  cachedValue = readSelectedStore()
  return cachedValue
}

const listeners = new Set<() => void>()

function subscribe(callback: () => void): () => void {
  listeners.add(callback)
  return () => listeners.delete(callback)
}

// 選択中の読取り店舗をlocalStorageに保存し、画面遷移（スキャン画面⇔履歴画面）を
// またいでも選び直さずに済むようにする
export function useSelectedStore() {
  const selectedStore = useSyncExternalStore(subscribe, getSnapshot, () => null)

  const setSelectedStore = useCallback((store: string | null) => {
    if (store) {
      window.localStorage.setItem(STORAGE_KEY, store)
    } else {
      window.localStorage.removeItem(STORAGE_KEY)
    }
    listeners.forEach((listener) => listener())
  }, [])

  return { selectedStore, setSelectedStore }
}
