"use client";

import type { RefObject } from "react";

interface ScannerViewProps {
  isScanning: boolean;
  videoRef: RefObject<HTMLVideoElement | null>;
  scannedCode: string | null;
  selectedStore: string | null;
  onStart: () => void;
}

// カメラ・スキャナー領域。スキャン中は映像と照準フレーム、停止中は状態表示と起動ボタン
export function ScannerView({ isScanning, videoRef, scannedCode, selectedStore, onStart }: ScannerViewProps) {
  return (
    <div className="bg-gray-950 h-56 rounded-xl flex flex-col items-center justify-center text-white text-sm relative overflow-hidden border border-gray-800">
      {isScanning ? (
        <>
          {/* カメラ映像を表示するvideo要素 */}
          <video
            ref={videoRef}
            className="w-full h-full object-cover"
            playsInline
            muted
          />
          {/* スキャン用の照準フレームUI */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-64 h-24 border-2 border-blue-500 rounded-lg bg-transparent opacity-70 relative">
              <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-red-500 animate-pulse" />
            </div>
          </div>
          <span className="absolute top-3 left-3 bg-red-600 text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded animate-pulse">
            REC LIVE
          </span>
        </>
      ) : (
        <div className="text-center p-6 space-y-4">
          {scannedCode ? (
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wider">読み取り完了</p>
              <p className="text-xl font-mono font-bold text-blue-400 mt-1">{scannedCode}</p>
            </div>
          ) : selectedStore ? (
            <p className="text-gray-400 text-xs">カメラを起動して商品のバーコード（JAN）をスキャンしてください</p>
          ) : (
            <p className="text-amber-400 text-xs">まず読取り店舗を選択してください</p>
          )}

          <button
            disabled={!selectedStore}
            onClick={onStart}
            className="bg-blue-600 active:bg-blue-700 disabled:bg-gray-700 disabled:cursor-not-allowed text-white text-sm font-bold px-6 py-3 rounded-xl shadow-md transition-all active:scale-95"
          >
            {scannedCode ? "次の商品をスキャン" : "カメラを起動する"}
          </button>
        </div>
      )}
    </div>
  );
}
