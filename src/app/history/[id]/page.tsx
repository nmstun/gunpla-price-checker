"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  fetchScanHistoryEntry,
  fetchPriceHistory,
  updateStorePrice,
  updateOfficialPrice,
  PricePoint,
} from "@/lib/supabase/scanHistory";
import {
  advisePurchase,
  BUY_VERDICT_CLASS,
  comparePrices,
  formatShipping,
  formatYen,
  OFFER_SOURCE_LABEL,
} from "@/utils/price";
import { ScanHistoryEntry, RefreshPriceResult, Offer } from "@/types";

export default function HistoryDetailPage() {
  const params = useParams<{ id: string }>();
  const [entry, setEntry] = useState<ScanHistoryEntry | null>(null);
  const [loading, setLoading] = useState(true);

  const [priceInput, setPriceInput] = useState("");
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "error">("idle");
  const [isEditingStorePrice, setIsEditingStorePrice] = useState(false);

  // 定価の手動入力・編集用（自動取得できない商品向け）
  const [officialInput, setOfficialInput] = useState("");
  const [officialSaveStatus, setOfficialSaveStatus] = useState<"idle" | "saving" | "error">("idle");
  const [isEditingOfficialPrice, setIsEditingOfficialPrice] = useState(false);

  const [refreshing, setRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  // 最安値・上位オファーは都度取得の値なので保存しない。画面を開いた瞬間に自動取得する
  const [offers, setOffers] = useState<Offer[]>([]);
  const [lowestNewPrice, setLowestNewPrice] = useState<number | null>(null);
  const [lowestUsedPrice, setLowestUsedPrice] = useState<number | null>(null);
  const [lowestMarketLoading, setLowestMarketLoading] = useState(false);
  // 同じJANコードの過去スキャンに記録した通販最安値。相場が上がっているか下がっているかを見る
  const [pricePoints, setPricePoints] = useState<PricePoint[]>([]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setOffers([]);
      setLowestNewPrice(null);
      setLowestUsedPrice(null);

      const data = await fetchScanHistoryEntry(params.id);
      if (cancelled) return;
      if (data) {
        fetchPriceHistory(data.janCode).then((points) => {
          if (!cancelled) setPricePoints(points);
        });
      }
      setEntry(data);
      setPriceInput(data?.storePrice?.toString() ?? "");
      setLoading(false);

      if (!data) return;

      setLowestMarketLoading(true);
      try {
        const res = await fetch("/api/refresh-price", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ janCode: data.janCode, persist: false }),
        });
        const json = await res.json();
        if (!cancelled && res.ok) {
          const result = json as RefreshPriceResult;
          setOffers(result.offers);
          setLowestNewPrice(result.lowestNewPrice);
          setLowestUsedPrice(result.lowestUsedPrice);
        }
      } catch {
        // 自動取得の失敗は静かに諦める（下の「定価を再取得する」で再試行できる）
      } finally {
        if (!cancelled) setLowestMarketLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [params.id]);

  const handleStartEditStorePrice = () => {
    if (!entry) return;
    setPriceInput(entry.storePrice?.toString() ?? "");
    setSaveStatus("idle");
    setIsEditingStorePrice(true);
  };

  const handleCancelEditStorePrice = () => {
    setSaveStatus("idle");
    setIsEditingStorePrice(false);
  };

  const handleSaveStorePrice = async () => {
    if (!entry) return;
    const trimmed = priceInput.trim();
    const price = trimmed === "" ? null : Number(trimmed);
    if (price !== null && (!Number.isFinite(price) || price < 0)) {
      setSaveStatus("error");
      return;
    }
    setSaveStatus("saving");
    const ok = await updateStorePrice(entry.id, price);
    if (ok) {
      setEntry({ ...entry, storePrice: price });
      setSaveStatus("idle");
      setIsEditingStorePrice(false);
    } else {
      setSaveStatus("error");
    }
  };

  const handleStartEditOfficialPrice = () => {
    if (!entry) return;
    setOfficialInput(entry.officialPrice?.toString() ?? "");
    setOfficialSaveStatus("idle");
    setIsEditingOfficialPrice(true);
  };

  const handleCancelEditOfficialPrice = () => {
    setOfficialSaveStatus("idle");
    setIsEditingOfficialPrice(false);
  };

  const handleSaveOfficialPrice = async () => {
    if (!entry) return;
    const trimmed = officialInput.trim();
    const price = trimmed === "" ? null : Number(trimmed);
    if (price !== null && (!Number.isFinite(price) || price < 0)) {
      setOfficialSaveStatus("error");
      return;
    }
    setOfficialSaveStatus("saving");
    const ok = await updateOfficialPrice(entry.id, price);
    if (ok) {
      setEntry({ ...entry, officialPrice: price, officialPriceIsManual: price !== null });
      setOfficialSaveStatus("idle");
      setIsEditingOfficialPrice(false);
    } else {
      setOfficialSaveStatus("error");
    }
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
      setOffers(refreshed.offers);
      setLowestNewPrice(refreshed.lowestNewPrice);
      setLowestUsedPrice(refreshed.lowestUsedPrice);
    } catch (err) {
      setRefreshError(err instanceof Error ? err.message : "定価の再取得に失敗しました");
    } finally {
      setRefreshing(false);
    }
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
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">履歴詳細</h1>
          <Link
            href="/history"
            className="shrink-0 text-sm font-bold text-blue-600 hover:text-blue-700 px-3 py-1.5 -mr-3 rounded-lg active:bg-blue-50"
          >
            一覧へ戻る
          </Link>
        </div>
        <p className="text-sm text-gray-500 mt-1">定価・最安値・店舗価格を比較できます</p>
      </header>

      <main className="w-full max-w-md bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-5">
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

            {/* 店頭で買うべきかを最初に言い切る。定価との差だけでは決められず、
                実際の判断は「定価・店頭価格・通販最安値」の三者関係で決まるため、
                通販の方が明確に安いなら定価以下でも見送りと出す */}
            {(() => {
              const advice = advisePurchase({
                officialPrice: entry.officialPrice,
                storePrice: entry.storePrice,
                lowestNewPrice,
              });
              if (!advice) return null;
              const comparison =
                entry.officialPrice !== null && entry.storePrice !== null
                  ? comparePrices(entry.officialPrice, entry.storePrice)
                  : null;
              return (
                <div className={`rounded-xl border px-4 py-3 ${BUY_VERDICT_CLASS[advice.verdict]}`}>
                  <p className="text-lg font-bold leading-snug">{advice.headline}</p>
                  <p className="text-sm font-bold mt-0.5 tabular-nums">{advice.reason}</p>
                  <p className="text-xs mt-1.5 opacity-80 tabular-nums">
                    {entry.officialPrice !== null && `定価 ${formatYen(entry.officialPrice)}`}
                    {entry.storePrice !== null && ` / 店頭 ${formatYen(entry.storePrice)}`}
                    {lowestNewPrice !== null && ` / 通販 ${formatYen(lowestNewPrice)}`}
                  </p>
                  {comparison !== null && comparison.verdict === "markup" && (
                    <p className="text-xs mt-0.5 opacity-80 tabular-nums">
                      店頭は定価より {formatYen(comparison.diff)} 高い
                      {comparison.ratioLabel && `（定価の${comparison.ratioLabel}）`}
                    </p>
                  )}
                </div>
              );
            })()}

            {/* 定価・最安値・店舗価格の比較。3行ともラベルを1行使い切り、
                値と操作ボタンを次の行に置くことで、狭い画面でも折り返さないようにしている */}
            <div className="rounded-xl border border-gray-100 divide-y divide-gray-100 overflow-hidden">
              {/* メーカー希望小売価格。バンダイ公式で照合できた値・ユーザーの手動入力値・
                  未確認の3状態をバッジで区別する。自動取得できない商品向けに手動編集できる */}
              <div className="p-4 bg-gradient-to-br from-blue-50 to-indigo-50">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs text-blue-600 font-medium">メーカー希望小売価格</span>
                  {!isEditingOfficialPrice && (
                    <div className="flex items-center gap-1.5 shrink-0">
                      {entry.officialPrice === null ? (
                        <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-gray-200 text-gray-600 whitespace-nowrap">
                          未確認
                        </span>
                      ) : entry.officialPriceIsManual ? (
                        <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 whitespace-nowrap">
                          手動入力
                        </span>
                      ) : (
                        <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-green-100 text-green-700 whitespace-nowrap">
                          公式照合済み
                        </span>
                      )}
                      <button
                        onClick={handleStartEditOfficialPrice}
                        className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-white/70 text-blue-700 active:bg-white transition whitespace-nowrap"
                      >
                        編集
                      </button>
                    </div>
                  )}
                </div>
                {!isEditingOfficialPrice && (
                  entry.officialPrice !== null ? (
                    <span className="text-2xl font-normal text-blue-900 mt-1 block tabular-nums">
                      {formatYen(entry.officialPrice)}
                    </span>
                  ) : (
                    <span className="text-sm text-gray-400 mt-1 block">未確認</span>
                  )
                )}

                {isEditingOfficialPrice && (
                  <div className="mt-1">
                    <div className="flex gap-2">
                      <div className="flex-1 relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xl pointer-events-none">
                          ¥
                        </span>
                        <input
                          type="number"
                          inputMode="numeric"
                          autoFocus
                          value={officialInput}
                          onChange={(e) => {
                            setOfficialInput(e.target.value);
                            setOfficialSaveStatus("idle");
                          }}
                          placeholder="例: 2200"
                          className="w-full text-2xl font-normal text-gray-900 pl-8 pr-3 py-1.5 rounded-lg border border-gray-200 bg-white focus:outline-none focus:border-blue-400"
                        />
                      </div>
                      <button
                        onClick={handleSaveOfficialPrice}
                        disabled={officialSaveStatus === "saving"}
                        className="shrink-0 self-center text-sm font-bold px-4 py-2 rounded-lg bg-white border border-gray-200 text-gray-600 active:bg-gray-100 transition disabled:opacity-50"
                      >
                        保存
                      </button>
                      <button
                        onClick={handleCancelEditOfficialPrice}
                        disabled={officialSaveStatus === "saving"}
                        className="shrink-0 self-center text-sm font-bold px-3 py-2 rounded-lg text-gray-400 active:bg-gray-100 transition disabled:opacity-50"
                      >
                        取消
                      </button>
                    </div>
                    <p className="text-[11px] text-gray-500 mt-1.5">
                      手動入力した定価は「手動入力」と表示されます。空欄で保存すると未確認に戻せます。
                    </p>
                    {officialSaveStatus === "error" && (
                      <p className="text-[11px] text-red-600 mt-1">保存に失敗しました。もう一度お試しください</p>
                    )}
                  </div>
                )}
              </div>

              {/* 最安値（画面表示時に自動取得。保存はしない）。定価と比べる相手は
                  新品の実売価格なので新品最安を主役にし、中古相場は副次情報として添える */}
              <div className="p-4 bg-white">
                <span className="text-xs text-gray-500 font-medium block">通販サイト最安値（新品）</span>
                {lowestMarketLoading ? (
                  <span className="text-sm text-gray-400 mt-1 flex items-center gap-1.5">
                    <span className="w-3 h-3 border-2 border-gray-300 border-t-transparent rounded-full animate-spin" />
                    取得中...
                  </span>
                ) : lowestNewPrice !== null ? (
                  <span className="text-2xl font-normal text-gray-900 mt-1 block tabular-nums">
                    {formatYen(lowestNewPrice)}
                  </span>
                ) : (
                  <span className="text-sm text-gray-400 mt-1 block">
                    {lowestUsedPrice !== null ? "新品の出品が見つかりませんでした" : "取得できませんでした"}
                  </span>
                )}
                {!lowestMarketLoading && lowestUsedPrice !== null && (
                  <span className="text-xs text-gray-500 mt-1 block tabular-nums">
                    中古最安 {formatYen(lowestUsedPrice)}
                  </span>
                )}
              </div>

              {/* 店舗価格（任意・編集可）。普段は他の2行と同じ「ラベル→大きな値」の
                  表示のみで、「編集」ボタンを押したときだけ入力欄に切り替える */}
              <div className="p-4 bg-gray-50">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs text-gray-500 font-medium">この店舗での販売価格（税込・任意）</span>
                  {!isEditingStorePrice && (
                    <button
                      onClick={handleStartEditStorePrice}
                      className="shrink-0 text-[11px] font-bold px-2 py-0.5 rounded-full bg-gray-200 text-gray-600 active:bg-gray-300 transition whitespace-nowrap"
                    >
                      編集
                    </button>
                  )}
                </div>
                {!isEditingStorePrice && (
                  entry.storePrice !== null ? (
                    <span className="text-2xl font-normal text-gray-900 mt-1 block tabular-nums">
                      {formatYen(entry.storePrice)}
                    </span>
                  ) : (
                    <span className="text-sm text-gray-400 mt-1 block">未入力</span>
                  )
                )}

                {isEditingStorePrice && (
                  <div className="mt-1">
                    <div className="flex gap-2">
                      <div className="flex-1 relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xl pointer-events-none">
                          ¥
                        </span>
                        <input
                          type="number"
                          inputMode="numeric"
                          autoFocus
                          value={priceInput}
                          onChange={(e) => {
                            setPriceInput(e.target.value);
                            setSaveStatus("idle");
                          }}
                          placeholder="税込価格（例: 6800）"
                          className="w-full text-2xl font-normal text-gray-900 pl-8 pr-3 py-1.5 rounded-lg border border-gray-200 bg-white focus:outline-none focus:border-blue-400"
                        />
                      </div>
                      <button
                        onClick={handleSaveStorePrice}
                        disabled={saveStatus === "saving"}
                        className="shrink-0 self-center text-sm font-bold px-4 py-2 rounded-lg bg-white border border-gray-200 text-gray-600 active:bg-gray-100 transition disabled:opacity-50"
                      >
                        保存
                      </button>
                      <button
                        onClick={handleCancelEditStorePrice}
                        disabled={saveStatus === "saving"}
                        className="shrink-0 self-center text-sm font-bold px-3 py-2 rounded-lg text-gray-400 active:bg-gray-100 transition disabled:opacity-50"
                      >
                        取消
                      </button>
                    </div>
                    <p className="text-[11px] text-gray-500 mt-1.5">
                      棚札の<span className="font-bold">税込価格</span>を入力してください（定価・通販価格と揃えて比較するため）
                    </p>
                    {saveStatus === "error" && (
                      <p className="text-[11px] text-red-600 mt-1.5">保存に失敗しました。もう一度お試しください</p>
                    )}
                  </div>
                )}
              </div>
            </div>
            <p className="text-[11px] text-gray-400">表示金額はすべて税込です</p>

            {/* 相場の推移。同じJANコードを過去にスキャンした時点の通販最安値を並べ、
                プレ値化が進んでいるかを見る。最安値を記録する前の古い履歴は値を持たないため除く */}
            {(() => {
              const points = pricePoints.filter((p) => p.lowestNewPrice !== null);
              if (points.length === 0) return null;
              const previous = points[points.length - 1];
              const change =
                lowestNewPrice !== null && previous.lowestNewPrice !== null
                  ? lowestNewPrice - previous.lowestNewPrice
                  : null;
              const maxPrice = Math.max(
                ...points.map((p) => p.lowestNewPrice as number),
                lowestNewPrice ?? 0
              );
              return (
                <div className="space-y-2">
                  <div className="flex items-baseline justify-between gap-2">
                    <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                      通販最安値の推移
                    </h3>
                    {change !== null && (
                      <span
                        className={`text-xs font-bold tabular-nums ${change > 0 ? "text-red-600" : change < 0 ? "text-green-600" : "text-gray-400"}`}
                      >
                        {/* 比較対象は記録の中で最も新しいもの。表示中のスキャン自身とは限らないため
                            「前回スキャン」ではなく「直近の記録」と表現する */}
                        直近の記録から
                        {change > 0 ? `+${formatYen(change)}` : change < 0 ? `-${formatYen(Math.abs(change))}` : "変動なし"}
                      </span>
                    )}
                  </div>
                  <div className="space-y-1.5 rounded-xl border border-gray-100 p-3">
                    {points.map((point, index) => (
                      <div key={index} className="flex items-center gap-2">
                        <span className="shrink-0 w-20 text-[11px] text-gray-400 tabular-nums">
                          {new Date(point.scannedAt).toLocaleDateString("ja-JP")}
                        </span>
                        {/* 外側を固定幅のトラックにし、内側のバーで比率を表す。
                            バー自体をflex項目にすると縮小が効いて全て同じ長さに潰れる */}
                        <span className="flex-1 h-2 rounded-full bg-gray-100 overflow-hidden">
                          <span
                            className="block h-full rounded-full bg-gray-400"
                            style={{
                              width: `${Math.max(4, ((point.lowestNewPrice as number) / maxPrice) * 100)}%`,
                            }}
                          />
                        </span>
                        <span className="shrink-0 text-xs text-gray-600 tabular-nums">
                          {formatYen(point.lowestNewPrice as number)}
                        </span>
                      </div>
                    ))}
                    {lowestNewPrice !== null && (
                      <div className="flex items-center gap-2 pt-1.5 border-t border-gray-100">
                        <span className="shrink-0 w-20 text-[11px] font-bold text-gray-500">現在</span>
                        <span className="flex-1 h-2 rounded-full bg-gray-100 overflow-hidden">
                          <span
                            className="block h-full rounded-full bg-blue-500"
                            style={{ width: `${Math.max(4, (lowestNewPrice / maxPrice) * 100)}%` }}
                          />
                        </span>
                        <span className="shrink-0 text-xs font-bold text-gray-900 tabular-nums">
                          {formatYen(lowestNewPrice)}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}

            {/* ショップリスト（最安値TOP3。スキャン結果画面と同じ表示） */}
            {offers.length > 0 && (
              <div className="space-y-2.5">
                <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                  同一商品ショップ（本体価格順）
                </h3>
                <div className="divide-y divide-gray-100 border border-gray-100 rounded-xl overflow-hidden bg-gray-50">
                  {offers.map((offer, index) => (
                    <a
                      key={index}
                      href={offer.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2.5 p-3.5 bg-white active:bg-gray-50 transition-colors"
                    >
                      <span className={`shrink-0 text-xs font-bold w-5 h-5 flex items-center justify-center rounded-full ${index === 0 ? "bg-amber-100 text-amber-700" :
                        index === 1 ? "bg-slate-200 text-slate-700" :
                          "bg-orange-100 text-orange-700"
                        }`}>
                        {index + 1}
                      </span>
                      <div className="flex-1 min-w-0">
                        <span className="text-sm font-bold text-gray-700 block truncate">
                          {offer.storeName}
                        </span>
                        <span className="text-[11px] text-gray-400 mt-0.5 flex items-center gap-1.5">
                          <span className="shrink-0 px-1 py-px rounded bg-gray-100 text-gray-500 font-bold">
                            {OFFER_SOURCE_LABEL[offer.source]}
                          </span>
                          {offer.condition === "used" && (
                            <span className="shrink-0 px-1 py-px rounded bg-amber-100 text-amber-700 font-bold">
                              中古
                            </span>
                          )}
                          <span className="truncate">{formatShipping(offer.shipping)}</span>
                        </span>
                      </div>
                      <span className="shrink-0 text-lg font-normal text-gray-900 tabular-nums">
                        {formatYen(offer.price)}
                      </span>
                      <span className="shrink-0 text-xs text-gray-300">›</span>
                    </a>
                  ))}
                </div>
              </div>
            )}

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
      </main>
    </div>
  );
}
