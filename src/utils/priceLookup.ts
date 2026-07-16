import { Offer, PriceSource } from '@/types'
import { cleanItemName, isNameMatching } from './itemName'
import { fetchYahooHits, pickBaseItemName, isExcludedHit, toOffer, detectOfficialPrice } from './yahooShopping'
import { findOfficialPriceByJanCode } from './bandaiHobby'

const YAHOO_CLIENT_ID = process.env.YAHOO_CLIENT_ID

export interface PriceLookupResult {
  itemName: string
  officialPrice: number
  priceSource: PriceSource
  offers: Offer[]
}

export interface PriceLookupError {
  error: string
  status: number
}

export function isPriceLookupError(result: PriceLookupResult | PriceLookupError): result is PriceLookupError {
  return 'error' in result
}

// Yahoo!ショッピング検索→名称一致フィルタ→バンダイ公式価格照合、までの一連の処理。
// check-price（新規スキャン）とrefresh-price（定価再取得）の両方から使う
export async function fetchLivePriceInfo(janCode: string): Promise<PriceLookupResult | PriceLookupError> {
  if (!YAHOO_CLIENT_ID) {
    return { error: 'Yahoo! APIの初期設定が完了していません', status: 500 }
  }

  let hits
  try {
    hits = await fetchYahooHits(janCode, YAHOO_CLIENT_ID)
  } catch (fetchError) {
    const message = fetchError instanceof Error ? fetchError.message : 'Yahoo! APIエラー'
    return { error: message, status: 500 }
  }
  if (hits.length === 0) {
    return { error: '該当する商品が見つかりませんでした', status: 404 }
  }

  const cleanedBaseName = cleanItemName(pickBaseItemName(hits))

  const matchedHits = hits.filter((hit) => !isExcludedHit(hit) && isNameMatching(cleanedBaseName, hit.name))
  if (matchedHits.length === 0) {
    return { error: '正しい商品データが確認できませんでした', status: 404 }
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

  return { itemName: cleanedBaseName, officialPrice, priceSource, offers: topOffers }
}
