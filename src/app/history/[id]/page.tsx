"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import {
  fetchScanHistoryEntry,
  fetchPriceHistory,
  updateStorePrice,
  updateOfficialPrice,
  PricePoint,
} from "@/lib/supabase/scanHistory";
import { useMarketPrices } from "@/hooks/useMarketPrices";
import { PageShell, PageCard } from "@/components/PageShell";
import { EditablePriceField } from "@/components/EditablePriceField";
import { PurchaseAdviceBanner } from "@/components/PurchaseAdviceBanner";
import { PriceTrendChart } from "@/components/PriceTrendChart";
import { MarketPriceRow } from "@/components/MarketPriceRow";
import { OfferList } from "@/components/OfferList";
import { ScanHistoryEntry, RefreshPriceResult } from "@/types";

// 定価の出どころを示すバッジ。バンダイ公式で照合できた値・ユーザーの手動入力値・
// 未確認の3状態を区別する
function OfficialPriceBadge({ price, isManual }: { price: number | null; isManual: boolean }) {
  if (price === null) {
    return (
      <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-gray-200 text-gray-600 whitespace-nowrap">
        未確認
      </span>
    );
  }
  if (isManual) {
    return (
      <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 whitespace-nowrap">
        手動入力
      </span>
    );
  }
  return (
    <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-green-100 text-green-700 whitespace-nowrap">
      公式照合済み
    </span>
  );
}

export default function HistoryDetailPage() {
  const params = useParams<{ id: string }>();
  const [entry, setEntry] = useState<ScanHistoryEntry | null>(null);
  const [loading, setLoading] = useState(true);

  const [refreshing, setRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  // 最安値・上位オファーは都度取得の値なので保存しない。画面を開いた瞬間に自動取得する
  // （entryが読み込まれてJANコードが分かった時点で取得が始まる）
  const {
    offers,
    lowestNewPrice,
    lowestUsedPrice,
    loading: lowestMarketLoading,
    applyResult: applyMarketPrices,
  } = useMarketPrices(entry?.janCode ?? null);
  // 同じJANコードの過去スキャンに記録した通販最安値。相場が上がっているか下がっているかを見る
  const [pricePoints, setPricePoints] = useState<PricePoint[]>([]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);

      const data = await fetchScanHistoryEntry(params.id);
      if (cancelled) return;
      if (data) {
        fetchPriceHistory(data.janCode).then((points) => {
          if (!cancelled) setPricePoints(points);
        });
      }
      setEntry(data);
      setLoading(false);
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [params.id]);

  // 店舗価格・定価の保存。成功したら画面上のentryにも反映してtrueを返す
  // （trueなら入力欄が閉じ、falseなら入力欄にエラーが出る）
  const handleSaveStorePrice = async (price: number | null) => {
    if (!entry) return false;
    const ok = await updateStorePrice(entry.id, price);
    if (ok) setEntry({ ...entry, storePrice: price });
    return ok;
  };

  const handleSaveOfficialPrice = async (price: number | null) => {
    if (!entry) return false;
    const ok = await updateOfficialPrice(entry.id, price);
    if (ok) setEntry({ ...entry, officialPrice: price, officialPriceIsManual: price !== null });
    return ok;
  };

  const handleRefresh = async () => {
    if (!entry) return;
    setRefreshing(true);
    setRefreshError(null);
    try {
      const res = await fetch("/api/refresh-price", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scanHistoryId: entry.id, janCode: entry.janCode }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "定価の再取得に失敗しました");
      }
      const refreshed = data as RefreshPriceResult;
      setEntry({
        ...entry,
        itemName: refreshed.itemName,
        isPremiumBandaiExclusive: refreshed.isPremiumBandaiExclusive,
        // 公式定価を取得できたときだけ上書きし手動フラグを下ろす。取得できなかった（null）
        // 場合はユーザーの手動入力値を空振りで消さないよう、既存の定価をそのまま維持する
        ...(refreshed.officialPrice !== null
          ? { officialPrice: refreshed.officialPrice, officialPriceIsManual: false }
          : {}),
      });
      applyMarketPrices(refreshed);
    } catch (err) {
      setRefreshError(err instanceof Error ? err.message : "定価の再取得に失敗しました");
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <PageShell
      title="履歴詳細"
      description="定価・最安値・店舗価格を比較できます"
      backHref="/history"
      backLabel="一覧へ戻る"
    >
      <PageCard spacing={5}>
        {loading && (
          <div className="text-center py-8 text-gray-500 text-sm animate-pulse">読み込み中...</div>
        )}

        {!loading && !entry && (
          <div className="text-center py-8 text-gray-400 text-xs">履歴が見つかりませんでした。</div>
        )}

        {entry && (
          <>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold text-gray-400">
                  {new Date(entry.scannedAt).toLocaleString("ja-JP")}
                </span>
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                  {entry.storeName}
                </span>
              </div>
              <div className="flex items-start gap-1.5 mt-1.5">
                <h2 className="text-lg font-bold text-gray-800 leading-snug">{entry.itemName}</h2>
                {entry.isPremiumBandaiExclusive && (
                  <span className="shrink-0 mt-0.5 text-[11px] font-bold px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 whitespace-nowrap">
                    プレバン限定
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-400 mt-1">JAN: {entry.janCode}</p>
            </div>

            <PurchaseAdviceBanner
              officialPrice={entry.officialPrice}
              storePrice={entry.storePrice}
              lowestNewPrice={lowestNewPrice}
            />

            {/* 定価・最安値・店舗価格の比較。3行ともラベルを1行使い切り、
                値と操作ボタンを次の行に置くことで、狭い画面でも折り返さないようにしている */}
            <div className="rounded-xl border border-gray-100 divide-y divide-gray-100 overflow-hidden">
              {/* メーカー希望小売価格。自動取得できない商品向けに手動編集できる */}
              <EditablePriceField
                label="メーカー希望小売価格"
                labelClassName="text-xs text-blue-600 font-medium"
                containerClassName="bg-gradient-to-br from-blue-50 to-indigo-50"
                valueClassName="text-blue-900"
                emptyLabel="未確認"
                value={entry.officialPrice}
                badge={
                  <OfficialPriceBadge
                    price={entry.officialPrice}
                    isManual={entry.officialPriceIsManual}
                  />
                }
                editButtonClassName="text-[11px] font-bold px-2 py-0.5 rounded-full bg-white/70 text-blue-700 active:bg-white transition whitespace-nowrap"
                placeholder="例: 2200"
                helpText="手動入力した定価は「手動入力」と表示されます。空欄で保存すると未確認に戻せます。"
                onSave={handleSaveOfficialPrice}
              />

              {/* 最安値（画面表示時に自動取得。保存はしない） */}
              <MarketPriceRow
                loading={lowestMarketLoading}
                lowestNewPrice={lowestNewPrice}
                lowestUsedPrice={lowestUsedPrice}
              />

              {/* 店舗価格（任意・編集可）。普段は他の2行と同じ「ラベル→大きな値」の
                  表示のみで、「編集」ボタンを押したときだけ入力欄に切り替える */}
              <EditablePriceField
                label="この店舗での販売価格（税込・任意）"
                labelClassName="text-xs text-gray-500 font-medium"
                containerClassName="bg-gray-50"
                valueClassName="text-gray-900"
                emptyLabel="未入力"
                value={entry.storePrice}
                editButtonClassName="shrink-0 text-[11px] font-bold px-2 py-0.5 rounded-full bg-gray-200 text-gray-600 active:bg-gray-300 transition whitespace-nowrap"
                placeholder="税込価格（例: 6800）"
                helpText={
                  <>
                    棚札の<span className="font-bold">税込価格</span>を入力してください（定価・通販価格と揃えて比較するため）
                  </>
                }
                onSave={handleSaveStorePrice}
              />
            </div>
            <p className="text-[11px] text-gray-400">表示金額はすべて税込です</p>

            <PriceTrendChart points={pricePoints} currentPrice={lowestNewPrice} />

            {/* ショップリスト（最安値TOP3。スキャン結果画面と同じ表示） */}
            {offers.length > 0 && <OfferList offers={offers} />}

            {/* 定価再取得 */}
            <div className="space-y-1.5">
              <button
                onClick={handleRefresh}
                disabled={refreshing}
                className="w-full text-sm font-bold px-4 py-3 rounded-xl bg-gray-800 text-white active:bg-gray-900 transition disabled:opacity-50"
              >
                {refreshing ? "再取得中..." : "定価を再取得する"}
              </button>
              <p className="text-[11px] text-gray-400 text-center">
                最安値は画面を開くたびに自動取得されます。定価そのものを更新したい場合はこちらを押してください（数秒〜10秒程度かかることがあります）
              </p>
              {refreshError && <p className="text-[11px] text-red-600 text-center">{refreshError}</p>}
            </div>
          </>
        )}
      </PageCard>
    </PageShell>
  );
}
