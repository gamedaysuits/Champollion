---
sidebar_position: 1
title: "CLIリファレンス"
related:
  - label: "Quick Start"
    to: /docs/getting-started/quick-start
    kind: guide
  - label: "Configuration"
    to: /docs/getting-started/configuration
    kind: reference
  - label: "CI/CD"
    to: /docs/guides/ci-cd
    kind: guide
  - label: "Troubleshooting"
    to: /docs/guides/troubleshooting
    kind: guide
---

# CLIリファレンス

## コマンド

ある言語向けの機械翻訳を構築するコマンド（「レイル」）は、`champollion new` が作成するプロジェクトフォルダー上で動作します：

```
champollion new <folder>      Start a project: --from <language> --to <language> (--dry says the direction back first)
champollion next              THE next step, from the project's files (--json for agents)
champollion data add <file>   Bring in a spreadsheet, .csv/.tsv, Word table, dictionary or ELAN file
champollion data mark <file>  Record what a data file's holders decided
champollion data combine      Join the pair files into the one training reads
champollion improve <step>    Make a model in use better, round by round (time, wishlist, sheet, marks, prepare, report, status)
champollion validate          Check a project's files against the schemas every tool shares
champollion upgrade           Rewrite older framework files in the current formats (--dry first)
champollion connect <model>   Put a served model into an app or website project (--app <folder>)
```

アプリやウェブサイト自体のファイルを翻訳するコマンド：

```
champollion init              Interactive setup wizard (--yes for quick defaults)
champollion sync              Translate & sync all locale files
champollion watch             Auto-sync when the source file changes
champollion serve             Serve this project's translation stack over HTTP (the api method's contract)
champollion audit             List untranslated and out-of-date translations (CI completeness gate)
champollion lint              Scan source code for hardcoded strings
champollion wrap              Auto-wrap hardcoded strings in t() calls (with undo)
champollion seo <sub>         Generate hreflang, sitemap.xml, or JSON-LD schema
champollion integrity         Audit locale files for format/encoding issues
champollion repair-script     Restore romanization where script conversion was unwanted
champollion verify            Verify translations are present and correct (CI gate)
champollion status            Show pair configuration, plugins, and benchmark scores
champollion provenance        Audit translation resource licensing
champollion plugin <sub>      Manage method plugins (install, remove, list)
champollion fonts <sub>       Download web fonts for PUA script converters
champollion tm <sub>          Manage Translation Memory cache (stats, clear, seed, prune)
champollion xliff <sub>       Export/import XLIFF 1.2 for professional review
champollion models            List available models from a provider (--method <provider>)
champollion models check      Check every default model against the providers' live lists (free)
champollion doctor            System health check (cards, config, FSTs, API keys, methods)
```

プロジェクトではなく、共有インデックスやリーダーボードと連携するコマンドは、`champollion network` 配下にまとめられています。各コマンドはプレフィックスなしでも動作します。

```
champollion network card <code>        What the index knows about a language (--json for raw output)
champollion network recommend <s> <t>  Methods you can run for a pair, with the evidence for each, and open models that declare the target (or one pair: eng-crk)
champollion network leaderboard        Published results; install a proven method (--install, --apply)
champollion network register-corpus    Register a test set without handing it over (local-only/private/public/sealed)
champollion network seal-corpus <sub>  Sealed-tier crypto verbs: keygen / seal / open (organizer-node bridge)
champollion network submit             Propose an index entry (review-gated): prints a pre-filled GitHub issue
```

任意のコマンドの詳細なヘルプを表示するには `champollion <command> --help` を実行してください
（`champollion network` はネットワークコマンドの一覧を表示します）。

## グローバルオプション

```
--help, -h              Show help (global or per-command)
--version, -v           Print version and exit
--yes, -y               Skip interactive prompts, use defaults
--config <path>         Custom config file path
--dir <path>            Override locales directory
--content-dir <path>    Folder of Markdown/MDX to translate (a Hugo content/ or any folder); each translation is written beside its source as <name>.<locale>.md
--source <code>         Override source locale (default: en)
--model <model>         Translation model for this run only (an exact model slug; aliases and floating "-latest" ids are refused); the config is not changed — to switch for good, edit "model" in champollion.config.json
--method <method>       Translation method for this run only: llm, llm-coached, local, openai, anthropic, gemini, google-translate, deepl, … Overrides the config, including a pair's own method (sync says which); scope with --pair. To switch for good, edit "defaultMethod" (or the pair's "method")
--temperature <n>       LLM temperature (0.0–2.0, default: 0 — deterministic; the one default for translating and evaluating)
--coaching-file <path>  Path to free-text coaching prompt file (injected into system prompt)
--format <fmt>          Locale file format: json, toml, yaml, po, arb, or auto
--dry, --dry-run        Preview changes without writing files
--list-keys             With --dry: name every queued key per reason
--concurrency <n>       Max parallel API calls (sets both JSON and content, default: 48)
--json-concurrency <n>  Max parallel locale translations for JSON keys (default: 200)
--content-concurrency <n> Max parallel API calls for content translation (default: 48)
--redo <scope>          Translate again: all | keys:<k1,k2> | content | files:<glob> (repeatable). Cached text is still served, so a redo is cheap. gaps: every plural message on disk without a form its language uses for ordinary counts — asked from the model, not the cache
--prune plural-extras   sync: remove i18next plural keys for a form the language does not have (Spanish count_two) — only those, each one listed; never without this flag
--fresh                 Don't use the cache for what is queued — it is billed again
--files <glob>          Only these content files this run (repeatable; e.g. docs/intro.md, "posts/**")
--force                 Same as --redo all (whole-locale rebuild; scope with --pair)
--force-keys <keys>     Same as --redo keys:<keys> (namespace::key for one file of a multi-file language; \, for a comma inside a key; ctx\x04msgid — or ctx␄msgid — for a gettext entry with a context)
--force-content         Same as --redo content
--retranslate <glob>    Same as --redo files:<glob> --fresh (bypasses the lock and the cache — billed — and replaces paragraphs a person edited in the named files)
--no-tm                 Same as --fresh
--fresh-on-model-change Don't reuse the previous model's cached translations for what this run translates; with --redo all, the new model translates what an earlier model wrote
--pair <src:tgt>        Only these pairs this run, comma-separated (e.g. en:fr,en:de; en>fr and en-fr work too); unknown pairs fail loud (sync, verify, serve)
--max-cost <usd>        sync: stop before any API call if the estimated cost is over this USD cap, or unknown (exit 2, nothing spent)
--no-verify             Skip post-sync verification pass
--strict                verify: warnings fail the check too (exit 1)
--script <choice>       init: writing system of a language with two real orthographies, e.g. crk=Cans
--name <code=name>      init: display name of a language with no card (a private-use code), e.g. qaa="Ayta (variety not yet confirmed)"
--locale <code>         Target locale (xliff export, tm clear)
--quiet                 Errors and warnings only — suppress banner, progress bar, and info lines
--json                  Machine-readable NDJSON output — one JSON object per event
```

### 言語ペアの指定方法

プロジェクトの言語ペアは、`champollion.config.json` のキー表記に従って `en:fr` のように記述します。`sync`、`verify`、`serve` は `en>fr` や `en-fr` も読み込み、`en-pt-BR` は設定済みの言語ペアと照合されます。ネットワークコマンド（`network register-corpus`、`leaderboard`、`recommend`、`submit`）は、リーダーボードに保存され `mt-eval` で使用される形式である `eng>crk` として言語ペアを書き込み、同様に `eng-crk` や `eng:crk` も読み込みます。ハイフンのみの場合、言語ペアは2文字または3文字の2つのコードになります（`eng-crk`）。コード自体にハイフンが含まれる場合は `>` が必要です（`--pair "eng>pt-BR"`）。`eng-pt-BR` は拒否され、推測されることはありません。シェル内では `>` の形式をクォートしてください。クォートしない場合、`--pair eng>crk` は出力を `crk` という名前のファイルにリダイレクトしてしまいます。

---

## new

レイル上で機械翻訳プロジェクトを開始します。すべての要素の置き場所が定まった、1つのフォルダーを作成します。

```bash
champollion new family --from English --to qaa --target-name "Our language" --dry   # say the direction back; writes nothing
champollion new family --from English --to qaa --target-name "Our language"
champollion new school-crk --from eng --to "Plains Cree" --purpose "school newsletter"
```

以下を書き出します：

- `champollion.project.json` — プロジェクトの決定事項（[project/1](/docs/reference/formats#project1)）：言語ペア、目的、新しいデータに適用されるデフォルト値（`local-only`、学習とスコア共有：`ask`）。
- フォルダー `data/parallel/`、`data/test/`、`data/lexicon/`、`data/grammar/`、`data/monolingual/`、`consent/`、`inbox/`。
- `README.md`（何がどこに置かれるか）、`.gitignore`（プッシュするリポジトリから `data/` を除外）、`NEXT.md`（次のステップ）、および `AGENTS.md` — フォルダー内で作業するAIエージェントが従うルール、[運用規約](/docs/agents/contract)。既存の `.gitignore` や `AGENTS.md` が上書きされることはありません。

言語はコードまたは名称で指定し、言語カードを介して解決されます。カードがその言語の別名として記録している名称は、その情報源とともに表示されます（`"Blackfoot" is another name for this language … Siksika (bla)`）。複数の言語が持つ名称は、選択肢とともに拒絶され、自動で選ばれることはありません。コードを持たない変種のための私信用コード（`qaa`〜`qtz`）には、その言語の話者が使用している名称が必要です（`--target-name`、`--source-name`）。現時点でレイルに対応しているのは `language` プロジェクトのみです。すでにプロジェクトであるフォルダーや、すでにファイルが存在するフォルダーは拒絶されます。

| オプション | 効果 |
|--------|--------|
| `--from <language>` | 原言語（コードまたは名称） |
| `--to <language>` | 対象言語（コードまたは名称） |
| `--name <text>` | プロジェクト名（デフォルト：`<source> → <target>`） |
| `--purpose <text>` | 翻訳の目的（ご自身の言葉で記述） |
| `--target-name <text>` | その言語の人々自身による対象言語の呼び名（`qaa`〜`qtz` で必須） |
| `--source-name <text>` | 原言語の名称（私信用コードの原言語向け） |
| `--dry` | どちらの方向に翻訳するかを表示し（`… goes in, … comes out`）、書き出しは行わない |
| `--json` | プロジェクトファイル、解決された言語、最初のステップをJSON形式で出力 |

---

## next

レイルの唯一の問い：次はどうすべきか？

```bash
champollion next                  # in the project folder
champollion next family --json    # for an agent
champollion next --write          # also rewrite NEXT.md
```

プロジェクトのファイル群を読み取り（データファイル内のテキストは決して読みません）、その工程をたどって、次に取るべきたった1つのステップを表示します。担当者に伝えるべき内容、その理由、コマンドがある場合は正確なコマンド、そしてそのステップをどのように進める必要があるかを示します：

| モード | 進め方 |
|------|-----|
| `auto` | エージェントがコマンドを実行可能 |
| `confirm` | 担当者の同意を得た後にのみ実行（インストール、費用発生、学習） |
| `ask_user` | データを保持する人々が回答する。決して彼らの代わりに回答しないこと |
| `wait` | 処理が実行中。後でもう一度確認してください |
| `human_only` | 人間のみが実行可能（文の収集、モデルの選択） |

学習ステージでは、nmt-forge自身のアドバイザーを中継します（`nmt-forge status`、制限時間60秒）。読み取り専用であり、`--write` を指定しない限り何も書き出しません（指定時は `NEXT.md` を書き換えます）。

| オプション | 効果 |
|--------|--------|
| `--json` | ステップをJSON形式で出力（エージェント向け） |
| `--write` | `NEXT.md` も書き換える |

---

## data

コミュニティが保持しているファイルをプロジェクトに取り込み、データ保持者の決定事項を記録し、対訳ペアファイルを学習で読み込む1つのファイルに結合します。プロジェクト内で実行してください。

### data add

```bash
champollion data add inbox/grandpa.xlsx
champollion data add inbox/list.txt --source-col A --target-col B
champollion data add inbox/checked.docx --into test
```

コミュニティが保持しているファイルを、すべてのツールが読み取れる形式へと変換します。スプレッドシート（`.xlsx`、`.ods`、`.csv`）、`.tsv` または `.txt`、Wordの表（`.docx`）、あるいはToolbox/MDFやLIFT（FieldWorks/FLEx）の辞書に対応しており、辞書の語釈は `--into lexicon` によって単語リストとなり、例文は対訳ペアになります。ELANファイル（`.eaf`）からは、ELANがリンクする2つのティアから、指定された言語名または `--source-col`/`--target-col` のティアIDで照合されたペアが抽出されます。USFM形式の聖書テキストはリクエストがあった場合にのみ取り込まれます。`--usfm-source` でもう一方の言語のテキストを指定し、両方で同じ節番号を持つものがペアになります。聖書の翻訳には通常出版社の著作権があるため、権利保持者の許諾が得られるまでモデルがそれを学習することはありません。

列は言語名が記載されたヘッダー行、または `--source-col` と `--target-col` から取得されます。文の内容から推測することはなく、文を表示することもありません。列は入力率（fill）と文字体系（script）によって説明されます。出所の記録されたサイドカーファイルとともに `data/parallel/<name>.tsv`（または `data/test/`、あるいは `data/lexicon/` 内の単語リスト）を書き出します。データ保持者が決定するまでは、プロジェクトのローカル限定デフォルト設定が適用されます。元のファイルが変更されることはありません。

| オプション | 効果 |
|--------|--------|
| `--into <parallel\|test\|lexicon>` | ペアの出力先（デフォルト：`parallel`、`lexicon` = 単語リスト） |
| `--source-col <col>` | 原言語列：アルファベット、番号、またはヘッダー名（`.eaf` ではELANのティアID、LIFTでは言語コード） |
| `--target-col <col>` | 対象言語列 |
| `--sheet <name\|n>` | 複数ある場合のシートまたは表の指定 |
| `--header` / `--no-header` | 先頭行がヘッダーかどうか |
| `--usfm-source <file\|folder>` | USFM聖書テキスト：もう一方の言語のテキスト（節ごとにペアリング） |
| `--name <stem>` | 書き出されるファイル名 |

### data mark

```bash
champollion data mark data/parallel/pairs.tsv --owner "the family" --training allowed --local-only
champollion data mark data/test/checked.tsv --role test --local-only
```

データファイルを保持する人々が決定した内容を、その隣にあるサイドカーファイル（`<file>.champollion.json`、[set/1](/docs/reference/formats#set1)）に記録します。mt-eval、nmt-forge、MCPサーバーはこの内容に従います。まだローカル限定になっていないファイルには、`--local-only` または `--may-leave` が必要です。そのテキストを外部のAIサービスに送信してよいかどうかはデータ保持者の決定事項であるため、勝手に推測されることはありません。

サイドカーの設定は厳格化される一方です。ローカル限定を外部送信可に変更することはできず、学習の `not-allowed` を `allowed` にすることはできません。また、テストセットや封印されたセットはその役割を維持し、学習に使用されることはありません。例外となるのは、ツールの予防措置に対する保持者の最初の回答のみです。プロジェクトのデフォルトから適用されたローカル限定マーク `data add`（最初の `--may-leave` で解除可能）、聖書に適用された `not-allowed`、そして `not-yet` を持っていた人々が合意した後の `--speakers-agreed yes --training allowed` です。それ以外の緩和を行うには、データ保持者自身による手動編集が必要です。

| オプション | 効果 |
|--------|--------|
| `--local-only` | このコンピューター上のモデルのみがテキストを参照可能 |
| `--may-leave` | 保持者が外部サービスへのテキスト送信を許可 |
| `--training <allowed\|not-allowed>` | モデルがこれを学習可能かどうか |
| `--role <role>` | `train`、`dev`、`test`、`sealed`、`input`、または `resource` |
| `--kind <kind>` | `parallel`、`monolingual`、`lexicon`、`grammar`、または `glossary` |
| `--owner <text>` | データの保持者（本人の言葉で記述） |
| `--speakers <text>` | ファイルに含まれる言葉の主（誰が発言したか、書いたか） |
| `--speakers-agreed <yes\|not-yet\|some-said-no>` | 合意が得られているかどうか。`not-yet` および `some-said-no` は学習から除外 |
| `--consent-record <path>` | 誰が何に合意したかを記録するメモ |
| `--json` | 書き出されたサイドカーをJSON形式で出力 |

### data combine

```bash
champollion data combine
champollion data combine --name all-pairs
```

`data/parallel/` 内のすべてのペアファイルを、学習で読み込む1つのファイルに結合し、完全な重複を除外します。そのサイドカーには、各ファイルの条件のうち最も厳しいものが保持されます（いずれかがローカル限定であればローカル限定となり、すべての保持者が記載されます）。元のファイルは `data/combined-from/` に移動され、何も削除されません。モデルが学習してはならないと保持者が指定したファイルは結合されず、`data/not-for-training/` に移動されて、学習されることなく保管されます。`--name <stem>` で結合後のファイル名を指定します。

---

## improve

使用中のモデルをラウンドごとに改善し、各ラウンドは練習用（dev）セットで評価されます。プロジェクト内で実行してください。`champollion next` が現在行うべきステップを示します。

```bash
champollion improve time --per-week "two evenings" --total "until the spring"
champollion improve wishlist --prompts 30
champollion improve sheet
champollion improve marks
champollion improve prepare
champollion improve report
champollion improve status --json
```

1ラウンドの流れ：翻訳したい文を `improve/round-<k>/to-translate.txt` に1行1文ずつ記述します。使用中のモデルがそれらを下訳してシートに出力します。話者が各下訳に Y（正解）、N（誤り — そして正しい言い回しを記入）、または ?（不確か）の印を付けます。確認された下訳と修正文が新しい学習ペアになります。学習ファイルがスクリーニングされ、モデルが再学習を行います。その後 forge が、同じdev文上で新モデルと使用中のモデルを比較し、測定可能な改善が見られた場合にのみ新モデルを採用します。ラウンド番号はこれまでの forge の判定に基づいて付けられ、そのファイルは `improve/round-<k>/` に配置されます。画面上には件数と平易な言葉のみが表示され、文自体は決して表示されません — 文はプロジェクトフォルダー内のシートに保持されます。

| サブコマンド | 処理内容 |
|------------|--------------|
| `time` | 話者が提供できる時間を、週あたりおよび全体について、本人の発言どおりに記録（`improve/time.json`）。各ラウンドはこれに基づいて計画されます |
| `wishlist` | 次に書くべき内容をまとめた印刷可能なシート（`improve/round-<k>/wishlist.md`）：モデルが一度も見たことのない単語、devで誤った文の種類、自由なプロンプト（`nmt-forge wishlist`） |
| `sheet` | このコンピューター上で提供されるモデルが、話者が確認できるようにラウンドの文を下訳して `review.csv` に出力。練習用（dev）セットが小さいうちは、4行に1行は下訳が出力されず、話者が直接記入することで練習用セットを拡充します |
| `marks` | 話者の印を読み取り：正しかった下訳の数（95%信頼区間付き）、確認された下訳と修正文を新しい学習ペアとして取り込み（`data add` がファイルを追加するように追加）、練習用の行を `data/dev/` として取り込み |
| `prepare` | このラウンドの学習ファイル（`data/split/train-r<k>.jsonl`）。dev文を除外した上でテストセットに対してスクリーニング済み。拡張された練習用セット（`nmt-forge grow-dev`）。`config.json` がこれを指すように設定 |
| `report` | ラウンドのレポート（`improve/round-<k>/report.json`）：進捗状況（各数値に単位を明記）、改善が本物であるかの検証、予測、次に行うべきこと |
| `status` | これまでのラウンド：各ラウンドの話者の印と forge の判定 |

| オプション | 効果 |
|--------|--------|
| `--per-week <text>` | `time`：話者が週に提供できる時間（本人の言葉で記述、必須） |
| `--total <text>` | `time`：話者が全体で提供できる時間（本人の言葉で記述、必須） |
| `--prompts <n>` | `wishlist`：シートに記載するプロンプト数（デフォルト：40、約1回分） |
| `--json` | `report`、`status`：JSON形式で出力 |

---

## validate

```bash
champollion validate                  # the current folder
champollion validate family --json    # one project, machine-readable
```

プロジェクトのファイルを、mt-eval や nmt-forge も読み取るフレームワークスキーマ（[フォーマット](/docs/reference/formats)）に照らし合わせて検証します：`champollion.project.json`、フォルダー配下のすべてのデータサイドカー（`<file>.champollion.json`）、すべての `method.json`（ルート、`methods/*/`、および `.champollion/methods/*/` 内）、ゲートチェーン（`gates/*.json`）、およびデプロイ設定（`deploy/*.json`）。これらの小さなJSONファイルのみを開き、データファイルを開くことは決してありません。set/1 より前に作成されたサイドカーも引き続き有効ですが、set/1 では拒否されるキーは警告として報告されます。

終了コード：0 有効（警告があっても可）、1 ドキュメントが無効、2 使用法のエラー。`--json` で完全なレポートを出力します。

---

## upgrade

```bash
champollion upgrade --dry         # say what would change; write nothing
champollion upgrade family
```

プロジェクトの古いフレームワークファイルを、情報の一切を失うことなく、すべてのツールが現在共有している形式へと書き換えます。set/1 より前に作成されたデータサイドカーは set/1 に変換されます。すべての値が保持され、set/1 が認識しないキーは `x-<key>` の下に移動されます。無効なサイドカーは人間が修正できるようにそのまま残されます（`champollion validate` が問題点を表示します）。method/1 より前に作成された `method.json` は一覧表示され、そのまま保持されます — その古い形式にも、ツールが読み取る設定が含まれているためです。何も削除されることはありません。`--json` でレポートを出力します。

---

## connect

```bash
champollion connect ../family/export/model --app .
champollion connect ../family/export --app ../school-site --holders-agreed-by "Grandpa"
```

提供されているモデルをアプリまたはウェブサイトのプロジェクトに組み込み、`sync` がそのモデルを使って翻訳できるようにします。モデルは forge のエクスポート（そのフォルダーまたは `model/` フォルダー）、または任意の `method.json` です。アプリの `.champollion/methods/` にインストールされ、アプリのペアがそれを指すようになります（`"methodPlugin"`）。ペアがすでに持っているフォールバックやレジスターは保持されます。

ローカル限定とマークされた文から学習したモデル（または学習内容が記録されていないモデル）、あるいは出力がローカル限定であると `/health` に記載されているサービスは、それらの文を再現してしまう可能性があります — そしてアプリのロケールファイルはアプリとともに公開されます。そのため、データ保持者の誰が合意したかをペアに記録する `--holders-agreed-by`（手法名を明記する `"holdersAgreed"`）を指定した場合にのみ接続されます。保持者に確認してください。決して代わりに回答してはなりません。`sync` にも同様のルールが適用され、合意がない限り、そこからの出力が書き出されることはありません。

| オプション | 効果 |
|--------|--------|
| `--app <folder>` | アプリまたはウェブサイトのプロジェクト（デフォルト：現在のフォルダー） |
| `--holders-agreed-by <who>` | ローカル限定モデルの場合：データ保持者のうち誰が合意したか |
| `--json` | 接続された内容をJSON形式で出力 |

---

## init

`champollion.config.json`を作成するインタラクティブなセットアップウィザードです。ソースロケール、ターゲット言語、ファイル形式、翻訳モデルの設定をガイドします。

```bash
champollion init                          # interactive wizard
champollion init --yes                    # skip wizard, use defaults
champollion init --yes --langs fr,de,ja   # quick setup with specific languages
champollion init --source en --dir ./i18n # overrides with defaults
champollion init --yes --langs crk --content-dir newsletters  # also translate a folder of Markdown
champollion init --yes --langs abc --method api --endpoint http://127.0.0.1:8378/translate --accepts-instructions false
```

**`--content-dir` オプション**: ロケールファイルに加えて翻訳するMarkdown/MDXファイルのフォルダーを指定します（`contentDir` として記述）。フォルダーが存在している必要があります。存在しない場合、`init` は何も書き込まずに停止します。

**ローカル専用ファイルを含むプロジェクトはデフォルトで `local` になる**: デフォルトのメソッドは `llm`（ホステッドサービスであるOpenRouter）です。プロジェクト内のいずれかのファイルにローカル専用のマーク（`champollion network register-corpus --data <file> --tier local-only` が書き込むように、ファイルの隣に `"transmission": "local-only"` を含む `<file>.champollion.json` がある状態）が付いている場合、`init`（および `--yes` も同様）はデフォルトで `local` メソッドを選択します。これはローカルマシン上で提供されるモデルです（Ollamaのデフォルト `http://localhost:11434/v1`、または `LOCAL_API_BASE` で指定されたサーバー）。マークされたファイル名を挙げながらその理由を通知し、明示的にホステッドメソッドを選択する方法（`champollion init --force --method llm --model <model>`）を案内します。明示的な `--method` の指定が常に優先されます。その場合、`init` はテキストの送信先と並んでマークされたファイルを注記します。

**`init` の再実行 (`--force`)**: `--force` がない場合、`champollion.config.json` が存在すると `init` は停止します。フラグを指定すると、`init` はそのファイルから開始し、フラグで指定された項目のみを書き換えます。`--langs` は翻訳先リストを設定し（すでに存在する言語は登録済みのエントリ（レジスター、文字体系、名前）を保持します）、`--method` はデフォルトのメソッド（および `--model` で指定されない限りそれに付随するモデル）を、`--model`、`--temperature`、`--source`、`--dir`、`--format`、`--content-dir`、`--script`、`--name`、そして `--method api` は指定されたペアを設定します。ロケールレイアウトの再検出は、ソースファイルが見つからなくなった場合（または `--dir` で別のフォルダーが指定された場合）にのみ行われます。その他のすべての設定（`batchSize`、`pairs`、`glossary`、フォールバック、選択したレジスター）はそのまま維持されます。変更したフィールドと維持したフィールドを出力し、事前に以前のファイルを `champollion.config.json.bak` にコピーします（バックアップにすでに古いファイルが存在する場合、次回は `.bak.2`、`.bak.3` … となり、古いバックアップが上書きされることはありません）。有効なJSONでないファイルは維持できません。バックアップを作成した上で新しいファイルが書き込まれます。単一の設定を変更したい場合は、ファイル内で直接編集してください。そのためだけに `init` を再実行する必要はありません。

**ロケールファイルの検出**: `init` は何かを書き込む前に、ソース言語のファイルを探します。まずフレームワークの一般的なフォルダー（next-intl の `messages/`、i18next の `public/locales/<lang>/` および `locales/<lang>/`、vue-i18n の `src/locales/`、Hugo の `i18n/`）を確認し、続いて `locales`、`messages`、`i18n`、`lang`、`translations`、`public/locales`、`src/locales`、`src/i18n` を確認して、見つかった内容を出力します。存在しない `localesDir` を書き込むことはありません。[ロケールファイルのレイアウト](/docs/getting-started/configuration#locale-layouts)を参照してください。

**`--langs` オプション**: カンマ区切りの翻訳先言語コード一覧です。言語プロンプトをスキップし、各言語のデフォルトのレジスタープリセットを適用します。これは設定ファイルに書き込まれるため、選択内容を確認および編集できます: `"languages": { "fr": "formal-vous", "es": "neutral-latam" }`（別のプリセットに変更するか、トーンを説明する独自の表現に変更できます。プリセットのない言語は `{}` として書き込まれます）。また、お使いのレイアウトに合わせて空の翻訳先ファイル（`fr.json`、または各ネームスペース用の `fr/common.json`）を作成します。完全に対話なしでセットアップするには `--yes` と組み合わせて使用します。

**`--method api --endpoint <url>`**: champollion API仕様に準拠したサーバーです。たとえば、自分でトレーニングし `nmt-forge serve` で提供するモデルなどです。`init` は翻訳先ごとに1つのペアを書き込み、モデルの隣の `DEPLOY.md` と同じエントリ（`"pairs": { "en:abc": { "method": "api", "endpoint": "http://127.0.0.1:8378/translate", "acceptsInstructions": false } }`）になります。`--accepts-instructions true|false` は、エンドポイントがキーごとの指示に従うかどうかを指定します（nmt-forge でトレーニングされたモデルは従いません）。指定しない場合、`init` は同じエンドポイントのインストール済みプラグインマニフェスト（`.champollion/methods/<name>/method.json`）から値を取得するか、未設定のままにします。`--langs` が必要であり（エンドポイントはペアごとに設定されます）、このマシン外のエンドポイントの場合にのみキーが必要です（`CHAMPOLLION_API_KEY`）。`DEPLOY.md` に示すように、ペアに手動で `fallback` メソッドを追加してください。

**`--script` オプション**: 一部の言語は複数の正書法で記述されます — 平原クリー語（`crk`: `Latn` = 標準ローマ字正書法、`Cans` = 音節文字）、セルビア語（`sr`: `Latn`、`Cyrl`）。Champollion がコミュニティの代わりに一方を選択することはありません。`sync` は、設定でいずれかが指定されるまでそのような言語の翻訳を拒絶します。対話ウィザードで確認されますが、`--yes` の場合は `--script crk=Cans` を渡します（複数の場合: `--script crk=Cans,sr=Latn`。翻訳先が単一の言語であれば `--script Cans` で十分です）。これにより `"languages": { "crk": { "script": "Cans" } }` が書き込まれます。指定しない場合、`init --yes` は選択が必要な言語を示し、選択肢を一覧表示して、設定内のその言語のエントリに追加すべき `"script"` 行を出力します。

**`--name` オプション**: 私用コード（`qaa`〜`qtz`、確定したコードがない言語変種用）には言語カードがないため、`init` はスペルを確認するよう求める代わりにその旨を通知します。`--name qaa="Ayta (variety not yet confirmed)"` はプロンプトやレポートで使用する表示名を指定し、`"languages": { "qaa": { "name": "Ayta (variety not yet confirmed)" } }` として書き込まれます（複数の場合: `--name "qaa=…;qab=…"`）。各レジスターの横に、`init` はその言語に対してLLMプロンプトが保持するジェンダーガイダンスも出力します（[ジェンダーガイダンス](/docs/getting-started/configuration#gender-guidance)）。

**言語プリセット**: ターゲット言語の入力プロンプトでは、プリセット名を入力できます：
- `european` → fr, de, es, it, pt, nl
- `asian` → ja, zh, ko
- `global` → fr, es, de, ja, zh, ko, pt, ar
- `nordic` → da, fi, nb, sv

プリセットと個別コードの組み合わせ例：`european, ja` → fr, de, es, it, pt, nl, ja

---

## sync

すべてのロケールファイルにわたって、未翻訳のキーと古くなったキーを翻訳します。デフォルトでは、同期後に検証を実行します。

```bash
champollion sync                                   # translate everything
champollion sync --dry-run                         # preview only
champollion sync --dry --list-keys                 # preview AND name every queued key
champollion sync --redo keys:hero.title            # translate one key again (cache still serves)
champollion sync --redo "keys:a.title,a.subtitle"   # several keys
champollion sync --redo 'keys:Welcome\, %(name)s'  # a key with a comma in it (gettext)
champollion sync --pair en:tlh --redo all           # rebuild one whole locale
champollion sync --pair en:tlh --redo all --fresh   # ...bypassing a suspect cache (billed)
champollion sync --redo content                     # re-process all Markdown/MDX (cached text is free; reviewers' edits are kept)
champollion sync --files "docs/guides/**"           # only these content files
champollion sync --redo files:docs/intro.md --fresh # translate one file from scratch (billed)
champollion sync --redo gaps                        # ask again for plural forms a model left out
champollion sync --prune plural-extras              # remove plural keys for forms a language does not have
champollion sync --content-dir ./newsletters       # include a folder of Markdown (Hugo content/ or any folder)
champollion sync --method google-translate          # force Google Translate
champollion sync --concurrency 20                  # 20 parallel API calls (both phases)
champollion sync --json-concurrency 30              # 30 parallel locale translations (JSON)
champollion sync --content-concurrency 8            # 8 parallel content translations
champollion sync --no-verify                        # skip post-sync verification
champollion sync --no-tm                            # skip cache, fresh API calls
```

**翻訳メモリ**: デフォルトで `sync` は `.champollion/tm.json` を読み込み、変更されていないソース値に対してキャッシュされた翻訳を提供します。モデルを切り替えてもキャッシュが破棄されることはありません。以前のモデルで翻訳済みのテキストはコストなしで再利用され、sync はコスト見積もりの前にその旨を表示します。代わりに新しいモデルでそれらを翻訳させるには、`--redo all --fresh-on-model-change` を使用します。これにより、以前のモデルが翻訳したキーが送信され、新しいモデルがすでに翻訳した内容は引き続きキャッシュから提供されます（単独では、`--fresh-on-model-change` はその実行でいずれにしても翻訳されるキーにのみ影響します）。キャッシュを完全にバイパスするには `--no-tm` を使用します（品質デバッグ時に有用）。[翻訳メモリ](/docs/concepts/translation-memory)を参照してください。

**コスト見積もりと `--max-cost`**: 見積もりには、その実行で実際に請求される分のみが算出されます。すでに翻訳メモリにあるキー、front-matterフィールド、Markdownブロックは$0として計算され、表にはキャッシュによって節約された金額が表示されます。このマシン上で提供されるモデル（`local`、または `localhost`/`127.0.0.1`/`::1` の `api` エンドポイント）は `$0 (local)` と表示されます。APIの請求は発生しません（ハードウェアや電力コストはカウントされません）。`--max-cost` はその数値と比較します。上限を超えている場合、または見積もりが存在しない場合（別のマシンを指定した `local` など、価格が公表されていないメソッド）、sync はAPI呼び出しを行う前に停止し、`2` で終了します。翻訳や書き込みは一切行われません。最後の行には、モデルに送信されたキーの数とキャッシュから取得されたキーの数が表示されます。

表の下の1行には、算出に用いられたレートとそのソースが表示されます。ホステッドモデルの場合、OpenRouterの公開価格表に基づく入力/出力100万トークンあたりの価格と取得日時（`Rate: google/gemini-3.8-flash $0.30 input / $2.50 output per 1M tokens — OpenRouter's price list, read 2026-10-04 14:02 UTC`）です。直接プロバイダー（`openai`、`anthropic`、`gemini`）の場合、同じリストがプロバイダー自体の価格の代替として使用され、リストを読み込めない場合（または該当モデルの価格がない場合）は、champollion 内に保持されたコピーが使用され、最終確認日とその理由が表示されます。DeepL、Google、Microsoft は公開されている1文字あたりの価格と日付が表示されます。これはあくまで見積もりです。キーあたりに想定されるトークン数（または文字数）が示されており、実際の請求額は実際の長さに依存します。`--json` を指定すると、見積もりに詳細情報が含まれます: 各ペアの `rate` と実行の `rates`（`inputPerMillion`、`outputPerMillion` または `perMillionChars`、`tokensPerKey`、`from`、`url`、`fetchedAt` または `verified`）。

**リクエストの確認**: `sync --dry --show-prompt [key]` は、言語ペアのメソッドに送信される実際のリクエスト（メソッド自身のコードによって構築され、APIキーがマスキングされたシステムメッセージとユーザーメッセージ、または `api` エンドポイントの場合はリクエストボディ）を出力し、送信は一切行いません。キーを指定すると（`--redo keys:` での名前付けに従って `verb␄Open`、`common::nav.home` と指定。カンマを含む gettext msgid は全体を指定可能）、そのキーがキューにあるかどうかにかかわらずリクエストが表示されます。実際の実行で送信されない場合（最新である、キャッシュから提供される、または保留されている）、その旨を表示し、送信を行うための `--redo keys:<key> --fresh` コマンドを示します。キーを指定しない場合、各ファイルが送信する最初のバッチを表示するか、何も送信されないことを示します。これにより、gettext の `msgctxt`、`#.` コメント、または ARB の説明がモデルに届いているかを確認できます。機械翻訳エンジン（DeepL、Googleなど）にはソーステキストのみが送信され、プレビューにもその旨が表示されます。`--json` を使用すると、各リクエストが1つの `{"level": "event", "event": "request", …}` 行になります。

**ドライラン**: `--dry` は何も翻訳せず何も書き込みませんが、実際の実行が事前にチェックする内容を検証します。メソッドが必要とするキー（`OPENROUTER_API_KEY`、`DEEPL_API_KEY` など）が不足している場合、実際の実行では停止することを警告し、その変数名を通知します。キーが設定されていることのみを検証し、機能するかどうかは確認しません（送信が行われないため、プレースホルダーでも通過します）。終了コードは常に `0` です — プレビューが失敗することはありません（[終了コード](#sync-exit-codes)を参照）。`--max-cost` も同様です。ドライランは上限で停止しませんが、見積もりが上限を超えている（または不明な）場合、実際の実行であればそこで停止して `2` で終了する旨を最後に一度だけ表示します。`--json` を指定すると、各行が `level` を持つ1つのJSONオブジェクトになり（標準出力には `info`、`ok`、`event`、標準エラー出力には `warn`、`error`）、標準出力の最後の行はサマリーである `{"level": "summary", "command": "sync", …}` となり、`preflight: { ready, failures }`、上限 `maxCost: { cap, estimatedCost, wouldStop, exitCode }`、および `realRun: { exitCode, wouldStop, reasons }`（プレビューで判定できる範囲での実際の実行時の終了コード。[終了コード](#sync-exit-codes)を参照）が含まれます。実際の sync で使用するフラグ（`--method`、`--model`）を付けて実行してください。フラグがない場合は、設定に記述されたメソッドがチェックされます。ドライラン自体の終了コードでCIステップが失敗することはないため、その `--max-cost` 警告にはCIゲートを設定する方法（`--json` サマリーから `maxCost.wouldStop`（または `realRun.exitCode`）を読み取る。例: `jq -e 'select(.level == "summary") | .preflight.ready and (.maxCost.wouldStop | not)'`）が示されています。[CIガイドのチェック手順](/docs/guides/ci-cd#check-before-sync)ではこれを行い、失敗時には単なる `false` ではなく理由（`realRun.reasons`）を出力します。ドライランの `totalPluralGaps` は、ディスク上に存在し、実際の実行でも再要求されない言語固有の形を欠いた複数形メッセージをカウントします。また、`verify` は `{ "ran": false }` となります（何も書き込まれなかったため、検証も行われません）。

**再翻訳**: `--redo` は*何を*再翻訳するかを指定し、`--fresh` は*その費用を支払うかどうか*を指定します。`--fresh` がない場合、すでにキャッシュに存在するものはすべて無料ですぐに取得され（品質ゲートのチェックも引き続き通過します）、指定がある場合は、キューに入ったすべてが新たに翻訳され課金されます。古いフラグ（`--force`、`--force-keys`、`--force-content`、`--retranslate`、`--no-tm`）も引き続き動作し、表に記載されたとおりの意味を持ちます。

**対象ファイルの絞り込み**: `--files` はコンテンツステップの一致するファイルのみに制限し、`--redo files:<glob> --fresh` は一致するファイルの新規再翻訳を強制します（意図的な再消費の唯一のケース）。パターンは sync が出力するパス（`contentDir` に対する相対パス、`2026-10.md`）およびプロジェクトルートからの同じパス（`newsletter/2026-10.md`）と照合されます。`*` はフォルダー内に留まり、`**` はフォルダーをまたぎます。どちらのフラグも複数回指定できます。いずれのファイルにも一致しないパターンがある場合、課金が発生する前に実行が停止します。キー/値ステップはすでにインクリメンタルであり、通常どおり実行されます。

**失敗の処理**: 1つのコンテンツファイルが失敗しても、他のファイルが停止することはありません。成功したファイルは記録されて翻訳がキャッシュされ、実行の最後に失敗したファイルとそれぞれの状態の一覧が表示されます。ファイル内のキーが翻訳されなかった場合、ファイルの行が `[OK]` と表示されることはありません。失敗サマリーには、次回の sync でどのような処理が行われるかがキーごとに示されます。再要求（使用可能な応答がない）、もう一度要求（やり直し処理からの保留中）、または保留（品質ゲートによって拒否）。ゲートによって拒否されたMarkdownブロックおよびfront-matterフィールドも同様にページごとに保留されます。`--redo files:<page>` または `--redo content` は再要求を行います（[品質ゲート](/docs/concepts/quality-gate#refused-markdown-blocks-and-front-matter-fields)）。終了コードは `0`（すべて成功）、`2`（一部成功: 一部の処理が完了したが、失敗、保留、検証失敗、通常のカウントで使用される形を欠いた複数形メッセージの書き込みが発生した、あるいは何も消費せずに `--max-cost` で停止した）、または `1`（すべて失敗）です。

**変更検出**: champollion はSHA-256ハッシュを `.champollion.lock` に保存します。ソース値が変更されると、次回の sync でそれらのキーが自動的に再翻訳されます。すべての開発者がベースラインを共有できるように、ロックファイルをコミットしてください。また、ロックファイルには、翻訳先ロケールごとに sync が書き込んだ各値のフィンガープリント（手動で編集された値が認識され、一括再翻訳時にも保持されるようにするため — [翻訳の編集](/docs/guides/professional-translators#editing-key-value-files)）、再翻訳で完了できなかったキー（**pending**: 次回の sync でもう一度要求される）、および品質ゲートが拒否したキー（**held back**: 通常の sync では同じモデルに再送信されない — [品質ゲート](/docs/concepts/quality-gate#refused-keys-are-held-back)）が記録されます。

**手動編集と再実行**: `--redo all`、`--force`、およびモデルの切り替えでは、手動で編集された値が保持され、どの値かが通知されます。キーを指定した `--redo keys:<key>` はその値を置き換えます。ソースが変更されたキーは再翻訳されます。置き換えられた編集内容は出力され、`.champollion-replaced-edits.jsonl` に追記されます（バージョン管理対象 — ロックファイルと一緒にコミットしてください）。

**コンテキスト付きgettextキー**: キーは `msgctxt` + U+0004 + `msgid` です。レポートでは区切り文字が `␄` として出力され、`--redo keys:` や `--force-keys` でもそのまま受け入れられます。入力する場合は `\x04` を使用して `--redo 'keys:django::verb\x04Open'` と記述します（シングルクォートでバックスラッシュを保持します）。どちらの表記も機能します。修復コマンドは `␄` の形式を出力し、その後に `\x04` を示すシェルコメントが続きます。

**一致するキーが見つからない場合**: ソースキーに存在しない名前（タイプミス、またはコンテキスト付きでのみ存在する msgid）を指定した `--redo keys:` / `--force-keys` は終了コード1で失敗します。エラーメッセージには、その msgid のすべてのコンテキストバリアントを含む最も類似したキーが、両方の表記法で一覧表示されます。名前がまったく一致しない場合、何も実行されません。一部が一致した場合、それらの再実行が行われた後、残りのキー名を通知して実行が失敗します。

**キャッシュから提供される指定キー**: `--fresh` を指定しない場合、やり直し処理はキャッシュに保持されている内容を（再チェックの上、追加費用なしで）提供し、その旨とともにモデルに再要求するための `--fresh` コマンドとその費用を表示します。

**並列処理**: JSONキーの翻訳とコンテンツの翻訳はどちらも並列で実行されます。JSONロケールは同時に翻訳され（デフォルト：200並列ロケール）、各ロケール内のバッチも並列化されます（4並列バッチ）。コンテンツ翻訳（Markdown、MDX、ブログ投稿）はフラットなワークアイテムプールで実行されます（デフォルト：48並列APIコール）。`--json-concurrency`、`--content-concurrency`、または`--concurrency`（両方を設定）で上書きできます。

**出力**: 同期時にはバージョンバナー、フォーマット／フレームワーク検出結果、コスト見積もり、およびロケールごとのプログレスバーが表示されます：

```
champollion v0.1.0

[INFO] Detected format: json (auto)
[INFO] Source: en.json (2,847 keys)
[INFO] Pairs: es-MX:llm, fr:deepl

[INFO] es-MX.json — 2,847 missing
     ████████████████████████████████ 2,847/2,847 keys
[INFO] fr.json — 2,847 missing
     ████████████████████████████████ 2,847/2,847 keys
[OK] Synced 5,694 keys total.
```

進行状況バーは各バッチ（約80キー）ごとにインプレースで更新されます。エラーや警告のみを表示するには `--quiet` を、機械可読なNDJSON出力には `--json` を使用します。どちらも進行状況バーとバナーを抑制します。`--json` では、`--max-cost` ゲートの前に `cost` イベントが発生し、コンテンツファイルおよびロケールごとに `file` イベントが発生し、すべての実行の最後に `summary` が出力されます。

### 終了コード {#sync-exit-codes}

| コード | 実際の実行 | ドライラン (`--dry`) |
|------|------------|---------------------|
| `0` | キューに入ったすべてが翻訳および検証された、またはキューに何もなかった。 | 正常に実行完了 — 実際の実行であれば停止すると判定された場合も含む。 |
| `2` | 一部完了: 一部の処理が完了したが、失敗、保留、検証失敗、通常のカウントで使用される形を欠いた複数形メッセージの書き込みが発生した。または、何も送信される前に `--max-cost` により停止した。 | なし。 |
| `1` | すべて失敗したか、実行を開始できなかった: メソッドが必要とするキーが存在しない、必要なモデルサーバーが応答しない、再実行に指定されたキーが一致しない、`--files` パターンに一致するファイルがない、または設定が無効。 | ドライラン自体が実行できなかった: 再実行に指定されたキーが一致しない、`--files` パターンに一致するファイルがない、または設定が無効。 |

ドライランが `0` で終了するのは意図的な設計です。判断の前に行うプレビューであり、確認するだけのCIステップを失敗させてはならないためです。実際の実行でどうなるかは、ドライランの最後の行および `--json` サマリーに示されます。`preflight.ready: false` は、実際の実行が翻訳前に停止して `1` で終了することを意味します（理由を `preflight.failures` で説明）。`maxCost.wouldStop: true` は、上限に達して停止し `2` で終了することを意味します（`maxCost.exitCode: 2`）。`maxCost.exitCode: 1`（`maxCost.stopsEarlier` と併用）は、上限チェックの前に事前チェックで停止することを意味します。`realRun.exitCode` はこれらをまとめ、実際の実行が部分完了となる要因（保留されたキー、またはディスク上にあり再要求されない言語固有の形を欠いた複数形メッセージ（`2`。`realRun.reasons` でそれらを特定し、ドライランの最後の行にも表示されます））も考慮します。実際の実行でのみ検出できる品質ゲートによる拒否や検証の失敗によって、予測された `0` が `2` に変わる可能性もあります。[CIガイドのチェック手順](/docs/guides/ci-cd#check-before-sync)を利用すると、これらを理由とともに出力して失敗するCIステップに変換できます。

---

## watch

ソースロケールファイルが変更されたときに自動的に同期します。`Ctrl+C`で中断するまで実行し続けます。

```bash
champollion watch
```

---

## audit

完全性ゲートです。翻訳されていないすべてのキー（未存在、空、または `[EN]` フォールバックのまま）と、**期限切れ（out of date）**のすべての翻訳（現在のソーステキストよりも古いものから作成された翻訳。`.champollion.lock` に基づく。ソース編集後の再翻訳が失敗した場合にこの状態になります）を一覧表示します。期限切れのリストの最後には、それを再翻訳するためのコマンドが表示されます。問題が1つでも見つかった場合は終了コード1で終了します — 不完全または古い翻訳がある場合にビルドを失敗させるCIゲートとして使用してください。

```bash
champollion audit
champollion audit --json   # summary carries untranslatedKeys and outOfDateKeys per locale
```

---

## verify

ディスクからすべてのロケールファイルを再読み込みし、翻訳が実際に存在し正しいことを検証します。これは`sync`の終了時に自動的に実行される検証と同じです（`--no-verify`が渡された場合を除く）。

```bash
champollion verify                    # verify all locale files
champollion verify --warn-only        # non-blocking
champollion verify --strict           # warnings fail too
champollion verify && echo "All good" # CI gate
champollion verify --json             # one "verify" record per locale (NDJSON)
```

**チェック項目:**
- キーの一致 — すべてのソースキーが各翻訳先に存在するか（i18next の複数形キーの場合、ロケール自体の CLDR 複数形フォームのキー。フランス語では `count_many` も必要）
- 過去の実行による `[EN]` フォールバックマーカー
- 空の翻訳
- 文字体系の準拠 — ラテン文字以外のロケールにラテン文字のみのテキストが含まれていないこと。文字は Unicode のスクリプトによって分類されるため、アクセント記号付きラテン文字や全角ラテン文字もラテン文字としてカウントされます。全角ラテン文字は、CJKタイポグラフィ以外のロケールではエラーとなります
- プレースホルダー（関連する構文ごとに名前が付けられます） — ICU MessageFormat 構造（`ICU structure error`: `{name}` 引数、翻訳された複数形/select キーワードまたはセレクター、消失した `#`）、printf 変換（`printf/python-format placeholder mismatch`: `%s`、`%d`、`%(name)s` — gettext カタログで失われた `%(name)s` は ICU ではなく printf として命名されます）、i18next 補間（`i18next {{…}} placeholder mismatch`: `{{name}}`。i18next がそのまま出力する `{name}` と記述された `{{name}}` を含む）、および ICU メッセージ外の単一中括弧 `{name}`（`{…} placeholder mismatch`）
- マークアップ — タグ名ごとにソースと同じ開始タグ、終了タグ、自己終了タグが存在し、同じネスト構造になっているか（消失した `</strong>` はエラー）
- エンコーディングの問題 — BOM マーカー、不可視文字
- ソースのエコー — ソースと完全に一致する値（警告）
- 複数形 — 通常のカウントで使用される形を欠いた複数形メッセージ（ロシア語の `few`/`many`）、`other` を繰り返すだけの形式を持つ gettext エントリ（sync はこれらに `# champollion:` コメントを付与します）、その言語に存在しない形式の i18next キーまたは `msgstr[n]`（警告）
- 同一のロケール — ほとんどのキーで同じテキストを持つ2つの翻訳先ロケール（一方が他方の言語になっている可能性が高い、警告）
- 異なるソースに対する同一テキスト — 複数の異なるソース文字列に対して同じテキストが記述されている（モデルが暗記した文を繰り返している）状態: 4単語以上（その他の場合は3単語以上）の同一テキストで応答された明確に異なる複数の複数単語文字列。過去の sync でモデルが繰り返したことが検出された文は1回でもカウントされます。キー値、各 ICU 複数形/select 分岐（1つの複数形の分岐は1つのソースとしてカウント）、およびロケールの Markdown ページ（front-matter フィールドおよびブロック。`# ` および末尾の句読点を除く）にわたってカウントされ、`sync` のゲートが拒否するのと同じルールで判定されます（エラー）
- 期限切れ（Out of date） — 現在のものより古いソーステキストから作成された翻訳（ここでは警告。`audit` では失敗します）
- 疑問符または感嘆符の欠落 — ソースが `?` または `!` で終了しているのに対し、翻訳がそれらでも翻訳先文字体系の同等物（`？`、`؟`、ギリシャ語の `;` など）でも終了していない。警告（疑問を単語や不変化詞で表す言語もあるため）

チェックされるのは構造であり、意味ではありません。パスしたということはキー、プレースホルダー、複数形、マークアップ、文字体系が完全であることを意味し、テキストの内容が正しいことを保証するものではありません。本番で使用する前に話者による確認を行ってください。

**対象ロケール**: `verify` はすべてのロケールをチェックし、`verify --pair en:fr` はフランス語のみをチェックします。`sync --pair en:fr` の後、sync後のチェックは実行された言語ペアのみを対象とし、その他は対象外となります。対象が限定されたチェックは、最終行にその旨を表示します — `Verification passed for fr: … intact (only en:fr was synced; champollion verify checks every locale)` — and never "in every locale"; with `--json`。この行には `checked`（チェックされたロケール）および `scope` が含まれます。

**複数形カバレッジ**: 各ロケールのブロックには、そのファイルに含まれる複数形の種類（i18next の接尾辞付きキー、ICU 複数形メッセージ、gettext の `msgid_plural` エントリ）ごとに1行が表示され、そのロケールが持つべきフォーム（ロケール用の CLDR 複数形カテゴリ。gettext カタログでは `Plural-Forms` がスロットを持つフォーム）名と、すべての複数形がそれらを備えているかどうかが示されます:

```text
  ── fr ──────────────────────────────────────
  [OK] 7/7 keys present
  Plural forms (CLDR fr): one, many, other ✓ — 2 i18next plural key group(s), every form present
```

`✗` はフォームを欠いている複数形を挙げます。1000を超える数値や小数のみが使用するフォーム（ICU メッセージにおけるフランス語の `many` など）は別個に扱われます。`other` フォームがその代わりを務めるため、指摘事項にはなりません。この行はサマリーです — 欠落しているフォームは、その上部に指摘事項（キーの欠落、複数形警告）としても表示されます。

**`--json`** は1行に1つのJSONオブジェクトを出力します。各ロケールは標準出力にレコード（`{"level": "event", "event": "verify", "locale": "fr", …}`）を受け取り、これには `ok`、`keys`（`expected`、`present`、`missing`、`extra`）、その `errors`、`warnings` および `infos`、`placeholders`（各指摘事項とその `syntax`: `icu`、`printf`、`i18next`、`brace` または `markup`）、そして `plurals`（種類およびタイプ別: `categories`、`total`、`complete`、`incomplete`）が含まれます。指摘事項は標準エラー出力の `error`/`warn` 行としても出力され、最終行はそのレベルとメッセージを維持し（チェック通過時は標準出力に `ok`、不通過時は標準エラー出力に `error`）、`errors` および `warnings` のカウントを保持します。sync の後には、sync 自身のサマリーの前に同じレコードが出力されます。（Docusaurus プロジェクトのレコードには `keys` や `plurals` は含まれません。UI文字列はファイル単位でチェックされます。）

```bash
npx champollion verify --json 2>/dev/null | jq -c 'select(.event == "verify") | {locale, plurals}'
```

**終了コード:** エラーが見つかった場合、またはまったくチェックを実行できなかった場合（ソースファイルやロケールフォルダーが設定で指定された場所に存在しない場合。エラー行にパスと設定項目名が表示されます）は `1`、それ以外は `0` です。警告があっても、`--strict` を渡さない限り失敗しません。このフラグを渡すと、警告がある場合に `1` で終了し（例えば、ロシア語の複数形に `few`/`many` 形式が含まれていないままリリースしてはならないCIなど）、`[OK]` ではなく `[FAIL]` の行で終了します。`--warn-only` を指定すると、エラー時も `0` で終了します。キー数が合わないロケールには、`[OK]` の代わりに `8 expected, 9 present (1 extra: count_two)` と表示されます。

---

## lint

i18n翻訳呼び出しを使用すべきハードコードされたユーザー向け文字列をソースコードからスキャンします。フレームワーク（next-intl、react-i18next、vue-i18n、Hugo）を自動検出します。

```bash
champollion lint                    # exits 1 if issues found (or no source files were found)
champollion lint --warn-only        # always exits 0
champollion lint --src ./app        # custom source directory
champollion lint --min-length 4     # minimum string length to flag
```

**検出内容：**
- JSXテキスト、`placeholder`、`alt`、`aria-label`、`title`内のハードコードされた文字列
- ユーザー向けコンテンツがあるがi18nフレームワークのインポートがないファイル
- デッドキー — どのソースファイルからも参照されていないロケールキー
- カバレッジスコア — i18nを通じて処理されている文字列の割合

**除外設定**: プロジェクトルートに`.champollionignore`を作成してください（`.gitignore`のようなglobパターンを使用）。

**リント対象がない場合は失敗**: ソースファイルが1つも一致しない場合（フレームワークのデフォルトフォルダー — Webプロジェクト用の `src/`、`app/`、`pages/`、`components/` — または設定された `--src`）、lint は `1` で終了し、検索対象としたフォルダーと拡張子を表示します。何もチェックしなかった lint が CI ゲートを通過してはなりません。`--src <dir>` または `"lint": { "srcDir": "<dir>" }` を使ってコードの場所を指定してください。

---

## wrap

`lint`で検出されたハードコードされた文字列を`t()`呼び出しで自動的にラップします。ファイルを変更する前に自動バックアップを作成します。

```bash
champollion wrap                    # auto-wrap with backup
champollion wrap --dry              # preview wrapping changes
champollion wrap --undo             # restore from .champollion-backup/
```

**安全ゲート：**
1. Gitクリーンチェック（ドライランではスキップ）
2. `.champollion-backup/`への自動バックアップ
3. 各ファイル書き込み前の差分プレビュー
4. バックアップからの復元のための`--undo`サポート

---

## seo

多言語サイト向けのSEOアーティファクトを生成します。

```bash
champollion seo hreflang                                        # print hreflang tags
champollion seo sitemap --base-url https://example.com --out sitemap.xml
champollion seo jsonld --base-url https://example.com           # JSON-LD schema
```

| サブコマンド | 出力 |
|------------|--------|
| `hreflang` | `<link rel="alternate" hreflang>`タグ |
| `sitemap` | 多言語`sitemap.xml` |
| `jsonld` | JSON-LD WebSite言語スキーマ |

---

## integrity

翻訳済みロケールファイルの破損とドリフトを検出します。

```bash
champollion integrity               # exits 1 if issues found
champollion integrity --warn-only   # non-blocking
```

**チェック項目:**
- プレースホルダーの破損（例: `{name}` がソースに存在するが翻訳先で見つからない）
- エンコーディングの問題（文字化け、無効なUnicode）
- 未翻訳のコピー（翻訳先の値がソースと同一） — [`noTranslate`](/docs/getting-started/configuration#no-translate) キーは対象外であり、パイプラインで生成されゲートで承認されたことが翻訳メモリで確認されているエコーも対象外です。フラグが付けられたままのものは、まさに `sync` が再キューする対象そのものです（健全なファイルに関してこの2つのツールで見解が分かれることはありません）
- 翻訳除外（No-translate）のドリフト（ソースと同一で*ない* `noTranslate` キー） — 期待値/実際の値が表示され、不可視文字がエスケープされて報告されます。修復するには `champollion sync` を実行してください
- 予期しないPUA（[文字体系変換](/docs/getting-started/configuration#script-conversion)が無効になっているロケールにおける私用領域コードポイント — 専用フォントがないと空白としてレンダリングされます）。修復するには `champollion repair-script` を実行してください
- 抜け殻値（Hollowed values: 文字が削除されてソースと同じ記号のみになった翻訳先 — コンテンツ保護ゲートより古いパイプラインによる破損）。`sync --force-keys <key>` または `sync --pair <pair> --force` で再翻訳してください
- 孤立したキー（ソースに存在しない翻訳先のキー）
- ICU MessageFormat の複数形カテゴリの完全性（例: アラビア語には6つのカテゴリが必要） — `sync` および `verify` と同じルールに基づきます: 通常のカウントで使用されるフォームの欠落（ロシア語の `few`/`many`）は警告、1000を超える数値や小数でのみ使用されるフォームの欠落（1 000 000 に使用されるフランス語の `many`）は、`other` フォームが使用されるため注記（note）となります

---

## repair-script

発生すべきでなかった文字体系変換を取り消します。設定で変換が無効になっているロケール内のPUAエンコードされた値（クリンゴン語pIqaD、テングワール、クリプトン語）を、コンバーター自体の逆引きテーブルを介してローマ字表記に復元します。

```bash
champollion repair-script --dry     # preview
champollion repair-script           # repair in place
```

| オプション | 効果 |
|--------|--------|
| `--dry` | 書き込みを行わずに修復内容をプレビューする |
| `--locale <code>` | 単一のロケールのみを修復する |
| `--json` | 機械可読なJSON出力を行う |
| `--warn-only` | 復元不可能なPUAが残っていても終了コード0で終了する |

pIqaD は正確に逆変換されます。テングワールおよびクリプトン語の逆変換では大文字・小文字の区別を復元できません（case-lossy としてフラグが付けられます）。翻訳メモリは変換前の値を保存しているため、修復は不要です。登録されているコンバーターで逆変換できない PUA が残っている場合は終了コード1で終了します。

---

## tm

翻訳メモリキャッシュ（`.champollion/tm.json`）を管理します。TMは過去の翻訳を保存し、APIを呼び出す代わりに後続の同期時にそれらを返します。

```bash
champollion tm stats                  # show cache statistics
champollion tm clear                  # clear cache (with confirmation)
champollion tm clear --yes            # clear without confirmation
champollion tm clear --locale fr      # clear only French entries
```

| サブコマンド | 出力 |
|------------|--------|
| `stats` | エントリ数、ファイルサイズ、ロケール別の内訳 |
| `clear` | キャッシュファイルの削除（全体またはロケール別） |

| オプション | 効果 |
|--------|--------|
| `--locale <code>` | 特定のロケールのエントリのみをクリア |
| `--yes` | 確認プロンプトをスキップ |

TMの仕組みとクリアするタイミングについては、[翻訳メモリ](/docs/concepts/translation-memory)を参照してください。

---

## xliff

プロの翻訳者によるレビュー用にXLIFF 1.2ファイルをエクスポート・インポートします。XLIFFはmemoQ、SDL Trados、PhraseなどのCATツールでサポートされている汎用交換フォーマットです。

```bash
champollion xliff export --locale fr                   # export French XLIFF
champollion xliff export --locale ja --out ./review/   # custom output path
champollion xliff import .champollion/xliff/fr.xliff       # import reviewed file
champollion xliff import ./reviewed.xliff --dry        # preview import
```

| サブコマンド | 出力 |
|------------|--------|
| `export` | ソースとターゲットのロケールファイルから`.xliff`を生成 |
| `import` | レビュー済みの`.xliff`翻訳をロケールファイルにマージ |

| オプション | 効果 |
|--------|--------|
| `--locale <code>` | エクスポート対象のターゲットロケール（必須） |
| `--out <path>` | カスタム出力パスまたはディレクトリ |
| `--dry` | 書き込みを行わずにインポートをプレビュー |

完全なワークフローについては、[プロの翻訳者との連携](/docs/guides/professional-translators)を参照してください。

---

## status

言語ペアの設定、インストール済みプラグイン、およびベンチマークスコアを表示します。

設定で `qualityTier`（`standard`、`high`、`research`、または `verified`）が指定されているペアにはそれが表示されます。これは測定値ではなく選択されたラベルとしての表示です（記載内容に関わらず sync は同じように翻訳し、`serve` はそれを公表します）。設定されていないペアには何も表示されません（`--json` には依然として `qualityTier` があり、`qualityTierSet: false` が付きます）。

```bash
champollion status
```

モデルの切り替え後、ロケールファイルに複数のモデルからのテキストが混在している場合（翻訳メモリの情報から、ディスク上の各値をどのモデルが生成したかを判定）、以前のモデルが書き込んだ内容を現在のモデルで翻訳するためのコマンド（`sync --pair <pair> --redo all --fresh-on-model-change`）とともに通知します。
選択したモデルを実行するメソッド（`local`、`api`、`external`）の場合、初回の sync で一度表示されたライセンスの注意事項が再度表示されます。OpenAI互換メソッド（`local`、`openai`）の場合、リクエストの送信先アドレスとそれを選択した設定項目（環境変数内の `LOCAL_API_BASE` または `.env` 内、あるいはデフォルトの Ollama、`http://localhost:11434/v1`）が表示されます。`contentDir` がある場合、キー/値ファイルと並んでコンテンツフォルダーがリストされ、保持するソースページ数と、言語ごとに最新、期限切れ、または保留中の翻訳数が表示されます。保留中とは、まだ翻訳が存在しないか、品質ゲートで拒否された部分がソース言語のまま残されていることを意味します（コンテンツロックには `pending:<hash>` と記載）。
各レジスターの下には、LLMプロンプトが保持するジェンダーガイダンスとその提供元（言語に対する Champollion のデフォルト、ユーザーの設定、またはオフ — [ジェンダーガイダンス](/docs/getting-started/configuration#gender-guidance)を参照）が表示されます。
フォールバックを持つペアの場合、フォールバックによって書き込まれたファイル内の値の数をカウントし、最初のいくつかの値を例示します。
`--json` には、`requestsGoTo`（そのようなエンドポイントを持つペアまたはフォールバック上）、`content`、`genderGuidance`、`fallback.valuesInFiles` と同じ内容が含まれます。

---

## provenance

インストール済みのすべてのプラグインの翻訳リソースライセンスを監査します。

```bash
champollion provenance
```

---

## plugin

翻訳メソッドプラグインを管理します。プラグインは`.champollion/methods/`にインストールされる、あらかじめパッケージ化された翻訳レシピです。

```bash
champollion plugin list                      # show installed plugins
champollion plugin install ./my-method/      # install from local directory
champollion plugin remove my-method          # remove a plugin
```

プラグインマニフェスト形式については、[プラグイン仕様](/docs/reference/plugin-spec)を参照してください。

---

## leaderboard

`champollion network leaderboard`（`champollion leaderboard` としても機能します）。Networkリーダーボードから翻訳メソッドを閲覧、検索、インストールします。リーダーボードからインストールされたメソッドには、ベンチマークスコアと完全な正規 MethodConfig（評価時に使用された正確な設定）が付属します。

```bash
champollion network leaderboard                       # show leaderboard
champollion network leaderboard --pair "eng>fra"      # filter by language pair (quote the >)
champollion network leaderboard --install 1           # install the method ranked 1 as a plugin
champollion network leaderboard --install 1 --apply   # install + patch config
```

| オプション | 効果 |
|--------|--------|
| `--pair <pair>` | リーダーボードの表記形式（ISO 639-3。`>` をクォート）に従って言語ペアで絞り込む: `"eng>fra"`。`eng-fra` や `eng:fra` も機能し、2文字コードも解決される（`en` → `eng`） |
| `--install <rank>` | リストされた順位のメソッドをプラグインとしてインストールする |
| `--apply` | インストール後、自動的に `methodPlugin` を `champollion.config.json` に追加する |

**`--apply`ワークフロー：** `--apply`を付けてインストールすると、champollionはメソッドプラグインを`.champollion/methods/`に書き込み、**さらに**`champollion.config.json`を更新して該当ペアにそのメソッドを使用するよう設定します。これは「最高スコアのメソッドは何か？」から「本番環境で使用中」までの最速の経路です。

---

## card

`champollion network card <code>`（`champollion card` としても動作します）。インデックスがその言語について把握している情報を表示します：識別情報、分類、話者数推計、危機度、類型論、コーパスの利用可能性、言語リソース、評価データセット、パイプラインの準備状況、手法のサポート状況、およびデータソース。情報源によって意見が分かれる項目（名称、語族、話者数、危機度など）については、すべての値がその情報源とともに出力され、いずれか1つが選ばれることはありません。カードに情報がないセクションには「このカードには記録されていません」と表示されます。記載がないことは不明であることを意味し、「存在しない」という意味ではありません。別名も解決されます（`fr` → `fra`）。

```bash
champollion network card crk           # Plains Cree
champollion network card cmn --json    # the raw card JSON
```

| オプション | 効果 |
|--------|--------|
| `--json` | 整形された表示の代わりに生のカードJSONを出力 |

---

## recommend

`champollion network recommend <src> <tgt>`（`champollion recommend` としても動作します）。1つの原言語→対象言語ペアに対する手法のガイダンス：ディスパッチ可能なすべてのエンジンと現在の利用可能性（APIキーの有無、ライセンスレーン）、自身のモデルカードで対象言語を宣言しており `local-model` がロード可能なオープンモデル（実行可能だが公開された証拠はないもの — 測定値ではなくベンチマーク対象としての主張）、そのペアに対してインデックスされている公開済みの証拠（引用のみで再作成はせず、相対比較のみ）、および証拠のあるモデルのうちここで実行可能なもの。証拠がない場合はその旨が表示されます。商用レーンは厳格です：商用利用可能なライセンスを持たない手法は理由とともに除外されます。

```bash
champollion network recommend eng yor
champollion network recommend eng-yor --use commercial
```

| オプション | 効果 |
|--------|--------|
| `--pair <pair>` | 2つのコードではなく1つの値としてのペア指定：`"eng>yor"`（`>` をクォート）、`eng-yor`、または `eng:yor` |
| `--use <lane>` | ライセンスレーン：`non-commercial`（デフォルト）または `commercial`（厳格） |
| `--json` | 機械可読ペイロード |

---

## register-corpus

`champollion network register-corpus`（`champollion register-corpus` としても動作します）。ライセンスおよび公開ティアとともに評価用コーパスを登録します — `local-only`（デフォルト：登録・アップロードともになし）、`private`（メタデータのみ）、`public`（メタデータカードおよび出所からの取得ポインタ）、または `sealed`（デバイス上で暗号化され、コンテンツを含まないカードのみが外部に出る）。Champollionはいかなるティアにおいてもコーパステキストをアップロードまたはホストすることはありません。`--data` で指定されたファイルはこのマシン上でのみ読み取られて行数カウントとチェックサム取得が行われ、`mt-eval run` がそのライセンスを適用できるようにサイドカーが生成されます。テストセットの場合、最初のスコア測定前に行うべき nmt-forge のステップを表示します。ターミナルでの対話形式、またはフラグと `--yes` によるスクリプト実行が可能です。

```bash
champollion network register-corpus --list
champollion network register-corpus --yes --name "Holdout" --pair "eng>crk" --license cc-by-nc-4.0 --tier private --role test --size 500 --domain educational
```

すべてのオプションと card-id ルール：`champollion network register-corpus --help`。

---

## seal-corpus

`champollion network seal-corpus <keygen|seal|open|sign-keygen|sign|verify>`（`champollion seal-corpus` としても動作します）。封印公開ティア周りの暗号処理（X25519-ECDH → HKDF-SHA256 → AES-256-GCM）：`keygen` は単一の仮鍵ペアを作成し（M-of-Nグループキーではありません — 秘密鍵ファイルを保持する者が単独で復号可能）、`seal` はこのマシン上でコーパスを暗号化し、`open` は制御された評価環境で封印成果物を復号し、`sign-keygen` / `sign` / `verify` はエアギャップ転送用のスコアバンドルに署名します（単一ノードの署名鍵）。`mt-eval` の主催者ノードは、暗号を再実装する代わりにここをシェル経由で呼び出します。

```bash
champollion network seal-corpus keygen --out ~/.contest-keys
```

すべてのオプション：`champollion network seal-corpus --help`。

---

## submit

`champollion network submit`（`champollion submit` としても動作します）。レビューゲート付きの経路を通じてインデックスへのエントリを提案します：6つの申請タイプ（`dataset`、`resource`、`method`、`human-service`、`external-result`、`card-correction`）のいずれかに必要な項目を収集し、記入済みのGitHub Issue URLを出力します。メンテナーがライセンスおよび主権ルールに照らしてこれをレビューします。自動で承認されるものはなく、レジストリやデータベースに直接書き込むことも決してありません。

```bash
champollion network submit --list
champollion network submit --yes --type dataset --attest --field dataset-name="GlobalVoices eng-amh" --field pairs=eng-amh --field license=CC-BY-4.0 --field source-url=https://globalvoices.org
```

すべてのオプション：`champollion network submit --help`。

---

## fonts

構築言語スクリプトコンバーター用のPUA Webフォントをダウンロードして管理します。Private Use Area文字を使用する言語（クリンゴン語、シンダリン語、クリプトン語）は、スクリプトをレンダリングするためにカスタムWebフォントが必要です。このコマンドは、検証済みのオープンソースリポジトリからフォントをダウンロードします。

```bash
champollion fonts list                           # show needed fonts
champollion fonts install                        # download all needed fonts
champollion fonts install --css                  # also generate CSS snippet
champollion fonts install --dir ./public/fonts   # custom output directory
```

| サブコマンド | 出力 |
|------------|--------|
| `list` | 必要なPUAフォントとそのインストール状況を表示 |
| `install` | 設定済み言語のフォントをダウンロード |

| オプション | 効果 |
|--------|--------|
| `--dir <path>` | フォント出力ディレクトリを上書き（プロジェクトタイプから自動検出） |
| `--css` | フォントと一緒に`conlang-fonts.css`スニペットを生成 |
| `--config <path>` | 設定ファイルへのパス（どの言語にフォントが必要かの検出に使用） |

**自動検出：** 出力ディレクトリはプロジェクト構造から推定されます：
- **Docusaurus** → `static/fonts/` または `website/static/fonts/`
- **Hugo** → `static/fonts/`
- **デフォルト** → `public/fonts/`

**ネイティブUnicodeコンバーター**（`crk` → クリー音節文字、`sr` → セルビア語キリル文字）はフォントのインストールを必要としません。

PUAフォントの詳細については、[構築言語、スクリプト、正書法](/docs/guides/conlangs-scripts-orthography)を参照してください。

---

## serve

このプロジェクト独自の翻訳スタック（手法、レジスター、コーチング、翻訳メモリ、品質ゲート）をHTTP経由で提供し、`api` 手法が利用する規約に準拠して、別の Champollion プロジェクトが `"method": "api"` をそこに向けることができるようにします。リクエストは `sync` が使用するパイプラインを経由します：翻訳メモリのヒットはキャッシュから無償で返され、品質ゲートの不合格はキー単位のエラーとして返され、劣化した出力が返されることは決してありません。

デフォルトで `127.0.0.1` にバインドされます。そのポートにアクセスできる者であれば誰でもアップストリームのAPI予算を消費できてしまうため、外部公開は明示的な決定（`--bind 0.0.0.0`）であり、ベアラートークンが必要です。`--no-auth` はループバックバインドの場合にのみ受け付けられます。

```bash
champollion serve --token my-strong-secret --max-session-cost 5
champollion serve --no-auth --bind 127.0.0.1     # this machine only, no token
champollion serve --emit-manifest --endpoint https://translate.example.org
```

| オプション | 効果 |
|--------|--------|
| `--port <n>` | リッスンポート（デフォルト：1822、0 = ランダムな空きポート） |
| `--bind <addr>` | バインドアドレス（デフォルト：`127.0.0.1`。`--bind 0.0.0.0` はサーバーを外部公開するためトークンが必要） |
| `--token <secret>` | コンシューマーが送信するベアラートークン（デフォルト：環境変数 `CHAMPOLLION_SERVE_TOKEN` または `.env.local`、12文字以上） |
| `--no-auth` | 認証なし — バインド先がループバックでない限り拒絶 |
| `--rate-limit <n>` | クライアントIPごとの1分あたりのリクエスト数（デフォルト：120、0で無効化） |
| `--max-body-bytes <n>` | リクエストボディのサイズ上限（バイト単位、デフォルト：1000000） |
| `--max-cost-per-request <usd>` | アップストリームの推定コストがこれを超えるリクエストを拒絶（価格不明時も拒絶） |
| `--max-session-cost <usd>` | このサーバープロセスの推定支出上限。上限を超えたリクエストは拒絶（402） |
| `--name <kebab-case>` | 提供する手法名（デフォルト：プロジェクトディレクトリから取得） |
| `--pair <src:tgt>` | 設定済みのうち、これらのペアのみを提供（カンマ区切り） |
| `--emit-manifest` | コンシューマーがインストールする `method.json` を書き出して終了（サーバーは起動しない） |
| `--endpoint <url>` | `--emit-manifest` のコンシューマーからアクセス可能なエンドポイント（デフォルト：`http://127.0.0.1:<port>/translate`） |
| `--out <path>` | `--emit-manifest` の書き出し先（デフォルト：`./<name>/method.json`） |

---

## models

```bash
champollion models --method gemini      # list Gemini models
champollion models --method openai --json
champollion models check                # every default model against the providers' live lists (free)
```

プロバイダーのAPIが提供するモデルを一覧表示します（読み取り専用。設定は変更されません）。`champollion models check` はすべてのデフォルトモデル（`shared/model-defaults.json`）をプロバイダーの最新リストと照合し、存在しないものがあれば終了コード 1 で終了します。一覧取得エンドポイントは課金されません。

| オプション | 効果 |
|--------|--------|
| `--method <name>` | 照会するプロバイダー：`gemini`、`openai`、または `anthropic`（`check` を除く必須） |
| `--json` | 機械可読なJSON（1ドキュメント） |

---

## doctor

```bash
champollion doctor                  # every check
champollion doctor cards            # language card diagnostics
champollion doctor fst crk          # the Plains Cree FST
champollion doctor --json
```

インストールの健全性チェックを行います：言語カード、プロジェクト設定、FSTのインストール状況、APIキー、および手法の依存関係を検査します。デフォルトですべてのチェックを実行し、サブコマンドで個別のチェックを実行します。

| サブコマンド | チェック内容 |
|------------|--------|
| `cards` | 言語カードが正しくロードされるか、カバレッジ統計 |
| `config` | プロジェクト設定ファイルと、その言語コードがどのように解決されるか |
| `fst [code]` | FSTのインストール状況（すべて、または特定の1言語） |
| `methods` | APIキー（それぞれが設定されているか。OpenRouterキーはOpenRouterの無料キー確認エンドポイントにも送信され、無効な場合は拒否されます）、サーバーへの到達性、Pythonパッケージ |

`--json` はすべてのチェック結果を1つのドキュメントとして出力します。

## 3層パイプライン

堅牢なi18nを実現するために、`lint`、`sync`、`audit`を組み合わせて使用してください：

```json title="package.json"
{
  "scripts": {
    "i18n:lint": "champollion lint",
    "i18n:sync": "champollion sync",
    "i18n:audit": "champollion audit"
  }
}
```

| レイヤー | コマンド | タイミング | 目的 |
|-------|---------|------|---------|
| **Lint** | `lint` | コミット前 | ハードコードされた文字列を含むコミットをブロック |
| **Sync** | `sync` | コミット後 / CI | 未翻訳・変更済みキーを翻訳 |
| **Verify** | `verify` | 同期後 / CI | 翻訳が存在し正しいことを確認 |
| **Audit** | `audit` | ビルドステップ | いずれかのロケールに`[EN]`マーカーがある場合はデプロイを失敗させる |

---

## 関連項目

- [設定](/docs/getting-started/configuration) — 設定ファイルリファレンス
- [翻訳メソッド](/docs/guides/translation-methods) — ペアごとのメソッド選択
- [翻訳メモリ](/docs/concepts/translation-memory) — キャッシュとコスト削減
- [プロの翻訳者との連携](/docs/guides/professional-translators) — XLIFFワークフロー
- [プラグイン仕様](/docs/reference/plugin-spec) — プラグインマニフェスト形式
- [CI/CDガイド](/docs/guides/ci-cd) — パイプラインでのCLIコマンドの自動化
- [同期の仕組み](/docs/concepts/how-sync-works) — 同期パイプラインの理解
- [品質ゲート](/docs/concepts/quality-gate) — 翻訳の検証方法
