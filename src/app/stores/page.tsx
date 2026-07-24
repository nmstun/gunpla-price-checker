"use client";

import { useState } from "react";
import Link from "next/link";
import { useFavoriteStores, FavoriteStore } from "@/hooks/useFavoriteStores";
import { useSelectedStore } from "@/hooks/useSelectedStore";

// APIキー不要のGoogle Mapsの簡易埋め込み形式（output=embed）を使う。
// 公式のMaps Embed APIと違いキー登録が要らない反面、Google側の仕様変更で
// 予告なく動かなくなる可能性がある非公式な使い方であることは承知の上で採用している
function StoreMap({ address }: { address: string }) {
  if (!address.trim()) return null;
  const src = `https://maps.google.com/maps?q=${encodeURIComponent(address)}&output=embed`;
  return (
    <iframe
      src={src}
      className="w-full h-40 rounded-lg border border-gray-200 mt-2"
      style={{ border: 0 }}
      loading="lazy"
      referrerPolicy="no-referrer-when-downgrade"
      title={`${address}の地図`}
    />
  );
}

interface StoreFormValue {
  name: string;
  address: string;
  url: string;
}

const EMPTY_FORM: StoreFormValue = { name: "", address: "", url: "" };

export default function StoresPage() {
  const { stores, addStore, removeStore, updateStore } = useFavoriteStores();
  const { selectedStore, setSelectedStore } = useSelectedStore();

  const [editingName, setEditingName] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<StoreFormValue>(EMPTY_FORM);
  const [newStore, setNewStore] = useState<StoreFormValue>(EMPTY_FORM);

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

  const handleDelete = (name: string) => {
    removeStore(name);
    if (selectedStore === name) setSelectedStore(null);
    if (editingName === name) setEditingName(null);
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
      <header className="mb-6 w-full max-w-md flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">店舗管理</h1>
          <p className="text-sm text-gray-500 mt-1">住所を登録すると地図が表示されます</p>
        </div>
        <Link
          href="/"
          className="shrink-0 text-sm font-bold text-blue-600 hover:text-blue-700 px-3 py-2 -mr-3 rounded-lg active:bg-blue-50"
        >
          スキャンへ戻る
        </Link>
      </header>

      <main className="w-full max-w-md bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-4">
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
                      value={editForm.address}
                      onChange={(e) => setEditForm({ ...editForm, address: e.target.value })}
                      placeholder="住所（任意）"
                      className="w-full text-sm text-gray-900 px-3 py-2 rounded-lg border border-gray-200 bg-white focus:outline-none focus:border-blue-400"
                    />
                    <input
                      type="text"
                      value={editForm.url}
                      onChange={(e) => setEditForm({ ...editForm, url: e.target.value })}
                      placeholder="URL（任意）"
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
                  <>
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-base font-bold text-gray-900 leading-snug">{store.name}</p>
                        {store.address && (
                          <p className="text-xs text-gray-500 mt-0.5 leading-snug">{store.address}</p>
                        )}
                        {store.url && (
                          <a
                            href={store.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-blue-600 mt-0.5 block truncate active:text-blue-700"
                          >
                            {store.url}
                          </a>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          onClick={() => handleStartEdit(store)}
                          className="text-xs font-bold px-2 py-1 rounded-full bg-gray-200 text-gray-600 active:bg-gray-300 transition"
                        >
                          編集
                        </button>
                        <button
                          onClick={() => handleDelete(store.name)}
                          aria-label={`${store.name}を削除`}
                          className="text-xs font-bold px-2 py-1 rounded-full bg-red-100 text-red-600 active:bg-red-200 transition"
                        >
                          削除
                        </button>
                      </div>
                    </div>
                    <StoreMap address={store.address} />
                  </>
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
            value={newStore.address}
            onChange={(e) => setNewStore({ ...newStore, address: e.target.value })}
            placeholder="住所（任意・地図表示に使います）"
            className="w-full text-base text-gray-900 px-3 py-2.5 rounded-lg border border-gray-200 focus:outline-none focus:border-blue-400"
          />
          <input
            type="text"
            value={newStore.url}
            onChange={(e) => setNewStore({ ...newStore, url: e.target.value })}
            placeholder="URL（任意）"
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
