'use client'

import { useCallback, useSyncExternalStore } from 'react'

const STORAGE_KEY = 'gunpla-price-checker:favorite-stores'
const DEFAULT_STORES = ['ヨドバシカメラ', 'ジョーシン', 'イエローサブマリン', 'ホビーステーション']

// useSyncExternalStoreはgetSnapshotが呼ばれるたびに同じ参照を返さないと
// 再レンダーが無限に走ってしまうため、localStorageの生の値が変わっていなければ
// 前回パースした配列をそのまま返すようにキャッシュする
let cachedRaw: string | null = null
let cachedStores: string[] = DEFAULT_STORES

function readStores(): string[] {
  if (typeof window === 'undefined') return DEFAULT_STORES

  const raw = window.localStorage.getItem(STORAGE_KEY)
  if (raw === cachedRaw) return cachedStores

  cachedRaw = raw
  if (!raw) {
    cachedStores = DEFAULT_STORES
    return cachedStores
  }

  try {
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed) && parsed.every((s) => typeof s === 'string')) {
      cachedStores = parsed
      return cachedStores
    }
  } catch {
    // 壊れたデータは無視してデフォルトのまま使う
  }
  cachedStores = DEFAULT_STORES
  return cachedStores
}

const listeners = new Set<() => void>()

function subscribe(callback: () => void): () => void {
  listeners.add(callback)
  return () => listeners.delete(callback)
}

// 店舗名の一覧をlocalStorageに保存し、使うたびに新しい店舗を自動で追加する
// （ログイン不要の個人用ツールのため、端末内で完結するシンプルな永続化にしている）
export function useFavoriteStores() {
  const stores = useSyncExternalStore(subscribe, readStores, () => DEFAULT_STORES)

  const addStore = useCallback((name: string) => {
    const trimmed = name.trim()
    if (!trimmed) return
    const current = readStores()
    if (current.includes(trimmed)) return
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify([trimmed, ...current]))
    listeners.forEach((listener) => listener())
  }, [])

  return { stores, addStore }
}
