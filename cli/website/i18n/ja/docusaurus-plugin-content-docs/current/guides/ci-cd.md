---
sidebar_position: 3
title: "CI/CD"
---

# CI/CD インテグレーション

ビルドパイプラインで翻訳を自動化します。

champollion CLI は [PolyForm Noncommercial License 1.0.0](https://github.com/gamedaysuits/Champollion/blob/main/cli/LICENSE) のもとでソースコードが公開（source-available）されており、非商用目的であれば自由に使用、改変、共有できます。商用目的での使用はこのライセンスの対象外です（[利用可能な対象について](/docs/getting-started/who-may-use-this)）。

## GitHub Actions: 翻訳の同期を維持する

変更箇所を翻訳し、結果を検証して、コミットし直す完全なワークフローです。Node プロジェクトかどうかにかかわらず、あらゆるプロジェクト（Django、Flutter、Hugo など）で動作します。

```yaml title=".github/workflows/i18n-sync.yml"
name: Sync translations
on:
  push:
    branches: [main]
    # Run only when something sync reads changed: the SOURCE locale files
    # (edit these to the files your config's "localesDir"/"localesPattern"
    # names) and the config. A push that changes neither has nothing to
    # translate, so it starts no job and needs no key.
    paths:
      - 'locales/en.json'       # one file per language
      - 'locales/en/**'         # or one folder per language (i18next: public/locales/en/**)
      - 'champollion.config.json'
  # Run workflow (by hand). The box asks again for plural forms a model
  # left out (--redo gaps; see "Plural forms a model left out" below).
  workflow_dispatch:
    inputs:
      redo_gaps:
        description: 'Ask again for plural forms a model left out (--redo gaps)'
        type: boolean
        default: false

permissions:
  contents: write          # lets the job push the translated files back

# One sync at a time per branch: two quick pushes would otherwise race to
# commit the same files. Queued, not cancelled — a cancelled run may have
# translated (and paid for) work it never committed.
concurrency:
  group: i18n-sync-${{ github.ref }}
  cancel-in-progress: false

# The flags of every `champollion sync` in this job — the sync step below,
# and the dry-run check further down this page, read this one line, so the
# check tests the method this job runs. The config's method runs as it is.
# A runner has no model server: if your config says "local" (a model on
# your machine), name a hosted model here instead, for these runs only
# (the config file is not changed):
#   SYNC_FLAGS: --method llm --model google/gemini-3.8-flash --max-cost 5
env:
  SYNC_FLAGS: --max-cost 5

jobs:
  sync:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 24   # a current LTS; champollion needs Node 20.11 or newer
      # The Translation Memory is a per-machine cache, so a fresh runner
      # starts empty. Restoring it means text translated before is served
      # free instead of billed again. No cache is saved under this exact
      # key: restore-keys brings back the branch's newest one.
      - name: Restore the translation cache
        id: cache
        uses: actions/cache/restore@v4
        with:
          path: .champollion
          key: champollion-tm-${{ github.ref_name }}-newest
          restore-keys: champollion-tm-${{ github.ref_name }}-
      - name: Sync translations
        id: sync
        env:
          OPENROUTER_API_KEY: ${{ secrets.OPENROUTER_API_KEY }}
        # Exit 2 = partial: some keys were translated, some were not (refused
        # by the quality gate, held back, a plural form the model left out, or
        # --max-cost stopped the run). What WAS translated is committed below,
        # then the job fails with the reason. Any other non-zero code stops here.
        #
        # $SYNC_FLAGS: the job's flags (env: above). The redo_gaps box of
        # "Run workflow" adds --redo gaps.
        run: |
          set +e
          npx --yes champollion@0.5 sync $SYNC_FLAGS ${{ inputs.redo_gaps && '--redo gaps' || '' }}
          code=$?
          echo "code=$code" >> "$GITHUB_OUTPUT"
          if [ "$code" -ne 0 ] && [ "$code" -ne 2 ]; then exit "$code"; fi
      # Saved even when a step failed: the translations this run paid for
      # stay cached, so the next run does not pay for them again. The key is
      # a hash of the cache's own files, so a run that added nothing to it
      # has the key it restored and skips the save (no new copy). Skipped too
      # when there is no cache folder (a push with nothing to translate on a
      # fresh runner creates none; saving it would log a path warning).
      - name: Save the translation cache
        if: always() && hashFiles('.champollion/**') != '' && steps.cache.outputs.cache-matched-key != format('champollion-tm-{0}-{1}', github.ref_name, hashFiles('.champollion/**'))
        uses: actions/cache/save@v4
        with:
          path: .champollion
          key: champollion-tm-${{ github.ref_name }}-${{ hashFiles('.champollion/**') }}
      - name: Commit updated translations
        run: |
          git config user.name "champollion"
          git config user.email "bot@example.com"
          # The translated files AND the lock files (.champollion.lock,
          # .champollion-content.lock), whatever your locale folders are called
          # — and .champollion-replaced-edits.jsonl when a sync wrote one.
          # .champollion/ (the cache) is in .gitignore — `champollion init` adds it.
          # (gettext: build steps write .mo files — stage only the catalogs; see below.)
          git add --all
          git diff --staged --quiet || git commit -m "chore: sync translations"
          # Someone may have pushed while this job ran: put this commit on
          # top of theirs, so the push does not fail (and waste the spend).
          git pull --rebase origin "$GITHUB_REF_NAME"
          git push origin "HEAD:$GITHUB_REF_NAME"
      # Right after the commit, before verify: on a partial run verify would
      # fail first on the missing keys, and the red step would name a key
      # while the reason sat in a green step.
      - name: Stop when the sync was partial
        if: steps.sync.outputs.code == '2'
        run: |
          echo "::error::champollion sync exit 2: the run stopped at --max-cost before translating, or some keys were not translated (refused by the quality gate, held back, or a plural form left out). What was translated is committed. The 'Sync translations' step's log says which."
          exit 1
      # --strict: a warning fails the job too. Plain verify passes on warnings
      # — an extra or missing plural form, a source echo, an out-of-date
      # translation — so they would ship with a green build.
      - name: Check every locale is complete and intact
        run: npx --yes champollion@0.5 verify --strict
```

**このワークフロー構成になっている理由。** `actions/cache` 単体ではジョブ全体が成功したときにのみキャッシュが保存され、`sync` はキーが拒否されると常に `2` で終了します。そのため、部分的に実行された場合はコミットとキャッシュ保存の両方がスキップされ、次回の実行で同じ翻訳に対して再び料金が発生していました。ここでは、キャッシュの復元と保存を2つのステップ（`actions/cache/restore`、そして `if: always()` を指定した `actions/cache/save`）に分け、同期ステップは `2` で失敗する代わりに終了コードを記録し、翻訳されたファイルをコミットした後に初めてジョブを失敗させます。これは `verify` の前の専用ステップで行われるため、失敗したステップには、`verify` が不足しているキーを挙げるのではなく、失敗の理由（`--max-cost` による停止、または同期で翻訳できなかったキー）が表示されます。最後のステップは `verify --strict` です。通常の `verify` は警告（余分なまたは不足している複数形など）があっても終了コード 0 で終了しますが、`--strict` は警告があるとジョブを失敗させます。品質ゲートによって拒否されたキーは記憶されるため、次回の実行で同じモデルに再度送信されることはありません（同じ回答に対して課金されてしまうためです）。同期ログにはそのキーと、再要求を行うための `--redo keys:` コマンドが出力されます。

**実行ごとではなく、変更ごとに1つのキャッシュコピーを保持。** 復元ステップではブランチの最新のキャッシュを取得します（その完全一致キーである `…-newest` は保存されないため、`restore-keys` が最新のものを選択します）。保存ステップでは、キャッシュファイル自体のハッシュ（`hashFiles('.champollion/**')`）をキャッシュのキーとします。何らかの翻訳を行った実行（部分的な実行やプッシュに失敗した実行を含む）はキャッシュを変更するため、新しいキーが付与されて保存されます。何も追加しなかった実行（翻訳対象がない、すべてキャッシュから取得、`--max-cost` による停止）は復元時と同じキーを持つため、保存はスキップされ、新しいコピーは保存されません。実行 ID をキーにすると実行ごとに完全なコピーが保存されてしまい、ロックファイルやソースファイルをキーにすると、プッシュが拒否された実行の後に完全一致によって古いコピーが復元されてしまいます（コミットされたロックファイルにその実行の変更が含まれていないためです）。

Node プロジェクトでは、開発依存関係として `champollion` を追加し、代わりに `npx champollion sync` を呼び出すことができます。上記のバージョン固定された `champollion@0.5` はあらゆるリポジトリで動作し、予期せず異なるバージョンが取得されることはありません。その場合、ジョブでインストールする必要があります。何もインストールされていないクリーンなランナーでは、`npx champollion` はロックファイルで固定されたバージョンではなく最新バージョンを取得します。また、インストールによって `node_modules/` が書き込まれますが、`.gitignore` に記載されていない限り `git add --all` はそれをコミットしてしまいます（`champollion init` が作成するものは `.champollion/` のみを記載します）。そのため、後述の Django ワークフローのように、ロケールファイルとロックファイルを名前で個別にステージングしてください。

```yaml title=".github/workflows/i18n-sync.yml (dev dependency)"
# … checkout and setup-node as above; then install the version your
# package-lock.json pins:
      - run: npm ci
# … the cache restore as above. In "Sync translations" and in the last step,
# the installed CLI replaces the pinned one (SYNC_FLAGS as above):
#   npx champollion sync $SYNC_FLAGS ${{ inputs.redo_gaps && '--redo gaps' || '' }}
#   npx champollion verify --strict
# … the cache save as above; then:
      - name: Commit updated translations
        run: |
          git config user.name "champollion"
          git config user.email "bot@example.com"
          # The locale files and the lock file only: not node_modules/ (npm ci
          # just wrote it) and not .champollion/ (the cache). Name your locale
          # folder (messages, public/locales, …); when sync translates Markdown
          # too, add the folders it writes and .champollion-content.lock.
          git add -- locales .champollion.lock
          # A replaced hand edit is recorded here — the only copy of that wording.
          if [ -f .champollion-replaced-edits.jsonl ]; then git add -- .champollion-replaced-edits.jsonl; fi
          git diff --staged --quiet || git commit -m "chore: sync translations"
          git pull --rebase origin "$GITHUB_REF_NAME"
          git push origin "HEAD:$GITHUB_REF_NAME"
```

**ロックファイルをコミットしてください。** `.champollion.lock` と `.champollion-content.lock` は、各翻訳がどのソーステキストから作成されたかを記録します。これにより、次回の実行時に文字列が変更されたことを認識できます。これらを参照できないランナーは、編集された文字列と変更されていない文字列を区別できません。**`.champollion/` はコミットしないでください** — これはマシンごとのキャッシュです。`champollion init` によって `.gitignore` に追加されます。

**`--max-cost`** は、予想以上のコストが発生する前に実行を停止します。通常の一日の変更にかかるコストに設定してください。これで実行が停止された場合、何も翻訳されず、何も書き込まれず、sync は終了コード `2` で終了します。コミットするものは何もなく、「Stop when the sync was partial」ステップがその旨を示してジョブを失敗させます。公開された価格設定がない方式（別マシン上のセルフホストエンドポイントなど）は見積もりができないため、翻訳対象がある場合は常に `--max-cost` で停止します。これらを使用する場合はこの設定をオフにしてください。ランナー自体でホストされるモデル（`localhost`/`127.0.0.1` の `local`）は、API コスト $0 として計算されます。

**ソース文字列を変更するプッシュのみがジョブを開始します。** `paths:` フィルターにはソースロケールファイルと `champollion.config.json` を指定します。コードのみ、あるいは翻訳とロックファイルのみを変更するプッシュには翻訳対象がないため、ジョブは開始されません。2つのロケールパスを、設定で指定されているファイル（`messages/en.json`、`lib/l10n/app_en.arb` など）に合わせて編集してください。sync が Markdown も翻訳する場合は `contentDir` フォルダも追加します。**Run workflow**（`workflow_dispatch` トリガー）を使えば、引き続き手動で実行することもできます。

**ジョブ自身のコミットがジョブを再実行することはありません** — そしてそれを防いでいるのは `paths:` フィルターではありません。コミットステップはワークフローの `GITHUB_TOKEN` を使ってプッシュし、`GITHUB_TOKEN` で行われたプッシュがワークフローの実行をトリガーすることはありません（ワークフローが自分自身を開始しないようにするための GitHub の仕様です）。そのため、後述の Django ワークフローでは、ボットのすべてのコミットによって変更される `locale/**` を監視できます。代わりにパーソナルアクセストークンや GitHub App トークンを使用してプッシュした場合（ボットのコミットによって他のワークフローを開始したい場合など）、そのプッシュによってこのワークフローが再び開始されます。その場合は `paths:` フィルターによって判定されます。上記のフィルターは翻訳済みファイルとロックファイルを除外しているため、ボットのコミットによって実行が開始されることはありません。Django フィルターの `locale/**` はボットがコミットするカタログを含んでいるため、各コミットによってもう1回実行が開始されますが、翻訳対象が見つからず何もコミットされません。そのようなトークンを使用する場合は、ソースカタログ（`locale/en/**`）に絞り込み、設定ファイルを通じて言語を追加してください。

**開始されるすべての実行でプロバイダーのキーが必要です**。これは翻訳対象がない場合も同様です。sync は、変更内容を確認する前にその方式が実行可能かどうかを検証します。ソースの変更がない状態で手動実行した場合でも、`OPENROUTER_API_KEY` シークレット（または使用する方式のキー）がなければ失敗します。`local` はキーを必要としませんが、ランナーにはモデルサーバーがありません。開発者のマシン上で `local` を使用して翻訳するプロジェクトでは、CI でホスト型方式（`--method` / `--model` — 上記ワークフローのコメントアウトされた `SYNC_FLAGS` の行）を指定します。何も翻訳せずにシークレットがステップに届いているか確認するには、`sync --dry` を使用します。実際の実行で停止する場合に警告を発し、不足している変数名を提示します（ドライランはプレビューであるため、終了コード 0 で終了します）。これは変数が**設定されているか**を確認するものであり、キーが**有効に機能するか**を確認するものではありません。何も送信しないため、空でない値であればプレースホルダーでも通過します。誤ったキーや失効したキーは、実際の実行の最初のリクエストで判明します（エラーには HTTP 401 などのプロバイダーの応答が表示されます）。何かが実行される前にキーの不足でジョブを失敗させるには、[同期前のチェック](#check-before-sync)を追加してください。

**キャッシュは方式ごとに保持されます。** 翻訳は、それを作成した方式、レジスター（文体）、およびコーチングファイルごとにキャッシュされます（同じ方式の異なるモデル間では再利用されます — モデルキャリーオーバー）。したがって、開発者が `local` で翻訳し、CI がホスト型モデルで翻訳する場合、キャッシュエントリが共有されることはありません。また、CI のキャッシュはそもそも独立しています（`.champollion/` はコミットされません）。これは CI がプロジェクト全体を再翻訳するという意味ではありません。すでにロケールファイルに存在し、ロックファイルがコミットされているものは完了したものとして扱われます。CI は、最後のコミット以降に新しく追加または変更された文字列（開発者がローカルで翻訳したがコミットしなかった文字列を含む）についてのみホスト型モデルの料金を支払い、それ以外の文字列については料金が発生しません。ホスト型モデルでプロジェクト全体を再翻訳する場合（`--redo all`）は、すべての文字列に対して1度課金されます。

push 時ではなく**スケジュール実行**する場合: `on:` ブロックを `schedule: [{ cron: '0 6 * * *' }]` に置き換えます。

### 同期前のチェック: ジョブを早期に失敗させる {#check-before-sync}

ドライランは何が検出されても `0` で終了します（プレビューであるためです）。そのため、`sync --dry --max-cost 5` は実際の実行で上限に達して停止することを警告しつつも、CI ステップとしては成功してしまいます。実際の実行で停止するケース（キーの不足、または `--max-cost`）でジョブを失敗させるには、`sync --dry --json` のサマリーを読み取ります。この出力は1行につき1つの JSON オブジェクト（NDJSON）であり、それぞれに `level` が含まれます。標準出力には `info`、`ok`、`event` の行が出力され、標準エラー出力には `warn` と `error` の行が出力されます。標準出力の最後の行がサマリーである `{"level": "summary", "command": "sync", …}` です。
レベルによってサマリーを選択してください。**sync と同じフラグを指定して実行してください**。フラグがないと設定ファイルに記載された方式がチェックされるため、設定に `local` とあるプロジェクトの場合、ジョブが実行するホスト型モデルではなくローカルの方式がチェックされ、キーのないランナーでも通過してしまいます。上記ワークフローの「Sync translations」の前のステップとして、同じ `SYNC_FLAGS` を読み取ります。

```yaml
      - name: Check the sync can run (translates nothing)
        env:
          OPENROUTER_API_KEY: ${{ secrets.OPENROUTER_API_KEY }}
        # The JSON lines go to $out; the warnings (stderr) stay in the log.
        # When the check fails, the step prints why: the summary's
        # realRun.reasons, or its error when sync could not run at all
        # (that exit code is not fatal here — the summary is read instead).
        run: |
          out=$(npx --yes champollion@0.5 sync --dry $SYNC_FLAGS --json) || true
          if ! printf '%s\n' "$out" | jq -e 'select(.level == "summary") | .preflight.ready and (.maxCost.wouldStop | not)' > /dev/null; then
            printf '%s\n' "$out" | jq -r 'select(.level == "summary") | "::error::" + (.error // "A real sync would exit \(.realRun.exitCode): \(.realRun.reasons | join("; "))")'
            exit 1
          fi
```

またはシェルで、sync の行と同じフラグを明記して実行します。

```bash
SYNC_FLAGS="--method llm --model google/gemini-3.8-flash --max-cost 5"
out=$(npx --yes champollion@0.5 sync --dry $SYNC_FLAGS --json)
printf '%s\n' "$out" | jq -e 'select(.level == "summary") | .preflight.ready and (.maxCost.wouldStop | not)' > /dev/null \
  || printf '%s\n' "$out" | jq -r 'select(.level == "summary") | .error // "A real sync would exit \(.realRun.exitCode): \(.realRun.reasons | join("; "))"'
```

翻訳対象があるかどうかにかかわらず、方式に必要なキーが不足している（未設定または空 — 誤っている場合を除く）場合、`preflight.ready` は `false` になります。キーがなければホスト型方式の準備が整うことはありません。`maxCost.wouldStop`（`--max-cost` 指定時に存在）は、実際の実行で上限に達して停止する場合に `true` になります。`jq -e` はいずれの場合も終了コード 1 で終了し、ステップはジョブログにその理由を出力します（例: `A real sync would exit 1: it would stop before translating: No OpenRouter API key (OPENROUTER_API_KEY) for en:fr`, or `A real sync would exit 2: --max-cost would stop it before any API call (Estimated translation cost exceeds the --max-cost cap: estimate ~$7.1200, cap $5.0000)`）。sync がまったく実行できない場合（設定ファイルの破損など）は、代わりにサマリーの `error` が出力されます。このステップは標準エラー出力を `/dev/null` に送らないため、警告もログに残ります。サマリーの `realRun.exitCode` は、プレビューで判別できる範囲で、実際の実行がどの終了コードで終了するかを示します。事前チェックで停止する場合は `1`、`--max-cost` で停止する場合や、部分的な完了となる場合（保留されたキーや、言語で使用される複数形がディスク上に不足している場合など。どれに該当するかは `realRun.reasons` が示します）は `2` となります。実際の実行でしか判明しない品質ゲートによる拒否によって、`0` が `2` に変わる可能性もあります。予測される部分実行でもチェックを失敗させるには、`.preflight.ready and (.maxCost.wouldStop | not)` の代わりに `.realRun.exitCode == 0` を指定してください。

### 保護された main ブランチ: プルリクエストを提案する

上記のワークフローは翻訳を `main` に直接プッシュします。`main` が保護されている場合（レビューやステータスチェックが必須の場合）、そのプッシュは拒否されます — しかも同期が実行された後であるため、翻訳料金はすでに発生しています。ただし、料金が二重に発生することはありません。ステップが失敗した場合でもコミットステップの前にキャッシュが保存されるため、ジョブの再実行や次回のプッシュ（いずれも `restore-keys` を通じてブランチの最新キャッシュを復元します）ではキャッシュから提供されます。ロックファイルは `main` に届いていないため、次回の実行では同じ文字列が変更されたと認識され、それらが再び書き込まれます — キャッシュから取得されるためコストはかかりません。

保護された `main` では、ボットが所有するブランチにコミットし、代わりにプルリクエストを作成（または更新）します。上記のワークフローを維持したまま、権限（permissions）とコミットステップの2点を変更します。

```yaml title=".github/workflows/i18n-sync.yml (pull request)"
permissions:
  contents: write          # pushes the bot's branch
  pull-requests: write     # opens the pull request

# … checkout, setup-node, cache restore, "Sync translations" and the cache
# save as above; then, in place of "Commit updated translations":
      - name: Open or update the translations pull request
        env:
          GH_TOKEN: ${{ github.token }}
        run: |
          git config user.name "champollion"
          git config user.email "bot@example.com"
          branch=champollion/translations
          git switch -C "$branch"
          # Django: stage the catalogs and the lock by name, as in the
          # Django workflow below, instead of --all.
          git add --all
          if git diff --staged --quiet; then
            echo "Nothing to propose: the translations on $GITHUB_REF_NAME are up to date."
            exit 0
          fi
          git commit -m "chore: sync translations"
          # The branch is rebuilt from the latest $GITHUB_REF_NAME on every
          # run, so a force-push replaces the last proposal.
          git push --force origin "$branch"
          if [ -z "$(gh pr list --head "$branch" --base "$GITHUB_REF_NAME" --state open --json number --jq '.[].number')" ]; then
            gh pr create --head "$branch" --base "$GITHUB_REF_NAME" \
              --title "chore: sync translations" \
              --body "Translations and lock files from champollion sync (run $GITHUB_RUN_ID). Merge them together."
          fi
# "Stop when the sync was partial" and the verify --strict step stay as they
# are, after this one.
```

**使い分けの基準。** ワークフローから `main` へのプッシュが許可されている場合（ブランチ保護がない、または GitHub Actions によるバイパスを許可するルールがある場合）は、`main` へ直接プッシュします。`main` が保護されている場合や、リリース前に人間（その言語のネイティブスピーカーなど）が翻訳を確認する必要がある場合は、プルリクエストを作成します。

- ブランチはボットが所有します。プルリクエストがマージされるまで、`main` のロックファイルにはその翻訳が含まれていないため、実行のたびにセット全体が再び提案されます — ただしキャッシュから取得されるため、それ以降に変更された文字列のみが課金対象となります。そのブランチにプッシュされた編集内容は次回の実行で上書きされます。レビューはプルリクエスト内で行い、マージした後に `main` 上で編集してください（後から一括でやり直す場合でも、人間による編集内容は保持されます）。
- リポジトリで Actions によるプルリクエスト作成を許可する必要があります: Settings → Actions → General → 「Allow GitHub Actions to create and approve pull requests」。
- ワークフローの `GITHUB_TOKEN` で作成されたプルリクエストは他のワークフローを開始しないため、必須のステータスチェックが実行されません。`main` でステータスチェックが必須となっている場合は、GitHub App トークンまたはシークレット（`GH_TOKEN: ${{ secrets.<name> }}`）として保持された fine-grained トークンを使用して作成するか、コミット、ブランチの更新、オープン中のプルリクエストの編集を代行してくれる `peter-evans/create-pull-request` などのアクションを使用してください（同様にトークンを渡します）。

### gettext（Django、Babel）および Flutter

sync は既存のカタログを翻訳します。コードから文字列を抽出することはありません。Django プロジェクトでは、同期ステップの前にカタログを更新し、ステップ後にコンパイルできるか確認して、カタログのみをコミットします。

`makemessages` と `compilemessages` はどちらも settings をインポートするため、ジョブでは設定モジュールがインポート時に読み取るすべての変数（`SECRET_KEY`、`DATABASE_URL` など）を、全ステップ向けに一度設定します。どちらのコマンドもデータベースにはアクセスしないため、プレースホルダー値で十分です。`DJANGO_SETTINGS_MODULE` はコメントアウトしたままにしてください。`startproject` が書き出す `manage.py` 自身がこれを設定するため、ジョブで値を設定すると上書きされてしまい、誤ったモジュール名によって `makemessages` が壊れる原因になります。`manage.py` で設定されていない場合にのみ設定してください。

この `paths:` フィルターは上記のワークフローとは異なります。ソース文字列は Python コードやテンプレート内に存在し、ジョブ内で `makemessages` がそれらを抽出するため、コードの変更によって新しい文字列が追加される可能性があります。プッシュごとに毎回 Python ファイルが変更される場合は、パターンをアプリケーション（`myapp/**.py`）に絞り込んでください。また、`locale/**` も監視します。新しい言語は新しいカタログフォルダ（`makemessages -l <code>`）として追加されるためです。ボット自身のコミットによってこれらのカタログは変更されますが、`GITHUB_TOKEN` でプッシュされるため実行は開始されません（前述の「**ジョブ自身のコミットがジョブを再実行することはありません**」および別のトークンでプッシュする場合の絞り込み方法を参照してください）。

```yaml title=".github/workflows/i18n-sync.yml (Django)"
name: Sync translations
on:
  push:
    branches: [main]
    # makemessages finds new strings in your code and templates, so a code
    # change can bring a string to translate: watch those, the catalogs
    # and the config. A push that touches none of them starts no job.
    paths:
      - '**.py'
      - '**.html'
      - '**.txt'                # templates for emails and the like
      - '**.js'                 # djangojs strings; drop it if you have none
      - 'locale/**'
      - 'champollion.config.json'
  # Run workflow (by hand): the box asks again for plural forms a model left
  # out — Russian few/many marked "# champollion:" (--redo gaps).
  workflow_dispatch:
    inputs:
      redo_gaps:
        description: 'Ask again for plural forms a model left out (--redo gaps)'
        type: boolean
        default: false

permissions:
  contents: write

concurrency:
  group: i18n-sync-${{ github.ref }}
  cancel-in-progress: false

jobs:
  sync:
    runs-on: ubuntu-latest
    # For every step: makemessages and compilemessages both import your
    # settings, so set what your settings read at import (see above).
    # Placeholders are enough: neither command uses the database.
    env:
      # DJANGO_SETTINGS_MODULE: myproject.settings   # only if your manage.py does not set it
      SECRET_KEY: makemessages-only
      # The flags of every `champollion sync` in this job (the dry-run check
      # above reads them too). A runner has no model server: if your config
      # uses "local" (a model on your machine), a hosted method runs here,
      # for these runs only — the config file is not changed.
      SYNC_FLAGS: --method llm --model google/gemini-3.8-flash --max-cost 5
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 24
      - uses: actions/setup-python@v5
        with:
          python-version: '3.12'
      # A fresh runner's package index is empty: update it first, or the
      # install fails. gettext brings msgmerge and msgfmt, used below.
      - run: sudo apt-get update && sudo apt-get install -y gettext
      - run: python -m pip install -r requirements.txt   # the Python setup-python just installed
      - name: Restore the translation cache
        id: cache
        uses: actions/cache/restore@v4
        with:
          path: .champollion
          key: champollion-tm-${{ github.ref_name }}-newest
          restore-keys: champollion-tm-${{ github.ref_name }}-
      - name: Extract new strings into the catalogs
        # --no-wrap: champollion writes each msgstr on one line; without it
        # msgmerge re-wraps those lines at 79 columns on the next run, and
        # every sync commits whitespace-only changes. The second line
        # refreshes the JavaScript catalogs (djangojs.po); drop it if your
        # project has none.
        run: |
          python manage.py makemessages --all --no-wrap
          python manage.py makemessages --all --no-wrap -d djangojs
      - name: Sync translations
        id: sync
        env:
          OPENROUTER_API_KEY: ${{ secrets.OPENROUTER_API_KEY }}
        # $SYNC_FLAGS: the job's flags (env: above); the redo_gaps box of
        # "Run workflow" adds --redo gaps. Exit 2 (partial) is recorded, not
        # fatal: what was translated is committed, then the job fails.
        run: |
          set +e
          npx --yes champollion@0.5 sync $SYNC_FLAGS ${{ inputs.redo_gaps && '--redo gaps' || '' }}
          code=$?
          echo "code=$code" >> "$GITHUB_OUTPUT"
          if [ "$code" -ne 0 ] && [ "$code" -ne 2 ]; then exit "$code"; fi
      - name: Save the translation cache
        if: always() && hashFiles('.champollion/**') != '' && steps.cache.outputs.cache-matched-key != format('champollion-tm-{0}-{1}', github.ref_name, hashFiles('.champollion/**'))
        uses: actions/cache/save@v4
        with:
          path: .champollion
          key: champollion-tm-${{ github.ref_name }}-${{ hashFiles('.champollion/**') }}
      - name: Check the catalogs compile (placeholder types included)
        run: python manage.py compilemessages
      - name: Commit updated catalogs
        run: |
          git config user.name "champollion"
          git config user.email "bot@example.com"
          # The catalogs and the lock file only: not the .mo files
          # compilemessages just wrote, and not .champollion/ (the cache).
          git add -- '*.po' .champollion.lock
          # A replaced hand edit is recorded here — the only copy of that wording.
          if [ -f .champollion-replaced-edits.jsonl ]; then git add -- .champollion-replaced-edits.jsonl; fi
          # makemessages (msgmerge) writes a new POT-Creation-Date into every
          # catalog on each run: commit only when something else changed
          # (git diff -I needs git 2.30 or newer; GitHub's runners have it).
          if git diff --staged --quiet -I '^"POT-Creation-Date:'; then
            echo "Nothing to commit: only the catalogs' POT-Creation-Date changed."
          else
            git commit -m "chore: sync translations"
            git pull --rebase origin "$GITHUB_REF_NAME"
            git push origin "HEAD:$GITHUB_REF_NAME"
          fi
      # Right after the commit, before verify: on a partial run verify would
      # fail first on the missing keys, and the red step would name a key
      # while the reason sat in a green step.
      - name: Stop when the sync was partial
        if: steps.sync.outputs.code == '2'
        run: |
          echo "::error::champollion sync exit 2: the run stopped at --max-cost before translating, or some keys were not translated (refused by the quality gate, held back, or a plural form left out). What was translated is committed. The 'Sync translations' step's log says which."
          exit 1
      # --strict: a plural entry where the model left out a form the
      # language uses for everyday counts (Russian few/many) is a warning,
      # and plain verify passes on warnings. Strict fails on it, so wrong
      # plurals never ship with a green build.
      - name: Check every catalog is complete and intact
        run: npx --yes champollion@0.5 verify --strict
```

`--all` は既存のすべてのカタログを更新します。言語を追加する場合は、最初に一度 `makemessages -l <code>`（または `champollion init --langs <code>`）を実行します。
`makemessages` はドメインごとに1回実行されます。Python とテンプレート用には `django`、JavaScript 用には `djangojs`（`-d djangojs`）です。sync は検出したすべてのドメインのカタログを翻訳します。最後のステップで `verify --strict` が実行されます。ロシア語の複数形エントリで翻訳に `few` や `many` の形式が欠けているものは、`other` の形式で書き込まれ、`# champollion:` のマークが付けられます。そのようなエントリがカタログに含まれている間、すべての sync は（保留されたキーと同様に、それを書き込んだ実行も含め、以降のすべての実行で）`2` で終了します。サマリーにはそのエントリと再要求を行うためのコマンドが表示され、同期後の検証行には `[OK]` ではなく不完全（incomplete）であると表示されます。そのため、「Stop when the sync was partial」ステップは、これらの形式が書き込まれるまで、コミット後にジョブを失敗させます。単体で実行した場合、これは警告として扱われます。通常の `verify` では終了コード 0 ですが、`--strict` では失敗します。`audit` でも同じエントリが不完全としてカウントされます。

`compilemessages` は `msgfmt --check-format` を実行し、各 `%(name)s` の型が維持されているかもチェックしますが、これは `#, python-format` フラグが付いたエントリに対してのみ行われます。`makemessages` は、`%` プレースホルダーを含む抽出エントリにこのフラグを追加します。手動で作成されたカタログにはフラグがない場合があり、その場合エントリはチェックされません。`champollion verify` は、フラグの内容にかかわらず、すべてのエントリの printf プレースホルダー（名前と型文字）を比較し、sync は翻訳する各エントリに元のソースエントリのフラグを維持します。コミットステップでは `*.po` と `.champollion.lock` を名前で個別にステージングします（置換された編集内容の記録がある場合はそれも含む）。プロジェクトで `.mo` ファイルを追跡している場合は、そこに `'*.mo'` を追加してください。キャッシュのステップ、記録された終了コード、および `git pull --rebase` が存在する理由は、上記のワークフローと同じです。Babel の場合: sync の前に `pybabel extract` + `pybabel update --no-wrap`、sync の後に `pybabel compile` を実行します。

このジョブにおいて Flutter に追加のステップは不要です。sync が `app_<locale>.arb` ファイルを書き出し、それらを Dart に変換する `flutter gen-l10n`（またはそれを実行する `flutter build`）はアプリケーション自身のビルドステップで行われます。

#### モデルが出力しなかった複数形 {#plural-gaps}

マークされたエントリは完全な翻訳ではないため、sync はそれを人間だけに委ねることはしません。

- **別の方式またはモデルが自動で再要求します。** 設定（方式、モデル、レジスター、コーチング）がまだそのエントリに応答していない sync は、不完全な回答を保持しているキャッシュではなく、モデルに再度エントリを送信します。したがって、開発者のローカルモデルが複数形を出力しなかった場合でも、ジョブのホスト型モデル（`SYNC_FLAGS`）が次回の実行時にそれらを要求し、見積もりにもそのコストが反映されます。ロックファイル（`gaps` 配下の `.champollion.lock`）には、複数形なしで応答した各設定が記録されるため、ローカル実行と CI 実行が同じ不完全な回答に対して交互に課金されることはありません。
- **`sync --redo gaps` は、誰が残したかにかかわらず、該当するすべてのエントリに対して再要求を行います** — 上記のワークフローでは、**Run workflow** の下にある `redo_gaps` にチェックを入れてください。より高性能なモデルを使用する場合は、`SYNC_FLAGS` に `--model` を追加します。
- **新しい回答でも複数形が不足している場合、エントリにはマークが残ったまま**となり、実行は前回と同様に `2` で終了します。その場合は手動で複数形を記述し、`# champollion:` の行を削除してください。

ドライラン（`sync --dry`）は再要求対象となるエントリを一覧表示してコストを見積もり、`--json` サマリーには再要求しないエントリ数をカウントして（`totalPluralGaps`）、実際の実行ではそれらにより `2` で終了することを示します（`realRun.exitCode`）。

## その他の方式

以下のスニペットは、各方式に必要なキーとそれぞれの `sync` コマンドを示しています。
これらは上記ワークフローの「Sync translations」ステップの**内部**で使用してください。`env` を置き換え、示されているフラグ（`--method openai` など）をワークフローの `SYNC_FLAGS` 行に追加して（これによりドライランチェックも同じ方式で実行されます）、ステップの残りの部分（`id: sync` および終了コードを記録する行）はそのまま維持します。これにより、部分的な実行であっても翻訳された内容がコミットされ、キャッシュが保存されます。

## Google Translate メソッド

OpenRouter の代わりに組み込みの Google Translate メソッドを使用する場合：

```yaml
- name: Sync translations
  env:
    GOOGLE_TRANSLATE_API_KEY: ${{ secrets.GOOGLE_TRANSLATE_API_KEY }}
  run: npx --yes champollion@0.5 sync
```

## 直接 LLM プロバイダー

`openai`、`anthropic`、または `gemini` メソッドを直接使用する場合：

```yaml
# OpenAI
- name: Sync translations
  env:
    OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
  run: npx --yes champollion@0.5 sync --method openai

# Anthropic
- name: Sync translations
  env:
    ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
  run: npx --yes champollion@0.5 sync --method anthropic

# Gemini (free tier available)
- name: Sync translations
  env:
    GEMINI_API_KEY: ${{ secrets.GEMINI_API_KEY }}
  run: npx --yes champollion@0.5 sync --method gemini
```

## DeepL

```yaml
- name: Sync translations
  env:
    DEEPL_API_KEY: ${{ secrets.DEEPL_API_KEY }}
  run: npx --yes champollion@0.5 sync --method deepl
```

## リモート翻訳 API

リモート翻訳エンドポイント（例：ホスト型翻訳サービス）を使用する場合：

```yaml
- name: Sync translations
  env:
    CHAMPOLLION_API_KEY: ${{ secrets.CHAMPOLLION_API_KEY }}
  run: npx --yes champollion@0.5 sync
```

## デプロイ前のゲート

翻訳を実行することなく、いずれかのロケールが不完全または破損している場合にビルドを失敗させるには、チェックのみを単独で実行します。

:::warning[ゲートは同期の前にではなく、同期の後に実行してください]
マージ後にのみ翻訳が実行される構成（上記ワークフロー）の場合、文字列を追加するプルリクエストにはまだその翻訳が存在しないため、`audit` / `verify` はそのような PR を毎回失敗させてしまいます。ゲートはすでに翻訳が存在する場所で実行してください。すなわち、同期ジョブ後の `main`（`needs: sync`、または同期ワークフローの `on: workflow_run`）です。`push` トリガーは、同期ボット自身のコミットでは起動されません。これらは `GITHUB_TOKEN` でプッシュされるため、ワークフローが開始されないためです（前述参照）。プルリクエストでは、`lint` のみを実行するか、PR ブランチ上で先に同期ジョブを実行してください。
:::

```yaml
jobs:
  i18n-check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 24
      # 1. Hardcoded strings that never reached a locale file (web projects)
      - run: npx --yes champollion@0.5 lint
      # 2. Every key present, nothing empty or left as an [EN] fallback
      - run: npx --yes champollion@0.5 audit
      # 3. Placeholders, ICU plurals, markup and scripts intact. --strict:
      #    warnings fail the build too (an extra or missing plural form, a
      #    source echo, an out-of-date translation pass plain verify).
      - run: npx --yes champollion@0.5 verify --strict
```

| チェック | コマンド | 失敗条件 |
|-------|---------|------------|
| **Lint** | `lint` | ソースコードにロケールファイルに含まれていない文字列がある場合 — またはチェック対象のソースファイルが見つからなかった場合（検索したフォルダ名が表示されます。別の場所を指定する場合は `--src <dir>` を使用します） |
| **Audit** | `audit` | キーが存在しない、空、または `[EN]` フォールバックのままである場合 — または翻訳が**最新ではない**場合: 現在のものより古いソーステキストから作成されている（ソースが編集されたが再翻訳に失敗した） — または複数形メッセージに日常的なカウントで使用される形式が不足している場合（ロシア語の `few`/`many`、`verify --strict` が失敗するエントリ）。再要求を行うコマンドも併せて表示されます |
| **Verify** | `verify` | 翻訳によってプレースホルダー、ICU 複数形、マークアップ（タグの開始、終了、入れ子の不一致）、またはスクリプトが破損した場合 — またはキーが存在しない場合 — または1つのテキストが複数の異なるソース文字列に対して使い回されている場合（モデルが記憶した文を繰り返している） — またはチェック対象が見つからなかった場合（設定が指す場所にソースファイルや locales フォルダが存在しない） |
| **Verify, strict** | `verify --strict` | 上記のいずれか、または何らかの警告がある場合 |

`verify` は何らかのエラーがあれば `1` で終了し、それ以外の場合は `0` で終了します。警告は出力されますがジョブを失敗させることはありません。警告の例としては、ソースの単純なオウム返し（echo）、2つのロケールで同一のテキスト、最新ではない翻訳、ソースの末尾にある `?` や `!` を脱落させた翻訳（一部の言語では疑問符の代わりに助詞で疑問を表します）、および後述の複数形に関する警告などがあります。複数の異なるソース文字列に対して同じテキストが記述されている場合はエラーとなります。これは、明らかに異なる2つの複数単語文字列に対して4単語以上の同一テキストで回答された場合、またはその他の場合に3単語以上で回答された場合です。これはキーの値、各複数形の分岐、ロケールの Markdown ページを対象に、`sync` のゲートが拒否するルールに従ってカウントされます。`verify --strict` はすべての警告を失敗扱いにします。例えば、モデルが出力しなかったロシア語の複数形によってデプロイをブロックしたい場合に使用します。最新ではない翻訳は、`verify` では警告（構造は維持されているため）ですが、`audit`（完全性ゲート）では失敗となり、それらを再翻訳するコマンドが出力されます。

複数形の検出内容は、フォーマットが複数形をどのように格納しているかによって異なります。

| フォーマット | エラー（`verify` が 1 で終了） | 警告（`--strict` 指定時のみ失敗） |
|--------|--------------------------|--------------------------------------|
| i18next 接尾辞キー（`count_one`、`count_other` など） | ロケールに必要な形式が不足している場合（フランス語の `count_many` など）: 不足しているキーとして扱われます。 | ロケールに存在しない形式のキーがある場合（フランス語またはスペイン語の `count_two` など）。`verify` はそれらのキーのみを削除するコマンド（`sync --prune plural-extras`）を出力します。このコマンドなしに sync がそれらを削除することはありません。 |
| ICU メッセージ（next-intl、ARB、i18next ICU における `{count, plural, …}`） | 複数形構造が破損している場合（翻訳された変数、キーワード、セレクター、または `#` の欠落など）。 | ロケールが日常的なカウントで使用する分岐が不足している場合（ロシア語の `few`、`many` など）。大きな数でのみ使用される形式の欠落（1 000 000 に対するフランス語の `many` など）は報告されません。 |
| gettext（`msgid_plural`） | 翻訳がないエントリ（空または `fuzzy`）: 不足しているキーとして扱われます。 | 日常的なカウントに独自の形式を持つ言語において、`other` 形式を繰り返している `msgstr[]` 形式（`# champollion:` コメント付きでマークされます）。カタログの `nplurals` よりも多い `msgstr[]` 行。複数形の形式数はカタログ自体の `Plural-Forms` ヘッダーによってカウントされます。 |

別の形式のテキストから翻訳された i18next 形式は、その形式とまったく同じテキストを保持することがあります（フランス語の `count_many` が `count_other` と同一である場合など）。フランス語ではこの2つが同じように書かれることがあるため、これが警告になることはありません。sync がモデルに形式を要求すると、その結果が回答のフィンガープリントとともに `.champollion.lock` に記録されます。`verify` はその記録のみを読み取るため、コミットをクローンした環境であればどこでも同じ結果が得られます。手元のラップトップのキャッシュと新しい CI ランナーの間で判定が食い違うことはありません。記録のない値（手動で書かれたもの、他のツールで作成されたもの、形式を伝えられない機械翻訳エンジンによるもの、または古いバージョンによるもの）には、再要求を行うコマンドを含む情報行（info line）が表示されます。`--strict` はこれに対して失敗しません。
verify は構造をチェックするものであり、意味をチェックするものではありません。合格したとしても、キー、プレースホルダー、複数形、マークアップ、およびスクリプトが破損していないことを示すだけであり、テキストの内容が正しいことを保証するものではありません。

---

## 関連項目

- [CLI リファレンス](/docs/reference/cli) — コマンドの完全なリファレンス
- [同期の仕組み](/docs/concepts/how-sync-works) — インクリメンタル同期について
- [翻訳メモリ](/docs/concepts/translation-memory) — キャッシュとコスト削減
- [翻訳メソッド](/docs/guides/translation-methods) — 言語ペアごとのメソッド選択
- [品質ゲート](/docs/concepts/quality-gate) — 翻訳が失敗した場合の動作
- [設定](/docs/getting-started/configuration) — 設定リファレンス
