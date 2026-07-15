const SEARCH_PAGE_URL = 'https://bandai-hobby.net/search/'
const PRODUCT_LIST_API = 'https://cmsapi-frontend.bandai-hobby.net/site/api/hobby/Product/list'
const FETCH_TIMEOUT_MS = 8000
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'

interface BandaiProduct {
  title: string
  price: number
  janCode: string
  url: string
}

async function fetchWithTimeout(url: string, init?: RequestInit): Promise<Response> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
  try {
    return await fetch(url, { ...init, signal: controller.signal })
  } finally {
    clearTimeout(timeoutId)
  }
}

// bandai-hobby.netの検索結果ページに埋め込まれたAPIトークンを取得する。
// 公式に公開されたAPIではなく、サイトのフロントエンドが内部的に叩いているものを流用しているため、
// サイト側の実装変更で壊れる可能性がある（その場合はfindOfficialPriceByJanCodeがnullを返し、
// 呼び出し側は既存の目安価格ロジックにフォールバックする）
async function fetchSearchToken(keyword: string): Promise<string | null> {
  const url = `${SEARCH_PAGE_URL}?title=${encodeURIComponent(keyword)}&product=on`
  const res = await fetchWithTimeout(url, {
    headers: { 'User-Agent': USER_AGENT },
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

async function searchBandaiHobbyProducts(keyword: string): Promise<BandaiProduct[]> {
  const token = await fetchSearchTokenWithRetry(keyword)
  if (!token) return []

  const params = new URLSearchParams({
    ip: 'hobby',
    site: 'jp',
    token,
    limit: '8',
    start: '0',
    data: JSON.stringify({ title: keyword }),
  })

  const res = await fetchWithTimeout(`${PRODUCT_LIST_API}?${params.toString()}`, {
    headers: { 'User-Agent': USER_AGENT, Referer: 'https://bandai-hobby.net/' },
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
      janCode: String(item.product.jancode),
      url: String(item.url ?? ''),
    }))
}

// バンダイ側のjancodeはJAN13桁の末尾に "000" 等が付与された16桁で返ることがあるため前方一致で比較する
function janCodeMatches(bandaiJanCode: string, scannedJanCode: string): boolean {
  return bandaiJanCode === scannedJanCode || bandaiJanCode.startsWith(scannedJanCode)
}

// 商品名で検索し、実際にスキャンしたJANコードと一致する商品が見つかれば
// バンダイ公式の希望小売価格を返す。見つからなければnull（呼び出し側で目安価格にフォールバック）
export async function findOfficialPriceByJanCode(keyword: string, janCode: string): Promise<number | null> {
  const products = await searchBandaiHobbyProducts(keyword)
  const matched = products.find((p) => janCodeMatches(p.janCode, janCode))
  return matched ? matched.price : null
}
