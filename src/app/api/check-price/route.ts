import { NextResponse } from 'next/server'
import { CheckPriceResult } from '@/types'
import { getCachedItem, saveItem } from '@/lib/supabase/items'
import { saveScanHistory } from '@/lib/supabase/scanHistory'
import { fetchLivePriceInfo, isPriceLookupError } from '@/utils/priceLookup'

// キャッシュを一切持たせないためのNext.js用設定
export const dynamic = 'force-dynamic'
export const revalidate = 0

function isValidJanCode(janCode: unknown): janCode is string {
  return typeof janCode === 'string' && (janCode.length === 13 || janCode.length === 8)
}

export async function POST(request: Request) {
  try {
    const { janCode, storeName } = await request.json()

    if (!isValidJanCode(janCode)) {
      return NextResponse.json({ error: '不正なJANコードです' }, { status: 400 })
    }
    const store = typeof storeName === 'string' ? storeName : ''

    const cached = await getCachedItem(janCode)
    if (cached) {
      const scanHistoryId = await saveScanHistory({
        janCode,
        itemName: cached.itemName,
        officialPrice: cached.officialPrice,
        storeName: store,
      })
      const result: CheckPriceResult = {
        source: 'cache',
        itemName: cached.itemName,
        officialPrice: cached.officialPrice,
        offers: [],
        scanHistoryId,
      }
      return NextResponse.json(result)
    }

    const lookup = await fetchLivePriceInfo(janCode)
    if (isPriceLookupError(lookup)) {
      return NextResponse.json({ error: lookup.error }, { status: lookup.status })
    }

    // バンダイ公式で確認できた場合のみキャッシュする（未確認のまま24時間キャッシュすると
    // その間ずっと再確認できなくなるため）
    if (lookup.officialPrice !== null) {
      await saveItem(janCode, lookup.itemName, lookup.officialPrice)
    }

    const scanHistoryId = await saveScanHistory({
      janCode,
      itemName: lookup.itemName,
      officialPrice: lookup.officialPrice,
      storeName: store,
    })

    const result: CheckPriceResult = {
      source: 'live_fetch',
      itemName: lookup.itemName,
      officialPrice: lookup.officialPrice,
      offers: lookup.offers,
      scanHistoryId,
    }
    return NextResponse.json(result)
  } catch (error) {
    console.error('システムエラー:', error)
    return NextResponse.json({ error: 'サーバーエラーが発生しました' }, { status: 500 })
  }
}
