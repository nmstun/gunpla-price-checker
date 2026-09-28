"use client";

import { useSyncExternalStore } from "react";
import { KitSearchResultItem } from "@/types";

const KIT_SEARCH_STATE_KEY = "gunpla-price-checker:kit-search-state";

interface KitSearchState {
  keyword: string;
  results: KitSearchResultItem[] | null;
}

// 詳細画面（/search/[janCode]）から「戻る」で帰ってきたときに検索結果が消えないよう、
// キーワードと結果をsessionStorageに保持する。ブラウザ/タブを閉じれば自然に消える
// 一時的な状態なので、店舗選択のようなlocalStorageでの永続化はしない
const EMPTY_KIT_SEARCH_STATE: KitSearchState = { keyword: "", results: null };

function readPersistedKitSearch(): KitSearchState {
  try {
    const raw = sessionStorage.getItem(KIT_SEARCH_STATE_KEY);
    if (!raw) return EMPTY_KIT_SEARCH_STATE;
    return JSON.parse(raw) as KitSearchState;
  } catch {
    return EMPTY_KIT_SEARCH_STATE;
  }
}

// useSyncExternalStoreでsessionStorageをReact外部ストアとして扱う。
// サーバー/ハイドレーション時は常にgetServerSnapshot（空状態）を返すためSSRと食い違わず、
// ハイドレーション完了後にReactが自動でgetSnapshot（実際の保存値）へ再描画する
let kitSearchSnapshot: KitSearchState | null = null;
const kitSearchListeners = new Set<() => void>();

function getKitSearchSnapshot(): KitSearchState {
  if (kitSearchSnapshot === null) {
    kitSearchSnapshot = readPersistedKitSearch();
  }
  return kitSearchSnapshot;
}

function getKitSearchServerSnapshot(): KitSearchState {
  return EMPTY_KIT_SEARCH_STATE;
}

function subscribeKitSearch(listener: () => void): () => void {
  kitSearchListeners.add(listener);
  return () => kitSearchListeners.delete(listener);
}

function setKitSearchState(update: Partial<KitSearchState>) {
  kitSearchSnapshot = { ...getKitSearchSnapshot(), ...update };
  sessionStorage.setItem(KIT_SEARCH_STATE_KEY, JSON.stringify(kitSearchSnapshot));
  kitSearchListeners.forEach((listener) => listener());
}

const setKeyword = (value: string) => setKitSearchState({ keyword: value });
const setResults = (value: KitSearchResultItem[] | null) => setKitSearchState({ results: value });

// キット名検索のキーワード・結果をsessionStorageに保持するフック
export function useKitSearchState() {
  const { keyword, results } = useSyncExternalStore(
    subscribeKitSearch,
    getKitSearchSnapshot,
    getKitSearchServerSnapshot
  );
  return { keyword, results, setKeyword, setResults };
}
