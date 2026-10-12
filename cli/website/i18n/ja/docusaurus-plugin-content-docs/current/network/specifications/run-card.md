---
sidebar_position: 4
title: "Run Card 仕様"
---

# ランカード仕様

> **概要。** ランカードはベンチマークの最小単位であり、1回の評価実行の完全な設定・エントリーごとの結果・集計スコアを記録したJSONドキュメントです。このページではスキーマ、フィールド、フィンガープリントの仕組み、およびスコア構造について説明します。正規の定義については[ベンチマーク仕様](/docs/network/specifications/benchmark)を参照してください。

ランカードは1回の評価実行の完全な記録です。実験を理解・再現・検証するために必要なすべての情報（設定、スコア、個別結果、トークン使用量、環境メタデータ）が含まれています。

**スキーマバージョン:** 2.0

:::info[正式なスキーマ]
ランカードスキーマの信頼できる唯一の情報源（SSOT）は[ベンチマーク仕様](/docs/network/specifications/benchmark)です。指標の定義や実行のスコアリング方法（chrF++ ヘッドライン指標、その横の標準指標、診断指標）については、[スコアリング仕様](/docs/network/specifications/scoring)を参照してください。このページでは現在の実装について説明します。
:::

---

## トップレベルフィールド

| フィールド | 型 | 説明 |
|-------|------|-------------|
| `run_id` | `string` | 実行開始時に生成される UUID v4 |
| `harness_version` | `string` | このカードを生成したハーネスのセマンティックバージョン（例: `2.0`） |
| `model_slug` | `string` | 実行に使用されたモデルスラッグ（例: `google/gemini-3.1-pro-preview`） |
| `model_id` | `string` | API から返された解決済みモデル識別子（例: `gemini-3.1-pro-001`） |
| `condition` | `string` | 実験ラベル: ハーネスが書き込む内容は `naive`（組み込みプロンプト）、`coached`（コーチングファイルに置き換えられた場合）、またはメソッドプラグインの場合はそのメソッドクラスです。自由形式のテキストであるため、手動作成されたカードでは `coached-v3` や `few-shot` となる場合もあります。品質ラベルではありません（品質ティアは廃止され、新しいカードではすべて `scores.quality_tier` が null になります） |
| `timestamp` | `string` | 実行が開始された日時の ISO 8601 UTC タイムスタンプ |
| `elapsed_seconds` | `number` | 実行全体の総所要時間（実時間） |

```json
{
  "run_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "harness_version": "2.0",
  "model_slug": "google/gemini-3.1-pro-preview",
  "model_id": "gemini-3.1-pro-001",
  "condition": "naive",
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
| `api_provider` | `string` | テキストを伝送したもの: ハーネス独自の LLM パスにおける API プロバイダー（`openrouter`、`openai`、`anthropic`、`gemini`、`local`）、MT エンジンのエンジン ID（例: `google-translate`）、メソッドプラグインの場合はオペレーターが完全ローカルなトランスポートを証明した場合は `local`（`--attest-local-transport`）、それ以外は `method-plugin` |
| `temperature` | `number` | サンプリング温度 |
| `max_tokens` | `number` | 補完あたりの最大トークン数 |
| `batch_size` | `number` | 同時バッチあたりのエントリ数 |
| `concurrency` | `number` | 最大並行 API リクエスト数 |
| `coaching_file` | `string` | コーチングプロンプトファイルが使用された場合のパス（実行ログ自体の記録。公開カードではコーチングをファイル名で指定するか、`--coaching` テキストの場合は `inline coaching` とし、ローカルパスは決して含めません） |
| `method_path` | `string` | メソッドプラグインディレクトリが使用された場合のパス |
| `fst_retries` | `number` | FST 再試行回数 |

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
    "model": "google/gemini-3.1-pro-preview",
    "temperature": 0.0,
    "batchSize": 25,
    "register": "Formal Plains Cree. Use SRO orthography.",
    "coachingFile": "prompts/crk-coaching-v8.txt",
    "coachingPrompt": null,
    "promptContext": "champollion",
    "qualityTier": null
  }
}
```

品質ティアは廃止されたため、新しいカードでは `qualityTier` は常に `null` になります。すべてのフィールドは **camelCase** を使用し、正規の MethodConfig スキーマに従います（[メソッドの構築](/docs/network/specifications/methods)を参照）。
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

正規の一覧は[ベンチマーク仕様 §3.8](/docs/network/specifications/benchmark#38-fingerprint)にあります。要約すると以下の通りです:

| 構成要素 | 説明 |
|-----------|-------------|
| `dataset_sha256` | データセットファイルのハッシュ |
| `model_slug` | 使用されたモデル（MT エンジンまたはメソッドプラグインの場合は、エンジン ID またはメソッド ID） |
| `condition` | 実験条件ラベル |
| `system_prompt_sha256` | システムプロンプトのハッシュ |
| `temperature` | サンプリング温度 |
| `batch_size`、`tools_enabled` | バッチ処理およびツール使用 |
| `harness_version` | ハーネスのバージョン |
| `api_provider`、`endpoint_host_sha256`、`max_tokens`、`method_version`、`method_sha256` | バージョン 2（ハーネス 0.2.0 以降）: チャネル、エンドポイントホスト（ハッシュ化済み）、トークン制限、メソッドのバージョンおよびコードハッシュ |
| `method_model`、`method_dependencies_sha256` | バージョン 2、メソッドプラグイン実行のみ: プラグインに渡されたモデル（`-m`）および宣言された `dependencies` のハッシュ |
| `method_model`、`method_model_sha256` | バージョン 2、`--method local-model` 実行のみ: ロードされたモデル（Hugging Face ID またはディレクトリ名）とそのコンテンツハッシュ（ディレクトリの場合）またはリビジョン（Hugging Face ID の場合） |

`fingerprint.version` は、カードがどのリストに基づいてハッシュ化されたかを示します。

### `engine_model`

指定されたモデルを実行する MT エンジンの実行（`--method local-model -m <model>`）には、ロードされたモデルの情報が含まれます:

| フィールド | 説明 |
|-------|-------------|
| `given` | `-m` が示した内容 |
| `kind` | `directory` または `hub`（Hugging Face ID） |
| `id` | Hugging Face ID、またはディレクトリ名（ローカルパスは不可） |
| `sha256` | ディレクトリのみ: ファイルの `sha256sum` 形式のリストに対する SHA-256 |
| `revision` | Hugging Face ID のみ: ロードされたリビジョン |
| `family`、`backend` | `opus`、`nllb`、または `madlad`。`transformers` または `ctranslate2` |
| `decode` | 出力の最大可能長: モデルが宣言した長さ、またはハーネスのルール（`max(64, 4 × source tokens)` 新規トークン、デコーダーの位置数で上限設定） |
| `pair_mismatch` | 別のペア用の OPUS-MT ペアモデルを意図的に実行した場合にのみ存在（`--allow-model-pair-mismatch`） |

`method_config.model` は同じモデルを指定します（`<id>@<revision>` または `<directory name>@sha256:<hash>`）。モデルが記録されていない `local-model` の実行ログは何も公開されません。カードには `engine_model_unrecorded` と表示され、`mt-eval publish` はこれを拒否します。

### `method_plugin`

メソッドプラグインの実行（`--method <plugin dir>`）には、ランナーによって記録されたプラグインの識別情報も含まれます:

| フィールド | 説明 |
|-------|-------------|
| `version` | `method.json` が宣言するバージョン（宣言がない場合は `null`） |
| `code_sha256` | プラグインのファイル（`method.json` およびその `.py` ファイル、`sha256sum` 形式のマニフェスト）に対する SHA-256 |
| `model_given` | `-m/--model` でプラグインに渡されたモデル、または `null` |
| `models_called`、`models_basis` | プラグインが呼び出しを報告したモデル、およびそれが結果から観測されたものか宣言されたものか |
| `dependency_class` | `method.json` が宣言する依存関係クラス |
| `dependencies` | `method.json` が宣言する `dependencies` リスト（自由形式テキストの `notes` を除く） |
| `dependencies_sha256` | 宣言された完全なリストの SHA-256（フィンガープリント構成要素） |

```json
{
  "fingerprint": {
    "hash": "7f83b1657ff1fc53b92dc18148a1d65dfc2d4b1fa3d677284addd200126d9069",
    "components": {
      "dataset_sha256": "e3b0c44298fc1c14...",
      "model_slug": "google/gemini-3.1-pro-preview",
      "condition": "naive",
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
| `total` | `number` | 評価された総エントリ数 |
| `exact_matches` | `number` | 出力がゴールドスタンダードと完全に一致したエントリ数 |
| `exact_match_rate` | `number` | `exact_matches / total`（0.0–1.0） |
| `fst_accepted` | `number` | FST アナライザーによって承認された出力**単語**の全エントリ合計（エントリ数ではありません）。FST アナライザーが使用されなかった場合は `null` |
| `fst_acceptance_rate` | `number` | エントリごとの承認率（各エントリの承認単語数 ÷ 単語数。空の出力は 0 としてカウント）の平均値（0.0–1.0）。これは `fst_accepted` ÷ 全単語数では**ありません**（そのプールされた単語率はレポートの `corpus_validity_rate` であり、ランカード上では「Words accepted」として表示されます）。FST アナライザーが使用されなかった場合は `null` |
| `chrf_plus_plus` | `number` | **ヘッドラインおよびランキング指標:** コーパスレベルの chrF++（sacreBLEU chrF、`word_order=2`）、0–100。その 95% ブートストラップ信頼区間は `confidence_intervals.corpus_chrf`、シグネチャは `sacrebleu_signatures.chrf` |
| `scoring_standard` | `string` | 新しいカードではすべて `"standard/1"`。これを含まないカードは廃止された複合指標（`legacy-composite`）でスコアリングされており、その方法で検証されます |
| `primary_metric` | `string` | `"chrf_plus_plus"` |
| `spbleu`、`ter` | `number` | chrF++ と並んで表示される標準指標（ブレンドされることはありません。BLEU はカードのトップレベルの `corpus_bleu`、COMET は計算された場合の `comet_model` を伴う `comet_score`） |
| `sacrebleu_signatures` | `object` | 計算された各 sacreBLEU 指標の sacreBLEU シグネチャ: `chrf`（ヘッドライン）、`chrf_plain`、`bleu`、`spbleu`、`ter` |
| `confidence_intervals` | `object` | 95% ブートストラップ区間。`corpus_chrf` はヘッドラインの区間 |
| `composite`、`quality_tier`、`cost_adjusted` | `null` | **廃止済み。** 新しいカードでは常に `null`。レガシーカードは保存された値を保持します。現在も複合スコアを表示しているインターフェースでは、「legacy composite (retired)」とラベル付けされます |
| `errors` | `number` | 失敗したエントリ（API エラー、タイムアウトなど） |
| `avg_latency_seconds` | `number` | 全エントリの平均応答時間 |
| `median_latency_seconds` | `number` | 応答時間の中央値 |
| `p95_latency_seconds` | `number` | 応答時間の 95 パーセンタイル |

### `by_difficulty`

難易度ティアごとに分類されたスコア（キーは `"1"`–`"5"`、未評価は `"0"`）。これらのフィールドはトップレベルのものとは**異なります**。`avg_chrf` と `avg_bleu` は、そのティアのエントリ全体における**文ごとの平均（mean of per-sentence）** chrF++ および BLEU であるのに対し、トップレベルの `chrf_plus_plus` と BLEU は**コーパスレベル**（すべてのセグメントを一度にまとめて計算）です。この 2 つは異なる統計量です。特にコーパス BLEU は通常、文 BLEU の平均よりも大幅に低くなるため、ティア値 10.2 の横にヘッドライン 0.5 が並んでいても矛盾ではありません。ティア同士を比較し、決してヘッドラインと比較しないでください。

```json
{
  "by_difficulty": {
    "1": {
      "name": "difficulty_1",
      "count": 20,
      "exact_match_count": 8,
      "miss_count": 12,
      "error_count": 0,
      "avg_chrf": 68.2,
      "avg_bleu": 31.5,
      "avg_latency_s": 0.84,
      "total_cost_usd": 0.0021,
      "plugin_aggregates": {}
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

## `score_caveats`

スコアの意味が何らかの要因で制約される場合にのみ存在します。スコアが
正しく計算されていても、ラベルが示す内容を測定できていない可能性があるため、
その但し書きはスコア値とともに扱われます。`mt-eval test`、`mt-eval card`、
`mt-eval compare`、ダッシュボード、および `mt-eval publish` プレビューではヘッドラインの横にこれが表示され、
リーダーボードで表示するために `publish` がここに保存します。
これがスコアを変更することはありません。chrF++ ヘッドラインは通常通り計算され、
注意事項（caveat）はそのスコアや並列する診断指標を制約する要因を明記します。

| フィールド | 型 | 説明 |
|-------|------|-------------|
| `kind` | `string` | `train_test_near_twin`、`length_inflation`、`length_deflation`、`source_copy`、または `near_constant_output` |
| `source` | `string` | 測定元: `nmt-forge` または `mt-eval-harness` |
| `severity` | `string` | `major`（これを考慮してヘッドラインを解釈する）または `minor` |
| `message` | `string` | 1文、最大 480 文字 |

**`train_test_near_twin`**（nmt-forge によって書き込まれます）。`nmt-forge export`（または
`evaluate`）がモデルをスコアリングする際、テストデータの各行についてトレーニングデータ内にほぼ同一のペア（twin）が存在するかチェックし、
出力する mt-eval ファイルにその結果を記録します。
ハーネスはその数値をカードにコピーします。`n` 件のテスト行中 `near_twin_rows` 件に twin が存在し（`near_twin_share`）、`strict_n` 件には存在しません。
twin のない行が十分にある場合、`strict_corpus_chrf` と `strict_corpus_chrf_ci`
はその行のみに対する chrF++（汎化性能を示す数値）を提供します。
行の半数以上に twin がある場合、`recall_not_translation` は `true` になります。
この場合、chrF++ が 100 であっても、それはモデルの翻訳能力ではなく、トレーニングフレーズをどれだけ記憶しているかを測定しているにすぎません。forge のチェックが実行されなかった場合、
caveat は `minor` となり、その旨が表示されます。twin が見つからなかったチェックでは caveat は追加されません。

**`length_inflation`**（ハーネスによって測定されます）。出力の平均が
参照テキストの長さの 2 倍を超える場合（[`length_ratio`](/docs/network/specifications/scoring) の膨張境界値）、
またはスコアリングされたエントリの少なくとも 4 分の 1 がこれを超える場合に追加されます。
リークしたフューショットの例、注記、または繰り返されるテキストが出力を膨張させ、
参照ベースのスコアは結果としてそれを測定することになります。
フィールドは `mean_length_ratio`、`scored_entries` 中の `inflated_entries`、
`ratio_bound`、および `share_bound` です。

**`length_deflation`**（ハーネスによって測定されます）。これは
`length_inflation` の対極であり、出力が参照テキストよりもはるかに**短く**、
単語が脱落している状態です。出力の平均が参照テキストの長さの 0.5 倍未満である場合
（[`length_ratio`](/docs/network/specifications/scoring) の切り捨て境界値）、
またはスコアリングされたエントリの少なくとも 4 分の 1 がこれに該当する場合に追加されます。
一部の診断指標（FST 承認率やコードスイッチングなど）は、出力に含まれる単語のみを評価します。
翻訳できない部分を脱落させるシステムでは、これらの数値が見かけ上高くなります。
実行結果にこれらの指標が含まれる場合、caveat は `major` となり、
すべてを翻訳する実行結果と並べて品質指標として解釈しないよう警告します。
chrF++ ヘッドラインは再現率に重み付けするため、欠落した単語もカウントされます。
いずれの指標も存在しない場合（chrF++ と完全一致のみ）、これは `minor` の注記となります。フィールドは
`mean_length_ratio`、`scored_entries` 中の `short_entries`、`ratio_bound`、
`share_bound`、および `emitted_only_metrics` です。

**`source_copy`**（ハーネスによって測定されます）。スコアリングされた出力の
半数以上がソーステキストのコピーである場合（大文字小文字、アクセント、句読点は無視）
に追加されます。人名など、参照テキストがソース自体と同じである行は
除外されます。参照テキストと比較しない指標であっても、コピーされた単語を
評価対象としてカウントしてしまう場合があります。フィールドは `considered_entries` 中の `copies`、`copy_share`、
および `share_bound` です。

**`near_constant_output`**（ハーネスによって測定されます）。多数の*異なる*入力に対して
同一の出力が返されたケースです。出力とソースは、大文字小文字、
句読点、スペースを無視して比較されます。発音区別符号は単語を区別するためカウントされます。
少なくとも 3 つの異なるソースに対して同じ出力が得られた場合（1〜2 語の短い出力の場合は正当に重複することがあるため 5 つ）、
その出力はソース間重複（cross-source repeat）とみなされます。出力が自身の参照テキストと等しい場合は
正しい回答であるためカウントされません。この caveat は、重複が異なるソースの少なくとも 4 分の 1、かつ
最低 5 件に及ぶ場合に追加されます。これは常に `major` です。
参照なしに出力を判定する指標（FST 承認率、コードスイッチング）が実行に含まれている場合、
メッセージにその指標名が示されます。そのような指標は、有効な文が出現するたびにそれを評価してしまうためです。
フィールドは `considered_sources` 中の `repeated_sources`、`repeat_share`、
`repeated_outputs`、`top_output_sources`、および `top_output_words`（最も多く
繰り返された出力: それを受け取ったソースの数とその長さ）、`share_bound`、
`min_repeats`、`min_sources`、`min_sources_short`、および `emitted_only_metrics` です。
これらはカウントのみであり、caveat に出力のテキストそのものが含まれることはありません。

```json
"score_caveats": [
  {
    "kind": "train_test_near_twin",
    "source": "nmt-forge",
    "severity": "major",
    "checked": true,
    "recall_not_translation": true,
    "near_twin_rows": 150,
    "n": 150,
    "near_twin_share": 1.0,
    "strict_n": 0,
    "message": "all 150 test rows have a near-identical twin in the training data — there is no clean subset to score: this score measures recall of training phrases, not translation"
  }
]
```

このフィールドは保存されたランカード JSON 内に配置されるため、データベースの
カラムは不要です。[フィンガープリント](#fingerprint)の一部ではありません。
実験内容ではなく、結果を記述するものであるためです。

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

## 関連項目

- [MT 評価](/docs/network/leaderboard/rules) — 概要、リーダーボードの価値、メソッドの良し悪しに関するガイダンス
- [評価ハーネス](/docs/network/specifications/harness) — 評価の実行方法とランカードの生成
- [評価データセット](/docs/network/leaderboard/datasets) — データセット形式、EDTeKLA、FLORES+
- [メソッドの構築](/docs/network/specifications/methods) — メソッドインターフェースとメソッドカード仕様
- [メソッドリーダーボード](https://champollion.dev/leaderboard) — ライブベンチマークスコア
- [ベンチマーク仕様](/docs/network/specifications/benchmark) — 評価プロトコル、コーパス形式、ランカードスキーマ
- [スコアリング仕様](/docs/network/specifications/scoring) — 指標と実行スコアリングに関する SSOT
