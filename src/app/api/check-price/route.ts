import { NextResponse } from 'next/server'
import { CheckPriceResult, PriceSource } from '@/types'
import { getCachedItem, saveItem } from '@/lib/supabase/items'
import { cleanItemName, isNameMatching } from '@/utils/itemName'
import { fetchYahooHits, pickBaseItemName, isExcludedHit, toOffer, detectOfficialPrice } from '@/utils/yahooShopping'
import { findOfficialPriceByJanCode } from '@/utils/bandaiHobby'

// キャッシュを一切持たせないためのNext.js用設定
export const dynamic = 'force-dynamic'
export const revalidate = 0

const YAHOO_CLIENT_ID = process.env.YAHOO_CLIENT_ID

function isValidJanCode(janCode: unknown): janCode is string {
  return typeof janCode === 'string' && (janCode.length === 13 || janCode.length === 8)
}

export async function POST(request: Request) {
  try {
    const { janCode } = await request.json()

    if (!isValidJanCode(janCode)) {
      return NextResponse.json({ error: '不正なJANコードです' }, { status: 400 })
    }

    const cached = await getCachedItem(janCode)
    if (cached) {
      const result: CheckPriceResult = {
        source: 'cache',
        itemName: cached.itemName,
        officialPrice: cached.officialPrice,
        priceSource: cached.priceSource,
        offers: [],
      }
      return NextResponse.json(result)
    }

    if (!YAHOO_CLIENT_ID) {
      return NextResponse.json({ error: 'Yahoo! APIの初期設定が完了していません' }, { status: 500 })
    }

    let hits
    try {
      hits = await fetchYahooHits(janCode, YAHOO_CLIENT_ID)
    } catch (fetchError) {
      const message = fetchError instanceof Error ? fetchError.message : 'Yahoo! APIエラー'
      return NextResponse.json({ error: message }, { status: 500 })
    }
    if (hits.length === 0) {
      return NextResponse.json({ error: '該当する商品が見つかりませんでした' }, { status: 404 })
    }

    const cleanedBaseName = cleanItemName(pickBaseItemName(hits))

    const matchedHits = hits.filter((hit) => !isExcludedHit(hit) && isNameMatching(cleanedBaseName, hit.name))
    if (matchedHits.length === 0) {
      return NextResponse.json({ error: '正しい商品データが確認できませんでした' }, { status: 404 })
    }

    const topOffers = matchedHits.map(toOffer).sort((a, b) => a.price - b.price).slice(0, 3)

    let officialPrice: number
    let priceSource: PriceSource
    try {
      const bandaiPrice = await findOfficialPriceByJanCode(cleanedBaseName, janCode)
      if (bandaiPrice !== null) {
        officialPrice = bandaiPrice
        priceSource = 'bandai_msrp'
      } else {
        officialPrice = detectOfficialPrice(topOffers)
        priceSource = 'estimated'
      }
    } catch (bandaiError) {
      console.error('バンダイ公式価格の取得に失敗、目安価格にフォールバック:', bandaiError)
      officialPrice = detectOfficialPrice(topOffers)
      priceSource = 'estimated'
    }

    await saveItem(janCode, cleanedBaseName, officialPrice, priceSource)

    const result: CheckPriceResult = {
      source: 'live_fetch',
      itemName: cleanedBaseName,
      officialPrice,
      priceSource,
      offers: topOffers,
    }
    return NextResponse.json(result)
  } catch (error) {
    console.error('システムエラー:', error)
    return NextResponse.json({ error: 'サーバーエラーが発生しました' }, { status: 500 })
  }
}
