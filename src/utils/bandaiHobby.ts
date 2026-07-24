const SEARCH_PAGE_URL = 'https://bandai-hobby.net/search/'
const PRODUCT_LIST_API = 'https://cmsapi-frontend.bandai-hobby.net/site/api/hobby/Product/list'
const MANUAL_SEARCH_URL = 'https://manual.bandai-hobby.net/'
// トークン取得は実測500ms前後だが、商品検索APIは実測で10秒を超えることがあるため長めに取る
const TOKEN_FETCH_TIMEOUT_MS = 5000
const PRODUCT_FETCH_TIMEOUT_MS = 15000
const SEARCH_RESULT_LIMIT = 30
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'

// バンダイの検索サイトは、トークン発行ページで Accept-Language ヘッダーの有無を
// ボット判定に使っており、これが無いリクエストには「見た目は正しいが検索APIに
// 弾かれる無効なトークン」を返す（→商品検索APIが statusCode:404 を返す）ことが
// 実測で判明した。ブラウザは必ず送るヘッダーなので、全リクエストで明示的に付与する
const BANDAI_HEADERS = {
  'User-Agent': USER_AGENT,
  'Accept-Language': 'ja,en-US;q=0.9,en;q=0.8',
}

export interface BandaiProduct {
  title: string
  price: number
  janCode: string
  url: string
}

async function fetchWithTimeout(url: string, timeoutMs: number, init?: RequestInit): Promise<Response> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetch(url, { ...init, signal: controller.signal })
  } finally {
    clearTimeout(timeoutId)
  }
}

// 説明書サイト（manual.bandai-hobby.net）はJANコードそのものでの検索に対応しており、
// Yahoo!の出品者由来の商品名よりノイズの無い正式な商品名が得られる（実測で確認済み）。
// 検索結果が1件に絞れない場合は該当JANの商品を特定できていないということなので使わない
async function resolveCanonicalNameByJanCode(janCode: string): Promise<string | null> {
  try {
    const res = await fetchWithTimeout(`${MANUAL_SEARCH_URL}?freeword=${janCode}`, TOKEN_FETCH_TIMEOUT_MS, {
      headers: BANDAI_HEADERS,
      cache: 'no-store',
    })
    if (!res.ok) return null

    const html = await res.text()
    const countMatch = html.match(/(\d+)件の結果が見つかりました/)
    if (!countMatch || countMatch[1] !== '1') return null

    const nameMatch = html.match(/bl_result_name">\s*([^\n<]+?)\s*<span/)
    return nameMatch ? nameMatch[1].trim() : null
  } catch {
    return null
  }
}

// bandai-hobby.netの検索結果ページに埋め込まれたAPIトークンを取得する。
// 公式に公開されたAPIではなく、サイトのフロントエンドが内部的に叩いているものを流用しているため、
// サイト側の実装変更で壊れる可能性がある（その場合はfindOfficialPriceByJanCodeがofficialPrice: nullを返す）
async function fetchSearchToken(keyword: string): Promise<string | null> {
  const url = `${SEARCH_PAGE_URL}?title=${encodeURIComponent(keyword)}&product=on`
  const res = await fetchWithTimeout(url, TOKEN_FETCH_TIMEOUT_MS, {
    headers: BANDAI_HEADERS,
    cache: 'no-store',
  })
  if (!res.ok) return null

  const html = await res.text()
  const match = html.match(/<meta name="token" content="([^"]+)"/)
  return match ? match[1] : null
}

async function fetchSearchTokenWithRetry(keyword: string): Promise<string | null> {
  try {
    const token = await fetchSearchToken(keyword)
    if (token) return token
  } catch {
    // 1回だけ再試行する（下のcatchで失敗時はnullを返す）
  }
  try {
    return await fetchSearchToken(keyword)
  } catch {
    return null
  }
}

// 全角英数字を半角に変換する（グレード表記が"ＲＧ"のように全角で来ることがあり、
// 半角前提のGRADE_PREFIX_PATTERNに一致せず除去し損ねる事故が実測で発生したため）
function toHalfWidthAlnum(text: string): string {
  return text.replace(/[Ａ-Ｚａ-ｚ０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
}

// バンダイ側の検索は単純な部分一致らしく、スペースや"/"（スケール表記の1/144等）を含めると
// フィルタが無視されて全件が返ってくることが実測で分かった。空白なしの連続文字列にして渡す。
// さらに、キーワードの先頭が"HG"等のグレード表記だと（おそらくブランドコードとして誤解釈され）
// 404が返るようになったことも実測で確認した。グレード表記は検索精度にも不要なので先頭から除去する。
// "HGUC"等の複合表記は、サブブランドの2〜3文字（UC/CE/IBO等）を先に含めて丸ごと一致させないと
// "HG"だけ除去した残りの"UC"が後続の型式番号（RGM-79G等）にくっついてしまい、型式番号除去
// フォールバック（下記）が正しく機能しなくなるため、長い表記を優先して判定する
const GRADE_PREFIX_PATTERN = /^(HGUC|HGCE|HGIBO|HGBF|HGBD|HGBM|HGAC|HGCC|HGBC|HGEX|MGEX|MGKA|MGSD|HG|RG|MG|PG|SD|EG|FM)/i

function toBandaiSearchKeyword(name: string): string {
  const cleaned = toHalfWidthAlnum(name).replace(/\d+\/\d+/g, '').replace(/[\s/]/g, '')
  return cleaned.replace(GRADE_PREFIX_PATTERN, '')
}

// "MSZ-010"や"RGM-89De"のような型式番号。バンダイ側の実際の商品名に型式番号が
// 含まれていない場合、キーワードに残したままだと部分一致せず0件になることが実測でわかった。
// 直前の文字がアルファベットの場合はマッチさせない（グレード表記の除去し残しを型式番号の
// 一部として巻き込んでしまう事故を防ぐため）
const MODEL_CODE_PATTERN = /(?<![A-Za-z])[A-Za-z]{1,4}-[A-Za-z0-9]+/g

function stripModelCode(keyword: string): string {
  return keyword.replace(MODEL_CODE_PATTERN, '')
}

// "タイプ-F"「Type-F」のようなバリエーション接尾辞。この部分まで含めた文字列だと
// バンダイ側の検索でヒット件数が0〜数件に絞られすぎて目的の商品が検索結果から
// 漏れることが実測でわかった（例:「ガンダムアストレアタイプ-F」では出てこないが
// 「ガンダムアストレア」まで削ると出てくる）。除去した上でより広く検索し、
// 最終的な絞り込みはJANコードまたは商品名の完全一致で行う
const QUALIFIER_SUFFIX_PATTERN = /(タイプ-?[A-Za-z0-9]+|type-?[A-Za-z0-9]+)$/i

function stripQualifierSuffix(keyword: string): string {
  return keyword.replace(QUALIFIER_SUFFIX_PATTERN, '')
}

// "（GUNDAM THUNDERBOLT Ver.）"のような末尾の括弧注記。バンダイの検索は
// 記号もそのまま含んだ生の部分一致で動くため、スペースを除去した検索語
// （例:"GUNDAMTHUNDERBOLTVer."）は、スペースを含むDB上の正式表記と
// 部分一致せず0件になる。この末尾括弧を丸ごと落とすと、商品名の本体部分
// （例:"高機動型ザク“サイコ・ザク”"）で検索でき、目的の商品が結果に出る
// ようになる（実測で確認）。最終的な絞り込みはJANコードまたは商品名の
// 完全一致で行うため、括弧を落として広く検索しても誤採用にはならない
const TRAILING_PARENTHETICAL_PATTERN = /[（(][^（）()]*[）)]$/

function stripTrailingParenthetical(keyword: string): string {
  return keyword.replace(TRAILING_PARENTHETICAL_PATTERN, '')
}

// 検索キーワードを段階的に緩めた候補列を作る（型式番号→末尾括弧注記→バリエーション接尾辞の順で除去）。
// バンダイ側の検索は情報を削って広く検索するほどヒットしやすくなる癖があるため、
// 呼び出し側は先頭から順に試し、最初にヒットした段階を採用する
function buildKeywordTiers(nameForSearch: string): string[] {
  const baseKeyword = toBandaiSearchKeyword(nameForSearch)
  if (!baseKeyword) return []

  const keywordTiers = [baseKeyword]
  const pushTier = (kw: string) => {
    if (kw && !keywordTiers.includes(kw)) keywordTiers.push(kw)
  }
  pushTier(stripModelCode(baseKeyword))
  pushTier(stripTrailingParenthetical(keywordTiers[keywordTiers.length - 1]))
  pushTier(stripQualifierSuffix(keywordTiers[keywordTiers.length - 1]))
  return keywordTiers
}

async function runBandaiSearch(keyword: string): Promise<BandaiProduct[]> {
  if (!keyword) return []

  const token = await fetchSearchTokenWithRetry(keyword)
  if (!token) return []

  const params = new URLSearchParams({
    ip: 'hobby',
    site: 'jp',
    token,
    limit: String(SEARCH_RESULT_LIMIT),
    start: '0',
    data: JSON.stringify({ title: keyword }),
  })

  const res = await fetchWithTimeout(`${PRODUCT_LIST_API}?${params.toString()}`, PRODUCT_FETCH_TIMEOUT_MS, {
    headers: { ...BANDAI_HEADERS, Referer: 'https://bandai-hobby.net/' },
    cache: 'no-store',
  })
  if (!res.ok) return []

  const body = await res.json()
  const list = body?.data?.product_list
  if (!Array.isArray(list)) return []

  return list
    .filter((item) => item?.product?.price && item?.product?.jancode)
    .map((item) => ({
      title: String(item.title ?? ''),
      price: Number(item.product.price),
      janCode: normalizeBandaiJanCode(String(item.product.jancode)),
      url: String(item.url ?? ''),
    }))
}

// バンダイ側のjancodeはJAN13桁の末尾に"000"等が付与された16桁で返ることがある。
// 実在のJANコードは常に先頭13桁（まれに8桁）なので、それより長ければ切り詰める。
// これをしないと、この値をそのまま他のJANコード前提のAPI（/api/refresh-price等）に
// 渡したときに桁数チェックで弾かれてしまう
function normalizeBandaiJanCode(jancode: string): string {
  return jancode.length > 13 ? jancode.slice(0, 13) : jancode
}

// バンダイ側のjancodeは上記の通り末尾に余分な桁が付くことがあるため、
// 正規化後も念のため前方一致で比較する（正規化ミスの際の保険）
function janCodeMatches(bandaiJanCode: string, scannedJanCode: string): boolean {
  return bandaiJanCode === scannedJanCode || bandaiJanCode.startsWith(scannedJanCode)
}

// 商品名の表記ゆれ（全角/半角・記号の有無）を吸収した上で完全一致するかを判定する。
// Yahoo!出品者向けのisNameMatching（bigram一致率ベース）は、公式サイト同士の
// 似た型番違い（例:「ジェガン(エコーズ仕様)」と「ジェガンD型(護衛隊仕様)」）まで
// 一致と判定してしまい、価格が異なる別商品を誤って採用する危険があったため使わない
function normalizeForExactMatch(text: string): string {
  return toHalfWidthAlnum(text)
    .toLowerCase()
    .replace(/[\s\-_/★☆■◆【】()[\]（）]/g, '')
}

// 単独で型式番号（"RGM-89De"等）になっているトークンか判定する。
// Yahoo!名にはあるがバンダイ正式名では「（エコーズ仕様）」のような別表記に
// なっていて不一致の元になるため、緩め照合のトークンからは除外する
function isModelCodeToken(token: string): boolean {
  return /^[A-Za-z]{1,4}-[A-Za-z0-9]+$/.test(token)
}

// 商品名を照合用の「内容トークン」に分解する。スペース区切りの各語のうち、
// 型式番号トークンだけを除外し、グレード（HGUC等）・スケール（1/144）・
// 日本語の要素は残す（これらは候補の絞り込みに有効なため）
function extractContentTokens(name: string): string[] {
  return name
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length > 0 && !isModelCodeToken(t))
}

// 緩め照合フォールバック。JAN一致・商品名完全一致のいずれも取れなかったときの最終手段。
// プレバン限定品の再発番などで、スキャンした新JANがバンダイ側のどの参照可能ソース
// （説明書サイト・検索索引・商品ページ）にも登録されておらず、かつYahoo!名も
// バンダイ正式名と命名規則が異なる（例:"RGM-89De ジェガン コンロイ機" vs
// "ジェガン（エコーズ仕様）コンロイ機"）ケースを、安全な範囲で救済する。
//
// 手順: 最も特徴的な日本語トークンで検索し、「全内容トークンを含む商品」を候補とする。
// 候補の価格が1種類に定まるときだけ採用する（＝実質一意に特定できるときのみ）。
// これにより「コンロイ機」のような一意な語を持つ商品は拾える一方、「ジェガンD型」の
// ように同名バリエーションが価格違いで複数ある曖昧な商品は採用しない
async function findByLooseNameMatch(nameForSearch: string): Promise<number | null> {
  const tokens = extractContentTokens(nameForSearch)
  const normalizedTokens = tokens.map(normalizeForExactMatch).filter((t) => t.length > 0)
  if (normalizedTokens.length === 0) return null

  // 検索は最も特徴的（＝長い、かつ日本語を含む）トークン1語で行う。
  // トークンを連結すると、間に「（エコーズ仕様）」等が挟まる正式名と部分一致せず0件になるため
  const searchToken = tokens
    .filter((t) => /[ぁ-んァ-ヶ一-龠]/.test(t))
    .sort((a, b) => b.length - a.length)[0]
  if (!searchToken) return null

  const products = await runBandaiSearch(toHalfWidthAlnum(searchToken))
  if (products.length === 0) return null

  const candidates = products.filter((p) => {
    const title = normalizeForExactMatch(p.title)
    return normalizedTokens.every((t) => title.includes(t))
  })
  if (candidates.length === 0) return null

  const distinctPrices = new Set(candidates.map((c) => c.price))
  return distinctPrices.size === 1 ? candidates[0].price : null
}

// JAN完全一致を最優先。見つからない場合の商品名フォールバックは、
// 説明書サイトで確認できた正式名称（canonicalName）がある場合のみ行う。
// Yahoo!出品者由来の商品名は「迷彩仕様」等のバリエーション表記が欠落して
// いることがあり、それを基準にすると別バリエーション（価格違い）の
// 商品名とたまたま完全一致して誤った価格を採用してしまうため
// （実例: プレバン限定「ジェガンＤ型（迷彩仕様）¥2,420」のYahoo名から
// 「迷彩仕様」が欠け、通常版「ジェガンＤ型 ¥1,980」に誤マッチした）
function findMatch(products: BandaiProduct[], janCode: string, canonicalName: string | null): number | null {
  const janMatched = products.find((p) => janCodeMatches(p.janCode, janCode))
  if (janMatched) return janMatched.price

  if (canonicalName === null) return null

  const target = normalizeForExactMatch(canonicalName)
  const nameMatched = products.filter((p) => normalizeForExactMatch(p.title) === target)
  return nameMatched.length === 1 ? nameMatched[0].price : null
}

export interface BandaiPriceLookupResult {
  officialPrice: number | null
  // 説明書サイトでJANコードから引けた正式な商品名。取得できた場合、
  // Yahoo!出品者由来の商品名より正確なため表示名としても優先的に使う
  canonicalName: string | null
}

// 商品名で検索し、実際にスキャンしたJANコードと一致する商品が見つかれば
// バンダイ公式の希望小売価格を返す。
// まず説明書サイトでJANコードから正式な商品名を引けた場合はそちらを優先して使い
// （Yahoo!の出品者由来の商品名よりノイズが無く正確なため）、検索キーワードは
// 型式番号・バリエーション接尾辞を順に削りながら広げて試す。
// 照合は次の優先順で行う:
// 1) JAN完全一致 … 最も確実
// 2) 商品名の完全一致 … 正式名称（canonicalName）が取れているときのみ。一意に絞れないときは不採用
// 3) 内容トークンでの緩め照合（findByLooseNameMatch） … 上記いずれも取れないときの最終手段。
//    プレバン再発番等で新JANがバンダイ側に無く、Yahoo!名も命名規則が異なるケースを、
//    価格が一意に定まる場合に限り救済する（曖昧な商品は不採用のまま）
export async function findOfficialPriceByJanCode(keyword: string, janCode: string): Promise<BandaiPriceLookupResult> {
  const canonicalName = await resolveCanonicalNameByJanCode(janCode)
  const nameForSearch = canonicalName ?? keyword

  const keywordTiers = buildKeywordTiers(nameForSearch)

  for (const tier of keywordTiers) {
    const products = await runBandaiSearch(tier)
    if (products.length === 0) continue
    const price = findMatch(products, janCode, canonicalName)
    if (price !== null) return { officialPrice: price, canonicalName }
  }

  // 最終手段: JAN一致・商品名完全一致で取れなかった場合、内容トークンでの緩め照合を試みる
  // （新JANがバンダイ側に無いプレバン再発番品などを、一意に特定できる場合に限り救済する）
  const loosePrice = await findByLooseNameMatch(nameForSearch)
  if (loosePrice !== null) return { officialPrice: loosePrice, canonicalName }

  return { officialPrice: null, canonicalName }
}

// キット名で検索し、候補商品の一覧をそのまま返す（JANコードによる絞り込みは行わない）。
// バーコードが手元に無いときに、キット名から直接バンダイ公式サイトの定価を
// 調べたい場合に使う。JAN照合と同じ段階的キーワード緩和（型式番号→末尾括弧注記→
// バリエーション接尾辞）で検索範囲を広げ、最初に1件以上ヒットした段階の結果を返す
export async function searchBandaiProductsByName(rawKeyword: string): Promise<BandaiProduct[]> {
  const keywordTiers = buildKeywordTiers(rawKeyword)

  for (const tier of keywordTiers) {
    const products = await runBandaiSearch(tier)
    if (products.length > 0) return products
  }

  return []
}
