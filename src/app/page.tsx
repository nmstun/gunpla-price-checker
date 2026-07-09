"use client";

import { useState, useEffect, useRef } from "react";
import { BrowserMultiFormatReader, Result } from "@zxing/library";

interface Offer {
  storeName: string;
  price: number;
  shippingFee: number;
  isConditional: boolean;
  url: string;
}

interface ScanResult {
  source: "cache" | "live_fetch";
  itemName: string;
  officialPrice: number;
  offers?: Offer[];
}

export default function Home() {
  const [result, setResult] = useState<ScanResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // カメラ制御用の状態
  const [isScanning, setIsScanning] = useState(false);
  const [scannedCode, setScannedCode] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const codeReaderRef = useRef<BrowserMultiFormatReader | null>(null);

  // 1. バーコードスキャンの開始・停止制御
  useEffect(() => {
    if (isScanning) {
      // バーコードリーダーの初期化（EAN/JANコード等の主要フォーマット対応）
      const codeReader = new BrowserMultiFormatReader();
      codeReaderRef.current = codeReader;

      codeReader.decodeFromVideoDevice(
        null, // nullを指定すると自動的に背面カメラ等の最適なデバイスを選択します
        videoRef.current,
        (decodeResult: Result | null, err?: any) => {
          if (decodeResult) {
            const jan = decodeResult.getText();
            // JANコードは通常13桁（古いものは8桁）
            if (jan && (jan.length === 13 || jan.length === 8)) {
              // 読み取り成功時の処理
              setScannedCode(jan);
              setIsScanning(false); // スキャンを一旦停止
              handleCheckPrice(jan); // 価格チェックAPIを叩く
            }
          }
          if (err && !(err.name === 'NotFoundException')) {
            console.error("スキャンエラー:", err);
          }
        }
      ).catch((err) => {
        console.error("カメラ起動失敗:", err);
        setError("カメラの起動に失敗しました。カメラのアクセス権限を確認してください。");
        setIsScanning(false);
      });
    } else {
      // スキャン停止時はカメラのストリームを完全に解放
      if (codeReaderRef.current) {
        codeReaderRef.current.reset();
        codeReaderRef.current = null;
      }
    }

    return () => {
      if (codeReaderRef.current) {
        codeReaderRef.current.reset();
      }
    };
  }, [isScanning]);

  // 2. 価格チェックAPIの呼び出し
  const handleCheckPrice = async (janCode: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/check-price", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ janCode }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "価格の取得に失敗しました");
      }

      setResult(data);
    } catch (err: any) {
      setError(err.message);
      setResult(null);
    } finally {
      setLoading(false);
    }
  };

  // スキャンの再試行
  const handleResetScan = () => {
    setResult(null);
    setScannedCode(null);
    setError(null);
    setIsScanning(true);
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4 flex flex-col items-center font-sans">
      <header className="mb-6 text-center">
        <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
          🤖 ガンプラ定価チェッカー
        </h1>
        <p className="text-sm text-gray-500 mt-1">カメラをバーコードにかざして転売価格を見破る</p>
      </header>

      <main className="w-full max-w-md bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-6">

        {/* 📷 カメラ・スキャナー領域 */}
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
              ) : (
                <p className="text-gray-400 text-xs">カメラを起動して商品のバーコード（JAN）をスキャンしてください</p>
              )}

              <button
                onClick={() => {
                  setResult(null);
                  setError(null);
                  setIsScanning(true);
                }}
                className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-5 py-2.5 rounded-xl shadow-md transition-all active:scale-95"
              >
                {scannedCode ? "次の商品をスキャン" : "📷 カメラを起動する"}
              </button>
            </div>
          )}
        </div>

        {/* ⏳ ローディング */}
        {loading && (
          <div className="text-center py-4 text-gray-500 text-sm animate-pulse flex flex-col items-center gap-2">
            <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
            <span>🔍 正しい商品名と最安値を照合中...</span>
          </div>
        )}

        {/* ❌ エラー表示＆再試行 */}
        {error && (
          <div className="space-y-3">
            <div className="p-4 bg-red-50 text-red-700 text-sm rounded-xl border border-red-100 leading-relaxed">
              ⚠️ {error}
            </div>
            <button
              onClick={handleResetScan}
              className="w-full bg-gray-800 hover:bg-gray-900 text-white text-xs font-bold py-2.5 rounded-xl transition"
            >
              もう一度スキャンする
            </button>
          </div>
        )}

        {/* 🎉 結果表示 */}
        {result && (
          <div className="space-y-5 animate-fadeIn">
            {/* 商品名 */}
            <div className="border-t border-gray-100 pt-4">
              <span className="text-xs font-semibold uppercase tracking-wider px-2 py-0.5 rounded bg-gray-100 text-gray-600">
                検証済み商品名
              </span>
              <h2 className="text-lg font-bold text-gray-800 mt-1.5 leading-snug">
                {result.itemName}
              </h2>
            </div>

            {/* 基準定価カード */}
            <div className="p-4 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl border border-blue-100 flex items-center justify-between">
              <div>
                <span className="text-xs text-blue-600 font-medium block">
                  量販店・公式基準価格（定価目安）
                </span>
                <span className="text-2xl font-black text-blue-900 mt-1 block">
                  ¥{result.officialPrice.toLocaleString()} <span className="text-xs font-normal text-gray-500">(税込)</span>
                </span>
              </div>

              <div className="text-right">
                <span className="text-xs text-gray-400 block">情報ソース</span>
                <span className="inline-block mt-1 text-xs font-bold px-2 py-1 rounded-full bg-green-100 text-green-700">
                  🌐 照合済み流通データ
                </span>
              </div>
            </div>

            {/* ショップリスト */}
            {result.offers && result.offers.length > 0 && (
              <div className="space-y-2.5">
                <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                  🛒 同一商品ショップ（本体価格順）
                </h3>
                <div className="divide-y divide-gray-100 border border-gray-100 rounded-xl overflow-hidden bg-gray-50">
                  {result.offers.map((offer, index) => (
                    <a
                      key={index}
                      href={offer.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-between p-3.5 bg-white hover:bg-gray-50/80 transition-colors group"
                    >
                      <div className="flex items-center gap-2.5 max-w-[65%]">
                        <span className={`text-xs font-bold w-5 h-5 flex items-center justify-center rounded-full ${index === 0 ? "bg-amber-100 text-amber-700" :
                            index === 1 ? "bg-slate-200 text-slate-700" :
                              "bg-orange-100 text-orange-700"
                          }`}>
                          {index + 1}
                        </span>
                        <div className="truncate">
                          <span className="text-sm font-bold text-gray-700 block truncate group-hover:text-blue-600 transition-colors">
                            {offer.storeName}
                          </span>
                          <span className="text-[11px] text-gray-400 block mt-0.5">
                            送料: {
                              offer.shippingFee === 0
                                ? (offer.isConditional ? "無料（※条件付の可能性あり）" : "無料")
                                : `¥${offer.shippingFee}`
                            }
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <div className="text-right">
                          <span className="text-xs text-gray-400 block font-normal">商品価格</span>
                          <span className="text-lg font-black text-gray-900 group-hover:text-blue-700 transition-colors">
                            ¥{offer.price.toLocaleString()}
                          </span>
                        </div>
                        <span className="text-xs text-gray-300 group-hover:text-blue-500 group-hover:translate-x-0.5 transition-all self-end mb-1">
                          ➔
                        </span>
                      </div>
                    </a>
                  ))}
                </div>
              </div>
            )}

            {/* 再スキャン用のボタンを下に配置 */}
            <button
              onClick={handleResetScan}
              className="w-full border-2 border-dashed border-gray-300 hover:border-blue-500 hover:bg-blue-50/30 text-gray-600 hover:text-blue-600 font-bold py-3 rounded-xl transition text-xs flex items-center justify-center gap-1.5"
            >
              📷 続けて別な商品をスキャンする
            </button>

            <div className="text-xs text-gray-500 text-center bg-gray-100 p-3 rounded-lg border border-gray-200 leading-relaxed">
              💡 <b>名称安全フィルター作動中:</b> JANコードが一致していても、登録名が本来の商品と乖離している怪しい出品は自動的に非表示にしています。
            </div>
          </div>
        )}
      </main>
    </div>
  );
}