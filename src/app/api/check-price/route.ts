import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = (supabaseUrl && supabaseAnonKey) ? createClient(supabaseUrl, supabaseAnonKey) : null;

const YAHOO_CLIENT_ID = process.env.YAHOO_CLIENT_ID;

// 商品名クレンジング関数
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

      if (cachedItem) {
        return NextResponse.json({
          source: "cache",
          itemName: cachedItem.item_name,
          officialPrice: cachedItem.official_price,
        });
      }
    }

    // --- STEP 2: Yahoo! APIの呼び出し（15件取得） ---
    if (!YAHOO_CLIENT_ID) {
      return NextResponse.json({ error: "Yahoo! APIの初期設定が完了していません" }, { status: 500 });
    }

    // 💡 results=15 に増やして複数のショップの情報を取得
    const yahooApiUrl = `https://shopping.yahooapis.jp/ShoppingWebService/V3/itemSearch?appid=${YAHOO_CLIENT_ID}&jan_code=${janCode}&results=15`;

    const res = await fetch(yahooApiUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      },
    });

    if (!res.ok) {
      const errorText = await res.text();
      return NextResponse.json({ error: `Yahoo! APIエラー (${res.status})` }, { status: 500 });
    }

    const yahooData = await res.json();

    if (!yahooData.hits || yahooData.hits.length === 0) {
      return NextResponse.json({ error: "該当する商品が見つかりませんでした" }, { status: 404 });
    }

    // 基準となるきれいな商品名は1件目から取得
    const rawItemName = yahooData.hits[0].name;
    const cleanedItemName = cleanItemName(rawItemName);

    // --- STEP 3: 優良ストアのデータから「定価」を掘り起こすロジック ---
    let detectedPrice = 0;

    // 信頼できる大手・正規ストアのリスト（ストアアカウント名）
    const trustedStores = [
      "joshinweb",       // 上新電機
      "y-kojima",        // コジマ
      "edion",           // エディオン
      "amiami",          // あみあみ
      "digitamin",       // でじたみん
      "hal-shop",        // ハピネット・オンライン
    ];

    // ヒットした15件の中に、信頼できるストアが出品しているか探す
    for (const hit of yahooData.hits) {
      const storeId = hit.seller?.id; // ストアのIDを取得

      // もし優良ストアのリストに一致したら、その価格を採用候補にする
      if (storeId && trustedStores.includes(storeId)) {
        // Yahoo! APIの価格データにメーカー希望小売価格が含まれているか確認
        if (hit.priceLabel?.fixedPrice) {
          detectedPrice = Number(hit.priceLabel.fixedPrice);
          break; // 確定したのでループを抜ける
        }
        // なければ、その正規店の販売価格そのものを定価として仮採用
        detectedPrice = Number(hit.price);
        break;
      }
    }

    // 万が一、15件の中に優良ストアが1つもなかった場合のセーフティネット
    if (detectedPrice === 0) {
      // ヒットした全ショップの中で「最安値」を定価の目安にする
      // （転売価格は釣り上がりますが、定価以下〜定価付近で売るまともな店が1店舗でも混ざっていればそれを拾うため）
      const prices = yahooData.hits.map((hit: any) => Number(hit.price));
      detectedPrice = Math.min(...prices);
    }

    // --- STEP 4: DBに保存 ---
    if (supabase) {
      try {
        await supabase.from("items").insert([
          { jan_code: janCode, item_name: cleanedItemName, official_price: detectedPrice }
        ]);
      } catch (dbError) {
        console.error("DB Insert Error (Skipped):", dbError);
      }
    }

    return NextResponse.json({
      source: "live_fetch",
      itemName: cleanedItemName,
      officialPrice: detectedPrice,
    });

  } catch (error: any) {
    console.error("システムエラー:", error);
    return NextResponse.json({ error: "サーバーエラーが発生しました" }, { status: 500 });
  }
}