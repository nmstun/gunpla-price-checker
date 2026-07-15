import { createClient as createServerClient } from './server'
import { createClient as createBrowserClient } from './client'
import { PriceSource, ScanHistoryEntry } from '@/types'

interface SaveScanHistoryInput {
  janCode: string
  itemName: string
  officialPrice: number
  priceSource: PriceSource
  storeName: string
}

// APIルート（サーバー）から呼ぶ。storeNameが空なら店舗未選択のスキャンとして記録しない
export async function saveScanHistory(input: SaveScanHistoryInput): Promise<void> {
  const storeName = input.storeName.trim()
  if (!storeName) return

  const supabase = createServerClient()
  if (!supabase) return

  try {
    const { error } = await supabase.from('scan_history').insert([
      {
        jan_code: input.janCode,
        item_name: input.itemName,
        official_price: input.officialPrice,
        price_source: input.priceSource,
        store_name: storeName,
      },
    ])
    if (error) {
      console.error('スキャン履歴の保存スキップ:', error)
    }
  } catch (dbError) {
    console.error('スキャン履歴の保存スキップ:', dbError)
  }
}

interface ScanHistoryRow {
  id: string
  jan_code: string
  item_name: string
  official_price: number
  price_source: PriceSource
  store_name: string
  scanned_at: string
}

function mapRow(row: ScanHistoryRow): ScanHistoryEntry {
  return {
    id: row.id,
    janCode: row.jan_code,
    itemName: row.item_name,
    officialPrice: row.official_price,
    priceSource: row.price_source,
    storeName: row.store_name,
    scannedAt: row.scanned_at,
  }
}

// クライアントコンポーネント（履歴一覧画面）から呼ぶ
export async function fetchScanHistory(): Promise<ScanHistoryEntry[]> {
  const supabase = createBrowserClient()
  if (!supabase) return []

  const { data, error } = await supabase
    .from('scan_history')
    .select('id, jan_code, item_name, official_price, price_source, store_name, scanned_at')
    .order('scanned_at', { ascending: false })

  if (error) {
    console.error('スキャン履歴の取得に失敗:', error)
    return []
  }

  return ((data ?? []) as ScanHistoryRow[]).map(mapRow)
}
