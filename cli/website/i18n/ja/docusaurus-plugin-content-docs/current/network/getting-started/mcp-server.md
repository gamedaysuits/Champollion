---
title: "MCPサーバー — エージェント向けの入り口"
sidebar_label: "MCPサーバー"
description: "Model Context Protocolを介してAIエージェントをChampollionに接続します。プロファイルは2種類あります。railsプロファイル（デフォルト）は6つのツールで1つの言語プロジェクトを進め、`--profile full` では言語の検索、ベンチマークキューやコーパスレジストリの閲覧、評価の実行、モデルの学習とエクスポート、翻訳を行う34個のツールを提供します。あわせて、npx install 以上の準備が必要なツールについても具体的に説明します。"
---

# MCPサーバー — エージェント向けの窓口

`champollion-mcp-server`は、[Model Context Protocol](https://modelcontextprotocol.io)を介して、stdio経由でAIエージェントにChampollionを提供します。2つのプロファイルがあります：

| プロファイル | 起動方法 | 提供するもの | 設計対象 |
|---|---|---|---|
| **rails**（デフォルト） | `npx -y champollion-mcp-server` | 6つのツール：`start_project`、`project_status`、`run_next_step`、`add_data`、`try_translation`、`explain` | 空のフォルダーから本人のコンピューター上での評価済みモデルまで、1つの言語プロジェクトを一歩ずつ導く |
| **full** | `npx -y champollion-mcp-server --profile full`（または`CHAMPOLLION_MCP_PROFILE=full`） | 34のツール、3つのリソース、4つのプロンプト | 探索、ベンチマーク、段階的な訓練、翻訳、そしてネットワーク |

誰かが自身の言語向けの翻訳ツールを構築するのを支援する場合は、railsプロファイルを使用してください。その動かし方は[MCP経由でrailsを操作する](/docs/agents/mcp)に、従うべきルールは[運用規定](/docs/agents/contract)に記載されています。

ここにあるすべてのものはプレーンなHTTP経由でもアクセスできます（[機械可読なエンドポイント](#machine-readable-endpoints)を参照）。ただし、単に読み取るだけでなく、エージェントが*行動する*（翻訳する、ベンチマークを実行する、モデルを訓練する）ことができるのはMCPサーバーのみです。

## インストール

```bash
npx -y champollion-mcp-server
```

次に、クライアントに登録します。Claude Codeの場合：

```bash
claude mcp add champollion -- npx -y champollion-mcp-server
```

ファイルで設定するクライアント（Claude Desktop、Cursor、Antigravity）の場合は、以下を追加してください：

```json
{
  "mcpServers": {
    "champollion": {
      "command": "npx",
      "args": ["-y", "champollion-mcp-server"]
    }
  }
}
```

fullプロファイルを使用する場合は、`args`内のパッケージ名の後ろに`"--profile", "full"`を追加するか、`claude mcp add`コマンドの末尾に`--profile full`を付けてください。

## railsプロファイル（デフォルト）

6つのツールは、空のフォルダーから本人のコンピューター上での評価済みモデルまで、1つの言語プロジェクトを一歩ずつ導きます。各ステップでは呼び出すべき正確なツールが示され、本人のみしか答えられないすべての質問（ファイルを誰が保持しているか、モデルがそこから学習してよいか、そのテキストがコンピューターの外部に出てよいか、何を期待しているか、結果が十分優れているか）は本人に確認されます。ツールが返すのは件数と列情報のみで、文章を返すことはありません。すべてのツールは、本人が入力するのと同じコマンドライン（`champollion`）を個別の区切られたプロセスとして実行します。このプロファイルは、短い指示で動作する小型のエージェント向けに作られています。

| ツール | 引数 | 機能 |
|---|---|---|
| `start_project` | `folder`, `from`, `to`, `target_name?`, `source_name?`, `purpose?`, `parent_dir?`, `confirmed?` | プロジェクトを作成します（`champollion new`）。最初の呼び出しでは何も作成せず、`ask_first`を返します。その指示を本人に伝え、その回答に沿って指定された呼び出しを行います |
| `project_status` | `project_dir`, `wait_seconds?`（最大120） | ファイルから読み取った次のステップ（`champollion next --json`）：そのモード、伝える内容、理由、およびそれを実行する正確な呼び出し |
| `run_next_step` | `project_dir`, `step_id`, `answers?`, `confirmed?` | `project_status`が指定したステップを実行します。`confirm`ステップには本人が同意した後の`confirmed: true`が必要です。`ask_user`ステップには本人自身の回答が必要です。`human_only`および`wait`ステップは拒否され、代わりに何をすべきかが返されます |
| `add_data` | `project_dir`, `path`, `into?`（`parallel`、`test`、または`lexicon`）, `source_col?`, `target_col?`, `sheet?`, `header?`, `usfm_source?`, `replace?` | ファイルをその場から取り込み（スプレッドシート、Wordの表、ToolboxやLIFT辞書、ELANファイル、またはUSFM聖書テキスト：`champollion data add`）、件数と列情報のみを報告し、文章は決して報告しません |
| `try_translation` | `project_dir`, `text`（最大10行） | プロジェクトが提供するモデルを使って本人の文章をいくつか翻訳します。ローカル限定の文章から学習したモデルの場合、モデル自身のページのアドレスを返し、テキストは決して返しません |
| `explain` | `topic`: `rails`、`privacy`、`quality`、`modes`、`improve`、または`off_rails` | 本人に伝えるための分かりやすい言葉での説明 |

## fullプロファイル

以下はすべて**fullプロファイル**についての説明です。探索、ベンチマーク、およびネットワークのための全ツールが含まれます：

```bash
npx -y champollion-mcp-server --profile full
```

## ご利用の前にお読みください

**fullプロファイルでは、34個のツールのうち14個は素の`npx`インストールから動作し、`translate`はエンジンが設定されれば動作します。残りの19個は、npmパッケージには同梱されておらず同梱もできないPythonパッケージを必要とします。** これらはサイレントに失敗することはありません。不足しているものを明示した実行可能なエラーを返します。ただし、計画を立てる前に全体の構成を把握しておく必要があります。

| ツール | `npx`後に動作するか？ | その他に必要なもの |
|---|---|---|
| `search_languages`, `get_language`, `language_overview`, `list_corpora`, `get_results`, `get_run_card`, `get_metric_reliability`, `list_contests`, `get_contest`, `get_project_info`, `list_queue`, `get_queue_item`, `estimate_cost`, `get_training_guardrails` | **はい** — 読み取り専用、公開エンドポイントから提供 | なし |
| `translate` | **はい**（エンジンありの場合） | 選択したエンジンのAPIキー — または、メソッド`local`と自身のマシン上のモデルサーバーを使用する場合は不要 |
| `run_benchmark`, `get_run_status`, `preview_publish`, `publish_report` | いいえ | 評価ハーネス — `pipx install mt-eval-harness` |
| 15個の`forge_*`ツール | いいえ | NMT Forge 0.2.0以降 — `python3 -m pip install nmt-forge`（訓練と配信を行うには`'nmt-forge[hf]'`を追加）。評価ハーネスが付属しており、言語カードも自動で見つけるため、クローンは不要です |

いずれの操作にも、リポジトリのクローンは不要です。

## ツールの機能

**作業の一覧確認とコスト見積もり。** `list_queue`と`get_queue_item`は、未処理のベンチマークキュー（マップの改善に最も寄与する測定の優先順位付きリスト）を確認します。`estimate_cost`は、費用をかける前に一連の実行の価格を見積もります。

**情報の検索。** `search_languages`は、名前、コード、語族、または地域で言語カードを検索し、多少の表記揺れも許容します。各検索結果には、その言語が話されている地域（国、地図上の座標、大地域）や他の名称も表示されます。これらはカードに出典が明記されている事実のみであり、それぞれに出典が付いているため、名前の似た言語を見分けることができます。出典のない場所は決して表示されず、その旨が記載され、代わりにその言語のGlottologレコードへのリンクが示されます。champollion.devの公開カードテーブルから取り込まれたカード（npmインストール環境における同梱コアセット以外の全言語）には、まだ項目ごとの出典が含まれていません（テーブルの次期アップロードで追加予定）。そのため、これらの行には場所の代わりにGlottologへのリンクが含まれます。`language_overview`は、特定の言語向けの開発を始めるための1ページの出発点です。既存のリソース、実行可能なもの、次のステップが示されます。`get_language`は、出典付きの完全なカードを返します。`list_corpora`は、言語ペアまたはベンチマークファミリに登録された評価コーパスの一覧を表示します。メタデータのみ（サイズ、ライセンス、汚染グレード、およびハーネスが取得可能か、アクセストークンが必要か、検疫中か）が返され、コーパスの内容自体は決して返されません。すべてのコーパスが検疫中の言語ペアの場合は、サポートされていないように見せるのではなく、その旨が明記されます。`get_results`と`get_run_card`は、公開リーダーボードからスコア付きの実行結果を読み取ります。`get_metric_reliability`は、多くのエージェントが間違えやすい質問（*この対象言語にはどの評価指標を信頼すべきか*）に対して、語族ごとの人間による評価との相関関係に基づいて答えます。`list_contests`と`get_contest`は、コンテストとその規定条件を表示します。コンテストへのエントリーは人間が承認するCLIステップであり、ツールによって行われることはありません。

**アクションの実行。** `translate`は、翻訳メモリ（重複はコストゼロ）と決定論的品質ゲートを備えた、テスト済みのパイプラインを通じてテキストを処理します。すべての応答には、実際に実行されたエンジン名と、設定されている場合はそのモデルおよびエンドポイントが記載されます。
`run_benchmark`は評価を開始し、**即座にジョブID**を返します。実際の実行はクライアントのタイムアウトよりも長くかかるためです。そのIDを使って`get_run_status`をポーリングします。ジョブはサーバーが再起動しても維持されます。実行は継続され、再起動後に同じIDをポーリングしてもステータスと結果が返されます。`publish: true`を渡さない限り、何も公開されません。実行計画には何が公開されるかが示されます（すべての行と文章テキスト、またはスコアのみ、プロンプト全文かそのハッシュのみ、および公開先）。実際の公開には、計画に示された正確な文言による`publish_ack`が必要であり、ユーザーが事前に確認できるように設計されています。これなしで実行された結果も、同じ安全策の下で後から公開できます。`preview_publish`は読み取り専用です。ハーネス自身の公開プレビュー、正確な文言、および公開を行うための正確な`publish_report`呼び出しを表示しますが、これ自体が公開を行うことはできません。MCPアノテーション`readOnlyHint: true`が付与されているため、書き込みのたびに確認を求めるエージェントホストでも、自動で許可できます。`publish_report`は書き込みを実行し（`destructiveHint`および`openWorldHint`のアノテーション付き）、`scores_only`は文章テキストの公開を差し控えます。すべての計画は、対象言語の`EVAL PACK:`ステータス（`missing`（インストール用コマンド付き）、`ready`、または`none needed`）で始まり、実行が`--yes`を通過するため、コーパスのライセンスとその`do_not_train`条件が記載されます。FST（アナライザーまたはそのpyhfstランタイム）が不足していても実行が停止することはありません。そのまま進行し、実行カードにはFST受容度が未計算として記録されます。それ以外の不足要素がある場合、翻訳を行う前に実行が停止します。`skip_fst`と`skip_eval_standard`は、これらの要素なしでスコアを計算し、実行カードには何が除外されたかが記録されます。また計画には、COMETが計算されるかどうかも記載されます（`unbabel-comet`がインストールされていればハーネスは常に計算し、`comet: true`を指定すると実行にCOMETが必須となります）。`metricx`と`fuse`は、ハーネスのオプトイン機能であるMetricX-24およびFUSEスタイルの比較評価を要求します。それぞれについて計画には、ハーネスの情報に基づいて、インストールされているか、何をインストールすべきか、何をダウンロードするかが示されます。ハーネスが計算できないメトリクスを要求して確定された実行は、そのメトリクスなしで実行されるのではなく、拒否されます。計画の`Results:`行と`Cache:`行には、実行ログ、レポート、および翻訳キャッシュの出力先が示されます。`mt-eval contest prepare`が公開可能としているフォルダー（コンテストの`public/`）内にあるテストファイルは、代わりにコンテストの`runs/`フォルダー内へと出力されるため、実行によって書き込まれたものが一緒に公開されることはありません。自身のマシン上のモデル（ローカルサーバー、またはハーネスがインプロセスで実行し証明書の不要な`method: "local-model"`）は、`$0 API cost (runs on this machine)`として報告されます。

**自己欺瞞のない訓練。** `get_training_guardrails`は、実際に測定された失敗事例から抽出されたルールを返します。15個の`forge_*`ツールは、保護されたステップを1つずつ進めながら[NMT Forge](/docs/agents/training)を実行します。最初および各ステップの後に実行する`forge_status`（次のコマンドとそれを実行するツールを指定します）、拒否される前にコマンドがどのゲートに抵触するかを確認する`forge_preflight`、テストスコアが存在する前（かつテストセットでのベンチマーク前：スコアの読み取りを行うと以後の事前登録がブロックされます）に予測を記録する`forge_prereg_template`および`forge_prereg`、テストセットを一度だけスコア評価して訓練済みモデルをパッケージ化する`forge_export`、2つのモデルをA/Bテストし勝者の横にそれぞれのほぼ重複（near-twin）に関する注意書きを表示する`forge_compare`、そしてforgeでは判定できない予測（自由形式テキストの範囲）に対するユーザー自身の判定を記録する`forge_prereg_verdict`（計算値としてではなく、人間による判定として表示されます）。`forge_status`は、訓練されたすべての実行を開発セットのスコアとともに一覧表示し、開発セットが飽和している（開発スコアが完璧でチェックポイント選択の余地がない）場合にその旨を示します。評価ハーネスがテストスコアに注意書きを付けた場合（例えば、ほぼ一定の出力：すべてのソース文に対してごくわずかな決まった出力しか返さないなど）、`forge_export`、`forge_status`、`forge_compare`、`forge_lint`はハーネス自身の言葉でそれを伝え、重大なものは次のステップの冒頭に提示されます。注意書きなしでスコアが引用されることは決してありません。拒否された場合は、何が問題だったか、なぜそれが重要なのか、そして修正方法が返されます。ツールの呼び出し時間を超えて持続する2つのステップは、代わりにターミナルで実行されます。訓練（`nmt-forge run`）と、エクスポートされたモデルの配信（`nmt-forge serve`：`translate`やCLIで使用可能なローカルエンドポイントの配下に配置されます）です。

### 引数

`name`は必須、`name?`は任意です。1つの言語を受け取るすべてのツールは、`language`としても受け付けます。「`code`または`language`」はどちらの名前でも機能することを意味し、いずれか1つを渡します。元の名前も引き続き使用可能です。

| ツール | 引数 |
|---|---|
| `search_languages` | `query`または`language`, `limit?` |
| `language_overview` | `code`または`language`, `source?` |
| `get_language` | `code`または`language`, `format?` |
| `list_corpora` | `source_language?`, `target_language?`, `family?`（これら3つのうち少なくとも1つ）, `include_quarantined?`, `limit?` |
| `get_results` | `source_language?`, `target_language?`, `model?`, `sort?`, `limit?` |
| `get_run_card` | `id` |
| `get_metric_reliability` | `target`または`language` |
| `list_contests` | `status?`, `language?`, `limit?` |
| `get_contest` | `id` |
| `get_project_info` | なし |
| `list_queue` | `language?`, `source_language?`, `model?`, `budget?`, `condition?`, `limit?` |
| `get_queue_item` | `id?`または`priority?`（いずれか1つ） |
| `estimate_cost` | `budget?`, `language?`, `source_language?`, `model?`, `condition?` |
| `get_training_guardrails` | `topic?` |
| `translate` | `texts`, `source_language`, `target_language`, `method?`, `model?`, `base_url?`, `endpoint?`, `register?`, `project_dir?`, `context?`（gettextのmsgctxt：すべてのテキストに対して1つ、またはテキストごとに1つ）, `script?`, `use_tm?`, `validate?` |
| `run_benchmark` | いずれか1つのモード：`budget?`または`top?`（キュー）、`item_id?`、または`model?`を伴う`corpus?`（プラグインが読み込むモデルである`method_dir`を伴う）、`method?`または`method_dir?`（メソッドプラグインのディレクトリ。`local-model`にはデフォルトがないため`model`が必要）、`allow_model_pair_mismatch?`（`local-model`：別のペア名を冠したOPUS-MTペアモデルを近縁言語のベースラインとして実行）、`attest_local_transport?`（MTエンジンまたはプラグイン。`local-model`には不要）、`provider?`、`base_url?`、`target_language?`、`script?`（LLM実行：出力を記述する必要があるISO 15924文字体系（例：`Cans`や`Latn`）。対象言語のカードに複数記載されている場合は計画に明記されます）、`source_language?`、`source_field?`、`target_field?`、`max_cost?`、`coaching_file?`、`glossary?`、`attest_no_training?`、`accept_nc_terms?`、`skip_fst?`および`skip_eval_standard?`（アイテムおよびコーパス実行：FSTまたは標準評価メトリクスなしでスコアリングし、未計算として記録）、`comet?`（COMETを必須化：インストールされていない場合は実行を拒否）、`metricx_model?`を伴う`metricx?`、および`fuse?`（アイテムおよびコーパス実行：ハーネスのオプトイン機能であるMetricX-24およびFUSEスタイルの比較評価、未インストールの場合は拒否）。その後、`dry_run?`、`confirm?`、`publish?`、`publish_ack?`（実際の公開時：計画に表示された正確な文言）、`anonymous?` |
| `get_run_status` | `job_id?` |
| `preview_publish` | `report`（完了した実行の`*_report.json`）, `scores_only?`, `redact_coaching?`, `anonymous?`（読み取り専用：`confirm`はなく、公開はできません） |
| `publish_report` | `report`（完了した実行の`*_report.json`）, `scores_only?`, `redact_coaching?`, `anonymous?`, `confirm?`, `publish_ack?`（プレビューに表示された正確な文言） |
| `forge_status` | `workspace?`, `project_dir?` |
| `forge_preflight` | `target`（チェックするコマンド）, `config?`, `workspace?`, `project_dir?` |
| `forge_discover` | `code`または`language`, `cards_dir?`, `workspace?`, `project_dir?` |
| `forge_init` | `code`または`language`, `dir?`, `pair?`, `model?`, `base?`, `no_card?`, `name?`, `cards_dir?` |
| `forge_split` | `corpus`, `test`, `seed`, `out?`（デフォルトは`data/split`、`forge_init`のconfig.jsonが読み込むパス）, `dev?`, `register?`（名前のプレフィックス、または`project`の場合は`true`）, `allow_rotate?`, `near_dupe?`（forgeがほぼ重複の除外を推奨する場合のJaccard閾値（例：0.6））, `max_group?`（`near_dupe`とともに指定：ほぼ重複する最大のグループ）, `workspace?`, `project_dir?` |
| `forge_leak_audit` | `corpus`, `strict?`, `clean_to?`, `drop_test_twins?`（独自の`clean_to`（例：`corpus.notwins.jsonl`）を指定。全データファイルは不可）, `companion_config?`（`drop_test_twins`とともに指定：重複のないモデルの設定の出力先。デフォルトは`config-notwins.json`）, `overwrite?`（設定、実行、分割、または別の監査で使用されている`clean_to`ファイルを置き換える。指定しない場合は拒否されます）, `full_indices?`（すべての行番号リストを完全に出力。デフォルトでは長いリストは`{count, first}`として返されます）, `workspace?`, `project_dir?` |
| `forge_register_eval` | `name`, `path`, `role`, `source_field?`, `target_field?`, `allow_rotate?`, `workspace?`, `project_dir?` |
| `forge_prereg_template` | `out?`, `force?`, `project_dir?` |
| `forge_prereg` | `id`, `eval_set`, `predictions`, `author?`, `config_hash?`（特定の実行に固定）, `allow_after_reads?`（そのセットのスコア読み取り前に記録された予測のみ）, `workspace?`, `project_dir?` |
| `forge_prereg_verdict` | `id`, `prediction`（その番号、または固有のID）, `verdict`（`held`または`missed`）, `by`（判定者）, `note?`, `revise?`, `workspace?`, `project_dir?` |
| `forge_export` | `run_manifest`, `out`, `config?`, `no_eval?`, `no_model?`, `glossary?`, `endpoint?`, `port?`, `name?`, `force?`, `prereg?`, `workspace?`, `project_dir?` |
| `forge_evaluate` | `run_manifest`, `config?`, `out_hyps?`, `harness_out?`, `glossary?`, `prereg?`, `workspace?`, `project_dir?` |
| `forge_lint` | `manifest`, `run_manifest?`, `workspace?`, `project_dir?` |
| `forge_report` | `manifest`, `workspace?`, `project_dir?` |
| `forge_compare` | `eval_set`, `hyps_a`, `hyps_b`, `label_a?`, `label_b?`, `run_a?`, `run_b?`（各モデルの実行マニフェスト：訓練データがほぼ重複していないかチェックされます）, `metric?`, `target_lang?`, `config_hash?`, `prereg?`, `override_respend?`, `workspace?`, `project_dir?` |

たとえば、`get_metric_reliability { "language": "crk" }`と`get_metric_reliability { "target": "crk" }`は同じ問い合わせを行います。

### デプロイしたモデルでの翻訳

`nmt-forge serve`は、配信するモデルに対して2つのアドレスを表示します。`translate`をいずれかのアドレスに向けて設定してください：

| 引数 | 組み合わせる対象 | 例 |
|---|---|---|
| `base_url` | `method: "local"` — OpenAI互換サーバー（`"openai"`も同様） | `http://127.0.0.1:8378/v1` |
| `endpoint` | `method: "api"` — champollionのAPI仕様 | `http://127.0.0.1:8378/translate` |
| `model` | LLMエンジン専用。プロンプトを持たない機械翻訳APIでは拒否されます | `llama3.1` |
| `project_dir` | すべてのメソッド — そのプロジェクトの翻訳メモリを使用 | `~/my-app` |

自身のマシン上のサーバーにはキーが不要です。リモートの`api`エンドポイントは、サーバー環境の`CHAMPOLLION_API_KEY`からキーを読み取ります。ツールは認識できない引数を無視するのではなく名前を挙げて拒否するため、引数の綴り間違いによってテキストが意図せず別のモデルに送信されるのを防ぎます。

### サーバーの状態の保存場所

すべてのデータは`~/.champollion-mcp/`に保存されます（移動するには`CHAMPOLLION_MCP_HOME`を設定してください）：

- **`translate`の翻訳メモリ**は、そのフォルダー内の固有のファイル`.champollion/tm.json`です。プロジェクト固有の`.champollion/tm.json`とは分離されています。代わりにプロジェクトのファイル（`champollion sync`が使用するもの）を使う場合は、`project_dir`を渡してください。
- **`run_benchmark`のジョブ**は`jobs.json`に記録され、最新の50件が保持されます。各ジョブには`jobs/`内にフォルダーがあり、出力結果と、キューアイテムまたは登録コーパスの場合はハーネスの結果が保存されます。手元にあるテストファイルに対する実行結果とキャッシュは、そのファイルの横の`results/`に書き込まれます。ただし、`mt-eval contest prepare`によって公開可能とマークされたフォルダー内のファイルは例外で、コンテストの`runs/`フォルダーに書き込まれます。そのような実行はそこに固有の`mcp-run-<id>/`フォルダーを作成し、`get_run_status`はそれらすべてを対象とする`mt-eval compare`コマンド（`results/mcp-run-*/*_report.json`）を表示します。キューの実行結果のレポートは、ハーネスの通常の動作どおり、サーバーの作業フォルダー下の`eval/logs/harness/queue/`に書き込まれます。

:::note[制限のない支出を防ぐ設計]
`run_benchmark`は**上限のないキュー実行を拒否します。** `budget`、`top`、または特定の`item_id`のいずれか1つの制限を必ず指定する必要があります。キューを誤解したエージェントが無制限に支出してしまうのを防ぐため、「単にキューを実行する」呼び出しは存在しません。
:::

## プロトコルバージョン

トランスポートは**stdioのみ**です — エージェントごとに1つのサーバープロセスが動作します。

MCPの[2026-07-28リビジョン](https://blog.modelcontextprotocol.io/posts/2026-07-28/)では、プロトコルがデフォルトでステートレスになり、`initialize`ハンドシェイクと`Mcp-Session-Id`ヘッダーが廃止されました。このサーバーの設計に影響はありません。非推奨となった機能（Roots、Sampling、Logging）は一切使用しておらず、従来のHTTP+SSEトランスポートも使用したことがなく、呼び出し間の状態に関する新しいガイダンスにも既に従っています。つまり、トランスポートセッションに依存するのではなく、`run_benchmark`がモデルから返される明示的なジョブハンドルを発行します。

対応する公開されたTypeScript SDKがまだ存在しないため、新リビジョンへのアップグレードは**まだ行われていません**。詳細な見解については、[サーバーのREADME](https://github.com/gamedaysuits/Champollion/tree/main/mcp-server)を参照してください。

## 機械可読なエンドポイント

以下のエンドポイントにはMCPクライアントは不要です：

| エンドポイント | 内容 |
|---|---|
| [`/for-agents.md`](https://champollion.dev/for-agents.md) | [エージェント向け窓口](/for-agents)（生のMarkdown形式） |
| [`/llms.txt`](https://champollion.dev/llms.txt) | 当サイトの厳選インデックス |
| [`/llms-full.txt`](https://champollion.dev/llms-full.txt) | インデックスされた全ページ（インライン展開） |
| [`/queue.json`](https://champollion.dev/queue.json) | ベンチマークキュー全体 |
| [`/queue-preview.json`](https://champollion.dev/queue-preview.json) | キューの上位項目 |
| [`/registry.json`](https://champollion.dev/registry.json) | コーパスレジストリ |
| [`/mesh.json`](https://champollion.dev/mesh.json) | 測定された言語グラフ |

## 次のステップ

- [MCP経由でrailsを操作する](/docs/agents/mcp) — railsプロファイルの段階的な手順
- [運用規定](/docs/agents/contract) — エージェントが従うべきルール
- [エージェントガイド — 構築とベンチマーク](/docs/agents/measurement)
- [エージェントガイド — CLIによる翻訳](/docs/agents/serving)
- [メソッドの提出](/docs/network/getting-started/submit-a-method)
