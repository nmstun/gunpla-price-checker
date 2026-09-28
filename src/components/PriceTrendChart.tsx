"use client";

import type { PricePoint } from "@/lib/supabase/scanHistory";
import { formatYen } from "@/utils/price";

interface PriceTrendChartProps {
  points: PricePoint[];
  // 表示中の現在の通販最安値（取得できていなければnull）
  currentPrice: number | null;
}

// 相場の推移。同じJANコードを過去にスキャンした時点の通販最安値を並べ、
// プレ値化が進んでいるかを見る。最安値を記録する前の古い履歴は値を持たないため除く
export function PriceTrendChart({ points: allPoints, currentPrice }: PriceTrendChartProps) {
  const points = allPoints.filter((p) => p.lowestNewPrice !== null);
  if (points.length === 0) return null;

  const previous = points[points.length - 1];
  const change =
    currentPrice !== null && previous.lowestNewPrice !== null
      ? currentPrice - previous.lowestNewPrice
      : null;
  const maxPrice = Math.max(...points.map((p) => p.lowestNewPrice as number), currentPrice ?? 0);

  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider">
          通販最安値の推移
        </h3>
        {change !== null && (
          <span
            className={`text-xs font-bold tabular-nums ${change > 0 ? "text-red-600" : change < 0 ? "text-green-600" : "text-gray-400"}`}
          >
            {/* 比較対象は記録の中で最も新しいもの。表示中のスキャン自身とは限らないため
                「前回スキャン」ではなく「直近の記録」と表現する */}
            直近の記録から
            {change > 0 ? `+${formatYen(change)}` : change < 0 ? `-${formatYen(Math.abs(change))}` : "変動なし"}
          </span>
        )}
      </div>
      <div className="space-y-1.5 rounded-xl border border-gray-100 p-3">
        {points.map((point, index) => (
          <div key={index} className="flex items-center gap-2">
            <span className="shrink-0 w-20 text-[11px] text-gray-400 tabular-nums">
              {new Date(point.scannedAt).toLocaleDateString("ja-JP")}
            </span>
            {/* 外側を固定幅のトラックにし、内側のバーで比率を表す。
                バー自体をflex項目にすると縮小が効いて全て同じ長さに潰れる */}
            <span className="flex-1 h-2 rounded-full bg-gray-100 overflow-hidden">
              <span
                className="block h-full rounded-full bg-gray-400"
                style={{
                  width: `${Math.max(4, ((point.lowestNewPrice as number) / maxPrice) * 100)}%`,
                }}
              />
            </span>
            <span className="shrink-0 text-xs text-gray-600 tabular-nums">
              {formatYen(point.lowestNewPrice as number)}
            </span>
          </div>
        ))}
        {currentPrice !== null && (
          <div className="flex items-center gap-2 pt-1.5 border-t border-gray-100">
            <span className="shrink-0 w-20 text-[11px] font-bold text-gray-500">現在</span>
            <span className="flex-1 h-2 rounded-full bg-gray-100 overflow-hidden">
              <span
                className="block h-full rounded-full bg-blue-500"
                style={{ width: `${Math.max(4, (currentPrice / maxPrice) * 100)}%` }}
              />
            </span>
            <span className="shrink-0 text-xs font-bold text-gray-900 tabular-nums">
              {formatYen(currentPrice)}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
