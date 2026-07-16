"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { fetchScanHistoryEntry, updateStorePrice } from "@/lib/supabase/scanHistory";
import { ScanHistoryEntry, RefreshPriceResult } from "@/types";

export default function HistoryDetailPage() {
  const params = useParams<{ id: string }>();
  const [entry, setEntry] = useState<ScanHistoryEntry | null>(null);
  const [loading, setLoading] = useState(true);

  const [priceInput, setPriceInput] = useState("");
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "error">("idle");
  const [isEditingStorePrice, setIsEditingStorePrice] = useState(false);

  const [refreshing, setRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  // 最安値は都度取得の値なので保存しない。画面を開いた瞬間に自動取得する
  const [lowestMarketPrice, setLowestMarketPrice] = useState<number | null>(null);
  const [lowestMarketLoading, setLowestMarketLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setLowestMarketPrice(null);

      const data = await fetchScanHistoryEntry(params.id);
      if (cancelled) return;
      setEntry(data);
      setPriceInput(data?.storePrice?.toString() ?? "");
      setLoading(false);

      if (!data) return;

      setLowestMarketLoading(true);
      try {
        const res = await fetch("/api/refresh-price", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ janCode: data.janCode, persist: false }),
        });
        const json = await res.json();
        if (!cancelled && res.ok) {
          setLowestMarketPrice((json as RefreshPriceResult).lowestMarketPrice);
        }
      } catch {
        // 自動取得の失敗は静かに諦める（下の「定価を再取得する」で再試行できる）
      } finally {
        if (!cancelled) setLowestMarketLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [params.id]);

  const handleStartEditStorePrice = () => {
    if (!entry) return;
    setPriceInput(entry.storePrice?.toString() ?? "");
    setSaveStatus("idle");
    setIsEditingStorePrice(true);
  };

  const handleCancelEditStorePrice = () => {
    setSaveStatus("idle");
    setIsEditingStorePrice(false);
  };

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
      setSaveStatus("idle");
      setIsEditingStorePrice(false);
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
      const refreshed = data as RefreshPriceResult;
      setEntry({
        ...entry,
        itemName: refreshed.itemName,
        officialPrice: refreshed.officialPrice,
      });
      setLowestMarketPrice(refreshed.lowestMarketPrice);
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
          <p className="text-sm text-gray-500 mt-1">定価・最安値・店舗価格を比較できます</p>
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

            {/* 定価・最安値・店舗価格の比較。3行ともラベル(text-xs)を行の先頭に置き、
                主要な値は同じ左端位置・同系統のフォントサイズで揃えている */}
            <div className="rounded-xl border border-gray-100 divide-y divide-gray-100 overflow-hidden">
              {/* メーカー希望小売価格（バンダイ公式で確認できた場合のみ） */}
              <div className="p-4 bg-gradient-to-br from-blue-50 to-indigo-50 flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <span className="text-xs text-blue-600 font-medium block">メーカー希望小売価格</span>
                  {entry.officialPrice !== null ? (
                    <span className="text-2xl font-black text-blue-900 mt-1 block">
                      ¥{entry.officialPrice.toLocaleString()}
                      <span className="text-xs font-normal text-gray-500"> (税込)</span>
                    </span>
                  ) : (
                    <span className="text-sm text-gray-400 mt-1 block">未確認</span>
                  )}
                </div>
                {entry.officialPrice !== null ? (
                  <span className="shrink-0 text-xs font-bold px-2 py-1 rounded-full bg-green-100 text-green-700 whitespace-nowrap">
                    公式照合済み
                  </span>
                ) : (
                  <span className="shrink-0 text-xs font-bold px-2 py-1 rounded-full bg-gray-200 text-gray-600 whitespace-nowrap">
                    未確認
                  </span>
                )}
              </div>

              {/* 最安値（画面表示時に自動取得。保存はしない） */}
              <div className="p-4 bg-white">
                <span className="text-xs text-gray-500 font-medium block">Yahoo!ショッピング最安値</span>
                {lowestMarketLoading ? (
                  <span className="text-sm text-gray-400 mt-1 flex items-center gap-1.5">
                    <span className="w-3 h-3 border-2 border-gray-300 border-t-transparent rounded-full animate-spin" />
                    取得中...
                  </span>
                ) : lowestMarketPrice !== null ? (
                  <span className="text-2xl font-black text-gray-900 mt-1 block">
                    ¥{lowestMarketPrice.toLocaleString()}
                  </span>
                ) : (
                  <span className="text-sm text-gray-400 mt-1 block">取得できませんでした</span>
                )}
              </div>

              {/* 店舗価格（任意・編集可）。普段は他の2行と同じ「ラベル→大きな値」の
                  表示のみで、「編集」ボタンを押したときだけ入力欄に切り替える */}
              <div className="p-4 bg-gray-50">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <span className="text-xs text-gray-500 font-medium block">この店舗での価格（任意）</span>
                    {!isEditingStorePrice && (
                      entry.storePrice !== null ? (
                        <span className="text-2xl font-black text-gray-900 mt-1 block">
                          ¥{entry.storePrice.toLocaleString()}
                        </span>
                      ) : (
                        <span className="text-sm text-gray-400 mt-1 block">未入力</span>
                      )
                    )}
                  </div>
                  {!isEditingStorePrice && (
                    <button
                      onClick={handleStartEditStorePrice}
                      className="shrink-0 text-xs font-bold px-2 py-1 rounded-full bg-gray-200 text-gray-600 active:bg-gray-300 transition whitespace-nowrap"
                    >
                      編集
                    </button>
                  )}
                </div>

                {isEditingStorePrice && (
                  <div className="mt-1">
                    <div className="flex gap-2">
                      <div className="flex-1 relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xl pointer-events-none">
                          ¥
                        </span>
                        <input
                          type="number"
                          inputMode="numeric"
                          autoFocus
                          value={priceInput}
                          onChange={(e) => {
                            setPriceInput(e.target.value);
                            setSaveStatus("idle");
                          }}
                          placeholder="例: 6800"
                          className="w-full text-2xl font-black text-gray-900 pl-8 pr-3 py-1.5 rounded-lg border border-gray-200 bg-white focus:outline-none focus:border-blue-400"
                        />
                      </div>
                      <button
                        onClick={handleSaveStorePrice}
                        disabled={saveStatus === "saving"}
                        className="shrink-0 self-center text-sm font-bold px-4 py-2 rounded-lg bg-white border border-gray-200 text-gray-600 active:bg-gray-100 transition disabled:opacity-50"
                      >
                        保存
                      </button>
                      <button
                        onClick={handleCancelEditStorePrice}
                        disabled={saveStatus === "saving"}
                        className="shrink-0 self-center text-sm font-bold px-3 py-2 rounded-lg text-gray-400 active:bg-gray-100 transition disabled:opacity-50"
                      >
                        取消
                      </button>
                    </div>
                    {saveStatus === "error" && (
                      <p className="text-[11px] text-red-600 mt-1.5">保存に失敗しました。もう一度お試しください</p>
                    )}
                  </div>
                )}
              </div>
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
                最安値は画面を開くたびに自動取得されます。定価そのものを更新したい場合はこちらを押してください（数秒〜10秒程度かかることがあります）
              </p>
              {refreshError && <p className="text-[11px] text-red-600 text-center">{refreshError}</p>}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
