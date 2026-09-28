"use client";

import type { CheckPriceResult } from "@/types";
import { formatYen } from "@/utils/price";
import { OfferList } from "@/components/OfferList";
import { StorePriceInput } from "@/components/StorePriceInput";

interface PriceResultProps {
  result: CheckPriceResult;
  onRescan: () => void;
}

// スキャン結果の表示：商品名、定価と最安値の比較、店舗価格の入力、ショップ一覧、再スキャン導線
export function PriceResult({ result, onRescan }: PriceResultProps) {
  return (
    <div className="space-y-5 animate-fadeIn">
      {/* 商品名 */}
      <div className="border-t border-gray-100 pt-4">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-xs font-semibold uppercase tracking-wider px-2 py-0.5 rounded bg-gray-100 text-gray-600">
            検証済み商品名
          </span>
          {result.isPremiumBandaiExclusive && (
            <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-purple-100 text-purple-700">
              プレバン限定
            </span>
          )}
        </div>
        <h2 className="text-lg font-bold text-gray-800 mt-1.5 leading-snug">
          {result.itemName}
        </h2>
      </div>

      {/* 定価・最安値の比較 */}
      <div className="rounded-xl border border-gray-100 divide-y divide-gray-100 overflow-hidden">
        {/* メーカー希望小売価格（バンダイ公式で確認できた場合のみ） */}
        <div className="p-4 bg-gradient-to-br from-blue-50 to-indigo-50 flex items-center justify-between gap-2">
          <div className="min-w-0">
            <span className="text-xs text-blue-600 font-medium block">メーカー希望小売価格</span>
            {result.officialPrice !== null ? (
              <span className="text-2xl font-normal text-blue-900 mt-1 block tabular-nums">
                {formatYen(result.officialPrice)}
              </span>
            ) : (
              <span className="text-sm text-gray-400 mt-1 block">未確認</span>
            )}
          </div>
          {result.officialPrice !== null ? (
            <span className="shrink-0 text-xs font-bold px-2 py-1 rounded-full bg-green-100 text-green-700 whitespace-nowrap">
              公式照合済み
            </span>
          ) : (
            <span className="shrink-0 text-xs font-bold px-2 py-1 rounded-full bg-gray-200 text-gray-600 whitespace-nowrap">
              未確認
            </span>
          )}
        </div>

        {/* 最安値。定価と比べる相手は新品の実売価格なので新品最安を主役にし、
            中古相場は下に添える */}
        <div className="p-4 bg-white">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs text-gray-500 font-medium">通販サイト最安値（新品）</span>
            {result.lowestNewPrice !== null ? (
              <span className="text-lg font-normal text-gray-900 tabular-nums">
                {formatYen(result.lowestNewPrice)}
              </span>
            ) : (
              <span className="text-xs text-gray-400">
                {result.lowestUsedPrice !== null ? "新品なし" : "未取得"}
              </span>
            )}
          </div>
          {result.lowestUsedPrice !== null && (
            <div className="flex items-center justify-between gap-2 mt-1">
              <span className="text-[11px] text-gray-400">中古最安</span>
              <span className="text-xs text-gray-500 tabular-nums">
                {formatYen(result.lowestUsedPrice)}
              </span>
            </div>
          )}
        </div>
      </div>
      <p className="text-[11px] text-gray-400">表示金額はすべて税込です</p>

      {/* 店舗の販売価格（任意） */}
      {result.scanHistoryId && (
        <StorePriceInput key={result.scanHistoryId} scanHistoryId={result.scanHistoryId} />
      )}

      {/* ショップリスト */}
      {result.offers && result.offers.length > 0 && <OfferList offers={result.offers} />}

      {/* 再スキャン用のボタンを下に配置 */}
      <button
        onClick={onRescan}
        className="w-full border-2 border-dashed border-gray-300 active:border-blue-500 active:bg-blue-50/30 text-gray-600 font-bold py-3 rounded-xl transition text-sm"
      >
        続けて別な商品をスキャンする
      </button>

      <div className="text-xs text-gray-500 text-center bg-gray-100 p-3 rounded-lg border border-gray-200 leading-relaxed">
        <b>名称安全フィルター作動中:</b> JANコードが一致していても、登録名が本来の商品と乖離している怪しい出品は自動的に非表示にしています。
      </div>
    </div>
  );
}
