import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = (supabaseUrl && supabaseAnonKey) ? createClient(supabaseUrl, supabaseAnonKey) : null;

const YAHOO_CLIENT_ID = process.env.YAHOO_CLIENT_ID;

// 商品名からノイズ文字列を削ぎ落とす関数
function cleanItemName(name: string): string {
  if (!name) return "";
  let cleaned = name;
  const noiseWords = [
    /中古/g, /新品/g, /プラモデル/g, /フィギュア/g, /おもちゃ/g, /玩具/g,
    /【.*?】/g, /＼.*?／/g, /\[.*?\]/g, /\(.*?\)/g,
  ];
  noiseWords.forEach((regex) => { cleaned = cleaned.replace(regex, ""); });
  return cleaned.replace(/\s+/g, " ").trim();
}

export async function POST(request: Request) {
  try {
    const { janCode } = await request.json();

    if (!janCode || janCode.length !== 13) {
      return NextResponse.json({ error: "不正なJANコードです" }, { status: 400 });
    }

    // --- STEP 1: Supabaseキャッシュ確認 ---
    if (supabase) {
      const { data: cachedItem } = await supabase
        .from("items")
        .select("*")
        .eq("jan_code", janCode)
        .maybeSingle();

      // ショップ情報を常に最新にするため、今回はそのまま live_fetch へ流します
    }

    // --- STEP 2: Yahoo! APIの呼び出し（15件取得） ---
    if (!YAHOO_CLIENT_ID) {
      return NextResponse.json({ error: "Yahoo! APIの初期設定が完了していません" }, { status: 500 });
    }

    const yahooApiUrl = `https://shopping.yahooapis.jp/ShoppingWebService/V3/itemSearch?appid=${YAHOO_CLIENT_ID}&jan_code=${janCode}&results=15`;

    const res = await fetch(yahooApiUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      },
    });

    if (!res.ok) {
      return NextResponse.json({ error: `Yahoo! APIエラー (${res.status})` }, { status: 500 });
    }

    const yahooData = await res.json();

    if (!yahooData.hits || yahooData.hits.length === 0) {
      return NextResponse.json({ error: "該当する商品が見つかりませんでした" }, { status: 404 });
    }

    const rawItemName = yahooData.hits[0].name;
    const cleanedItemName = cleanItemName(rawItemName);

    // --- STEP 3: 安い順（価格の昇順）にショップ情報を並び替えて上位3件を抽出 ---
    const sortedHits = [...yahooData.hits].sort((a, b) => Number(a.price) - Number(b.price));

    const topOffers = sortedHits.slice(0, 3).map((hit: any) => ({
      storeName: hit.seller?.name || "不明なショップ",
      price: Number(hit.price),
      url: hit.url || "#"
    }));

    // --- STEP 4: 基準価格（定価目安）の決定ロジック ---
    let detectedPrice = 0;
    const trustedStores = ["joshinweb", "y-kojima", "edion", "amiami", "digitamin", "hal-shop"];

    // 15件の中に大手正規店があれば、その定価・販売価格の情報を最優先で採用
    for (const hit of yahooData.hits) {
      const storeId = hit.seller?.id;
      if (storeId && trustedStores.includes(storeId)) {
        if (hit.priceLabel?.fixedPrice) {
          detectedPrice = Number(hit.priceLabel.fixedPrice);
          break;
        }
        detectedPrice = Number(hit.price);
        break;
      }
    }

    // もし大手正規店がいなければ、今回の15件の中の最安値を基準価格とする
    if (detectedPrice === 0) {
      detectedPrice = topOffers[0].price;
    }

    // --- STEP 5: Supabase DBへの保存 ---
    if (supabase) {
      try {
        await supabase.from("items").insert([
          { jan_code: janCode, item_name: cleanedItemName, official_price: detectedPrice }
        ]);
      } catch (dbError) {
        console.error("DB Insert Error (Skipped):", dbError);
      }
    }

    // 画面側へのデータ返却
    return NextResponse.json({
      source: "live_fetch",
      itemName: cleanedItemName,
      officialPrice: detectedPrice,
      offers: topOffers
    });

  } catch (error: any) {
    console.error("システムエラー:", error);
    return NextResponse.json({ error: "サーバーエラーが発生しました" }, { status: 500 });
  }
}