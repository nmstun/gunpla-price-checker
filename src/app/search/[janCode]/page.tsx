"use client";

import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Offer, RefreshPriceResult } from "@/types";

// キット名検索（/search-kit-name）で選んだ商品の詳細画面。
// scan_historyに紐づくレコードが無い（バーコードをスキャンしていない）ため、
// 商品名・定価・バンダイ公式ページのURLはこの画面には無く、遷移元からクエリ
// パラメータで受け取る。最安値だけは履歴詳細画面と同様、JANコードで都度取得する
export default function KitSearchDetailPage() {
  const params = useParams<{ janCode: string }>();
  const searchParams = useSearchParams();

  const title = searchParams.get("title") ?? "";
  const price = Number(searchParams.get("price") ?? "0");
  const officialUrl = searchParams.get("url") ?? "";

  const [offers, setOffers] = useState<Offer[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setOffers([]);
      try {
        const res = await fetch("/api/refresh-price", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ janCode: params.janCode, persist: false }),
        });
        const json = await res.json();
        if (!cancelled && res.ok) {
          setOffers((json as RefreshPriceResult).offers);
        }
      } catch {
        // 自動取得の失敗は静かに諦める
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [params.janCode]);

  return (
    <div
      className="min-h-screen bg-gray-50 flex flex-col items-center font-sans"
      style={{
        paddingTop: "max(2rem, env(safe-area-inset-top))",
        paddingBottom: "max(2rem, env(safe-area-inset-bottom))",
        paddingLeft: "max(1rem, env(safe-area-inset-left))",
        paddingRight: "max(1rem, env(safe-area-inset-right))",
      }}
    >
      <header className="mb-6 w-full max-w-md flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">キット詳細</h1>
          <p className="text-sm text-gray-500 mt-1">定価・最安値を確認できます</p>
        </div>
        <Link
          href="/"
          className="shrink-0 text-sm font-bold text-blue-600 hover:text-blue-700 px-3 py-2 -mr-3 rounded-lg active:bg-blue-50"
        >
          戻る
        </Link>
      </header>

      <main className="w-full max-w-md bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-5">
        <div>
          <h2 className="text-lg font-bold text-gray-800 leading-snug">{title}</h2>
          <p className="text-xs text-gray-400 mt-1">JAN: {params.janCode}</p>
        </div>

        {/* 定価・最安値の比較。履歴詳細画面と同じ「ラベル→大きな値」のカードで揃えている */}
        <div className="rounded-xl border border-gray-100 divide-y divide-gray-100 overflow-hidden">
          <div className="p-4 bg-gradient-to-br from-blue-50 to-indigo-50">
            <span className="text-xs text-blue-600 font-medium block">メーカー希望小売価格</span>
            <span className="text-2xl font-normal text-blue-900 mt-1 block">
              ¥{price.toLocaleString()}
              <span className="text-xs font-normal text-gray-500"> (税込)</span>
            </span>
          </div>
          <div className="p-4 bg-white">
            <span className="text-xs text-gray-500 font-medium block">Yahoo!ショッピング最安値</span>
            {loading ? (
              <span className="text-sm text-gray-400 mt-1 flex items-center gap-1.5">
                <span className="w-3 h-3 border-2 border-gray-300 border-t-transparent rounded-full animate-spin" />
                取得中...
              </span>
            ) : offers.length > 0 ? (
              <span className="text-2xl font-normal text-gray-900 mt-1 block">
                ¥{offers[0].price.toLocaleString()}
              </span>
            ) : (
              <span className="text-sm text-gray-400 mt-1 block">取得できませんでした</span>
            )}
          </div>
        </div>

        {/* ショップリスト（最安値TOP3。スキャン結果・履歴詳細画面と同じ表示） */}
        {offers.length > 0 && (
          <div className="space-y-2.5">
            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider">
              同一商品ショップ（本体価格順）
            </h3>
            <div className="divide-y divide-gray-100 border border-gray-100 rounded-xl overflow-hidden bg-gray-50">
              {offers.map((offer, index) => (
                <a
                  key={index}
                  href={offer.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between p-3.5 bg-white active:bg-gray-50 transition-colors group"
                >
                  <div className="flex items-center gap-2.5 max-w-[65%]">
                    <span className={`text-xs font-bold w-5 h-5 flex items-center justify-center rounded-full ${index === 0 ? "bg-amber-100 text-amber-700" :
                      index === 1 ? "bg-slate-200 text-slate-700" :
                        "bg-orange-100 text-orange-700"
                      }`}>
                      {index + 1}
                    </span>
                    <div className="truncate">
                      <span className="text-sm font-bold text-gray-700 block truncate">
                        {offer.storeName}
                      </span>
                      <span className="text-[11px] text-gray-400 block mt-0.5">
                        送料: {
                          offer.shippingFee === 0
                            ? (offer.isConditional ? "無料（※条件付の可能性あり）" : "無料")
                            : `¥${offer.shippingFee}`
                        }
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <div className="text-right">
                      <span className="text-xs text-gray-400 block font-normal">商品価格</span>
                      <span className="text-lg font-normal text-gray-900">
                        ¥{offer.price.toLocaleString()}
                      </span>
                    </div>
                    <span className="text-xs text-gray-300">
                      ›
                    </span>
                  </div>
                </a>
              ))}
            </div>
          </div>
        )}

        {officialUrl && (
          <a
            href={officialUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="block text-center text-xs font-bold text-blue-600 active:text-blue-700 py-2"
          >
            バンダイ公式ページを見る
          </a>
        )}
      </main>
    </div>
  );
}
