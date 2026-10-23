---
title: "メソッドとゲート"
slug: /agents/methods
description: "すべての Champollion ツールが読み取る method/1 と gate-chain/1、具体例としての FST 妥当性ゲート、そしてデフォルトの学習済みモデルを超えた各種メソッドレシピ（コーチ付き LLM、Few-shot、辞書拡張、ルールベースハイブリッド、連鎖型、部分翻訳、ファインチューニング）について、それぞれが何をどこに送信するかを解説します。"
---

# メソッドとゲート

**メソッド**とは、翻訳を行うすべてのものを指します。訓練済みモデル、プロンプトを与えられたLLM、辞書引き、ルールエンジン、サービス、人間などです。**ゲート**とは、メソッドの出力と実際に提供されるものとの間で行われるチェックです。レールのデフォルトのメソッドは、nmt-forgeで訓練されたモデルです（[訓練](/docs/agents/training)）。このページでは、双方が記述されるフォーマットと、その他のレシピについて説明します。

以下のすべてのレシピは[送信ルール](/docs/agents/data-rules)に従います。**モデルプロバイダーを呼び出すメソッドはそのプロバイダーにテキストを送信し**、ローカル限定、封印済み、または同意が必要なファイルはそれを拒否します。

## method/1

`$schema` `https://champollion.dev/schemas/method/1.json`。必須項目: `id`（ハイフンで繋がれた小文字の単語）、`name`、`kind` — さらにその種類が必要とする1つの設定で、両方のランタイムにおいて同じメッセージでリーダーによって検証されます。

| `kind` | 必須の設定 | 実行環境 | テキストの送信先 |
|---|---|---|---|
| `llm` | `model`（完全一致のID、エイリアス不可）。オプション: `provider` | CLI、`-m`および`--provider`経由のハーネス | プロバイダー |
| `llm-coached` | `model`。コーチングは`coaching`に指定（`file`、`prompt`、または`dir`） | CLI、`-m`および`--coaching-file`経由のハーネス | プロバイダー: 文とコーチング |
| `mt-api` | `engine`（`shared/method-registry.json`より） | CLI、ハーネス | エンジンのサービス |
| `local-model` | `model`（Hugging FaceのIDまたはローカルフォルダー） | ハーネス、インプロセス | どこにも送信しない |
| `nmt-checkpoint` | `model_dir` | そのサービス経由（`nmt-forge serve`） | このコンピューターのサーバー |
| `lexicon` | `dictionary` | ハーネス、インプロセス | どこにも送信しない |
| `python` | `entry_point`（`module:Class`） | ハーネス（`mt-eval run --method <folder>`） | プラグインが送信する任意の宛先（`dependency_class`） |
| `service` | `service.endpoint` | CLI（`api`メソッド） | そのエンドポイント |
| `human` | — | 人間。出力の評価には`mt-eval test`を使用 | — |

オプション: `version`、`description`、`author`、`pairs`（`{source?, target}`）、`decode`（`temperature` 0〜2、`batch_size`、`max_tokens`）、`card`（リーダーボードに表示される内容）、`dependency_class`（`S`: 自己完結、`O`: オープンな外部、`A1`/`A2`: API依存、`X`: クローズド）、`evidence`（測定された実行: `dataset`、`metric`、`score`、`ci`、`n` — 数値のみ）、`runtimes`（`cli`、`engine`）。

**method.jsonの生成元:** プロジェクト内の`methods/<id>/method.json`、`nmt-forge export`（種類: `nmt-checkpoint`）、`mt-eval export --report <report> --name <name> --type <type> --locales <code>`; `champollion serve --emit-manifest` (kind `service`。古い形式（`type`を持つCLIプラグインマニフェスト、`entry_point`を持つハーネスプラグインマニフェスト）も警告付きでmethod/0として引き続き読み込まれます。`$schema`を含むドキュメントはmethod/1として読み込まれ、検証に合格する必要があります。

**どのランタイムがどの種類を受け入れるか。** CLIは`python`、`lexicon`、`local-model`、`human`を拒否します（*「evalエンジン（mt-eval run --method）で実行されます。champollion CLIでは実行されません。またはサービスとして提供し、そのエンドポイント経由で使用してください」*）。ハーネスの`--method <folder>`は`python`のみを読み込みます。他の種類については、代わりにそれを実行するためのフラグを表示します。

**デコード。** デフォルトのtemperatureは**0**です（`shared/model-defaults.json`）。アプリが翻訳する際の値とハーネスが評価する際の値が同一になるため、測定されたものがそのまま提供されることになります。`mt-eval run --temperature`はデフォルトでこの値を使用します。言語ペア、設定、または実行ごとに独自に設定することもできます。モデルIDは完全一致のスラッグであり、エイリアスは使用できません。

## ゲートチェーン

`$schema` `https://champollion.dev/schemas/gate-chain/1.json`、`gates/`内の1つのファイル。必須項目: `id`、`gates`（1つ以上）。オプション: `description`、`fallback`。

各ゲート: `id`、`kind`（`metric-threshold`、唯一の種類）、`metric`（メトリックプラグインの名前）、`field`（そのプラグインのセグメントごとの結果におけるキー — 数値、または1/0として解釈されるtrue/false）、`min`および/または`max`、`on_refuse`。

**ルール**（`arena/mt_eval_harness/gates.py`）:

- ゲートは順番に実行されます。セグメントを拒否した**最初の**ゲートが、何を提供する（出荷する）かを決定します。

  | `on_refuse` | 提供内容 | カウント |
  |---|---|---|
  | `drop` | なし | 拒否 |
  | `keep-source` | 原文テキスト | 拒否 |
  | `flag` | 出力（マーク付き） | フラグ設定（拒否ではない） |
  | `fallback` | フォールバックの翻訳（同一ゲートが承認した場合。再度拒否された場合はなし） | 拒否 |

- **ロック。** プラグインがスコア付けできないセグメントは拒否されます（`no_value`または`plugin_error:<type>`）。合格したかのように提供されることは決してありません。
- **ロック。** プラグインが読み込まれていないか、ここでスコア付けできないゲートがある場合、翻訳が行われる前に実行が停止します（*「判定できないゲートが合格として扱われることは決してありません」*）。
- **ロック。** フォールバックはこのプロセス内で実行される必要があります（`lexicon`、`local-model`、または`dependency_class` `S`もしくは`O`を宣言するプラグイン）。拒否されたセグメントが外部へ送信されることはありません。
- **ロック。** `mt-eval run`および`mt-eval test`は、`fallback`ゲートを持つチェーンを拒否します（*「フォールバックはサービス提供および翻訳用であり、測定用ではありません。1つの名前のもとで、スコアが一部はこのメソッドのもの、一部はフォールバックのものになってしまいます」*）。フォールバックは独自のメソッドとして個別に測定してください。
- **ゲートが適用される場所:** `mt-eval run --gates`、`mt-eval test <run log> --gates` (re-scored without translating again), `mt-eval translate --gates`、`mt-eval serve --gates`、およびデプロイメントの`gates`。
- 測定において、主要スコア（headline）は実際に提供されるものを評価します。ゲートなしのchrF++と拒否率がその横に並び、チェーンのフィンガープリント（正規JSONのsha256）がレポートとともに保持されます（[測定](/docs/agents/measurement#gated-measurement)）。`keep-source`の場合、主要スコアは原文テキストが提供された箇所で原文を評価します。
- **ロック。** すべてのゲートには`min`および/または`max`が必要で、ゲートIDは一意でなければならず、`fallback`ゲートにはチェーンの`fallback`が必要です — `champollion validate`とハーネスは同じ判定を下します。拒否されたセグメントをゲートの理由とともに再試行する機能は組み込まれていません。

## 具体例: FST妥当性ゲート

有限状態アナライザー（FST）は、単語がその言語の正しい語形であるかどうかを判定します。ハーネスのメトリックプラグイン`giellalt_fst_validity`は、セグメントごとに`fst_total_words`、`fst_valid_words`、`fst_invalid_words`、および`fst_validity_rate`（0〜1）を報告します。単語は空白で分割され、端の句読点は取り除かれます。先頭が大文字の単語は小文字で再試行されます。

```json
{
  "$schema": "https://champollion.dev/schemas/gate-chain/1.json",
  "id": "fst-every-word",
  "description": "Ship a sentence only when the analyzer accepts every word.",
  "gates": [
    { "id": "fst-all-words", "kind": "metric-threshold",
      "metric": "giellalt_fst_validity", "field": "fst_validity_rate",
      "min": 1.0, "on_refuse": "flag" }
  ]
}
```

```bash
mt-eval setup --status               # the languages with a pinned analyzer
mt-eval setup --fst                  # the analyzer runtime
mt-eval setup --lang <code>          # the language's analyzer, once per machine
mt-eval run --corpus <dev file> --target-lang-code <code> --method local-model -m <model folder> \
  --gates gates/fst-every-word.json
```

- アナライザーは**バンドルされていません**: ハーネスはピン情報（言語ごとのファイル名とsha256）のみを同梱し、`setup --lang`が上流の利用条件のもとで上流から`~/.mt-eval/fsts/<code>/`へとアナライザーを取得します。別個のツールとして実行され、`champollion` CLIにリンクされることは決してありません。
- アナライザーが見つからない場合にスコアが0になることはありません。メトリックとしては「未計算」とマークされ、ゲートとしては実行を停止します。
- 空の出力はスコア0となり、`min`未満で拒否されます。
- これを使用してサービスを提供するには、`on_refuse: "fallback"`と`{"method": "lexicon", "model": "data/lexicon/words.tsv"}`などの`fallback`を使用します — `translate`および`serve`のみが対象です。
- **注意。** FSTによる受理は単語が存在することを示すのみであり、文が正しい意味であることを示すわけではありません。これは診断用であり、chrF++の主要スコアに含まれることはありません。

## レシピ

### コーチング付きLLM（`llm-coached`）

コミュニティの人々によるガイダンス（文法の注意事項、スタイル、用語など）をプロンプトとして与えられた汎用モデルです。

```bash
mt-eval run --corpus <dev file> -m <exact model id> --coaching-file coaching.md --glossary terms.json
champollion sync --method llm-coached --coaching-file coaching.md
```

- **ハーネスにおいて**、コーチングファイルのテキストがシステムプロンプトの*すべて*となります。そのため、何を翻訳すべきか、そして翻訳のみを出力することを指示する必要があります。`--glossary`はスコアリング用の入力（用語の遵守度）であり、送信されることはありません。
- **ロック。** ハーネスの実行には1つのコーチングを指定します: `--coaching-file`、`--coaching`（インラインテキスト）、または旧式の`--custom-prompt`のいずれか1つを指定してください。両方を同時に指定すると拒否されます（*「--coaching-file と --coaching はそれぞれ実行にコーチングを指定するものです。どちらか一方を指定してください（インラインテキストをファイルに含めるか、ファイルを外してください）」*）。
- **CLIにおいて**、`llm-coached`はコーチングを「Coaching guidance」ブロックとして含め、さらに`.champollion/coaching/<locale>.json`（`grammar_rules`、`style_notes`、`dictionary`）を加えた独自のプロンプトを送信します。
- **注意。** これらは2つの異なるプロンプトです。ハーネスで測定されたコーチング付きスコアは、CLIが提供するプロンプトとまったく同一ではありません。一方を他方の根拠として提示する際は、その旨を明記してください。
- **送信内容:** すべての原文と完全なコーチングがプロバイダーに送信されます。ローカル限定のサイドカーを持つコーチングファイルは、ループバックエンドポイントでのみ実行されます（`champollion data mark coaching.md --local-only`がそれをマークします）。

### Few-shot

コーチング内に適切な翻訳例を含める方法です。これはコーチング付きLLMであり、コマンドも通信方法も同じです。例文はシステムプロンプトに含まれてプロバイダーへ送信されます。

- **注意。** テストセットから例文を取ったり、リモートプロバイダー向けにローカル限定ファイルから例文を取ったりしないでください。Few-shotの例文がテストの参照訳と重複していないかを自動でチェックする機能はありません。

### 辞書拡張LLM

- **CLI:** `.champollion/coaching/<locale>.json`内の`dictionary`は、各バッチで見つかった用語（大文字・小文字を区別しない部分一致）について、「REQUIRED TERMINOLOGY」としてすべてのLLMメソッドに送信されます。DeepLには用語集として渡されます。翻訳後に違反に関する警告が表示されますが、再試行は行われません。
- **ハーネス:** 辞書は、コーチングファイル内のテキストとしてのみモデルに渡されます。
- **辞書単体:** `mt-eval run --method lexicon -m data/lexicon/words.tsv --corpus <dev file>` — 最長一致優先、未知語はそのまま保持、インプロセスで実行。開発セットにおけるこれが`nmt-forge floor`です（[測定](/docs/agents/measurement#the-dictionary-floor)）。
- **送信内容:** 辞書の一致したエントリーが、文とともにプロバイダーに送信されます。ローカル限定の辞書をリモートプロバイダーに送信してはなりません。

### ルールベースのハイブリッド

ルールエンジンは標準搭載されていません。利用可能なものとしては以下があります: `lexicon`（決定論的、インプロセス）、`mt-eval run --method apertium`（ルールベースのエンジン — `APERTIUM_API_URL`が自前のサーバーを指していない限り`apertium.org`にテキストを送信します）、および独自のルール用の`python`プラグイン（任意でLLMと組み合わせ可能）。プラグインクラスには`async def translate(self, entries, config)`が必要です。`mt-eval run --method <folder>`で実行します。出力の検証にはゲートチェーンを使用します。

- **送信内容:** プラグインが呼び出す任意のもの。プラグインは外部メソッドです。同意が必要なコーパスまたは封印されたコーパス（ローカル限定を含む）では、`--attest-local-transport`が指定されない限りハーネスはそれを拒否します。このフラグは、呼び出す対象のすべてがこのマシン上にあることを確認した後にのみ指定してください。

### メソッドのチェーン

2つのチェーンが標準で組み込まれています:

1. **ゲートチェーンのフォールバック:** メソッド → ゲート → インプロセスのフォールバック → 同じゲート。`translate`および`serve`のみ対象。
2. **CLIのペアフォールバック**（アプリの言語ペアでの`"fallback": {"method": …}`）: プライマリメソッド → CLIの品質ゲート → ゲートのフィードバックを用いた再試行（LLMメソッド、または`acceptsInstructions`を宣言する`api`エンドポイント） → 同じゲートを通じたフォールバック（1回のみ）。

これ以上の長い処理（モデルをまたいだ生成、編集、検証など）は、`python`プラグインまたは`service`で行います。

- **送信内容:** 各リンク（構成要素）は、その種類に応じた内容を送信します。チェーン全体のプライバシー保護レベルは、最もプライバシー保護が低いリンクと同等になります。

### 部分翻訳（人間と機械）

モデルが下書きし、話者が確認して修正します。レール上ではこれが改善ラウンドにあたります: `champollion improve sheet`が下書きを作成し、話者が`Y`/`N`/`?`を付け、`champollion improve marks`が修正内容と確認済み下書きを訓練ペアに、練習用の行を開発用の文へと変換します（[コーチング](/docs/agents/coaching)）。人間による独自の翻訳をメソッドとして評価するには（`kind` `human`）、その出力に対して`mt-eval test`を実行します。`on_refuse: "flag"`を持つゲートは、出力をレビュー対象としてマークします。

- **注意。** メソッドのコーチングや訓練に使用した文を、そのメソッドの評価に使用してはなりません。
- **送信内容:** 下書きモデル自体のルールを超える送信はありません。シートはプロジェクトフォルダー内にとどまります。

### ファインチューニング済みモデル

- **レール上:** `nmt-forge`（`nmt-checkpoint`。プリセット: `cpu-tiny`、`byt5-small`、`byt5-small-lowmem`、`cpu-finetune`、`nllb-600m`）でエクスポートし、サービスとして提供し、接続します — [訓練](/docs/agents/training)、[サービス提供](/docs/agents/serving)。
- **すでにお持ちのオープンモデル:** `mt-eval run --method local-model -m <Hugging Face id or folder>` — インプロセス。マシンから外部へ送信されるものはありません。
- **ご自身で提供するLLM**（Ollama、vLLM、OpenAI互換のものすべて）: `mt-eval run --provider local --base-url http://127.0.0.1:11434/v1 -m <model name>`。エンドポイントがループバックアドレスの場合にのみローカルとみなされます。
- **送信内容:** エンドポイントが真にローカルである場合、マシンの外部には何も送信されません。

## さらに詳しく

- [メソッド仕様](/docs/network/specifications/methods)および[プラグインマニフェスト](/docs/reference/plugin-spec)（古い形式）。
- [サービス提供とデプロイ](/docs/agents/serving) — deployment/1 および service-api/1。
- [測定ルール](/docs/agents/measurement) — ゲート付きスコア。
- [データおよび送信ルール](/docs/agents/data-rules) — 送信可能な対象。
- [アプリおよびサイト向けの翻訳メソッド](/docs/guides/translation-methods)。
