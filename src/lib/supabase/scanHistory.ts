import { createClient as createServerClient } from './server'
import { createClient as createBrowserClient } from './client'
import { PriceSource, ScanHistoryEntry } from '@/types'

interface SaveScanHistoryInput {
  janCode: string
  itemName: string
  officialPrice: number
  priceSource: PriceSource
  storeName: string
  lowestMarketPrice: number | null
}

// APIルート（サーバー）から呼ぶ。storeNameが空なら店舗未選択のスキャンとして記録しない。
// 保存できた行のidを返す（店舗の販売価格を後から編集する際に使う）
export async function saveScanHistory(input: SaveScanHistoryInput): Promise<string | null> {
  const storeName = input.storeName.trim()
  if (!storeName) return null

  const supabase = createServerClient()
  if (!supabase) return null

  try {
    const { data, error } = await supabase
      .from('scan_history')
      .insert([
        {
          jan_code: input.janCode,
          item_name: input.itemName,
          official_price: input.officialPrice,
          price_source: input.priceSource,
          store_name: storeName,
          lowest_market_price: input.lowestMarketPrice,
        },
      ])
      .select('id')
      .single()

    if (error) {
      console.error('スキャン履歴の保存スキップ:', error)
      return null
    }
    return (data?.id as string) ?? null
  } catch (dbError) {
    console.error('スキャン履歴の保存スキップ:', dbError)
    return null
  }
}

interface RefreshScanHistoryInput {
  itemName: string
  officialPrice: number
  priceSource: PriceSource
  lowestMarketPrice: number | null
}

// 定価再取得APIルート（サーバー）から呼ぶ。既存の履歴行を最新の価格情報で上書きする
export async function refreshScanHistoryPrice(id: string, input: RefreshScanHistoryInput): Promise<boolean> {
  const supabase = createServerClient()
  if (!supabase) return false

  const { error } = await supabase
    .from('scan_history')
    .update({
      item_name: input.itemName,
      official_price: input.officialPrice,
      price_source: input.priceSource,
      lowest_market_price: input.lowestMarketPrice,
    })
    .eq('id', id)

  if (error) {
    console.error('定価再取得の反映に失敗:', error)
    return false
  }
  return true
}

interface ScanHistoryRow {
  id: string
  jan_code: string
  item_name: string
  official_price: number
  price_source: PriceSource
  store_name: string
  store_price: number | null
  lowest_market_price: number | null
  scanned_at: string
}

const SELECT_COLUMNS =
  'id, jan_code, item_name, official_price, price_source, store_name, store_price, lowest_market_price, scanned_at'

function mapRow(row: ScanHistoryRow): ScanHistoryEntry {
  return {
    id: row.id,
    janCode: row.jan_code,
    itemName: row.item_name,
    officialPrice: row.official_price,
    priceSource: row.price_source,
    storeName: row.store_name,
    storePrice: row.store_price,
    lowestMarketPrice: row.lowest_market_price,
    scannedAt: row.scanned_at,
  }
}

// クライアントコンポーネント（履歴一覧画面）から呼ぶ
export async function fetchScanHistory(): Promise<ScanHistoryEntry[]> {
  const supabase = createBrowserClient()
  if (!supabase) return []

  const { data, error } = await supabase.from('scan_history').select(SELECT_COLUMNS).order('scanned_at', { ascending: false })

  if (error) {
    console.error('スキャン履歴の取得に失敗:', error)
    return []
  }

  return ((data ?? []) as ScanHistoryRow[]).map(mapRow)
}

// クライアントコンポーネント（履歴詳細画面）から呼ぶ
export async function fetchScanHistoryEntry(id: string): Promise<ScanHistoryEntry | null> {
  const supabase = createBrowserClient()
  if (!supabase) return null

  const { data, error } = await supabase.from('scan_history').select(SELECT_COLUMNS).eq('id', id).maybeSingle()

  if (error) {
    console.error('スキャン履歴の取得に失敗:', error)
    return null
  }
  return data ? mapRow(data as ScanHistoryRow) : null
}

// スキャン結果画面・履歴詳細画面の両方から呼ぶ（クライアントコンポーネント用）。
// storePriceにnullを渡すと未入力状態に戻せる
export async function updateStorePrice(id: string, storePrice: number | null): Promise<boolean> {
  const supabase = createBrowserClient()
  if (!supabase) return false

  const { error } = await supabase.from('scan_history').update({ store_price: storePrice }).eq('id', id)
  if (error) {
    console.error('店舗販売価格の更新に失敗:', error)
    return false
  }
  return true
}
