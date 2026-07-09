"use client";

import { useEffect, useState, useRef } from "react";
import { Html5QrcodeScanner } from "html5-qrcode";

export default function Home() {
  const [scanResult, setScanResult] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState<boolean>(true);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const scannerRef = useRef<Html5QrcodeScanner | null>(null);

  useEffect(() => {
    // 画面上に #reader という要素が存在するか確認してから初期化する
    const element = document.getElementById("reader");
    if (!element || !isScanning) return;

    // 二重初期化を防ぐクリーンアップ
    if (scannerRef.current) {
      scannerRef.current.clear().catch(() => {});
    }

    // スキャナーのインスタンス作成
    const scanner = new Html5QrcodeScanner(
      "reader",
      { 
        fps: 10, 
        qrbox: { width: 250, height: 150 },
        rememberLastUsedCamera: true,
      },
      /* verbose= */ false
    );

    scannerRef.current = scanner;

    // スキャン成功時の処理
    const onScanSuccess = (decodedText: string) => {
      setScanResult(decodedText);
      setIsScanning(false);
      if (scannerRef.current) {
        scannerRef.current.clear().catch((err) => console.error("Clear error", err));
      }
    };

    // スキャン失敗時（毎フレーム呼ばれるのでエラーログは出さない）
    const onScanFailure = () => {};

    // レンダリング開始
    try {
      scanner.render(onScanSuccess, onScanFailure);
    } catch (err: any) {
      console.error("Scanner render error:", err);
      setCameraError("カメラの初期化に失敗しました。パーミッションを確認してください。");
    }

    // アンマウント時のクリーンアップ
    return () => {
      if (scannerRef.current) {
        scannerRef.current.clear().catch((err) => console.error("Cleanup error", err));
        scannerRef.current = null;
      }
    };
  }, [isScanning]);

  const handleReset = () => {
    setCameraError(null);
    setScanResult(null);
    setIsScanning(true);
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-start p-6 bg-slate-50 text-slate-800">
      <div className="max-w-xl w-full font-sans">
        <h1 className="text-2xl font-bold text-center my-8 text-blue-600">
          ガンプラ定価チェッカー
        </h1>

        <div className="bg-white p-6 rounded-2xl shadow-md border border-slate-200">
          {cameraError && (
            <div className="mb-4 p-3 bg-red-50 text-red-600 rounded-lg text-sm">
              {cameraError}
            </div>
          )}

          {isScanning ? (
            <div>
              <p className="text-center text-slate-500 mb-4 text-sm">
                カメラの枠内にバーコードを合わせてください
              </p>
              {/* html5-qrcode用のコンテナ */}
              <div id="reader" className="w-full overflow-hidden rounded-lg border border-slate-300"></div>
            </div>
          ) : (
            <div className="text-center py-8">
              <p className="text-slate-500 mb-2 text-sm">読み取り成功！</p>
              <div className="text-3xl font-bold text-slate-900 tracking-wider mb-6 font-mono">
                {scanResult}
              </div>
              <button
                onClick={handleReset}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition"
              >
                もう一度スキャンする
              </button>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}