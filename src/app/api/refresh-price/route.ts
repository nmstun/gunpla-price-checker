import { NextResponse } from 'next/server'
import { RefreshPriceResult } from '@/types'
import { saveItem } from '@/lib/supabase/items'
import { refreshScanHistoryPrice } from '@/lib/supabase/scanHistory'
import { fetchLivePriceInfo, isPriceLookupError } from '@/utils/priceLookup'

// キャッシュを無視して最新の定価情報を取得し、既存のスキャン履歴行を上書きする。
// 最安値は都度取得の値なのでDBには保存せず、レスポンスとして返すだけにする
export const dynamic = 'force-dynamic'
export const revalidate = 0

function isValidJanCode(janCode: unknown): janCode is string {
  return typeof janCode === 'string' && (janCode.length === 13 || janCode.length === 8)
}

export async function POST(request: Request) {
  try {
    const { scanHistoryId, janCode } = await request.json()

    if (typeof scanHistoryId !== 'string' || !scanHistoryId) {
      return NextResponse.json({ error: '不正なリクエストです' }, { status: 400 })
    }
    if (!isValidJanCode(janCode)) {
      return NextResponse.json({ error: '不正なJANコードです' }, { status: 400 })
    }

    const lookup = await fetchLivePriceInfo(janCode)
    if (isPriceLookupError(lookup)) {
      return NextResponse.json({ error: lookup.error }, { status: lookup.status })
    }

    const lowestMarketPrice = lookup.offers[0]?.price ?? null

    await saveItem(janCode, lookup.itemName, lookup.officialPrice, lookup.priceSource)
    const ok = await refreshScanHistoryPrice(scanHistoryId, {
      itemName: lookup.itemName,
      officialPrice: lookup.officialPrice,
      priceSource: lookup.priceSource,
    })
    if (!ok) {
      return NextResponse.json({ error: '履歴の更新に失敗しました' }, { status: 500 })
    }

    const result: RefreshPriceResult = {
      itemName: lookup.itemName,
      officialPrice: lookup.officialPrice,
      priceSource: lookup.priceSource,
      lowestMarketPrice,
    }
    return NextResponse.json(result)
  } catch (error) {
    console.error('システムエラー:', error)
    return NextResponse.json({ error: 'サーバーエラーが発生しました' }, { status: 500 })
  }
}
