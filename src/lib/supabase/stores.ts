import { createClient as createBrowserClient } from './client'

export interface StoreRecord {
  name: string
  address: string
  url: string
}

interface StoreRow {
  name: string
  address: string
  url: string
}

const SELECT_COLUMNS = 'name, address, url'

function mapRow(row: StoreRow): StoreRecord {
  return { name: row.name, address: row.address, url: row.url }
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

export async function insertStore(store: StoreRecord): Promise<boolean> {
  const supabase = createBrowserClient()
  if (!supabase) return false

  const { error } = await supabase.from('stores').insert([store])
  if (error) {
    console.error('店舗の追加に失敗:', error)
    return false
  }
  return true
}

export async function updateStoreRecord(originalName: string, updated: StoreRecord): Promise<boolean> {
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
