🤖 ガンプラ定価チェッカー (Gunpla Price Checker)
カメラでガンプラのバーコード（JANコード）をスキャンし、Yahoo!ショッピングAPIからリアルタイムに実売価格を取得して、転売価格（プレ値）を見破るためのNext.js（App Router）製Webアプリケーションです。

JANコードの重複登録や誤登録による「別ジャンルの無関係な商品」を徹底的に排除する名称安全フィルターアルゴリズムおよびキャッシュクラッシュ機能を搭載しています。

🛠️ 技術スタック
Frontend / Backend: Next.js (App Router, Tailwind CSS, TypeScript)

Barcode Scanner: @zxing/library (HTML5 Video Streamを用いたリアルタイム解析)

Database (Optional Cache): Supabase

External API: Yahoo!ショッピング商品検索API (V3)

Deployment Platform: Vercel

🚀 開発環境での動かし方
1. 依存関係のインストール
Bash
npm install
※ または yarn install

2. 環境変数の設定 (.env.local)
プロジェクトのルートディレクトリに .env.local ファイルを作成し、以下の情報を設定してください。

コード スニペット
YAHOO_CLIENT_ID=あなたのYahooデベロッパーネットワークのClient ID
NEXT_PUBLIC_SUPABASE_URL=あなたのSupabaseプロジェクトURL (任意)
NEXT_PUBLIC_SUPABASE_ANON_KEY=あなたのSupabase匿名キー (任意)
(※Supabaseの各種キーを設定しない場合、自動的にDBキャッシュ保存処理を安全にスキップして動作します)

3. ローカルサーバーの起動
Bash
npm run dev
起動後、ブラウザで http://localhost:3000 にアクセスします。

🌐 Vercel への本番デプロイ手順
Next.jsと最も相性が良い Vercel へデプロイする手順です。サーバーレス関数（API）も自動的にセットアップされます。

1. ソースコードを GitHub へプッシュ
プロジェクトをGitHubのリポジトリにコミット＆プッシュしておきます。

2. Vercel と GitHub を連携
Vercel（https://vercel.com/）にアクセスし、アカウントを作成・ログインします。

ダッシュボードの 「Add New...」 -> 「Project」 をクリックします。

対象のGitHubリポジトリを選択し、「Import」 をクリックします。

3. 環境変数の登録（最重要）
「Configure Project」の画面が表示されたら、「Environment Variables」 の項目を展開し、ローカルの .env.local に設定していた以下の環境変数を入力してください。

YAHOO_CLIENT_ID ： （あなたのYahoo Client ID）

NEXT_PUBLIC_SUPABASE_URL ： （SupabaseのURL ※任意）

NEXT_PUBLIC_SUPABASE_ANON_KEY ： （SupabaseのKey ※任意）

4. デプロイの実行
環境変数の入力が終わったら、「Deploy」 ボタンを押します。数分でビルドが完了し、本番環境のURL（ https://〜.vercel.app ）が自動発行されます。

🚨 スマホカメラ起動に関する重要仕様
ブラウザのセキュリティ上の制約により、カメラ機能は https:// で始まる安全な接続環境（または localhost）でしか動作しません。
VercelにデプロイされたURLは自動的にHTTPS化されるため問題なくスマホカメラが起動しますが、万が一別の独自ドメイン等に移設する場合は必ずSSL化（HTTPS）を行ってください。

💡 トラブルシューティング
違う商品が混ざる場合: キャッシュ対策（cache: "no-store"）と商品名の一致率ロジックが組み込まれています。もしストア側の表記揺れが激しい場合は、src/app/api/check-price/route.ts 内の isNameMatching の一致率ボーダー（デフォルト 0.5 = 50%）を調整してください。