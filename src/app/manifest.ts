import type { MetadataRoute } from "next";

// ホーム画面に追加したときのアイコンと名称を定義する。
// Next.jsがこのファイルを検出して /manifest.webmanifest を配信し、link タグも自動で挿入する
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "ガンプラ定価チェッカー",
    short_name: "定価チェッカー",
    description:
      "バーコードをスキャンして実売価格を照合し、転売価格を見破るツール",
    start_url: "/",
    theme_color: "#1e3a8a",
    background_color: "#ffffff",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
