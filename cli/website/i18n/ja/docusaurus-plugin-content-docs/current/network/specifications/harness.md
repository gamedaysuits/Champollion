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
python3 -m pip install mt-eval-harness
```

これにより `mt-eval` コマンドがインストールされます。

## 使用方法

```bash
mt-eval run --corpus path/to/dataset.json
```

これにより、コーパス内のすべてのエントリが設定済みのモデル（またはメソッドプラグイン）を通じて処理され、出力がスコアリングされ、ランカードのJSONファイルが出力ディレクトリに書き込まれます。

## CLIフラグ

### `mt-eval run`

| フラグ | 必須 | デフォルト値 | 説明 |
|------|----------|---------|-------------|
| `--corpus` | ✅ | — | コーパスファイルへのパス（`.json`、`.jsonl`、`.tsv`） |
| `--source-file` / `--reference-file` | — | — | パラレルテキストファイル（FLORES+、WMT形式） |
| `-m, --model` | — | `google/gemini-3.1-pro-preview` | 正確なモデルスラッグ: 完全なOpenRouter ID、または直接プロバイダー自身の正確な名前。エイリアスや変動するID（`~vendor/…`、`…-latest`）は不可: `gemini-pro`のような短縮名は拒絶され、拒絶メッセージに記述すべきスラッグが示されます。複数モデルを実行する場合はカンマ区切り。`--method local-model`と併用する場合、実行対象のモデル（Hugging Face IDまたはモデルディレクトリ）となり、必須です（該当エンジンにはデフォルトモデルがありません）。メソッドプラグインと併用する場合、`config.method_model`としてプラグインに渡されます。それ以外のMTエンジンは独自のモデルで翻訳を行い、実行時に`-m`は未使用である旨が表示されます |
| `-d, --dataset` | — | `all` | データセットフィルター: `all`、セグメント名、またはID範囲 |
| `--ids` | — | — | 評価対象のエントリID（カンマ区切り） |
| `--source-lang` | — | `English` | ソース言語名 |
| `--target-lang` | — | — | プロンプトで指定されるターゲット言語名。ここでコードを指定した場合（`sme`）、言語カードから名前が取得され（"Northern Sami"）、実行ヘッダーにもその旨が表示されます。カードに名前のないコード（私用コード `qaa`）はコードのまま維持され、プロンプトにそのコードが含まれる旨の警告が表示されます |
| `-p, --prompt` | — | `naive` | プロンプトバージョン（`naive`、`custom`、`champollion`） |
| `--coaching-file` | — | — | コーチングプロンプトのテキストファイルへのパス。組み込みプロンプトを**置き換えます**: モデルには組み込みの「Translate the given … text to …; output only the translation」という指示ではなく、ファイルの内容がそのまま（プラス `--target-script` の行）渡されます。ドライランおよび実行ヘッダーに判定が一度に表示されます: ファイルに対象言語名が含まれている場合（およびどの名前またはコードか）は ✓、言語名もコードも含まれていない場合は ⚠、名前やコードが不明な場合は未チェック |
| `--glossary` | — | — | 用語準拠性評価用の用語集（JSON）。スコアリングのみに使用され、モデルに送信されることはありません |
| `--coaching` | — | — | インラインコーチングテキスト（引用符付き文字列） |
| `--method` | — | — | メソッドプラグインディレクトリ（`method.json` + Pythonモジュールを含む）へのパス、または登録済みMTエンジン（`google-translate`、`deepl`、`local-model`、…） |
| `--allow-model-pair-mismatch` | — | `false` | `--method local-model` と併用: コーパスと異なるペア名をIDに持つOPUS-MTペアモデルを実行（関連言語のベースラインとして、`eng>sme` コーパスで `opus-mt-en-fi` を実行など）。このフラグがない場合は拒絶され、ランカードに記録されます |
| `--method-card` | — | — | リーダーボードメタデータ用のメソッドカードJSONへのパス |
| `--fst-retries` | — | `0` | FST再試行回数（デフォルトのLLMメソッドのみ） |
| `--skip-fst` | — | `false` | 対象言語にFSTがある場合でもFST受理率をスコアリングせず、それ以上の通知も行いません。ランカードには未計算（not computed）として記録されます。このフラグがない場合でも、FST（アナライザーまたはpyhfstランタイム）が見つからないことで実行が停止することはありません。実行は続行され、ランカードにはFST受理率と形態論が未計算として記録され、通知には `mt-eval setup --lang <code>` が提示されます。インストール後、`mt-eval test <run log>` により再翻訳なしで完了済みの実行にFSTスコアを追加できます。自動的にダウンロードされるものはありません |
| `--skip-eval-standard` | — | `false` | 言語カードの評価標準メトリクス（外部パッケージ）を計算せずにスコアリングします。ランカードには未計算として記録されます。このフラグがない場合、インストール済みパッケージのメトリクスが計算されます。インストールされていないパッケージはオプションのアドオンとして扱われ、実行はそのメトリクスなしで（未計算として記録されて）続行され、カードで宣言されている `python3 -m pip install` が提示されます。実行によってインストールされるものはありません |
| `--tools` | — | `false` | ツール呼び出しモードを有効化 |
| `--tools-list` | — | — | ツール名（カンマ区切り） |
| `--max-tool-rounds` | — | `8` | エントリごとの最大ツール呼び出しラウンド数 |
| `--hooks` | — | — | 翻訳後フック名 |
| `--style-profile` | — | — | スタイルプロファイルJSONへのパス。文体の一貫性メトリクスを有効化します（診断用 — ヘッドラインスコアには含まれません。[§ 文体およびレジスターのメトリクス](#writing-style-and-register-metrics-informational)を参照） |
| `-b, --batch-size` | — | `25` | API呼び出しあたりのエントリ数 |
| `-c, --concurrency` | — | `8` | 並列API呼び出し数 |
| `--max-tokens` | — | `32768` | API呼び出しあたりの最大トークン数 |
| `--temperature` | — | `0.0` | サンプリング温度（0.0 = 決定的） |
| `--no-cache` | — | `false` | レスポンスのキャッシュを無効化 |
| `--cache-dir` | — | `eval/cache/harness` | キャッシュディレクトリのパス（[翻訳キャッシュ](#the-translation-cache)を参照） |
| `--metricx` | — | `false` | MetricX-24（Google、Apache-2.0）も計算します。値が小さいほど良いニューラルエラー評価スコア（0〜25）で、chrF++のヘッドラインの横に報告され、合算されることはありません。`metricx` エクストラとGoogleのモデルコードが必要です（[オプトインのニューラルメトリクス](#opt-in-neural-metrics)を参照） |
| `--metricx-model` | — | `google/metricx-24-hybrid-large-v2p6` | `--metricx` と併用: 別のMetricXチェックポイント（xl/xxl、または `google/metricx-25-*`） |
| `--fuse` | — | `false` | FUSEスタイルの比較メトリクスも計算します。AmericasNLP 2025 FUSEアプローチの未トレーニングの再実装であり、診断用の比較指標として報告され、ヘッドラインには含まれません。`fuse` エクストラが必要です（[オプトインのニューラルメトリクス](#opt-in-neural-metrics)を参照） |
| `-o, --output-dir` | — | `eval/logs/harness` | ランカードおよびログの出力ディレクトリ |
| `-n, --name` | — | — | 人間が判読可能な実行名 |
| `--dry-run` | — | `false` | API呼び出しを行わずに設定とコーパスを検証します。実行で使用される予定のコーチングファイルと用語集（または `none`）を提示し、プロンプト（組み込みプロンプトは全文、コーチングファイルは先頭行とSHA-256、および組み込みプロンプトを置き換える旨）を表示し、翻訳キャッシュの場所を示し、実際の実行と同じeval-packチェックを実施して、失敗させることなく `EVAL PACK:`（`ready (…)`、`missing — <pieces>; …`、または `none needed for <language>`）で始まる行に報告します。2行目に実際の実行が停止するかどうかが表示されます（FSTの欠如で停止することはありませんが、それ以外の欠落要素では停止します）。`--json` の下で、サマリーには `coaching_file`、`prompt`（種類、SHA-256、長さ、組み込みプロンプトのテキスト）、`glossary_file`、および `eval_pack`（`status`、`missing`、`setup_command`、`blocks_run`、`advisory`）が含まれます |
| `--target-lang-code` | — | — | BCP-47言語コード |
| `--target-script` | — | — | 翻訳の記述に使用する必要があるISO 15924文字体系（`Latn`、`Cans`、…）。ターゲットの言語カードに記載されているもののいずれかです。ハーネスのプロンプトでこれを要求し（コーチングファイルのテキストにも追加されます）、プロンプトのSHA-256の一部となります。平原クリー語のように複数の文字体系で記述される言語の場合、リファレンスが記述されている文字体系を使用してください。指定しない場合、ハーネスはリファレンスの文字を文字体系ごとにカウントし（集計値: 文は表示されないため、ローカル専用コーパスでも有効）、90%以上を占める文字体系を要求します。実行ヘッダーでその旨が表示され（「references are 100% Latn → prompting for Latn」）、実行ログ（`config.target_script_source`）に記録されます。混在しているリファレンスには文字体系が指定されず、シェアとともに警告が表示され、もう一方の文字体系のリファレンスはほぼ0点となります。プロンプトを受け取らないMTエンジンやメソッドプラグインでは拒絶されます |

`--champollion-config` および `--prompt champollion` は0.2.0で廃止され、理由とともに拒絶されます。`--champollion-cards-dir` も同様です。ハーネスに別のカードディレクトリを指定するには `MT_EVAL_CARDS_DIR` を設定してください。これらはCLIのプロンプトをPythonで再構築したものであり、そのコピーがCLIから乖離していました。CLIメソッドを評価するにはメソッドプラグイン（`--method`）を使用し、結果をCLIプロジェクトに持ち帰るには `mt-eval export-config` を使用してください。

### オプトインのニューラルメトリクス

COMETは `unbabel-comet` がインストールされている場合に常に計算されます（`mt-eval setup --comet`: インストールに約300 MB、初回使用時に約2.3 GBのモデル）。さらに2つのメトリクスは、それぞれ大きなモデルを読み込むため、実行時に要求されない限り無効になっています。COMETと同様にローカルマシン上で実行され（APIコストなし、テキストは外部に送信されません）、chrF++のヘッドラインの横に報告され、合算されることはありません。要求されなかった場合、ランカードには「not run」と指定すべきフラグが表示されます。

| メトリクス | フラグ | 必要なもの | コスト |
|--------|------|---------------|---------------|
| MetricX-24 (`metricx_score`、値が小さいほど良い、0–25) | `--metricx`（チェックポイント: `--metricx-model`） | `python3 -m pip install 'mt-eval-harness[metricx]'`（PyTorch、Transformers、SentencePiece）およびGoogleのモデルコード（PyPIにはありません: `python3 -m pip install git+https://github.com/google-research/metricx`） | デフォルトの `google/metricx-24-hybrid-large-v2p6` チェックポイントとmT5-XLトークナイザーは、初回使用時にHugging Faceから数GBをダウンロードします。CPUでのスコアリングは低速です。リファレンスがない場合は、リファレンスフリー（QE）モードでスコアリングします |
| FUSEスタイルの比較メトリクス (`fuse_score`) | `--fuse` | `python3 -m pip install 'mt-eval-harness[fuse]'`（sentence-transformers、jellyfish） | LaBSEは初回使用時に約1.8 GBをダウンロードします。LaBSEがない場合、スコアは計算されず、レポートにその旨が表示されます。未トレーニング（構成要素の重み付けなし平均）であり、結果には `fuse_untrained` のフラグが付けられます |

MCP経由では、`run_benchmark` は `metricx`（`metricx_model` と併用）および `fuse` を受け取り、`comet: true` はCOMETを必須とします。その実行計画には各メトリクスがインストールされているかが示され、ハーネスが計算できないメトリクスを要求する確認済み実行は拒絶されます。

各メトリクスが何を測定し、特定の言語に対してどこまで信頼できるかについては、[スコアリング](/docs/network/specifications/scoring)および[メトリクスの信頼性](/docs/network/specifications/metric-reliability)を参照してください。

### 翻訳キャッシュ

すべての実行では、ソース文ごとのモデルの出力がキャッシュ（`--cache-dir`、デフォルトでは実行が開始されたディレクトリ下の `eval/cache/harness`）に保持されるため、同じ構成で再実行した場合は無料で再利用されます。キャッシュキーにはモデル、送信されたプロンプト（SHA-256）、出力を変化させる設定、およびハーネスのバージョンが含まれるため、これらのいずれかが変更された場合に古い出力が提供されることはありません。キャッシュにはコーパスの文のコピーが保持されます:

- 実行ヘッダーとドライランに、キャッシュの場所と保持されているエントリ数が表示されます。
- フォルダーには `.gitignore` が含まれているため、Gitによって無視されます。
- 公開可能（releasable）とマークされたフォルダー（`public/`）の `mt-eval contest prepare` に書き込まれることはありません: `mt-eval run` はそのような `--cache-dir` または `--output-dir` を拒絶し、代わりにコンテストの `runs/` フォルダーを指定します（[ソブリンコンテストの実行](/docs/network/sovereignty/run-a-sovereign-contest)を参照）。
- ローカル専用、封印済み、または同意必須のコーパスは、実行の設定、コーパスのSHA-256、およびその利用規約によってキー設定された独自の `protected/<namespace>/` フォルダーを取得し、そこにあるすべてのファイルは `<file>.champollion.json` サイドカーにコーパスのマークを保持します（[コーパスの登録](/docs/network/sovereignty/registering-corpora)を参照）。
- コピーを削除するにはフォルダーを削除するか、何も保持しないよう `--no-cache` を渡してください。

MCPサーバーの `run_benchmark` は、計画と結果の中でキャッシュを指定します。手元にあるファイルの場合、キャッシュを実行結果の横（`<corpus folder>/results/cache/`）に配置し、登録済みコーパスIDの場合は独自のフォルダー（`~/.champollion-mcp/cache/harness/`）に配置します。過去の実行によってサーバーの作業ディレクトリ下の `eval/cache/harness` にすでに存在するキャッシュは引き続き使用されるため、その出力に対して二重にコストが発生することはありません。エントリはフォルダーの場所に依存しないため、移動が可能です。

### すべてのサブコマンド

全18個のトップレベルサブコマンド。2026-08-01に `mt_eval_harness/cli.py` に対して生成されました。それまでこのセクションには7個しか記載されておらず、ソブリンオーガナイザーのスコアリングノードである `node` を含む6個は、**ここにもハーネスガイドにも記載されていませんでした**。

**実行とスコアリング**

| サブコマンド | 機能 |
|---|---|
| `mt-eval run` | 翻訳実行を実施（上記のフラグ） |
| `mt-eval test <log>` | 完了した実行ログを分析。`-o <path>` はレポートを `<log>_report.json` 以外の場所に書き込み、実行ログはそのパスを記録して `card` と `compare` が検出できるようにします。`--glossary <file>` はその用語集に照らして用語をスコアリングします。レポートにはその名前とSHA-256が記録され、カード、`compare`、および公開プレビューには、用語準拠性（診断用）がどの用語集に対してスコアリングされたかが表示されます |
| `mt-eval compare <reports…>` | 2つ以上の実行（`*_report.json`、または実行ログ）を比較。メトリクス（chrF++、BLEU、spBLEU、TER、…）ごとに1行、A、B、C…とアルファベットが振られた実行ごとに1列、小さいほど良いメトリクスには印が付きます。`--significance` はすべてのペアに対する対応のある検定を追加し、各テーブルには実行の文字が付けられ、Δの95%信頼区間が表示され、p値はメトリクスごとで未補正である旨が示されます。`--method paired_bootstrap` はデフォルトの近似ランダム化をKoehnのブートストラップに置き換えます（[有意性](/docs/network/specifications/significance)を参照）。フォルダーを共有している場合はレポートの横に `comparison-<hash>.json`（比較された実行IDのハッシュ。別の比較で上書きされることはありません）を書き込み、共有していない場合は最も近い共通フォルダーの `comparisons/` に書き込みます（単一の実行自身のフォルダーには書き込まれません。`-o` でファイルを指定した場合を除きます）。chrF++の検定のみでどちらの実行が優れているかを判定します。他の行は表示されるのみで、判定には使用されません。レガシーレポートのコンポジットスコアは廃止されたと表示され、比較されません |
| `mt-eval dashboard <logs…>` | インタラクティブなHTMLダッシュボードを生成 |
| `mt-eval card <run log>` | 人間が判読可能なランカードを整形出力。スコアは実行のレポート（ログの横、`mt-eval test -o` が記録した場所、または `--report <path>`）から取得されます。レポートが見つからない実行にはゼロではなくNOT SCOREDと探索した場所が表示されます。レポートファイルを直接渡すことも可能で、そのファイルに記録されている実行ログとともに読み込まれます |

**メソッドを見つける**

| サブコマンド | 機能 |
|---|---|
| `mt-eval recommend <src> <tgt>` | 言語ペア向けのメソッドガイダンス — 単なるランキングではなく、利用可能性と**引用された証拠**を提供。ペアは `corpora` が受け取る形式である `--source <src> --target <tgt>` としても指定可能 |
| `mt-eval corpora --source X --target Y` | 特定のペアで利用可能な評価コーパスを一覧表示。いずれかのフラグ単体でも機能します: `--target Y` はYへの全コーパスをリストし、`--source X` はXからの全コーパスをリストします |
| `mt-eval corpora --with-fst` | FST受理率をスコアリングできるよう、ターゲット言語にハーネスが固定（pin）しているFSTが存在するコーパスのみをリスト。各ターゲットについて、そのFSTがこのマシンにインストールされているかどうかと、そのインストール方法（`mt-eval setup --lang <code>`、または一部のフォーマット向けの手動インストール）が表示されます。`--source`/`--target` と組み合わせることも、すべてのペアに対して単独で使用することも可能です。ダウンロードは一切行われません |
| `mt-eval list models\|prompts\|datasets` | 利用可能なリソースを一覧表示 |

**貢献する**

| サブコマンド | 機能 |
|---|---|
| `mt-eval publish <report>` | TestReportをリーダーボードに送信 |
| `mt-eval queue` | 自身のキーを使用してコミュニティ計算キューの先頭を実行 — [計算リソースの提供](/docs/network/getting-started/contributing-compute)を参照 |
| `mt-eval export` | TestReportをChampollionメソッドプラグインとしてパッケージ化 |
| `mt-eval generate-plugin` | `export` のエイリアス |
| `mt-eval export-config` | TestReportから `champollion.config.json` スニペットを生成 |

**コンテストと主催**

| サブコマンド | 機能 |
|---|---|
| `mt-eval contest` | **ソブリンコンテスト**の実行または参加 — 主催者向け: `prepare`、`register`、`create`、`rank`、`close`、`export`。参加者向け: `qualify`（入場レシートのために公開devセットを自己スコアリング。予選基準は0〜100のchrF++）、`validate`（ノードのチェックをオフラインでリハーサル）、`submit-model` / `submit-method`（モデルまたはメソッドの引き渡し）、`status`、`list`。コンテストへのエントリーは、主催者のノードが「実行」できるものを渡すことで行われます。翻訳のアップロードや自己報告カードのリンクによる参加方法は、2026-09-06に廃止されました |
| `mt-eval shared-task` | 複数ペア共有タスク版の包括管理: AmericasNLPスタイルのエディションにおけるペアごとのN個のコンテストを1つの行にグループ化し、そのポリシーデフォルトを保持します。**グループ化とデフォルトのみ — 各ゲートはコンテストごとに維持されます** |
| `mt-eval node` | **主催者スコアリングノード。** インテークのポーリング、公開予選によるゲートチェック、コンテストポリシーごとの承認、**主催者保持の秘密リファレンス**に対するスコアリング、スコアのみの公開。これは[ソブリンコンテストの実行](/docs/network/sovereignty/run-a-sovereign-contest)および[ソブリン評価ノード](/docs/network/sovereignty/sovereign-eval-node)の背後にあるコマンドです — コーパスが主催者のマシンから外部に出ることはありません |

`mt-eval node` には、エアギャップレーン（`import-bundle`、`export-scores`、`relay`、`egress-check`、`manifest`）やM-of-Nカストディセレモニー（`ceremony`、`seal`、`keygen`、`sign-manifest`、`verify-manifest`、`ledger`）を含む、独自の18個のサブコマンドがあります。`mt-eval node --help` を実行してください。ソブリン性の仕組みについては、上にリンクされた2つのページで説明されています。

**セットアップ**

| サブコマンド | 機能 |
|---|---|
| `mt-eval setup` | オプションの依存関係をインストール（COMETニューラルメトリクス、FSTランタイム） |
| `mt-eval logout` | 保存されている認証資格情報を削除 |

### 使用例

```bash
# Run with defaults (google/gemini-3.1-pro-preview, naive prompt)
mt-eval run --corpus eval-amh-fra-globalvoices-test-v1

# Coached experiment with coaching file
mt-eval run \
  --corpus eval-amh-fra-globalvoices-test-v1 \
  --model google/gemini-3.1-pro-preview \
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
  "model_slug": "google/gemini-3.1-pro-preview",
  "model_id": "gemini-3.1-pro-001",
  "condition": "naive",
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

:::info[信頼できる唯一の情報源（Authoritative Schema）]
ランカードのスキーマに関する信頼できる唯一の情報源（SSOT）は[ベンチマーク仕様](/docs/network/specifications/benchmark)です。メトリクスの定義および実行のスコアリング方法については、[スコアリング仕様](/docs/network/specifications/scoring)を参照してください。このページではハーネスの使用方法を説明し、仕様では出力の意味を定義しています。
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

:::caution[正確な適用範囲]
これらのメトリクスは**診断用**です — ヘッドラインスコアに含まれることはなく、丁寧さの検出はマーカーベース（ヒューリスティック）であり、学習モデルによる判定ではありません。文体の質の評価としてではなく、レジスター遵守のドリフト検出器として扱ってください。
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
- 温度（Temperature）
- バッチサイズ
- 有効化されたツール
- ハーネスのバージョン

全部で8つの要素があります: バッチサイズとツール呼び出しは出力を実質的に変化させるため、実験の同一性の一部となります — 異なるバッチサイズでの2つの実行がフィンガープリントを共有することは**ありません**。[ベンチマーク仕様 §3.8](/docs/network/specifications/benchmark#38-fingerprint)を参照してください。

フィンガープリントが同一の2つのランは、同じセットアップを使用しています。その結果は比較可能なはずです（APIの非決定性を除く）。

### ランカードハッシュ

**ランカードハッシュ**が答える問い：*「この特定の結果ファイルは改ざんされていないか？」*

ランカードJSON全体のSHA-256です（`run_card_hash` フィールド自体は除外）。スコア、タイムスタンプ、出力の1文字でも変更されると、ハッシュが壊れます。

:::info[使い分けの目安]
**フィンガープリント**は、比較可能なラン（同じ実験、異なる実行）をグループ化するために使用します。**ランカードハッシュ**は、特定の結果ファイルの整合性を検証するために使用します。
:::

---

## リーダーボードへの公開

実行が完了したら、その実行の `<run-id>_report.json` に対して `mt-eval publish` を使用します。公開リーダーボードへの書き込みには明示的な `--prod`（または `MT_EVAL_ALLOW_PROD=1`）が必要です。`mt-eval run --publish --prod` は両方のステップを一度に実行します:

```bash
mt-eval publish eval/logs/harness/<run-id>_report.json --dry-run   # preview
mt-eval publish eval/logs/harness/<run-id>_report.json --prod      # write to the live board
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

- [MT評価](/docs/network/leaderboard/rules) — 概要、リーダーボードの提供価値、および適切な/不適切なメソッドのガイダンス
- [評価データセット](/docs/network/leaderboard/datasets) — データセット形式、EDTeKLA、FLORES+
- [ランカード仕様](/docs/network/specifications/run-card) — 完全なJSONスキーマ
- [メソッドの構築](/docs/network/specifications/methods) — 評価可能なメソッドを作成するためのメソッドインターフェース
- [メソッドリーダーボード](https://champollion.dev/leaderboard) — ライブベンチマークスコア
- [ベンチマーク仕様](/docs/network/specifications/benchmark) — 評価プロトコル、コーパス形式、ランカードスキーマ
- [スコアリング仕様](/docs/network/specifications/scoring) — メトリクスおよび実行のスコアリング方法に関する信頼できる唯一の情報源（SSOT）
