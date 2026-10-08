---
sidebar_position: 3
title: "CI/CD"
---

# CI/CD 集成

在构建管道中自动化翻译。

champollion CLI 基于 [PolyForm Noncommercial License 1.0.0](https://github.com/gamedaysuits/Champollion/blob/main/cli/LICENSE) 开放源码：可免费用于非商业用途的使用、修改和共享。用于商业目的不受此许可证保护（[谁可以使用](/docs/getting-started/who-may-use-this)）。

## GitHub Actions：保持翻译同步

一个完整的工作流：翻译发生变更的内容、检查结果并提交回仓库。它适用于任何项目——无论是否基于 Node（Django、Flutter、Hugo 等）。

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

**工作流采用此结构的原因。** 仅使用 `actions/cache` 本身时，只有整个作业成功才会保存缓存，而每当有任何键被拒绝时，`sync` 就会以 `2` 退出——因此部分成功的运行过去既会跳过提交，又会跳过缓存保存，导致下一次运行再次为相同的翻译付费。在此工作流中，缓存的恢复和保存分为两个步骤（先执行 `actions/cache/restore`，然后是带有 `if: always()` 的 `actions/cache/save`），同步步骤记录其退出代码而不是因 `2` 直接失败，提交已翻译的文件，只有在这之后作业才会失败——在作业自己的步骤中、且在 `verify` 之前，因此失败的步骤会明确指出原因（`--max-cost` 停止，或同步未能翻译的键），而不是由 `verify` 指出缺失的键。最后一步是 `verify --strict`：普通的 `verify` 遇到警告（包括多出或缺失复数形式）时以 0 退出，而 `--strict` 会因这些警告导致作业失败。被质量闸门（quality gate）拒绝的键会被记录：下一次运行不会将其再次发送给同一个模型（否则会为相同的答案再次付费）——同步日志会指出该键以及用于重新请求翻译的 `--redo keys:` 命令。

**每次变更保留一份缓存副本，而非每次运行。** 恢复步骤会还原该分支最新的缓存（其确切键名 `…-newest` 从不被保存，因此 `restore-keys` 会匹配最新的一个）。保存步骤根据缓存文件自身的哈希值作为键（`hashFiles('.champollion/**')`）：执行了翻译的运行——即使是部分运行，或推送失败的运行——更改了缓存，因此会获得新键并予以保存；未添加任何内容的运行（无可翻译内容、全部命中缓存、触发 `--max-cost` 停止）其键与恢复的键一致，因此会跳过保存且不存储新副本。以运行 ID 作为键会在每次运行时都保存一份完整副本；而在推送被拒绝后，以锁文件和源文件作为键则会通过完全匹配恢复较旧的副本，因为提交的锁文件从未包含那次运行的变更。

在 Node 项目中，你可以将 `champollion` 添加为开发依赖并改用 `npx champollion sync`；上面固定的 `champollion@0.5` 则适用于任何仓库，绝不会意外拉取到不同版本。随后作业必须安装它：在全新的 runner 上，未安装任何依赖时直接运行 `npx champollion` 会获取最新版本，而非锁文件固定的版本。并且安装操作会写入 `node_modules/`，除非你的 `.gitignore` 包含了它，否则 `git add --all` 会将其提交（`champollion init` 创建的忽略文件仅列出 `.champollion/`），因此请按名称暂存语言环境文件和锁文件，如下面的 Django 工作流所示：

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

**提交锁文件。** `.champollion.lock` 和 `.champollion-content.lock` 记录了每条翻译基于哪份源文本生成。下一次运行正是通过它们获知字符串发生了变更。从未见过这些文件的 runner 无法区分修改过的字符串与未改动的字符串。**请勿提交 `.champollion/`**——它是机器本地的缓存；`champollion init` 会将其添加到 `.gitignore` 中。

**`--max-cost`** 会在运行支出超出预期之前将其停止；可将其设置为平时一天的正常变更成本。当它停止某次运行时，尚未进行任何翻译或写入，sync 会以代码 `2` 退出：没有需要提交的内容，并且“Stop when the sync was partial”步骤会报错终止作业，并给出相应提示。对于未公开价格的方法（另一台机器上的自建端点），无法预估成本，因此只要有需要翻译的内容，`--max-cost` 就会停止——对于这些方法请不要开启该参数。直接在 runner 本身托管的模型（位于 `localhost`/`127.0.0.1` 的 `local`）API 成本计为 $0。

**仅当推送更改了源字符串时才启动作业。** `paths:` 过滤器列出了源语言环境文件和 `champollion.config.json`：仅更改代码，或仅更改翻译和锁文件的推送没有需要翻译的内容，因此不会启动作业。请将这两个语言环境路径修改为你配置中指定的文件（`messages/en.json`、`lib/l10n/app_en.arb` 等）；当 sync 同时翻译 Markdown 时，请添加你的 `contentDir` 目录。**Run workflow**（`workflow_dispatch` 触发器）仍支持手动运行。

**作业自身的提交绝不会再次触发自身**——而且并非靠 `paths:` 过滤器来阻止的。提交步骤使用工作流的 `GITHUB_TOKEN` 进行推送，而使用 `GITHUB_TOKEN` 发起的推送绝不会触发工作流运行（GitHub 的规则，用于防止工作流无限循环触发自身）。这就是为什么下面的 Django 工作流可以监听 `locale/**`，而机器人的每次提交都会修改该文件。如果改用个人访问令牌（PAT）或 GitHub App 令牌进行推送（例如为了在机器人的提交上触发其他工作流），该推送就会再次触发此工作流；此时便由 `paths:` 过滤器发挥过滤作用。上面的过滤器排除了已翻译的文件和锁文件，因此机器人的提交不会启动运行。Django 过滤器的 `locale/**` 包含了机器人提交的语言包（catalogs），因此其每次提交都会多触发一次运行——但该运行会发现没有需要翻译的内容，因而不会提交任何东西。若使用此类令牌，请将其范围缩小至源语言包（`locale/en/**`），并通过配置文件添加语言。

**每次启动运行都需要提供服务商密钥**，即使没有需要翻译的内容也是如此：sync 在检查变更内容之前会先校验该方法是否可用。在没有源变更的情况下手动启动的运行，若缺少 `OPENROUTER_API_KEY` 密钥（或你所用方法的密钥）仍会失败。`local` 不需要密钥，但 runner 上没有模型服务器：在开发者机器上使用 `local` 进行翻译的项目，在 CI 中需要指定托管方法（`--method` / `--model`——即上述工作流中注释掉的 `SYNC_FLAGS` 行）。若要检查机密（secret）是否传递到了该步骤而不进行任何翻译，`sync --dry` 会在实际运行可能停止时发出警告，并指出缺失的变量（它仍以 0 退出——试运行仅作为预览）。它只检查变量是否**已设置**，而不验证密钥是否**有效**：因为它不会发送任何内容，所以任何非空值都能通过——占位符也一样。错误或已撤销的密钥会在实际运行的第一次请求时报错（错误信息会指明服务商的响应，如 HTTP 401）。若要在运行任何操作之前因密钥缺失直接让作业失败，请添加[同步前的检查](#check-before-sync)。

**缓存按方法独立保存。** 翻译项会根据生成它的方法、语域（register）和指导文件（coaching file）进行缓存（同一方法的不同模型可以复用——即模型继承/carry-over）。因此，使用 `local` 翻译的开发者与使用托管模型翻译的 CI 绝不会共享缓存项——况且 CI 的缓存本来就是独立的（`.champollion/` 不会被提交）。这并不意味着 CI 会重新翻译整个项目：语言环境文件中已有且锁文件已提交的内容均视为已完成。CI 仅为自上次提交以来新增或修改的字符串向托管模型付费——包括开发者在本地翻译但未提交的字符串——其余内容无需付费。使用托管模型重新翻译整个项目（`--redo all`）会对每个字符串计费一次。

**定时调度运行**而非在推送时运行：将 `on:` 块替换为 `schedule: [{ cron: '0 6 * * *' }]`。

### 同步前的检查：提前使作业失败 {#check-before-sync}

试运行无论发现什么都会以 `0` 退出——它只是一次预览——因此 `sync --dry --max-cost 5` 会发出实际运行将因达到上限而停止的警告，但在 CI 步骤中仍会通过。若要在实际运行可能停止时让作业直接失败（缺少密钥或达到 `--max-cost`），可读取 `sync --dry --json` 的摘要。其输出为每行一个 JSON 对象（NDJSON），每个对象都带有一个 `level`——stdout 包含 `info`、`ok` 和 `event` 行，stderr 包含 `warn` 和 `error` 行——最后一行 stdout 是摘要 `{"level": "summary", "command": "sync", …}`。
按其级别进行过滤。**运行时需使用与同步完全相同的标志**：若缺少这些标志，它将检查配置指定的方法，因此对于配置中写有 `local` 的项目，它会检查本地方法——而非作业所运行的托管模型——并在没有密钥的 runner 上直接通过。作为上述工作流中“Sync translations”之前的一个步骤，它读取相同的 `SYNC_FLAGS`：

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

或者在 shell 中显式写出标志——与同步命令中的标志保持一致：

```bash
SYNC_FLAGS="--method llm --model google/gemini-3.8-flash --max-cost 5"
out=$(npx --yes champollion@0.5 sync --dry $SYNC_FLAGS --json)
printf '%s\n' "$out" | jq -e 'select(.level == "summary") | .preflight.ready and (.maxCost.wouldStop | not)' > /dev/null \
  || printf '%s\n' "$out" | jq -r 'select(.level == "summary") | .error // "A real sync would exit \(.realRun.exitCode): \(.realRun.reasons | join("; "))"'
```

当方法所需的密钥缺失（未设置或为空——并非指密钥错误）时，无论是否有内容需要翻译，`preflight.ready` 均为 `false`：托管方法在没有密钥的情况下绝不可用。`maxCost.wouldStop`（带有 `--max-cost` 时存在）在实际运行会因达到成本上限而停止时为 `true`。遇到这两种情况，`jq -e` 都会以 1 退出，随后该步骤会在作业日志中打印原因——例如 `A real sync would exit 1: it would stop before translating: No OpenRouter API key (OPENROUTER_API_KEY) for en:fr`, or `A real sync would exit 2: --max-cost would stop it before any API call (Estimated translation cost exceeds the --max-cost cap: estimate ~$7.1200, cap $5.0000)`。当 sync 完全无法运行时（配置损坏），该步骤会转而打印摘要的 `error`。该步骤不会将 stderr 重定向到 `/dev/null`，因此警告信息也会保留在日志中。在预览能够判定的范围内，摘要的 `realRun.exitCode` 说明了实际运行退出的退出代码：预检阻止时为 `1`，`--max-cost` 阻止或运行部分完成时为 `2`——例如键被保留，或磁盘上的复数消息缺少该语言所使用的某种形式（`realRun.reasons` 会指明是哪种情况）。质量闸门拒绝（只有实际运行才能发现）仍可能将 `0` 变为 `2`。若希望在预测到部分运行时也让检查失败，请将 `.preflight.ready and (.maxCost.wouldStop | not)` 替换为 `.realRun.exitCode == 0`。

### 受保护的 main 分支：发起拉取请求（Pull Request）

上述工作流会将翻译直接推送到 `main`。如果 `main` 受保护（需要审查或状态检查），该推送将被拒绝——且由于是在同步执行之后拒绝的，翻译费用已经产生。不过这些费用不会再次产生：在提交步骤之前缓存就已经保存，即使某个步骤失败也是如此，因此重新运行作业或进行下一次推送（每次都会通过 `restore-keys` 还原分支最新的缓存）都会直接从缓存中提供结果。由于锁文件从未推送到 `main`，因此下一次运行会发现相同的字符串有改动并重新写入——直接取自缓存，零成本。

在受保护的 `main` 上，改为提交到机器人专属的分支，并创建（或更新）一个拉取请求。保留上述工作流并更改两处：权限配置和提交步骤。

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

**适用场景。** 当工作流允许直接推送到 `main` 时（无分支保护，或有规则允许 GitHub Actions 绕过保护），直接推送到该分支。当 `main` 受保护，或者在发布前需要人工（该语言的使用者）审阅翻译时，发起拉取请求。

- 该分支归机器人所有。在拉取请求合并之前，`main` 的锁文件不包含其翻译，因此每次运行都会再次提出整套翻译——直接取自缓存，所以仅对自那之后发生更改的字符串计费。推送到该分支的编辑会被下一次运行覆盖：请在拉取请求中审阅、合并，然后直接在 `main` 上编辑（后续批量重新翻译会保留人工编辑）。
- 仓库必须允许 Actions 创建拉取请求：Settings → Actions → General → “Allow GitHub Actions to create and approve pull requests”。
- 使用工作流的 `GITHUB_TOKEN` 创建的拉取请求不会触发其他工作流，因此必需的状态检查绝不会在其上运行。如果 `main` 要求这些检查，请使用 GitHub App 令牌或作为机密保存的细粒度令牌（`GH_TOKEN: ${{ secrets.<name> }}`）来创建拉取请求，或使用诸如 `peter-evans/create-pull-request` 之类的 action，它会代你提交、更新分支并编辑开启的拉取请求（以相同方式传入令牌）。

### gettext（Django、Babel）与 Flutter

Sync 会翻译已存在的语言包；它不会从代码中提取字符串。Django 项目会在同步步骤之前刷新语言包，在同步后检查其能否成功编译，并且只提交语言包。

`makemessages` 和 `compilemessages` 都会导入你的配置（settings），因此该作业会为每个步骤统一设置它们所需的环境变量：即你的 settings 模块在导入时读取的任何变量（`SECRET_KEY`、`DATABASE_URL` 等）。这两个命令都不会访问数据库，因此占位符值就足够了。`DJANGO_SETTINGS_MODULE` 保持注释状态：`startproject` 写入的 `manage.py` 会自行设置它，而在作业中设置的值会覆盖该值——错误的模块名称会导致 `makemessages` 报错。仅当你的 `manage.py` 未设置该值时才进行设置。

其 `paths:` 过滤器与上述工作流不同：源字符串存在于 Python 代码和模板中，并且作业中的 `makemessages` 会提取它们，因此代码变更可能会引入新的字符串。如果每次推送都会改动 Python 代码，请将匹配模式限定到具体的应用（`myapp/**.py`）。它还会监视 `locale/**`：添加新语言会表现为新的语言包目录（`makemessages -l <code>`）。机器人自身的提交会更改这些语言包，但不会触发运行，因为它是使用 `GITHUB_TOKEN` 推送的（参见上文的 **作业自身的提交绝不会再次触发自身**——以及使用其他令牌推送时需要缩小哪些范围）。

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

`--all` 会更新所有已存在的语言包；添加语言只需运行一次 `makemessages -l <code>`（或 `champollion init --langs <code>`）。`makemessages` 按 domain 分别运行一次：针对 Python 和模板运行 `django`，针对 JavaScript 运行 `djangojs`（`-d djangojs`）。Sync 会翻译所找到的每个 domain 的语言包。最后一步运行 `verify --strict`。若俄语复数词条的翻译缺少 `few` 或 `many` 形式，则会使用 `other` 形式写入并标记为 `# champollion:`。只要语言包中存在此类词条，每次同步都会以 `2` 退出——包括写入该词条的运行以及之后的每次运行（类似于被保留的键），并且其摘要会指明该词条以及用于重新请求的命令；同步后的验证行随即会提示运行未完成而非 `[OK]`。因此，在这些形式写入之前，“Stop when the sync was partial”步骤会在提交后让作业失败。单独运行时这是一条警告：普通的 `verify` 遇到它以 0 退出，而 `--strict` 会失败。`audit` 也会将这些词条计为未完成。

`compilemessages` 会运行 `msgfmt --check-format`，它还会检查每个 `%(name)s` 是否保留其类型——但仅针对带有 `#, python-format` 标记的词条。`makemessages` 会在提取带有 `%` 占位符的词条时添加该标记；手动创建的语言包可能缺少该标记，其词条因而不会被检查。无论标记如何，`champollion verify` 都会对比每个词条的 printf 占位符（名称和类型字母），并且 sync 会在其翻译的每个词条上保留源词条的标记。提交步骤按名称暂存 `*.po` 和 `.champollion.lock`（以及被替换编辑的记录，如果存在的话）；如果你的项目确实跟踪其 `.mo` 文件，请将 `'*.mo'` 加入其中。缓存步骤、记录退出代码以及 `git pull --rebase` 的存在原因与上述工作流完全相同。Babel：同步前执行 `pybabel extract` + `pybabel update --no-wrap`，同步后执行 `pybabel compile`。

Flutter 在此作业中无需额外步骤：sync 写入 `app_<locale>.arb` 文件，而 `flutter gen-l10n`（或运行它的 `flutter build`）属于应用自身的构建步骤，负责将其转换为 Dart。

#### 模型遗漏的复数形式 {#plural-gaps}

被标记的词条不算完成翻译，因此 sync 不会仅依赖人工处理：

- **其他方法或模型会自动重新请求。** 尚未针对该词条做出响应的同步配置（方法、模型、语域、指导）会将其再次发送给模型——而不是去查包含不完整答案的缓存。因此，当开发者的本地模型遗漏了这些形式时，作业的托管模型（`SYNC_FLAGS`）会在下次运行时重新请求它们，预估成本也会将其计算在内。锁文件（`.champollion.lock`，位于 `gaps` 下）会记录在缺少这些形式的情况下做出响应的每套配置，因此本地运行和 CI 运行绝不会轮流为同一个不完整的答案付费。
- **`sync --redo gaps` 会重新请求所有此类词条**，无论是由谁遗漏的——在上述工作流中，勾选 **Run workflow** 下的 `redo_gaps`。可将 `--model` 添加到 `SYNC_FLAGS` 以选用更强大的模型。
- **如果新答案仍然缺少这些形式，该词条将保持标记状态**，并且运行会像之前一样以 `2` 退出。此时需手动编写这些形式并删除 `# champollion:` 行。

试运行（`sync --dry`）会列出它将重新请求的词条并计算其预估价格；其 `--json` 摘要会统计不会重新请求的词条（`totalPluralGaps`），并指出实际运行会因这些词条以 `2` 退出（`realRun.exitCode`）。

## 其他方法

下面的代码片段展示了每种方法所需的密钥及其 `sync` 命令。在上述工作流的“Sync translations”步骤**内部**使用它们：替换其 `env`，将所示标志（`--method openai` 等）放入工作流的 `SYNC_FLAGS` 行——以确保试运行检查使用相同的方法——并保留该步骤的其余部分（`id: sync` 以及记录退出代码的各行），以便部分成功的运行仍能提交已翻译的内容并保存缓存。

## Google Translate 方法

如果使用内置的 Google Translate 方法而不是 OpenRouter：

```yaml
- name: Sync translations
  env:
    GOOGLE_TRANSLATE_API_KEY: ${{ secrets.GOOGLE_TRANSLATE_API_KEY }}
  run: npx --yes champollion@0.5 sync
```

## 直接 LLM 提供商

如果直接使用 `openai`、`anthropic` 或 `gemini` 方法：

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

## 远程翻译 API

如果使用远程翻译端点（例如，托管翻译服务）：

```yaml
- name: Sync translations
  env:
    CHAMPOLLION_API_KEY: ${{ secrets.CHAMPOLLION_API_KEY }}
  run: npx --yes champollion@0.5 sync
```

## 部署前的质量闸门

若要在任何语言环境不完整或损坏时使构建失败（且不执行任何翻译），可单独运行检查。

:::warning[在同步之后运行闸门，而非在同步之前]
如果翻译仅在合并后运行（如上述工作流），添加了新字符串的拉取请求尚未包含对应的翻译，`audit`/`verify` 会导致所有此类 PR 失败。请在翻译已存在的位置运行闸门：在同步作业之后的 `main` 上（`needs: sync`，或同步工作流的 `on: workflow_run`）。`push` 触发器不会在同步机器人自身的提交上触发——这些提交是使用 `GITHUB_TOKEN` 推送的，不会触发任何工作流（见上文）。在拉取请求上，仅运行 `lint`，或者先在 PR 分支上运行同步作业。
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

| 检查项 | 命令 | 失败条件 |
|-------|---------|------------|
| **Lint** | `lint` | 源代码中包含未收录进语言环境文件的字符串——或者未找到可检查的源文件（它会列出查找过的目录；使用 `--src <dir>` 指向其他位置） |
| **Audit** | `audit` | 存在缺失、为空或仍为 `[EN]` 回退项的键——或者翻译**已过时**：基于比当前文本更旧的源文本生成（源文本被修改但重新翻译失败）——或者复数消息缺少该语言日常计数所需的形式（俄语 `few`/`many`；即 `verify --strict` 失败时对应的词条），并附带重新请求的命令 |
| **Verify** | `verify` | 翻译损坏了占位符、ICU 复数、标记结构（标签开启、闭合或嵌套与源文本不一致）或脚本——或者存在缺失的键——或者同一文本被用于多个不同的源字符串（模型重复输出死记硬背的句子）——或者未找到可检查的内容（源文件或语言环境目录不在配置所指向的位置） |
| **Verify（严格模式）** | `verify --strict` | 上述任意情况，或出现任何警告 |

出现任何错误时 `verify` 以 `1` 退出，否则以 `0` 退出。警告会打印出来但不会使作业失败：源文本回显、两个语言环境文本完全相同、翻译已过时、翻译漏掉了源文本末尾的 `?` 或 `!`（某些语言使用疑问助词来标记疑问），以及下文所述的复数警告。多个不同的源字符串翻译为同一文本属于错误：两个明显不同的多词字符串翻译成了相同的包含四个或更多词的文本，其他情况下为三个或更多词。这是按照 `sync` 闸门的拒绝规则，综合键值、各个复数分支以及该语言环境的 Markdown 页面计算得出的。`verify --strict` 会将每个警告转为失败。例如，当必须阻止因模型遗漏俄语复数形式而进行部署时，请使用此项。过时的翻译在 `verify` 中属于警告（结构依然完整），在 `audit`（完整性检查闸门）中属于失败，后者会打印用于重新翻译它们的命令。

复数检查结果取决于格式存储复数的方式：

| 格式 | 错误（`verify` 退出代码为 1） | 警告（仅在使用 `--strict` 时失败） |
|--------|--------------------------|--------------------------------------|
| i18next 后缀键（`count_one`、`count_other` 等） | 缺少语言环境所需的形式（法语 `count_many`）：视为缺失键。 | 存在语言环境不需要的形式的键（法语或西班牙语 `count_two`）。`verify` 会打印专门移除这些键的命令 `sync --prune plural-extras`；没有该命令，sync 绝不会删除它们。 |
| ICU 消息（next-intl、ARB、i18next ICU 中的 `{count, plural, …}`） | 复数结构损坏（翻译了变量、关键字或选择器，丢失了 `#`）。 | 缺少该语言环境用于日常计数的某个分支（俄语 `few`、`many`）。仅用于大额数字的形式缺失不会报错（如法语 `many`，用于 1 000 000）。 |
| gettext（`msgid_plural`） | 词条无翻译（为空或 `fuzzy`）：视为缺失键。 | 在该语言对日常计数有专门形式的情况下，`msgstr[]` 形式重复了 `other` 形式（带有 `# champollion:` 注释）。`msgstr[]` 行数超过了语言包的 `nplurals`。复数形式按语言包自身的 `Plural-Forms` 头信息计算。 |

由另一种形式的文本翻译而来的 i18next 形式可以包含与该形式完全相同的文本（法语 `count_many` 与 `count_other` 相同）。法语中两者书写可能完全相同，因此这绝不会触发警告。当 sync 向模型请求某种形式时，会将其记录在 `.champollion.lock` 中，并附带响应的指纹。`verify` 只读取该记录，因此提交的每个克隆副本都会获得相同的结果。你笔记本电脑上的缓存与全新的 CI runner 绝不会出现冲突。没有记录的值（手动编写、由其他工具生成、由无法指定形式的机器翻译引擎生成，或由较旧版本生成）会显示一条提示信息，并附带重新请求的命令。`--strict` 不会因它而失败。Verify 检查的是结构而非语义：检查通过表示键、占位符、复数、标记和脚本完整无损，并不代表文本语义完全准确。

---

## 另请参阅

- [CLI 参考](/docs/reference/cli) — 完整命令参考
- [同步工作原理](/docs/concepts/how-sync-works) — 理解增量同步
- [翻译记忆](/docs/concepts/translation-memory) — 缓存和成本节省
- [翻译方法](/docs/guides/translation-methods) — 按语言对选择方法
- [质量门](/docs/concepts/quality-gate) — 翻译失败时会发生什么
- [配置](/docs/getting-started/configuration) — 配置参考
