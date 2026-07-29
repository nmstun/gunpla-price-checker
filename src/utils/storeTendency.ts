import { ScanHistoryEntry } from '@/types'

// 店舗ごとの「定価からどれくらい離れた値付けをする店か」の傾向。
// 行く店を選ぶ材料にするための集計で、定価と店頭価格の両方が分かっている
// 履歴だけを対象にする（どちらかが欠けていると乖離を計算できないため）
export interface StoreTendency {
  storeName: string
  /** 集計対象になった履歴の件数 */
  sampleCount: number
  /** 平均乖離率。0.35なら平均で定価の+35% */
  averageDiffRatio: number
  /** そのうち定価より高かった件数 */
  markupCount: number
}

// 少ない件数の平均は偶然に振れやすく「この店は高い」と誤解させるため、
// これ未満の店舗は傾向として扱わない
export const MIN_SAMPLES_FOR_TENDENCY = 2

export function calculateStoreTendencies(entries: ScanHistoryEntry[]): StoreTendency[] {
  const byStore = new Map<string, { ratios: number[]; markupCount: number }>()

  for (const entry of entries) {
    // 定価が0以下だと比率を計算できないため除外する
    if (entry.officialPrice === null || entry.storePrice === null || entry.officialPrice <= 0) continue

    const current = byStore.get(entry.storeName) ?? { ratios: [], markupCount: 0 }
    current.ratios.push(entry.storePrice / entry.officialPrice - 1)
    if (entry.storePrice > entry.officialPrice) current.markupCount += 1
    byStore.set(entry.storeName, current)
  }

  return Array.from(byStore.entries())
    .filter(([, v]) => v.ratios.length >= MIN_SAMPLES_FOR_TENDENCY)
    .map(([storeName, v]) => ({
      storeName,
      sampleCount: v.ratios.length,
      averageDiffRatio: v.ratios.reduce((sum, r) => sum + r, 0) / v.ratios.length,
      markupCount: v.markupCount,
    }))
    // 高い店から順に並べ、避けたい店がひと目で分かるようにする
    .sort((a, b) => b.averageDiffRatio - a.averageDiffRatio)
}

// 平均乖離率の表示ラベル。例: +35% / -12% / ±0%
export function formatDiffRatio(ratio: number): string {
  const percent = Math.round(ratio * 100)
  if (percent > 0) return `+${percent}%`
  if (percent < 0) return `${percent}%`
  return '±0%'
}
