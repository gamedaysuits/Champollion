---
sidebar_position: 9
title: "エージェントガイド：champollionの使い方"
description: "AIエージェントがchampollionをインストール・設定・実行してロケールファイルを翻訳する方法を説明します。"
related:
  - label: "Agent Guide: Building & Benchmarking on the Network"
    to: /docs/network/getting-started/agent-guide
    kind: arena
    note: "The eval-side guide for the same agents"
  - label: "Serving a Custom Method as an API"
    to: /docs/guides/serving-a-method
    kind: guide
  - label: "Build a Translation Plugin"
    to: /docs/tutorials/build-a-plugin
    kind: tutorial
  - label: "CLI Reference"
    to: /docs/reference/cli
    kind: reference
---

# エージェントガイド：champollion の使い方

champollion は、1つのコマンドでアプリのロケールファイルを翻訳する CLI ツールです。このガイドは、ゼロから翻訳済みロケールファイルを素早く作成したい AI エージェント（または AI エージェントと協働する開発者）を対象としています。

:::tip[すでに使い慣れている方へ]
コマンドだけ確認したい場合は [CLI リファレンス](/docs/reference/cli) をご覧ください。翻訳メソッドのビルドやベンチマークを行いたい場合は [ネットワークエージェントガイド](/docs/network/getting-started/agent-guide) をご覧ください。
:::

---

## 環境セットアップ

```bash
# No global install needed — npx runs it directly
npx champollion sync
```

**必要条件:**
- Node.js 20.11 以上（ネイティブ ESM）
- 翻訳プロバイダーの API キー

**API キーの設定** — champollion は使用するメソッドに応じて、少なくとも1つのキーが必要です：

```bash
# Option 1: export (session only)
export OPENROUTER_API_KEY="sk-or-..."        # for llm / llm-coached methods
export GOOGLE_TRANSLATE_API_KEY="AIza..."    # for google-translate method

# Option 2: .env file in your project root (persistent, gitignored)
echo 'OPENROUTER_API_KEY=sk-or-...' > .env
```

Champollion は `.env.local` と `.env` を自動的に読み込みます（優先順位: `process.env` → `.env.local` → `.env`）。OpenRouter のキーは [openrouter.ai/keys](https://openrouter.ai/keys) で取得できます。

---

## 初回の同期

Champollion はロケールファイル、そのフォーマット（JSON、TOML、または YAML）、およびターゲット言語を自動検出します。

```bash
npx champollion sync
```

**処理の流れ：**
1. `champollion.config.json` を読み込む（または設定を自動検出する）
2. ソースロケールファイルをスキャンし、ネストされたキーをフラット化する
3. `.champollion.lock`（以前に翻訳された値の SHA-256 ハッシュ）と比較する
4. キャッシュされた翻訳（翻訳メモリ）を `.champollion/tm.json` で確認する
5. 設定されたメソッドを使って、**変更・欠落・古くなったキーのみ**を翻訳する
6. すべての翻訳に対してクオリティゲート（5項目のチェック）を実行する
7. チェックを通過した翻訳をターゲットロケールファイルに書き込む
8. ロックファイルと翻訳メモリのキャッシュを更新する

1つのキーを変更した後の典型的な再実行では、ステップ4で142件のキーがキャッシュから提供され、ステップ5で1件のキーが翻訳されます。これが、2回目以降の同期が高速かつ低コストである理由です。

---

## 設定

プロジェクトのルートに `champollion.config.json` を作成します：

```json
{
  "inputLocale": "en",
  "pairs": {
    "en:fr": { "method": "llm-coached" },
    "en:ja": { "method": "google-translate" },
    "en:crk": { "method": "api", "endpoint": "http://localhost:3000/translate" }
  }
}
```

ペアキーの区切りには**コロン**（`en:fr`）を使用します。ハイフンは使用しないでください — ハイフンは `es-MX` のような地域ロケールコードのために予約されています。

主なフィールド：

| フィールド | 用途 | デフォルト |
|-------|---------|---------|
| `inputLocale` | ソース言語 | `en` |
| `languages` | ターゲット言語（配列またはオブジェクト） | `[]` |
| `pairs` | メソッド設定を含むペアごとのオーバーライド（`"src:tgt"` キー） | 任意 |
| `localesDir` | ロケールファイルの配置場所 | `./locales` |
| `model` | `llm`/`llm-coached` メソッドで使用するLLMモデル | `google/gemini-3.8-flash` |
| `batchSize` | API呼び出しごとのキー数 | 80（LLM）。Google翻訳はリクエストあたり128セグメントに制限 |
| `jsonConcurrency` | JSONキーの並行ロケール翻訳数 | 50 |
| `contentConcurrency` | コンテンツ翻訳の並行API呼び出し数 | 48（Docusaurusドキュメント）、12（`contentDir`） |

詳細なリファレンス：[設定](/docs/getting-started/configuration)

---

## 翻訳メソッド

| メソッド | 使用場面 | コスト | 必要な API キー |
|--------|------------|------|---------------|
| **`llm`** | 汎用目的、リソースが豊富な言語に適している | トークン単位（モデルによる） | `OPENROUTER_API_KEY` |
| **`llm-coached`** | ターゲット言語の文法規則や辞書がある場合 | トークン単位＋コーチングコンテキスト | `OPENROUTER_API_KEY` |
| **`google-translate`** | Google 翻訳が有効な高リソース言語 | 100万文字あたり $20 | `GOOGLE_TRANSLATE_API_KEY` |
| **`api`** | HTTP エンドポイントの背後にホストされたカスタムパイプライン | サーバー側で決定 | なし（エンドポイント側で認証を処理） |
| **`plugin`** | ローカルにインストールされた事前パッケージ済みメソッド | 様々 | 様々 |

詳細：[翻訳メソッド](/docs/guides/translation-methods)

---

## コーチングデータ

`llm-coached` のペアでは、コーチングデータが明示的な言語知識によって LLM の出力を誘導します。コーチングファイルを作成します：

```json title="coaching/fr.json"
{
  "grammar_rules": [
    "Use formal register (vous) for all UI text",
    "Adjectives agree in gender and number with the noun"
  ],
  "dictionary": {
    "dashboard": "tableau de bord",
    "settings": "paramètres"
  },
  "style_notes": "Prefer active voice. Avoid anglicisms."
}
```

ペアの設定でそのファイルを参照します：

```json
"en:fr": { "method": "llm-coached", "coachingFile": "coaching/fr.json" }
```

クオリティゲートは、辞書の用語が実際に出力に含まれているかを検証します。違反は `[TERM]` 警告としてログに記録されます。

詳細：[コーチングデータ](/docs/concepts/coaching-data)

---

## クオリティゲート

すべての翻訳は、ディスクに書き込まれる前に5つの自動チェックを通過します：

| チェック | 検知対象 | 例 |
|-------|----------------|---------|
| **空 / 空白** | モデルが何も返さなかった | `""` |
| **ソースのエコー** | モデルが英語の入力をそのまま返した | 日本語に対して `"Welcome"` |
| **ハルシネーションループ** | 繰り返されるトリグラム | `"Qo' Qo' Qo' Qo'"` |
| **長さの肥大化** | 出力がソース長の4倍を超えている（ちょうど4倍なら合格） | 10文字のソース → 50文字の出力 |
| **文字体系の準拠** | ロケールに対して誤った文字体系 | アラビア語ロケールに対するラテン文字のテキスト |

失敗は `[GATE]` プレフィックス付きでログに記録されます。サイレントフォールバックはありません。翻訳が失敗した場合は、静かに受け入れられるのではなく、報告されます。

詳細：[クオリティゲート](/docs/concepts/quality-gate)

---

## 翻訳メモリ

Champollion は翻訳を `.champollion/tm.json` にキャッシュします。キーはソーステキスト＋ロケール＋メソッドの組み合わせです。2回目以降の同期では、変更されていないキーはキャッシュから提供されるため、API 呼び出しもコストも発生しません。

```
[TM] 142 key(s) served from cache
Translating 3 key(s) to French (llm)... [OK]
```

1回の実行でキャッシュをバイパスするには：`npx champollion sync --no-tm`

詳細：[翻訳メモリ](/docs/concepts/translation-memory)

---

## 生成されるファイル

Champollion はプロジェクト内にいくつかのファイルを作成します。誤って削除したり、不適切なファイルをコミットしたりしないよう、各ファイルの役割を把握しておいてください：

| ファイル | 用途 | Git管理？ |
|------|---------|------|
| `.champollion.lock` | 翻訳されたソース値のSHA-256ハッシュ（変更検知）、およびロケールごとの情報（同期によって書き込まれた内容、やり直しによって保留されたキー、拒否後に保留されたキー） | **はい** — コミットしてください |
| `.champollion-replaced-edits.jsonl` | 同期によって置き換えられた手動編集済みの翻訳とその文言（該当する場合にのみ書き込まれます） | **はい** — コミットしてください |
| `.champollion-content.lock` | 同様（ただしMarkdown/MDXコンテンツファイル用） | **はい** — コミットしてください |
| `.champollion/` | 内部状態ディレクトリ（`tm.json` キャッシュ、XLIFFエクスポート、バックアップ） | **いいえ** — .gitignoreに追加してください。`tm.json` はローカルキャッシュです（[設定](/docs/getting-started/configuration)を参照） |
| 作成したコーチングファイル（例: `coaching/fr.json`） | ユーザーの言語的知見 | **はい** — コミットしてください |
| `champollion.config.json` | プロジェクト設定 | **はい** — コミットしてください |

---

## よくある使用パターン

**設定されているすべてのペアを翻訳する:**
```bash
npx champollion sync
```
Champollionはすべてのロケールを並行して翻訳します。TMキャッシュを使用するため、変更されたキーのみがAPIに送信されます（変更のないペアはキャッシュから提供されるため、完全同期のコストは低く抑えられます）。

**特定のペアのみを翻訳する:**
```bash
npx champollion sync --pair en:fr          # one pair
npx champollion sync --pair en:fr,en:de    # comma-separated list
```
`--pair` は実行を指定したペアのみに制限します。準備状況のチェックと支出はそれらのペアにのみ適用されます。設定済みのペアグラフに含まれていないペアを指定した場合は、サイレントに何もしない（no-op）のではなく、設定済みペアのリストとともに明確にエラーを出力して失敗します。

**ペアの記述方法。** プロジェクトのペアは、`champollion.config.json` でキーとして扱われる形式（`en:fr`）で記述します。`sync`、`verify`、および `serve` も `en>fr` と `en-fr` を読み取り、`en-pt-BR` は設定したペアと照合されます。ネットワークコマンド（`network register-corpus`、`leaderboard`、`recommend`、`submit`）は、リーダーボードで保存される形式である `eng>crk` でペアを書き込み、`eng-crk` と `eng:crk` も同様に読み取ります。そこでは、ハイフンのみを使用したペアは2文字または3文字の2つのコードである必要があります（`eng-crk`）。コード自体にハイフンが含まれる場合は、`>` が必要です: `--pair "eng>pt-BR"`。`eng-pt-BR` は `eng-pt` や `BR` と解釈される可能性もあるため、推測されることなく拒否されます。シェルでは、`>` の形式をクォートしてください: `--pair "eng>crk"`。クォートしない場合、シェルは出力を `crk` という名前のファイルにリダイレクトしてしまいます。

**コンテンツモード（Markdown/MDXのフォルダー: Hugoの `content/` や任意のフォルダー。Docusaurusのドキュメントはこれを指定しなくても検出されます）:**
```bash
npx champollion sync --content-dir ./content
```
ロケールJSONと並行して、ドキュメント、ブログ記事、およびコンテンツファイルを翻訳します。各翻訳は `<name>.<locale>.md` としてソースの隣に書き込まれます。ソースが別の箇所で変更された場合でも、レビュー担当者が行った編集内容は保持されます（[コンテンツ翻訳](/docs/guides/content-translation#reviewing-and-editing-translations)を参照）。コンテンツ翻訳は並行して実行されます。`--content-concurrency` で調整してください。

**ドライラン（書き込みなしでプレビュー）：**
```bash
npx champollion sync --dry-run
```

**特定のキーを強制的に再翻訳する：**
```bash
npx champollion sync --force-keys "hero.title,nav.about"
```

**すべてのコンテンツファイルを再処理する（キャッシュされたテキストが再利用されるため、変更のないテキストには費用がかかりません）:**
```bash
npx champollion sync --force-content
```

**特定のコンテンツファイルを新規に翻訳する（課金対象）、または実行を一部のファイルに制限する:**
```bash
npx champollion sync --retranslate docs/intro.md
npx champollion sync --files "docs/guides/**"
```

**機械可読な実行:** `--json` は1行につき1つのJSONオブジェクト（NDJSON）を出力し、それぞれに `level` が含まれます。標準出力には `info` および `ok` メッセージ、`event` レコード（見積もりである `"event": "cost"`（`--max-cost` ゲートの前）、およびコンテンツファイルとロケールごとに1つの `"event": "file"`）、そして最後に終了を示す `{"level": "summary", "command": "sync", …}` が出力されます。標準エラー出力には `warn` および `error` の行（これもJSON）が出力されます。サマリーは行の位置だけで選択するのではなく、必ずレベルで選択してください: `npx champollion sync --dry --json 2>/dev/null | jq -c 'select(.level == "summary")'`。終了コード `2` は部分的な完了（一部の処理は行われたが、何かが失敗した）を意味します。

見積もり（`cost` イベント、およびサマリーの `costEstimate`）において、価格が不明な部分が一部でも存在する場合、`totalEstimatedCost` は `null` になります。部分的な合計になることはなく、不明な場合に `0` になることもありません。`knownEstimatedCost` には価格が判明している部分が保持され、`unknownCost.reason` には価格のないペアの名前が入り、`unknownCost.notes` には何に価格がなくその理由が何であるか（OpenRouterのリストに存在しないモデル名（誤字の可能性が高く、最も近いリスト名が表示されます）、トークンあたりの価格が設定されていないリスト記載モデル、または読み取れなかった価格リストなどの `{ subject, pairs, note }`）が示されます。このマシン上のモデル（`localhost`/`127.0.0.1`/`::1` にある `local` または `api` エンドポイント）は、`"local": true` の `0` として価格設定されます。サマリーの `sentToModel` は、今回の実行でメソッドに送信されたキー数をカウントします（`tmHits`: キャッシュから提供）。ドライランのサマリーには `preflight: { ready, failures }` が含まれます。ドライラン自体は `0` で終了しますが、`ready: false` は実際の実行が停止して `1` で終了すること（キーの不足、または実行に必要なモデルサーバーが応答しないこと）を意味します（[終了コード](/docs/reference/cli#sync-exit-codes)を参照）。`--max-cost` を指定した場合、`maxCost: { cap, estimatedCost, wouldStop }` も含まれます。`wouldStop: true`（および `exitCode: 2` と `reason`）は、実際の実行がAPI呼び出しを行う前に上限に達して停止することを意味します。`realRun: { exitCode, wouldStop, reasons }` は、プレビューで判別できる限りにおいて実際の実行が終了する終了コードです。これにはプリフライトと上限、さらに処理が部分的な完了となる要因（保留されたキー、ディスク上にある複数形メッセージのうち言語で使用される形式が欠落しており再要求されないもの。ドライランの `totalPluralGaps` でカウントされます）が含まれます。ドライランは何も検証しません（`verify: { "ran": false }`）。実際の実行と同じ `--method`/`--model` を指定してドライランを実行してください。これらがない場合、設定で指定されたメソッドがチェックされます。

**翻訳ステータスを確認する:**
```bash
npx champollion status
```
各ペアのメソッド、モデル、カバレッジ、およびプラグイン情報を表示します（`qualityTier` は設定で設定されている場合のみ表示され、測定値ではなくラベルです）。

**未翻訳のフォールバックを監査する：**
```bash
npx champollion audit
```
翻訳が必要なすべての `[EN]` フォールバック値を一覧表示します。

---

## トラブルシューティング

| 問題 | 解決策 |
|---------|-----|
| `OPENROUTER_API_KEY not set` | キーをエクスポートするか、プロジェクトルートの `.env` に追加してください |
| `No locale files found` | 設定で `localesDir` を設定するか、ロケールファイルが標準の命名規則（`en.json`、`fr.json`）と一致していることを確認してください |
| `[GATE] Script compliance failed` | ターゲットロケールに期待される文字体系ではなくラテン文字のテキストが返されました。別のモデルを試すか、コーチングデータを追加してください |
| `[GATE] Source echo` | モデルが英語を変更せずにそのまま返しました。通常はコーチングデータの追加または別のモデルの使用で解決します |
| すべての翻訳がキャッシュされている | キャッシュをバイパスするには `--no-tm` を指定して実行するか、特定のキーに対して `--force-keys` を使用してください |
| ロックファイルのコンフリクト | `.champollion.lock` はハッシュを保持します。マージコンフリクトはどちらかのバージョンを残して同期を再実行すれば安全に解決できます。相手側のロケールごとのレコードを残すと、いくつかの値が手動編集されたものとして読み取られる可能性があります（一括のやり直しではそれらが保持され、名前が記録されます。`--redo keys:` はそのうちの1つを置き換えます）。その逆になることはありません |
| 「保留中（held back）」のキー | 品質ゲートが以前にそのモデルの回答を拒否しました。通常の同期では再送信されません（同じ回答に対して課金されてしまうためです）。`champollion sync --redo keys:<key>` で再要求するか、`fallback` を追加するか、`noTranslate` に記載するか、手動で記述してください |

---

## 次のステップ

- [クイックスタート](/docs/getting-started/quick-start) — はじめから始めるための完全なウォークスルー
- [CLI リファレンス](/docs/reference/cli) — すべてのコマンドとフラグ
- [仕組み](/docs/how-it-works) — 同期パイプラインの解説
- [Eval ハーネスブリッジ](/docs/guides/bridge) — champollion がネットワークに接続する仕組み
- **独自の翻訳メソッドを構築したい方へ：** [ネットワーク エージェントガイド](/docs/network/getting-started/agent-guide)をご覧ください。メソッドを構築し、公開リーダーボードで動作を実証し、賞金が設けられた際には競争に参加できます（賞金は計画中の仕組みです。詳細は[正直な制限事項](/docs/network/honest-limitations)をご覧ください）。
