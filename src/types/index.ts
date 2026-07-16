export interface Offer {
  storeName: string
  price: number
  shippingFee: number
  isConditional: boolean
  url: string
  storeId: string
  fixedPrice: number
}

export interface CheckPriceResult {
  source: 'cache' | 'live_fetch'
  itemName: string
  // バンダイ公式サイトでJANコード照合できた場合のみ値が入る（メーカー希望小売価格）。
  // 確認できない場合はnull（量販店の実売価格を定価として代用することはしない）
  officialPrice: number | null
  offers: Offer[]
  // 店舗の販売価格を後から入力・編集できるように、記録されたscan_historyのIDを返す
  // （店舗未選択などで記録されなかった場合はnull）
  scanHistoryId: string | null
}

export interface ScanHistoryEntry {
  id: string
  janCode: string
  itemName: string
  officialPrice: number | null
  storeName: string
  storePrice: number | null
  scannedAt: string
}

// 定価再取得APIのレスポンス。最安値は保存せず、取得のたびに都度返す
export interface RefreshPriceResult {
  itemName: string
  officialPrice: number | null
  lowestMarketPrice: number | null
}
