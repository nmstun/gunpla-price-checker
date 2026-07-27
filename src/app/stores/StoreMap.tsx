"use client";

import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

export interface MappedStore {
  id: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
}

// Leafletの既定マーカーは画像ファイルを参照するためバンドラ環境でパスが壊れやすい。
// divIcon（HTML製のピン）にすると画像に依存せず、番号も一緒に描けるので採用している
function createPinIcon(index: number): L.DivIcon {
  return L.divIcon({
    className: "",
    html: `<span style="
      display:flex;align-items:center;justify-content:center;
      width:26px;height:26px;border-radius:9999px;
      background:#dc2626;color:#fff;
      font-size:12px;font-weight:700;line-height:1;
      border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.4);
    ">${index + 1}</span>`,
    iconSize: [26, 26],
    iconAnchor: [13, 13],
    popupAnchor: [0, -14],
  });
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// 登録店舗をまとめて1つの地図に表示する。Google Mapsの簡易埋め込みは
// 複数ピンを打てなかったため、OpenStreetMapのタイル上に自前でマーカーを描画している
export default function StoreMap({ stores }: { stores: MappedStore[] }) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerLayerRef = useRef<L.LayerGroup | null>(null);

  // 地図本体は初回だけ生成する（storesが変わるたびに作り直すと表示状態がリセットされるため）
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, { scrollWheelZoom: false }).setView([35.681236, 139.767125], 11);
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(map);

    mapRef.current = map;
    markerLayerRef.current = L.layerGroup().addTo(map);

    return () => {
      map.remove();
      mapRef.current = null;
      markerLayerRef.current = null;
    };
  }, []);

  // 店舗が増減・移動したらマーカーを貼り替え、全店舗が画面に収まるよう範囲を合わせる
  useEffect(() => {
    const map = mapRef.current;
    const layer = markerLayerRef.current;
    if (!map || !layer) return;

    layer.clearLayers();
    if (stores.length === 0) return;

    stores.forEach((store, index) => {
      L.marker([store.latitude, store.longitude], { icon: createPinIcon(index), title: store.name })
        .bindPopup(
          `<strong>${escapeHtml(store.name)}</strong>${store.address ? `<br/>${escapeHtml(store.address)}` : ""}`
        )
        .addTo(layer);
    });

    const bounds = L.latLngBounds(stores.map((s) => [s.latitude, s.longitude] as [number, number]));
    // 1店舗だけだと範囲が点になり極端に拡大されるため、その場合は固定ズームにする
    if (stores.length === 1) {
      map.setView(bounds.getCenter(), 16);
    } else {
      map.fitBounds(bounds, { padding: [32, 32], maxZoom: 16 });
    }
  }, [stores]);

  return <div ref={containerRef} className="w-full h-72 rounded-lg border border-gray-200 z-0" />;
}
