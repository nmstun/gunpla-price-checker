'use client'

import { useCallback, useSyncExternalStore } from 'react'

const STORAGE_KEY = 'gunpla-price-checker:favorite-stores'

export interface FavoriteStore {
  name: string
  address: string
  url: string
}

const EMPTY_STORES: FavoriteStore[] = []

// "example.com"のようにプロトコルなしで入力されると<a href>が相対パス扱いになり
// 自サイト内のパスに解決されてしまう（外部リンクにならない）ため、保存時に補う
function normalizeUrl(raw: string): string {
  const trimmed = raw.trim()
  if (!trimmed) return ''
  if (/^https?:\/\//i.test(trimmed)) return trimmed
  return `https://${trimmed}`
}

// useSyncExternalStoreはgetSnapshotが呼ばれるたびに同じ参照を返さないと
// 再レンダーが無限に走ってしまうため、localStorageの生の値が変わっていなければ
// 前回パースした配列をそのまま返すようにキャッシュする
let cachedRaw: string | null = null
let cachedStores: FavoriteStore[] = EMPTY_STORES

// 旧バージョンは店舗名だけのstring[]で保存していたため、その形式で読めた場合は
// 住所・URLを空文字で補いながら新形式に変換する（後方互換）
function parseStoredStores(raw: string): FavoriteStore[] | null {
  const parsed = JSON.parse(raw)
  if (!Array.isArray(parsed)) return null

  if (parsed.every((s) => typeof s === 'string')) {
    return parsed.map((name) => ({ name, address: '', url: '' }))
  }
  if (parsed.every((s) => s && typeof s === 'object' && typeof s.name === 'string')) {
    return parsed.map((s) => ({
      name: s.name,
      address: typeof s.address === 'string' ? s.address : '',
      url: normalizeUrl(typeof s.url === 'string' ? s.url : ''),
    }))
  }
  return null
}

function readStores(): FavoriteStore[] {
  if (typeof window === 'undefined') return EMPTY_STORES

  const raw = window.localStorage.getItem(STORAGE_KEY)
  if (raw === cachedRaw) return cachedStores

  cachedRaw = raw
  if (!raw) {
    cachedStores = EMPTY_STORES
    return cachedStores
  }

  try {
    const parsed = parseStoredStores(raw)
    if (parsed) {
      cachedStores = [...parsed].sort((a, b) => a.name.localeCompare(b.name, 'ja'))
      return cachedStores
    }
  } catch {
    // 壊れたデータは無視して空のまま使う
  }
  cachedStores = EMPTY_STORES
  return cachedStores
}

const listeners = new Set<() => void>()

function subscribe(callback: () => void): () => void {
  listeners.add(callback)
  return () => listeners.delete(callback)
}

function writeStores(stores: FavoriteStore[]) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(stores))
  listeners.forEach((listener) => listener())
}

// 店舗一覧をlocalStorageに保存する（ログイン不要の個人用ツールのため、
// 端末内で完結するシンプルな永続化にしている）。一覧は常に店舗名順で返す
export function useFavoriteStores() {
  const stores = useSyncExternalStore(subscribe, readStores, () => EMPTY_STORES)

  const addStore = useCallback((name: string, address = '', url = '') => {
    const trimmed = name.trim()
    if (!trimmed) return
    const current = readStores()
    if (current.some((s) => s.name === trimmed)) return
    writeStores([{ name: trimmed, address: address.trim(), url: normalizeUrl(url) }, ...current])
  }, [])

  const removeStore = useCallback((name: string) => {
    const current = readStores()
    if (!current.some((s) => s.name === name)) return
    writeStores(current.filter((s) => s.name !== name))
  }, [])

  // 店舗名・住所・URLを編集する。店舗名を変更しても、既にDBに記録済みの
  // scan_history.store_name（文字列として保存済み）は遡って変わらない
  const updateStore = useCallback((originalName: string, updated: FavoriteStore) => {
    const trimmedName = updated.name.trim()
    if (!trimmedName) return
    const current = readStores()
    if (!current.some((s) => s.name === originalName)) return
    // 既存の別店舗と同じ名前への変更は重複を避けるため何もしない
    if (trimmedName !== originalName && current.some((s) => s.name === trimmedName)) return

    writeStores(
      current.map((s) =>
        s.name === originalName
          ? { name: trimmedName, address: updated.address.trim(), url: normalizeUrl(updated.url) }
          : s
      )
    )
  }, [])

  return { stores, addStore, removeStore, updateStore }
}
