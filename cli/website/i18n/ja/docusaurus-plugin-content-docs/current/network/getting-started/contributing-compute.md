---
sidebar_position: 4
title: "コンピュートの提供"
description: "キューを実行する：自分の API キーを使って公開キューからオープンなベンチマークスイープを実行し、結果を公開します。"
related:
  - label: "Agent Guide: Building & Benchmarking on the Network"
    to: /docs/network/getting-started/agent-guide
    kind: guide
  - label: "Cookbook: Coached LLM Prompting"
    to: /docs/network/tutorials/coached-llm-prompting
    kind: cookbook
  - label: "Cookbook: FST-Gated Pipeline"
    to: /docs/network/tutorials/fst-gated-pipeline
    kind: cookbook
  - label: "Method Interface & Dependency Classes"
    to: /docs/network/specifications/methods
    kind: spec
  - label: "Leaderboard Rules & Trust Tiers"
    to: /docs/network/leaderboard/rules
    kind: guide
---

# コンピュートの提供

> **コンセプト:** リーダーボードには空白のマスがあります — それは誰も測定していない（言語ペア、手法、条件）の組み合わせです。私たちはその公開キューを管理しています。ご自身のAPIキーを使ってアイテムを実行し、レポートを公開することで、マップが埋まっていきます。計算リソースを提供することは、低リソース言語の機械翻訳（MT）評価に対する実質的で引用可能な貢献となります。

キューには2種類のタスクがあります。**LLMアイテム**は、チャットモデルを特定の言語ペアにおいて`naive`または`coached`のプロンプト条件でテストします。**エンジンアイテム**（条件`engine`）は、従来の機械翻訳サービス（DeepL、Google Translate、Microsoft Translator、LibreTranslate、Tilde）を、各サービスが公開しているサポート対象内のペアでテストします。これらはカバレッジマップの測定されたバックボーンですが、2026年8月まではほぼ完全に空白でした。どちらの種類も同じハーネスで実行され、同じボードに公開されます。

## キュー

ライブキューはデータベースから配信されます（ハーネスはデフォルトでこれを読み込みます）。コンパクトなスナップショットは[champollion.dev/queue-preview.json](https://champollion.dev/queue-preview.json)で公開されており、完全なファイルは[queue.json](https://champollion.dev/queue.json)にあります（数十MBあるため、まずはプレビューを取得することをお勧めします）。ご自身の実行結果がどのようにマップを構築していくかは、[champollion.devのライブマップ](https://champollion.dev)（何が何を翻訳できるかを示すカバレッジマップ）で確認できます。また、インストール不要のターミナルビューアも用意されています:

```bash
curl -fsSL https://champollion.dev/run_queue | bash -s -- --budget 2
```

ビューアーはオープンなアイテムとその正確な `mt-eval run` コマンドを*表示する*だけです — 何も実行せず、トークンも消費しません。各アイテムには以下が含まれます：

- `run_command` — コピー＆ペーストですぐに使えます（コーパスを取得し、ハーネスを実行します）
- `est_cost_usd`および`est_basis` — 同一の（コーパス、モデル）に対する私たち自身のベースライン実行の**実測**コスト、またはそのモデルのエントリあたりのスウィープ平均コスト × コーパスのエントリ数からの**外挿値**のいずれかです。算出基準はアイテムごとに記載されています。実際のコストは実行時のプロバイダーの価格設定に依存します。
- `priority` — 公開されているランキングです（調査モード: 1ドルあたりでペア、言語、語族全体をどれだけ網羅できるか）。プレビューでは**予算レベル**（$1 / $10 / $100 / $1000でランキング上位から何が得られるか（カバーされるアイテム、ペア、モデル））も公開されているため、費用をかける前に貢献の規模を把握できます。その基礎となる価値モデルは**期待チェーン価値（expected chain value）**です。これは、推定1ドルあたりで、この1回の実行が言語メッシュ全体をどれだけ強化すると予測されるかを示します。各アイテムには完全な計算式の内訳（`edge_strength`、`pair_prior`、`model_offset`、`exploration_bonus`、`predicted_strength`、`expected_mesh_gain`、`ecv_per_usd`）が含まれているため、任意のランクを手動で再導出できます。数式とデフォルト値は[キュー構築仕様（Queue Construction Specification）](/docs/network/specifications/queue-construction)に、その背景にある論理は[なぜキューはこのように構築されているのか（Why the Queue Is Built This Way）](/docs/network/perspectives/why-the-queue)に公開されています。

**クレームロックなし — オープンなアイテムはどれでも選べます。** 同じアイテムを 2 人が実行しても、設計上問題ありません：すべての実行カードはフィンガープリントされており（データセットハッシュ + モデル + 条件 + システムプロンプトに対する SHA-256、[ベンチマーク仕様 §3.8](/docs/network/specifications/benchmark)）、同一の実行は公開時に重複排除され、同じ設定の独立した再現は無駄ではなく有用な証拠となります。

キューに入っているコーパスは dev スプリット、CC-BY ファミリー（Tatoeba 派生）で、`do_not_train` フラグが付いています — これらは評価セットであり、学習データではありません。非商用ライセンスおよび隔離されたコーパスはオープンキューから除外されています。

## セットアップ（初回のみ）

```bash
# 1. Install the harness (python3 + pipx, no sudo — read it first if you like)
pipx install mt-eval-harness

# 2. Set your API key — any ONE of these; the harness auto-detects it
export OPENROUTER_API_KEY="sk-or-..."     # reaches every model in the queue
# or a direct vendor key:
#   ANTHROPIC_API_KEY / OPENAI_API_KEY / GOOGLE_API_KEY
# (any of them can also live in a local .env file)
```

### どのプロバイダーキーを使うか？

ハーネスは 4 つのプロバイダーキーを受け付けます。`mt-eval run` および `mt-eval queue` で `--provider` を使って選択するか、環境変数または `.env` に設定されているキーから自動検出されます：

| `--provider` | キー | 対応範囲 |
|---|---|---|
| `openrouter`（デフォルト） | `OPENROUTER_API_KEY` | キューラインナップのすべてのモデル |
| `anthropic` | `ANTHROPIC_API_KEY` | Anthropic Claude モデル |
| `openai` | `OPENAI_API_KEY` | OpenAI GPT モデル |
| `gemini` | `GOOGLE_API_KEY` | Google Gemini モデル |

[OpenRouter](https://openrouter.ai/keys) のキー 1 つでラインナップのすべてのモデルに対応でき、ハーネスのコスト追跡と料金スナップショットも同じ OpenRouter メタデータから取得されるため、報告される実行コストはキーに請求された金額と一致します — これがデフォルトになっている理由です。クレジットが Anthropic、OpenAI、または Google に直接ある場合は、そのベンダーのキーを設定すれば、ハーネスはプロキシなしでベンダーの API を直接呼び出します。直接キーはそのベンダー自身のモデルにしか対応しません（単一ベンダーのバッチに適しています）。コスト数値は請求メタデータではなく公開されているベンダー料金から算出されるため、概算として扱ってください。OpenRouter キーと直接キーの両方が設定されている場合、自動検出は OpenRouter を選択します。キューワーカーはその旨と `--provider` を使った上書き方法を通知します。すべての実行カードは、`api_provider` フィールドにどのレーンで実行されたかを記録します。

（`mt-eval run` は `--base-url` 経由で Ollama、vLLM、LM Studio などのセルフホスト型 OpenAI 互換エンドポイント用に `--provider local` も受け付けます。これは明示的なオプトインであり、自動検出されることはありません。）

### APIキーなし: セルフホストモデルの実行

クラウドのキーは一切不要です。`local-model`手法は、お使いのハードウェア上でオープンなニューラル機械翻訳（NMT）モデルを実行します。これらはクラウドエンジンが提供していないモデルであり、低リソース言語のカバレッジがまさに存在する領域です: **NLLB-200**、**OPUS-MT**（Helsinki-NLP）、**MADLAD-400**。

```bash
# transformers backend (Hugging Face) — install the extra once:
python3 -m pip install 'mt-eval-harness[local-models]'

# then point --model at any Hugging Face id (or a local from_pretrained dir):
mt-eval run --method local-model \
  --model facebook/nllb-200-distilled-600M \
  --dataset flores-eng-fra
```

**モデルをロードする一般的な2つの方法（自動選択され、設定は不要です）:**

- **transformers**（デフォルト）: `--model`はHugging Face Hub ID（`facebook/nllb-200-distilled-600M`、`Helsinki-NLP/opus-mt-en-es`、`google/madlad400-3b-mt`）またはローカルの`from_pretrained()`ディレクトリです。`python3 -m pip install 'mt-eval-harness[local-models]'`が必要です。
- **CTranslate2**（高速なCPU/GPU推論）: `--model`はCTranslate2に変換されたモデルディレクトリ（`ct2-transformers-converter`によって生成され、`model.bin`を含むもの）です。`python3 -m pip install 'mt-eval-harness[ctranslate2]'`が必要です。トークナイザーは変換されたディレクトリから読み込まれるか、`LOCAL_TOKENIZER_ID`で指定されます。

バックエンドはモデルパスから自動検出されます（CTranslate2ディレクトリには`model.bin`が含まれます）。必要に応じて`LOCAL_MODEL_BACKEND=transformers|ctranslate2`で強制指定できます。

**`-m` / `--model`は必須です。** `local-model`にはデフォルトモデルがありません。モデルを指定しない実行は拒否され、実行カードには実際にロードされたモデル（リビジョン付きのHub ID、またはファイル全体のSHA-256ハッシュ付きのディレクトリ）が記録されます。Hugging Face IDを指定した場合、初回実行時に重みがHugging Faceキャッシュへダウンロードされます（`HF_HOME`で変更可能）。

**ペアモデルは自身の対象ペアにのみ適用されます。** OPUS-MTモデル（`Helsinki-NLP/opus-mt-<src>-<tgt>`）は、その名称に含まれるペアのみを翻訳します。コーパスが別のペアである実行は、`--allow-model-pair-mismatch`を渡さない限り拒否されます — これは意図的な近縁言語のベースライン（例: 英語→北部サーミ語のセットに対して`opus-mt-en-fi`を適用する場合など）のためのものであり、実行カードにその不一致が記録されます。

**言語コードは推測ではなく言語カードから取得されます。** NLLBのような多言語モデルの場合、ハーネスはターゲット言語のカードから直接FLORES-200コードを読み取ります（すべての手法が使用する共通の信頼できる情報源です）。モデルが実際には対応していない言語 — 例えばNLLB-200には平原クリー語（Plains Cree、`crk`）がありません — の場合、不正なコードを出力してそれらしい誤った翻訳を生成するのではなく、**誠実に失敗します**（「このモデルの対象外」）。OPUS-MTモデルはペア固有であるため、ペアそのものがモデルとなります。

ローカルモデルの実行は、他の実行とまったく同様にスコア付けされて公開されます — 同じメトリクス、同じ実行カード、同じリーダーボードです。（これはハーネスの手法であり、CLI翻訳ツールは後からサブプロセスブリッジを介してこれにアクセスするため、NodeがPythonの機械学習スタックを必要とすることはありません。）

### エージェントのファストパス

Claude Code や他のコーディングエージェントを使用している場合、貢献全体を 1 つのプロンプトで完結できます：

```text
Install the Champollion mt-eval harness with `pipx install mt-eval-harness`.
Fetch https://champollion.dev/queue.json and show me the top 3 open items.
Using my API key (OPENROUTER_API_KEY, or a direct ANTHROPIC_API_KEY /
OPENAI_API_KEY / GOOGLE_API_KEY), execute the run_command of the
item I pick, then run `mt-eval publish` on the generated report JSON and
show me the published run card.
```

## Tier 0 — コマンド 1 つ

最も手軽に貢献する方法は、ハーネスにキューの先頭を自動的に処理させることです：

```bash
mt-eval queue --top 5          # run the 5 highest-value open items
mt-eval queue --budget 2.50    # or: run from the top until ~$2.50 of
                               # estimated spend is committed
mt-eval queue --top 3 --dry-run   # see the plan first, spend nothing
```

再ソートは行いません — キューの順序*そのもの*が[優先度モデル](/docs/network/specifications/queue-construction)です — 推定費用を含む完全なプランを表示し、実行前に確認を求めます。コーチングファイルを持参しない限り（`--include-coached --coaching-file my-coaching.txt`）、コーチング付きアイテムはスキップされます。

**キューワーカーが代わりに公開します — アカウント不要。** 単独の `mt-eval run`（自動公開しない）とは異なり、`mt-eval queue` はトークンを消費する前に公開 ID を解決し、**完了した実行を自動的にリーダーボードへ公開**します — 別途公開手順は不要です。ボードに名前を載せたい場合のみ（GitHub/Google で）サインインしてください。それ以外は匿名で続行でき、結果は投稿者 `anonymous` として投稿されます（`--anonymous` で強制でき、キャッシュされたサインインのない非インタラクティブな `curl | bash` 実行はデフォルトでそうなり、その旨が明示されます）。結果をローカルに保持するには `--no-publish` を渡してください（後で `mt-eval publish` で公開できます）。その後、[champollion.dev のライブマップ](https://champollion.dev)で自分の実行が何を構築したかを確認してください。

## Tier 1 — ベンチマークを実行する

すべてのキューアイテムの `run_command` は自己完結しています。典型的な例：

```bash
mt-eval run --corpus eval-eng-yor-tatoeba-dev-v1 \
  --model anthropic/claude-haiku-4.5 \
  --target-lang "Yoruba" \
  --yes
```

渡すのはファイルではなく**レジストリ ID** です — ハーネスは実行時にアップストリームソースからリファレンスを取得し、新たに取得したデータに対してスコアリングします（コーパスのコンテンツはここでホストまたは追跡されることはありません）。

実行すると合計コストが表示され、実行ログとスコア付きレポートが `eval/logs/` に書き込まれます。その後、公開します：

```bash
mt-eval publish eval/logs/harness/run_..._report.json
```

**アカウント不要。** 公開時に OAuth サインイン（GitHub/Google）が提供され、名前がリーダーボードの帰属として表示されますが、任意です：`mt-eval publish <report> --anonymous` はアカウントなしで公開でき、行は投稿者 `anonymous` として他のセルフベンチマーク結果と同様に表示されます。匿名の受付はレート制限があり（接続ごとに 1 時間あたり数枚；サインインが無制限のパスです）、他のすべての投稿と同じデータベース整合性ゲート — 隔離、スコア範囲、コーパス SHA バインディング、コーパスコンテンツガード — が同様に適用されます。匿名か帰属ありかにかかわらず、コミュニティの投稿は**セルフベンチマーク**の信頼ティアに分類されます — 「実行した本人が投稿した」と明確にラベル付けされます。これは降格ではなく、信頼モデルが機能している証です。実行カードには、データセットハッシュ、モデル、条件、完全なシステムプロンプト、コストなど、誰でも同じ設定を再実行するために必要なすべての情報が含まれています。上位ティア（検証、コミュニティ検証）はレビューによって付与されます — [リーダーボードルール](/docs/network/leaderboard/rules)を参照してください。

:::note[モデレーション]
匿名の行は他と同様にモデレートされます：投稿はパブリック API に対して不変であり、キュレーターによる削除や修正はサービスロールレーンを通じて行われます。データベースの監査証跡が以前の行を保持するため、削除は記録され、元に戻すことができます — サイレントに消えることはありません。
:::

## Tier 2 — コーチングプロンプトを作成する

ハーネスは**コーチング**をファーストクラスでサポートしています：素朴なシステムプロンプトを、実際の言語知識を持つものに置き換えます。`--coaching-file`（または短いプロンプトには `--coaching "inline text"`）を渡すと、ハーネスはそのテキストをシステムプロンプトとして使用し、**完全なテキストとその SHA-256** を実行ログのプロベナンスブロックに記録し、実行の条件を**`coached`**（`--prompt` を明示的に設定しない限り）とラベル付けします — これにより、プロンプトの工夫は再現可能で帰属可能な実験となり、2 つの異なるコーチングファイルが混同されることはなく、コーチング付き実行がリーダーボード上で素朴なベースラインと誤認されることもありません。

フェロー語の実例。言語の[公開言語カード](https://champollion.dev/languages)から得た類型論的事実と用語集エントリーを使用しています：

```text title="coaching-fao.txt"
You are translating English into Faroese (føroyskt).

Grammar notes:
- Faroese is a North Germanic V2 language: the finite verb is the second
  constituent of a main clause.
- Nouns inflect for case (nominative, accusative, dative, genitive),
  gender (masculine, feminine, neuter), and number. Make adjectives and
  determiners agree.
- The skerping pattern applies before -gv/-ggj sequences; preserve
  standard orthography including ð (which is silent).

Glossary (use these exact equivalents):
- language -> mál
- island -> oyggj
- weather -> veður

Style: plain register, modern standard orthography. Output only the
Faroese translation, no commentary.
```

```bash
mt-eval run --corpus eval-eng-fao-tatoeba-dev-v1 \
  --model anthropic/claude-haiku-4.5 \
  --target-lang "Faroese" \
  --coaching-file coaching-fao.txt \
  --yes
```

（コーチングコンテンツは自分で書いてください — 上記の事実は*形式*を示しています：影響の大きい文法規則をいくつか、モデルが間違えやすい用語の小さな用語集、レジスター指示。[champollion.dev/languages](https://champollion.dev/languages) の言語カードには、参照できる類型論ソースが引用されています。）

`mt-eval compare <naive_log> <coached_log>` で素朴なベースラインと比較し、反復して最良の実行を公開してください。実行は自動的に条件 `coached` で公開されます。汎用ラベルの代わりに名前付きメソッドをリーダーボードに表示したい場合は、公開時にメソッドカードを添付してください（公開フローにウィザードがあります）。プロンプトエンジニアリングだけで低リソースペアの素朴なベースラインを上回ることは、本物の公開可能な発見です — 設計ガイダンスについては完全な[コーチング LLM プロンプティングクックブック](/docs/network/tutorials/coached-llm-prompting)を参照してください。

## Tier 3 — メソッドを構築する

最も野心的な貢献：`TranslationMethod` プロトコル（`translate(entries, config)`）を実装し、プロンプトではなく実際のシステムをベンチマークします。ハーネスは `--method <plugin-dir>` 経由でそれを実行し、メソッドカードを実行カードに埋め込みます。実例付きクックブックのあるパターン：

- **[FST ゲートパイプライン](/docs/network/tutorials/fst-gated-pipeline)** — すべての候補単語が形態素解析器によってチェックされ、ゲートを通過するまで LLM が再生成します。半決定論的で、形態論的に保証された出力。
- **[辞書拡張生成](/docs/network/tutorials/dictionary-augmented-llm)** — 翻訳時にソース用語を二言語辞書で検索し、出力を制約します。
- [連鎖モデル](/docs/network/tutorials/chained-models)、[few-shot 検索](/docs/network/tutorials/few-shot-prompting)、[逆翻訳](/docs/network/tutorials/back-translation)、[ルールベースハイブリッド](/docs/network/tutorials/rule-based-hybrid)…

メソッドは**依存クラス**（S/O/A1/A2/X — [メソッド仕様](/docs/network/specifications/methods#method-validity-and-dependency-classes)を参照）を宣言します。これは実行と転送に何が必要かを説明するものです：自己完結型パイプラインはクラス S、実行時にライセンス済み辞書 API を呼び出すものは A2 です。正直に宣言してください — クラスによってメソッドが競合できる場所が決まり、マニフェストは監査されます。

## リーダーボードを超えた意義

公開された実行はすべて、商業プロバイダーが測定しない言語ペアの MT 品質に関する独立した証拠です。キューは*需要*の公開記録としても機能します：コミュニティが測定する価値があると考えるペア、現在の API 価格でのカバレッジコスト、提供されたコンピュートがどこまで届くか。資金調達機関に体系的なスイープの支援を求める際、このキューとその充填率が需要の証拠となります。
