"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { fetchScanHistory, deleteScanHistoryEntry } from "@/lib/supabase/scanHistory";
import { useSelectedStore } from "@/hooks/useSelectedStore";
import { detectGrade } from "@/utils/grade";
import { compareJa } from "@/utils/sort";
import { comparePrices, formatYen, VERDICT_PILL_CLASS } from "@/utils/price";
import { ScanHistoryEntry } from "@/types";

const DELETE_WIDTH = 88;

// 定価・店舗価格の両方が分かっている場合は「定価 → 店頭価格」の並びに差額バッジを添える。
// 一覧をスクロールしながらプレ値かどうかを拾えるよう、差額は右端に色付きバッジで固定表示する
function PriceSummary({
  officialPrice,
  officialPriceIsManual,
  storePrice,
}: {
  officialPrice: number | null;
  officialPriceIsManual: boolean;
  storePrice: number | null;
}) {
  // 定価が手動入力か公式照合済みかでバッジを出し分ける
  const officialBadge = officialPriceIsManual ? (
    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700">手動</span>
  ) : (
    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-green-100 text-green-700">公式</span>
  );

  if (officialPrice === null && storePrice === null) {
    return <span className="text-xs text-gray-400">定価未確認</span>;
  }

  if (officialPrice !== null && storePrice !== null) {
    const comparison = comparePrices(officialPrice, storePrice);
    return (
      <div className="flex items-center justify-between gap-2">
        <span className="min-w-0 truncate text-xs text-gray-500 tabular-nums">
          定価 {formatYen(officialPrice)}
          <span className="mx-1 text-gray-300">→</span>
          <span className="text-sm font-bold text-gray-900">{formatYen(storePrice)}</span>
        </span>
        <span
          className={`shrink-0 text-xs font-bold px-2 py-1 rounded-lg tabular-nums ${VERDICT_PILL_CLASS[comparison.verdict]}`}
        >
          {comparison.diffLabel}
        </span>
      </div>
    );
  }

  if (officialPrice !== null) {
    return (
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-gray-500 tabular-nums">
          定価 <span className="text-sm font-bold text-gray-900">{formatYen(officialPrice)}</span>
        </span>
        {officialBadge}
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-xs text-gray-500 tabular-nums">
        店頭 <span className="text-sm font-bold text-gray-900">{formatYen(storePrice!)}</span>
      </span>
      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-500">定価未確認</span>
    </div>
  );
}

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
        <div className="flex items-start gap-1.5 mt-1">
          <p className="text-sm font-bold text-gray-800 leading-snug">{entry.itemName}</p>
          {entry.isPremiumBandaiExclusive && (
            <span className="shrink-0 mt-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-purple-100 text-purple-700 whitespace-nowrap">
              プレバン限定
            </span>
          )}
        </div>
        <div className="mt-1.5">
          <PriceSummary
            officialPrice={entry.officialPrice}
            officialPriceIsManual={entry.officialPriceIsManual}
            storePrice={entry.storePrice}
          />
        </div>
      </div>
    </div>
  );
}

export default function HistoryPage() {
  const [entries, setEntries] = useState<ScanHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  // スキャン画面の「読取り店舗」選択と同じ永続化ストアを共有する。
  // 「すべて」はどの店舗も選ばれていない状態（＝共有値がnull）として扱う
  const { selectedStore: sharedStore, setSelectedStore: setSharedStore } = useSelectedStore();
  const selectedStore = sharedStore ?? "すべて";
  // グレード（HG/RG/MG等）の絞り込みは店舗選択と違い他画面と共有する意味が無いため、
  // この画面だけのローカルstateにする
  const [selectedGrade, setSelectedGrade] = useState("すべて");

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
    unique.sort(compareJa);
    return ["すべて", ...unique];
  }, [entries]);

  const grades = useMemo(() => {
    const unique = Array.from(new Set(entries.map((e) => detectGrade(e.itemName))));
    return ["すべて", ...unique];
  }, [entries]);

  const filteredEntries = useMemo(() => {
    return entries
      .filter((e) => selectedStore === "すべて" || e.storeName === selectedStore)
      .filter((e) => selectedGrade === "すべて" || detectGrade(e.itemName) === selectedGrade);
  }, [entries, selectedStore, selectedGrade]);

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
      <header className="mb-6 w-full max-w-md">
        <div className="flex items-start justify-between gap-3">
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
            スキャン履歴
          </h1>
          <Link
            href="/"
            className="shrink-0 text-sm font-bold text-blue-600 hover:text-blue-700 px-3 py-1.5 -mr-3 rounded-lg active:bg-blue-50"
          >
            スキャンへ戻る
          </Link>
        </div>
        <p className="text-sm text-gray-500 mt-1">タップして詳細・最安値を確認</p>
      </header>

      <main className="w-full max-w-md bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-4">
        {/* 絞り込みツールバー。店舗管理への導線もここにまとめ、カード内で
            リンクだけが宙に浮いて見えないようにしている */}
        <div className="space-y-2">
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">絞り込み</span>
            <Link
              href="/stores"
              className="shrink-0 text-[11px] font-bold text-blue-600 active:text-blue-700"
            >
              店舗管理（住所・地図）→
            </Link>
          </div>

          {(stores.length > 1 || grades.length > 1) && (
            <div className="flex gap-2">
              {stores.length > 1 && (
                <select
                  aria-label="店舗で絞り込む"
                  value={selectedStore}
                  onChange={(e) => setSharedStore(e.target.value === "すべて" ? null : e.target.value)}
                  className="flex-[3] min-w-0 text-sm text-gray-900 px-3 py-2.5 rounded-lg border border-gray-200 bg-white focus:outline-none focus:border-blue-400"
                >
                  {stores.map((store) => (
                    <option key={store} value={store}>
                      {store === "すべて" ? "すべての店舗" : store}
                    </option>
                  ))}
                </select>
              )}
              {grades.length > 1 && (
                <select
                  aria-label="グレードで絞り込む"
                  value={selectedGrade}
                  onChange={(e) => setSelectedGrade(e.target.value)}
                  className="flex-[2] min-w-0 text-sm text-gray-900 px-3 py-2.5 rounded-lg border border-gray-200 bg-white focus:outline-none focus:border-blue-400"
                >
                  {grades.map((grade) => (
                    <option key={grade} value={grade}>
                      {grade === "すべて" ? "全グレード" : grade}
                    </option>
                  ))}
                </select>
              )}
            </div>
          )}
        </div>

        {!loading && filteredEntries.length > 0 && (
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-xs text-gray-400 tabular-nums">{filteredEntries.length}件</span>
            <span className="text-[11px] text-gray-400">左にスワイプで削除</span>
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
              <SwipeableHistoryRow key={entry.id} entry={entry} onDeleted={handleDeleted} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
