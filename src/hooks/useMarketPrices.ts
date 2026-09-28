"use client";

import { useCallback, useEffect, useState } from "react";
import type { Offer, RefreshPriceResult } from "@/types";

type MarketPrices = Pick<RefreshPriceResult, "offers" | "lowestNewPrice" | "lowestUsedPrice">;

// JANコードで通販の最安値・上位オファーを都度取得するフック（履歴詳細・キット詳細で共用）。
// 値は都度取得で保存しない（persist: false）。janCodeがnullの間は何もせず、
// 決まった時点で自動取得を始める。取得の失敗は静かに諦める
export function useMarketPrices(janCode: string | null) {
  const [offers, setOffers] = useState<Offer[]>([]);
  const [lowestNewPrice, setLowestNewPrice] = useState<number | null>(null);
  const [lowestUsedPrice, setLowestUsedPrice] = useState<number | null>(null);
  // 取得を終えたJANコード。janCodeが変わった描画と同じ瞬間からloadingをtrueにするため、
  // 「取得中」を別stateで持たず、これとの差から導く（effect後の1フレームだけ
  // 「取得できませんでした」が見えてしまうのを避ける）
  const [settledJanCode, setSettledJanCode] = useState<string | null>(null);
  const loading = janCode !== null && settledJanCode !== janCode;

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setOffers([]);
      setLowestNewPrice(null);
      setLowestUsedPrice(null);
      if (janCode === null) return;

      try {
        const res = await fetch("/api/refresh-price", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ janCode, persist: false }),
        });
        const json = await res.json();
        if (!cancelled && res.ok) {
          const result = json as RefreshPriceResult;
          setOffers(result.offers);
          setLowestNewPrice(result.lowestNewPrice);
          setLowestUsedPrice(result.lowestUsedPrice);
        }
      } catch {
        // 自動取得の失敗は静かに諦める（履歴詳細では「定価を再取得する」で再試行できる）
      } finally {
        if (!cancelled) setSettledJanCode(janCode);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [janCode]);

  // 「定価を再取得する」など、別経路で取得し直した結果を反映する
  const applyResult = useCallback((result: MarketPrices) => {
    setOffers(result.offers);
    setLowestNewPrice(result.lowestNewPrice);
    setLowestUsedPrice(result.lowestUsedPrice);
  }, []);

  return { offers, lowestNewPrice, lowestUsedPrice, loading, applyResult };
}
