"use client";

import { formatYen } from "@/utils/price";

interface MarketPriceRowProps {
  loading: boolean;
  lowestNewPrice: number | null;
  lowestUsedPrice: number | null;
}

// 通販サイト最安値の1行（履歴詳細・キット詳細の価格比較カード内で共用）。
// 定価と比べる相手は新品の実売価格なので新品最安を主役にし、中古相場は副次情報として添える
export function MarketPriceRow({ loading, lowestNewPrice, lowestUsedPrice }: MarketPriceRowProps) {
  return (
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
  );
}
