"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useKitSearchState } from "@/hooks/useKitSearchState";
import { formatYen } from "@/utils/price";
import { KitSearchResultItem } from "@/types";

// バーコードが手元に無いときに、キット名から直接バンダイ公式サイトの定価を調べる機能。
// バーコードスキャンとは独立しており、店舗選択やスキャン履歴への保存は行わない。
// 一覧から商品を選ぶと、定価・最安値TOP3を表示する専用の詳細画面（/search/[janCode]）に遷移する
export function KitNameSearch() {
  const router = useRouter();
  const { keyword, results, setKeyword, setResults } = useKitSearchState();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSearch = async () => {
    const trimmed = keyword.trim();
    if (!trimmed) return;
    setLoading(true);
    setError(null);
    setResults(null);
    try {
      const res = await fetch("/api/search-kit-name", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keyword: trimmed }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "検索に失敗しました");
      }
      setResults(data.results as KitSearchResultItem[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "検索に失敗しました");
    } finally {
      setLoading(false);
    }
  };

  const handleSelect = (item: KitSearchResultItem) => {
    const query = new URLSearchParams({
      title: item.title,
      price: String(item.price),
      url: item.url,
    }).toString();
    router.push(`/search/${item.janCode}?${query}`);
  };

  return (
    <div className="space-y-2">
      <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">
        キット名で定価を調べる
      </span>
      <p className="text-[11px] text-gray-400">バーコードが手元に無いときに使えます（履歴には保存されません）</p>
      <div className="flex gap-2">
        <input
          type="text"
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSearch()}
          placeholder="例: HG 1/144 ジム・コマンド"
          className="flex-1 min-w-0 text-base text-gray-900 px-3 py-2.5 rounded-lg border border-gray-200 focus:outline-none focus:border-blue-400"
        />
        <button
          onClick={handleSearch}
          disabled={loading || !keyword.trim()}
          className="shrink-0 text-sm font-bold px-4 py-2.5 rounded-lg bg-gray-100 text-gray-600 active:bg-gray-200 transition disabled:opacity-50"
        >
          {loading ? "検索中..." : "検索"}
        </button>
      </div>

      {error && <p className="text-[11px] text-red-600">{error}</p>}

      {results && results.length === 0 && (
        <p className="text-[11px] text-gray-400">該当する商品が見つかりませんでした</p>
      )}

      {results && results.length > 0 && (
        <div className="divide-y divide-gray-100 border border-gray-100 rounded-xl overflow-hidden">
          {results.map((item, index) => (
            <button
              key={`${item.janCode}-${index}`}
              onClick={() => handleSelect(item)}
              className="w-full flex items-center justify-between gap-3 p-3 text-left bg-white active:bg-gray-50 transition-colors"
            >
              <span className="text-sm text-gray-700 leading-snug">{item.title}</span>
              <span className="shrink-0 text-sm text-gray-900 tabular-nums">{formatYen(item.price)}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
