import { Offer } from '@/types'

// 名称の一致率フィルターを通す際の基準として信頼するストアID
// （表記揺れが少なく、正規の定価に近い価格を出す量販店）
export const TRUSTED_STORE_IDS = ['joshinweb', 'y-kojima', 'edion', 'amiami', 'digitamin', 'hal-shop']

const EXCLUDED_SELLER_ID = 'ensyu2017'
const EXCLUDED_NAME_KEYWORDS = ['ケースのみ', 'ジャンク']

const FETCH_TIMEOUT_MS = 8000

export interface YahooHit {
  name: string
  price: number | string
  url?: string
  // Yahoo!ショッピングAPIのレスポンスではセラーIDのキー名は`sellerId`（`id`ではない）
  seller?: { sellerId?: string; name?: string }
  shipping?: { name?: string; code?: number | string }
  priceLabel?: { fixedPrice?: number | string }
}

interface YahooItemSearchResponse {
  hits?: YahooHit[]
}

export async function fetchYahooHits(janCode: string, clientId: string): Promise<YahooHit[]> {
  const url = `https://shopping.yahooapis.jp/ShoppingWebService/V3/itemSearch?appid=${clientId}&jan_code=${janCode}&results=20`
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)

  try {
    const res = await fetch(url, {
      cache: 'no-store',
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    })

    if (!res.ok) {
      throw new Error(`Yahoo! APIエラー (${res.status})`)
    }

    const data = (await res.json()) as YahooItemSearchResponse
    return data.hits ?? []
  } finally {
    clearTimeout(timeoutId)
  }
}

// 信頼ストアの登録名を最優先の基準名とし、無ければ怪しい出品を避けつつ先頭のヒットを使う
export function pickBaseItemName(hits: YahooHit[]): string {
  const trustedHit = hits.find((hit) => hit.seller?.sellerId && TRUSTED_STORE_IDS.includes(hit.seller.sellerId))
  if (trustedHit) return trustedHit.name

  const safeHit = hits.find((hit) => !hit.seller?.sellerId?.includes('ensyu') && !hit.name.includes('ケース'))
  return (safeHit ?? hits[0]).name
}

export function isExcludedHit(hit: YahooHit): boolean {
  if (hit.seller?.sellerId === EXCLUDED_SELLER_ID || hit.url?.includes(EXCLUDED_SELLER_ID)) return true
  return EXCLUDED_NAME_KEYWORDS.some((keyword) => hit.name.includes(keyword))
}

export function toOffer(hit: YahooHit): Offer {
  const shippingName = hit.shipping?.name ?? ''
  let shippingFee = 0
  if (!shippingName.includes('送料無料')) {
    const match = shippingName.match(/\d+/)
    if (match) shippingFee = Number(match[0])
  }

  return {
    storeName: hit.seller?.name || '不明なショップ',
    price: Number(hit.price),
    shippingFee,
    isConditional: shippingName.includes('条件') || hit.shipping?.code === 1 || hit.shipping?.code === '1',
    url: hit.url || '#',
    storeId: hit.seller?.sellerId || '',
    fixedPrice: hit.priceLabel?.fixedPrice ? Number(hit.priceLabel.fixedPrice) : 0,
  }
}

// 上位オファーの中から信頼ストアの価格を基準定価として採用し、無ければ最安値を使う
export function detectOfficialPrice(topOffers: Offer[]): number {
  for (const offer of topOffers) {
    if (offer.storeId && TRUSTED_STORE_IDS.includes(offer.storeId)) {
      return offer.fixedPrice > 0 ? offer.fixedPrice : offer.price
    }
  }
  return topOffers[0].price
}
