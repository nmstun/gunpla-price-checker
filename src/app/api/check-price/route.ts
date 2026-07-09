import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// キャッシュを一切持たせないためのNext.js用設定
export const dynamic = "force-dynamic";
export const revalidate = 0;

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = (supabaseUrl && supabaseAnonKey) ? createClient(supabaseUrl, supabaseAnonKey) : null;

const YAHOO_CLIENT_ID = process.env.YAHOO_CLIENT_ID;

// Offerオブジェクトの型定義（TypeScriptのエラーを防ぐため）
interface Offer {
  storeName: string;
  price: number;
  shippingFee: number;
  isConditional: boolean;
  url: string;
  storeId: string;
  fixedPrice: number;
}

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
  const cleanStr = (str: string) =>
    str.toLowerCase()
      .replace(/[！-～]/g, (s) => String.fromCharCode(s.charCodeAt(0) - 0xfee0)) // 全角英数を半角へ
      .replace(/[\s\-\_\/\★\☆\■\◆\【】\(\)\[\]]/g, "");

  const baseCleaned = cleanStr(baseName);
  const targetCleaned = cleanStr(targetName);

  if (baseCleaned.includes(targetCleaned) || targetCleaned.includes(baseCleaned)) {
    return true;
  }

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
  return matchRatio >= 0.5;
}

export async function POST(request: Request) {
  try {
    const { janCode } = await request.json();

    // ─── 修正後（13桁 または 8桁 を許可）───
    if (!janCode || (janCode.length !== 13 && janCode.length !== 8)) {
      return NextResponse.json({ error: "不正なJANコードです" }, { status: 400 });
    }

    if (!YAHOO_CLIENT_ID) {
      return NextResponse.json({ error: "Yahoo! APIの初期設定が完了していません" }, { status: 500 });
    }

    const yahooApiUrl = `https://shopping.yahooapis.jp/ShoppingWebService/V3/itemSearch?appid=${YAHOO_CLIENT_ID}&jan_code=${janCode}&results=20`;

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

    const trustedStores = ["joshinweb", "y-kojima", "edion", "amiami", "digitamin", "hal-shop"];
    let baseItemName = "";

    for (const hit of yahooData.hits) {
      if (hit.seller?.id && trustedStores.includes(hit.seller.id)) {
        baseItemName = hit.name;
        break;
      }
    }

    if (!baseItemName) {
      const crystalHit = yahooData.hits.find((h: any) => !h.seller?.id?.includes("ensyu") && !h.name.includes("ケース"));
      baseItemName = crystalHit ? crystalHit.name : yahooData.hits[0].name;
    }

    const cleanedBaseName = cleanItemName(baseItemName);

    const matchedHits = yahooData.hits.filter((hit: any) => {
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

    // 💡 TypeScriptエラー回避のため、配列全体に Offer[] 型を明示
    const offers: Offer[] = matchedHits.map((hit: any) => {
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
        storeId: hit.seller?.id || "",
        fixedPrice: hit.priceLabel?.fixedPrice ? Number(hit.priceLabel.fixedPrice) : 0
      };
    });

    // 💡 a, b の型が自動的に確定するため、ここでエラーが出なくなります
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