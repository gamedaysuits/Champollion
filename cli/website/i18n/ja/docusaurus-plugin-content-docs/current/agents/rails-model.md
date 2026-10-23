---
title: "レールモデル"
slug: /agents/rails-model
description: "Champollionのレール上でプロジェクトがどのように構築されているかを説明します。プロジェクトツリー、すべてのツールが読み込むスキーマ検証済みの6つのフォーマット、受け入れられた入力から測定された出力までの1つのパイプライン、データとしてのプロセス、そしてあらゆる拒否の形式について解説します。"
---

# railsモデル

rails上のプロジェクトは、プレーンなファイルのフォルダーです。すべてのツール（`champollion` CLI、`nmt-forge`、`mt-eval`、MCPサーバー）は、ネイティブに同じファイルを読み込み、同じスキーマと照合し、同じ判定を下します。次のステップは常にファイルから読み取られ、記憶されることはありません。（プロジェクトの外部に存在するものは2つだけです。MCPサーバーが自身の稼働期間中にステップの失敗回数をカウントすることと、nmt-forgeが`~/.nmt-forge`にマシン全体で1つの学習キューを保持することです。）ファイルを手動で変更してから次のステップを問い合わせると、その変更が結果に反映されます。

このページはその全体図です。運用ルールは[規約](/docs/agents/contract)に、ツール呼び出しは[MCP](/docs/agents/mcp)および[シェル](/docs/agents/shell)に記載されています。

## ツール群

| ツール | インストール | rails上での役割 |
|---|---|---|
| `champollion` | npm (Node 20.11+) | プロジェクトの開始、データの取り込み、利用条件の記録、次のステップの提示、改善ラウンドの実行、モデルとアプリの接続 |
| `nmt-forge` | PyPI (`uv tool install --python 3.12 nmt-forge`) | 学習、スクリーニング、分割、予測の記録、テストセットでのモデルのスコアリングとエクスポート、モデルの配信、台帳の管理 |
| `mt-eval` | `nmt-forge`に付属（`mt-eval-harness`パッケージ） | テストセット、ファイル、またはリクエストに対して手法を実行、ゲートの適用、スコアリング |
| `champollion-mcp-server` | npx | `champollion` CLIを制限付き子プロセスとして駆動。railsプロファイルは6つのツールで構成 |

各ツールは独自のプロセスとして実行されます。MCPサーバーは、人間が入力するのと同じコマンドを実行します（その`run_next_step`は、`champollion`、`nmt-forge`、`uv tool install … nmt-forge`以外のプログラムをすべて拒否します）。

## プロジェクトツリー

`champollion new <folder> --from <language> --to <language>`は以下を出力します：

```text
<folder>/
  champollion.project.json   project/1 — the decisions (kind, name, pair, purpose, defaults)
  README.md                  what goes where, for the people
  NEXT.md                    the next step, as a page (rewritten by `champollion next --write`)
  AGENTS.md                  the operating contract, for an AI agent working in the folder (an existing one is kept)
  .gitignore                 keeps data/, inbox/, consent/, models/, runs/, export*/, .forge/runs/, .champollion/ out of git
  inbox/                     files as the people have them
  data/parallel/             sentence pairs to learn from
  data/test/                 sentences a fluent speaker checked — never learned from
  data/lexicon/              word lists and dictionaries
  data/grammar/              grammar notes
  data/monolingual/          one-language text (kept; kept; not used for training)
  consent/                   notes recording who agreed to what, and when
```

すでにプロジェクトが含まれているフォルダー（終了コード 1）や隠しファイル以外のファイルが存在するフォルダー（終了コード 1）、および`language`以外の`kind`は拒否されます。`task`および`service`プロジェクトはまだrailsに対応していません。`--dry`は言語を解決し、何も書き込みません。

各ステップが実行されるにつれて、残りが追加されていきます：

| パス | 書き込み元 | 格納内容 |
|---|---|---|
| `<file>.champollion.json` | `champollion data add`、`data mark`、`data combine`、`improve marks` | set/1 — その隣にあるファイルの利用条件 |
| `data/combined-from/` | `champollion data combine` | combineが結合した元ファイル（移動されるのみで、削除されることはありません） |
| `data/not-for-training/` | `champollion data combine` | 保持者がモデルの学習に使用してはならないと指定したファイル |
| `.forge/` | `nmt-forge init` | ワークショップ：`eval-registry.json`、`ledger.jsonl`、事前登録、`runs/` |
| `config.json`、`NEXT_STEPS.md` | `nmt-forge init` | 学習設定（モデルのプリセットを明示的な数値に展開したもの） |
| `data/clean/` | `nmt-forge leak-audit --clean-to` | スクリーニング済みの学習ペア |
| `data/split/` | `nmt-forge split`、`champollion improve prepare` | devセット、各ラウンドの学習ファイル |
| `data/dev/practice-round-<k>.tsv` | `champollion improve marks` | 話者がdevセット用に作成した文 — ロール`dev`、ローカル限定、学習には一切使用されません |
| `improve/time.json` | `champollion improve time` | 話者自身の言葉による、話者の時間 |
| `improve/round-<k>/` | improveステップ | `wishlist.md`、`to-translate.txt`、`review.csv`、`sheet-key.json`（もう一方のモデル — 使用されていないより新しいモデル、または昇格によって置き換えられたモデル — が下書きした行：行番号、実行名、関係、各モデルの学習ペア数。そしてラウンド2以降は`repeat_rows`：再度表示された行、各`row`、`from_round`、`from_row`、およびそれ以前の`mark`）、`marks.json`（件数、その区間を伴う正解率、`blind`、および`repeats`：`shown`、`judged`、`agreed`、`agreement`、`wrong_to_right`、`right_to_wrong`、`wrong_before`、`rounds_apart_wrong_before`）、`prepared.json`、`report.json` |
| `export*/` | `nmt-forge export` | エクスポートされたモデルとそのmethod.json |
| `deploy/<name>.json` | `nmt-forge export`（railsプロジェクト内） | deployment/1 — デプロイ対象 |
| `gates/*.json` | 人手 | gate-chain/1 — 出力と実際に出荷されるものの間のチェック |
| `methods/<id>/method.json` | 人手 | method/1（`nmt-forge export`によってモデルフォルダー、`mt-eval export`、`champollion serve --emit-manifest`にも書き込まれます） |

## フォーマット

`shared/schemas/framework/`には6つのフレームワークスキーマが存在します。各ドキュメントは`$schema`で自身のスキーマを指定します。未知のキーは拒否されます。独自のキーは`x-`の下に配置します。

| フォーマット | `$schema` | 場所 | 概要 |
|---|---|---|---|
| project/1 | `https://champollion.dev/schemas/project/1.json` | `champollion.project.json` | 決定事項のみ：`kind`、`name`、`pair`、`purpose`、`defaults`、`created_with` |
| set/1 | `https://champollion.dev/schemas/set/1.json` | `<file>.champollion.json` | データファイルの利用条件：`transmission`、`role`、`kind`、`pair`、`fields`、`terms`、登録フィールド、`derived_from`、`holders_agreed` |
| method/1 | `https://champollion.dev/schemas/method/1.json` | `method.json` | 1つの手法：`id`、`name`、`kind`と該当種別の単一設定、`pairs`、`decode`、`card`、`evidence` |
| gate-chain/1 | `https://champollion.dev/schemas/gate-chain/1.json` | `gates/*.json` | 順序付きの`metric-threshold`ゲートと任意の`fallback` |
| deployment/1 | `https://champollion.dev/schemas/deployment/1.json` | `deploy/*.json` | 1つの手法、そのゲート、1組の言語ペア。任意の`serve`ホストとポート |
| service-api/1 | `https://champollion.dev/schemas/service-api/1.json` | `/translate`の規約 | リクエスト、レスポンス、エラー、`/health`ドキュメント |

`project.defaults` — 特に指定がない場合に、プロジェクトに追加されたデータに付与される設定です。`champollion new`は `{"transmission": "local-only", "training": "ask", "share_scores": "ask"}`. The values: `transmission` は `local-only` または `ask`、`training` は `allowed`、`not-allowed`、または `ask`、`share_scores` は `never` または `ask` を書き込みます。`ask` を指定するとツールは処理を停止して確認を求めます — railsが勝手に答えを作り出すことは決してありません。

さらに2つの記録があり、これらはフレームワークスキーマではありませんが、モデルの一部を構成しています：

- **forge台帳**（`.forge/ledger.jsonl`）：追記専用（append-only）でハッシュチェーン化されています（各エントリに直前のエントリのハッシュが埋め込まれており、改ざんがあると`nmt-forge ledger verify`が失敗します）。登録、登録済みセットのすべての読み取り、事前登録、スコア、封印セットの消費、オーバーライド、漏洩監査の判定、辞書の最低保証（dictionary floor）、エクスポート、選択、提供、ラウンドの判定（`improve-compare`：50文の開発セット未満での`better`、`worse`、`no-change`、または`too-few`）、各ラウンドのトレーニング方法（`round-plan`）、レビューシート用のもう一方のモデルの下書き（`draft-newer`：実行名、`relation`、各モデルのトレーニングペア数および下書きの数）、より新しいモデルに対する話者のブラインド判定（`improve-speaker`：実行名、4つのカウント、`z`、`clear`）、モデルの変更（`model-change`、`not-now`を含む）、そして`nmt-forge tidy`が削除した内容（`tidy`：実行とバイト数）を記録します。記録されるのはカウント、ハッシュ、パスであり、文そのものが記録されることは決してありません。これは改ざん検知が可能な記録管理であり、暗号論的セキュリティではありません。
- **実行カード（run card）**：スコア測定された実行に対して`mt-eval run`が記録するもの、および公開された結果に付随するものです。[実行カード仕様](/docs/network/specifications/run-card)を参照してください。

**ロック。** `champollion validate [folder]`は、プロジェクトファイル、すべてのサイドカー、すべての`method.json`（ルート、`methods/*/`、`.champollion/methods/*/`内）、`gates/*.json`、`deploy/*.json`をこれらのスキーマと照合してチェックします。ハーネスも同じファイルを読み込み、同じ判定を下します。終了コード 0 = エラーなし、1 = 無効なドキュメントが存在、2 = 使用法エラー。対象とするのはこれらのJSONファイルのみであり、データファイルを開くことは決してありません。

`champollion upgrade [folder]`は、set/1より前に書かれたサイドカー（`$schema`なし）をすべての値を保持したままset/1として書き直します（set/1が認識しないキーは`x-<key>`の下に移動します）。無効なサイドカーには手を加えず、古い`method.json`は変更せずに一覧表示します。すべてのツールは、警告を発しつつも引き続きそれをmethod/0として読み取ります。

## 統合パイプライン

手法がテキストを処理するあらゆる方法は、評価エンジン内の1つのパイプラインに集約されています：

1. **受け入れ（Admit）：** 何かを翻訳する前に、入力の利用条件（set/1サイドカー、JSONエンベロープ、レジストリエントリ）が読み取られ、その送信ポリシーが解決・適用されます。ポリシーで許可されていないチャネルはここで拒否されます（[データルール](/docs/agents/data-rules)を参照）。
2. **手法（Method）：** 1つの手法が翻訳を行います（method/1の種別：`llm`、`llm-coached`、`mt-api`、`local-model`、`nmt-checkpoint`、`lexicon`、`python`、`service`、`human`）。
3. **ゲート（Gates）：** ゲートチェーンが指定されている場合、各セグメントが判定されます。拒否した最初のゲートによって、何を出荷するかが決定されます（`drop`、`keep-source`、`flag`、`fallback`）。[手法とゲート](/docs/agents/methods)を参照してください。
4. **出力（Outputs）：** 実行ログが書き出されます。マークされた入力から切り出されたファイルには、その利用条件が隣接するサイドカーとして保持されます。
5. **指標（Metrics）：** 参照訳が存在する場合にのみ算出されます。出荷されたものを主見出しスコアで評価し、ゲート適用前のスコアがその横に並びます。[測定](/docs/agents/measurement)を参照してください。

各モードは、異なる入力に対して同じパイプラインを適用したものです：

| モード | コマンド | 入力 | 指標 |
|---|---|---|---|
| 測定 | `mt-eval run`（`mt-eval test`は実行ログを再スコアリング） | テストセットまたは開発セット | あり |
| ファイル翻訳 | `mt-eval translate --out <file>` | 原文のみ | なし |
| 配信（Serve） | `mt-eval serve` | 1回につき1リクエスト | なし |

**デプロイとは、原文のみの入力に対する測定パイプラインのことです。** 単一のdeployment/1ファイルがテストされ（`mt-eval run --deployment`）、ファイルに対して実行され（`mt-eval translate --deployment`）、配信される（`mt-eval serve --deployment`）ため、測定された通りのものが出荷されます。`--deployment`を使用すると、ファイル側で決定されるフラグ（`--method`、`-m`/`--model`、`--gates`、`--target-script`）は拒否されます。デプロイにはスコアは記載されません。測定された数値は実行結果であり、実行単位で保持されます。[配信](/docs/agents/serving)を参照してください。

## データとしての工程

作業の順序はファイルとして定義されています：`shared/journeys/language.json`。評価エンジンである`cli/lib/framework/journey.js`が唯一の読み取り役であり、`champollion next`、MCP railsプロファイル、`NEXT.md`はすべてこれに対して同じ質問を投げかけます。**まだ完了していない最初のステップが「次のステップ」になります。** これが読み取るのはサイドカー、プロジェクトファイル、forgeのレジストリおよび台帳のみであり、データファイルの本文を読むことは決してありません。また、インストールステップでの`nmt-forge --version`（上限30秒）および学習段階に達した際の`nmt-forge status --json`（上限60秒）を除き、何も実行しません。

**ステージ：** `start` → `gather` → `protect` → `tools` → `build` → `improve`。

**ステップ**には、`id`、`stage`、`mode`、人間に伝える平易な説明文（`say`）、なぜそれが重要なのか（`why`）、そして通常は`command`が含まれます。オプションのフィールドは以下の通りです：

| フィールド | 意味 |
|---|---|
| `done_when` | ステップが完了したことを判定するチェック。必須（委譲ステップを除く） |
| `when` | そもそもステップが適用されるために満たされるべきチェック（例：辞書基準値は`data/lexicon/`にファイルが存在する場合にのみ適用） |
| `question`、`answers` | `ask_user`ステップの質問とその回答枠：`{"enum": [...]}`または`{"type": "string", "say": "…"}` |
| `agent`、`agent_tool` | 人間のステップに対してエージェント自身が実行する処理（`add_data`で指定されたファイルを取り込む） |
| `outdated` | チェックによってツールが古すぎると判明した際に使用されるバリアント |
| `delegate` | `"nmt-forge"`：forge自身のアドバイザーに引き渡す |

`say`、`question`、`command`内の`{placeholders}`は、プロジェクトファイルおよび見つかったファイルから入力されます。

**チェック**は限定された集合であり、未知のチェックに対して評価エンジンは例外をスローします：
`project_valid`、`data_files`、`every_data_file_has_terms`、
`protected_test_set`、`tool_on_path`（`min_version`を伴う）、`path_exists`、
`forge_test_registered`、`single_file`、`forge_role_registered`、
`forge_ledger_event`、`screened_rows`、`lines_in_file`、`review_marked`、
`improve_prepared`、`forge_trained_on_current`。

**モード：**

| モード | 行動主体 | railsが許可すること |
|---|---|---|
| `auto` | エージェント | コマンドを実行 |
| `confirm` | エージェント（承諾後） | インストール、学習、費用消費や公開を伴うあらゆる処理。人間が承諾した後にのみ実行 |
| `ask_user` | 人間が回答 | `question`を質問。回答を`answers`のキーで渡す。エージェントが代わりに回答してはならない |
| `wait` | なし | 処理が実行中。後でもう一度問い合わせる |
| `human_only` | 人間 | 文の収集、下書きのチェック、選択 |
| `use_tool` | エージェント（自身のツールを使用） | MCP限定：`agent`フィールドを持つ`human_only`ステップは、`step.tool`を伴う`use_tool`として表示 |

**委譲。** `forge`ステップにおいて、工程は `nmt-forge status --json` に問い合わせを行い、forgeの状態をステップとして扱います。forgeの状態は各モードにマッピングされます：
`training` → `wait`、`ready-to-train`および`needs-training-extra` → `confirm`、
`missing-preregistration` → `ask_user`、`choose-export` → `human_only`、
`improve-compare` → `auto`、`improve-promote` → `confirm`、
`improve-stronger-model` → `ask_user`。その他の状態は、forgeがコマンドを指定している場合は`auto`、指定していない場合は`human_only`となります。状態が`serving`になるとビルドステージが終了し、改善ステージが始まります。

2種類のステップが、ステップリストの外部から生じます：

- **予測の判定：** テストセットでスコアリングされたエクスポートの後、人々が自身の言葉で書いた予測に対する判定待ちとなります。これは`answers`として`verdict`（`held`または`missed`）および`by`（誰が判定したか）を持つ`ask_user`ステップであり、`nmt-forge prereg verdict`を実行します。
- **合意の待機：** サイドカーに `speakers_agreed: not-yet` becomes its own `ask_user` question in `waiting` と記載されているすべてのファイルは、人間に回答の準備ができたときに自身のステップIDで回答されます。これがrailsの他の処理を滞らせることは決してありません。

**ステップID**は`<journey step id>:<8 hex characters>`であり、ステップとその入力済みコマンドのハッシュ値です。プロジェクトが変更されるとIDも変更され、古いIDによる`run_next_step`は拒否されます（`the project changed since that step was named`）。

**`champollion next --json`の戻り値：** `project`、`kind`、`stage`（`n`、`of`、`id`、`title`）、`done`（ステップID）、`step`（`id`、`mode`、`say`、`why`、および存在する場合は`command`、`question`、`answers`、`agent`、`agent_tool`、`file`、`source`）、`now`（forgeのファクト — 現在何が真であるか）、`waiting`、`forge`（`state`、`blockers`、`warnings`）、`finished`（残りのステップがない場合）、および`error`。エラーが発生しステップが存在しない場合の終了コードは 1 です。

## 拒否の形式

すべての拒否通知には何が起きたかが示され、その多くには理由と対処方法が記載されています。

| ツール | 人間向け出力 | 機械向け出力 | 終了コード |
|---|---|---|---|
| `nmt-forge` | `[guard] message`、続いて`  why: …`と`  fix: …` | `--json`: 標準出力に`{"error": {"type", "guard", "message", "why", "fix", "how_to_get", "text"}}` | 2（拒否） |
| `champollion` | 標準エラー出力に`[ERR] message` | コマンドがサポートしている場合は`--json` | 1（拒否）、2（使用法エラー） |
| MCP railsツール | — | `isError: true`を含む`{"refused": "<reason>", …}`、および再試行可能な場合はその情報（`if_it_has_no_code`、`current`、`last_output`、`question`、`answers`） | — |

forgeのエラーに含まれる`type`は例外クラスです（不正な引数の場合は`UsageError` — forgeは推測するのではなく省略形のフラグを拒否します）。forgeのガード名には、`split-guard`、`dev-fence`、`leak-audit`、`preregister`、`eval-ledger`、`ci-scoring`、`registry`、`improve-loop`、および`disk-room`（ディスクに収まりきらないトレーニング実行）が含まれます。エラーによって保持されたコーパスの文が引用されそうになると、文は`[sentence withheld]`と表示され、オブジェクトに`text_withheld`が追加されます。

拒否の理由は平易な言葉で伝え、提示された修正手順に従うか、次のステップを再度問い合わせてください。2回失敗したステップは、人間が判断を下すまで再実行されません（[MCP](/docs/agents/mcp#when-a-step-fails)を参照）。

## さらに詳しく

- [運用規約](/docs/agents/contract) — ルール、ロック、注意事項。
- [MCP経由でのrailsの駆動](/docs/agents/mcp)および[シェルからの駆動](/docs/agents/shell)。
- [データおよび送信ルール](/docs/agents/data-rules) — set/1の詳細。
- [手法とゲート](/docs/agents/methods)および[配信](/docs/agents/serving) — method/1、gate-chain/1、deployment/1、service-api/1。
- [実行カード仕様](/docs/network/specifications/run-card)および[ハーネス仕様](/docs/network/specifications/harness)。
- [`mt-eval`コマンドリファレンス](/docs/reference/mt-eval)および[`nmt-forge`コマンドリファレンス](/docs/network/getting-started/forge-command-reference)。
