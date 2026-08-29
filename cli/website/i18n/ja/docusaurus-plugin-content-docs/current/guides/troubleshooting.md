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

1. 設定で**バッチサイズを小さくする**：
   ```json
   { "batchSize": 15 }
   ```
2. **レート制限の高いモデルを使用する**（例：`google/gemini-3.5-flash` は制限が緩やか）
3. 大量処理のペアには**安価で高速な方法を使用する** — Google Translate にはレート制限がありません：
   ```json
   { "pairs": { "en:it": { "method": "google-translate" } } }
   ```

### モデルが見つからない / 404 エラー

直接 LLM プロバイダー（`openai`、`anthropic`、`gemini`）は初回使用時にモデル文字列を検証します。警告が表示された場合：

**「looks like an OpenRouter path」** — OpenRouter 形式のモデル（`google/gemini-3.5-flash`）を直接プロバイダーで使用しています。直接プロバイダーはベアモデル名を使用します：

```diff
- { "method": "gemini", "model": "google/gemini-3.5-flash" }
+ { "method": "gemini", "model": "gemini-2.5-flash" }
```

または `llm` メソッドに切り替えて OpenRouter を使用します：
```json
{ "method": "llm", "model": "google/gemini-3.5-flash" }
```

**「is an Anthropic/OpenAI/Gemini model」** — モデルを誤ったプロバイダーに送信しています：

```diff
- { "method": "gemini", "model": "claude-sonnet-4-6" }
+ { "method": "anthropic", "model": "claude-sonnet-4-6" }
```

**「not found in available models」** — モデルが廃止されているか、スペルが間違っている可能性があります。Champollion はプロバイダーのライブモデルリストを取得して代替案を提案します。現在のモデル名についてはプロバイダーのドキュメントを確認してください。

:::tip[モデルの廃止は起こりえます]
プロバイダーは定期的にモデル名を廃止します。プロバイダーのアップデート後に翻訳が突然失敗するようになった場合は、`[WARN]` の出力を確認してください — 現在利用可能な代替モデルが表示されます。
:::

## 翻訳品質

### 翻訳がソース言語をそのまま返す

品質ゲートがこれを検出します。翻訳が英語のソースと同一の場合、拒否されて再試行されます。それでも続く場合：

1. **モデルを確認する** — 特定の言語ペアでパフォーマンスが低いモデルがあります
2. **レジスター指示を追加する** — 生成する言語をモデルに伝えます：
   ```json
   {
     "languages": {
       "ja": { "name": "Japanese", "register": "Polite/formal Japanese" }
     }
   }
   ```
3. **別のモデルに切り替える** — `gpt-4o-mini` から `gpt-4o` または `google/gemini-2.5-pro` に変更する

### 誤ったスクリプトの出力（例：日本語にラテン文字が出力される）

品質ゲートのスクリプト準拠チェックがほとんどのケースを検出します。それでも続く場合：

- ロケールコードが正しいか確認する（`ja` であり、`jp` ではない）
- `register` フィールドに明示的なスクリプト指示を追加する：
  ```json
  { "register": "Japanese using hiragana, katakana, and kanji" }
  ```

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

`.champollion.lock` が不正な状態になった場合：

```bash
# Reset the lock file (next sync will retranslate everything)
rm .champollion.lock
npx champollion sync
```

:::warning
ロックファイルを削除すると、次の同期では変更されたキーだけでなく、すべてのキーが再翻訳されます。大規模なプロジェクトでは API コストに影響します。
:::

### 特定のキーの再翻訳

個別の翻訳が誤っており、ロックファイルを削除せずに強制的に再翻訳したい場合：

```bash
# Re-translate a single key
npx champollion sync --force-keys "hero.title"

# Re-translate multiple keys
npx champollion sync --force-keys "nav.home,nav.about,footer.copyright"
```

`--force-keys` フラグは、指定したキーに対してロックファイルのハッシュチェックを上書きし、他のキーに影響を与えずに再翻訳を強制します。

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

### プロバイダーを切り替えた後に翻訳が古いまま

翻訳方法を切り替えた場合（例：`llm` から `deepl`）、ソーステキストが変更されていないキーについては、TM キャッシュが以前の方法の古い翻訳を返し続ける場合があります。キャッシュキーにはメソッド名が含まれているため、ほとんどのケースは自動的に処理されます。ただし、同じメソッド内で `model` を変更した場合：

```bash
# Force fresh translations for all keys
champollion sync --no-tm

# Or clear the cache entirely and re-sync
champollion tm clear --yes
champollion sync
```

キャッシュキーの設計の詳細については、[Translation Memory](/docs/concepts/translation-memory) を参照してください。

## 不良バージョンからの復旧 {#recover-old-damage}

古いパイプラインによって書き込まれた値が**自動的に修復されることはありません**。マニフェストのハッシュが現在のソースと一致するため、`sync` はそれらを処理済みと見なし、ゲートが再びチェックすることはありません。0.3.0より前のバージョンを実行していたプロジェクトをアップグレードする場合は、ロケールファイルに破損が残っている可能性があると想定し、まず監査を行ってください：

```bash
champollion integrity
```

監査により既知の破損シグネチャが検出され、それぞれに対する修正方法が提示されます：

| 検出結果 | 内容 | 修正方法 |
|---------|-----------|-----|
| `UNEXPECTED PUA` | 変換が不要な場合に書き込まれた文字変換出力（pIqaD/Tengwar/Kryptonian） — 空白でレンダリングされます | `champollion repair-script` (オフライン、pIqaDに対して正確) |
| `HOLLOWED VALUES` | 文字が削除されたソース — コンテンツ保持ゲートが導入される前の出力 | 再翻訳（下記参照） |
| `NO-TRANSLATE DRIFT` | 「翻訳」されてしまったURLやその他のそのまま保持すべきキー | `champollion sync` (無料で自動的に修復されます) |

空洞化した値 — あるいは単に信頼できなくなったロケールについては — 再構築を行ってください：

```bash
champollion sync --pair en:tlh --force
```

`--force` は、スコープされたペアのすべてのソースキーを再度キューに入れます。翻訳メモリのヒットは引き続き提供されますが、提供されるすべてのヒットは**まず現在のゲートに対して検証されます** — 現在のゲートが拒否するキャッシュされた値は破棄され、再度課金対象として処理されるため、汚染されたキャッシュが再構築に悪影響を与えることなく自己修復されます。状態に関わらず完全に新規で再翻訳（再課金）を行いたい場合は `--no-tm` を追加し、いずれの場合も支出に上限を設けるには `--max-cost` を追加してください。

同期後の検証でもこれらのシグネチャが報告されるため、破損したロケールが気付かれずにリリースされることはなく、`sync` で（修正方法とともに）明確にエラーとして失敗します。

### `--no-tm` クリーンアップ後の1回限りの再キューイング {#one-time-requeue}

復旧に `--no-tm` を使用した場合、**次回**の同期時に、解決済みだと思っていたソースエコー（ソースと同じ値）のキーのバッチがキューに入れられることを想定してください。`--no-tm` は翻訳メモリにスタンプ（記録）せずに値を書き込みます。そして、ソースと同一でありながら*スタンプされていない*値は、未翻訳のものと区別がつきません。そのため、一度再キューイングされ、戻ってきて（多くの場合同一です）、スタンプされ、永久に解決済みとなります。これは1回限りのコストであり、ループすることはありません。どのキーが対象になるかを正確にプレビューするには、以下を使用します：

```bash
champollion sync --dry --list-keys
```

## それでも解決しない場合

- **[GitHub Issues](https://github.com/gamedaysuits/champollion/issues)** — 既存の Issue を検索するか、新しい Issue を作成する
- **[アーキテクチャドキュメント](/docs/concepts/architecture)** — システム設計を理解する
- **[品質ゲート](/docs/concepts/quality-gate)** — 内部でのバリデーションの仕組み
