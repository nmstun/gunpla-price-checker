import { OfferSource, ShippingInfo } from '@/types'

// このアプリの主目的は「店頭価格が定価に対してどれだけ上乗せされているか」を
// ひと目で判断することなので、その判定と表示ラベルをここに集約する

export type PriceVerdict = 'markup' | 'deal' | 'even'

export interface PriceComparison {
  diff: number
  verdict: PriceVerdict
  /** 例: "+¥3,720" / "-¥280" / "±0" */
  diffLabel: string
  /** 定価の何倍か。例: "2.2倍"（定価が0以下なら空文字） */
  ratioLabel: string
}

export function formatYen(value: number): string {
  return `¥${value.toLocaleString()}`
}

export function comparePrices(officialPrice: number, storePrice: number): PriceComparison {
  const diff = storePrice - officialPrice
  const verdict: PriceVerdict = diff > 0 ? 'markup' : diff < 0 ? 'deal' : 'even'
  const diffLabel =
    diff > 0 ? `+${formatYen(diff)}` : diff < 0 ? `-${formatYen(Math.abs(diff))}` : '±0'
  const ratioLabel = officialPrice > 0 ? `${(storePrice / officialPrice).toFixed(1)}倍` : ''

  return { diff, verdict, diffLabel, ratioLabel }
}

// 判定ごとの配色。プレ値は赤、定価より安ければ緑、同額は無彩色で統一する
export const VERDICT_PILL_CLASS: Record<PriceVerdict, string> = {
  markup: 'bg-red-50 text-red-700 ring-1 ring-red-100',
  deal: 'bg-green-50 text-green-700 ring-1 ring-green-100',
  even: 'bg-gray-100 text-gray-500 ring-1 ring-gray-200',
}

export const VERDICT_BANNER_CLASS: Record<PriceVerdict, string> = {
  markup: 'bg-red-50 text-red-700 border-red-100',
  deal: 'bg-green-50 text-green-700 border-green-100',
  even: 'bg-gray-50 text-gray-600 border-gray-100',
}

// ショップ一覧の送料表記。スマホ幅で途中省略されないよう短く保つ
export function formatShipping(shipping: ShippingInfo): string {
  switch (shipping.kind) {
    case 'fee':
      return `送料 ${formatYen(shipping.amount)}`
    case 'free_conditional':
      return '送料無料（条件あり）'
    case 'separate':
      return '送料別'
    case 'free':
      return '送料無料'
  }
}

// モール名の表示ラベル。どのモールの価格なのかを一覧の行で示すために使う。
// 色はプレ値(赤)・お得(緑)・プレバン(紫)・手動(橙)と意味を持たせて使い分けているので、
// モール名は意味を持たない無彩色にして、既存の色分けの読み取りを妨げないようにする
export const OFFER_SOURCE_LABEL: Record<OfferSource, string> = {
  yahoo: 'Yahoo!',
  rakuten: '楽天',
}

export function verdictHeadline(comparison: PriceComparison): string {
  if (comparison.verdict === 'markup') {
    return `定価より ${formatYen(comparison.diff)} 高い`
  }
  if (comparison.verdict === 'deal') {
    return `定価より ${formatYen(Math.abs(comparison.diff))} 安い`
  }
  return '定価どおりの価格'
}
