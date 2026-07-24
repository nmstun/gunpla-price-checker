'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { fetchStores, insertStore, updateStoreRecord, deleteStoreRecord, StoreInput } from '@/lib/supabase/stores'

// 旧バージョンで使っていたlocalStorageキー。DBに何も登録されていない場合のみ、
// 一度だけこのデータをDBへ移行する（後方互換・端末に残っていた登録内容を失わないため）
const LEGACY_STORAGE_KEY = 'gunpla-price-checker:favorite-stores'

export interface FavoriteStore {
  id: string
  name: string
  address: string
  url: string
}

// "example.com"のようにプロトコルなしで入力されると<a href>が相対パス扱いになり
// 自サイト内のパスに解決されてしまう（外部リンクにならない）ため、保存時に補う
function normalizeUrl(raw: string): string {
  const trimmed = raw.trim()
  if (!trimmed) return ''
  if (/^https?:\/\//i.test(trimmed)) return trimmed
  return `https://${trimmed}`
}

function sortByName(stores: FavoriteStore[]): FavoriteStore[] {
  return [...stores].sort((a, b) => a.name.localeCompare(b.name, 'ja'))
}

// 旧バージョンは店舗名だけのstring[]、その後は{name,address,url}[]で
// localStorageに保存していたため、両方の形式を読めるようにしておく
function readLegacyLocalStores(): StoreInput[] {
  if (typeof window === 'undefined') return []
  const raw = window.localStorage.getItem(LEGACY_STORAGE_KEY)
  if (!raw) return []

  try {
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
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
  } catch {
    // 壊れたデータは無視する
  }
  return []
}

// 店舗一覧をDB（Supabaseのstoresテーブル）に保存する。端末・ブラウザをまたいで
// 共有するためlocalStorageではなくDBを使う（以前はlocalStorage単独管理だったため、
// 初回アクセス時にDBが空ならlocalStorageの内容を一度だけ移行する）
export function useFavoriteStores() {
  const [stores, setStores] = useState<FavoriteStore[]>([])
  const storesRef = useRef<FavoriteStore[]>([])

  useEffect(() => {
    storesRef.current = stores
  }, [stores])

  useEffect(() => {
    let cancelled = false

    async function load() {
      const remote = await fetchStores()
      if (remote.length === 0) {
        const legacy = readLegacyLocalStores()
        if (legacy.length > 0) {
          for (const store of legacy) {
            await insertStore(store)
          }
          window.localStorage.removeItem(LEGACY_STORAGE_KEY)
          const migrated = await fetchStores()
          if (!cancelled) setStores(sortByName(migrated))
          return
        }
      }
      if (!cancelled) setStores(sortByName(remote))
    }

    load()
    return () => {
      cancelled = true
    }
  }, [])

  const addStore = useCallback(async (name: string, address = '', url = '') => {
    const trimmed = name.trim()
    if (!trimmed) return
    if (storesRef.current.some((s) => s.name === trimmed)) return

    const created = await insertStore({ name: trimmed, address: address.trim(), url: normalizeUrl(url) })
    if (created) setStores((prev) => sortByName([...prev, created]))
  }, [])

  const removeStore = useCallback(async (name: string) => {
    if (!storesRef.current.some((s) => s.name === name)) return
    const ok = await deleteStoreRecord(name)
    if (ok) setStores((prev) => prev.filter((s) => s.name !== name))
  }, [])

  // 店舗名・住所・URLを編集する。店舗名を変更しても、既にDBに記録済みの
  // scan_history.store_name（文字列として保存済み）は遡って変わらないが、
  // store_idで紐づいている行は表示時にこの新しい名前を参照できる
  const updateStore = useCallback(async (originalName: string, updated: StoreInput) => {
    const trimmedName = updated.name.trim()
    if (!trimmedName) return
    if (!storesRef.current.some((s) => s.name === originalName)) return
    // 既存の別店舗と同じ名前への変更は重複を避けるため何もしない
    if (trimmedName !== originalName && storesRef.current.some((s) => s.name === trimmedName)) return

    const normalized = { name: trimmedName, address: updated.address.trim(), url: normalizeUrl(updated.url) }
    const ok = await updateStoreRecord(originalName, normalized)
    if (ok) {
      setStores((prev) =>
        sortByName(prev.map((s) => (s.name === originalName ? { ...s, ...normalized } : s)))
      )
    }
  }, [])

  return { stores, addStore, removeStore, updateStore }
}
