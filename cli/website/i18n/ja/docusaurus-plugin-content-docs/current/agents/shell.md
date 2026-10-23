---
title: "シェルからレールを操作する"
slug: /agents/shell
description: "レールの各ステップを通常のコマンドとして実行できます：インストール、プロジェクトの開始、データの取り込み、用語の記録、nmt-forge を使ったモデルの学習とテスト、改善ラウンドの実行、mt-eval を使った翻訳と提供 — さらにオフラインモード、ツールが読み取る環境変数、終了コードについても説明します。"
---

# シェルからレールを操作する

レール上のすべてのステップは通常のコマンドです。MCPを持たないエージェント、あるいは端末に向かう人間は、`champollion`、`nmt-forge`、`mt-eval`の3つのプログラムを使って同じレールを進みます。順序を覚える必要はありません。プロジェクトのファイルから読み取られた次のステップが、そのモードおよび正確なコマンドとともに`champollion next`によって提示されます。

ルールはMCP経由の場合と同じです。`confirm`ステップは担当者が「はい」と答えた後にのみ実行され、`ask_user`ステップの回答は担当者自身によるものです（[コントラクト](/docs/agents/contract)）。

## インストール

```bash
npm install -g champollion                  # Node.js 20.11 or newer
uv tool install --python 3.12 nmt-forge     # brings mt-eval (mt-eval-harness) with it
```

**注意:** どちらもパッケージをダウンロードします。`confirm`モード — 事前に確認してください。`uv --version` が失敗した場合、利用者は https://docs.astral.sh/uv/ から uv をインストールします。エージェントがインストーラーをダウンロードすることはありません。トレーニングにはさらに forge の training エクストラ（PyTorch および Hugging Face transformers、数百MB）が必要です。不足している場合は forge がそれを指定します（状態 `needs-training-extra`）:

```bash
uv tool install --reinstall --python 3.12 'nmt-forge[hf]'
```

レールには `nmt-forge` 0.3.0 以降が必要です。古いバージョンがある場合は、アップグレードコマンド（`uv tool install --upgrade --python 3.12 nmt-forge`）とともに示されます。

## ループ

```bash
champollion next              # the next step: what to say, why, the command, how to take it
champollion next --json       # the same, for a program (see the rails model page for the shape)
champollion next --write      # also rewrite NEXT.md, the person's copy
```

人向け出力の `How:` はモードを示します: `run it` (`auto`)、`ask first, then
run it` (`confirm`), `ask the person who holds the data — never answer for
them` (`ask_user`), `wait, then ask again` (`wait`), `a person does this`
(`human_only`)。提示されたコマンドを実行し、その後再び確認してください。レールから外れても問題ありません。任意のエキスパートコマンドを実行した後に `champollion next` を実行してください。ファイルから次のステップが読み取られます。

## 開始

```bash
champollion new family --from English --to qaa --target-name "Our language" --dry
champollion new family --from English --to qaa --target-name "Our language" --purpose "notes for the grandchildren"
cd family
```

言語は言語カードを通じて解決されるコードまたは名称です。コードを持たない変種には私用コード（`qaa`–`qtz`）とその人々が呼ぶ名称（`--target-name`、`--source-name`）を使用します。**注意:** プロジェクトが作成される前に、言語方向を復唱して確認してください。`--dry` は両方の言語を解決し、書き込みは一切行いません。各言語は担当者が呼んだとおりに正確に渡してください。

## 収集と条件の記録

```bash
champollion data add ../family-files/grandpa.xlsx                     # pairs → data/parallel/
champollion data add ../family-files/grandpa.xlsx --source-col A --target-col B --header
champollion data add ../family-files/words.lift --into lexicon        # a word list → data/lexicon/
champollion data add ../family-files/recording.eaf --source-col <number> --target-col <number>   # ELAN: tier numbers
```

`data add` は `.xlsx`、`.ods`、`.csv`、`.tsv`、`.txt`、Word `.docx` の表、Toolbox および LIFT 辞書、ELAN `.eaf`、USFM（`--usfm-source`）を読み取ります。`<stem>.tsv` とそのサイドカーを書き出し、オリジナルには一切手を触れず、カウント、列、行チェックで検出された行番号（重複、繰り返し、不自然な長さ、入れ替わりやズレのある行 — 何も削除されません）を出力します（文そのものが出力されることは決してありません）。どの列（または番号による ELAN ティア、LIFT 言語）がどれであるかを特定できない場合、拒否して質問を返します。担当者に確認してください。`--replace` は保持者の回答を保持したまま、別の列で同じオリジナルを再読み込みします。`--name <stem>` は別の名前で別のファイルを追加します。[データルール](/docs/agents/data-rules#what-tools-print-and-never-print)を参照してください。

続いて、担当者の回答をもとに、1ファイルずつ条件を記録します:

```bash
champollion data mark data/parallel/grandpa.tsv --speakers "grandpa" --speakers-agreed yes \
  --owner "our family" --training allowed --local-only
```

まだローカル専用になっていないファイルには、`--local-only` または `--may-leave` が必要です。ジャーニーの条件（terms）ステップでは、トレーニングに関する回答と `--speakers-agreed` の両方が記録されるまで、`data/parallel/`、`data/lexicon/`、`data/grammar/`、`data/monolingual/` の各ファイルについて質問します。すべての値は保持者によるものです — それぞれの動作とコマンドが拒否する内容については、[データルール](/docs/agents/data-rules)を参照してください。

## テストセットを保護する

```bash
champollion data add ../family-files/checked.tsv --into test
champollion data mark data/test/checked.tsv --role test --training not-allowed --local-only
```

## モデルの構築とテスト

ジャーニーはこれらを順番に提示します（それらの `{placeholders}` はプロジェクトから補完されます）:

```bash
nmt-forge init qaa --dir . --pair eng-qaa --no-card --name "Our language" --model auto
nmt-forge registry add project-test data/test/checked.tsv --role test
champollion data combine
nmt-forge leak-audit data/parallel/combined.tsv --clean-to data/clean/combined.clean.jsonl
nmt-forge prereg new first-model --eval-set project-test --expect "<their words>" --rationale "<their reason>"
nmt-forge split data/clean/combined.clean.jsonl --test 0 --dev 50 --seed 42 --near-dupe 0.6 --max-group 26 --out data/split --register project
nmt-forge floor data/lexicon/words.tsv
```

- `init --model auto` は、このコンピューターがそのメモリで数時間以内に学習できる最強のモデルを選択します（[学習](/docs/agents/training#models)）。言語カードがある場合、`--no-card --name` は省略されます。
- `data combine` は、`data/parallel/` に複数のファイルが含まれている場合にのみ実行されます。結合するファイルの最も厳格な利用規約を維持し、保有者がまだ回答していないファイル（モデルがそこから学習してよいか、含まれる言葉の全員が合意したか）は拒否します。
- `prereg new` は `ask_user` のステップです。`--expect` と `--rationale` は人々の言葉そのものであり、スコアが存在する前に書かれたものです。質問は数値を提示しませんし、あなたも提示してはいけません。
- ジャーニーが埋める開発セットのサイズ（`dev_n`）は、審査されたペアの10分の1で、最小50、最大500です。200ペア未満の場合は代わりに4分の1となり、学習用を最大限確保します（50未満になります）。つまり、160ペアから開発用40文、200〜500ペアから50文、1,600ペアから160文、5,000ペア以上から500文となります。50未満の場合、開発セットでラウンドを判定することはできません（[測定](/docs/agents/measurement#comparing-two-models)）。`--near-dupe 0.6` はほぼ重複するペアを片方にまとめます。`--max-group` は開発サイズの半分（切り捨て）＋1です。
- `floor` は `data/lexicon/` に単語リストが含まれる場合にのみ適用されます。

ここからは、forge 自身のアドバイザーが各ステップを提示します。`champollion next` がそれを中継し、`nmt-forge status` はそれを直接伝えます:

```bash
nmt-forge preflight run --config config.json && nmt-forge run config.json --detach
nmt-forge jobs                      # what is running
nmt-forge status                    # the next step, with what is ready and what blocks it
nmt-forge export <run-manifest.json> --prereg first-model --out export/
nmt-forge serve export/model --detach
nmt-forge tidy                      # earlier rounds' model weights nothing uses, and the space they take
```

学習は `confirm` です（計算資源を消費し、数分から数時間かかります）。デタッチされた実行が学習している間、ステップは `wait` になります。`nmt-forge run` は、ディスクに空きがない実行を開始前に拒否し（`[disk-room]`）、空き容量、その見積もり、および `nmt-forge tidy` が解放する容量を示します。`nmt-forge tidy --yes` で空きを確保し、`run` での `--skip-disk-check` は強制的に開始して実行ログに記録します。この2つは利用者の判断であり、あなたが決めることではありません（[学習](/docs/agents/training#disk-space)）。エクスポートはテストセット上で予測に対してモデルを一度スコア付けします。複数のエクスポートからの選択は利用者が行います（`nmt-forge choose <model folder>`）。テストセットのスコア付けの後、人々はその予測を評価します：

```bash
nmt-forge prereg verdict first-model --prediction 1 --held --by "grandma"
```

（予測が成り立たなかった場合は `--missed`。`--prediction` は予測の番号であり、単一の `--expect` の場合は 1 です。`--by` は判定した人の名前を言われた通りに指定します。）すべての forge コマンドと拒否条件については、[トレーニング](/docs/agents/training)を参照してください。

## 改善ラウンド

モデルが提供（serve）されると、ラウンドが始まります:

```bash
champollion improve time --per-week "about 30 sentences" --total "maybe 800"
champollion improve wishlist        # improve/round-<k>/wishlist.md, a printable sheet
# the people write 20 or more sentences in improve/round-<k>/to-translate.txt
champollion improve sheet           # the model in use drafts them → improve/round-<k>/review.csv
# the speaker marks the Right? column: Y, N (and how it is said), or ?
champollion improve marks           # counts the marks; fixes and confirmed drafts become pairs
champollion improve report          # the round's report
champollion improve prepare         # grows the dev set, screens, points config.json at the round's file, plans the training
nmt-forge preflight run --config config.json && nmt-forge run config.json --detach
champollion improve status          # the rounds so far: marks, and each verdict in the round report's words
```

- `improve sheet`：開発（練習用）セットが200文未満の間は、一部の行には下訳がありません。50文未満の間は2行に1行、50文からは4行に1行の割合で、話者が自ら記入します。`improve marks`はそれらを`data/dev/`に書き込み、`improve prepare`は開発セット（`nmt-forge grow-dev`）に追加しますが、トレーニング用には決して追加しません。また、`nmt-forge draft-newer`も実行します。別のモデルがある場合（使用されていない最新のトレーニング済みモデル（ラウンド後に採用されなかったもの：データが少なすぎて判断できない、測定可能な変化がない、または悪化した場合）、あるいはプロモーション後に現在使用中のモデルによって置き換えられたモデルなど）、そのモデルが下訳のある行のランダムな半分を下訳し、印は付けられず、正解キーはシートの傍に保持されます（`sheet-key.json`）。その後、`improve marks`が各モデルを別々に集計します。これはブラインド比較であり、プロモーション後にレポートが上昇を真の進歩と見なす前に必要とする検証です（[測定](/docs/agents/measurement#the-speakers-marks)）。
- `improve sheet`（第2ラウンド以降）：新しい文10文ごとに1行（切り捨て）の割合で、話者が以前のシートで`Y`または`N`と評価した下訳が、印のない状態でランダムな位置に再登場します。シートの先頭行には、一部の行が意図的に再登場することが示されますが、どの行かは明かされません。`sheet-key.json`にそれらが一覧表示されます（`repeat_rows`）。コマンドは、再登場した行数、*「（どの行かは示されていません）」*、そして*「1行あたり約10秒、二度とトレーニングには使用されません」*という内容を表示します。
- `improve marks`は、再表示された行を話者の以前の評価とのみ比較して判定し（ラウンドの取り分、トレーニングペア、またはブラインド比較には決して含めません）、`repeats`を`marks.json`に書き込み、*「Rows shown again: the speaker marked A of J the way they did before (P%) — W once wrong now right, R once right now wrong. Not counted in this round's share, and not trained on again.（再表示された行：話者はJ行中A行を以前と同じように評価しました（P%）— 以前は誤りで今回は正しいものがW行、以前は正しく今回は誤りだったものがR行。このラウンドの取り分にはカウントされず、二度とトレーニングには使用されません。）」*と表示します。
- `improve marks`は、もう一方のモデルがより新しいもので、話者がそれぞれのモデルの下訳を少なくとも1つ評価した場合、forgeにカウントを記録します（カウントのみであり、文そのものは決して記録しません）：

  ```bash
  nmt-forge speaker-verdict --newer <run> --in-use <run> --newer-right <n> --newer-judged <n> --in-use-right <n> --in-use-judged <n> --json
  ```

  話者が新しいモデルのほうを明らかに多く「正解」とマークした場合、*"forge recorded it: it offers to put the newer model to use (the people say yes first)"*（forgeに記録されました：新しいモデルの採用を提案します（まず人々が承認します））と出力されます。forgeがインストールされていないか拒否した場合は、評価が記録されなかったこととその理由が表示されます。
- `improve prepare` は `nmt-forge round-plan` で終了します。ラウンドは使用中のモデルから継続するか（これまでのすべての文を4エポック学習）、最初から学習し、その理由を示します（[学習](/docs/agents/training#the-improve-rounds)）。

Forgeはその後、新しいモデルを現在使用中のモデルと比較評価し
（`nmt-forge compare-runs <in-use run-manifest.json> <new run-manifest.json>`、
`auto`）、測定可能な改善が見られた場合のみ、実運用への投入（`confirm`）を提案します
— あるいは、判定材料が少なすぎて判断がつかない場合（開発文が50文未満）
や測定可能な変化がなかった場合でも、話者によるブラインド評価で明確に好まれたときに提案します。
判定だけで何かが実運用されることはありません。人々の「はい」（そのステップの
`nmt-forge export`と`nmt-forge choose`）があって初めて実運用されます。`improve marks`からの新しいペアは、
まず独自の用語を設定します — ジャーニーから確認の質問があります。
レポートの伝え方：[コーチング](/docs/agents/coaching)。

## mt-eval による翻訳と提供

プロジェクト内で `nmt-forge export` を実行すると `deploy/<name>.json`（deployment/1）が書き出されます。この同じファイルが測定、翻訳、提供を行います:

```bash
mt-eval translate --deployment deploy/<name>.json --source-file <input file> --out <output file>
mt-eval serve --deployment deploy/<name>.json      # http://127.0.0.1:8379 by default
mt-eval run --deployment deploy/<name>.json --corpus <dev or test file>
```

- **注意:** テストファイルに対する `mt-eval run` は事前登録を必要としません — 読み取りをログに記録するだけです。テストセットのスコア測定は `nmt-forge export` を通じて（または予測が記録された後に）行ってください。それ以前に測定してはなりません。
- `--gates gates/<chain>.json` は、ゲートチェーンを `run`、`translate`、または `serve` に追加します（`--deployment` なし）。`run` と `test` はフォールバックするチェーンを拒否します。[手法とゲート](/docs/agents/methods)および[提供（serving）](/docs/agents/serving)を参照してください。

## レールを外れて: ある言語に何が存在するか

```bash
champollion network card <code>                    # the cited language card
champollion network recommend <source> <target>    # methods that can run, with their evidence
mt-eval corpora --source <source> --target <target>   # registered test sets for the pair
nmt-forge discover <code>                          # what a training project can use
```

## ファイルの確認とアップグレード

```bash
champollion validate        # project file, sidecars, method.json, gates/, deploy/ — 0 ok, 1 invalid, 2 usage
champollion upgrade --dry   # what upgrading older sidecars to set/1 would change; drop --dry to write
```

## オフライン

`CHAMPOLLION_OFFLINE=1` は `champollion` CLI がネットワークにアクセスするのを停止します。言語カードは同梱されたセットおよびローカルキャッシュからのみ取得され（ロングテールのカードは取得されません）、日次のカードキャッシュ更新はスキップされ、`register-corpus` はファイルのハッシュを公開カタログと比較しません（未比較として記録されます）。これはメソッドが送信する内容を変更するものではありません。プロバイダーを呼び出すメソッドには引き続きネットワークが必要であり、送信ルールも引き続き適用されます。

`MT_EVAL_NO_REMOTE_REGISTRY=1` は `mt-eval` がウェブからデータセットレジストリを取得するのを停止します（エアギャップ環境のマシン用）。

レールの進行においていずれにせよネットワークを必要とするもの: ツールのインストール、training エクストラ、および事前学習済みモデルの初回ダウンロード（`byt5-small` または `byt5-small-lowmem`、約1.2 GB。`cpu-tiny` は何もダウンロードしません）。

## 環境変数

オペレーター向けに、コードによって読み取られます。プロバイダーの API キーはプロバイダーを呼び出すメソッドでのみ必要とされ、レールのデフォルトパスでは一切必要ありません。

| 変数 | 読み取り元 | 効果 |
|---|---|---|
| `CHAMPOLLION_MCP_PROFILE` | MCP サーバー | `rails`（デフォルト）または `full` |
| `CHAMPOLLION_CLI_BIN` | MCP サーバー | 実行する `champollion` エントリーポイント |
| `NMT_FORGE_BIN` | `champollion`、MCP サーバー | `nmt-forge` 実行ファイル |
| `UV_TOOL_BIN_DIR` | `champollion`、MCP サーバー | `PATH` 後に `nmt-forge` および `uv` を検索する場所（デフォルトは `~/.local/bin`） |
| `CHAMPOLLION_OFFLINE` | `champollion` | `1`: カードまたはカタログ検索用のネットワークアクセスなし |
| `CHAMPOLLION_CARDS_CACHE_DIR` | `champollion` | ユーザーごとのカードキャッシュ（デフォルトは `~/.champollion/cards`） |
| `CHAMPOLLION_CARDS_TTL_HOURS` | `champollion` | カードキャッシュの更新を確認する頻度（デフォルトは 24） |
| `NMT_FORGE_AUTO_PRESET` | `nmt-forge init --model auto` | `auto` が選択するプリセットを固定（プリセット名である必要あり） |
| `NMT_FORGE_SERVE_PORT` | `nmt-forge serve` | デフォルトポート（未設定時は 8378） |
| `NMT_FORGE_SERVE_TOKEN` | `nmt-forge serve` | Bearer トークン。ループバック以外で必須 |
| `NMT_FORGE_NO_MONITOR` | `nmt-forge run` | `1`: ライブトレーニングパネルなし |
| `MT_EVAL_SERVE_TOKEN` | `mt-eval serve` | Bearer トークン（コマンドライン値としては指定不可） |
| `CHAMPOLLION_SERVE_TOKEN` | `champollion serve` | CLI 自身のサーバー用 Bearer トークン |
| `MT_EVAL_NO_REMOTE_REGISTRY` | `mt-eval` | `1`: レジストリの取得なし |
| `MT_EVAL_DATA_ROOT` | `mt-eval` | 登録済みデータセットのパスが最初に解決される場所 |
| `OPENROUTER_API_KEY` | `champollion`、`mt-eval` | デフォルトのホスト型モデルプロバイダーのキー |

## プログラム向け出力

| ツール | マシン向け出力 | 終了コード |
|---|---|---|
| `champollion` | レールコマンド（`new`、`next`、`data add`、`data mark`、`data combine`、`improve report`、`improve status`、`connect`、`upgrade`）での `--json` | 0 成功 · 1 拒否 · 2 使用法エラー |
| `nmt-forge` | すべてのサブコマンドでの `--json`: 標準出力に1つの JSON ドキュメント、それ以外はすべて標準エラー出力 | 0 成功 · 2 拒否（`{"error": …}`） |
| `mt-eval` | すべてのサブコマンドでの `--json` および `--non-interactive` | 0 成功 · ゼロ以外 拒否 |

拒否の形式: [レールモデル](/docs/agents/rails-model#refusal-shapes)。

## さらに詳しく

- [`champollion` コマンドリファレンス](/docs/reference/cli)、[`nmt-forge`](/docs/network/getting-started/forge-command-reference)、[`mt-eval`](/docs/reference/mt-eval)。
- [レールモデル](/docs/agents/rails-model) — ジャーニーと `next --json`。
- [MCP 経由でレールを操作する](/docs/agents/mcp) — 6つのツールとしての同様のステップ。
- [nmt-forge によるトレーニング](/docs/agents/training)および[データルール](/docs/agents/data-rules)。
