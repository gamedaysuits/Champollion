---
sidebar_position: 2
title: "評価ハーネス v2.0"
related:
  - label: "Scoring Specification"
    to: /docs/network/specifications/scoring
    kind: spec
    note: "What the harness metrics feed into"
  - label: "Statistical Significance Testing"
    to: /docs/network/specifications/significance
    kind: spec
  - label: "Method Interface"
    to: /docs/network/specifications/methods
    kind: spec
  - label: "Run Card Specification"
    to: /docs/network/specifications/run-card
    kind: spec
  - label: "Cookbook: Translate 30 Languages"
    to: https://champollion.dev/docs/tutorials/translate-30-languages
    kind: champollion
    note: "Use the harness to audit registers in production"
---

# Eval Harness v2.0

> **エグゼクティブサマリー。** このページでは、MT評価ハーネス（標準化されたコーパスに対して翻訳手法をベンチマークし、スコア付きのランカードを生成するツール）のインストール、設定、および使用方法について説明します。メトリクス、スキーマ、評価プロトコルの正式な定義については、[ベンチマーク仕様](/docs/network/specifications/benchmark)を参照してください。

ハーネスは翻訳実験を実行し、ランカードを生成します。プロンプトの構築、APIコール、スコアリング、結果のシリアライズを処理します。データセットとモデルはユーザーが用意します。

## インストール

**必要要件:** Python 3.10以上

```bash
pip install mt-eval-harness
```

これにより `mt-eval` コマンドがインストールされます。

## 使用方法

```bash
mt-eval run --corpus path/to/dataset.json
```

これにより、コーパス内のすべてのエントリが設定済みのモデル（またはメソッドプラグイン）を通じて処理され、出力がスコアリングされ、ランカードのJSONファイルが出力ディレクトリに書き込まれます。

## CLIフラグ

### `mt-eval run`

| フラグ | 必須 | デフォルト | 説明 |
|------|----------|---------|-------------|
| `--corpus` | ✅ | — | コーパスファイルへのパス（`.json`、`.jsonl`、`.tsv`） |
| `--source-file` / `--reference-file` | — | — | 対訳テキストファイル（FLORES+、WMT形式） |
| `-m, --model` | — | `gemini-pro` | モデルスラッグ（短縮名またはOpenRouterのフルID）。`shared/model-aliases.json` で解決されます。複数モデルの実行にはカンマ区切りで指定 |
| `-d, --dataset` | — | `all` | データセットフィルター：`all`、セグメント名、またはIDの範囲 |
| `--ids` | — | — | 評価するエントリIDをカンマ区切りで指定 |
| `--source-lang` | — | `English` | ソース言語名 |
| `--target-lang` | — | — | ターゲット言語名 |
| `-p, --prompt` | — | `naive` | プロンプトバージョン（`naive`、`custom`、`champollion`） |
| `--coaching-file` | — | — | コーチングプロンプトテキストファイルへのパス |
| `--coaching` | — | — | インラインコーチングテキスト（引用符付き文字列） |
| `--method` | — | — | メソッドプラグインディレクトリへのパス（`method.json` とPythonモジュールを含む） |
| `--method-card` | — | — | リーダーボードメタデータ用のメソッドカードJSONへのパス |
| `--fst-retries` | — | `0` | FSTリトライ試行回数（デフォルトのLLMメソッドのみ） |
| `--skip-fst` | — | `false` | FSTクオリティゲートを完全にスキップする |
| `--tools` | — | `false` | ツール呼び出しモードを有効にする |
| `--tools-list` | — | — | ツール名をカンマ区切りで指定 |
| `--max-tool-rounds` | — | `8` | エントリごとのツール呼び出しの最大ラウンド数 |
| `--hooks` | — | — | 翻訳後フック名 |
| `--style-profile` | — | — | スタイルプロファイルJSONへのパス。文体一貫性メトリクスの計算を有効にします（情報提供のみ — 複合スコアには含まれません。[§ 文体・レジスターメトリクス](#writing-style-and-register-metrics-informational)を参照） |
| `-b, --batch-size` | — | `25` | APIコールあたりのエントリ数 |
| `-c, --concurrency` | — | `8` | 並列APIコール数 |
| `--max-tokens` | — | `32768` | APIコールあたりの最大トークン数 |
| `--temperature` | — | `0.0` | サンプリング温度（0.0 = 決定論的） |
| `--no-cache` | — | `false` | レスポンスキャッシュを無効にする |
| `--cache-dir` | — | `eval/cache/harness` | キャッシュディレクトリのパス |
| `-o, --output-dir` | — | `eval/logs/harness` | ランカードとログの出力ディレクトリ |
| `-n, --name` | — | — | 人間が読めるラン名 |
| `--dry-run` | — | `false` | APIコールを行わずに設定を検証する |
| `--champollion-config` | — | — | `champollion.config.json` へのパス |
| `--champollion-cards-dir` | — | — | 言語カードのディレクトリ |
| `--target-lang-code` | — | — | BCP-47言語コード |

### すべてのサブコマンド

2026年8月1日に`mt_eval_harness/cli.py`に対して生成された、18個のトップレベルサブコマンドすべてです。それまでは、このセクションにはそのうちの7つが記載されており、主権を持つオーガナイザーのスコアリングノードである`node`を含む6つは、**ここにもharnessガイドにも記載されていませんでした**。

**実行とスコアリング**

| サブコマンド | 説明 |
|---|---|
| `mt-eval run` | 翻訳を実行する（フラグは上記参照） |
| `mt-eval test <log>` | 完了した実行ログを分析する |
| `mt-eval compare <logs…>` | 複数の実行ログを比較する |
| `mt-eval dashboard <logs…>` | インタラクティブなHTMLダッシュボードを生成する |
| `mt-eval card <run-card>` | 人間が読みやすい実行カードを整形出力する |

**メソッドを見つける**

| サブコマンド | 説明 |
|---|---|
| `mt-eval recommend <src> <tgt>` | 言語ペアのメソッドガイダンス — 単なるランキングではなく、可用性と**引用されたエビデンス**を提示する |
| `mt-eval corpora --source X --target Y` | ペアで利用可能な評価コーパスを一覧表示する |
| `mt-eval list models\|prompts\|datasets` | 利用可能なリソースを一覧表示する |

**貢献**

| サブコマンド | 説明 |
|---|---|
| `mt-eval publish <report>` | TestReportをリーダーボードに送信する |
| `mt-eval queue` | 自身のキーを使用してコミュニティのコンピュートキューの先頭を実行する — [Contributing Compute](/docs/network/getting-started/contributing-compute) を参照 |
| `mt-eval export` | TestReportをChampollionメソッドプラグインとしてパッケージ化する |
| `mt-eval generate-plugin` | `export` のエイリアス |
| `mt-eval export-config` | TestReportから `champollion.config.json` スニペットを生成する |

**コンテストと独自のコンテストの開催**

| サブコマンド | 説明 |
|---|---|
| `mt-eval contest` | 評価コンテストを管理する — `prepare`、`register`、`create`、`submit`、`submit-hypotheses`、`status`、`list` |
| `mt-eval shared-task` | 複数ペアの共有タスクエディションのアンブレラ: 1つの行でAmericasNLPスタイルのエディションのペアごとのN個のコンテストをグループ化し、そのポリシーのデフォルトを保持する。**グループ化とデフォルトのみ — すべてのゲートはコンテストごとに維持される** |
| `mt-eval node` | **オーガナイザーのスコアリングノード。** 受付のポーリング、公開予選でのゲート、コンテストポリシーごとの承認、**オーガナイザーが保持するシークレットリファレンス**に対するスコアリング、スコアのみの公開を行う。[Run a Sovereign Contest](/docs/network/sovereignty/run-a-sovereign-contest) および [Sovereign Eval Node](/docs/network/sovereignty/sovereign-eval-node) の背後にあるコマンドであり、コーパスがオーガナイザーのマシンから外部に出ることはない。 |

`mt-eval node` には、エアギャップレーン（`import-bundle`、`export-scores`、`relay`、`egress-check`、`manifest`）や、M-of-Nカストディセレモニー（`ceremony`、`seal`、`keygen`、`sign-manifest`、`verify-manifest`、`ledger`）を含む、17個の独自のサブコマンドがあります。`mt-eval node --help` を実行してください。主権のメカニズムについては、上記でリンクされている2つのページで説明されています。

**セットアップ**

| サブコマンド | 説明 |
|---|---|
| `mt-eval setup` | オプションの依存関係（COMETニューラルメトリクス、FSTランタイム）をインストールする |
| `mt-eval logout` | 保存されている認証情報を削除する |

### 使用例

```bash
# Run with defaults (gemini-pro alias → google/gemini-3.1-pro-preview, naive prompt)
mt-eval run --corpus eval-amh-fra-globalvoices-test-v1

# Coached experiment with coaching file
mt-eval run \
  --corpus eval-amh-fra-globalvoices-test-v1 \
  --model google/gemini-3.1-pro \
  --coaching-file prompts/crk-coaching-v8.txt \
  --temperature 0.0

# Run a custom method plugin with FST retries
mt-eval run \
  --corpus eval-amh-fra-globalvoices-test-v1 \
  --method ./methods/fst-gated-pipeline \
  --fst-retries 3
```

---

## ランカードスキーマ

すべての実験は**ランカード**（自己完結型のJSONドキュメント）を生成します。トップレベルの構造：

```json
{
  "run_id": "uuid-v4",
  "harness_version": "2.0",
  "model_slug": "google/gemini-3.1-pro",
  "model_id": "gemini-3.1-pro-001",
  "condition": "baseline",
  "timestamp": "2026-06-01T03:22:41Z",
  "elapsed_seconds": 142.7,
  "dataset": { ... },
  "config": { ... },
  "method_card": { ... },
  "system_prompt_sha256": "abc123...",
  "system_prompt_used": "You are a translator...",
  "fingerprint": { ... },
  "scores": { ... },
  "totals": { ... },
  "environment": { ... },
  "results": [ ... ],
  "run_card_hash": "sha256-of-entire-card"
}
```

すべてのフィールドが記載された完全なスキーマについては、[ランカード仕様](/docs/network/specifications/run-card)を参照してください。

:::info[権威あるスキーマ]
[ベンチマーク仕様](/docs/network/specifications/benchmark)は、ランカードスキーマの唯一の情報源です。メトリクスの定義、複合ウェイト、品質ティアについては、[スコアリング仕様](/docs/network/specifications/scoring)を参照してください。このページではハーネスの使い方を説明しており、出力の意味はスペックで定義されています。
:::

### 主要ブロック

**`dataset`** — 使用されたデータセットを識別します。結果が特定のバージョンに紐付けられるよう、コンテンツハッシュも含まれます：

```json
// Example using textbook_dev.json — the 436-entry textbook dev split
{
  "id": "edtekla-dev-v1",
  "version": "1.0",
  "language_pair": "EN→CRK",
  "sha256": "...",
  "entry_count": 436
}
```

**`scores`** — ランの集計メトリクス：

```json
// Counts reflect the dataset used (here: textbook_dev.json, 436 entries)
{
  "total": 436,
  "exact_matches": 12,
  "exact_match_rate": 0.0968,
  "fst_accepted": 87,
  "fst_acceptance_rate": 0.7016,
  "chrf_plus_plus": 42.31,
  "errors": 0,
  "avg_latency_seconds": 1.15,
  "median_latency_seconds": 1.02,
  "p95_latency_seconds": 2.34,
  "by_difficulty": { ... },
  "by_provenance": { ... }
}
```

**`totals`** — トークン使用量とコストの追跡：

```json
{
  "prompt_tokens": 48200,
  "completion_tokens": 3100,
  "reasoning_tokens": 0,
  "cached_tokens": 12000,
  "total_cost_usd": 0.42,
  "cost_per_entry_usd": 0.0034,
  "reasoning_ratio": 0.0
}
```

---

## 文体・レジスターメトリクス（情報提供のみ） {#writing-style-and-register-metrics-informational}

ハーネスは、`WritingStyleConsistency` メトリクスプラグイン（`mt_eval_harness/plugins/writing_style.py`）を通じて、翻訳がターゲットの**レジスター**と**文体**に一致しているかどうかを評価できます。翻訳は言語的に正確であっても、レジスターが誤っている場合があります。たとえば、法律文書でのくだけた表現や、マーケティングコピーでの堅苦しい定型文などです。文字列メトリクスではこれを検出できませんが、これらのメトリクスは検出できます。

**測定内容（エントリごと）：**

| メトリクス | スケール | 意味 |
|--------|-------|---------|
| `style_register_match` | boolean | 出力が期待されるレジスターと一致しているか？ターゲットはコーパスエントリの `register` フィールド（[ベンチマーク仕様 §2.6](/docs/network/specifications/benchmark)を参照）またはスタイルプロファイルから取得されます |
| `style_sentence_length_ratio` | float | 予測値と参照値の平均文長の比較（1.0 = 一致；乖離 = 文体のドリフト） |
| `style_formality_score` | 0.0–1.0 | 言語ごとのマーカーリソースを使用した、丁寧語・くだけた表現のマーカーの存在（T–V代名詞、短縮形など） |

**集計値：** `style_consistency_rate` — レジスターの不一致が検出されなかったエントリの割合。

カスタムターゲットを有効にするには `--style-profile path/to/profile.json` を使用します（例：ブランドボイスプロファイル）。指定がない場合、プラグインは各コーパスエントリの `register` メタデータ（存在する場合）にフォールバックします。

:::caution[スコープについての注意]
これらのメトリクスは**参考情報のみ**です — 複合スコアには含まれず、フォーマリティ検出はマーカーベース（ヒューリスティック）であり、学習済みの判定ではありません。文体品質の判定としてではなく、レジスター遵守のドリフト検出器として扱ってください。
:::

---

## フィンガープリントとランカードハッシュ {#fingerprint-vs-run-card-hash}

ハーネスは2つの異なるハッシュを生成します。それぞれ異なる目的を持っています：

### フィンガープリント

**フィンガープリント**が答える問い：*「このランは再現可能か？」*

実験設定を定義する入力の組み合わせをハッシュ化します。出力はハッシュ化しません：

- データセットのSHA-256
- モデルスラッグ
- 条件ラベル
- システムプロンプトのSHA-256
- 温度
- ハーネスバージョン

フィンガープリントが同一の2つのランは、同じセットアップを使用しています。その結果は比較可能なはずです（APIの非決定性を除く）。

### ランカードハッシュ

**ランカードハッシュ**が答える問い：*「この特定の結果ファイルは改ざんされていないか？」*

ランカードJSON全体のSHA-256です（`run_card_hash` フィールド自体は除外）。スコア、タイムスタンプ、出力の1文字でも変更されると、ハッシュが壊れます。

:::info[使い分けの目安]
**フィンガープリント**は、比較可能なラン（同じ実験、異なる実行）をグループ化するために使用します。**ランカードハッシュ**は、特定の結果ファイルの整合性を検証するために使用します。
:::

---

## リーダーボードへの公開

ランが完了したら、`mt-eval publish` を使用してランカードを送信します：

```bash
mt-eval publish eval/logs/harness/your-run-card.json
```

ランの実行中に `--method-card` が指定されていない場合、`mt-eval publish` はインタラクティブウィザード（`method_card_wizard.py`）を起動し、メソッドの説明（名前、クラス、使用ツールなど）を順を追って入力できます。ウィザードの出力は送信前にランカードに埋め込まれます。

### 手動での確認

ランカードは出力ディレクトリ（デフォルトは`eval/logs/harness/`）にJSONファイルとして保存されます — 公開前にそちらで内容を確認してください。`mt-eval publish`が提出パスであり、PRベースのランカード受付はありません。

:::note[提出APIとWebアップロードはまだ利用できません]
`POST https://champollion.dev/api/leaderboard/submit`エンドポイントおよびリーダーボードのアップロードUIは計画中ですが、**まだ実装されていません**。これらがリリースされるまで、唯一機能する提出パスは`mt-eval publish`です。
:::

:::warning[リーダーボードの検証]
リーダーボードは、提出されたランカードをデータセットレジストリに対して検証します。未知のデータセットを参照している提出や、`run_card_hash`が壊れている提出は拒否されます。
:::

:::danger[評価データでのトレーニングは禁止です]
開発中に評価データセットを参照したことがある場合 — トレーニングデータ、few-shotの例、辞書エントリ、またはプロンプトエンジニアリングの素材として使用した場合 — その提出は**失格**となります。良い手法と悪い手法の違いについては、[MT評価](/docs/network/leaderboard/rules)を参照してください。
:::

---

## 関連項目

- [MT評価](/docs/network/leaderboard/rules) — 概要、リーダーボードの価値提案、良いメソッドと悪いメソッドのガイダンス
- [評価データセット](/docs/network/leaderboard/datasets) — データセット形式、EDTeKLA、FLORES+
- [ランカード仕様](/docs/network/specifications/run-card) — 完全なJSONスキーマ
- [メソッドの構築](/docs/network/specifications/methods) — 評価可能なメソッドを作成するためのメソッドインターフェース
- [メソッドリーダーボード](https://champollion.dev/leaderboard) — ライブベンチマークスコア
- [ベンチマーク仕様](/docs/network/specifications/benchmark) — 評価プロトコル、コーパス形式、ランカードスキーマ
- [スコアリング仕様](/docs/network/specifications/scoring) — メトリクス、複合ウェイト、品質ティアのSSoT
