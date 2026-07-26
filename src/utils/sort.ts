// 店舗名などの日本語文字列を五十音・アルファベット順に近い形で並べる際に使う共通コンパレータ。
// 漢字始まりの読み（ふりがな）までは考慮できないため、あくまで簡易的な並び順
export function compareJa(a: string, b: string): number {
  return a.localeCompare(b, 'ja')
}
