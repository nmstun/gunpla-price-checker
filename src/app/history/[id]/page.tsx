"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { fetchScanHistoryEntry, updateStorePrice } from "@/lib/supabase/scanHistory";
import { ScanHistoryEntry, PriceSource } from "@/types";

interface RefreshResponse {
  itemName: string;
  officialPrice: number;
  priceSource: PriceSource;
  lowestMarketPrice: number | null;
}

export default function HistoryDetailPage() {
  const params = useParams<{ id: string }>();
  const [entry, setEntry] = useState<ScanHistoryEntry | null>(null);
  const [loading, setLoading] = useState(true);

  const [priceInput, setPriceInput] = useState("");
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");

  const [refreshing, setRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState<string | null>(null);

  useEffect(() => {
    fetchScanHistoryEntry(params.id)
      .then((data) => {
        setEntry(data);
        setPriceInput(data?.storePrice?.toString() ?? "");
      })
      .finally(() => setLoading(false));
  }, [params.id]);

  const handleSaveStorePrice = async () => {
    if (!entry) return;
    const trimmed = priceInput.trim();
    const price = trimmed === "" ? null : Number(trimmed);
    if (price !== null && (!Number.isFinite(price) || price < 0)) {
      setSaveStatus("error");
      return;
    }
    setSaveStatus("saving");
    const ok = await updateStorePrice(entry.id, price);
    if (ok) {
      setEntry({ ...entry, storePrice: price });
      setSaveStatus("saved");
    } else {
      setSaveStatus("error");
    }
  };

  const handleRefresh = async () => {
    if (!entry) return;
    setRefreshing(true);
    setRefreshError(null);
    try {
      const res = await fetch("/api/refresh-price", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scanHistoryId: entry.id, janCode: entry.janCode }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "定価の再取得に失敗しました");
      }
      const refreshed = data as RefreshResponse;
      setEntry({
        ...entry,
        itemName: refreshed.itemName,
        officialPrice: refreshed.officialPrice,
        priceSource: refreshed.priceSource,
        lowestMarketPrice: refreshed.lowestMarketPrice,
      });
    } catch (err) {
      setRefreshError(err instanceof Error ? err.message : "定価の再取得に失敗しました");
    } finally {
      setRefreshing(false);
    }
  };

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
      <header className="mb-6 w-full max-w-md flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">履歴詳細</h1>
          <p className="text-sm text-gray-500 mt-1">定価の再確認や販売価格の記録ができます</p>
        </div>
        <Link
          href="/history"
          className="shrink-0 text-sm font-bold text-blue-600 hover:text-blue-700 px-3 py-2 -mr-3 rounded-lg active:bg-blue-50"
        >
          一覧へ戻る
        </Link>
      </header>

      <main className="w-full max-w-md bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-5">
        {loading && (
          <div className="text-center py-8 text-gray-500 text-sm animate-pulse">読み込み中...</div>
        )}

        {!loading && !entry && (
          <div className="text-center py-8 text-gray-400 text-xs">履歴が見つかりませんでした。</div>
        )}

        {entry && (
          <>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold text-gray-400">
                  {new Date(entry.scannedAt).toLocaleString("ja-JP")}
                </span>
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                  {entry.storeName}
                </span>
              </div>
              <h2 className="text-lg font-bold text-gray-800 mt-1.5 leading-snug">{entry.itemName}</h2>
              <p className="text-xs text-gray-400 mt-1">JAN: {entry.janCode}</p>
            </div>

            {/* 定価カード */}
            <div className="p-4 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl border border-blue-100 flex items-center justify-between gap-2">
              <div className="min-w-0">
                <span className="text-xs text-blue-600 font-medium block">
                  {entry.priceSource === "bandai_msrp" ? "メーカー希望小売価格" : "量販店価格の目安（未確認）"}
                </span>
                <span className="text-2xl font-black text-blue-900 mt-1 block">
                  ¥{entry.officialPrice.toLocaleString()}
                  <span className="text-xs font-normal text-gray-500"> (税込)</span>
                </span>
              </div>
              <div className="shrink-0 text-right">
                <span className="text-xs text-gray-400 block">情報ソース</span>
                {entry.priceSource === "bandai_msrp" ? (
                  <span className="inline-block mt-1 text-xs font-bold px-2 py-1 rounded-full bg-green-100 text-green-700 whitespace-nowrap">
                    公式照合済み
                  </span>
                ) : (
                  <span className="inline-block mt-1 text-xs font-bold px-2 py-1 rounded-full bg-amber-100 text-amber-700 whitespace-nowrap">
                    未確認・推定
                  </span>
                )}
              </div>
            </div>

            {/* 最安値 */}
            <div className="p-4 bg-gray-50 rounded-xl border border-gray-100 flex items-center justify-between">
              <span className="text-xs text-gray-500 font-medium">Yahoo!ショッピング最安値</span>
              {entry.lowestMarketPrice !== null ? (
                <span className="text-lg font-black text-gray-900">
                  ¥{entry.lowestMarketPrice.toLocaleString()}
                </span>
              ) : (
                <span className="text-xs text-gray-400">未取得（定価再取得で確認できます）</span>
              )}
            </div>

            {/* 定価再取得 */}
            <div className="space-y-1.5">
              <button
                onClick={handleRefresh}
                disabled={refreshing}
                className="w-full text-sm font-bold px-4 py-3 rounded-xl bg-gray-800 text-white active:bg-gray-900 transition disabled:opacity-50"
              >
                {refreshing ? "再取得中..." : "定価を再取得する"}
              </button>
              <p className="text-[11px] text-gray-400 text-center">
                Yahoo!ショッピング・バンダイ公式サイトに再度問い合わせます（数秒〜10秒程度かかることがあります）
              </p>
              {refreshError && <p className="text-[11px] text-red-600 text-center">{refreshError}</p>}
            </div>

            {/* 店舗の販売価格（任意） */}
            <div className="space-y-1.5 border-t border-gray-100 pt-4">
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block">
                この店舗での販売価格（任意）
              </label>
              <div className="flex gap-2">
                <div className="flex-1 relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-base pointer-events-none">
                    ¥
                  </span>
                  <input
                    type="number"
                    inputMode="numeric"
                    value={priceInput}
                    onChange={(e) => {
                      setPriceInput(e.target.value);
                      setSaveStatus("idle");
                    }}
                    placeholder="例: 6800"
                    className="w-full text-base text-gray-900 pl-7 pr-3 py-2.5 rounded-lg border border-gray-200 focus:outline-none focus:border-blue-400"
                  />
                </div>
                <button
                  onClick={handleSaveStorePrice}
                  disabled={saveStatus === "saving"}
                  className="shrink-0 text-sm font-bold px-4 py-2.5 rounded-lg bg-gray-100 text-gray-600 active:bg-gray-200 transition disabled:opacity-50"
                >
                  保存
                </button>
              </div>
              {saveStatus === "saved" && <p className="text-[11px] text-green-600">保存しました</p>}
              {saveStatus === "error" && (
                <p className="text-[11px] text-red-600">保存に失敗しました。もう一度お試しください</p>
              )}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
