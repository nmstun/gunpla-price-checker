import { Offer } from '@/types'

// 楽天市場商品検索API。Yahoo!ショッピングAPIと違いJANコード専用の検索条件が無いため、
// JANコードをキーワードとして投げる。商品説明文まで検索対象に含める必要があるので
// field=0（絞り込みの弱い検索）を指定している
const RAKUTEN_ENDPOINT = 'https://app.rakuten.co.jp/services/api/IchibaItem/Search/20220601'

const FETCH_TIMEOUT_MS = 8000

export interface RakutenItem {
  itemName?: string
  itemPrice?: number | string
  itemUrl?: string
  shopName?: string
  shopCode?: string
  // 0:送料込み(送料無料) / 1:送料別
  postageFlag?: number | string
  // 0:在庫なし / 1:在庫あり
  availability?: number | string
}

interface RakutenSearchResponse {
  // レスポンスは Items[].Item にネストされる形式と、Items[] に直接並ぶ形式が
  // バージョンによって異なるため、どちらでも読めるようにしておく
  Items?: Array<{ Item?: RakutenItem } & RakutenItem>
}

export async function fetchRakutenItems(janCode: string, applicationId: string): Promise<RakutenItem[]> {
  const params = new URLSearchParams({
    applicationId,
    keyword: janCode,
    hits: '30',
    field: '0',
    availability: '1',
    sort: '+itemPrice',
    format: 'json',
  })

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)

  try {
    const res = await fetch(`${RAKUTEN_ENDPOINT}?${params.toString()}`, {
      cache: 'no-store',
      signal: controller.signal,
    })

    if (!res.ok) {
      throw new Error(`楽天APIエラー (${res.status})`)
    }

    const data = (await res.json()) as RakutenSearchResponse
    return (data.Items ?? []).map((entry) => entry.Item ?? entry)
  } finally {
    clearTimeout(timeoutId)
  }
}

export function toOffer(item: RakutenItem): Offer {
  return {
    storeName: item.shopName || '不明なショップ',
    price: Number(item.itemPrice ?? 0),
    // 楽天が返すのは「送料込み(0)か送料別(1)か」だけで実額は分からないため、
    // 送料別のときは金額を推測せず「送料別」とだけ伝える
    shipping: String(item.postageFlag ?? '') === '1' ? { kind: 'separate' } : { kind: 'free' },
    url: item.itemUrl || '#',
    storeId: item.shopCode || '',
    fixedPrice: 0,
    source: 'rakuten',
  }
}
