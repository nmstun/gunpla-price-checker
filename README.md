# Gunpla Price Checker (ガンプラ定価検索アプリ)

バーコード（JANコード）を読み取り、ガンプラの最新のメーカー希望小売価格（定価）を瞬時に判別するWebアプリです。

## 🚀 技術スタック
- **Frontend/Backend**: Next.js (App Router / TypeScript)
- **Database / Auth**: Supabase (PostgreSQL)
- **Barcode Scanner**: html5-qrcode (ブラウザカメラを利用)
- **Styling**: Tailwind CSS

## 🛠️ 開発環境の構築手順

### 1. リポジトリのクローンと依存関係のインストール
まずはプロジェクトを作成し、必要なパッケージをインストールします。

```bash
# プロジェクトの作成（既存でない場合）
npx create-next-app@latest gunpla-price-checker --ts --tailwind --app --src-dir --import-alias "@/*"
cd gunpla-price-checker

# 必要なパッケージのインストール
npm install @supabase/supabase-js html5-qrcode
npm install -D @types/node