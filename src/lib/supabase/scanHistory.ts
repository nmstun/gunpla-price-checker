import { createClient as createServerClient } from './server'
import { createClient as createBrowserClient } from './client'
import { ScanHistoryEntry } from '@/types'

interface SaveScanHistoryInput {
  janCode: string
  itemName: string
  officialPrice: number | null
  storeName: string
  storeId: string | null
  isPremiumBandaiExclusive: boolean
}

// APIルート（サーバー）から呼ぶ。storeNameが空なら店舗未選択のスキャンとして記録しない。
// storeIdはstoresテーブルの店舗を選択していた場合にのみ渡す（storesに未登録の店舗名を
// 選んだ場合はnullのままstore_nameの文字列だけで記録する）。
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
          store_name: storeName,
          store_id: input.storeId,
          is_premium_bandai_exclusive: input.isPremiumBandaiExclusive,
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
  officialPrice: number | null
  isPremiumBandaiExclusive: boolean
}

// 定価再取得APIルート（サーバー）から呼ぶ。既存の履歴行を最新の定価情報で上書きする。
// 最安値は都度取得の値なので保存しない（呼び出し元がレスポンスとして表示するだけ）。
// 公式定価を取得できた場合のみofficial_priceを更新し手動フラグを下ろす。
// 取得できなかった（null）場合はofficial_priceを触らない＝ユーザーの手動入力値を
// 再取得の空振りで消してしまわないようにする（商品名・プレバン限定判定は都度更新する）
export async function refreshScanHistoryPrice(id: string, input: RefreshScanHistoryInput): Promise<boolean> {
  const supabase = createServerClient()
  if (!supabase) return false

  const update: Record<string, unknown> = {
    item_name: input.itemName,
    is_premium_bandai_exclusive: input.isPremiumBandaiExclusive,
  }
  if (input.officialPrice !== null) {
    update.official_price = input.officialPrice
    update.official_price_is_manual = false
  }

  const { error } = await supabase.from('scan_history').update(update).eq('id', id)

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
  official_price: number | null
  official_price_is_manual: boolean
  is_premium_bandai_exclusive: boolean
  store_name: string
  stores: { name: string } | null
  store_price: number | null
  scanned_at: string
}

const SELECT_COLUMNS =
  'id, jan_code, item_name, official_price, official_price_is_manual, is_premium_bandai_exclusive, store_name, stores(name), store_price, scanned_at'

// store_idでstoresと紐づいている行は、リネーム後も追従できるようstoresの現在の
// 店舗名を優先して表示する。紐づいていない（店舗削除済み・store_id未設定の古い行）
// 場合はスキャン時点のstore_nameスナップショットにフォールバックする
function mapRow(row: ScanHistoryRow): ScanHistoryEntry {
  return {
    id: row.id,
    janCode: row.jan_code,
    itemName: row.item_name,
    officialPrice: row.official_price === null ? null : Number(row.official_price),
    officialPriceIsManual: row.official_price_is_manual ?? false,
    isPremiumBandaiExclusive: row.is_premium_bandai_exclusive ?? false,
    storeName: row.stores?.name ?? row.store_name,
    storePrice: row.store_price,
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

  return ((data ?? []) as unknown as ScanHistoryRow[]).map(mapRow)
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
  return data ? mapRow(data as unknown as ScanHistoryRow) : null
}

// 履歴一覧のスワイプ削除から呼ぶ（クライアントコンポーネント用）
export async function deleteScanHistoryEntry(id: string): Promise<boolean> {
  const supabase = createBrowserClient()
  if (!supabase) return false

  const { error } = await supabase.from('scan_history').delete().eq('id', id)
  if (error) {
    console.error('スキャン履歴の削除に失敗:', error)
    return false
  }
  return true
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

// 履歴詳細画面から呼ぶ（クライアントコンポーネント用）。定価をどうしても自動取得
// できない商品向けの手動入力・編集。値を入れると手動フラグを立て（UIで「手動入力」
// バッジを出すため）、nullを渡すと未確認状態（手動フラグも解除）に戻せる
export async function updateOfficialPrice(id: string, officialPrice: number | null): Promise<boolean> {
  const supabase = createBrowserClient()
  if (!supabase) return false

  const { error } = await supabase
    .from('scan_history')
    .update({
      official_price: officialPrice,
      official_price_is_manual: officialPrice !== null,
    })
    .eq('id', id)
  if (error) {
    console.error('定価の手動更新に失敗:', error)
    return false
  }
  return true
}
