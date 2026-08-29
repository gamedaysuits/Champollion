---
sidebar_position: 4
title: "Run Card 仕様"
---

# ランカード仕様

> **概要。** ランカードはベンチマークの最小単位であり、1回の評価実行の完全な設定・エントリーごとの結果・集計スコアを記録したJSONドキュメントです。このページではスキーマ、フィールド、フィンガープリントの仕組み、およびスコア構造について説明します。正規の定義については[ベンチマーク仕様](/docs/network/specifications/benchmark)を参照してください。

ランカードは1回の評価実行の完全な記録です。実験を理解・再現・検証するために必要なすべての情報（設定、スコア、個別結果、トークン使用量、環境メタデータ）が含まれています。

**スキーマバージョン:** 2.0

:::info[権威あるスキーマ]
[ベンチマーク仕様](/docs/network/specifications/benchmark)は、ランカードスキーマの唯一の情報源です。メトリクスの定義、複合ウェイト、品質ティアについては、[スコアリング仕様](/docs/network/specifications/scoring)を参照してください。このページでは現在の実装について説明します。
:::

---

## トップレベルフィールド

| フィールド | 型 | 説明 |
|-------|------|-------------|
| `run_id` | `string` | 実行開始時に生成されるUUID v4 |
| `harness_version` | `string` | このカードを生成したハーネスのセマンティックバージョン（例：`2.0`） |
| `model_slug` | `string` | 実行に使用したモデルスラッグ（例：`google/gemini-3.1-pro`） |
| `model_id` | `string` | APIが返す解決済みモデル識別子（例：`gemini-3.1-pro-001`） |
| `condition` | `string` | 実験ラベル（例：`baseline`、`coached-v3`、`few-shot`） |
| `timestamp` | `string` | 実行開始時のISO 8601 UTCタイムスタンプ |
| `elapsed_seconds` | `number` | 実行全体の実経過時間 |

```json
{
  "run_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "harness_version": "2.0",
  "model_slug": "google/gemini-3.1-pro",
  "model_id": "gemini-3.1-pro-001",
  "condition": "baseline",
  "timestamp": "2026-06-01T03:22:41Z",
  "elapsed_seconds": 142.7
}
```

---

## `dataset`

評価データセットを識別し、SHA-256によって特定のコンテンツバージョンに固定します。

| フィールド | 型 | 説明 |
|-------|------|-------------|
| `id` | `string` | データセット識別子（例：`edtekla-dev-v1`） |
| `version` | `string` | データセットのバージョン文字列 |
| `language_pair` | `string` | 表示ラベル（例：`EN→CRK`） |
| `sha256` | `string` | データセットファイルの内容のSHA-256ハッシュ。使用した正確なデータを保証します |
| `entry_count` | `number` | データセット内のエントリー数 |

```json
// Example using textbook_dev.json — the 436-entry textbook dev split
{
  "dataset": {
    "id": "edtekla-dev-v1",
    "version": "1.0",
    "language_pair": "EN→CRK",
    "sha256": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    "entry_count": 436
  }
}
```

---

## `config`

この実行に使用したAPIおよびバッチ処理の設定です。

| フィールド | 型 | 説明 |
|-------|------|-------------|
| `api_provider` | `string` | APIプロバイダー名（例：`openrouter`） |
| `temperature` | `number` | サンプリング温度 |
| `max_tokens` | `number` | 補完ごとの最大トークン数 |
| `batch_size` | `number` | 同時バッチあたりのエントリー数 |
| `concurrency` | `number` | 最大並列APIリクエスト数 |
| `coaching_file` | `string` | コーチングプロンプトファイルへのパス（使用する場合） |
| `method_path` | `string` | メソッドプラグインディレクトリへのパス（使用する場合） |
| `fst_retries` | `number` | FSTリトライ試行回数 |

```json
{
  "config": {
    "api_provider": "openrouter",
    "temperature": 0.0,
    "max_tokens": 32768,
    "batch_size": 25,
    "concurrency": 8
  }
}
```

:::info[公開されたランカードには `method_config` が含まれます]
ランカードが `mt-eval publish` 経由で公開されると、`publish.py` は正規の8フィールド MethodConfig を含む `method_config` ブロックを挿入します。これにより、摩擦ゼロのリーダーボードインストールが可能になります。公開されたカードから誰でも直接メソッドを再現できます。

```json
{
  "method_config": {
    "model": "gemini-pro",
    "temperature": 0.0,
    "batchSize": 25,
    "register": "Formal Plains Cree. Use SRO orthography.",
    "coachingFile": "prompts/crk-coaching-v8.txt",
    "coachingPrompt": null,
    "promptContext": "champollion",
    "qualityTier": "verified"
  }
}
```

すべてのフィールドは**camelCase**を使用し、正規のMethodConfigスキーマに従います（[メソッドの構築](/docs/network/specifications/methods)を参照）。
:::

---

## `system_prompt_sha256` / `system_prompt_used`

| フィールド | 型 | 説明 |
|-------|------|-------------|
| `system_prompt_sha256` | `string` | システムプロンプトのSHA-256ハッシュ。フィンガープリントに含まれます |
| `system_prompt_used` | `string` | モデルに送信したシステムプロンプトの全文 |

プロンプトハッシュは[フィンガープリント](#fingerprint)の一部です。他のすべての設定が同じであっても、プロンプトが異なる2つの実行は異なるフィンガープリントを持ちます。

---

## `fingerprint`

再現性の識別子です。フィンガープリントが同一の2つの実行は、同じ実験設定を使用しています。

| フィールド | 型 | 説明 |
|-------|------|-------------|
| `hash` | `string` | ソートされたコンポーネントのSHA-256ハッシュ |
| `components` | `object` | ハッシュ化された入力値 |

### フィンガープリントのコンポーネント

| コンポーネント | 説明 |
|-----------|-------------|
| `dataset_sha256` | データセットファイルのハッシュ |
| `model_slug` | 使用したモデル |
| `condition` | 実験条件ラベル |
| `system_prompt_sha256` | システムプロンプトのハッシュ |
| `temperature` | サンプリング温度 |
| `harness_version` | ハーネスバージョン |

```json
{
  "fingerprint": {
    "hash": "7f83b1657ff1fc53b92dc18148a1d65dfc2d4b1fa3d677284addd200126d9069",
    "components": {
      "dataset_sha256": "e3b0c44298fc1c14...",
      "model_slug": "google/gemini-3.1-pro",
      "condition": "baseline",
      "system_prompt_sha256": "abc123...",
      "temperature": 0.0,
      "harness_version": "2.0"
    }
  }
}
```

:::info[フィンガープリント ≠ ランカードハッシュ]
フィンガープリントは*実験の設定*を識別します。`run_card_hash` は*結果ファイルの整合性*を検証します。詳細については、[フィンガープリントとランカードハッシュの違い](/docs/network/specifications/harness#fingerprint-vs-run-card-hash)を参照してください。
:::

---

## `scores`

実行全体の集計メトリクスです。

### トップレベルスコア

| フィールド | 型 | 説明 |
|-------|------|-------------|
| `total` | `number` | 評価したエントリーの総数 |
| `exact_matches` | `number` | 出力がゴールドスタンダードと完全一致したエントリー数 |
| `exact_match_rate` | `number` | `exact_matches / total`（0.0〜1.0） |
| `fst_accepted` | `number` | FSTアナライザーが出力を受理したエントリー数 |
| `fst_acceptance_rate` | `number` | `fst_accepted / total`（0.0〜1.0）。FSTアナライザーが使用されていない場合は`null` |
| `chrf_plus_plus` | `number` | コーパスレベルのchrF++スコア（0〜100） |
| `errors` | `number` | 失敗したエントリー数（APIエラー、タイムアウトなど） |
| `avg_latency_seconds` | `number` | 全エントリーの平均応答時間 |
| `median_latency_seconds` | `number` | 応答時間の中央値 |
| `p95_latency_seconds` | `number` | 応答時間の第95パーセンタイル |

### `by_difficulty`

難易度ティア別のスコアです。各キー（整数1〜5）はトップレベルスコアと同じメトリクスフィールドを含みます。

```json
{
  "by_difficulty": {
    "1": {
      "total": 20,
      "exact_matches": 8,
      "exact_match_rate": 0.40,
      "chrf_plus_plus": 68.2,
      "fst_accepted": 18,
      "fst_acceptance_rate": 0.90
    },
    "2": { ... },
    "3": { ... },
    "4": { ... },
    "5": { ... }
  }
}
```

### `by_provenance`

エントリーの出典別のスコアです。各キー（例：`gold_standard`、`textbook`）は同じメトリクスフィールドを含みます。

```json
{
  "by_provenance": {
    "gold_standard": {
      "total": 80,
      "exact_matches": 10,
      "exact_match_rate": 0.125,
      "chrf_plus_plus": 44.8
    },
    "textbook": { ... }
  }
}
```

---

## `totals`

実行全体のトークン使用量とコストの追跡情報です。

| フィールド | 型 | 説明 |
|-------|------|-------------|
| `prompt_tokens` | `number` | 全APIコールの入力トークン合計 |
| `completion_tokens` | `number` | 出力トークンの合計 |
| `reasoning_tokens` | `number` | 思考連鎖推論に使用したトークン数（モデル依存、ほとんどのモデルでは0） |
| `cached_tokens` | `number` | プロバイダーのプロンプトキャッシュから提供されたトークン数 |
| `total_cost_usd` | `number` | 総コスト（USD、APIが報告する値） |
| `cost_per_entry_usd` | `number` | `total_cost_usd / entry_count` |
| `reasoning_ratio` | `number` | `reasoning_tokens / completion_tokens`（0.0〜1.0） |

```json
{
  "totals": {
    "prompt_tokens": 48200,
    "completion_tokens": 3100,
    "reasoning_tokens": 0,
    "cached_tokens": 12000,
    "total_cost_usd": 0.42,
    "cost_per_entry_usd": 0.0034,
    "reasoning_ratio": 0.0
  }
}
```

---

## `environment`

再現性のためのランタイム環境メタデータです。

| フィールド | 型 | 説明 |
|-------|------|-------------|
| `harness_version` | `string` | ハーネスバージョン（トップレベルの`harness_version`と同じ値） |
| `harness_git_commit` | `string` | 実行時のハーネスのGitコミットSHA |
| `python_version` | `string` | Pythonインタープリターのバージョン |
| `sacrebleu_version` | `string` | sacrebleuライブラリのバージョン（chrF++スコアリングに使用） |
| `os` | `string` | オペレーティングシステムの識別子 |

```json
{
  "environment": {
    "harness_version": "2.0",
    "harness_git_commit": "a1b2c3d",
    "python_version": "3.11.9",
    "sacrebleu_version": "2.4.0",
    "os": "macOS-14.5-arm64"
  }
}
```

---

## `results[]`

エントリーごとの結果配列です。データセットのエントリーごとに1つのオブジェクトがインデックス順に格納されます。

| フィールド | 型 | 説明 |
|-------|------|-------------|
| `entry_id` | `integer` | コーパス内のこのエントリーのID（`entries[].id`と一致） |
| `source` | `string` | 翻訳されたソーステキスト |
| `reference` | `string` | コーパスのゴールドスタンダード参照訳 |
| `predicted` | `string` | メソッドの実際の出力 |
| `exact_match` | `boolean` | 正規化後に`predicted`が`reference`と完全一致するかどうか |
| `entry_chrf` | `number` | このエントリーの文レベルchrF++スコア（0〜100） |
| `fst_accepted` | `boolean \| null` | FSTアナライザーが出力を受理したかどうか。アナライザーが設定されていない場合は`null` |
| `fst_analysis` | `string[]` | 出力のFST解析文字列（未解析または拒否された場合は空配列） |
| `difficulty` | `integer` | コーパスの難易度ティア（1〜5） |
| `provenance` | `string` | コーパスの出典タグ |
| `latency_seconds` | `number` | このエントリーの応答時間 |
| `usage` | `object` | エントリーごとのトークン使用量：`{ prompt_tokens, completion_tokens, reasoning_tokens }` |
| `error` | `string \| null` | このエントリーが失敗した場合のエラーメッセージ。成功時は`null` |

```json
{
  "results": [
    {
      "entry_id": 1,
      "source": "Hello",
      "reference": "tânisi",
      "predicted": "tânisi",
      "exact_match": true,
      "entry_chrf": 100.0,
      "fst_accepted": true,
      "fst_analysis": ["tânisi+V+AI+Ind+2Sg"],
      "difficulty": 1,
      "provenance": "gold_standard",
      "latency_seconds": 0.82,
      "usage": {
        "prompt_tokens": 385,
        "completion_tokens": 12,
        "reasoning_tokens": 0
      },
      "error": null
    }
  ]
}
```

---

## `run_card_hash`

| フィールド | 型 | 説明 |
|-------|------|-------------|
| `run_card_hash` | `string` | ランカードJSON全体のSHA-256ハッシュ。ハッシュ計算中は`run_card_hash`フィールド自体を`""`に設定します |

これは改ざん検知のシールです。リーダーボードは提出時にこのハッシュを再計算し、一致しないカードは拒否します。

**ハッシュの計算方法：**

1. `run_card_hash`を`""`に設定した状態でランカードをJSONにシリアライズする
2. シリアライズされた文字列のSHA-256を計算する
3. `run_card_hash`に得られた16進ダイジェストを設定する

```python
import hashlib, json

card["run_card_hash"] = ""
card_json = json.dumps(card, sort_keys=True, ensure_ascii=False)
card["run_card_hash"] = hashlib.sha256(card_json.encode()).hexdigest()
```

:::info[エントリーごとのドリルダウン]
公開されたランカードは、リーダーボード上のドリルダウン分析用にエントリーごとの結果を保存する `run_card_entries` Supabase テーブルにも反映されます。このテーブルは `mt-eval publish` の実行中に自動的に入力されます。
:::

---

## 関連情報

- [MT評価](/docs/network/leaderboard/rules) — 概要、リーダーボードの価値、良いメソッド・悪いメソッドのガイダンス
- [Evalハーネス](/docs/network/specifications/harness) — 評価の実行とランカードの生成方法
- [評価データセット](/docs/network/leaderboard/datasets) — データセット形式、EDTeKLA、FLORES+
- [メソッドの構築](/docs/network/specifications/methods) — メソッドインターフェースとメソッドカード仕様
- [メソッドリーダーボード](https://champollion.dev/leaderboard) — ライブベンチマークスコア
- [ベンチマーク仕様](/docs/network/specifications/benchmark) — 評価プロトコル、コーパス形式、ランカードスキーマ
- [スコアリング仕様](/docs/network/specifications/scoring) — メトリクス、複合ウェイト、品質ティアの唯一の情報源
