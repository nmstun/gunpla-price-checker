"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useFavoriteStores, FavoriteStore } from "@/hooks/useFavoriteStores";
import { useSelectedStore } from "@/hooks/useSelectedStore";
import { fetchScanHistory } from "@/lib/supabase/scanHistory";
import { calculateStoreTendencies, formatDiffRatio, StoreTendency } from "@/utils/storeTendency";

// Leafletは初期化時にwindow/documentを触るためサーバー側では実行できない。
// クライアント側でだけ読み込む（地図は初期表示に必須ではないので遅延読み込みで十分）
const StoreMap = dynamic(() => import("./StoreMap"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-72 rounded-lg border border-gray-200 bg-gray-100 flex items-center justify-center text-xs text-gray-400">
      地図を読み込み中...
    </div>
  ),
});

interface StoreFormValue {
  name: string;
  address: string;
  url: string;
}

const EMPTY_FORM: StoreFormValue = { name: "", address: "", url: "" };

export default function StoresPage() {
  // この画面だけが地図を出すので、座標が未設定の店舗の補完もここで行う
  const { stores, addStore, removeStore, updateStore } = useFavoriteStores({ geocodeMissing: true });
  const { selectedStore, setSelectedStore } = useSelectedStore();

  const [editingName, setEditingName] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<StoreFormValue>(EMPTY_FORM);
  const [newStore, setNewStore] = useState<StoreFormValue>(EMPTY_FORM);

  // 店舗ごとの値付け傾向。行く店を選ぶ材料になるので、店舗一覧と同じ画面に出す
  const [tendencies, setTendencies] = useState<StoreTendency[]>([]);
  useEffect(() => {
    fetchScanHistory().then((entries) => setTendencies(calculateStoreTendencies(entries)));
  }, []);
  const tendencyByStoreName = new Map(tendencies.map((t) => [t.storeName, t]));

  // 地図には、住所から座標を解決できた店舗をすべてピン表示する
  const mappedStores = stores
    .filter((s) => s.latitude !== null && s.longitude !== null)
    .map((s) => ({
      id: s.id,
      name: s.name,
      address: s.address,
      latitude: s.latitude as number,
      longitude: s.longitude as number,
    }));
  // 住所は入っているのに座標が取れなかった店舗（表記ゆれ等で変換できなかった）は
  // 地図に出せないため、件数だけ伝えて住所を直せるようにする
  const unmappedCount = stores.filter(
    (s) => s.address.trim() && (s.latitude === null || s.longitude === null)
  ).length;
  // 地図のピン番号と一覧の対応が取れるよう、店舗idからピン番号を引けるようにしておく
  const pinNumberByStoreId = new Map(mappedStores.map((s, index) => [s.id, index + 1]));

  const handleStartEdit = (store: FavoriteStore) => {
    setEditingName(store.name);
    setEditForm({ name: store.name, address: store.address, url: store.url });
  };

  const handleCancelEdit = () => {
    setEditingName(null);
  };

  const handleSaveEdit = () => {
    if (!editingName) return;
    const trimmed = editForm.name.trim();
    if (!trimmed) return;
    updateStore(editingName, editForm);
    // 選択中の店舗名を変更した場合、選択状態も新しい名前に追従させる
    // （そのままだと選択が古い名前のまま残り、一覧から選択中の店舗が消えて見える）
    if (selectedStore === editingName) setSelectedStore(trimmed);
    setEditingName(null);
  };

  // 削除は取り消せず、住所やURLの登録内容も一緒に失われるため確認を挟む
  const handleDelete = (store: FavoriteStore) => {
    const ok = window.confirm(`「${store.name}」を削除しますか？\n住所・URLの登録内容も削除されます（スキャン履歴は残ります）。`);
    if (!ok) return;
    removeStore(store.name);
    if (selectedStore === store.name) setSelectedStore(null);
    if (editingName === store.name) setEditingName(null);
  };

  const handleAdd = () => {
    if (!newStore.name.trim()) return;
    addStore(newStore.name, newStore.address, newStore.url);
    setNewStore(EMPTY_FORM);
  };

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
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">店舗管理</h1>
          <Link
            href="/history"
            className="shrink-0 text-sm font-bold text-blue-600 hover:text-blue-700 px-3 py-1.5 -mr-3 rounded-lg active:bg-blue-50"
          >
            履歴へ戻る
          </Link>
        </div>
        <p className="text-sm text-gray-500 mt-1">住所を登録した店舗は地図にまとめて表示されます</p>
      </header>

      <main className="w-full max-w-md bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-4">
        {mappedStores.length > 0 && (
          <div className="space-y-1.5">
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                店舗マップ
              </span>
              <span className="text-[11px] text-gray-400">{mappedStores.length}店舗</span>
            </div>
            <StoreMap stores={mappedStores} />
            <p className="text-[11px] text-gray-400">
              ピンの番号は下の一覧の並び順と対応しています。ピンをタップすると店舗名が表示されます
              {unmappedCount > 0 && `／住所から場所を特定できなかった店舗が${unmappedCount}件あります`}
            </p>
          </div>
        )}

        {stores.length === 0 && (
          <p className="text-[11px] text-gray-400 text-center py-4">
            まだ登録された店舗がありません。下から追加してください。
          </p>
        )}

        {stores.length > 0 && (
          <div className="space-y-3">
            {stores.map((store) => (
              <div key={store.name} className="rounded-xl border border-gray-100 p-4 bg-gray-50">
                {editingName === store.name ? (
                  <div className="space-y-2">
                    <input
                      type="text"
                      autoFocus
                      value={editForm.name}
                      onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                      placeholder="店舗名"
                      className="w-full text-base text-gray-900 px-3 py-2 rounded-lg border border-gray-200 bg-white focus:outline-none focus:border-blue-400"
                    />
                    <input
                      type="text"
                      value={editForm.url}
                      onChange={(e) => setEditForm({ ...editForm, url: e.target.value })}
                      placeholder="URL（任意）"
                      className="w-full text-sm text-gray-900 px-3 py-2 rounded-lg border border-gray-200 bg-white focus:outline-none focus:border-blue-400"
                    />
                    <input
                      type="text"
                      value={editForm.address}
                      onChange={(e) => setEditForm({ ...editForm, address: e.target.value })}
                      placeholder="住所（任意）"
                      className="w-full text-sm text-gray-900 px-3 py-2 rounded-lg border border-gray-200 bg-white focus:outline-none focus:border-blue-400"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={handleSaveEdit}
                        disabled={!editForm.name.trim()}
                        className="flex-1 text-sm font-bold px-4 py-2 rounded-lg bg-blue-600 text-white active:bg-blue-700 transition disabled:opacity-50"
                      >
                        保存
                      </button>
                      <button
                        onClick={handleCancelEdit}
                        className="shrink-0 text-sm font-bold px-4 py-2 rounded-lg text-gray-400 active:bg-gray-100 transition"
                      >
                        取消
                      </button>
                    </div>
                  </div>
                ) : (
                  // 店舗名は長くなりがちなので幅を使い切らせ、操作ボタンは
                  // 名前と競合しないよう下の行に置く。削除は取り消せないため確認を挟み、
                  // 誤タップを誘わないよう編集より控えめな見た目にしている
                  <div className="space-y-2">
                    <div className="min-w-0">
                      <div className="flex items-start gap-2">
                        {pinNumberByStoreId.has(store.id) && (
                          <span className="shrink-0 mt-0.5 w-5 h-5 flex items-center justify-center rounded-full bg-red-600 text-white text-[11px] font-bold">
                            {pinNumberByStoreId.get(store.id)}
                          </span>
                        )}
                        <p className="text-base font-bold text-gray-900 leading-snug">{store.name}</p>
                      </div>
                      {store.address ? (
                        <p className="text-xs text-gray-500 mt-1 leading-snug">
                          {store.address}
                          {!pinNumberByStoreId.has(store.id) && (
                            <span className="text-gray-400">（地図に表示できませんでした）</span>
                          )}
                        </p>
                      ) : (
                        <p className="text-xs text-gray-400 mt-1">住所未登録（地図に表示されません）</p>
                      )}
                      {store.url && (
                        <a
                          href={store.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-blue-600 mt-1 block truncate active:text-blue-700"
                        >
                          {store.url}
                        </a>
                      )}
                      {/* この店の値付け傾向。定価と店頭価格の両方を記録した履歴からのみ算出する */}
                      {(() => {
                        const tendency = tendencyByStoreName.get(store.name);
                        if (!tendency) return null;
                        const tone =
                          tendency.averageDiffRatio > 0
                            ? "bg-red-50 text-red-700 ring-red-100"
                            : tendency.averageDiffRatio < 0
                              ? "bg-green-50 text-green-700 ring-green-100"
                              : "bg-gray-100 text-gray-500 ring-gray-200";
                        return (
                          <div className="mt-2 flex items-center gap-2">
                            <span className={`text-xs font-bold px-2 py-1 rounded-lg ring-1 tabular-nums ${tone}`}>
                              定価比 平均 {formatDiffRatio(tendency.averageDiffRatio)}
                            </span>
                            <span className="text-[11px] text-gray-400 tabular-nums">
                              {tendency.sampleCount}件中{tendency.markupCount}件がプレ値
                            </span>
                          </div>
                        );
                      })()}
                    </div>
                    <div className="flex items-center gap-2 pt-1 border-t border-gray-200/70">
                      <button
                        onClick={() => handleStartEdit(store)}
                        className="mt-1 text-xs font-bold px-3 py-1.5 rounded-lg bg-white border border-gray-200 text-gray-700 active:bg-gray-100 transition"
                      >
                        編集
                      </button>
                      <button
                        onClick={() => handleDelete(store)}
                        aria-label={`${store.name}を削除`}
                        className="mt-1 text-xs font-bold px-3 py-1.5 rounded-lg text-red-600 active:bg-red-50 transition"
                      >
                        削除
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* 新規追加 */}
        <div className="pt-2 border-t border-gray-100 space-y-2">
          <span className="text-xs font-bold text-gray-500 uppercase tracking-wider block">
            店舗を追加
          </span>
          <input
            type="text"
            value={newStore.name}
            onChange={(e) => setNewStore({ ...newStore, name: e.target.value })}
            placeholder="店舗名"
            className="w-full text-base text-gray-900 px-3 py-2.5 rounded-lg border border-gray-200 focus:outline-none focus:border-blue-400"
          />
          <input
            type="text"
            value={newStore.url}
            onChange={(e) => setNewStore({ ...newStore, url: e.target.value })}
            placeholder="URL（任意）"
            className="w-full text-base text-gray-900 px-3 py-2.5 rounded-lg border border-gray-200 focus:outline-none focus:border-blue-400"
          />
          <input
            type="text"
            value={newStore.address}
            onChange={(e) => setNewStore({ ...newStore, address: e.target.value })}
            placeholder="住所（任意・地図表示に使います）"
            className="w-full text-base text-gray-900 px-3 py-2.5 rounded-lg border border-gray-200 focus:outline-none focus:border-blue-400"
          />
          <button
            onClick={handleAdd}
            disabled={!newStore.name.trim()}
            className="w-full text-sm font-bold px-4 py-2.5 rounded-lg bg-gray-800 text-white active:bg-gray-900 transition disabled:opacity-50"
          >
            追加
          </button>
        </div>
      </main>
    </div>
  );
}
