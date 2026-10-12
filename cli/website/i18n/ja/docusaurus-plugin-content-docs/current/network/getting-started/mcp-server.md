---
title: "MCPサーバー — エージェントへの入り口"
sidebar_label: "MCPサーバー"
description: "Model Context Protocol 経由で AI エージェントを Champollion に接続します。言語の検索、ベンチマークキューやコーパスレジストリの閲覧、評価の実行、モデルのトレーニングとエクスポート、翻訳を行う34種類のツールのほか、npx install 以上の手順が必要なツールについても詳しく解説します。"
---

# MCP Server — エージェント向けの入り口

`champollion-mcp-server` は、[Model Context Protocol](https://modelcontextprotocol.io) を介して Champollion を AI エージェントに公開します。エージェント自身、あるいはエージェントを接続しようとしている開発者にとって、ここが入り口となります。stdio 経由で **34 のツール、3 つのリソース、4 つのプロンプト** を提供します。

ここにあるすべてのものは、プレーンな HTTP としてもアクセス可能です（[機械可読エンドポイント](#machine-readable-endpoints) を参照してください）。しかし、エージェントが単に読み取るだけでなく、*行動*（翻訳、ベンチマークの実行、モデルのトレーニング）できるインターフェースは MCP サーバーのみです。

## インストール

```bash
npx -y champollion-mcp-server
```

その後、クライアントに登録します。Claude Code の場合:

```bash
claude mcp add champollion -- npx -y champollion-mcp-server
```

ファイルで設定するクライアント（Claude Desktop、Cursor、Antigravity）の場合は、以下を追加します:

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

## 依存する前にお読みください

**34 個のツールのうち 14 個は最低限の `npx` インストールだけで動作し、`translate` はエンジンが設定されれば動作します。残りの 19 個は、npm パッケージに含まれておらず同梱もできない Python パッケージを必要とします。** これらはサイレントに失敗することはありません。不足しているものを具体的に指定した対処可能なエラーを返します。ただし、設計を行う前にその構成を把握しておく必要があります。

| ツール | `npx` 後に動作するか？ | 他に必要なもの |
|---|---|---|
| `search_languages`, `get_language`, `language_overview`, `list_corpora`, `get_results`, `get_run_card`, `get_metric_reliability`, `list_contests`, `get_contest`, `get_project_info`, `list_queue`, `get_queue_item`, `estimate_cost`, `get_training_guardrails` | **はい** — 読み取り専用、公開エンドポイントから提供 | なし |
| `translate` | **はい**（エンジン指定時） | 選択したエンジンの API キー — または、メソッド `local` かつ自身のマシン上のモデルサーバーを使用する場合は不要 |
| `run_benchmark`, `get_run_status`, `preview_publish`, `publish_report` | いいえ | 評価ハーネス — `pipx install mt-eval-harness` |
| 15 個の `forge_*` ツール | いいえ | NMT Forge 0.2.0 以降 — `python3 -m pip install nmt-forge`（トレーニングとサービングを行う場合は `'nmt-forge[hf]'` を追加）。評価ハーネスが付属し、言語カードも自動的に検出されるため、リポジトリのクローンは不要 |

いずれの操作においても、リポジトリのクローンは一切不要です。

## ツールの機能

**作業の閲覧とコスト計算。** `list_queue` と `get_queue_item` は、オープンなベンチマークキュー（マップを最も改善する測定値のランク付けされたリスト）を巡回します。`estimate_cost` は、費用をかける前に一連の実行の価格を計算します。

**情報を検索する。** `search_languages` は、言語名、コード、語族、地域によって言語カードを検索し、スペルミスも許容します。各検索結果には、その言語が話されている場所（国、地図上の座標、大地域）や別名も表示されます — ただし、カードに出典が明記されている事実のみを出典とともに表示するため、似た名前の言語を正確に区別できます。出典のない位置情報は決して表示されず、その旨が記載されて代わりにその言語の Glottolog レコードへのリンクが表示されます。champollion.dev の公開カードテーブルから取り込まれたカード（npm インストール時、バンドルされたコアセット以外のすべての言語）には、まだフィールドごとの出典が含まれていません — これらはテーブルの次期アップロードで追加されます — そのため、それらの行には位置情報ではなく Glottolog へのリンクが記載されます。`language_overview` は、特定の言語向けの構築を始めるための 1 ページの起点です。何が存在し、何が実行可能で、次のステップは何かを示します。`get_language` は、出典付きの完全なカードを返します。`list_corpora` は、言語ペアまたはベンチマークファミリーの登録済み評価コーパスを一覧表示します — メタデータのみ（サイズ、ライセンス、汚染度、ハーネスが取得可能か、アクセストークンが必要か、検疫中か）を表示します。コーパスの内容が返されることは決してなく、コーパスがすべて検疫中のペアについては、非対応に見えるのではなくその旨が明記されます。`get_results` と `get_run_card` は、公開リーダーボードからスコア付きの実行結果を読み取ります。`get_metric_reliability` は、ほとんどのエージェントが誤解しがちな疑問 — *このターゲット言語にはどのメトリクスを信頼すべきか* — に対して、語族ごとの人間による評価との相関に基づいて答えます。`list_contests` と `get_contest` は、コンテストとその宣言された規約を表示します。コンテストへの参加は人間による承認が必要な CLI ステップであり、ツールから行われることは決してありません。

**実行する。** `translate` は、翻訳メモリ（重複はコストゼロ）と決定論的品質ゲートを備えた、テスト済みのパイプラインを通じてテキストを処理します。すべての回答には、実際に実行されたエンジン名と、該当する場合はそのモデルおよびエンドポイントが記載されます。
`run_benchmark` は評価を開始し、**即座にジョブ ID を返します**。実際の実行はクライアントのタイムアウトよりも長くかかるため、この ID を使って `get_run_status` をポーリングします。ジョブはサーバーの再起動後も保持されます。実行は継続され、再起動後に同じ ID をポーリングしてもステータスと結果を取得できます。`publish: true` を渡さない限り、何も公開されません。その際プランには、何が公開されるか（文テキストを含む全行、またはスコアのみ、プロンプト全文かそのハッシュのみ、公開先）が示されます。実際の公開にはプランが提示する正確な文言による `publish_ack` が必要となるため、ユーザーが事前に確認できるようになっています。これを指定せずに実行されたものも、同じゲートの元で後から公開できます。`preview_publish` は読み取り専用です。ハーネス自身の公開プレビュー、正確な文言、および公開に使用される正確な `publish_report` 呼び出しを表示しますが、それ自身が公開を行うことはできません。これには MCP アノテーション `readOnlyHint: true` が付与されているため、書き込みの前に毎回確認を求めるエージェントホストでも、自動的に許可できます。`publish_report` は書き込みを実行し（`destructiveHint` および `openWorldHint` と注記）、`scores_only` は文テキストの公開を差し控えます。すべてのプランは、対象言語の `EVAL PACK:` ステータス — `missing`（インストールコマンド付き）、`ready`、または `none needed` — で始まり、コーパスのライセンスとその `do_not_train` 規約を明記します（実行時に `--yes` が渡されるため）。FST（アナライザーまたはその pyhfst ランタイム）の欠落によって実行が停止することは決してありません。処理は続行され、実行カードには FST 受容度が未計算としてマークされます。その他の要素が欠落している場合、翻訳前に実行が停止します。`skip_fst` と `skip_eval_standard` はそれらの要素なしでスコアリングを行い、実行カードには除外されたものがマークされます。プランには COMET が計算されるかどうかも示されます（ハーネスは `unbabel-comet` がインストールされていれば計算します。`comet: true` を指定すると実行に COMET が必須になります）。また、`metricx` と `fuse` はハーネスのオプトインである MetricX-24 および FUSE スタイルの比較機能を要求します。それぞれについてプランには、インストールされているか、何をインストールすべきか、何をダウンロードするかがハーネスの情報に基づいて示されます。ハーネスが計算できないメトリクスを要求する確認済み実行は、メトリクス抜きで実行されるのではなく拒否されます。プランの `Results:` 行と `Cache:` 行には、実行ログ、レポート、および翻訳キャッシュの出力先が示されます。`mt-eval contest prepare` が公開可能とマークしているフォルダー（コンテストの `public/`）内のテストファイルは、代わりにコンテストの `runs/` フォルダーに出力されるため、実行によって書き込まれたものが一緒に公開されることはありません。自身のマシン上のモデル（ローカルサーバー、またはハーネスがインプロセスで実行し証明が不要な `method: "local-model"`）は、`$0 API cost (runs on this machine)` としてレポートされます。

**自己欺瞞に陥らずにトレーニングする。** `get_training_guardrails` は、実際に測定された失敗から抽出されたルールを返します。15 個の `forge_*` ツールは、[NMT Forge](/docs/network/getting-started/training-honestly) をガードされた手順に沿って 1 ステップずつ実行します — 最初に、そして各ステップの後に `forge_status` を実行（次のコマンドとそれを実行するツールを提示）、コマンドが拒否される前にどのゲートに引っかかるかを確認する `forge_preflight`、テストスコアが存在する前（かつテストセットでのベンチマーク前：スコアリングの読み取りを行うと以後の事前登録がブロックされます）に予測を記録する `forge_prereg_template` および `forge_prereg`、テストセットを一度だけスコアリングしてトレーニング済みモデルをパッケージ化する `forge_export`、勝者の横にそれぞれのほぼ同一データに関する注意書き（near-twin caveat）を添えて 2 つのモデルを A/B テストする `forge_compare`、そして forge が判定できない予測（自由形式テキストの範囲）に対するユーザー自身の判定を記録する `forge_prereg_verdict`（計算値ではなく人間の判定として表示）があります。`forge_status` は、トレーニング済みのすべての実行を開発セットのスコアとともに一覧表示し、開発セットが飽和状態（チェックポイント選択で比較の余地がない満点スコア）になったときにそれを伝えます。評価ハーネスがテストスコアに注意書きを付けた場合（例: ほぼ一定の出力。すべての入力文に対して一握りの出力しか返さないなど）、`forge_export`、`forge_status`、`forge_compare`、`forge_lint` はハーネス自身の言葉でそれを伝え、重大なものは次のステップの冒頭に提示されます。注意書きなしでスコアが引用されることは決してありません。拒否された場合は、何が問題だったのか、なぜそれが重要なのか、そして修正方法が返されます。ツールの呼び出し時間を超えて実行され、代わりにターミナルで実行されるステップが 2 つあります。トレーニング（`nmt-forge run`）と、エクスポートされたモデルのサービング（`nmt-forge serve`。これによりローカルエンドポイントの配下に置かれ、`translate` や CLI から使用可能になります）です。

### 引数

`name` は必須で、`name?` はオプションです。1 つの言語を受け取るすべてのツールは、それを `language` としても受け入れます。「`code` または `language`」はどちらの名前でも機能することを意味し、いずれか 1 つを渡します。元の名前も引き続き使用できます。

| ツール | 引数 |
|---|---|
| `search_languages` | `query` または `language`, `limit?` |
| `language_overview` | `code` または `language`, `source?` |
| `get_language` | `code` または `language`, `format?` |
| `list_corpora` | `source_language?`, `target_language?`, `family?`（この 3 つのうち少なくとも 1 つ）, `include_quarantined?`, `limit?` |
| `get_results` | `source_language?`, `target_language?`, `model?`, `sort?`, `limit?` |
| `get_run_card` | `id` |
| `get_metric_reliability` | `target` または `language` |
| `list_contests` | `status?`, `language?`, `limit?` |
| `get_contest` | `id` |
| `get_project_info` | なし |
| `list_queue` | `language?`, `source_language?`, `model?`, `budget?`, `condition?`, `limit?` |
| `get_queue_item` | `id?` または `priority?`（いずれか 1 つ） |
| `estimate_cost` | `budget?`, `language?`, `source_language?`, `model?`, `condition?` |
| `get_training_guardrails` | `topic?` |
| `translate` | `texts`, `source_language`, `target_language`, `method?`, `model?`, `base_url?`, `endpoint?`, `register?`, `project_dir?`, `context?`（gettext msgctxt: すべてのテキストに対して 1 つ、またはテキストごとに 1 つ）, `script?`, `use_tm?`, `validate?` |
| `run_benchmark` | いずれか 1 つのモード: `budget?` または `top?`（キュー）, `item_id?`, または `model?` を伴う `corpus?`（プラグインがロードするモデルである `method_dir` とともに使用）, `method?` または `method_dir?`（メソッドプラグインのディレクトリ。`local-model` はデフォルト値を持たないため `model` が必須）, `allow_model_pair_mismatch?`（`local-model`: 関連言語のベースラインとして、別のペア名を冠した OPUS-MT ペアモデルを実行）, `attest_local_transport?`（MT エンジンまたはプラグイン。`local-model` には不要）, `provider?`, `base_url?`, `target_language?`, `script?`（LLM 実行時: 出力の記述に使用する ISO 15924 スクリプト。例: `Cans` や `Latn`。対象言語カードに複数記載されている場合はプランに明記）, `source_language?`, `source_field?`, `target_field?`, `max_cost?`, `coaching_file?`, `glossary?`, `attest_no_training?`, `accept_nc_terms?`, `skip_fst?` および `skip_eval_standard?`（項目およびコーパス実行: FST や評価標準メトリクスなしでスコアリング、未計算としてマーク）, `comet?`（COMET を必須化: インストールされていない場合は実行を拒否）, `metricx_model?` を伴う `metricx?`, および `fuse?`（項目およびコーパス実行: ハーネスのオプトイン機能である MetricX-24 と FUSE スタイルの比較機能、未インストールの場合は拒否）。続いて `dry_run?`, `confirm?`, `publish?`, `publish_ack?`（実際の公開時: プランが出力する正確な文言）, `anonymous?` |
| `get_run_status` | `job_id?` |
| `preview_publish` | `report`（完了した実行の `*_report.json`）, `scores_only?`, `redact_coaching?`, `anonymous?`（読み取り専用: `confirm` がなく公開不可） |
| `publish_report` | `report`（完了した実行の `*_report.json`）, `scores_only?`, `redact_coaching?`, `anonymous?`, `confirm?`, `publish_ack?`（プレビューが出力する正確な文言） |
| `forge_status` | `workspace?`, `project_dir?` |
| `forge_preflight` | `target`（確認するコマンド）, `config?`, `workspace?`, `project_dir?` |
| `forge_discover` | `code` または `language`, `cards_dir?`, `workspace?`, `project_dir?` |
| `forge_init` | `code` または `language`, `dir?`, `pair?`, `model?`, `base?`, `no_card?`, `name?`, `cards_dir?` |
| `forge_split` | `corpus`, `test`, `seed`, `out?`（デフォルトは `data/split`、`forge_init` の config.json が読み取るパス）, `dev?`, `register?`（名前のプレフィックス、または `project` の場合は `true`）, `allow_rotate?`, `near_dupe?`（Jaccard 閾値。forge が類似重複の除外を推奨する場合は 0.6 など）, `max_group?`（`near_dupe` と併用: 最大の類似重複グループ）, `workspace?`, `project_dir?` |
| `forge_leak_audit` | `corpus`, `strict?`, `clean_to?`, `drop_test_twins?`（固有の `clean_to` を指定、例: `corpus.notwins.jsonl` — 全データファイルを指定してはならない）, `companion_config?`（`drop_test_twins` と併用: 重複のないモデルの設定の出力先、デフォルトは `config-notwins.json`）, `overwrite?`（設定、実行、分割、または別の監査で使用されている `clean_to` ファイルを置換 — 指定しない場合は拒否）, `full_indices?`（行番号リストの完全版。デフォルトでは長いリストは `{count, first}` として返される）, `workspace?`, `project_dir?` |
| `forge_register_eval` | `name`, `path`, `role`, `source_field?`, `target_field?`, `allow_rotate?`, `workspace?`, `project_dir?` |
| `forge_prereg_template` | `out?`, `force?`, `project_dir?` |
| `forge_prereg` | `id`, `eval_set`, `predictions`, `author?`, `config_hash?`（1 つの実行に固定）, `allow_after_reads?`（セットのスコア付き読み取りの前に書き込まれた予測のみ）, `workspace?`, `project_dir?` |
| `forge_prereg_verdict` | `id`, `prediction`（番号、または固有の ID）, `verdict`（`held` または `missed`）, `by`（判定者）, `note?`, `revise?`, `workspace?`, `project_dir?` |
| `forge_export` | `run_manifest`, `out`, `config?`, `no_eval?`, `no_model?`, `glossary?`, `endpoint?`, `port?`, `name?`, `force?`, `prereg?`, `workspace?`, `project_dir?` |
| `forge_evaluate` | `run_manifest`, `config?`, `out_hyps?`, `harness_out?`, `glossary?`, `prereg?`, `workspace?`, `project_dir?` |
| `forge_lint` | `manifest`, `run_manifest?`, `workspace?`, `project_dir?` |
| `forge_report` | `manifest`, `workspace?`, `project_dir?` |
| `forge_compare` | `eval_set`, `hyps_a`, `hyps_b`, `label_a?`, `label_b?`, `run_a?`, `run_b?`（各モデルの実行マニフェスト: トレーニングデータに類似重複がないか検査）, `metric?`, `target_lang?`, `config_hash?`, `prereg?`, `override_respend?`, `workspace?`, `project_dir?` |

例えば、`get_metric_reliability { "language": "crk" }` と `get_metric_reliability { "target": "crk" }` は同じ問い合わせを行います。

### デプロイしたモデルを使用した翻訳

`nmt-forge serve` は、提供するモデル用に 2 つのアドレスを出力します。`translate` でそのいずれかを指定します。

| 引数 | 併用対象 | 例 |
|---|---|---|
| `base_url` | `method: "local"` — OpenAI 互換サーバー（`"openai"` も同様） | `http://127.0.0.1:8378/v1` |
| `endpoint` | `method: "api"` — champollion API コントラクト | `http://127.0.0.1:8378/translate` |
| `model` | LLM エンジン専用。該当のない機械翻訳 API では拒否されます | `llama3.1` |
| `project_dir` | 任意のメソッド — そのプロジェクトの翻訳メモリを使用 | `~/my-app` |

自身のマシン上のサーバーにはキーが不要です。リモートの `api` エンドポイントは、サーバーの環境変数 `CHAMPOLLION_API_KEY` からキーを読み取ります。ツールは認識できない引数を無視せず、名前を挙げて拒否するため、引数のスペルミスによってテキストが意図せず別のモデルへ送信される心配はありません。

### サーバーの状態保持場所

すべてのデータは `~/.champollion-mcp/` に保存されます（移動するには `CHAMPOLLION_MCP_HOME` を設定します）。

- **`translate` の翻訳メモリ**は独自のファイルであり、そのフォルダー内の `.champollion/tm.json` に格納されます。これは各プロジェクトの `.champollion/tm.json` とは別個のものです。プロジェクトのファイル（そのプロジェクト内で `champollion sync` が使用しているもの）を使用するには、`project_dir` を渡します。
- **`run_benchmark` のジョブ**は `jobs.json` に記録され、最新の 50 件が保持されます。各ジョブは `jobs/` 内に個別フォルダーを持ち、その出力と、キュー項目または登録済みコーパスの場合はハーネスの結果が格納されます。手元のテストファイルに対する実行では、そのファイルの横の `results/` に結果とキャッシュが書き込まれます — ただし、`mt-eval contest prepare` が公開可能とマークしているフォルダー内のファイルは例外で、コンテストの `runs/` フォルダーに書き込まれます。キューの実行では、ハーネスの通常の動作と同様に、サーバーの作業フォルダー配下の `eval/logs/harness/queue/` にレポートが書き込まれます。

:::note[支出は設計上制限されています]
`run_benchmark` は**無制限のキュー実行を拒否します。** `budget`、`top`、または特定の `item_id` のいずれか1つの制限を必ず渡す必要があります。キューを誤解したエージェントが無制限に支出してしまうのを防ぐため、「ただキューを実行する」という呼び出しは存在しません。
:::

## プロトコルバージョン

トランスポートは **stdio のみ** です。エージェントごとに1つのサーバープロセスが割り当てられます。

MCP の [2026-07-28 リビジョン](https://blog.modelcontextprotocol.io/posts/2026-07-28/) では、プロトコルがデフォルトでステートレスになり、`initialize` ハンドシェイクと `Mcp-Session-Id` ヘッダーが廃止されました。このサーバーの設計は影響を受けません。非推奨の機能（Roots、Sampling、Logging）は一切使用しておらず、レガシーな HTTP+SSE トランスポートも使用したことがありません。また、呼び出し間の状態に関する新しいガイダンスにもすでに従っています。つまり、トランスポートセッションに依存するのではなく、`run_benchmark` が明示的なジョブハンドルを発行し、モデルがそれを送り返す仕組みになっています。

公開されている TypeScript SDK でこの新しいリビジョンに対応しているものがまだないため、新しいリビジョンへのアップグレードは**行われていません**。詳細な見解については、[サーバーの README](https://github.com/gamedaysuits/Champollion/tree/main/mcp-server) を参照してください。

## 機械可読エンドポイント

これらには MCP クライアントは必要ありません:

| エンドポイント | 概要 |
|---|---|
| [`/for-agents.md`](https://champollion.dev/for-agents.md) | [エージェントの入り口](/for-agents)（生の Markdown 形式） |
| [`/llms.txt`](https://champollion.dev/llms.txt) | このサイトの厳選されたインデックス |
| [`/llms-full.txt`](https://champollion.dev/llms-full.txt) | インデックス化されたすべてのページ（インライン） |
| [`/queue.json`](https://champollion.dev/queue.json) | 完全なベンチマークキュー |
| [`/queue-preview.json`](https://champollion.dev/queue-preview.json) | キューの上位アイテム |
| [`/registry.json`](https://champollion.dev/registry.json) | コーパスレジストリ |
| [`/mesh.json`](https://champollion.dev/mesh.json) | 測定された言語グラフ |

## 次へ

- [エージェントガイド — 構築とベンチマーク](/docs/network/getting-started/agent-guide)
- [エージェントガイド — CLI を使用した翻訳](/docs/guides/agent-guide)
- [メソッドの送信](/docs/network/getting-started/submit-a-method)
