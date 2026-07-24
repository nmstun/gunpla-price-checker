import { NextResponse } from 'next/server'
import { KitSearchResultItem } from '@/types'
import { searchBandaiProductsByName } from '@/utils/bandaiHobby'

// バーコードが手元に無いときに、キット名から直接バンダイ公式サイトを検索する。
// スキャン履歴には保存しない、その場限りの検索
export const dynamic = 'force-dynamic'
export const revalidate = 0

// 表示しきれないほど多い候補（一般的すぎるキーワード等）が返ってきた場合に画面を埋め尽くさないよう上限を設ける
const RESULT_DISPLAY_LIMIT = 15

export async function POST(request: Request) {
  try {
    const { keyword } = await request.json()
    if (typeof keyword !== 'string' || !keyword.trim()) {
      return NextResponse.json({ error: 'キット名を入力してください' }, { status: 400 })
    }

    const products = await searchBandaiProductsByName(keyword.trim())
    const results: KitSearchResultItem[] = products.slice(0, RESULT_DISPLAY_LIMIT).map((p) => ({
      title: p.title,
      price: p.price,
      janCode: p.janCode,
      url: p.url,
    }))

    return NextResponse.json({ results })
  } catch (error) {
    console.error('システムエラー:', error)
    return NextResponse.json({ error: 'サーバーエラーが発生しました' }, { status: 500 })
  }
}
