const NOISE_WORD_PATTERNS = [
  /中古/g, /新品/g, /プラモデル/g, /フィギュア/g, /おもちゃ/g, /玩具/g,
  /【.*?】/g, /＼.*?／/g, /\[.*?\]/g, /\(.*?\)/g, /（.*?）/g, /『.*?』/g, /《.*?》/g,
  /送料無料/g, /送料込み/g,
  // メーカー名はバンダイ側の検索キーワードを汚す（実測でヒット率を下げることを確認）ため除去する
  /バンダイスピリッツ/g, /BANDAI\s*SPIRITS/gi, /バンダイ/g,
]

// 商品名の一致率判定に使うbigram一致率の閾値。表記揺れが激しいストアが増えたら調整する
const MATCH_RATIO_THRESHOLD = 0.5

// Yahoo!の商品名は「商品名 機動戦士ガンダム〜」のようにシリーズ名が末尾に付くことが多く、
// バンダイ側の検索キーワードを汚すため除去したいが、出品者によっては逆に先頭寄りに
// 「機動戦士ガンダム〜 商品名」と置くこともあり、その場合は末尾まで丸ごと消すと
// 肝心のキット名まで巻き込んでしまう（実測で"HG"だけが残る事故が発生した）。
// 出現位置が文字列の後半にある場合のみ、シリーズ名の巻き添え除去とみなして削除する
function stripTrailingSeriesName(text: string): string {
  const match = text.match(/機動戦士.*/)
  if (!match || match.index === undefined) return text
  if (match.index < text.length / 2) return text
  return text.slice(0, match.index)
}

export function cleanItemName(name: string): string {
  if (!name) return ''
  let cleaned = name
  NOISE_WORD_PATTERNS.forEach((regex) => {
    cleaned = cleaned.replace(regex, '')
  })
  cleaned = stripTrailingSeriesName(cleaned)
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
