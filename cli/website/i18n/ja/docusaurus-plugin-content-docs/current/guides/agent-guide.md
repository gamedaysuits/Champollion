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
| `pairs` | ペアごとの上書き設定（`"src:tgt"` キー）とメソッド設定 | 任意 |
| `localesDir` | ロケールファイルの配置場所 | `./locales` |
| `model` | `llm`/`llm-coached` メソッド用の LLM モデル | `google/gemini-3.5-flash` |
| `batchSize` | 1 回の API 呼び出しあたりのキー数 | 80（LLM）; Google Translate は 128 セグメント/リクエストが上限 |
| `jsonConcurrency` | JSON キーの並列ロケール翻訳数 | 50 |
| `contentConcurrency` | コンテンツ翻訳の並列 API 呼び出し数 | 48（Docusaurus docs）、12（Hugo `contentDir`） |

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

| チェック | 検出内容 | 例 |
|-------|----------------|---------|
| **空白/ブランク** | モデルが何も返さなかった | `""` |
| **ソースのエコー** | モデルが英語の入力をそのまま返した | 日本語に対して `"Welcome"` |
| **ハルシネーションループ** | トライグラムの繰り返し | `"Qo' Qo' Qo' Qo'"` |
| **長さの膨張** | 出力がソースの4倍以上の長さになっている | 10文字のソース → 50文字の出力 |
| **スクリプトの適合性** | ロケールに対して誤ったスクリプトが使われている | アラビア語ロケールにラテン文字のテキスト |

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

| ファイル | 用途 | Git 管理 |
|------|---------|------|
| `.champollion.lock` | 翻訳済みソース値の SHA-256 ハッシュ（変更検出用） | **Yes** — コミットしてください |
| `.champollion-content.lock` | 同上（Markdown/MDX コンテンツファイル用） | **Yes** — コミットしてください |
| `.champollion/` | 内部状態ディレクトリ（`tm.json` キャッシュ、XLIFF エクスポート、バックアップ） | **No** — .gitignore に追加してください; `tm.json` はローカルキャッシュです（[設定](/docs/getting-started/configuration) を参照） |
| 作成したコーチングファイル（例: `coaching/fr.json`） | 言語に関する知識 | **Yes** — コミットしてください |
| `champollion.config.json` | プロジェクト設定 | **Yes** — コミットしてください |

---

## よくある使用パターン

**設定されたすべてのペアを翻訳する:**
```bash
npx champollion sync
```
Champollionはすべてのロケールを並行して翻訳します。TMキャッシングにより、変更されたキーのみがAPIを呼び出します（変更されていないペアはキャッシュから提供されるため、完全な同期を行ってもコストは低く抑えられます）。

**特定のペアのみを翻訳する:**
```bash
npx champollion sync --pair en:fr          # one pair
npx champollion sync --pair en:fr,en:de    # comma-separated list
```
`--pair` は、実行を指定されたペアのみに制限します。準備状況のチェックとコストの消費は、それらのペアにのみ適用されます。設定されたペアグラフに存在しないペアを指定すると、設定済みのペアのリストとともに明確なエラーが発生します。警告なしに無視される（silent no-op）ことは決してありません。

**コンテンツモード（Docusaurus、Hugo などの Markdown/MDX）:**
```bash
npx champollion sync --content-dir ./content
```
ドキュメント、ブログ記事、およびコンテンツファイルをロケール JSON と並行して翻訳します。コンテンツ翻訳は並列で実行されます。`--content-concurrency` で調整できます。

**ドライラン（書き込みなしでプレビュー）：**
```bash
npx champollion sync --dry-run
```

**特定のキーを強制的に再翻訳する：**
```bash
npx champollion sync --force-keys "hero.title,nav.about"
```

**すべてのコンテンツファイルを強制的に再翻訳する：**
```bash
npx champollion sync --force-content
```

**翻訳ステータスを確認する：**
```bash
npx champollion status
```
各ペアのカバレッジ、品質ティア、プラグイン情報を表示します。

**未翻訳のフォールバックを監査する：**
```bash
npx champollion audit
```
翻訳が必要なすべての `[EN]` フォールバック値を一覧表示します。

---

## トラブルシューティング

| 問題 | 対処法 |
|---------|-----|
| `OPENROUTER_API_KEY not set` | キーをエクスポートするか、プロジェクトルートの `.env` に追加する |
| `No locale files found` | 設定で `localesDir` を指定するか、ロケールファイルが標準的な命名規則（`en.json`、`fr.json`）に従っているか確認する |
| `[GATE] Script compliance failed` | ターゲットロケールに期待されるスクリプトではなくラテン文字のテキストが出力された — 別のモデルを試すか、コーチングデータを追加する |
| `[GATE] Source echo` | モデルが英語をそのまま返した — コーチングデータまたは別のモデルで通常は解決できる |
| すべての翻訳がキャッシュされている | `--no-tm` を付けて実行してキャッシュをバイパスするか、特定のキーには `--force-keys` を使用する |
| ロックファイルのコンフリクト | `.champollion.lock` は SHA-256 ハッシュを使用しています。マージコンフリクトはどちらかのバージョンを残して解決し、その後同期を再実行すれば安全です |

---

## 次のステップ

- [クイックスタート](/docs/getting-started/quick-start) — はじめから始めるための完全なウォークスルー
- [CLI リファレンス](/docs/reference/cli) — すべてのコマンドとフラグ
- [仕組み](/docs/how-it-works) — 同期パイプラインの解説
- [Eval ハーネスブリッジ](/docs/guides/bridge) — champollion がネットワークに接続する仕組み
- **独自の翻訳メソッドを構築したい方へ：** [ネットワーク エージェントガイド](/docs/network/getting-started/agent-guide)をご覧ください。メソッドを構築し、公開リーダーボードで動作を実証し、賞金が設けられた際には競争に参加できます（賞金は計画中の仕組みです。詳細は[正直な制限事項](/docs/network/honest-limitations)をご覧ください）。
