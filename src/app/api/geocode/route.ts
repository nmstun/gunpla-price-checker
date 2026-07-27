import { NextResponse } from 'next/server'

// 住所→緯度経度の変換。国土地理院の住所検索APIを使う（APIキー不要で、
// 日本の住所を番地レベルまで解決できるため）。ブラウザから直接叩くとCORSに
// 依存してしまうので、サーバー側で中継する
const GSI_ENDPOINT = 'https://msearch.gsi.go.jp/address-search/AddressSearch'

export const dynamic = 'force-dynamic'

interface GsiFeature {
  geometry?: { coordinates?: [number, number] }
}

export async function POST(request: Request) {
  try {
    const { address } = await request.json()
    if (typeof address !== 'string' || !address.trim()) {
      return NextResponse.json({ error: '住所が指定されていません' }, { status: 400 })
    }

    const url = `${GSI_ENDPOINT}?q=${encodeURIComponent(address.trim())}`
    const res = await fetch(url, { cache: 'no-store' })
    if (!res.ok) {
      return NextResponse.json({ error: '住所の検索に失敗しました' }, { status: 502 })
    }

    const features = (await res.json()) as GsiFeature[]
    const coordinates = features?.[0]?.geometry?.coordinates
    if (!coordinates) {
      // 変換できない住所もあるため、エラーではなく「座標なし」として返す
      return NextResponse.json({ latitude: null, longitude: null })
    }

    // 国土地理院は [経度, 緯度] の順で返す
    const [longitude, latitude] = coordinates
    return NextResponse.json({ latitude, longitude })
  } catch (error) {
    console.error('ジオコーディングに失敗:', error)
    return NextResponse.json({ error: '住所の検索に失敗しました' }, { status: 500 })
  }
}
