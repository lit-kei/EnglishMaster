# English Master

分野・単語レベル・構文レベルを選び、AIが作る英文を日本語に訳して学習するサイトです。
訳例、構文解説、良い点、改善点を確認しながら、一文ずつ学習できます。

## できること

- 不定詞・分詞構文・関係詞・動名詞・仮定法・比較・受動態・ランダムから出題
- 単語：中学レベル / 高校基礎 / 大学受験
- 構文：基礎 / 標準 / 発展（単語レベルとは独立して指定）
- 英文を1文生成 → 日本語訳を入力 → AIが100点満点で採点
- 訳を明かさないヒント、訳例、構文解説、フィードバック
- 直近20件の学習履歴をブラウザーに保存・再表示・削除
- スマートフォン向けレイアウト、キーボード操作、処理中表示、通信エラー時の再試行
- Ollamaのローカルモデルに対応。Gemini / OpenAIも明示的に選択可能

## OllamaでPC内のAIを使う（APIキー不要）

Node.js 22以降と、Windows版Ollamaを使用します。外部npmパッケージは不要です。

1. [OllamaのWindows版](https://ollama.com/download/windows)をインストールして起動します。ローカルモデルを使い、クラウドモデルは選びません。
2. 新しくPowerShellを開き、モデルをダウンロードします。

```powershell
ollama pull qwen3:4b
```

既定モデルは `qwen3:4b`（Q4_K_M、ダウンロード約2.5GB）。6GB VRAMと16GB RAMのPCで試すための軽量な設定です。実際の速度と必要メモリーは他のアプリやドライバーによって変わります。Ollama本体にも少なくとも4GBのディスク容量が必要です。ダウンロード時の一時領域やOSの空き容量も見込み、余裕を確保してください。

3. サイトのフォルダーを用意します。初めての場合：

```powershell
git clone https://github.com/lit-kei/EnglishMaster.git
cd EnglishMaster
```

すでにフォルダーがある場合は、そのフォルダーのPowerShellで、実行中のサイトを `Ctrl + C` で停止して更新します。

```powershell
git pull --ff-only
```

4. `.env` を編集します。既存ファイルは上書きせずに開きます。

```powershell
if (!(Test-Path .env)) { Copy-Item .env.example .env }
notepad .env
```

次の3行を設定して保存してください。同名の設定行がすでにある場合は置き換えます。

```dotenv
AI_PROVIDER=ollama
OLLAMA_MODEL=qwen3:4b
OLLAMA_BASE_URL=http://127.0.0.1:11434
```

`HOST` はローカル利用時 `127.0.0.1` にしてください。OllamaモードではGeminiやOpenAIのAPIキーは使用しません。アカウントへのログインも不要です。

5. サイトを起動します。

```powershell
npm start
```

<http://127.0.0.1:3000> を開きます。「PC内AI学習モード」と表示されることを確認し、英文を生成してください。この表示は選択中のモードを示し、Ollamaの接続テスト結果ではありません。Ollamaが未起動なら、生成時に起動を促すエラーが出ます。

初回はモデルを読み込むため時間がかかります。Ollamaモードでは最大3分間待機し、同時処理を1件に制限します。GPUメモリーを抑えるためコンテキスト長は4096トークン、thinkingは無効、採点時のtemperatureは0です。自動でクラウドAIに切り替えることはありません。

### 動かないとき

| 表示・状態 | 確認すること |
| --- | --- |
| `ollama` が見つからない | インストール後にPowerShellを開き直す |
| Ollamaに接続できない | スタートメニューからOllamaを起動。ポート11434が使えるか確認 |
| モデルが見つからない | `ollama pull qwen3:4b` を実行し、ダウンロード完了を待つ |
| 遅い・タイムアウト | ゲームなどGPUを使うアプリを閉じる。`ollama ps` でGPU利用を確認 |
| PC内AI学習モードにならない | `.env` の `AI_PROVIDER=ollama` を確認し、`npm start` を再起動 |
| ディスクが足りない | 不要なファイルを整理するか、[Ollama公式手順](https://docs.ollama.com/windows)でインストール先・モデル保存先を別ドライブへ変更 |

ローカルモデルはクラウドの大規模モデルに比べ、和訳や構文解説、採点で誤りが出ることがあります。得点は学習の目安として使ってください。

## サンプルモード

Ollamaを使わず画面だけ試す場合は、`.env` に次を設定し再起動します。

```dotenv
AI_PROVIDER=gemini
GEMINI_API_KEY=
```

選択中のクラウドAIのキーが空なら、固定例文と固定解説を表示します。サンプルではレベル設定を適用せず、AI生成・AI採点も行いません。
`.env` 自体が存在しない場合も、既定のGeminiにキーがないのでサンプルモードになります。

## クラウドAIを使う場合（任意）

ローカル利用では以下の設定は不要です。

### Gemini

**Gemini APIは18歳以上が対象です。** 対象条件を満たす場合だけ利用してください。18歳未満向けのサービスへの組み込みにも制限があります。[公式利用規約](https://ai.google.dev/gemini-api/terms?hl=ja)を確認してください。

```dotenv
AI_PROVIDER=gemini
GEMINI_API_KEY=取得したGeminiのAPIキー
GEMINI_MODEL=gemini-3.1-flash-lite
```

無料枠で使う場合は、[Google AI Studio](https://aistudio.google.com/apikey)のFree Tierプロジェクトのキーを使用してください。課金済みプロジェクトのキーでは料金が発生する場合があります。アプリ側から課金状態を判定・変更できません。モデルや無料枠の条件・上限は[公式料金表](https://ai.google.dev/gemini-api/docs/pricing)を確認してください。

### OpenAI

```dotenv
AI_PROVIDER=openai
OPENAI_API_KEY=取得したOpenAIのAPIキー
OPENAI_MODEL=gpt-4.1-mini
```

利用条件を満たすOpenAI APIの契約とキーが必要です。API料金は別途発生します。ChatGPTの契約だけでは賄われません。

`AI_PROVIDER` を省略した場合の既定値は互換性のため `gemini` のままです。`.env.example` はローカル用の `ollama` を明示しています。設定変更後はサーバーを再起動してください。キーはチャット・GitHub・ブラウザーに保存しないでください。

## サーバーへの公開

このアプリは画面とNode.js APIを同じオリジンで配信します。**GitHub PagesだけではAI生成・採点は動きません。** Node.jsが動作し、選択したAIに接続できる実行環境が必要です。PCを停止するとPC内AIを使うサイトも動きません。

Ollama接続は `http://127.0.0.1`、`http://localhost`、`http://[::1]` のループバックに限定し、リダイレクトも追跡しません。`OLLAMA_MODEL` に `:cloud` タグは指定できません。ダウンロードしたローカルモデルを使用してください。Windows側のOllamaとDocker内のNode.jsを組み合わせる構成には対応していません。通常のローカル利用では `npm start` を使ってください。

外部公開する場合は `HOST=0.0.0.0`、十分に長い `APP_PASSWORD`、正確なHTTPSオリジンの `PUBLIC_ORIGIN` を設定し、HTTPSで配信してください。AI有効時に外部向けホストを指定すると、パスワード未設定では起動を止めます。

| 変数 | 設定 |
| --- | --- |
| `AI_PROVIDER` | `ollama` / `gemini` / `openai` |
| `OLLAMA_BASE_URL` | 既定値 `http://127.0.0.1:11434`。PC内のHTTPアドレス限定 |
| `OLLAMA_MODEL` | 既定値 `qwen3:4b` |
| `GEMINI_API_KEY` / `GEMINI_MODEL` | Geminiを選択したときだけ使用 |
| `OPENAI_API_KEY` / `OPENAI_MODEL` | OpenAIを選択したときだけ使用 |
| `HOST` / `PORT` | 既定値 `127.0.0.1` / `3000` |
| `APP_PASSWORD` | 外部公開時の利用パスワード |
| `PUBLIC_ORIGIN` | 公開サイトの正確なHTTPSオリジン。末尾 `/` なし |
| `TOKEN_SECRET` | 32文字以上のランダム値を推奨。再起動後も問題・セッションを継続可能 |

接続元IPごと100リクエスト/時。AI同時処理はOllamaが1件、それ以外は3件です。プロキシからの接続は同一IPとして数えるため、制限が共有されることがあります。`X-Forwarded-For` は信頼しません。回数制限は単一プロセスのメモリー上で管理し、再起動するとリセットします。大規模公開・複数インスタンスでは共有レート制限や個別認証を追加してください。

## 採点・データ

- 意味の正確さ60点、構文の理解30点、日本語の自然さ10点を基準に評価します。
- 80点以上：よくできました / 50〜79点：あと一歩 / 49点以下：復習しよう。
- 採点はAIによる目安です。同じ内容でも点数が変動したり、誤判定される可能性があります。
- Ollamaのローカルモデルでは、英文・回答をPC内で処理します。ダウンロード後の生成・採点に外部APIは不要です。
- クラウドAIを選ぶと英文・回答を提供元に送信します。Gemini無料枠では製品改善に使われます。OpenAIには `store: false` を指定します。各提供元のデータ取扱いをご確認ください。
- 訳例・解説は暗号化した問題トークン内に保持し、AI採点後に表示します。サーバーのファイルや `.env` は配信しません。
- 問題は2時間、ログインは12時間有効です。`TOKEN_SECRET` 未設定時は再起動で無効になります。パスワード変更時は既存ログインも無効になります。
- 学習履歴はブラウザーのLocalStorageに直近20件を保存します。サーバーのデータベースやユーザー登録は不要です。

## 開発・テスト

```bash
npm run dev
npm test
```

外部・ローカルAIの応答をモックし、生成→採点、認証、トークンの改ざん・期限切れ、入力検証、レート制限、Ollama未起動・モデル未導入・同時処理制限・出力打ち切りなどを検証します。実モデルの速度や採点品質は、Ollamaを導入したPCで別途確認してください。

```text
public/           画面・スタイル・固定サンプル
server.js         静的配信、認証、問題トークン、生成・採点API
ai.js             Ollama / Gemini / OpenAI接続と出題・採点プロンプト
test/             Node.js標準テスト
```

参考：[Ollama Chat API](https://docs.ollama.com/api/chat) / [Windows導入](https://docs.ollama.com/windows) / [qwen3:4b](https://ollama.com/library/qwen3:4b) / [Gemini API](https://ai.google.dev/api/generate-content) / [OpenAI Responses API](https://developers.openai.com/api/reference/resources/responses/methods/create)
