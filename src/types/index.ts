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
}

export interface ScanHistoryEntry {
  id: string
  janCode: string
  itemName: string
  officialPrice: number
  priceSource: PriceSource
  storeName: string
  scannedAt: string
}
