"use client";

import { useState } from "react";
import { updateStorePrice } from "@/lib/supabase/scanHistory";
import { parsePriceInput } from "@/utils/price";

// スキャンごとにkey={scanHistoryId}で再マウントさせ、入力状態を自然にリセットする
export function StorePriceInput({ scanHistoryId }: { scanHistoryId: string }) {
  const [priceInput, setPriceInput] = useState("");
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");

  const handleSave = async () => {
    const parsed = parsePriceInput(priceInput);
    if (!parsed.ok) {
      setStatus("error");
      return;
    }
    setStatus("saving");
    const ok = await updateStorePrice(scanHistoryId, parsed.price);
    setStatus(ok ? "saved" : "error");
  };

  return (
    <div className="space-y-1.5">
      <label htmlFor="store-price" className="text-xs font-bold text-gray-500 uppercase tracking-wider block">
        この店舗での販売価格（税込・任意）
      </label>
      <div className="flex gap-2">
        <div className="flex-1 relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-base pointer-events-none">
            ¥
          </span>
          <input
            id="store-price"
            type="number"
            inputMode="numeric"
            value={priceInput}
            onChange={(e) => {
              setPriceInput(e.target.value);
              setStatus("idle");
            }}
            placeholder="税込価格（例: 6800）"
            className="w-full text-base text-gray-900 pl-7 pr-3 py-2.5 rounded-lg border border-gray-200 focus:outline-none focus:border-blue-400"
          />
        </div>
        <button
          onClick={handleSave}
          disabled={status === "saving"}
          className="shrink-0 text-sm font-bold px-4 py-2.5 rounded-lg bg-gray-100 text-gray-600 active:bg-gray-200 transition disabled:opacity-50"
        >
          保存
        </button>
      </div>
      <p className="text-[11px] text-gray-400">
        棚札の<span className="font-bold">税込価格</span>を入力してください（定価・通販価格と揃えて比較するため）
      </p>
      {status === "saved" && <p className="text-[11px] text-green-600">保存しました</p>}
      {status === "error" && <p className="text-[11px] text-red-600">保存に失敗しました。もう一度お試しください</p>}
    </div>
  );
}
