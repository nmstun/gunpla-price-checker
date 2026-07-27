import { createClient as createBrowserClient } from './client'

export interface Coordinates {
  latitude: number
  longitude: number
}

export interface StoreRecord {
  id: string
  name: string
  address: string
  url: string
  latitude: number | null
  longitude: number | null
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
  latitude: number | null
  longitude: number | null
}

const SELECT_COLUMNS = 'id, name, address, url, latitude, longitude'

function mapRow(row: StoreRow): StoreRecord {
  return {
    id: row.id,
    name: row.name,
    address: row.address,
    url: row.url,
    latitude: row.latitude,
    longitude: row.longitude,
  }
}

// 住所を緯度経度に変換する。地図に複数店舗のピンを立てるために必要で、
// 住所を保存するタイミングで一度だけ変換して結果をDBに持たせる
// （表示のたびに外部APIへ問い合わせると遅く、公開APIへの負荷にもなるため）
export async function geocodeAddress(address: string): Promise<Coordinates | null> {
  const trimmed = address.trim()
  if (!trimmed) return null

  try {
    const res = await fetch('/api/geocode', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ address: trimmed }),
    })
    if (!res.ok) return null
    const data = (await res.json()) as { latitude: number | null; longitude: number | null }
    if (data.latitude === null || data.longitude === null) return null
    return { latitude: data.latitude, longitude: data.longitude }
  } catch {
    // 座標が取れなくても店舗の登録自体は成立させる（地図に出ないだけ）
    return null
  }
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

  const coordinates = await geocodeAddress(store.address)
  const { data, error } = await supabase
    .from('stores')
    .insert([{ ...store, latitude: coordinates?.latitude ?? null, longitude: coordinates?.longitude ?? null }])
    .select(SELECT_COLUMNS)
    .single()
  if (error) {
    console.error('店舗の追加に失敗:', error)
    return null
  }
  return data ? mapRow(data as StoreRow) : null
}

// 旧localStorageからの一括移行用。1件ずつinsertするとN回の往復が発生するため、
// まとめて1回のinsertで登録する（登録後のid付きレコードは呼び出し元では使わないため返さない）。
// 座標は未設定のままにし、店舗管理画面を開いたときの補完に任せる
export async function insertStores(stores: StoreInput[]): Promise<boolean> {
  if (stores.length === 0) return true
  const supabase = createBrowserClient()
  if (!supabase) return false

  const { error } = await supabase.from('stores').insert(stores)
  if (error) {
    console.error('店舗の一括追加に失敗:', error)
    return false
  }
  return true
}

export async function updateStoreRecord(originalName: string, updated: StoreInput): Promise<StoreRecord | null> {
  const supabase = createBrowserClient()
  if (!supabase) return null

  const coordinates = await geocodeAddress(updated.address)
  const { data, error } = await supabase
    .from('stores')
    .update({ ...updated, latitude: coordinates?.latitude ?? null, longitude: coordinates?.longitude ?? null })
    .eq('name', originalName)
    .select(SELECT_COLUMNS)
    .single()
  if (error) {
    console.error('店舗の更新に失敗:', error)
    return null
  }
  return data ? mapRow(data as StoreRow) : null
}

// 住所はあるのに座標が未設定の店舗（座標対応前に登録された行・一括移行された行）を
// 後から補完する。店舗管理画面を開いたときに走らせ、次回以降は変換不要になる
export async function saveStoreCoordinates(id: string, coordinates: Coordinates): Promise<boolean> {
  const supabase = createBrowserClient()
  if (!supabase) return false

  const { error } = await supabase
    .from('stores')
    .update({ latitude: coordinates.latitude, longitude: coordinates.longitude })
    .eq('id', id)
  if (error) {
    console.error('店舗の座標保存に失敗:', error)
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
