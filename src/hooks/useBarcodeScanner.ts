"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { BrowserMultiFormatReader, Result, Exception } from "@zxing/library";
import type { useCheckPrice } from "@/hooks/useCheckPrice";
import type { useFavoriteStores } from "@/hooks/useFavoriteStores";

// 連続スキャン中に、このセッションで読み取った商品を積み上げて見比べるための1件分
export interface SessionScan {
  janCode: string;
  itemName: string;
  officialPrice: number | null;
  lowestNewPrice: number | null;
}

interface UseBarcodeScannerParams {
  selectedStore: string | null;
  stores: ReturnType<typeof useFavoriteStores>["stores"];
  checkPrice: ReturnType<typeof useCheckPrice>["checkPrice"];
  reset: ReturnType<typeof useCheckPrice>["reset"];
}

// カメラによるバーコード（JAN）読み取りと、連続スキャン・セッション内の積み上げを担う
export function useBarcodeScanner({ selectedStore, stores, checkPrice, reset }: UseBarcodeScannerParams) {
  const [isScanning, setIsScanning] = useState(false);
  const [scannedCode, setScannedCode] = useState<string | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const codeReaderRef = useRef<BrowserMultiFormatReader | null>(null);

  // 店内で棚の商品を次々に確認する用途。ONにすると結果を表示したあと自動で
  // カメラを再起動するので、1件ごとにボタンを押し直す必要がなくなる
  const [continuousMode, setContinuousMode] = useState(false);
  const restartTimerRef = useRef<number | null>(null);

  // このセッションでスキャンした商品の積み上げ。棚の前で複数を見比べられるようにする
  // （DBには毎回保存されるので、ここでの保持はあくまで画面上の一時的なもの）
  const [sessionScans, setSessionScans] = useState<SessionScan[]>([]);

  // 読み取りコールバックから最新値を読むための参照。カメラ起動用useEffectの依存配列に
  // これらを含めると、店舗の切り替えや一覧の再取得のたびにカメラのストリームが
  // 再起動してしまうため、依存はisScanningだけに絞りrefで最新値を渡す
  const storesRef = useRef(stores);
  const selectedStoreRef = useRef(selectedStore);
  const checkPriceRef = useRef(checkPrice);
  const continuousModeRef = useRef(continuousMode);
  useEffect(() => {
    storesRef.current = stores;
    selectedStoreRef.current = selectedStore;
    checkPriceRef.current = checkPrice;
    continuousModeRef.current = continuousMode;
  }, [stores, selectedStore, checkPrice, continuousMode]);

  // 画面を離れるときに自動再起動のタイマーが残らないようにする
  useEffect(() => {
    return () => {
      if (restartTimerRef.current !== null) window.clearTimeout(restartTimerRef.current);
    };
  }, []);

  // バーコードスキャンの開始・停止制御
  useEffect(() => {
    if (isScanning) {
      // バーコードリーダーの初期化（EAN/JANコード等の主要フォーマット対応）
      const codeReader = new BrowserMultiFormatReader();
      codeReaderRef.current = codeReader;

      codeReader
        .decodeFromVideoDevice(
          null, // nullを指定すると自動的に背面カメラ等の最適なデバイスを選択します
          videoRef.current,
          (decodeResult: Result | null, err?: Exception) => {
            if (decodeResult) {
              const jan = decodeResult.getText();
              // JANコードは通常13桁（古いものは8桁）
              if (jan && (jan.length === 13 || jan.length === 8)) {
                // 読み取り成功時の処理
                setScannedCode(jan);
                setIsScanning(false); // スキャンを一旦停止
                const storeName = selectedStoreRef.current;
                // 選択中の店舗名がstoresテーブルに登録済みならidも渡し、リネーム後の
                // 表示追従を効かせる（未登録の履歴由来の名前を選んだ場合はnullのまま）
                const storeId = storesRef.current.find((s) => s.name === storeName)?.id ?? null;
                // 価格チェックAPIを叩く。結果はstateにも入るが、1件スキャンし終えた
                // タイミングで積み上げ・自動再開を行うために戻り値でも受け取る
                checkPriceRef.current(jan, storeName ?? "", storeId).then((scanned) => {
                  if (scanned) {
                    setSessionScans((prev) => [
                      {
                        janCode: jan,
                        itemName: scanned.itemName,
                        officialPrice: scanned.officialPrice,
                        lowestNewPrice: scanned.lowestNewPrice,
                      },
                      ...prev.filter((s) => s.janCode !== jan),
                    ]);
                  }
                  if (continuousModeRef.current) {
                    // 結果に目を通す間を置いてから次の読み取りを再開する。
                    // 待っている間にモードをOFFにされることがあるため、発火時にも確認する
                    restartTimerRef.current = window.setTimeout(() => {
                      if (continuousModeRef.current) setIsScanning(true);
                    }, 1500);
                  }
                });
              }
            }
            if (err && !(err.name === "NotFoundException")) {
              console.error("スキャンエラー:", err);
            }
          }
        )
        .catch((err) => {
          console.error("カメラ起動失敗:", err);
          setCameraError("カメラの起動に失敗しました。カメラのアクセス権限を確認してください。");
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

  // 「カメラを起動する」ボタン用。直前の読み取りコード表示は残したまま開始する
  const startScan = useCallback(() => {
    reset();
    setCameraError(null);
    setIsScanning(true);
  }, [reset]);

  // エラー後の再試行・「続けて別な商品をスキャンする」用。読み取りコード表示もクリアする
  const resetScan = useCallback(() => {
    reset();
    setScannedCode(null);
    setCameraError(null);
    setIsScanning(true);
  }, [reset]);

  const clearSessionScans = useCallback(() => setSessionScans([]), []);

  return {
    videoRef,
    isScanning,
    scannedCode,
    cameraError,
    continuousMode,
    setContinuousMode,
    sessionScans,
    clearSessionScans,
    startScan,
    resetScan,
  };
}
