🤖 ガンプラ定価チェッカー (Gunpla Price Checker)
カメラでガンプラのバーコード（JANコード）をスキャンし、メーカー希望小売価格（バンダイ公式）や量販店の実売価格を照合して、転売価格（プレ値）を見破るためのNext.js（App Router）製Webアプリケーションです。

JANコードの重複登録や誤登録による「別ジャンルの無関係な商品」を徹底的に排除する名称安全フィルターアルゴリズムと、24時間キャッシュを搭載しています。スキャン時に読取り店舗を選択でき、店舗ごとのスキャン履歴を振り返ることもできます。

🛠️ 技術スタック
Frontend / Backend: Next.js (App Router, Tailwind CSS, TypeScript)

Barcode Scanner: @zxing/library (HTML5 Video Streamを用いたリアルタイム解析)

Database (Optional Cache): Supabase

External API: Yahoo!ショッピング商品検索API (V3) / バンダイ ホビーサイト（非公式・内部API）

Deployment Platform: Vercel

💰 定価の判定ロジック
JANコードをスキャンすると、以下の優先順位で「基準価格」を決定します。

1. **メーカー希望小売価格（`priceSource: "bandai_msrp"`）**: Yahoo!ショッピングAPIで取得した商品名でバンダイ ホビーサイトを検索し、返ってきた商品の`jancode`がスキャンしたJANコードと一致した場合のみ、バンダイ公式の希望小売価格を採用します。UI上は緑色のバッジで「バンダイ公式サイト照合済み」と表示されます。
2. **量販店価格の目安（`priceSource: "estimated"`）**: バンダイ ホビーサイト側で確認が取れなかった場合（対象商品が無い、検索がヒットしない、応答がタイムアウトした等）は、Yahoo!ショッピングの信頼できる量販店（joshinweb, amiami等）の実売価格を目安として使います。UI上は黄色のバッジで「公式未確認・推定値」と表示され、メーカー希望小売価格ではないことが分かるようにしています。

⚠️ **注意**: バンダイ ホビーサイトの価格取得は、同サイトが公式に公開しているAPIではなく、サイトのフロントエンドが内部的に利用しているエンドポイント（`cmsapi-frontend.bandai-hobby.net`）を流用したものです（[src/utils/bandaiHobby.ts](src/utils/bandaiHobby.ts)）。そのため：
- サイト側の実装変更で予告なく動作しなくなる可能性があります
- 応答に数秒〜10秒程度かかることがあり、タイムアウトした場合は自動的に「推定値」にフォールバックします（アプリがエラーになることはありません）
- 商品名検索のヒット率は100%ではありません（JANコード完全一致で確認しているため、誤った価格が表示されることはありませんが、確認できず「推定値」表示になるケースがあります）
- バンダイ側の検索はスペースや`/`（スケール表記の1/144等）を含むキーワードだとフィルタが効かず全件返ってくる癖があるため、検索前にキーワードから空白とスケール表記を除去しています

🏬 読取り店舗の選択・スキャン履歴
バーコードを読み取る前に「読取り店舗」を選択する必要があります（未選択だとカメラ起動ボタンが無効化されます）。

- 初期状態では店舗は1件も登録されていません。自由入力で店舗名を追加すると選択肢に加わり、ブラウザの`localStorage`に保存されて次回以降も選択肢に表示されます（サーバー側には保存されないため、端末・ブラウザごとに独立します）
- 誤って登録した店舗は、チップ右側の「×」から削除できます（選択中の店舗を削除すると選択状態も解除されます）
- 選択した店舗名は、スキャン結果（JANコード・商品名・価格情報）とあわせて`scan_history`テーブルに記録されます。キャッシュ経由で価格が返ってきた場合も、スキャンの記録自体は毎回残ります
- [`/history`](src/app/history/page.tsx) 一覧ページは日付・店舗・商品名（全文表示、省略なし）・定価のみのコンパクトな行で表示され、店舗でフィルタできます。行をタップすると [`/history/[id]`](src/app/history/%5Bid%5D/page.tsx) の詳細画面に遷移します
- 各行は左にスワイプすると「削除」ボタンが現れ、その場で削除できます（重複スキャンや不要な履歴の整理用）
- 詳細画面では、定価・情報ソースに加えて「この店舗での販売価格（任意）」を入力・編集できます（棚札の実売価格を控えておきたい場合などに使う、あくまで任意の記録項目です）
- 詳細画面の「定価を再取得する」ボタンで、キャッシュを無視してYahoo!ショッピング・バンダイ公式サイトに再度問い合わせ、その履歴行の定価・情報ソースを上書きできます（`/api/refresh-price`）。あわせてYahoo!ショッピングの最安値も表示されますが、これは都度取得した値をその場で表示するだけで、DBには保存されません（価格は変動するため、古い値を保存しておく意味が薄いことと、UIをシンプルに保つため）

🚀 開発環境での動かし方
1. 依存関係のインストール
```bash
npm install
```

2. ローカルSupabaseの起動（任意）
DBキャッシュ機能を使う場合は、[Supabase CLI](https://supabase.com/docs/guides/cli)でローカルスタックを起動します（Dockerが必要）。他のローカルプロジェクトとポートが衝突しないよう、本プロジェクトは`supabase/config.toml`で54421番台のポートを使うよう設定済みです。

```bash
supabase start
```

起動後に表示される`API URL`（`http://127.0.0.1:54421`）と`anon key`を`.env.local`に設定してください。DBキャッシュを使わない場合はこの手順をスキップして構いません。

3. 環境変数の設定 (.env.local)
プロジェクトのルートディレクトリに`.env.local`ファイルを作成し、以下の情報を設定してください。

```
YAHOO_CLIENT_ID=あなたのYahooデベロッパーネットワークのClient ID
NEXT_PUBLIC_SUPABASE_URL=あなたのSupabaseプロジェクトURL (任意)
NEXT_PUBLIC_SUPABASE_ANON_KEY=あなたのSupabase匿名キー (任意)
```
（※Supabaseの各種キーを設定しない場合、自動的にDBキャッシュ処理を安全にスキップして動作します）

4. ローカルサーバーの起動
```bash
npm run dev
```
起動後、ブラウザで http://localhost:3000 にアクセスします。

📂 プロジェクト構成
```
src/
├── app/
│   ├── api/
│   │   ├── check-price/route.ts  # 価格チェックAPI（薄いハンドラ。各ロジックはutils/libに委譲）
│   │   └── refresh-price/route.ts # 定価再取得API（キャッシュを無視して再問い合わせし履歴を上書き）
│   ├── history/
│   │   ├── page.tsx              # スキャン履歴一覧（コンパクト表示、店舗フィルタ付き）
│   │   └── [id]/page.tsx         # スキャン履歴詳細（定価・店舗販売価格・定価再取得と都度取得の最安値表示）
│   ├── layout.tsx
│   └── page.tsx                  # バーコードスキャンUI（店舗選択＋useCheckPriceフック経由）
├── hooks/
│   ├── useCheckPrice.ts          # 価格チェックAPI呼び出し用フック
│   └── useFavoriteStores.ts      # 読取り店舗のお気に入り一覧（localStorage永続化）
├── lib/supabase/
│   ├── server.ts                 # APIルート専用Supabaseクライアント（env未設定ならnullを返す）
│   ├── client.ts                 # クライアントコンポーネント用Supabaseクライアント
│   ├── items.ts                  # キャッシュの取得・保存（24時間有効、jan_codeでupsert）
│   └── scanHistory.ts            # スキャン履歴の保存・取得・単体取得・再取得反映
├── types/index.ts                # Offer / CheckPriceResult / ScanHistoryEntry 等の共通型
└── utils/
    ├── itemName.ts                # 商品名クリーニング・名称一致判定（isNameMatchingの閾値もここ）
    ├── yahooShopping.ts           # Yahoo!ショッピングAPI呼び出し・オファー整形
    ├── bandaiHobby.ts             # バンダイ ホビーサイトからのメーカー希望小売価格取得
    └── priceLookup.ts             # Yahoo!＋バンダイの価格取得ロジック本体（check-price/refresh-priceで共用）
supabase/
├── config.toml                   # ローカルSupabaseのポート設定（54421番台）
└── migrations/                   # items / scan_history テーブルのスキーマ
```

🌐 Vercel への本番デプロイ手順
Next.jsと最も相性が良い Vercel へデプロイする手順です。サーバーレス関数（API）も自動的にセットアップされます。

1. ソースコードを GitHub へプッシュ
プロジェクトをGitHubのリポジトリにコミット＆プッシュしておきます。

2. Vercel と GitHub を連携
Vercel（https://vercel.com/）にアクセスし、アカウントを作成・ログインします。

ダッシュボードの 「Add New...」 -> 「Project」 をクリックします。

対象のGitHubリポジトリを選択し、「Import」 をクリックします。

3. 環境変数の登録（最重要）
「Configure Project」の画面が表示されたら、「Environment Variables」 の項目を展開し、本番用のSupabaseプロジェクト（ローカルではなく`supabase link`した本番プロジェクト）の値を含め、以下の環境変数を入力してください。

YAHOO_CLIENT_ID ： （あなたのYahoo Client ID）

NEXT_PUBLIC_SUPABASE_URL ： （本番SupabaseのURL ※任意）

NEXT_PUBLIC_SUPABASE_ANON_KEY ： （本番SupabaseのKey ※任意）

4. デプロイの実行
環境変数の入力が終わったら、「Deploy」 ボタンを押します。数分でビルドが完了し、本番環境のURL（ https://〜.vercel.app ）が自動発行されます。

⚠️ **Vercel Hobbyプランの注意点**: サーバーレス関数のデフォルトタイムアウトは10秒です。Yahoo APIとバンダイ ホビーサイトへの問い合わせを合算すると、まれにこの制限に近づくことがあります。タイムアウトした場合はエラーにはならず「推定値」にフォールバックしますが、頻発するようならVercelのプラン変更や`maxDuration`設定の見直しを検討してください。

🚨 スマホカメラ起動に関する重要仕様
ブラウザのセキュリティ上の制約により、カメラ機能は https:// で始まる安全な接続環境（または localhost）でしか動作しません。
VercelにデプロイされたURLは自動的にHTTPS化されるため問題なくスマホカメラが起動しますが、万が一別の独自ドメイン等に移設する場合は必ずSSL化（HTTPS）を行ってください。

💡 トラブルシューティング
- **違う商品が混ざる場合**: キャッシュ対策（`cache: "no-store"`）と商品名の一致率ロジックが組み込まれています。もしストア側の表記揺れが激しい場合は、[src/utils/itemName.ts](src/utils/itemName.ts) 内の`isNameMatching`の一致率ボーダー（デフォルト0.5 = 50%）を調整してください。
- **常に「推定値」表示になる場合**: バンダイ ホビーサイト側の内部APIが応答しない・仕様変更された可能性があります。[src/utils/bandaiHobby.ts](src/utils/bandaiHobby.ts)のトークン取得（`fetchSearchToken`）が正しく動いているか確認してください。
