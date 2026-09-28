"use client";

import { useCheckPrice } from "@/hooks/useCheckPrice";
import { useFavoriteStores } from "@/hooks/useFavoriteStores";
import { useSelectedStore } from "@/hooks/useSelectedStore";
import { useBarcodeScanner } from "@/hooks/useBarcodeScanner";
import { StoreSelector } from "@/components/StoreSelector";
import { ScannerView } from "@/components/ScannerView";
import { SessionScanList } from "@/components/SessionScanList";
import { KitNameSearch } from "@/components/KitNameSearch";
import { PriceResult } from "@/components/PriceResult";
import { PageShell, PageCard } from "@/components/PageShell";

export default function Home() {
  const { result, loading, error, checkPrice, reset } = useCheckPrice();
  const { stores, addStore, removeStore } = useFavoriteStores();

  // 読取り店舗の選択状態。スキャン画面⇔履歴画面の行き来で選び直さずに済むよう
  // localStorageに永続化する（画面遷移のたびにコンポーネントは作り直されるため）
  const { selectedStore, setSelectedStore } = useSelectedStore();

  const scanner = useBarcodeScanner({ selectedStore, stores, checkPrice, reset });
  const displayError = error || scanner.cameraError;

  return (
    <PageShell
      title="ガンプラ定価チェッカー"
      description="カメラをバーコードにかざして転売価格を見破る"
      backHref="/history"
      backLabel="履歴"
    >
      <PageCard spacing={6}>
        <StoreSelector
          stores={stores}
          addStore={addStore}
          removeStore={removeStore}
          selectedStore={selectedStore}
          setSelectedStore={setSelectedStore}
        />

        {/* 連続スキャンの切り替え。店内で棚の商品を次々に確認する用途 */}
        <label className="flex items-center justify-between gap-3 cursor-pointer">
          <span className="min-w-0">
            <span className="text-xs font-bold text-gray-500 uppercase tracking-wider block">連続スキャン</span>
            <span className="text-[11px] text-gray-400">
              読み取り後に自動でカメラを再開し、続けて次の商品を読めます
            </span>
          </span>
          <span
            className={`shrink-0 w-11 h-6 rounded-full transition-colors relative ${scanner.continuousMode ? "bg-blue-600" : "bg-gray-300"}`}
          >
            <input
              type="checkbox"
              checked={scanner.continuousMode}
              onChange={(e) => scanner.setContinuousMode(e.target.checked)}
              className="sr-only"
            />
            <span
              className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all ${scanner.continuousMode ? "left-[22px]" : "left-0.5"}`}
            />
          </span>
        </label>

        <ScannerView
          isScanning={scanner.isScanning}
          videoRef={scanner.videoRef}
          scannedCode={scanner.scannedCode}
          selectedStore={selectedStore}
          onStart={scanner.startScan}
        />

        <SessionScanList scans={scanner.sessionScans} onClear={scanner.clearSessionScans} />

        {/* キット名での検索（バーコードが手元に無いとき用） */}
        <KitNameSearch />

        {/* ローディング */}
        {loading && (
          <div className="text-center py-4 text-gray-500 text-sm animate-pulse flex flex-col items-center gap-2">
            <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
            <span>正しい商品名と最安値を照合中...</span>
          </div>
        )}

        {/* エラー表示＆再試行 */}
        {displayError && (
          <div className="space-y-3">
            <div className="p-4 bg-red-50 text-red-700 text-sm rounded-xl border border-red-100 leading-relaxed">
              {displayError}
            </div>
            <button
              onClick={scanner.resetScan}
              className="w-full bg-gray-800 active:bg-gray-900 text-white text-sm font-bold py-3 rounded-xl transition"
            >
              もう一度スキャンする
            </button>
          </div>
        )}

        {result && <PriceResult result={result} onRescan={scanner.resetScan} />}
      </PageCard>
    </PageShell>
  );
}
