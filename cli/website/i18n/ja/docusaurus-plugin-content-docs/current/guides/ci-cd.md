---
sidebar_position: 3
title: "CI/CD"
---

# CI/CD 統合

ビルドパイプラインでの翻訳を自動化します。

Champollion CLI は [PolyForm Noncommercial License 1.0.0](https://github.com/gamedaysuits/Champollion/blob/main/cli/LICENSE) のもとでソース利用可能（source-available）となっています。非商用目的での使用、変更、共有は無料です。商用目的での使用はこのライセンスの対象外です（[利用対象者について](/docs/getting-started/who-may-use-this)）。

## GitHub Actions: 翻訳の同期を維持する

変更された内容を翻訳し、結果を検証して、コミットし直す完全なワークフローです。Node プロジェクトかどうかにかかわらず、あらゆるプロジェクト（Django、Flutter、Hugo など）で動作します。

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
          npx --yes champollion@0.6 sync $SYNC_FLAGS ${{ inputs.redo_gaps && '--redo gaps' || '' }}
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
        run: npx --yes champollion@0.6 verify --strict
```

**なぜこのようなワークフローの構成になっているのか。** `actions/cache` 単体ではジョブ全体が成功したときにのみキャッシュを保存します。また、`sync` はキーが1つでも拒否されると `2` で終了します。そのため、部分的な実行ではコミットとキャッシュ保存の両方がスキップされ、次回の実行で同じ翻訳に対して再度費用が発生していました。ここではキャッシュの復元と保存を2つのステップ（`actions/cache/restore`、そして `if: always()` を指定した `actions/cache/save`）に分け、同期ステップは `2` で失敗させる代わりに終了コードを記録し、翻訳されたファイルをコミットした後に初めてジョブを失敗させます。これにより、`verify` の前にあるジョブ失敗ステップで理由（`--max-cost` による停止、または同期で翻訳できなかったキー）が表示され、`verify` が未翻訳キーを指摘する形にはなりません。最後のステップは `verify --strict` です。通常の `verify` は警告（余分または不足している複数形など）があっても終了コード 0 で終了しますが、`--strict` は警告があるとジョブを失敗させます。品質ゲートで拒否されたキーは記憶されるため、次回の実行で同じモデルに再度送信されることはありません（同じ回答に対して課金されてしまうため）。同期ログにそのキーの名前と、再要求を行うための `--redo keys:` コマンドが表示されます。

**実行ごとではなく、変更ごとにキャッシュを1つ保存。** 復元ステップでは、ブランチの最新のキャッシュを取得します（その完全一致キー `…-newest` は保存されないため、`restore-keys` により直近のものが選択されます）。保存ステップでは、キャッシュ自体のファイルのハッシュ（`hashFiles('.champollion/**')`）をキーとして使用します。何かを翻訳した実行（部分的な実行やプッシュに失敗した実行を含む）はキャッシュを変更するため、新しいキーが付与されて保存されます。何も追加しなかった実行（翻訳対象なし、すべてキャッシュから取得、`--max-cost` による停止など）は復元したキーのままなので、保存はスキップされ、新しいコピーは保存されません。実行 ID をキーにすると実行ごとに完全なコピーが保存されてしまい、ロックファイルとソースファイルをキーにすると、プッシュが拒否された実行の後に完全一致によって古いコピーが復元されてしまいます（コミットされたロックファイルにその実行の変更が含まれていないため）。

Node プロジェクトでは、`champollion` を開発依存関係として追加し、代わりに `npx champollion sync` を呼び出すことができます。上記の固定された `champollion@0.6` はどのリポジトリでも動作し、意図せず異なるバージョンが取得されることはありません。その場合、ジョブでそれをインストールする必要があります。クリーンなランナーでは、何もインストールされていない状態で `npx champollion` を実行すると、ロックファイルで固定されたバージョンではなく最新バージョンが取得されます。また、インストールによって `node_modules/` が書き込まれ、`.gitignore` に記載されていない限り `git add --all` によってコミットされてしまうため（`champollion init` が作成するものは `.champollion/` のみを記載）、後述の Django ワークフローのようにロケールファイルとロックファイルを名前で指定してステージングしてください：

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

**ロックファイルをコミットしてください。** `.champollion.lock` と `.champollion-content.lock` は、各翻訳がどのソーステキストから作成されたかを記録します。次回の実行で文字列が変更されたかどうかを判断するためにこれらが使用されます。これらを参照できないランナーは、編集された文字列と変更されていない文字列を区別できません。**`.champollion/` はコミットしないでください** — これはマシンごとのキャッシュです。`champollion init` によって `.gitignore` に追加されます。

**`--max-cost`** は、予想以上の費用が発生する前に実行を停止します。通常の1日の変更にかかる費用を目安に設定してください。これで実行が停止された場合、何も翻訳されず書き込まれず、sync は終了コード `2` で終了します。コミットするものはないため、「Stop when the sync was partial（同期が部分的だった場合に停止）」ステップがその旨を表示してジョブを失敗させます。公開価格のない方法（別のマシンにあるセルフホストエンドポイントなど）は見積もりができないため、翻訳対象がある場合は常に `--max-cost` で停止します。これらに対してはオフにしておいてください。ランナー自体で動作するモデル（`localhost`/`127.0.0.1` の `local`）は、API コスト $0 として計算されます。

**ソース文字列を変更するプッシュのみがジョブを開始します。** `paths:` フィルターにはソースロケールファイルと `champollion.config.json` を指定します。コードのみ、あるいは翻訳とロックファイルのみを変更するプッシュには翻訳対象がないため、ジョブは開始されません。2つのロケールパスを、設定ファイルで指定されているファイル（`messages/en.json`、`lib/l10n/app_en.arb` など）に合わせて編集してください。sync で Markdown も翻訳する場合は `contentDir` フォルダーを追加してください。**Run workflow**（`workflow_dispatch` トリガー）を使用すれば、手動での実行も可能です。

**ジョブ自体のコミットによって再度ジョブが開始されることはありません** — そしてそれを止めているのは `paths:` フィルターではありません。コミットステップはワークフローの `GITHUB_TOKEN` を使ってプッシュを行いますが、`GITHUB_TOKEN` によるプッシュはワークフローの実行をトリガーしません（ワークフローが自分自身を開始しないようにするための GitHub の仕様です）。そのため、後述の Django ワークフローでは、ボットのすべてのコミットで変更される `locale/**` を監視できます。代わりにパーソナルアクセストークンや GitHub App トークンを使用してプッシュした場合（ボットのコミットを契機に他のワークフローを開始したい場合など）、そのプッシュによってこのワークフローが再度開始されます。その場合は `paths:` フィルターが実行の有無を判定します。上記のフィルターは翻訳済みファイルとロックファイルを除外しているため、ボットのコミットによって実行が開始されることはありません。Django フィルターの `locale/**` はボットがコミットするカタログを含んでいるため、各コミットによってもう1回実行が開始されます（ただし、翻訳対象が見つからないため何もコミットされません）。そのようなトークンを使用する場合は、ソースカタログ（`locale/en/**`）のみに絞り込み、設定ファイルを通じて言語を追加してください。

**プロバイダーキーは、実行が開始されるたびに必要です**（翻訳が必要なものがない場合も含みます）。sync は変更箇所を確認する前に、その方法が実行可能かどうかを検証します。ソースの変更がない状態で手動実行された場合でも、`OPENROUTER_API_KEY` シークレット（または使用する方法のキー）がなければ失敗します。`local` はキーを必要としませんが、ランナーにはモデルサーバーがありません。開発者のマシン上で `local` を使って翻訳しているプロジェクトでは、CI ではホストされた方法（`--method` / `--model` — 上記ワークフローのコメントアウトされた `SYNC_FLAGS` 行）を指定します。翻訳を行わずにシークレットがステップに届いているか確認するには、`sync --dry` を使用します。実際の実行で停止する場合に警告を発し、不足している環境変数の名前を表示します（プレビューであるため、終了コードは 0 です）。これは環境変数が**設定されているか**を確認するものであり、キーが**有効か**を確認するものではありません。何も送信しないため、空でない値（プレースホルダーでも）であれば通過します。誤ったキーや無効化されたキーは、実際の実行の最初のリクエストで判明します（エラーメッセージに HTTP 401 などのプロバイダーの応答が表示されます）。何かが実行される前にキーの不足によってジョブを失敗させるには、[同期前のチェック](#check-before-sync) を追加してください。

**キャッシュは方法（method）ごとに保持されます。** 翻訳は、それを作成した方法、レジスター（文体）、コーチングファイルの下にキャッシュされます（同じ方法の異なるモデルであれば再利用されます — モデルの引き継ぎ）。そのため、`local` を使用する開発者とホスト型モデルを使用する CI がキャッシュエントリを共有することはありません。また、CI のキャッシュは独立しています（`.champollion/` はコミットされません）。これは CI がプロジェクト全体を再翻訳するという意味ではありません。コミットされたロックファイルとともにロケールファイルに既に存在するものは、完了したものとみなされます。CI では、前回のコミット以降に新規追加または変更された文字列（開発者がローカルで翻訳したもののコミットしなかった文字列を含む）についてのみホスト型モデルの費用が発生し、それ以外の文字列には費用は発生しません。ホスト型モデルでプロジェクト全体を再翻訳する場合（`--redo all`）は、すべての文字列に対して1度だけ課金されます。

プッシュ時ではなく**スケジュール実行**にする場合：`on:` ブロックを `schedule: [{ cron: '0 6 * * *' }]` に置き換えてください。

### 同期前のチェック: ジョブを早期に失敗させる {#check-before-sync}

ドライランは何が見つかっても `0` で終了します（プレビューであるため）。そのため、`sync --dry --max-cost 5` は実際の実行が上限で停止することを警告しつつも、CI ステップとしては成功してしまいます。実際の実行で停止するような場合（キーの不足や `--max-cost`）にジョブを失敗させるには、`sync --dry --json` の要約出力を読み取ります。この出力は1行につき1つの JSON オブジェクト（NDJSON）であり、それぞれに `level` が含まれます。標準出力には `info`、`ok`、`event` の行が出力され、標準エラー出力には `warn` と `error` の行が出力されます。そして標準出力の最後の行が要約である `{"level": "summary", "command": "sync", …}` です。レベルによってこれを選択してください。**同期と同じフラグで実行してください**。フラグがないと設定ファイルに記載された方法がチェックされてしまうため、設定に `local` と書かれているプロジェクトでは、ジョブが実行するホスト型モデルではなくローカルの方法がチェックされ、キーのないランナーでも成功してしまいます。上記ワークフローの「Sync translations」の前のステップとして、同じ `SYNC_FLAGS` を読み取ります：

```yaml
      - name: Check the sync can run (translates nothing)
        env:
          OPENROUTER_API_KEY: ${{ secrets.OPENROUTER_API_KEY }}
        # The JSON lines go to $out; the warnings (stderr) stay in the log.
        # When the check fails, the step prints why: the summary's
        # realRun.reasons, or its error when sync could not run at all
        # (that exit code is not fatal here — the summary is read instead).
        run: |
          out=$(npx --yes champollion@0.6 sync --dry $SYNC_FLAGS --json) || true
          if ! printf '%s\n' "$out" | jq -e 'select(.level == "summary") | .preflight.ready and (.maxCost.wouldStop | not)' > /dev/null; then
            printf '%s\n' "$out" | jq -r 'select(.level == "summary") | "::error::" + (.error // "A real sync would exit \(.realRun.exitCode): \(.realRun.reasons | join("; "))")'
            exit 1
          fi
```

またはシェルで、同期の行と同じフラグを明記して実行します：

```bash
SYNC_FLAGS="--method llm --model google/gemini-3.8-flash --max-cost 5"
out=$(npx --yes champollion@0.6 sync --dry $SYNC_FLAGS --json)
printf '%s\n' "$out" | jq -e 'select(.level == "summary") | .preflight.ready and (.maxCost.wouldStop | not)' > /dev/null \
  || printf '%s\n' "$out" | jq -r 'select(.level == "summary") | .error // "A real sync would exit \(.realRun.exitCode): \(.realRun.reasons | join("; "))"'
```

`preflight.ready` は、翻訳対象の有無にかかわらず、その方法に必要なキーが不足している（未設定または空 — 誤っている場合ではありません）場合に `false` になります。ホスト型の方法はキーがなければ準備完了になりません。`maxCost.wouldStop`（`--max-cost` 指定時に存在）は、実際の実行が上限で停止する場合に `true` になります。`jq -e` はそのいずれの場合も終了コード 1 で終了し、ステップはジョブログに理由を出力します。例えば `A real sync would exit 1: it would stop before translating: No OpenRouter API key (OPENROUTER_API_KEY) for en:fr`, or `A real sync would exit 2: --max-cost would stop it before any API call (Estimated translation cost exceeds the --max-cost cap: estimate ~$7.1200, cap $5.0000)` のようになります。sync がまったく実行できない場合（設定ファイルの破損など）、ステップは代わりに要約の `error` を出力します。このステップは標準エラー出力を `/dev/null` にリダイレクトしないため、警告もログに残ります。要約の `realRun.exitCode` は、プレビューで判別できる範囲で、実際の実行がどのような終了コードになるかを示します。事前チェックで停止する場合は `1`、`--max-cost` で停止する場合や部分的に終了する場合（保留されたキー、または言語で使用される形式が不足しているディスク上の複数形メッセージ。どちらであるかは `realRun.reasons` に記載）は `2` になります。実際の実行でしか検出できない品質ゲートによる拒否によって、`0` が `2` に変わることもあります。部分的な実行が予測される場合にもチェックを失敗させたい場合は、`.preflight.ready and (.maxCost.wouldStop | not)` の代わりに `.realRun.exitCode == 0` を指定してください。

### 保護された main ブランチ: プルリクエストを提案する

上記のワークフローは翻訳を直接 `main` にプッシュします。`main` が保護されている場合（レビューやステータスチェックが必須の場合）、同期が実行された後にそのプッシュは拒否され、すでに翻訳の費用が発生してしまいます。ただし、費用が再度発生することはありません。ステップが失敗した場合でもコミットステップの前にキャッシュが保存されるため、ジョブを再実行するか次回のプッシュを行うと（それぞれ `restore-keys` を通じてブランチの最新キャッシュを復元します）、キャッシュから提供されます。ロックファイルは `main` に届いていないため、次回の実行でも同じ文字列が変更されたと認識されて再度書き込まれますが、これはキャッシュから行われるため費用はかかりません。

保護された `main` では、ボットが所有するブランチにコミットし、代わりにプルリクエストを作成（または更新）してください。上記のワークフローを維持しつつ、パーミッションとコミットステップの2点を変更します。

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

**使い分けの基準。** ワークフローからプッシュすることが許可されている場合（ブランチ保護がない、または GitHub Actions によるバイパスを許可するルールがある場合）は `main` に直接プッシュします。`main` が保護されている場合や、リリース前にその言語の話者（人間）が翻訳を確認する必要がある場合は、プルリクエストを作成してください。

- ブランチはボットが所有します。プルリクエストがマージされるまで、`main` のロックファイルにはその翻訳が含まれていないため、実行のたびにすべての変更が再度提案されます（ただしキャッシュから行われるため、課金されるのはそれ以降に変更された文字列のみです）。そのブランチにプッシュされた編集内容は次回の実行で上書きされます。プルリクエスト内でレビューしてマージした後に、`main` 上で編集を行ってください（後からの大規模なやり直しの際にも、人間による編集内容は維持されます）。
- リポジトリで Actions によるプルリクエストの作成を許可する必要があります：Settings → Actions → General → 「Allow GitHub Actions to create and approve pull requests」。
- ワークフローの `GITHUB_TOKEN` で作成されたプルリクエストは他のワークフローを起動しないため、必須のステータスチェックが実行されません。`main` でステータスチェックが必須とされている場合は、GitHub App トークンやシークレットとして保持した fine-grained トークン（`GH_TOKEN: ${{ secrets.<name> }}`）を使用して作成するか、コミット、ブランチの更新、オープン中のプルリクエストの編集を行ってくれる `peter-evans/create-pull-request` などのアクションを使用してください（同様にトークンを渡します）。

### gettext (Django, Babel) と Flutter

Sync は既存のカタログを翻訳します。コードから文字列を抽出することはありません。Django プロジェクトでは、同期ステップの前にカタログを更新し、同期後にカタログがコンパイルできるかチェックして、カタログのみをコミットします。

`makemessages` と `compilemessages` はどちらも設定をインポートするため、ジョブではすべてのステップに必要なものを1度設定します（設定モジュールがインポート時に読み取る環境変数 `SECRET_KEY`、`DATABASE_URL` など）。どちらのコマンドもデータベースにはアクセスしないため、これらにはプレースホルダー値で十分です。`DJANGO_SETTINGS_MODULE` はコメントアウトされています。`startproject` が書き込む `manage.py` が独自に設定を行い、ジョブで設定された値がそれを上書きしてしまうため、モジュール名が間違っていると `makemessages` が動作しなくなります。お使いの `manage.py` で設定されていない場合にのみ設定してください。

この `paths:` フィルターは上記のワークフローとは異なります。ソース文字列は Python コードやテンプレート内に存在し、ジョブ内で `makemessages` がそれらを抽出するため、コードの変更によって新しい文字列が追加される可能性があります。プッシュごとに Python コードが変更される場合は、パターンをアプリケーション（`myapp/**.py`）に絞り込んでください。また、`locale/**` も監視します。新しい言語は新しいカタログフォルダー（`makemessages -l <code>`）として追加されるためです。ボット自身のコミットによってこれらのカタログは変更されますが、`GITHUB_TOKEN` を使用してプッシュされるため、実行は開始されません（前述の「**ジョブ自体のコミットによって再度ジョブが開始されることはありません**」、および別のトークンでプッシュする場合の絞り込み方法を参照してください）。

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
          npx --yes champollion@0.6 sync $SYNC_FLAGS ${{ inputs.redo_gaps && '--redo gaps' || '' }}
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
        run: npx --yes champollion@0.6 verify --strict
```

`--all` は既存のすべてのカタログを更新します。新しい言語の追加は `makemessages -l <code>`（または `champollion init --langs <code>`）で1度だけ行います。`makemessages` はドメインごとに1回実行します（Python とテンプレート用には `django`、JavaScript 用には `djangojs`（`-d djangojs`））。Sync は見つかったすべてのドメインのカタログを翻訳します。最後のステップで `verify --strict` を実行します。翻訳に `few` や `many` の形式が欠けているロシア語の複数形エントリは、`other` の形式で書き込まれ、`# champollion:` のフラグが付けられます。そのようなエントリがカタログにある間（それを書き込んだ同期と、それ以降のすべての同期。保留されたキーの場合と同様）、すべての sync は終了コード `2` で終了し、その要約に対象エントリと再要求コマンドが表示されます。その結果、同期後の検証行には `[OK]` ではなく不完全である旨が表示されます。そのため、「Stop when the sync was partial」ステップによって、それらの形式が書き込まれるまでコミット後にジョブが失敗します。単体で実行した場合、これは警告扱いとなります。通常の `verify` は終了コード 0 で終了しますが、`--strict` は失敗します。`audit` も同様のエントリを不完全としてカウントします。

`compilemessages` は `msgfmt --check-format` を実行します。これは各 `%(name)s` の型が維持されているかもチェックしますが、`#, python-format` フラグが付いたエントリに対してのみ行われます。`makemessages` は `%` プレースホルダーを含む抽出エントリにそのフラグを追加します。手動で作成されたカタログにはフラグがない場合があり、そのエントリはチェックされません。`champollion verify` はフラグにかかわらず、すべてのエントリの printf プレースホルダー（名前と型文字）を比較し、sync は翻訳する各エントリにソースエントリのフラグを保持します。コミットステップでは、`*.po` と `.champollion.lock` を名前で指定してステージングします（置き換えられた編集の記録がある場合はそれも含む）。プロジェクトで `.mo` ファイルを追跡している場合は、そこに `'*.mo'` を追加してください。キャッシュのステップ、記録された終了コード、`git pull --rebase` は、上記のワークフローと同じ理由で配置されています。Babel の場合：同期前に `pybabel extract` + `pybabel update --no-wrap`、同期後に `pybabel compile` を実行します。

Flutter では、このジョブ内での特別なステップは不要です。sync が `app_<locale>.arb` ファイルを書き出し、アプリ自身のビルドステップである `flutter gen-l10n`（またはそれを実行する `flutter build`）でそれらを Dart に変換します。

#### モデルによって省略された複数形 {#plural-gaps}

フラグが付けられたエントリは完全な翻訳ではないため、sync はそれを人間の手作業だけに委ねることはしません：

- **別の方法やモデルが自動的に再要求を行います。** その構成（方法、モデル、レジスター、コーチング）でまだそのエントリに応答していない sync は、不完全な回答を保持しているキャッシュには送らず、再度モデルに送信します。そのため、開発者のローカルモデルで形式が欠落していた場合でも、ジョブのホスト型モデル（`SYNC_FLAGS`）が次回の実行時にそれらを要求し、見積もりにその費用が反映されます。ロックファイル（`.champollion.lock` の `gaps` 配下）には、形式を欠いたまま回答した構成が記録されるため、ローカル実行と CI 実行が同じ不完全な回答に対して交互に費用を支払うことはありません。
- **`sync --redo gaps` は、誰が残したかにかかわらず、そのようなすべてのエントリを再要求します** — 上記のワークフローでは、**Run workflow** の下の `redo_gaps` にチェックを入れてください。より強力なモデルを使用する場合は、`SYNC_FLAGS` に `--model` を追加してください。
- **新しい回答でも形式が不足している場合、エントリにはフラグが付いたままとなり**、実行は以前と同様に `2` で終了します。その場合は手作業で形式を記述し、`# champollion:` の行を削除してください。

ドライラン（`sync --dry`）は再要求するエントリの名前を表示して見積もりを出します。その `--json` 要約は再要求しないエントリをカウントし（`totalPluralGaps`）、実際の実行ではそれらによって終了コード `2` で終了する旨（`realRun.exitCode`）を示します。

## その他の方法

以下のスニペットは、各方法に必要なキーと、それぞれの `sync` コマンドを示しています。
これらは上記ワークフローの「Sync translations」ステップの**内部**で使用してください。その `env` を差し替え、示されているフラグ（`--method openai` など）をワークフローの `SYNC_FLAGS` の行に配置します（ドライランのチェックでも同じ方法が実行されるようにするため）。そしてステップの残りの部分（`id: sync` および終了コードを記録する行）はそのまま残し、部分的な実行であっても翻訳された内容がコミットされキャッシュが保存されるようにしてください。

## Google Translate による方法

OpenRouter の代わりに組み込みの Google Translate による方法を使用する場合：

```yaml
- name: Sync translations
  env:
    GOOGLE_TRANSLATE_API_KEY: ${{ secrets.GOOGLE_TRANSLATE_API_KEY }}
  run: npx --yes champollion@0.6 sync
```

## 直接指定の LLM プロバイダー

`openai`、`anthropic`、または `gemini` の方法を直接使用する場合：

```yaml
# OpenAI
- name: Sync translations
  env:
    OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
  run: npx --yes champollion@0.6 sync --method openai

# Anthropic
- name: Sync translations
  env:
    ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
  run: npx --yes champollion@0.6 sync --method anthropic

# Gemini (free tier available)
- name: Sync translations
  env:
    GEMINI_API_KEY: ${{ secrets.GEMINI_API_KEY }}
  run: npx --yes champollion@0.6 sync --method gemini
```

## DeepL

```yaml
- name: Sync translations
  env:
    DEEPL_API_KEY: ${{ secrets.DEEPL_API_KEY }}
  run: npx --yes champollion@0.6 sync --method deepl
```

## リモート翻訳 API

リモート翻訳エンドポイント（ホストされた翻訳サービスなど）を使用する場合：

```yaml
- name: Sync translations
  env:
    CHAMPOLLION_API_KEY: ${{ secrets.CHAMPOLLION_API_KEY }}
  run: npx --yes champollion@0.6 sync
```

## デプロイ前のゲート

何も翻訳することなく、いずれかのロケールが不完全または破損している場合にビルドを失敗させるには、チェックのみを単独で実行します。

:::warning[ゲートは同期の前ではなく、後に実行してください]
マージ後にのみ翻訳を実行する場合（上記のワークフロー）、文字列を追加したプルリクエストにはまだその翻訳が存在しないため、`audit`/`verify` はそのような PR をすべて失敗させてしまいます。翻訳が既に存在する場所でゲートを実行してください。具体的には同期ジョブの後（同期ワークフローの `needs: sync` または `on: workflow_run`）に `main` 上で実行します。同期ボット自身のコミットはワークフローを開始しない `GITHUB_TOKEN` でプッシュされるため、`push` トリガーは起動しません（上記参照）。プルリクエストでは `lint` のみを実行するか、PR ブランチ上で先に同期ジョブを実行してください。
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
      - run: npx --yes champollion@0.6 lint
      # 2. Every key present, nothing empty or left as an [EN] fallback
      - run: npx --yes champollion@0.6 audit
      # 3. Placeholders, ICU plurals, markup and scripts intact. --strict:
      #    warnings fail the build too (an extra or missing plural form, a
      #    source echo, an out-of-date translation pass plain verify).
      - run: npx --yes champollion@0.6 verify --strict
```

| チェック | コマンド | 失敗条件 |
|-------|---------|------------|
| **Lint** | `lint` | ソースコード内にロケールファイルに存在しない文字列がある場合 — またはチェック対象のソースファイルが見つからなかった場合（検索したフォルダーが表示されます。`--src <dir>` で別の場所を指定してください） |
| **Audit** | `audit` | キーが存在しない、空である、または `[EN]` フォールバックのままである場合 — または翻訳が**最新ではない**場合：現在のソーステキストよりも古いものから作成されている（ソースの編集後に再翻訳が失敗したなど） — または複数形メッセージに言語で日常的なカウントに使用される形式が不足している場合（ロシア語の `few`/`many`、`verify --strict` が失敗するエントリ）。再要求を行うコマンドも併せて表示されます |
| **Verify** | `verify` | 翻訳によってプレースホルダー、ICU 複数形、マークアップ（タグの開始・終了・ネストの違い）、または文字体系が破損している場合 — またはキーが存在しない場合 — または1つのテキストが複数の異なるソース文字列の代わりに使用されている場合（モデルが記憶した文を繰り返している状態） — またはチェック対象が見つからなかった場合（設定が指している場所にソースファイルやロケールフォルダーが存在しない） |
| **Verify, strict** | `verify --strict` | 上記のいずれか、または任意の警告がある場合 |

`verify` はエラーがある場合は `1` で終了し、それ以外は `0` で終了します。警告は表示されますがジョブは失敗しません。警告の例としては、ソースのエコーバック、2つのロケールでテキストが同一であること、最新ではない翻訳、ソースの末尾の `?` や `!` が翻訳で脱落していること（一部の言語では疑問を記号ではなく小辞で表します）、後述の複数形に関する警告などがあります。複数の異なるソース文字列に対して同じ1つのテキストが書き込まれている場合はエラーとなります。これは、明らかに異なる複数の単語からなる文字列に対して4単語以上の同一テキストで回答された場合、またはその他の場合に3単語以上で回答された場合を指します。これは `sync` のゲートで拒否されるルールに従い、キーの値、各複数形の分岐、ロケールの Markdown ページ全体でカウントされます。`verify --strict` はすべての警告をエラー（失敗）扱いにします。例えば、モデルによって省略されたロシア語の複数形形式によってデプロイをブロックしたい場合に使用してください。最新ではない翻訳は、`verify` では警告（構造は損なわれていないため）ですが、`audit`（完全性ゲート）では失敗となり、再翻訳を行うためのコマンドが表示されます。

複数形に関する検出結果は、フォーマットが複数形をどのように保存しているかによって異なります：

| フォーマット | エラー (`verify` は終了コード 1) | 警告 (`--strict` でのみ失敗) |
|--------|--------------------------|--------------------------------------|
| i18next のサフィックス付きキー (`count_one`, `count_other`, …) | ロケールに必要な形式が不足している場合（フランス語の `count_many`）：未翻訳キーとして扱われます。 | ロケールに存在しない形式のキーがある場合（フランス語やスペイン語の `count_two`）。`verify` はそれらのキーを正確に削除するコマンド `sync --prune plural-extras` を出力します。sync がこれなしで勝手に削除することはありません。 |
| ICU メッセージ (next-intl, ARB, i18next ICU の `{count, plural, …}`) | 複数形の構造が破損している場合（翻訳された変数、キーワード、セレクター、失われた `#`）。 | ロケールで日常的なカウントに使用される分岐が不足している場合（ロシア語の `few`, `many`）。大きな数字にのみ使用される形式の不足（フランス語の 1 000 000 に対する `many` など）は報告されません。 |
| gettext (`msgid_plural`) | 翻訳のないエントリ（空または `fuzzy`）：未翻訳キーとして扱われます。 | 日常的なカウント用の固有の形式が存在する言語において、`other` の形式を繰り返している `msgstr[]` 形式（`# champollion:` コメント付き）。カタログの `nplurals` よりも `msgstr[]` 行が多い場合。複数形の形式はカタログ自身の `Plural-Forms` ヘッダーによってカウントされます。 |

別の形式のテキストから翻訳された i18next の形式には、まったく同じ形式のテキストが含まれる場合があります（フランス語の `count_many` が `count_other` と同じ場合など）。フランス語では両者を同じように記述することがあるため、これが警告になることはありません。sync がモデルに形式を要求すると、その情報が回答のフィンガープリントとともに `.champollion.lock` に記録されます。`verify` はその記録のみを読み取るため、あるコミットのどのクローンでも同じ結果が得られます。ノート PC のキャッシュと新しい CI ランナーで判定が食い違うことはありません。記録のない値（手作業、別のツール、形式を指示できない機械翻訳エンジン、または古いバージョンによって記述されたもの）には、再要求を行うコマンドとともに info 行が出力されます。`--strict` はこれによって失敗することはありません。Verify は構造をチェックするものであり、意味をチェックするものではありません。合格したとしても、キー、プレースホルダー、複数形、マークアップ、文字体系が破損していないことを示すだけで、テキストが正しい内容を表していることを保証するものではありません。

---

## 関連情報

- [CLI リファレンス](/docs/reference/cli) — コマンドの完全なリファレンス
- [同期の仕組み](/docs/concepts/how-sync-works) — 増分同期の理解
- [翻訳メモリ](/docs/concepts/translation-memory) — キャッシュとコスト削減
- [翻訳方法](/docs/guides/translation-methods) — 言語ペアごとの方法の選択
- [品質ゲート](/docs/concepts/quality-gate) — 翻訳が失敗したときの動作
- [設定](/docs/getting-started/configuration) — 設定リファレンス
