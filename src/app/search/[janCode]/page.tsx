"use client";

import { useParams, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useMarketPrices } from "@/hooks/useMarketPrices";
import { OfferList } from "@/components/OfferList";
import { formatYen } from "@/utils/price";

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

  const { offers, lowestNewPrice, lowestUsedPrice, loading } = useMarketPrices(params.janCode);

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
      <header className="mb-6 w-full max-w-md">
        <div className="flex items-start justify-between gap-3">
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">キット詳細</h1>
          <Link
            href="/"
            className="shrink-0 text-sm font-bold text-blue-600 hover:text-blue-700 px-3 py-1.5 -mr-3 rounded-lg active:bg-blue-50"
          >
            戻る
          </Link>
        </div>
        <p className="text-sm text-gray-500 mt-1">定価・最安値を確認できます</p>
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
            <span className="text-2xl font-normal text-blue-900 mt-1 block tabular-nums">
              {formatYen(price)}
            </span>
          </div>
          {/* 定価と比べる相手は新品の実売価格なので新品最安を主役にし、
              中古相場は副次情報として添える */}
          <div className="p-4 bg-white">
            <span className="text-xs text-gray-500 font-medium block">通販サイト最安値（新品）</span>
            {loading ? (
              <span className="text-sm text-gray-400 mt-1 flex items-center gap-1.5">
                <span className="w-3 h-3 border-2 border-gray-300 border-t-transparent rounded-full animate-spin" />
                取得中...
              </span>
            ) : lowestNewPrice !== null ? (
              <span className="text-2xl font-normal text-gray-900 mt-1 block tabular-nums">
                {formatYen(lowestNewPrice)}
              </span>
            ) : (
              <span className="text-sm text-gray-400 mt-1 block">
                {lowestUsedPrice !== null ? "新品の出品が見つかりませんでした" : "取得できませんでした"}
              </span>
            )}
            {!loading && lowestUsedPrice !== null && (
              <span className="text-xs text-gray-500 mt-1 block tabular-nums">
                中古最安 {formatYen(lowestUsedPrice)}
              </span>
            )}
          </div>
        </div>
        <p className="text-[11px] text-gray-400">表示金額はすべて税込です</p>

        {/* ショップリスト（最安値TOP3。スキャン結果・履歴詳細画面と同じ表示） */}
        {offers.length > 0 && <OfferList offers={offers} />}

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
