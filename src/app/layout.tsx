import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { version as APP_VERSION } from "../../package.json";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "ガンプラ定価チェッカー",
  description: "バーコードをスキャンして実売価格を照合し、転売価格を見破るツール",
};

// ホーム画面に追加してフルスクリーン起動した場合にノッチ・ホームバーと
// コンテンツが重ならないよう、safe-area-insetを使えるようにする
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {children}
        {/* 全画面共通で右上に常時表示するアプリバージョン。動作確認・問い合わせ時に
            どのビルドを見ているか分かるようにする目的。スクロールしても隠れないようfixed */}
        <div
          className="fixed z-50 text-[10px] text-gray-400 select-none pointer-events-none"
          style={{
            top: "max(0.5rem, env(safe-area-inset-top))",
            right: "max(0.5rem, env(safe-area-inset-right))",
          }}
        >
          v{APP_VERSION}
        </div>
      </body>
    </html>
  );
}
