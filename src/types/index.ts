// 出品元のモール。複数モールの価格を1つのリストに混ぜて表示するため、
// どこの価格なのかを行ごとに示せるようにしている
export type OfferSource = 'yahoo' | 'rakuten'

// 送料の表し方はモールごとに異なる（Yahoo!は送料無料/実額/条件付きが分かるが、
// 楽天は「送料込みか送料別か」のフラグのみで実額を返さない）。
// 実額を推測して誤った送料を出さないよう、分かる範囲だけを型で表現する
export type ShippingInfo =
  | { kind: 'free' }
  | { kind: 'free_conditional' }
  | { kind: 'fee'; amount: number }
  | { kind: 'separate' }

// 出品の状態。定価と比べる相手は本来「新品の実売価格」なので、中古を混ぜたまま
// 最安値にしないよう区別する（中古相場自体は、公式APIが無く取得できない
// メルカリ・ヤフオクの代わりに転売相場を掴む材料として別枠で表示する）
export type OfferCondition = 'new' | 'used'

export interface Offer {
  storeName: string
  price: number
  shipping: ShippingInfo
  url: string
  storeId: string
  fixedPrice: number
  source: OfferSource
  condition: OfferCondition
}

export interface CheckPriceResult {
  source: 'cache' | 'live_fetch'
  itemName: string
  // バンダイ公式サイトでJANコード照合できた場合のみ値が入る（メーカー希望小売価格）。
  // 確認できない場合はnull（量販店の実売価格を定価として代用することはしない）
  officialPrice: number | null
  offers: Offer[]
  // 新品・中古それぞれの最安値（絞り込み前の全オファーから算出）
  lowestNewPrice: number | null
  lowestUsedPrice: number | null
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
  // 最安値順の上位オファー（最大3件、各店舗へのリンク付き）。スキャン結果画面と
  // 同じ内容を履歴詳細画面でも表示するために追加した
  offers: Offer[]
  // 新品・中古それぞれの最安値。上位3件に入らなかったものも拾えるよう、
  // 絞り込み前の全オファーから算出して別途返す
  lowestNewPrice: number | null
  lowestUsedPrice: number | null
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
