---
title: "MCP経由でレールを操作する"
slug: /agents/mcp
description: "MCPクライアントをChampollionのrailsプロファイルに接続し、6つのツールを使って言語プロジェクトを進めます：クライアントごとのセットアップ、すべての引数と戻り値、ループ、ステップモード、拒否、説明トピック。"
---

# MCP経由でレールを操作する

MCPサーバーのデフォルトプロファイルは「レール（rails）」です。これは、1つの言語プロジェクトを空のフォルダーからユーザー自身のコンピューター上で測定済みのモデルへと導く6つのツールで構成されています。各ツールは`champollion` CLIを独立した制約付きプロセスとして実行します。これはユーザーが手動で入力するコマンドと同じものです。サーバーはまた、接続時に短い操作手順（`instructions-rails.md`）をクライアントに渡します。

## 接続

サーバーはstdio経由でMCP通信を行い、Node.js 20.11以降が必要です。設定ファイルを使用する各クライアントの設定は次のとおりです。

```json
{
  "mcpServers": {
    "champollion": { "command": "npx", "args": ["-y", "champollion-mcp-server"] }
  }
}
```

| クライアント | 設定場所 |
|---|---|
| Claude デスクトップ | Settings → Developer → Edit Config。エントリを追加し、保存してアプリを再起動します |
| Claude Code | `claude mcp add champollion -- npx -y champollion-mcp-server` |
| Cursor | プロジェクトの`.cursor`フォルダー内の`mcp.json`、またはホームフォルダー内の`.cursor` |

ローカルのstdioサーバーを起動できる他のクライアントでも同じコマンドを使用できますが、このページでは上記の3つのみを説明します。

**ツールのパス。** サーバーは依存するCLIを自動的に検出します。まず`PATH`上で`nmt-forge`を探し、次いで`UV_TOOL_BIN_DIR`（デフォルトは`~/.local/bin`。`uv tool install`が配置する場所）を探します。デスクトップアプリから起動されたクライアントは、ターミナルよりも`PATH`が短いことがよくあります。サーバーエントリの`env`で環境変数としてオーバーライドできます。

| 変数 | 効果 |
|---|---|
| `CHAMPOLLION_MCP_PROFILE` | `rails`（デフォルト）または`full` |
| `CHAMPOLLION_CLI_BIN` | 同梱版の代わりに実行する`champollion` CLIのエントリポイント |
| `NMT_FORGE_BIN` | `nmt-forge`の実行ファイル（CLIのjourneyも同じ変数を尊重します） |
| `UV_TOOL_BIN_DIR` | `PATH`の後に`nmt-forge`および`uv`を検索する場所 |

## プロファイル

| プロファイル | 選択方法 | 概要 |
|---|---|---|
| rails | デフォルト | 6つのツールと短い指示文。1つの言語プロジェクトを最初から最後まで進めます |
| full | `args`内の`--profile full`、または`CHAMPOLLION_MCP_PROFILE=full` | すべてのツール：言語カード、コーパス、ベンチマーク、キュー、コンテスト、forgeトレーニング、公開 |

それ以外の値を指定するとサーバーは停止します：`unknown MCP profile "<value>" (rails or
full)`。ツールの一覧全体は[MCPサーバーのページ](/docs/network/getting-started/mcp-server)に記載されています。言語プロジェクトを進める場合は、railsプロファイルにとどまってください。すべてのステップがプロジェクトのファイルから読み取られるのはこのプロファイルです。

## ループ

1. プロジェクトがまだない場合 → `start_project`。最初の呼び出しでは何も作成されません。その`ask_first`をユーザーに伝え、ユーザーの回答に応じて提供された呼び出しを実行します。
2. `project_status` → `step.mode`、`step.say`、`step.why`を読み取ります。
3. モードの指示に従い、ステップを実行する正確な呼び出しである`step.call`を使用します。
4. 2に戻ります。あなたやユーザーが手作業で変更を加えた後は、再度`project_status`を呼び出します。次のステップは常にファイルから読み取られます。
5. `step: null` → レールは完了です。`finished`の内容をユーザーに伝えます。

| `step.mode` | 行うこと | `step.call` |
|---|---|---|
| `auto` | 実行する | `project_dir`、`step_id`を指定した`run_next_step` |
| `confirm` | 何を行うか（インストール、トレーニング）をユーザーに伝え、yesかnoかを尋ねます。yesの場合にのみ実行します。「今はしない」の場合はそれを記録し、何も実行しません | yesの後に`confirmed: true`を追加した`run_next_step`。「今はしない」の場合は`declined: true` |
| `ask_user` | `step.question`をわかりやすい言葉で尋ねます。`step.answers`のキーでユーザーの回答を渡します。「今はしない」の場合：`not-now`がスロット自体の`enum`の値の1つである場合は回答となるためそれを渡し、そうでない場合は記録して何も実行しません | `answers`を指定した`run_next_step` — 各スロットは`<…>`と表記され、ユーザーの言葉に置き換えられます。回答の選択肢にない「今はしない」の場合は`declined: true` |
| `wait` | 実行中です | `wait_seconds: 120`を指定した`project_status`。モードが`wait`の間繰り返します |
| `use_tool` | `step.tool`を使用して今すぐ実行します。ユーザーに差し戻さないでください | 例：`path: "<each file the person named, where it is>"`を指定した`add_data` |
| `human_only` | ユーザーが実行します：ユーザーに`step.say`を伝えます | なし |

`step.command`はレールが実行する内容であり、ツールの名前ではありません。呼び出し内の`<…>`はユーザーの回答またはファイルのためのスロットです。そのまま送り返されたスロットは拒否されます。

## 6つのツール

### `start_project`

| 引数 | 型 | 意味 |
|---|---|---|
| `folder` | 文字列、必須 | プロジェクト用の新しいフォルダー（`parent_dir`からの相対パス） |
| `from` | 文字列、必須 | 入力言語：コードまたは言語名 |
| `to` | 文字列、必須 | 出力言語：コードまたは言語名 |
| `target_name`、`source_name` | 文字列 | その言語の話者が呼ぶ言語名。私用コード（`qaa`〜`qtz`）では必須 |
| `purpose` | 文字列 | 翻訳の目的（ユーザー自身の言葉） |
| `parent_dir` | 文字列 | フォルダーを作成する場所（デフォルト：サーバーの作業ディレクトリ） |
| `confirmed` | 真偽値 | ユーザーが翻訳方向に同意した後にのみ`true` |

`confirmed: true`がない場合、`champollion new --dry`を実行し、`made: false`、`ask_first`（伝えるべき文：「*この翻訳機はXを受け取ってYを返します。つまりXを入力するとYが出力されます。この向きでよろしいですか？*」）、`if_yes`および`if_the_other_way`（それぞれ完全な呼び出し）、そして`languages`（各名称の解決結果。ユーザーの言葉がカードに記録された別名である場合は`matchedAs`を、同じ言葉が他の言語も指している場合は`alsoNamed`を含む）を返します。両方を伝えてください。`confirmed: true`を指定すると、プロジェクトを作成し、`project`、`languages`、および`next`（最初のステップ）を返します。

どのカードにも存在せず、近いものもない名称の場合：拒否メッセージには`if_it_has_no_code`（`to: "qaa"`とその名称を`target_name`として指定した同じ呼び出し）が追加されます。これはユーザーが指定した名称にのみ使用してください。

### `project_status`

引数：`project_dir`（必須）、`wait_seconds`（0〜120）。`wait_seconds`を指定すると、ステップが`wait`の間は5秒ごとに再読み込みを行い、ステップが変化するか制限時間に達したときに結果を返します。

`project`、`stage`（`"2/6 Gather your data"`）、`step`（`id`、`mode`、`say`、`why`、`call`、および存在する場合は`question`、`answers`、`command`、`tool`、`for_the_person`）、ならびに該当する場合は以下を返します。

| フィールド | 概要 | 行うこと |
|---|---|---|
| `true_now` | 文形式によるForge自身の記録：トレーニングされたモデルと最良のdev chrF++、テストセットごとのリーク監査の判定、テストセットのスコア、トレーニング実行中かどうか、モデルが配信されているかとその場所 | 何が行われたかはこれらの行からのみ伝え、それ以上のことは言わないでください |
| `waiting_for_agreement` | 話者がまだ同意していないファイル（`speakers_agreed: not-yet`）：それぞれ`file`、`question`、`say`、固有の`call`を含みます | 各質問はセッションごとに1度だけ、穏やかに尋ねます。関係者全員が同意したとユーザーが答えた場合にのみ呼び出しを実行します |
| `files_not_added` | このセッションで`add_data`が拒否し、まだプロジェクトに含まれていないファイル（それぞれの拒否理由を含む） | 各ファイルを取り込むか（拒否理由に取り込み方法が記載されています）、どれが除外され、その理由が何であるかをユーザーに伝えます |
| `model_in_use` | モデルが配信された後、改善ラウンドのステップの横に表示：`say`（試用ページとその使い方）および`for_the_person`（アプリやウェブサイトに組み込むための`champollion connect`コマンド） | ユーザーに一度伝えます。ユーザーが必要なときにconnectを実行します |
| `blockers`、`warnings` | Forgeのものをそのまま | 一語一句変えずにそのまま伝えます |
| `finished` | 残っているステップがない場合：ユーザーが次にできること（モデルを専用ページで試す、アプリなど） | ユーザーに伝えます |
| `error` | ステップを指定できなかった理由 | ユーザーに伝えます |

存在しないプロジェクトフォルダー、または`champollion.project.json`がないプロジェクトフォルダーは、近くで見つかったプロジェクトとともに拒否されます。

### `run_next_step`

| 引数 | 型 | 意味 |
|---|---|---|
| `project_dir` | 文字列、必須 | プロジェクトフォルダー |
| `step_id` | 文字列、必須 | 直前に返された`step.id`（または`waiting_for_agreement`エントリのid） |
| `answers` | 文字列のオブジェクト | `ask_user`：`step.answers`のキーによるユーザーの回答 |
| `confirmed` | 真偽値 | `confirm`：ユーザーがyesと言った後にのみ`true`。また、2回失敗したステップについて、ユーザーがそのまま再試行するように言った場合にも使用 |
| `declined` | 真偽値 | ユーザーが`confirm`ステップ、または独自の`not-now`回答を持たない質問に対して「今はしない」と言った場合に`true`：何も実行されず、このセッションでは再質問されません。`not-now`が回答の選択肢の1つである場合は、`answers`で渡します |

何かを実行する前に、次のステップを再度読み取ります。**ロック：**

- 異なるidは拒否されます：`the project changed since that step was named
  — call project_status again`, with `current`。
- `human_only`は拒否されます（`a person does this step: …`）。エージェントがツールを使って行う`human_only`ステップは、使用すべきツールとともに拒否されます。
- `wait`は拒否されます。`confirmed: true`のない`confirm`は拒否されます（`ask the
  person first, then call again with confirmed: true`）。
- `ask_user`：すべての回答が必須です（`missing the answer "<key>" — ask the
  person who holds the data; never answer for them`); a `<…>`プレースホルダーは拒否されます。`enum`に含まれない回答は拒否されます）。
- レール独自のプログラムのみが実行されます：`champollion`、`nmt-forge`、および `uv tool
  install … nmt-forge`. A command using `|`, `;`, `<`, `>`, `` ` ``, `$` や単独の`&`は拒否されます。`&&`は各パーツを連結し、順番に実行され、最初の失敗で停止します。
- 各パートの制限時間は10分です（`uv`のインストールは15分）。
- `confirm`でも`ask_user`でもないステップでの`declined: true`は拒否されます：`this step does not wait on the person's yes (<mode>) — there is
  nothing to decline`。
- `answers`に`not-now`が含まれるステップ（現在は、より強力なモデルの提案の`try_it`）での`declined: true`は拒否され、その拒否メッセージにはステップの`answers`が含まれます：`"not now" is one of this step's own answers — pass it in
  answers (try_it: "not-now"): it is recorded, and this comes back only after
  more rounds; declined would ask again next session`。

`ran`（パートごと：`command`、`exit_code`、完了した場合は`timed_out`、および`output`の最後の40行）、ならびに`next`（`project_status`と同じ形式の次のステップ）を返します。

#### 「今はしない」

記録する方法は2つあり、ステップによってどちらになるかが決まります。

| ステップ | 「今はしない」の扱い | 記録される内容 | 再度提示されるタイミング |
|---|---|---|---|
| `answers`に`not-now`が含まれる`ask_user`ステップ（より強力なモデルの提案：`try_it`、`yes`、または`not-now`） | 回答：`answers: {"try_it": "not-now"}` | Forgeの台帳（`model-change`、`answer: "not-now"`）。それ以外は何も変更されません | 開発セットが「**変化なし**」または「**悪化**」と判定したラウンドがさらに2回続いた後（セッションをまたいで保持） |
| `confirm`ステップ（トレーニング、インストール、モデルの配備）、またはユーザーがまだ回答できない質問 | `declined: true` | このサーバーのメモリ内のみ | サーバーが再起動したとき（次のセッション） |

`declined: true`は何も実行せず、`declined`（ステップid）、`ran: []`、`say`（「*何も実行されませんでした。このセッションでは再度尋ねられません。ユーザー側から話題にして同意した場合は、その時点で実行してください。*」）、および`next`を返します。この辞退状態はサーバーの存続期間中（1セッション）保持されます。サーバーを再起動すると忘れられます。この状態が有効な間、そのステップは`project_status`および`run_next_step`から`declined_this_session`（日時、ISO形式）および`say`とともに返されます。その文は「*ユーザーはこれに対して今はしないと回答しました (HH:MM UTC): …*」で始まり、「*このセッションでは再度尋ねないでください — ユーザーの同意が必要なものは何も実行されません。ユーザー自身がこの話題を出して同意した場合は、confirmed: true（またはユーザーの回答）を指定してステップを実行してください。*」で終わります。後から`confirmed: true`または回答を渡すと、ステップが実行され、辞退状態がクリアされます。
**注意。** このセッション中は再度尋ねず、ステップを迂回しようともしないでください。ユーザーが自ら話題にして同意した場合にのみ実行してください。

#### ステップが失敗したとき

**ロック。** 2回続けて失敗したステップ（ゼロ以外の終了コードまたはタイムアウト。サーバーの存続期間内でカウント）は、`confirmed: true`が指定されていない限り、3回目は`last_output`とともに拒否されます。**注意。** そのフラグを設定するのはエージェント側の役割です。何が表示されたかをユーザーに伝え、ユーザーが修正するか（ターミナルで修正コマンドを実行しても構いません。その後`project_status`を呼び出します）、そのまま再試行するように言った場合にフラグを設定します。

### `add_data`

| 引数 | 型 | 意味 |
|---|---|---|
| `project_dir` | 文字列、必須 | プロジェクトフォルダー |
| `path` | 文字列、必須 | ファイルの場所：絶対パス、またはプロジェクトフォルダーやサーバー起動場所からの相対パス |
| `into` | `parallel`（デフォルト） · `test` · `lexicon` | 学習用の文ペア、確認済みのテスト文、単語リスト |
| `source_col`、`target_col` | 文字列 | 列の文字（`A`）、数値、またはヘッダー名。ELANの場合は拒否時に示された層（ティア）番号（またはユーザーが入力した正確な層ID）。LIFTの場合は言語コード |
| `sheet` | 文字列 | 複数ある場合のシートまたはテーブル名 |
| `header` | 真偽値 | `true`：1行目がヘッダー、`false`：データ行 |
| `usfm_source` | 文字列 | USFM聖書のみ：もう一方の言語のテキスト（`.usfm`ファイルまたはフォルダー） |
| `replace` | 真偽値 | すでに登録されたファイルを再度読み込む（別のヘッダーや列）。権利者の回答は保持されます |

`champollion data add`を実行します。まずはパスのみを指定して呼び出してください。ペアの言語名を示すヘッダーがあれば列が自動判定されます。そうでなければ質問が返されるので、ユーザーに尋ねてください。内容から勝手に判断してはいけません。スプレッドシート（`.xlsx`、`.ods`、`.csv`）、`.tsv`および`.txt`、Wordの`.docx`の表、ToolboxおよびLIFT辞書、ELANの`.eaf`ファイル、USFMを読み取ることができます。

`result`（CLIのレポート：行数、列、番号によるELANのティア、および行チェックで特定された行番号 — 重複、繰り返し、不自然な長さ、入れ替わりやズレた行。何も削除されません — 文そのものは決して含まれません）、サーバー起動フォルダーからファイルが見つかった場合は`read_from`、さらにファイルに他のデータが含まれる場合（辞書の例文ペア、または語義解説としての単語リスト）は`also`を返します — 各エントリは完全な`add_data`呼び出しです。そのファイルに対するユーザーの利用条件によって除外されていない限り、実行してください。行チェックの結果はそのまま伝えてください。ユーザーが自身のファイル内で該当行を確認します（[データ規則](/docs/agents/data-rules#what-tools-print-and-never-print)）。ユーザーにファイルの移動を求めないでください。`inbox/`はファイルを配置できる場所にすぎません。

### `try_translation`

引数：`project_dir`、`text` — 最大10行、最大2,000文字、1行に1文、ユーザーから提供された言葉。

このプロジェクトが配信しているモデル（`nmt-forge jobs --json`内の最新の正常な`serve`ジョブ）をこのコンピューター上でのみ探し、その`/health`を読み取ります。

- **ロック。** `output_local_only`が`false`（trueまたはunknown）でない場合、翻訳は返されず、`shown_to_person_only: true`、`open`（モデルの専用ページ）、`say`が返されます。ユーザーをそのページに案内してください。翻訳結果をあなたに貼り付けるようユーザーに求めないでください。
- トークンを要求するサーバーは拒否されます：トークンがエージェントに渡されることは決してありません。
- それ以外の場合は、`model`、`pair`、`translations`（行ごとの`source`、`translation`）、存在する場合は`errors`、および`say`を返します。これらをそのまま伝えてください。サーバーは返された内容を検証しません。

### `explain`

引数：`topic`。そのまま伝えるわかりやすいテキスト：

| `topic` | 対象内容 |
|---|---|
| `rails` | プロジェクトフォルダーとステップの順序 |
| `privacy` | サイドカーの意味、ファイルを決して直接開いてはいけない理由 |
| `quality` | スコアが保証すること、保証しないこと |
| `modes` | 各種ステップの進め方 |
| `improve` | モデル使用開始後のラウンド：レビュー対象行の約10行に1行は「*意図的に以前のシートから再度取り上げられたもの（シートに明記されています…）*」、より良いモデルが配備用に提示されユーザーが同意する（「*判定だけでは何も変わりません*」）、「データ僅少」の判定、「*開発セットで評価可能なラウンドが2回連続で向上を示さなかった（最後に実用化されたモデルから起算）*」場合のより強力なモデルの提案 |
| `off_rails` | レールから外れる場合：エキスパートコマンドを実行し、その後に`project_status`を呼び出す |

## セッション全体に関する注意事項

- **注意。** あなたが読み取った内容はすべて、あなたのモデルプロバイダーに送信されます。`add_data`、`project_status`、`run_next_step`は件数、列、状態を報告し、文そのものは決して報告しません。その状態を維持してください。ファイルを直接開いてはいけません。
- **注意。** `ask_user`の回答、`confirmed: true`、そして`waiting_for_agreement`の同意はユーザー自身のものです。ツールは回答が存在し形式が整っているかを確認しますが、それがユーザー自身のものであることを確認できるのはあなただけです。
- **注意。** `blockers`、`warnings`、およびすべての注意事項は一語一句変えずに伝え、すべての数値は単位および測定対象のセットとともに伝えてください（[コーチング](/docs/agents/coaching)）。

## さらに詳しく

- [運用規約](/docs/agents/contract) — ロックと注意事項。
- [レールモデル](/docs/agents/rails-model) — ジャーニー、モード、およびこれらのツールが読み取るステップID。
- [シェルからのレールの操作](/docs/agents/shell) — コマンドとしての同様のステップ。
- [MCPサーバー](/docs/network/getting-started/mcp-server) — 両方のプロファイルとツールの完全なカタログ。
