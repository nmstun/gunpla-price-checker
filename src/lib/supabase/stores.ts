import { createClient as createBrowserClient } from './client'

export interface StoreRecord {
  id: string
  name: string
  address: string
  url: string
}

export interface StoreInput {
  name: string
  address: string
  url: string
}

interface StoreRow {
  id: string
  name: string
  address: string
  url: string
}

const SELECT_COLUMNS = 'id, name, address, url'

function mapRow(row: StoreRow): StoreRecord {
  return { id: row.id, name: row.name, address: row.address, url: row.url }
}

// 店舗一覧画面・スキャン画面から呼ぶ（クライアントコンポーネント用）。
// 端末・ブラウザをまたいで共有するため、localStorageではなくDBに保存する
export async function fetchStores(): Promise<StoreRecord[]> {
  const supabase = createBrowserClient()
  if (!supabase) return []

  const { data, error } = await supabase.from('stores').select(SELECT_COLUMNS)

  if (error) {
    console.error('店舗一覧の取得に失敗:', error)
    return []
  }

  return ((data ?? []) as StoreRow[]).map(mapRow)
}

// 追加した店舗のid付きレコードを返す（スキャン履歴保存時にstore_idとして使うため）
export async function insertStore(store: StoreInput): Promise<StoreRecord | null> {
  const supabase = createBrowserClient()
  if (!supabase) return null

  const { data, error } = await supabase.from('stores').insert([store]).select(SELECT_COLUMNS).single()
  if (error) {
    console.error('店舗の追加に失敗:', error)
    return null
  }
  return data ? mapRow(data as StoreRow) : null
}

export async function updateStoreRecord(originalName: string, updated: StoreInput): Promise<boolean> {
  const supabase = createBrowserClient()
  if (!supabase) return false

  const { error } = await supabase.from('stores').update(updated).eq('name', originalName)
  if (error) {
    console.error('店舗の更新に失敗:', error)
    return false
  }
  return true
}

export async function deleteStoreRecord(name: string): Promise<boolean> {
  const supabase = createBrowserClient()
  if (!supabase) return false

  const { error } = await supabase.from('stores').delete().eq('name', name)
  if (error) {
    console.error('店舗の削除に失敗:', error)
    return false
  }
  return true
}
