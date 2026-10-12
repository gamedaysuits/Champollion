---
sidebar_position: 6
title: "トラブルシューティング"
---

# トラブルシューティング

champollion のよくある問題と解決策です。

## API と認証

### 「OPENROUTER_API_KEY not found」

Champollion は LLM 翻訳に API キーが必要です。環境変数として設定してください：

```bash
export OPENROUTER_API_KEY="sk-or-v1-..."
```

または `.env` ファイルに記述します（プロジェクトが `.env` ファイルを読み込む場合）：

```
OPENROUTER_API_KEY=sk-or-v1-...
```

:::tip
Google Translate の API キーのみをお持ちの場合、champollion は自動検出してデフォルトの翻訳方法として Google Translate を使用します。設定の変更は不要です。
:::

### OpenRouter からの「401 Unauthorized」

API キーが無効または期限切れです。[openrouter.ai/keys](https://openrouter.ai/keys) で確認してください。

### 「429 Too Many Requests」/ レート制限

Champollion は指数バックオフを使用してレート制限を内部で処理します。レート制限に継続的に達する場合：

1. 設定で**バッチサイズを小さくする**:
   ```json
   { "batchSize": 15 }
   ```
2. **レートリミットの高いモデルを使用する** (例: `google/gemini-3.8-flash` は制限が緩やかです)
3. 大量の言語ペアには**より安価/高速な方式を使用する** — Google Translate にはレートリミットがありません:
   ```json
   { "pairs": { "en:it": { "method": "google-translate" } } }
   ```

### モデルが見つからない / 404 エラー

直接のLLMプロバイダー (`openai`、`anthropic`、`gemini`) には、各プロバイダー固有のモデル名が送信されます。自社ベンダーのOpenRouter形式のIDは自動的にマッピングされます (`gemini` では `google/gemini-3.8-flash` → `gemini-3.8-flash`)。実行が以下のように停止した場合:

**「is an OpenRouter model id … which has no model by that name」** — 他のベンダーのOpenRouter形式のモデルを使用しています (`openai` での `google/gemini-3.8-flash` など)。リクエストは送信されませんでした。そのプロバイダーのモデル名を指定するか、そのモデルを提供する方式を使用するか、OpenRouterを使用するために `llm` 方式に切り替えてください。エラーメッセージにはそれぞれ、モデルがどこで設定されたかが表示されます:

```diff
- { "method": "openai", "model": "google/gemini-3.8-flash" }
+ { "method": "openai", "model": "gpt-4o" }
```
```json
{ "method": "llm", "model": "google/gemini-3.8-flash" }
```

初回使用時にはモデル名のチェックも行われます。警告が表示された場合:

**「is an Anthropic/OpenAI/Gemini model」** — モデルを誤ったプロバイダーに送信しています：

```diff
- { "method": "gemini", "model": "claude-sonnet-4-6" }
+ { "method": "anthropic", "model": "claude-sonnet-4-6" }
```

**「not found in available models」** — モデルが廃止されているか、スペルが間違っている可能性があります。Champollion はプロバイダーのライブモデルリストを取得して代替案を提案します。現在のモデル名についてはプロバイダーのドキュメントを確認してください。

:::tip[モデルの廃止は起こりえます]
プロバイダーは定期的にモデル名を廃止します。プロバイダーのアップデート後に翻訳が突然失敗するようになった場合は、`[WARN]` の出力を確認してください — 現在利用可能な代替モデルが表示されます。
:::

### `local`: 「could not reach …」

`local` 方式は、ローカルマシン上のOpenAI互換サーバー (Ollama、vLLM、LM Studio、llama.cpp) にリクエストを送信します。接続できない場合、試行したアドレスとそれを指定した設定がエラーに表示されます:

```text
[ERR] Local (OpenAI-compatible) Batch 1 failed: fetch failed (ECONNREFUSED) — could not reach http://localhost:8000/v1 (from LOCAL_API_BASE in .env)
```

アドレスは、環境変数または `.env.local` / `.env` 内で設定されているもののうち、最初に一致したものが使用されます: `LOCAL_API_BASE`、次に `OPENAI_API_BASE`、その次に `OPENAI_BASE_URL` です。何も設定されていない場合はOllamaのデフォルトである `http://localhost:11434/v1` になります。サーバーを起動するか、メッセージに示された設定を修正してください。

## 翻訳品質

### 翻訳がソース言語をそのまま返す

品質ゲートがこれを検出します。翻訳が英語のソースと同一の場合、拒否されて再試行されます。それでも続く場合：

1. **モデルを確認する** — 特定の言語ペアでパフォーマンスが低いモデルがあります
2. **レジスターの指示を追加する** — 生成する言語のトーンやスタイルをモデルに指示します:
   ```json
   {
     "languages": {
       "ja": { "name": "Japanese", "register": "Polite/formal Japanese" }
     }
   }
   ```
3. **別のモデルを試す** — `gpt-4o-mini` から `gpt-4o` または `google/gemini-3.1-pro-preview` に切り替えます

### 誤ったスクリプトの出力（例：日本語にラテン文字が出力される）

品質ゲートのスクリプト準拠チェックがほとんどのケースを検出します。それでも続く場合：

- ロケールコードが正しいか確認する（`ja` であり、`jp` ではない）
- `register` フィールドに明示的なスクリプト指示を追加する：
  ```json
  { "register": "Japanese using hiragana, katakana, and kanji" }
  ```

### 名前の検証に失敗する (例: 日本語における "Curtis Forbes")

ラテン文字表記の名前が正しい場合は、Champollionに対象の名前を指定してください:

```json
{ "protectedTerms": ["Curtis Forbes", "Game Day Suits"] }
```

モデルにはそれらを表記どおりに保持するよう指示され、これらの名前のみで構成される値が未翻訳またはスクリプト不一致として報告されることはなくなります。リストがない場合、非ラテン文字言語における短いラテン文字の値は、名前かラベルかを問い合わせるリトライが1回実行されます。モデルがそれを保持した場合、名前として受け入れられてキャッシュされるため、再請求されることはありません。`--no-verify` は不要です。

### 出力にハルシネーションのパターンが現れる

繰り返しのトライグラムパターン（例：「hello hello hello」）はハルシネーションループ検出器によって検出されます。出力が乱れているが検出器を通過する場合：

1. **バッチサイズを小さくする** — バッチを小さくすることでより集中した出力が得られます
2. **より強力なモデルを使用する** — 大きなモデルは非ラテン文字スクリプトでのハルシネーションが少ない
3. **コーチングデータを追加する** — 辞書の用語が翻訳を固定します

## ファイルとフォーマットの問題

### 「No locale files found」

Champollion はロケールファイルを自動検出します。見つからない場合：

1. **`localesDir` を確認する** — ロケールファイルが含まれるディレクトリを指している必要があります：
   ```json
   { "localesDir": "./locales" }
   ```
2. **ファイル名を確認する** — ファイルはロケールコードで命名する必要があります：`en.json`、`fr.json` など
3. **フォーマットを確認する** — サポートされているフォーマット：JSON、ネスト JSON、YAML、TOML

### ロックファイルの競合

`.champollion.lock` は、各翻訳がどの英語テキストから作成されたかを記録します。
他の生成ファイルと同様にマージコンフリクトを解決してください。いずれかの側を残し、
`npx champollion sync` を実行して、その結果をコミットします。

:::warning[ロックファイルを削除しても再翻訳は行われません]
ロックファイルがない場合、sync は既存の翻訳が作成されてからどの英語文字列が
変更されたかを判別できません。ターゲットファイルに**存在しない**キーのみを
翻訳し、現在の英語を新しいベースラインとして記録します。ロックが削除される前に
編集された英語文字列は、警告なしに古い翻訳を保持し続けます。意図的にロケールを
リビルドするには、`--force` を使用してください (`--pair` でスコープを指定できます)。
キャッシュされた翻訳は再利用されるため、キャッシュに一度も保存されていない
テキストのみが課金対象になります。
:::

### 特定のキーの再翻訳

個別の翻訳が誤っており、ロックファイルを削除せずに強制的に再翻訳したい場合：

```bash
# Re-translate a single key
npx champollion sync --force-keys "hero.title"

# Re-translate multiple keys
npx champollion sync --force-keys "nav.home,nav.about,footer.copyright"
```

`--force-keys` フラグは、指定した特定のキーに対するロックファイルのハッシュチェックをオーバーライドし、他のキーに影響を与えることなく強制的に再翻訳します。`--redo keys:hero.title` は、その新しい名前による同じ機能です。いずれも翻訳メモリにテキストが存在する場合はそこから提供されます。代わりに料金を支払って新規翻訳を行うには `--fresh` を追加してください。カンマを含むキー (gettext の msgid が文全体の場合など) は `\,` で記述し、シェル用に引数をクォートします: `--redo 'keys:Welcome back\, %(name)s!'`。

### `verify` がプレースホルダーの不一致 (またはその他の破損した値) を報告する

`champollion verify` (および毎回の sync 後に実行されるチェック) は、破損した値を報告します。これには、失われたり名前が変更されたプレースホルダー、壊れたICU複数形、文字が削除された値などが含まれます。通常の `champollion sync` ではこれらを修復**しません**。値はすでにディスク上に存在し、ロックエントリ上は最新であるとみなされているため、sync はそれを変更せずにそのまま残します。

各検出結果には、該当するキーを正確に修復するコマンドが表示されます。例:

```text
[ERR] [VERIFY] fr: 1 i18next {{…}} placeholder mismatch(es): greeting (placeholder {{name}} was changed to {{nom}}) — fix: `champollion sync --pair en:fr --redo keys:greeting`
```

そのコマンドを実行してください。ロケールが複数のファイルにまたがる場合、キーは `<file>::<key>` (例: `common::nav.home`) のように表記され、他のファイルには影響せずそのファイルのキーのみを再翻訳します。

`--fresh` は不要です。破損した値が翻訳メモリに由来する場合、`verify` はすでにそれをキャッシュから削除しており、その旨が表示されます: `[TM] Evicted 1 cached translation(s) that produced damaged values`。その後、再実行 (redo) によって破損した値を再利用する代わりにテキストが再翻訳されます (またはキャッシュにある別の正常な翻訳が提供されます)。手動で編集された値はキャッシュされないため、削除されるものはなく、再実行も同様に機能します。

Markdown/MDX コンテンツファイルの場合は、代わりにパスまたは glob を指定して `--retranslate` を使用します (例: `--retranslate docs/intro.md`)。最新の状態である場合や手動で翻訳された場合でも、それらのファイルを最初から翻訳し直します。強制的に再翻訳せずに対象のコンテンツファイルのみを実行対象に絞り込むには、`--files` を使用してください。

### コンテンツ翻訳でコードブロックが壊れる

これは起こらないはずです — コードブロックは翻訳前にシールドされます。発生した場合：

1. コードブロックが標準のフェンス（トリプルバッククォート）を使用しているか確認する
2. ソースの Markdown に閉じられていないコードブロックがないか確認する
3. Issue を報告してください — これはセンチネルシールドシステムのバグです

## CLI の問題

### `--watch` が変更を検出しない

ファイル監視は Node.js ネイティブの `fs.watch` を使用しています。既知の問題：

- **ネットワークドライブ** — `fs.watch` は NFS/SMB マウント上では安定して動作しません
- **Docker ボリューム** — ポーリングモードを使用するか、コンテナ内で champollion を実行してください
- **大きなディレクトリ** — ウォッチャーは `localesDir` を再帰的に監視します。非常に深いツリーは OS の制限を超える場合があります

### `npx` が古いバージョンを実行する

```bash
# Clear the npx cache
npx --yes champollion@latest sync
```

またはグローバルにインストールします：

```bash
npm install -g champollion
champollion sync
```

## パフォーマンス

### 多言語の同期が遅い

Champollion はデフォルトですべてのロケールを並列で翻訳します。それでも同期が遅い場合：

1. **大量処理のペアには Google Translate を使用する** — LLM 翻訳より 10〜50 倍高速です
2. **バッチサイズを大きくする**（デフォルトは 80）：
   ```json
   { "batchSize": 120 }
   ```
3. **並行性を調整する** — JSON ロケールの並列処理はデフォルトで 200、コンテンツは 48 です。API プロバイダーがより高いレート制限をサポートしている場合：
   ```bash
   npx champollion sync --json-concurrency 80 --content-concurrency 20
   ```
4. **高速なモデルを使用する** — `gpt-4o-mini` は `gpt-4o` より大幅に高速です

### API コストが高い

- **バッチサイズを確認する** — バッチが大きいほど API 呼び出しが少なくなり、コストが下がります
- **Translation Memory を使用する** — TM はデフォルトで有効です。`champollion tm stats` を実行して動作を確認してください。複数回の同期後もエントリが 0 の場合、`.champollion/` ディレクトリのパーミッションに問題がある可能性があります
- **プロンプトキャッシングを使用する** — Champollion は Anthropic と Google モデルでのキャッシュヒットのためにシステム/ユーザーメッセージを分割します
- **Tier 2 言語には Google Translate を使用する** — [30 言語を翻訳する](/docs/tutorials/translate-30-languages) クックブックを参照してください

### モデルやプロバイダーを切り替えた後の翻訳

方式の切り替え (例: `llm` から `deepl` への変更)、レジスター、またはコーチングを変更すると、キャッシュキーにこれらが含まれるため、再翻訳される対象については新しい翻訳が得られます — ただし、通常の sync では完了済みの内容は再翻訳されません。再翻訳を行うには `champollion sync --redo all` を使用します。同じ方式内で**モデル**を切り替えた場合、追加費用なしで以前のモデルが翻訳した内容が再利用されます。sync は見積もりの前にその旨を表示します。新しいモデル自体による翻訳を取得したい場合は、次のようにします:

```bash
# Have the new model translate what an earlier model wrote
# (what the new model already translated still comes from the cache)
champollion sync --redo all --fresh-on-model-change

# Re-translate specific content files from scratch
champollion sync --retranslate "docs/guides/**"
```

`--fresh-on-model-change` を単独で指定した場合、いずれにしても実行対象となるキー (新規または変更されたキー) のみが変更されます。モデルの切り替えのみを行った後、通常の `sync --fresh-on-model-change` を実行しても何も送信されません。

キャッシュキーの設計の詳細については、[Translation Memory](/docs/concepts/translation-memory) を参照してください。

## 不正なバージョンからの復旧 {#recover-old-damage}

古いパイプラインによって書き込まれた値は、**自動的に修復されることはありません**。マニフェストのハッシュが現在のソースと一致しているため、`sync` はそれらを処理完了とみなし、ゲートによる検証が二度と行われないためです。0.3.0 未満のバージョンを実行していたプロジェクトをアップグレードする場合は、ロケールファイルに破損が潜んでいる可能性があると想定し、まず監査 (audit) を実行してください:

```bash
champollion integrity
```

監査では既知の破損シグネチャを検出し、それぞれに対する修正方法を提示します:

| 検出項目 | 内容 | 修正方法 |
|---------|-----------|-----|
| `UNEXPECTED PUA` | 文字変換を意図していないのに書き込まれた文字体系の変換出力 (pIqaD/Tengwar/Kryptonian) — 空白としてレンダリングされます | `champollion repair-script` (オフライン、pIqaD に対して正確) |
| `HOLLOWED VALUES` | 文字が削除されたソース — コンテンツ保護ゲート導入前の出力 | 再翻訳 (下記参照) |
| `NO-TRANSLATE DRIFT` | 「翻訳」されてしまったURLやその他のそのまま維持すべきキー | `champollion sync` (無料で自動修復) |

文字が抜け落ちた値、あるいは信頼できなくなったロケールがある場合は、リビルドを実行してください:

```bash
champollion sync --pair en:tlh --force
```

`--force` は、指定されたペアのすべてのソースキーを再度キューに入れます。翻訳メモリの一致は引き続き提供されますが、提供されるすべての一致は**まず現在のゲートに対して検証されます**。ゲートによって拒否されたキャッシュ値は破棄されて再課金されるため、汚染されたキャッシュによってリビルドが損なわれることなく自己修復されます。何があっても完全に新規に再課金・再翻訳を行いたい場合は `--no-tm` を追加し、どちらの場合も支出の上限を設定するには `--max-cost` を追加してください。

sync 後の検証でもこれらのシグネチャが報告されるため、破損したロケールが気付かれずにリリースされることなく、修正方法とともに `sync` で明確に失敗します。

### `--no-tm` クリーンアップ後の1回限りの再キュー {#one-time-requeue}

復旧に `--no-tm` を使用した場合、解決済みだと思っていたソースそのままの値 (source-echo keys) が**次回**の sync でまとめてキューに入ることがあります。`--no-tm` は翻訳メモリへのスタンプ (刻印) なしで値を書き込むため、ソースと同一の*スタンプされていない*値は未翻訳の値と区別がつきません。そのため一度キューに入り、再取得され (多くの場合ソースと同一)、スタンプが押されて恒久的に解決されます。これは1回限りのコストであり、ループすることはありません。対象となるキーを正確にプレビューするには、以下を実行します:

```bash
champollion sync --dry --list-keys
```

## それでも解決しない場合

- **[GitHub Issues](https://github.com/gamedaysuits/champollion/issues)** — 既存の Issue を検索するか、新しい Issue を作成する
- **[アーキテクチャドキュメント](/docs/concepts/architecture)** — システム設計を理解する
- **[品質ゲート](/docs/concepts/quality-gate)** — 内部でのバリデーションの仕組み
