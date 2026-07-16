"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { fetchScanHistory, deleteScanHistoryEntry } from "@/lib/supabase/scanHistory";
import { ScanHistoryEntry } from "@/types";

const DELETE_WIDTH = 88;

function SwipeableHistoryRow({
  entry,
  onDeleted,
}: {
  entry: ScanHistoryEntry;
  onDeleted: (id: string) => void;
}) {
  const router = useRouter();
  const [dragX, setDragX] = useState(0);
  const [isPointerDown, setIsPointerDown] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const startXRef = useRef<number | null>(null);
  const baseXRef = useRef(0);
  const draggedRef = useRef(false);

  const handlePointerDown = (e: React.PointerEvent) => {
    startXRef.current = e.clientX;
    baseXRef.current = dragX;
    draggedRef.current = false;
    setIsPointerDown(true);
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // 合成的なポインタイベント等、キャプチャできない場合は無視して続行する
    }
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (startXRef.current === null) return;
    const delta = e.clientX - startXRef.current;
    if (Math.abs(delta) > 5) draggedRef.current = true;
    setDragX(Math.min(0, Math.max(-DELETE_WIDTH, baseXRef.current + delta)));
  };

  const handlePointerUp = () => {
    setIsPointerDown(false);
    startXRef.current = null;
    setDragX((current) => (current < -DELETE_WIDTH / 2 ? -DELETE_WIDTH : 0));
  };

  const handleRowClick = () => {
    if (draggedRef.current) {
      draggedRef.current = false;
      return;
    }
    if (dragX !== 0) {
      setDragX(0);
      return;
    }
    router.push(`/history/${entry.id}`);
  };

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setDeleting(true);
    const ok = await deleteScanHistoryEntry(entry.id);
    if (ok) {
      onDeleted(entry.id);
    } else {
      setDeleting(false);
      setDragX(0);
    }
  };

  return (
    <div className="relative overflow-hidden bg-white">
      <button
        onClick={handleDelete}
        disabled={deleting}
        style={{ width: DELETE_WIDTH }}
        className="absolute inset-y-0 right-0 flex items-center justify-center bg-red-500 text-white text-sm font-bold active:bg-red-600 disabled:opacity-60"
      >
        {deleting ? "削除中..." : "削除"}
      </button>
      <div
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onClick={handleRowClick}
        style={{
          transform: `translateX(${dragX}px)`,
          transition: isPointerDown ? "none" : "transform 0.2s ease",
          touchAction: "pan-y",
        }}
        className="relative bg-white active:bg-gray-50 p-3.5 cursor-pointer select-none"
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-[11px] font-bold text-gray-400 shrink-0">
              {new Date(entry.scannedAt).toLocaleDateString("ja-JP")}
            </span>
            <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 truncate">
              {entry.storeName}
            </span>
          </div>
          <span className="text-gray-300 shrink-0">›</span>
        </div>
        <p className="text-sm font-bold text-gray-800 leading-snug mt-1">{entry.itemName}</p>
        <div className="flex items-center justify-between mt-1.5">
          {entry.officialPrice !== null ? (
            <>
              <span className="text-base font-black text-gray-900">
                ¥{entry.officialPrice.toLocaleString()}
              </span>
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-green-100 text-green-700">
                公式
              </span>
            </>
          ) : entry.storePrice !== null ? (
            <>
              <span className="text-base font-black text-gray-900">
                ¥{entry.storePrice.toLocaleString()}
              </span>
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-gray-200 text-gray-600">
                店舗価格
              </span>
            </>
          ) : (
            <span className="text-xs text-gray-400">定価未確認</span>
          )}
        </div>
      </div>
    </div>
  );
}

export default function HistoryPage() {
  const [entries, setEntries] = useState<ScanHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedStore, setSelectedStore] = useState<string>("すべて");

  useEffect(() => {
    fetchScanHistory()
      .then(setEntries)
      .finally(() => setLoading(false));
  }, []);

  const handleDeleted = (id: string) => {
    setEntries((prev) => prev.filter((e) => e.id !== id));
  };

  const stores = useMemo(() => {
    const unique = Array.from(new Set(entries.map((e) => e.storeName)));
    return ["すべて", ...unique];
  }, [entries]);

  const filteredEntries = useMemo(() => {
    if (selectedStore === "すべて") return entries;
    return entries.filter((e) => e.storeName === selectedStore);
  }, [entries, selectedStore]);

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
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
            スキャン履歴
          </h1>
          <p className="text-sm text-gray-500 mt-1">タップして詳細・最安値を確認</p>
        </div>
        <Link
          href="/"
          className="shrink-0 text-sm font-bold text-blue-600 hover:text-blue-700 px-3 py-2 -mr-3 rounded-lg active:bg-blue-50"
        >
          スキャンへ戻る
        </Link>
      </header>

      <main className="w-full max-w-md bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-4">
        {stores.length > 1 && (
          <div className="flex flex-wrap gap-2">
            {stores.map((store) => (
              <button
                key={store}
                onClick={() => setSelectedStore(store)}
                className={`text-sm font-bold px-3.5 py-2 rounded-full border transition ${selectedStore === store
                  ? "bg-blue-600 border-blue-600 text-white"
                  : "bg-white border-gray-200 text-gray-600 active:border-blue-300"
                  }`}
              >
                {store}
              </button>
            ))}
          </div>
        )}

        {!loading && filteredEntries.length > 0 && (
          <p className="text-[11px] text-gray-400 text-center">左にスワイプすると削除できます</p>
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
              <SwipeableHistoryRow key={entry.id} entry={entry} onDeleted={handleDeleted} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
