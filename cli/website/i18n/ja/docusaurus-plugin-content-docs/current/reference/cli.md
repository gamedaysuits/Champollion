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

```
champollion init              Interactive setup wizard (--yes for quick defaults)
champollion sync              Translate & sync all locale files
champollion watch             Auto-sync when the source file changes
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
--temperature <n>       LLM temperature (0.0–2.0, default: 0.3)
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
