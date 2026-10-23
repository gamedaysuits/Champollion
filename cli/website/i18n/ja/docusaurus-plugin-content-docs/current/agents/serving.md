---
title: "サービングとデプロイ"
slug: /agents/serving
description: "測定を終えたモデルを実際に活用します。nmt-forge export が書き出す deployment/1 ファイル、mt-eval translate と serve、nmt-forge serve とその try ページ、service-api/1 の /translate コントラクト、champollion connect、エージェントによって実行される champollion sync、そしてローカル専用の出力でできること・できないことについて解説します。"
---

# サービングとデプロイ

**デプロイとは、ソース言語のみの入力に対する測定パイプラインのことです。** 1つの
deployment/1 ファイルが、メソッド、そのモデル、ゲート、そして言語ペアを指定します。
同じファイルがテストセットでテストされ、ファイルに対して実行され、サービングされるため、測定されたものがそのまま提供されます。このページは、
[実際に動かす](/docs/put-it-to-work) のエージェント向けパートです。

全体を通じて：ローカル専用（local-only）とマークされた文から学習したモデルはそれらの文を再現する可能性があるため、**その出力もローカル専用となります**。以下に示す各ツールは、データ保持者の同意がない限り、その出力をこのコンピューター内に保持します。また、誰が同意したかは
`--holders-agreed-by` に記録されます。**注意：** そのフラグは、保持者が同意したとユーザーから伝えられた後に、そのユーザーから提供された名前のみを指定して渡してください。

## deployment/1

`$schema` `https://champollion.dev/schemas/deployment/1.json`。必須：`id`、
`pair`（`source`、`target`、任意の `target_script`）、`method`（`method`、
任意の `model`）。任意：`gates`（gate-chain/1 ファイル）および `serve`
（`host`、デフォルトは `127.0.0.1`、`port`）。パスは、rails がコマンドを実行するプロジェクトルートからの相対パスです。スコアは指定しません。

**書き込み元：** `nmt-forge export` は、エクスポートが rails プロジェクト（上位に `champollion.project.json` がある場所）内にある場合、
`deploy/<name>.json` を書き出します。`<name>` はケバブケースの `--name`、それ以外の場合は
`nmt-forge-<run>` です：

```json
{
  "$schema": "https://champollion.dev/schemas/deployment/1.json",
  "id": "nmt-forge-<run>",
  "description": "nmt-forge <backend> model <run> (<src>→<tgt>), written by nmt-forge export <version>",
  "pair": { "source": "<src>", "target": "<tgt>" },
  "method": { "method": "local-model", "model": "<export>/model" }
}
```

エクスポートが rails プロジェクト外にある場合、モデルがデコードフックのもとで選択された場合（forge のフックを実行するのは `nmt-forge serve` のみ）、設定にペアが指定されていない場合、ドキュメントの検証に失敗する場合、または `deploy/<name>.json` がすでに別のモデルをデプロイしている場合（置き換えられることはありません）は、何も書き出されず（`no deployment file: …` と表示されます）。

**読み込み元：**

```bash
mt-eval run --deployment deploy/<name>.json --corpus <test set>          # measure exactly what it serves
mt-eval translate --deployment deploy/<name>.json --source-file <input> --out <output>
mt-eval serve --deployment deploy/<name>.json
```

**制約：** `--deployment` を指定した場合、`run` と `translate` は `--method`、
`-m`/`--model`、`--gates`、`--target-script` を拒否します（*「--deployment … says the method, its model, its gates and the target script; drop … (or change the file)」*）。`serve` はさらに `--pair` も拒否します。別のペアでの入力は拒否されます
（`deployment <id> translates from <src>; this input is in <x>`）。
ゲートチェーンがフォールバックするデプロイは翻訳およびサービングが可能ですが、
測定はできません：`mt-eval run` はフォールバックするチェーンを拒否します
（[メソッドとゲート](/docs/agents/methods#gate-chains)）。

## エクスポートに含まれるもの

`nmt-forge export <run-manifest.json> --prereg <id> --out <dir>` は以下を書き出します：

| パス | 内容 |
|---|---|
| `<dir>/model/` | デプロイ対象のフォルダー：重みとトークナイザー、`forge-model.json`（学習に使用されたデータ、`trained_on.terms`）、`DEPLOY.md` |
| `<dir>/model/champollion-plugin/method.json` | method/1、kind は `nmt-checkpoint`、`service.endpoint` `http://127.0.0.1:<port>/translate`（`--port` でない限りポート 8378）、`card.commercial_ready: false`、テストセットの chrF++・その信頼区間・n を含む `evidence` |
| `<dir>/evaluation/` | テストセットのエビデンス。モデルと一緒にコピーしないでください |
| `<dir>/input-words.json` | 学習文の入力側の単語（重複なしでソート済み：`words`、`english`、`sentences`、`from`、および実行時に読み込めなかった学習ファイル名を指定する `notes`）。`model/` の横に配置され、その内部には含められません。これらはコミュニティのデータに含まれる単語だからです。エクスポートにモデルが含まれており、その学習ファイルがこのコンピューター上にある場合に書き出されます。それ以外の場合、エクスポートのサマリーには `why` とともに `input_words.written: false` と表示されます。`nmt-forge serve` はこれを読み取り、モデルが一度も目にしていない単語を特定します（[下記参照](#words-the-model-never-saw)） |
| `<dir>/README.md` | エクスポートの概要 |

## `mt-eval translate`

ファイルに対するパイプラインであり、スコア付けは行いません。`--out` は `.jsonl`（セグメントごとに1行：`id`、`source`、`output`、`error`、ゲートがある場合は `gates`、
`shipped_from`、`fallback`）または `.tsv`（ソース、タブ、出力）を受け取ります。`--out` が指定されない場合、出力フォルダーに `<run id>.translations.jsonl` を書き出します（`-o`）。
出力には、set/1 サイドカーに入力およびモデルの利用条件が付与されます。

**制約：** メソッドの出力（またはそのゲートチェーンのフォールバックの出力）がローカル専用の場合、翻訳が開始される前にプロジェクト外の出力先は拒否されます：*「refusing to write …: what this method writes is local-only (…), and that is outside … — a place the data's holders did not choose. Only they can agree to that — ask them; if they do: --holders-agreed-by "<who
agreed>" (recorded in the file's sidecar; it stays marked local-only). Or write it inside the project」*。同意がある場合、サイドカーに `holders_agreed: {by, date}` が記録されますが、すべてのツールにおいてファイルはローカル専用のまま維持されます。

`--json` は `translated`、`errors`、`out`、`run_id`、`marked`、
`holders_agreed`、`output_gates` を出力します。全行が失敗した場合は exit 1 となります。`--publish`
は拒否されます（スコアが存在しないため）。

## `mt-eval serve`

| | |
|---|---|
| デフォルトアドレス | `127.0.0.1:8379`（`--host`、`--port`、またはデプロイの `serve` ブロック） |
| サービング対象 | このプロセス内で実行されるメソッドのみ：`lexicon`、`local-model`、または method.json で `dependency_class` が `S` または `O` と宣言されているプラグイン。LLM やホストされたエンジンは拒否されます |
| トークン | `MT_EVAL_SERVE_TOKEN`（環境変数からのみ取得）。`127.0.0.1`、`::1`、`localhost` 以外のアドレスでリッスンする場合に必須。設定されている場合、すべての `POST`（ループバックも含む）で必須。`GET /health` では不要 |
| 制限事項 | 1,000,000 バイトのボディ、500 個のキー、文字列あたり 20,000 文字 — いずれかを超えると `413` |
| ゲート | `--gates <chain>`（またはデプロイの `gates`）。各ゲートのプラグインは参照訳なしで判定できる必要があり、できない場合は起動しません。ここではフォールバックが許可されており、このプロセス内で実行される必要があります |

**制約 — ループバック以外のアドレス：** トークンがない場合：*「refusing to listen on … without a token — anyone who can reach the port could use the method」*。ローカル専用出力であり同意がない場合：*「refusing to serve on …: what this method writes is local-only (…), and an address other machines can reach sends it off this one. Only the data's holders can agree to that — ask them; if they do: --holders-agreed-by "<who agreed>" (reported on /health), or keep --host 127.0.0.1」*。辞書のサイドカーにそう記載されている場合（または読み取れない場合）、あるいはモデルフォルダーの `forge-model.json` にローカル専用の学習条件が記録されているか一切記録されていない場合、出力はローカル専用となります。プラグインや `forge-model.json` のないモデルフォルダーでは、不明（`null`）として報告されます。

`/health` は `status`、`method`、`model`、`pair`、`deployment`（`id`、
`sha256`）、`runs`（このプロセス内 — どこにも送信されません）、`scored`
（なし）、`output_gates`、`gates`（チェーン ID、フィンガープリント、ゲート、フォールバック）、
`output_local_only`、`output_local_only_why`、`holders_agreed_by`、`license`
（`AGPL-3.0-or-later`）、`source`（リポジトリ）、`version` を返します。

ゲートを使用する場合、拒否されたセグメントはゲートの指定に従って返されます：`drop` — `errors` 下のキー、`keep-source` — 原文、`flag` — 出力（`meta.gates.flagged` で指定されたキー）、`fallback` — ゲートが承認した場合のフォールバックの翻訳。ゲートがない場合、返される内容に対するチェックは行われません。

## `nmt-forge serve`

```bash
nmt-forge serve <export>/model --detach        # a supervised background job
nmt-forge serve <export>/model --choose        # also record it as the people's choice
nmt-forge jobs                                 # list jobs
nmt-forge jobs stop <name> --wait 120
```

| | |
|---|---|
| デフォルトアドレス | `127.0.0.1`、ポート `NMT_FORGE_SERVE_PORT` または 8378 |
| トークン | `--token` または `NMT_FORGE_SERVE_TOKEN`。ループバック以外では必須。`--detach` は環境変数からのみ取得 |
| ルート | `GET /` — ユーザー向けのテストページ（トークン不要。設定されている場合はトークンの入力を求めます）、`GET /health`、`POST /translate`（service-api/1）、`POST /v1/chat/completions`（OpenAI互換）、`GET /v1/models` |
| `--detach` | `/health` が応答すると制御を返します。120 秒以内に応答しない場合は停止。ポートが既に応答している場合は拒否されます |
| `--no-hook` | 実行時のデコードフックなしでサービング（`/health` および `meta` 内で通知） |
| `--allow-locale` | これらのロケールコードも受け付ける（複数回指定可） |
| `--device` | `auto`（デフォルト）または `cpu`。`auto` の場合、同じプロジェクトの学習ジョブの実行中に起動されたサーバーは、GPU を共有せずに CPU を使用し、`/health` がその旨を示します（`device_note`） |
| 制限事項 | 1,000,000 バイトのボディ、500 個のキー、文字列あたり 20,000 文字、1 リクエストあたりモデル処理 5,000 件 — いずれかを超えると `413`。モデルには一度に 32 件ずつ処理を要求するため、別のリクエストからの文はリクエスト全体ではなく 1 チャンク分だけ待機します。600 秒経過後も処理中のリクエストは全体が拒否され（`503`、*「send fewer pieces at a time」*）、部分的に応答されることはありません |
| デコーディング | エクスポートに `beams_applied` が記録されている場合はそのエクスポートの `num_beams` によるビームサーチ（モデル測定時と同じ）。古いエクスポートの場合は greedy（貪欲法）。送信されたテキストは学習データと同様に NFC に正規化されます |

**制約：** ループバック以外のアドレスでは、出力がローカル専用のモデル（ローカル専用の文で学習された、または学習元の記録がないモデル）は
`--holders-agreed-by` なしでは拒否されます。`/health` は `pair`、`accepts`、
`decode_hook`、`run`、開発用（dev）およびテストのレポート、`score_caveats`、`caveats`、
`trained_on`、`output_local_only`、`holders_agreed_by`、`device_note`、
`limits`（`pieces_per_request`、`pieces_per_turn`、`request_seconds`）、
`unseen_words_check`、`text_pipeline`、`output_gates` を報告します。ローカル専用モデルからのすべての `/translate` の応答には
`meta.output_local_only: true` が含まれ、すべての
`/v1/chat/completions` の返答には `meta.output_local_only`（true または false）が含まれます。
長さ制限によってリクエスト内のデータが切り詰められた場合、その `meta.cut` は入力時に切り詰められた文（`inputs`）と上限で停止した翻訳（`outputs`）をカウントします（[学習](/docs/agents/training#the-guarded-loop)）。

**注意：** テストページは人間（ユーザー）向けです。ローカル専用モデルの場合、`try_translation`（MCP）はユーザーをそのページへ案内します。その出力を読み取るためにエージェント自身で `/translate` を呼び出してはなりません（[規約](/docs/agents/contract) §1）。

### モデルが一度も目にしていない単語

学習時にモデルが一度も目にしたことがない単語を含む文は、どれほど流暢に読めたとしても誤訳されている可能性が非常に高くなります。人工テスト言語において、モデルが見たことのない内容語を含む未知の文（held-out sentence）が正しく翻訳された例は 358 回中 0 回でした（ByT5-small、学習ペア 1,600、6,400、25,600 件）。そして、確信を持った誤り（流暢で、すべての単語が実在する語形でありながら、意味が誤っている）として出力された割合は、それぞれ 32%、55%、83% に達しました。モデルの性能が高いほど、そのもっともらしい推測は説得力を帯びてしまいます。そのため、サーバーは該当する単語を明示します。

- **`/health`** はチェックが可能かどうかを示します：`unseen_words_check` は `{on: true,
  words_seen: <count of words in input-words.json>, notes}` or `{on: false,
  why}` です。
- **`/translate`** は、リクエストに該当する単語が含まれている場合にのみ、
  `meta.unseen_words`（キー → そのキーのテキスト内でモデルが目にしたことのない単語、重複なし、出現順）および `meta.unseen_note` を追加します。**`/v1/chat/completions`**
  も同様の情報を、要求された形式に応じたキー（ブロックモードではセグメントごとの `SEG_<id>`、ページの場合は `page`、JSON オブジェクト自体のキー、または `text`）で追加します。
- **記録がない場合（すべての返答で通知）：** サーバーはサービング対象のモデルフォルダーの上位フォルダーから `input-words.json`
  を読み取ります。そこに存在しない場合（
  export made before 2026-10-13, one made without its training files on this
  コンピューター、またはエクスポートから別の場所にコピーされたモデルフォルダーなど）、すべての返答の
  `meta.unseen_check` にチェックできない旨とその理由が示されます。モデルはその
  export, or export it again.
- **テストページ** では、該当行に次の警告が表示されます：*「Never seen in training: … — this line is
  very likely wrong, however fluent it reads.」*

単語とは、任意の文字体系（スクリプト）における一連の文字（内部のアポストロフィは保持）を小文字化し、NFC に正規化したものです。入力側が英語の場合、標準的な英語の語尾変化はどちらの向きでも学習済みとみなされます（`walk` が見つかった場合 → `walked` も学習済みとみなす、`walked` が見つかった場合 → `walk` も学習済みとみなす）。

## service-api/1 — `/translate` 規約

`$schema` `https://champollion.dev/schemas/service-api/1.json`。`shared/test-fixtures/framework/service-api-vectors.json` に準拠します（`mt-eval serve` および `nmt-forge serve` に対して実行）。

- **リクエスト** `POST /translate`：`keys`（キー → 原文字符列、必須）、
  任意の `source_locale`、`target_locale`、`method`、`text_format`
  （文書テキストの場合は `"markdown"`）、`instructions`（キー → ノート。これに従うと宣言されたサーバー `accepts_instructions` にのみ送信）。サーバーが使用しないフィールドは無視され、拒否されることはありません。
- **レスポンス：** `200` `{translations, meta}` — `meta` は必須。`207` は
  `errors`（キー → `{message}`）を追加。エラーは `{error: {message}}` です：受け入れられないリクエストは `400`、トークンの欠落や誤りは `401`、不明なルートは `404`、サイズ超過は `413`、メソッドの失敗は `500`（部分的な応答は決して返しません）。（`nmt-forge serve` は 600 秒の制限を超えたリクエストに対して `503` も返します。）
- **`meta`：** `method`、`model`、`output_gates`、`output_local_only`
  （true、false、または null）、`cost_usd`。サーバーはフィールドを追加できます。
- **`GET /health`** は `status`（`ok`）、`pair`、`output_gates`、
  `output_local_only` を必須とし、任意の `output_local_only_why`、`holders_agreed_by`、
  `model`、`method`。
- **ルール：** `/health` に `output_local_only: true` と記載されているサーバーは、すべてのレスポンスの `meta` に `output_local_only: true` を設定し、クライアントはそのような出力をデータ保持者が同意した場所にのみ書き出します。

## `champollion connect`

```bash
champollion connect <export>/model --app <app folder>
champollion connect <export>/model --app <app folder> --holders-agreed-by "<who agreed>"
```

`method.json`（指定されたファイル、またはフォルダー内の `method.json`、
`champollion-plugin/method.json`、`model/champollion-plugin/method.json`）を見つけ、アプリの `.champollion/methods/` にインストールし、
各ペア（`<inputLocale>:<target>`）の他の設定を維持したまま、それを `methodPlugin` として指すように設定します。アプリフォルダーには `champollion.config.json` が必要であり、
メソッドはアプリの `inputLocale` から翻訳できる必要があります。

**制約：** 出力がローカル専用であるモデル（`forge-model.json` から判明、存在しない場合も該当、またはそのサービスの `/health` から判明）は、
`--holders-agreed-by` なしでは拒否されます。モデルがアプリのロケールファイルに書き込む内容はアプリとともに公開されるためです。指定がある場合、各ペアに
`holdersAgreed: {by, date, method, what}` が記録されます。エンドポイントで何も応答しない場合（`nmt-forge serve <dir> --detach` で起動可能）や、
`/health` が service-api/1 に準拠していない場合、エラーで失敗することなく警告を出力します。`--json` は `method`、
`kind`、`pairs`、`endpoint`、`answering`、`health_problems`、
`holders_agreed_by` を出力します。

## エージェントによる `champollion sync` の実行

`sync` は、アプリまたはサイトのロケールファイルを、その
`champollion.config.json` で指定されたメソッドを使用して翻訳します。対話形式での確認は行いません。

```bash
champollion sync --dry-run --json      # what would be sent, and its estimated cost
champollion sync --max-cost 2 --json   # stop before any call if the estimate is over $2, or unknown
champollion verify                     # placeholders, scripts, key parity
```

**`--json` の出力** は1行につき1つの JSON オブジェクトです。標準出力（stdout）には：`{level: "info" |
"ok", message}`, events `{level: "event", event: "cost" | "file" | "verify" |
"request", …}`, and last `{level: "summary", command: "sync", …}`（
`dryRun`、`totalProcessed`、`totalFailed`、`totalHeld`、`tmHits`、
`sentToModel`、`verify`（`ran`、`errors`、`warnings`）、`failedPairs`、
`locales`、`costEstimate` などを含む）。ドライランではさらに `preflight`、`realRun`
（`exitCode`、`wouldStop`、`reasons`）、`maxCost` が追加されます。標準エラー出力（stderr）には：`{level: "warn"
| "error", message}`. A hard error prints a summary with `ok: false` および
`error`。

| 終了コード | 意味 |
|---|---|
| 0 | 正常終了 |
| 1 | `--redo` または `--force-keys` の名前がどのキーとも一致しなかった、何も処理されずに失敗した、エラーが発生した |
| 2 | 呼び出し前に `--max-cost` によって停止された（または見積もりが不明だった）、あるいは一部完了（何かが失敗した、キーが保留された、複数形が不足している、または verify でエラーが検出された） |

ドライランは何も送信・書き込みを行わず、検証（verify）も実行せず、指定されたキーが一致しなかった場合やエラーが発生した場合を除き 0 で終了します。検証は、`--no-verify` が指定されていない限り、実際の同期（sync）の後に実行されます。

**制約 — ローカル専用の応答：** `api` メソッドの場合、`meta.output_local_only` が `true` であるバッチは、ペアの
`holdersAgreed` でそのメソッドが明記されていない限り書き込まれません。`sync` はその旨を一度通知し、
`champollion connect … --holders-agreed-by` の呼び出し名を提示します。それらのキーは未翻訳のまま維持されます（またはペアのフォールバックに送られます）。

**制約 — `local` メソッド：** `local` メソッド（OpenAI互換エンドポイント）は、サーバーの `/health` に一度問い合わせます。それが
`output_local_only: true` を返す場合（ローカル専用の文で学習されたモデルに対して `nmt-forge serve` が行うのと同様）、ペアの
`holdersAgreed` で `local` が明記されていない限り、そのサーバーからの出力は一切書き込まれません：*「the model at … says what it writes is
local-only … nothing from it was written」* に続いて
`champollion connect <the model> --holders-agreed-by "<who agreed>"` の呼び出しが表示されます。`/health` が応答しない、または `true` を返さないサーバー（例えば Ollama や
LM Studio のサーバーなど）は、従来通り使用されます。

**注意：** forge モデルは `champollion connect`（`api`
ルート）を使用して接続してください。モデル自身の学習元記録を読み取り、インストールするメソッドのペアに保持者の同意を記録します。

**モデルが一度も目にしていない単語：** forge サーバーが `meta.unseen_words` でキーを指定した場合、`local` および `api` メソッドは該当するキーを警告します（テキストや単語そのものは出力されません）：*「<API batch N | Local method>: <n> key(s) hold
words the model never saw in training — very likely mistranslated, however
fluent; have a speaker check them: <up to 20 keys>」*（続けて *「and <n> more」*）。
翻訳自体は書き込まれます。この警告によって、コミュニティの人々はどれを確認すべきかを把握できます（[コーチング](/docs/agents/coaching)）。

**注意：** すべての `warn` 行をそのまま伝えてください。機械翻訳された文字列は、話者が確認するまでは下書きにすぎません。決してそれらを「正しい」と呼ばないでください。

## `champollion serve`

別のサーバー：**アプリプロジェクト** 自身が設定した翻訳スタック（メソッド、コーチング、翻訳メモリ、品質ゲート）を他のプロジェクトにサービングします。デフォルトは `127.0.0.1`、ポート 1822 です。ループバックバインドでのみ受け入れられる `--no-auth` が指定されていない限り、ループバック上であってもベアラートークン（`--token` または `CHAMPOLLION_SERVE_TOKEN`、12文字以上）が必要です。`--emit-manifest` は、利用者向けに kind が `service` である method/1 マニフェストを書き出します。その `/health` は service-api/1 のヘルスドキュメントではなく `{ok, service, version}` であるため、`champollion connect` がそのヘルスの問題を報告します。

## さらに詳しく

- [実際に動かす](/docs/put-it-to-work) — 一般・コミュニティ向けバージョン。
- [メソッドとゲート](/docs/agents/methods) — method/1 と gate-chain/1。
- [データと転送のルール](/docs/agents/data-rules) — ローカル専用と
  `holders_agreed`。
- [Rails モデル](/docs/agents/rails-model) — 単一のパイプライン。
- [`mt-eval` リファレンス](/docs/reference/mt-eval) および
  [`nmt-forge` リファレンス](/docs/network/getting-started/forge-command-reference)。
- アプリおよびサイトの翻訳：[CI/CD](/docs/guides/ci-cd)、
  [トラブルシューティング](/docs/guides/troubleshooting)。
