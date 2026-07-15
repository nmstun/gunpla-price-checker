export interface Offer {
  storeName: string
  price: number
  shippingFee: number
  isConditional: boolean
  url: string
  storeId: string
  fixedPrice: number
}

// bandai_msrp: バンダイ公式サイトでJANコード照合済みの希望小売価格
// estimated: 公式サイトで確認できず、量販店の実売価格から推定した目安価格
export type PriceSource = 'bandai_msrp' | 'estimated'

export interface CheckPriceResult {
  source: 'cache' | 'live_fetch'
  itemName: string
  officialPrice: number
  priceSource: PriceSource
  offers: Offer[]
  // 店舗の販売価格を後から入力・編集できるように、記録されたscan_historyのIDを返す
  // （店舗未選択などで記録されなかった場合はnull）
  scanHistoryId: string | null
}

export interface ScanHistoryEntry {
  id: string
  janCode: string
  itemName: string
  officialPrice: number
  priceSource: PriceSource
  storeName: string
  storePrice: number | null
  scannedAt: string
}
