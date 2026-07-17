import { createClient } from './server'

// これより古いキャッシュはプレ値変動を反映しきれない可能性があるため使わない
const CACHE_FRESHNESS_MS = 24 * 60 * 60 * 1000

interface CachedItem {
  itemName: string
  officialPrice: number
  isPremiumBandaiExclusive: boolean
}

// 直近CACHE_FRESHNESS_MS以内に保存されたキャッシュがあれば返す（無ければnull）。
// バンダイ公式で確認できた商品のみキャッシュしているため、officialPriceは常に確定値
export async function getCachedItem(janCode: string): Promise<CachedItem | null> {
  const supabase = createClient()
  if (!supabase) return null

  // supabase-jsはPostgRESTのエラーレスポンスを例外として投げないため、
  // 呼び出し側でerrorを明示的に確認しないと接続不可・権限エラー等を見逃す
  const { data, error } = await supabase
    .from('items')
    .select('item_name, official_price, is_premium_bandai_exclusive, created_at')
    .eq('jan_code', janCode)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) {
    console.error('キャッシュ取得スキップ:', error)
    return null
  }
  if (!data) return null
  if (Date.now() - new Date(data.created_at).getTime() > CACHE_FRESHNESS_MS) return null

  return {
    itemName: data.item_name,
    officialPrice: Number(data.official_price),
    isPremiumBandaiExclusive: data.is_premium_bandai_exclusive ?? false,
  }
}

// バンダイ公式で確認できた商品のみ呼び出し側で保存する
// （未確認のまま24時間キャッシュしてしまうと、その間ずっとバンダイ側の再確認ができなくなるため）
export async function saveItem(
  janCode: string,
  itemName: string,
  officialPrice: number,
  isPremiumBandaiExclusive: boolean
): Promise<void> {
  const supabase = createClient()
  if (!supabase) return

  try {
    const { error } = await supabase
      .from('items')
      .upsert([
        {
          jan_code: janCode,
          item_name: itemName,
          official_price: officialPrice,
          is_premium_bandai_exclusive: isPremiumBandaiExclusive,
        },
      ])
    if (error) {
      console.error('DB保存スキップ:', error)
    }
  } catch (dbError) {
    console.error('DB保存スキップ:', dbError)
  }
}
