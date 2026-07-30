import { Offer } from '@/types'
import { isUsedListing } from './itemName'
import { toTaxIncludedPrice } from './price'

// 楽天市場商品検索API。Yahoo!ショッピングAPIと違いJANコード専用の検索条件が無いため、
// JANコードをキーワードとして投げる。商品説明文まで検索対象に含める必要があるので
// field=0（絞り込みの弱い検索）を指定している
// 公式ドキュメントが現在案内しているエンドポイント（旧来の
// app.rakuten.co.jp/services/api/... ではなく openapi.rakuten.co.jp 側）を使う
const RAKUTEN_ENDPOINT = 'https://openapi.rakuten.co.jp/ichibams/api/IchibaItem/Search/20260701'

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
  // 0:税込 / 1:税抜。1のときはitemPriceが税抜なので税込へ換算する
  taxFlag?: number | string
}

interface RakutenSearchResponse {
  // レスポンスは Items[].Item にネストされる形式と、Items[] に直接並ぶ形式が
  // バージョンによって異なるため、どちらでも読めるようにしておく
  Items?: Array<{ Item?: RakutenItem } & RakutenItem>
}

export interface RakutenCredentials {
  applicationId: string
  accessKey: string
  /** アプリ登録時に指定したアプリケーションURL。Referer/Originの検証に使われる */
  appUrl: string
}

// applicationIdだけでなくアクセスキーも必須。さらに2026年のインフラ刷新で
// リクエスト元の検証が入り、Referer・Originが無いと403（REQUEST_CONTEXT_BODY_HTTP_
// REFERRER_MISSING）になるため、登録済みのアプリケーションURLを両ヘッダーで送る。
// アクセスキーはクエリパラメータでも渡せるが、URLやアクセスログに残さないようヘッダーで送る
export async function fetchRakutenItems(
  janCode: string,
  { applicationId, accessKey, appUrl }: RakutenCredentials
): Promise<RakutenItem[]> {
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
      headers: {
        accessKey,
        Referer: appUrl.endsWith('/') ? appUrl : `${appUrl}/`,
        Origin: appUrl.replace(/\/$/, ''),
      },
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
    price: toTaxIncludedPrice(Number(item.itemPrice ?? 0), String(item.taxFlag ?? '0') !== '1'),
    // 楽天が返すのは「送料込み(0)か送料別(1)か」だけで実額は分からないため、
    // 送料別のときは金額を推測せず「送料別」とだけ伝える
    shipping: String(item.postageFlag ?? '') === '1' ? { kind: 'separate' } : { kind: 'free' },
    url: item.itemUrl || '#',
    storeId: item.shopCode || '',
    fixedPrice: 0,
    source: 'rakuten',
    condition: isUsedListing(item.itemName ?? '') ? 'used' : 'new',
  }
}
