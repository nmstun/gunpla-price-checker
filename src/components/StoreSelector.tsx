"use client";

import { useEffect, useMemo, useState } from "react";
import type { useFavoriteStores } from "@/hooks/useFavoriteStores";
import type { useSelectedStore } from "@/hooks/useSelectedStore";
import { fetchScanHistory } from "@/lib/supabase/scanHistory";
import { compareJa } from "@/utils/sort";

type FavoriteStores = ReturnType<typeof useFavoriteStores>;
type SelectedStore = ReturnType<typeof useSelectedStore>;

interface StoreSelectorProps {
  stores: FavoriteStores["stores"];
  addStore: FavoriteStores["addStore"];
  removeStore: FavoriteStores["removeStore"];
  selectedStore: SelectedStore["selectedStore"];
  setSelectedStore: SelectedStore["setSelectedStore"];
}

// 読取り店舗の選択。店舗数が増えてもチップが折り返して縦に伸びないよう、
// ドロップダウンで1行に収めている。削除は選択中の店舗のみ、隣の「削除」ボタンから行う
export function StoreSelector({
  stores,
  addStore,
  removeStore,
  selectedStore,
  setSelectedStore,
}: StoreSelectorProps) {
  const [newStoreName, setNewStoreName] = useState("");

  // お気に入り登録（localStorage、端末ごと）に加えて、スキャン履歴（Supabase、共有）に
  // 記録済みの店舗名も候補に加える。別端末・別ブラウザで使った店舗名や、
  // localStorageが消えた場合でも過去に使った店舗名を選び直せるようにするため
  const [historyStoreNames, setHistoryStoreNames] = useState<string[]>([]);
  useEffect(() => {
    fetchScanHistory().then((entries) => {
      setHistoryStoreNames(Array.from(new Set(entries.map((e) => e.storeName))));
    });
  }, []);

  const storeNames = useMemo(
    () => Array.from(new Set([...stores.map((s) => s.name), ...historyStoreNames])).sort(compareJa),
    [stores, historyStoreNames]
  );

  const handleAddStore = () => {
    const trimmed = newStoreName.trim();
    if (!trimmed) return;
    addStore(trimmed);
    setSelectedStore(trimmed);
    setNewStoreName("");
  };

  const handleRemoveStore = (store: string) => {
    removeStore(store);
    if (selectedStore === store) setSelectedStore(null);
  };

  return (
    <div className="space-y-2">
      <span className="text-xs font-bold text-gray-500 uppercase tracking-wider block">
        読取り店舗
      </span>
      {storeNames.length > 0 ? (
        <div className="flex gap-2">
          <select
            value={selectedStore ?? ""}
            onChange={(e) => setSelectedStore(e.target.value || null)}
            className="flex-1 min-w-0 text-base text-gray-900 px-3 py-2.5 rounded-lg border border-gray-200 bg-white focus:outline-none focus:border-blue-400"
          >
            <option value="" disabled>
              店舗を選択してください
            </option>
            {storeNames.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
          {selectedStore && stores.some((s) => s.name === selectedStore) && (
            <button
              onClick={() => handleRemoveStore(selectedStore)}
              aria-label={`${selectedStore}を削除`}
              className="shrink-0 text-sm font-bold px-4 py-2.5 rounded-lg bg-gray-100 text-gray-500 active:bg-gray-200 transition"
            >
              削除
            </button>
          )}
        </div>
      ) : (
        <p className="text-[11px] text-gray-400">まだ登録された店舗がありません。下から追加してください。</p>
      )}
      <div className="flex gap-2">
        <input
          type="text"
          value={newStoreName}
          onChange={(e) => setNewStoreName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleAddStore()}
          placeholder="店舗名を入力して追加"
          className="flex-1 min-w-0 text-base text-gray-900 px-3 py-2.5 rounded-lg border border-gray-200 focus:outline-none focus:border-blue-400"
        />
        <button
          onClick={handleAddStore}
          className="shrink-0 text-sm font-bold px-4 py-2.5 rounded-lg bg-gray-100 text-gray-600 active:bg-gray-200 transition"
        >
          追加
        </button>
      </div>
    </div>
  );
}
