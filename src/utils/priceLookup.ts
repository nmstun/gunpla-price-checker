import { Offer } from '@/types'
import { cleanItemName, isNameMatching, hasPremiumBandaiMarker } from './itemName'
import { fetchYahooHits, pickBaseItemName, isExcludedHit, toOffer } from './yahooShopping'
import { fetchRakutenItems, toOffer as toRakutenOffer } from './rakutenIchiba'
import { findOfficialPriceByJanCode } from './bandaiHobby'

const YAHOO_CLIENT_ID = process.env.YAHOO_CLIENT_ID
// 楽天は任意設定。3つとも揃っていなければ問い合わせをスキップし、
// Yahoo!のみで従来どおり動作する（アプリURLはReferer/Originの検証に必要）
const RAKUTEN_APP_ID = process.env.RAKUTEN_APP_ID
const RAKUTEN_ACCESS_KEY = process.env.RAKUTEN_ACCESS_KEY
const RAKUTEN_APP_URL = process.env.RAKUTEN_APP_URL

export interface PriceLookupResult {
  itemName: string
  // バンダイ公式サイトでJANコード照合できた場合のみ値が入る。確認できなければnull
  officialPrice: number | null
  offers: Offer[]
  // 新品・中古それぞれの最安値。上位3件に入らなかったものも拾えるよう、
  // 絞り込み前の全オファーから算出する
  lowestNewPrice: number | null
  lowestUsedPrice: number | null
  // Yahoo!出品名にプレミアムバンダイ（プレバン）限定を示す目印があったかどうか。
  // プレバン限定品は説明書サイトの索引に無いことが多く定価が未確認になりやすいため、
  // UI側でその理由をユーザーに伝えるために使う
  isPremiumBandaiExclusive: boolean
}

// 同一ショップが同じ商品を複数出品していることがあり（実測でメディアワールドの
// 中古出品が同一価格で5件返り、上位3件がすべて同じ商品で埋まる事象を確認）、
// 比較先として役に立たないためショップ名＋価格が同じものは1件に畳む
function dedupeOffers(offers: Offer[]): Offer[] {
  const seen = new Set<string>()
  return offers.filter((offer) => {
    const key = `${offer.storeName}|${offer.price}|${offer.condition}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function lowestPriceOf(offers: Offer[], condition: Offer['condition']): number | null {
  const prices = offers.filter((o) => o.condition === condition).map((o) => o.price)
  return prices.length > 0 ? Math.min(...prices) : null
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

  // Yahoo!と楽天は独立して問い合わせられるので並列に投げ、スキャン後の待ち時間を伸ばさない。
  // 商品の同定（商品名・プレバン判定）はJANコード検索を正式サポートするYahoo!側を基準にし、
  // 楽天は「価格の比較先を増やす」用途に限定する
  const [yahooResult, rakutenResult] = await Promise.allSettled([
    fetchYahooHits(janCode, YAHOO_CLIENT_ID),
    RAKUTEN_APP_ID && RAKUTEN_ACCESS_KEY && RAKUTEN_APP_URL
      ? fetchRakutenItems(janCode, {
          applicationId: RAKUTEN_APP_ID,
          accessKey: RAKUTEN_ACCESS_KEY,
          appUrl: RAKUTEN_APP_URL,
        })
      : Promise.resolve([]),
  ])

  if (yahooResult.status === 'rejected') {
    const message =
      yahooResult.reason instanceof Error ? yahooResult.reason.message : 'Yahoo! APIエラー'
    return { error: message, status: 500 }
  }
  const hits = yahooResult.value
  if (hits.length === 0) {
    return { error: '該当する商品が見つかりませんでした', status: 404 }
  }

  // 楽天側が落ちても価格チェック全体は成立させる（Yahoo!の結果だけで表示する）
  if (rakutenResult.status === 'rejected') {
    console.error('楽天の価格取得に失敗:', rakutenResult.reason)
  }
  const rakutenItems = rakutenResult.status === 'fulfilled' ? rakutenResult.value : []

  const cleanedBaseName = cleanItemName(pickBaseItemName(hits))
  const isPremiumBandaiExclusive = hasPremiumBandaiMarker(hits.map((hit) => hit.name))

  const matchedHits = hits.filter((hit) => !isExcludedHit(hit) && isNameMatching(cleanedBaseName, hit.name))
  if (matchedHits.length === 0) {
    return { error: '正しい商品データが確認できませんでした', status: 404 }
  }

  // 最安値・上位オファーには在庫無しの出品を含めない（買えない価格を最安値として
  // 案内しても意味が無いため）。ただし商品データの照合自体（matchedHits）には
  // 在庫無しの出品も含めたままにする。出品名が消えるわけではなく、商品を正しく
  // 特定できたかどうかの判定材料としては在庫の有無と関係なく有効なため
  // 楽天はJANコード専用の検索条件が無く、JANをキーワードとして投げているため、
  // 同じJANが説明文に載っているだけの別商品（セット品・付属品違い等）が混ざりうる。
  // Yahoo!側と同じ名称一致フィルタを通してから価格比較に加える
  const rakutenOffers = rakutenItems
    .filter((item) => item.itemName && isNameMatching(cleanedBaseName, item.itemName))
    .map(toRakutenOffer)
    .filter((offer) => offer.price > 0)

  const yahooOffers = matchedHits.filter((hit) => hit.inStock !== false).map(toOffer)

  const allOffers = dedupeOffers([...yahooOffers, ...rakutenOffers].sort((a, b) => a.price - b.price))

  // 新品と中古の最安値は、上位3件に入らなかったものも取りこぼさないよう
  // 絞り込み前の全オファーから求める
  const lowestNewPrice = lowestPriceOf(allOffers, 'new')
  const lowestUsedPrice = lowestPriceOf(allOffers, 'used')

  // 一覧は新品を優先して並べる（定価と比較する相手は新品の実売価格であり、
  // 中古が上位を占めて新品の相場が見えなくなるのを防ぐ）。中古も相場の
  // 材料として価値があるため、新品の後ろに続ける形で残す
  const topOffers = [
    ...allOffers.filter((o) => o.condition === 'new'),
    ...allOffers.filter((o) => o.condition === 'used'),
  ].slice(0, 3)

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

  return {
    itemName,
    officialPrice,
    offers: topOffers,
    lowestNewPrice,
    lowestUsedPrice,
    isPremiumBandaiExclusive,
  }
}
