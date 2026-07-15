const NOISE_WORD_PATTERNS = [
  /中古/g, /新品/g, /プラモデル/g, /フィギュア/g, /おもちゃ/g, /玩具/g,
  /【.*?】/g, /＼.*?／/g, /\[.*?\]/g, /\(.*?\)/g, /送料無料/g, /送料込み/g,
]

// 商品名の一致率判定に使うbigram一致率の閾値。表記揺れが激しいストアが増えたら調整する
const MATCH_RATIO_THRESHOLD = 0.5

export function cleanItemName(name: string): string {
  if (!name) return ''
  let cleaned = name
  NOISE_WORD_PATTERNS.forEach((regex) => {
    cleaned = cleaned.replace(regex, '')
  })
  return cleaned.replace(/\s+/g, ' ').trim()
}

function normalize(str: string): string {
  return str
    .toLowerCase()
    .replace(/[！-～]/g, (s) => String.fromCharCode(s.charCodeAt(0) - 0xfee0)) // 全角英数を半角へ
    .replace(/[\s\-_/★☆■◆【】()[\]]/g, '')
}

function toBigrams(str: string): string[] {
  const bigrams: string[] = []
  for (let i = 0; i < str.length - 1; i++) {
    bigrams.push(str.substring(i, i + 2))
  }
  return bigrams
}

// baseNameを基準に、targetNameが同一商品とみなせるかを判定する
// （完全な部分一致、またはbigram一致率が閾値以上であればtrue）
export function isNameMatching(baseName: string, targetName: string): boolean {
  const base = normalize(baseName)
  const target = normalize(targetName)

  if (base.includes(target) || target.includes(base)) return true

  const baseBigrams = toBigrams(base)
  if (baseBigrams.length === 0) return true

  const matchCount = baseBigrams.filter((bigram) => target.includes(bigram)).length
  return matchCount / baseBigrams.length >= MATCH_RATIO_THRESHOLD
}
