"use client";

import { advisePurchase, BUY_VERDICT_CLASS, comparePrices, formatYen } from "@/utils/price";

interface PurchaseAdviceBannerProps {
  officialPrice: number | null;
  storePrice: number | null;
  lowestNewPrice: number | null;
}

// 店頭で買うべきかを最初に言い切る。定価との差だけでは決められず、
// 実際の判断は「定価・店頭価格・通販最安値」の三者関係で決まるため、
// 通販の方が明確に安いなら定価以下でも見送りと出す
export function PurchaseAdviceBanner({ officialPrice, storePrice, lowestNewPrice }: PurchaseAdviceBannerProps) {
  const advice = advisePurchase({ officialPrice, storePrice, lowestNewPrice });
  if (!advice) return null;

  const comparison =
    officialPrice !== null && storePrice !== null ? comparePrices(officialPrice, storePrice) : null;

  return (
    <div className={`rounded-xl border px-4 py-3 ${BUY_VERDICT_CLASS[advice.verdict]}`}>
      <p className="text-lg font-bold leading-snug">{advice.headline}</p>
      <p className="text-sm font-bold mt-0.5 tabular-nums">{advice.reason}</p>
      <p className="text-xs mt-1.5 opacity-80 tabular-nums">
        {officialPrice !== null && `定価 ${formatYen(officialPrice)}`}
        {storePrice !== null && ` / 店頭 ${formatYen(storePrice)}`}
        {lowestNewPrice !== null && ` / 通販 ${formatYen(lowestNewPrice)}`}
      </p>
      {comparison !== null && comparison.verdict === "markup" && (
        <p className="text-xs mt-0.5 opacity-80 tabular-nums">
          店頭は定価より {formatYen(comparison.diff)} 高い
          {comparison.ratioLabel && `（定価の${comparison.ratioLabel}）`}
        </p>
      )}
    </div>
  );
}
