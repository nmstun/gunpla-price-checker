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
  // Yahoo!出品名にプレミアムバンダイ（プレバン）限定を示す目印があったかどうか
  isPremiumBandaiExclusive: boolean
}

export interface ScanHistoryEntry {
  id: string
  janCode: string
  itemName: string
  officialPrice: number | null
  // 定価がバンダイ公式照合ではなくユーザーの手動入力によるものかどうか。
  // trueのときUIは「公式照合済み」ではなく「手動入力」バッジで区別表示する
  officialPriceIsManual: boolean
  // Yahoo!出品名にプレミアムバンダイ（プレバン）限定を示す目印があったかどうか。
  // プレバン限定品は説明書サイトの索引に無いことが多く定価が未確認になりやすいため、
  // UI上でその理由をユーザーに伝えるバッジ表示に使う
  isPremiumBandaiExclusive: boolean
  storeName: string
  storePrice: number | null
  scannedAt: string
}

// 定価再取得APIのレスポンス。最安値・上位オファーは保存せず、取得のたびに都度返す
export interface RefreshPriceResult {
  itemName: string
  officialPrice: number | null
  lowestMarketPrice: number | null
  // 最安値順の上位オファー（最大3件、各店舗へのリンク付き）。スキャン結果画面と
  // 同じ内容を履歴詳細画面でも表示するために追加した
  offers: Offer[]
  isPremiumBandaiExclusive: boolean
}

// キット名検索APIの結果1件分。バーコードが手元に無いときに、キット名から直接
// バンダイ公式サイトを検索する機能で使う（スキャン履歴には保存しない、その場限りの検索）
export interface KitSearchResultItem {
  title: string
  price: number
  janCode: string
  url: string
}
