import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// キャッシュを一切持たせないためのNext.js用設定
export const dynamic = "force-dynamic";
export const revalidate = 0;

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = (supabaseUrl && supabaseAnonKey) ? createClient(supabaseUrl, supabaseAnonKey) : null;

const YAHOO_CLIENT_ID = process.env.YAHOO_CLIENT_ID;

function cleanItemName(name: string): string {
  if (!name) return "";
  let cleaned = name;
  const noiseWords = [
    /中古/g, /新品/g, /プラモデル/g, /フィギュア/g, /おもちゃ/g, /玩具/g,
    /【.*?】/g, /＼.*?／/g, /\[.*?\]/g, /\(.*?\)/g, /送料無料/g, /送料込み/g
  ];
  noiseWords.forEach((regex) => { cleaned = cleaned.replace(regex, ""); });
  return cleaned.replace(/\s+/g, " ").trim();
}

function isNameMatching(baseName: string, targetName: string): boolean {
  // すべて小文字、半角、スペース・記号排除
  const cleanStr = (str: string) =>
    str.toLowerCase()
      .replace(/[！-～]/g, (s) => String.fromCharCode(s.charCodeAt(0) - 0xfee0)) // 全角英数を半角へ
      .replace(/[\s\-\_\/\★\☆\■\◆\【】\(\)\[\]]/g, "");

  const baseCleaned = cleanStr(baseName);
  const targetCleaned = cleanStr(targetName);

  if (baseCleaned.includes(targetCleaned) || targetCleaned.includes(baseCleaned)) {
    return true;
  }

  // 2文字ずつのバイグラムでより厳密にチェック
  const getKeywords = (str: string) => {
    const words = [];
    for (let i = 0; i < str.length - 1; i++) {
      words.push(str.substring(i, i + 2));
    }
    return words;
  };

  const baseKeywords = getKeywords(baseCleaned);
  if (baseKeywords.length === 0) return true;

  let matchCount = 0;
  baseKeywords.forEach(word => {
    if (targetCleaned.includes(word)) matchCount++;
  });

  const matchRatio = matchCount / baseKeywords.length;
  // 💡 誤認識を強固に弾くため、一致率のボーダーを 50% に引き上げ
  return matchRatio >= 0.5;
}

export async function POST(request: Request) {
  try {
    const { janCode } = await request.json();

    if (!janCode || janCode.length !== 13) {
      return NextResponse.json({ error: "不正なJANコードです" }, { status: 400 });
    }

    if (!YAHOO_CLIENT_ID) {
      return NextResponse.json({ error: "Yahoo! APIの初期設定が完了していません" }, { status: 500 });
    }

    const yahooApiUrl = `https://shopping.yahooapis.jp/ShoppingWebService/V3/itemSearch?appid=${YAHOO_CLIENT_ID}&jan_code=${janCode}&results=20`;

    // 💡 【重要】 cache: "no-store" を追加し、Next.jsの古いキャッシュを強制的に破棄
    const res = await fetch(yahooApiUrl, {
      cache: "no-store",
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

    // 1. まず最も信頼できるストアから「本物の基準名」を決定
    const trustedStores = ["joshinweb", "y-kojima", "edion", "amiami", "digitamin", "hal-shop"];
    let baseItemName = "";

    for (const hit of yahooData.hits) {
      if (hit.seller?.id && trustedStores.includes(hit.seller.id)) {
        baseItemName = hit.name;
        break;
      }
    }

    // 大手がいなければ1件目を暫定基準にしつつ、あからさまな日用品ストアっぽい名前（ensyuなど）を避けるロジック
    if (!baseItemName) {
      const crystalHit = yahooData.hits.find((h: any) => !h.seller?.id?.includes("ensyu") && !h.name.includes("ケース"));
      baseItemName = crystalHit ? crystalHit.name : yahooData.hits[0].name;
    }

    const cleanedBaseName = cleanItemName(baseItemName);

    // 2. 💡 基準名と「商品名が不一致なデータ」を完全に排除（ensyu2017などもここで不一致判定され消えます）
    const matchedHits = yahooData.hits.filter((hit: any) => {
      // ストアIDに特定のノイズ店舗（ensyuなど）が分かっている場合はここで直接ハード弾き
      if (hit.seller?.id === "ensyu2017" || hit.url?.includes("ensyu2017")) {
        return false;
      }
      if (hit.name.includes("ケースのみ") || hit.name.includes("ジャンク")) {
        return false;
      }
      return isNameMatching(cleanedBaseName, hit.name);
    });

    if (matchedHits.length === 0) {
      return NextResponse.json({ error: "正しい商品データが確認できませんでした" }, { status: 404 });
    }

    const offers = matchedHits.map((hit: any) => {
      const shippingName = hit.shipping?.name || "";
      let shippingFee = 0;
      if (!shippingName.includes("送料無料")) {
        const match = shippingName.match(/\d+/);
        if (match) shippingFee = Number(match[0]);
      }

      return {
        storeName: hit.seller?.name || "不明なショップ",
        price: Number(hit.price),
        shippingFee: shippingFee,
        isConditional: hit.shipping?.name?.includes("条件") || hit.shipping?.code === 1 || hit.shipping?.code === "1",
        url: hit.url || "#",
        storeId: hit.seller?.id,
        fixedPrice: hit.priceLabel?.fixedPrice ? Number(hit.priceLabel.fixedPrice) : 0
      };
    });

    const sortedOffers = offers.sort((a, b) => a.price - b.price);
    const topOffers = sortedOffers.slice(0, 3);

    let detectedPrice = 0;
    for (const offer of topOffers) {
      if (offer.storeId && trustedStores.includes(offer.storeId)) {
        if (offer.fixedPrice > 0) {
          detectedPrice = offer.fixedPrice;
          break;
        }
        detectedPrice = offer.price;
        break;
      }
    }

    if (detectedPrice === 0) {
      detectedPrice = topOffers[0].price;
    }

    if (supabase) {
      try {
        await supabase.from("items").insert([
          { jan_code: janCode, item_name: cleanedBaseName, official_price: detectedPrice }
        ]);
      } catch (dbError) {
        console.error("DB保存スキップ:", dbError);
      }
    }

    return NextResponse.json({
      source: "live_fetch",
      itemName: cleanedBaseName,
      officialPrice: detectedPrice,
      offers: topOffers
    });

  } catch (error: any) {
    console.error("システムエラー:", error);
    return NextResponse.json({ error: "サーバーエラーが発生しました" }, { status: 500 });
  }
}