"use client";

import { useParams, useSearchParams } from "next/navigation";
import { useMarketPrices } from "@/hooks/useMarketPrices";
import { PageShell, PageCard } from "@/components/PageShell";
import { MarketPriceRow } from "@/components/MarketPriceRow";
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
    <PageShell
      title="キット詳細"
      description="定価・最安値を確認できます"
      backHref="/"
      backLabel="戻る"
    >
      <PageCard spacing={5}>
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
          <MarketPriceRow
            loading={loading}
            lowestNewPrice={lowestNewPrice}
            lowestUsedPrice={lowestUsedPrice}
          />
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
      </PageCard>
    </PageShell>
  );
}
