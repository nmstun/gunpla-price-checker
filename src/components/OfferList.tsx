"use client";

import type { CheckPriceResult } from "@/types";
import { formatShipping, formatYen, OFFER_SOURCE_LABEL } from "@/utils/price";

interface OfferListProps {
  offers: NonNullable<CheckPriceResult["offers"]>;
}

// 同一商品を扱うショップの一覧（本体価格順）。上位3件は順位バッジの色を変えている
export function OfferList({ offers }: OfferListProps) {
  return (
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
            className="flex items-center gap-2.5 p-3.5 bg-white active:bg-gray-50 transition-colors"
          >
            <span
              className={`shrink-0 text-xs font-bold w-5 h-5 flex items-center justify-center rounded-full ${
                index === 0
                  ? "bg-amber-100 text-amber-700"
                  : index === 1
                    ? "bg-slate-200 text-slate-700"
                    : "bg-orange-100 text-orange-700"
              }`}
            >
              {index + 1}
            </span>
            <div className="flex-1 min-w-0">
              <span className="text-sm font-bold text-gray-700 block truncate">
                {offer.storeName}
              </span>
              <span className="text-[11px] text-gray-400 mt-0.5 flex items-center gap-1.5">
                <span className="shrink-0 px-1 py-px rounded bg-gray-100 text-gray-500 font-bold">
                  {OFFER_SOURCE_LABEL[offer.source]}
                </span>
                {offer.condition === "used" && (
                  <span className="shrink-0 px-1 py-px rounded bg-amber-100 text-amber-700 font-bold">
                    中古
                  </span>
                )}
                <span className="truncate">{formatShipping(offer.shipping)}</span>
              </span>
            </div>
            <span className="shrink-0 text-lg font-normal text-gray-900 tabular-nums">
              {formatYen(offer.price)}
            </span>
            <span className="shrink-0 text-xs text-gray-300">›</span>
          </a>
        ))}
      </div>
    </div>
  );
}
