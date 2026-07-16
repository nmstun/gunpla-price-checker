import { NextResponse } from 'next/server'
import { RefreshPriceResult } from '@/types'
import { saveItem } from '@/lib/supabase/items'
import { refreshScanHistoryPrice } from '@/lib/supabase/scanHistory'
import { fetchLivePriceInfo, isPriceLookupError } from '@/utils/priceLookup'

// キャッシュを無視して最新の定価・最安値情報を取得する。
// persist!==falseの場合のみ、既存のスキャン履歴行の定価を上書き保存する
// （履歴詳細画面を開いた瞬間の自動取得はpersist:falseで呼び、閲覧しただけで
// 保存済みの定価が書き換わらないようにしている）。最安値はいずれの場合も保存しない
export const dynamic = 'force-dynamic'
export const revalidate = 0

function isValidJanCode(janCode: unknown): janCode is string {
  return typeof janCode === 'string' && (janCode.length === 13 || janCode.length === 8)
}

export async function POST(request: Request) {
  try {
    const { scanHistoryId, janCode, persist } = await request.json()
    const shouldPersist = persist !== false

    if (shouldPersist && (typeof scanHistoryId !== 'string' || !scanHistoryId)) {
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

    if (shouldPersist) {
      if (lookup.officialPrice !== null) {
        await saveItem(janCode, lookup.itemName, lookup.officialPrice)
      }
      const ok = await refreshScanHistoryPrice(scanHistoryId, {
        itemName: lookup.itemName,
        officialPrice: lookup.officialPrice,
      })
      if (!ok) {
        return NextResponse.json({ error: '履歴の更新に失敗しました' }, { status: 500 })
      }
    }

    const result: RefreshPriceResult = {
      itemName: lookup.itemName,
      officialPrice: lookup.officialPrice,
      lowestMarketPrice,
    }
    return NextResponse.json(result)
  } catch (error) {
    console.error('システムエラー:', error)
    return NextResponse.json({ error: 'サーバーエラーが発生しました' }, { status: 500 })
  }
}
