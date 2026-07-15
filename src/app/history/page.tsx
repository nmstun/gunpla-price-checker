"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { fetchScanHistory } from "@/lib/supabase/scanHistory";
import { ScanHistoryEntry } from "@/types";

export default function HistoryPage() {
  const [entries, setEntries] = useState<ScanHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedStore, setSelectedStore] = useState<string>("すべて");

  useEffect(() => {
    fetchScanHistory()
      .then(setEntries)
      .finally(() => setLoading(false));
  }, []);

  const stores = useMemo(() => {
    const unique = Array.from(new Set(entries.map((e) => e.storeName)));
    return ["すべて", ...unique];
  }, [entries]);

  const filteredEntries = useMemo(() => {
    if (selectedStore === "すべて") return entries;
    return entries.filter((e) => e.storeName === selectedStore);
  }, [entries, selectedStore]);

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4 flex flex-col items-center font-sans">
      <header className="mb-6 text-center relative w-full max-w-md">
        <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
          📋 スキャン履歴
        </h1>
        <p className="text-sm text-gray-500 mt-1">店舗ごとにスキャンした商品を振り返る</p>
        <Link
          href="/"
          className="absolute top-0 right-0 text-xs font-bold text-blue-600 hover:text-blue-700 underline"
        >
          📷 スキャンへ戻る
        </Link>
      </header>

      <main className="w-full max-w-md bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-4">
        {stores.length > 1 && (
          <div className="flex flex-wrap gap-2">
            {stores.map((store) => (
              <button
                key={store}
                onClick={() => setSelectedStore(store)}
                className={`text-xs font-bold px-3 py-1.5 rounded-full border transition ${
                  selectedStore === store
                    ? "bg-blue-600 border-blue-600 text-white"
                    : "bg-white border-gray-200 text-gray-600 hover:border-blue-300"
                }`}
              >
                {store}
              </button>
            ))}
          </div>
        )}

        {loading && (
          <div className="text-center py-8 text-gray-500 text-sm animate-pulse">
            読み込み中...
          </div>
        )}

        {!loading && filteredEntries.length === 0 && (
          <div className="text-center py-8 text-gray-400 text-xs">
            まだスキャン履歴がありません。
          </div>
        )}

        {!loading && filteredEntries.length > 0 && (
          <div className="divide-y divide-gray-100 border border-gray-100 rounded-xl overflow-hidden">
            {filteredEntries.map((entry) => (
              <div key={entry.id} className="p-3.5 bg-white space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-gray-400">
                    {new Date(entry.scannedAt).toLocaleString("ja-JP")}
                  </span>
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                    🏬 {entry.storeName}
                  </span>
                </div>
                <p className="text-sm font-bold text-gray-800 leading-snug">{entry.itemName}</p>
                <div className="flex items-center justify-between">
                  <span className="text-lg font-black text-gray-900">
                    ¥{entry.officialPrice.toLocaleString()}
                  </span>
                  {entry.priceSource === "bandai_msrp" ? (
                    <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-green-100 text-green-700">
                      ✅ 公式照合済み
                    </span>
                  ) : (
                    <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
                      ⚠️ 推定値
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
