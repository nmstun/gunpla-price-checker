import { Offer } from '@/types'
import { cleanItemName, isNameMatching, hasPremiumBandaiMarker } from './itemName'
import { fetchYahooHits, pickBaseItemName, isExcludedHit, toOffer } from './yahooShopping'
import { findOfficialPriceByJanCode } from './bandaiHobby'

const YAHOO_CLIENT_ID = process.env.YAHOO_CLIENT_ID

export interface PriceLookupResult {
  itemName: string
  // バンダイ公式サイトでJANコード照合できた場合のみ値が入る。確認できなければnull
  officialPrice: number | null
  offers: Offer[]
  // Yahoo!出品名にプレミアムバンダイ（プレバン）限定を示す目印があったかどうか。
  // プレバン限定品は説明書サイトの索引に無いことが多く定価が未確認になりやすいため、
  // UI側でその理由をユーザーに伝えるために使う
  isPremiumBandaiExclusive: boolean
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
  const isPremiumBandaiExclusive = hasPremiumBandaiMarker(hits.map((hit) => hit.name))

  const matchedHits = hits.filter((hit) => !isExcludedHit(hit) && isNameMatching(cleanedBaseName, hit.name))
  if (matchedHits.length === 0) {
    return { error: '正しい商品データが確認できませんでした', status: 404 }
  }

  const topOffers = matchedHits.map(toOffer).sort((a, b) => a.price - b.price).slice(0, 3)

  // メーカー希望小売価格はバンダイ公式サイトでJANコード照合できた場合のみ採用する。
  // 確認できない場合は量販店の実売価格を定価として代用せず、nullのまま返す
  // （最安値は別途topOffersからいつでも都度取得できるため、フォールバックとして混ぜる必要がない）
  let officialPrice: number | null = null
  // 表示名も、Yahoo!出品者由来の商品名（表記ゆれ・ノイズが多い）より、
  // バンダイ説明書サイトで確認できた正式名称の方が正確なので優先して使う
  let itemName = cleanedBaseName
  try {
    const result = await findOfficialPriceByJanCode(cleanedBaseName, janCode)
    officialPrice = result.officialPrice
    if (result.canonicalName) itemName = result.canonicalName
  } catch (bandaiError) {
    console.error('バンダイ公式価格の取得に失敗:', bandaiError)
  }

  return { itemName, officialPrice, offers: topOffers, isPremiumBandaiExclusive }
}
