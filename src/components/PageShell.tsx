import Link from "next/link";
import type { ReactNode } from "react";

interface PageShellProps {
  title: string;
  description: string;
  backHref: string;
  backLabel: string;
  children: ReactNode;
}

// 全画面共通の外枠（ノッチ・ホームバー分のセーフエリア余白）とヘッダー。
// タイトルと戻り導線を同じ行に並べ、説明文は次の行で幅を使い切らせる。
// 横並びのままだと狭い画面でタイトル・説明文が細かく折り返してしまうため
export function PageShell({ title, description, backHref, backLabel, children }: PageShellProps) {
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
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">{title}</h1>
          <Link
            href={backHref}
            className="shrink-0 text-sm font-bold text-blue-600 hover:text-blue-700 px-3 py-1.5 -mr-3 rounded-lg active:bg-blue-50"
          >
            {backLabel}
          </Link>
        </div>
        <p className="text-sm text-gray-500 mt-1">{description}</p>
      </header>
      {children}
    </div>
  );
}

// Tailwindは完全なクラス名の文字列を静的に検出するため、動的に組み立てず対応表で持つ
const CARD_SPACING_CLASS = {
  4: "space-y-4",
  5: "space-y-5",
  6: "space-y-6",
} as const;

interface PageCardProps {
  spacing?: keyof typeof CARD_SPACING_CLASS;
  children: ReactNode;
}

// 画面の本文を載せる白いカード。spacingは子要素同士の縦の間隔
export function PageCard({ spacing = 5, children }: PageCardProps) {
  return (
    <main
      className={`w-full max-w-md bg-white rounded-2xl shadow-sm border border-gray-100 p-6 ${CARD_SPACING_CLASS[spacing]}`}
    >
      {children}
    </main>
  );
}
