"use client";

import type { SessionScan } from "@/hooks/useBarcodeScanner";
import { formatYen } from "@/utils/price";

interface SessionScanListProps {
  scans: SessionScan[];
  onClear: () => void;
}

// このセッションで読み取った商品。棚の前で複数を見比べられるようにする。
// 2件以上たまってから出す（1件のときは結果表示と重複するため）
export function SessionScanList({ scans, onClear }: SessionScanListProps) {
  if (scans.length <= 1) return null;

  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">
          今回スキャンした商品
        </span>
        <button
          onClick={onClear}
          className="text-[11px] font-bold text-gray-400 active:text-gray-600"
        >
          クリア
        </button>
      </div>
      <div className="divide-y divide-gray-100 border border-gray-100 rounded-xl overflow-hidden">
        {scans.map((scan) => (
          <div key={scan.janCode} className="p-3 bg-white">
            <p className="text-sm font-bold text-gray-800 leading-snug">{scan.itemName}</p>
            <div className="flex items-center gap-x-3 mt-0.5 text-xs tabular-nums">
              <span className="text-gray-500">
                定価 {scan.officialPrice !== null ? formatYen(scan.officialPrice) : "未確認"}
              </span>
              <span className="text-gray-500">
                通販 {scan.lowestNewPrice !== null ? formatYen(scan.lowestNewPrice) : "未取得"}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
