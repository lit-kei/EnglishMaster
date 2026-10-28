# English Master

分野・単語レベル・構文レベルを選び、AIが作る英文を日本語に訳して学習するサイトです。
日本語の自然な言い換えも考慮した採点と、訳例・構文解説・改善点を表示します。

## できること

- 不定詞・分詞構文・関係詞・動名詞・仮定法・比較・受動態・ランダムから出題
- 単語：中学レベル / 高校基礎 / 大学受験
- 構文：基礎 / 標準 / 発展（単語レベルとは独立して指定）
- 英文を1文生成 → 日本語訳を入力 → AIが100点満点で採点
- 訳を明かさないヒント、良い点、改善点、訳例、構文解説
- 直近20件の学習履歴をブラウザーに保存・再表示・削除
- スマートフォン対応、キーボード操作、処理中表示、通信エラー時の再試行
- キー未設定時のサンプルモード（固定例文・固定解説。AI生成・AI採点は行いません）

## ローカルで起動

Node.js 22以降が必要です。外部npmパッケージは不要です。

```bash
git clone https://github.com/lit-kei/EnglishMaster.git
cd EnglishMaster
cp .env.example .env
npm start
```

<http://127.0.0.1:3000> を開きます。`.env` が空でもサンプルモードを体験できます。

## Geminiの無料枠でAIを使う（推奨）

1. [Google AI StudioのAPIキー画面](https://aistudio.google.com/apikey)で、**Free Tier（無料枠）のプロジェクト**のAPIキーを取得します。
2. `.env` に次を設定して保存します。

```dotenv
AI_PROVIDER=gemini
GEMINI_API_KEY=取得したGeminiのAPIキー
GEMINI_MODEL=gemini-3.1-flash-lite
```

3. `npm start` で起動し、ブラウザーを再読み込みします。「Gemini学習モード」と表示されれば、英文の生成と採点を試せます。

既定モデルは無料枠が提供されている `gemini-3.1-flash-lite` です（2026年10月28日確認）。無料枠にはモデル・プロジェクトごとの利用制限があります。出題と採点はそれぞれ1回のAPIリクエストを使います。上限到達時は画面にエラーを表示します。自動で別モデルやOpenAIへ切り替えることはありません。

**無料で使うにはFree Tierのプロジェクトを使ってください。** 課金を有効にしたプロジェクトのキーでは、同じモデルでも料金が発生する場合があります。このアプリからプロジェクトの課金状態を判定・変更することはできません。無料枠の提供条件、モデル、上限は変更される可能性があるため、[公式料金表](https://ai.google.dev/gemini-api/docs/pricing)と[AI Studioの利用制限](https://aistudio.google.com/usage?tab=rate-limit)を確認してください。

### すでに起動している場合（Windows / PowerShell）

サーバーを実行しているターミナルで `Ctrl + C` を押して停止し、リポジトリのフォルダー内で実行します。

```powershell
git pull --ff-only
# .envがまだない場合だけ作成（既存設定を上書きしません）
if (!(Test-Path .env)) { Copy-Item .env.example .env }
notepad .env
```

上記の `AI_PROVIDER`、`GEMINI_API_KEY`、`GEMINI_MODEL` の3行を設定して保存します。既存の同じ名前の設定行は置き換え、重複させないでください。その後：

```powershell
npm start
```

<http://127.0.0.1:3000> を開きます。設定を変えたらサーバーの再起動が必要です。キーはチャットやGitHubに貼らないでください。

### OpenAIを使う場合（任意・有料）

既存のOpenAI接続も明示的に選べます。

```dotenv
AI_PROVIDER=openai
OPENAI_API_KEY=取得したOpenAIのAPIキー
OPENAI_MODEL=gpt-4.1-mini
```

OpenAI APIの利用契約・APIキー・利用料金が別途必要です。`AI_PROVIDER` を省略するとGeminiを選びます。古い `.env` にOpenAIキーだけが残っていても、自動では使用しません。選択した提供元のキーが未設定ならサンプルモードになります。

## サーバーに公開

このアプリはフロントエンドとNode.js APIサーバーを同じオリジンで配信します。
**GitHub PagesだけではAI生成・採点は動作しません。** Node.jsまたはDockerに対応したホスティングで実行してください。
`public/` のみを静的配信した場合は、サンプルモードになります。

1. このリポジトリを接続し、起動コマンドを `npm start` に設定（ビルド不要）。または付属のDockerfileを使用。
2. ホスティング側の環境変数に次を設定。
3. HTTPSで公開し、画面の「利用パスワードを入力」からログイン。

| 変数 | 設定 |
| --- | --- |
| `AI_PROVIDER` | 既定値 `gemini`。OpenAIを使う場合のみ `openai` |
| `GEMINI_API_KEY` | Gemini APIキー。GitHubやブラウザーに保存しない |
| `GEMINI_MODEL` | 省略時 `gemini-3.1-flash-lite` |
| `OPENAI_API_KEY` / `OPENAI_MODEL` | OpenAIを明示的に選ぶ場合のみ設定 |
| `HOST` | 公開時 `0.0.0.0`、ローカルの既定値 `127.0.0.1` |
| `PORT` | ホスティングの指定値。既定値 `3000` |
| `APP_PASSWORD` | 公開時は十分に長く推測困難な利用パスワードを必ず設定 |
| `PUBLIC_ORIGIN` | サイトの正確なHTTPSオリジン。例：`https://english.example.com`（末尾 `/` なし） |
| `TOKEN_SECRET` | 32文字以上のランダム値を推奨。再起動後も問題・セッションを継続可能 |

AI接続済みで `HOST=0.0.0.0` にするときは、`APP_PASSWORD` が未設定なら起動を止めます。パスワードは信頼する利用者だけに共有してください。

Dockerの例（実際のドメインを `.env` の `PUBLIC_ORIGIN` に設定してください）：

```bash
docker build -t english-master .
docker run --env-file .env -e HOST=0.0.0.0 -p 3000:3000 english-master
```

外部公開時はホスティングやリバースプロキシでHTTPSを設定してください。実装済みの回数制限は接続元IPごと100リクエスト/時、AI同時処理はサーバー全体で3件です。プロキシからの接続は同一IPとして数えるため、制限が共有されることがあります。`X-Forwarded-For` は信頼しません。
制限は単一プロセスのメモリー上で管理し、再起動するとリセットされます。大規模公開・複数インスタンス化では共有レート制限や個別アカウント認証を追加してください。AI提供元側でも無料枠・利用予算・利用状況を管理してください。

## 採点とデータ

- 意味の正確さ60点、構文の理解30点、日本語の自然さ10点を基準にAIが評価します。
- 80点以上：よくできました / 50〜79点：あと一歩 / 49点以下：復習しよう。
- 採点はAIによる目安です。同じ内容でも点数が変動したり、誤判定される可能性があります。
- 英文・回答は選択中のAI提供元に送信されます。Gemini無料枠では送信内容がGoogleの製品改善に使用されます。回答に個人情報を含めないでください。OpenAI利用時は `store: false` を指定します。各提供元のデータ取扱いは公式ポリシーをご確認ください。
- APIキーはサーバーだけで扱います。訳例・解説は暗号化した問題トークン内に保持し、AI採点後に表示します。サーバーのファイルや `.env` は配信しません。
- 問題トークンは2時間、ログインは12時間有効です。`TOKEN_SECRET` 未設定時は再起動すると無効になります。パスワード変更時は既存ログインも無効になります。
- 学習履歴はこのブラウザーのLocalStorageに保存します。サーバーのデータベースやユーザー登録は不要です。

## 開発・テスト

```bash
npm run dev
npm test
```

テストではGeminiとOpenAIの外部APIをモックし、生成→採点、無料枠上限などのAPIエラー、暗号化された問題の改ざん・期限切れ、認証、入力検証、APIエラー、レート制限などを検証します。実APIへの接続確認には利用可能なAPIキーが必要です。

```text
public/           画面・スタイル・サンプル問題
server.js         静的配信、認証、問題トークン、生成・採点API
ai.js             Gemini / OpenAI接続、出題・採点プロンプト、出力検証
test/             Node.js標準テスト
```

OpenAI実装参考：[Responses API](https://developers.openai.com/api/reference/resources/responses/methods/create) / [Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs)

Gemini実装参考：[Generate Content API](https://ai.google.dev/api/generate-content) / [Structured Outputs](https://ai.google.dev/gemini-api/docs/generate-content/structured-output) / [無料枠と料金](https://ai.google.dev/gemini-api/docs/pricing)
