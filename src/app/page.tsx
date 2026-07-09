"use client";

import { useState } from "react";

interface Offer {
  storeName: string;
  price: number;
  url: string;
}

interface ScanResult {
  source: "cache" | "live_fetch";
  itemName: string;
  officialPrice: number;
  offers?: Offer[];
}

export default function Home() {
  const [result, setResult] = useState<ScanResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCheckPrice = async (janCode: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/check-price", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ janCode }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "価格の取得に失敗しました");
      }

      setResult(data);
    } catch (err: any) {
      setError(err.message);
      setResult(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4 flex flex-col items-center font-sans">
      <header className="mb-8 text-center">
        <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
          🤖 ガンプラ定価チェッカー
        </h1>
        <p className="text-sm text-gray-500 mt-1">バーコードをかざして転売価格を見破る</p>
      </header>

      <main className="w-full max-w-md bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-6">
        {/* スキャナープレースホルダー */}
        <div className="bg-gray-900 h-44 rounded-xl flex flex-col items-center justify-center text-white text-sm relative overflow-hidden p-4 text-center">
          <p className="text-gray-400">【ここにカメラ/スキャナーが起動します】</p>

          <button
            onClick={() => handleCheckPrice("4573102555816")}
            className="absolute bottom-3 bg-blue-600 hover:bg-blue-700 text-xs px-3 py-1.5 rounded-lg shadow-sm font-medium transition"
          >
            テスト用スキャン（サラ）
          </button>
        </div>

        {/* ⏳ ローディング表示 */}
        {loading && (
          <div className="text-center py-4 text-gray-500 text-sm animate-pulse">
            🔍 大手量販店の価格を巡回中...
          </div>
        )}

        {/* ❌ エラー表示 */}
        {error && (
          <div className="p-4 bg-red-50 text-red-700 text-sm rounded-xl border border-red-100">
            ⚠️ {error}
          </div>
        )}

        {/* 🎉 結果表示 */}
        {result && (
          <div className="space-y-5">
            {/* 商品名 */}
            <div className="border-t border-gray-100 pt-4">
              <span className="text-xs font-semibold uppercase tracking-wider px-2 py-0.5 rounded bg-gray-100 text-gray-600">
                商品名
              </span>
              <h2 className="text-lg font-bold text-gray-800 mt-1.5 leading-snug">
                {result.itemName}
              </h2>
            </div>

            {/* 基準定価カード */}
            <div className="p-4 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl border border-blue-100 flex items-center justify-between">
              <div>
                <span className="text-xs text-blue-600 font-medium block">
                  量販店・公式基準価格（定価目安）
                </span>
                <span className="text-2xl font-black text-blue-900 mt-1 block">
                  ¥{result.officialPrice.toLocaleString()} <span className="text-xs font-normal text-gray-500">(税込)</span>
                </span>
              </div>

              <div className="text-right">
                <span className="text-xs text-gray-400 block">情報ソース</span>
                <span className="inline-block mt-1 text-xs font-bold px-2 py-1 rounded-full bg-green-100 text-green-700 shadow-2xs">
                  🌐 Yahoo!流通データ
                </span>
              </div>
            </div>

            {/* 安値ショップリスト */}
            {result.offers && result.offers.length > 0 && (
              <div className="space-y-2.5">
                <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1">
                  🛒 ネット通販の最安値ショップ（上位3件）
                </h3>
                <div className="divide-y divide-gray-100 border border-gray-100 rounded-xl overflow-hidden bg-gray-50">
                  {result.offers.map((offer, index) => (
                    <a
                      key={index}
                      href={offer.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-between p-3.5 bg-white hover:bg-gray-50/80 transition-colors group"
                    >
                      <div className="flex items-center gap-2.5 max-w-[70%]">
                        <span className={`text-xs font-bold w-5 h-5 flex items-center justify-center rounded-full ${index === 0 ? "bg-amber-100 text-amber-700" :
                            index === 1 ? "bg-slate-200 text-slate-700" :
                              "bg-orange-100 text-orange-700"
                          }`}>
                          {index + 1}
                        </span>
                        <span className="text-sm font-medium text-gray-700 truncate group-hover:text-blue-600 transition-colors">
                          {offer.storeName}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm font-bold text-gray-900">
                          ¥{offer.price.toLocaleString()}
                        </span>
                        <span className="text-xs text-gray-300 group-hover:text-blue-500 group-hover:translate-x-0.5 transition-all">
                          ➔
                        </span>
                      </div>
                    </a>
                  ))}
                </div>
              </div>
            )}

            <div className="text-xs text-gray-400 text-center italic pt-2">
              ※各ショップをタップすると、Yahoo!ショッピングの商品ページ（外部リンク）を開きます。
            </div>
          </div>
        )}
      </main>
    </div>
  );
}