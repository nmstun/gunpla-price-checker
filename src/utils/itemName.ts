// プレミアムバンダイ（プレバン）限定商品であることを示す、出品名によく付く目印。
// "{PTM}"タグは当初これに含めていたが、通常品の出品名にも普通に付くタグだと実測でわかった
// （例:「HG 1/144 デミバーディング」という通常品にも{PTM}が付いていた）ため除外し、
// プレバン限定を明示する日本語表記のみを目印とする
const PREMIUM_BANDAI_MARKER_PATTERN = /プレバン限定|プレミアムバンダイ限定|プレミアム限定|プレミアムバンダイ/

// 複数の出品名のうち1件でもプレバン限定の目印があれば、その商品はプレバン限定とみなす
// （プレバン限定品はバンダイ説明書サイトの索引に無いことが多く、定価が「未確認」になりやすい
// ため、UI上でその理由をユーザーに伝えるための判定に使う）
export function hasPremiumBandaiMarker(names: string[]): boolean {
  return names.some((name) => PREMIUM_BANDAI_MARKER_PATTERN.test(name))
}

const NOISE_WORD_PATTERNS = [
  /中古/g, /新品/g, /プラモデル/g, /フィギュア/g, /おもちゃ/g, /玩具/g,
  /【.*?】/g, /＼.*?／/g, /\[.*?\]/g, /\(.*?\)/g, /（.*?）/g, /『.*?』/g, /《.*?》/g,
  /送料無料/g, /送料込み/g,
  // メーカー名はバンダイ側の検索キーワードを汚す（実測でヒット率を下げることを確認）ため除去する
  /バンダイスピリッツ/g, /BANDAI\s*SPIRITS/gi, /バンダイ/g,
  // プレバン限定を示す目印も、末尾がグレード表記(HGUC等)の直前に来ると先頭アンカーの
  // グレード除去が効かなくなり検索が壊れることが実測でわかったため除去する
  // （プレバン限定かどうかはhasPremiumBandaiMarkerで別途、生の出品名から判定済みのため
  // ここで消しても情報は失われない）
  /\{PTM\}/g, /プレバン限定/g, /プレミアムバンダイ限定/g, /プレミアム限定/g, /プレミアムバンダイ/g,
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
