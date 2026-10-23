---
sidebar_position: 3
title: "CI/CD"
---

# CI/CD 集成

在构建流水线中实现翻译自动化。

champollion CLI 在 [PolyForm Noncommercial License 1.0.0](https://github.com/gamedaysuits/Champollion/blob/main/cli/LICENSE) 下开放源码可用（source-available）：可免费用于非商业用途的使用、修改和共享。将其用于商业目的不受本许可证许可（[适用人群](/docs/getting-started/who-may-use-this)）。

## GitHub Actions：保持翻译同步

一个完整的 workflow：翻译变更的内容、检查结果并提交回仓库。它适用于任何项目——无论是否基于 Node（Django、Flutter、Hugo 均可）。

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

**为什么工作流采用这种设计。** `actions/cache` 单独使用时仅在整个作业成功时才保存缓存，而 `sync` 只要有任何键被拒识就会退出 `2`——因此过去部分完成的运行会同时跳过提交和缓存保存，导致下一次运行再次为相同的翻译付费。在此方案中，缓存的恢复和保存分为两个步骤（`actions/cache/restore`，然后是带有 `if: always()` 的 `actions/cache/save`），同步步骤记录其退出代码而不是直接在 `2` 上失败，已翻译的文件会被提交，只有在此之后作业才会失败——在它自己的步骤中、且在 `verify` 之前失败，从而让失败的步骤说明具体原因（`--max-cost` 停止，或是同步未能翻译某些键），而不是由 `verify` 指出缺少某个键。最后一步是 `verify --strict`：普通的 `verify` 遇到警告（其中包括多余或缺失的复数形式）会以 0 退出，而 `--strict` 会因此使作业失败。被质量门禁拒识的键会被记录下来：下一次运行不会再次将其发送给同一个模型（否则会为相同的回答付费）——同步日志会指出该键以及重新发起请求的 `--redo keys:` 命令。

**每个变更一份缓存副本，而非每次运行一份。** 恢复步骤会取回分支最新的缓存（由于其精确键 `…-newest` 从未被保存，因此 `restore-keys` 会选择最新的一份）。保存步骤使用缓存自身文件的哈希值作为缓存的键（`hashFiles('.champollion/**')`）：进行了翻译的运行——哪怕是部分完成的运行，或者推送失败的运行——改变了缓存，因此它会获得一个新键并被保存；未添加任何内容的运行（无需翻译、全部来自缓存、因 `--max-cost` 停止）拥有的键与恢复时的键相同，因此会跳过保存，不存储新的副本。以运行 ID 作为键会在每次运行时都保存一份完整副本；以 lock 和源文件作为键则会在推送被拒绝的运行之后通过完全匹配恢复较旧的副本，因为已提交的 lock 从未包含该次运行的变更。

在 Node 项目中，你可以将 `champollion` 添加为开发依赖项，并改为调用 `npx champollion sync`；上面固定版本的 `champollion@0.6` 则适用于任何仓库，绝不会意外引入不同的版本。作业随后必须安装它：在全新的 runner 上，未安装任何内容的 `npx champollion` 会拉取最新版本，而不是 lock 文件固定的版本。并且安装过程会写入 `node_modules/`，除非你的 `.gitignore` 列出了它（`champollion init` 创建的文件仅列出 `.champollion/`），否则 `git add --all` 会将其提交，因此请按名称暂存语言文件和 lock 文件，如下面的 Django workflow 所示：

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

**提交 lock 文件。** `.champollion.lock` 和 `.champollion-content.lock` 记录了每段翻译是由哪个源文本生成的。下一次运行正是通过它们得知字符串发生了变更。从未见过它们的 runner 无法区分编辑过的字符串与未修改的字符串。**不要提交 `.champollion/`**——它是单机缓存；`champollion init` 会将其添加到 `.gitignore` 中。

**`--max-cost`** 会在花销超出预期之前停止运行；可将其设置为平时一天变更所需的开销。当它停止某次运行时，尚未翻译或写入任何内容，sync 将以退出代码 `2` 退出：没有可提交的内容，并且“Stop when the sync was partial”步骤会使作业失败并说明原因。未公布价格的方法（另一台机器上的自建端点）无法进行估算，因此只要有需要翻译的内容，`--max-cost` 就会停止——对于这些方法请勿启用该选项。在 runner 本身托管的模型（在 `localhost`/`127.0.0.1` 上的 `local`）其 API 成本计为 $0。

**仅当推送修改了源文本字符串时才启动作业。** `paths:` 过滤器列出了你的源语言文件和 `champollion.config.json`：仅修改代码、或者仅修改翻译和 lock 文件的推送没有需要翻译的内容，因此不会启动作业。将这两个语言文件路径修改为配置中指定的文件（`messages/en.json`、`lib/l10n/app_en.arb` 等）；当 sync 也翻译 Markdown 时，添加你的 `contentDir` 文件夹。**Run workflow**（`workflow_dispatch` 触发器）仍可手动运行它。

**作业自身的提交绝不会再次触发自身**——而且起阻止作用的并不是 `paths:` 过滤器。提交步骤使用 workflow 的 `GITHUB_TOKEN` 进行推送，而使用 `GITHUB_TOKEN` 发起的推送绝不会触发 workflow 运行（这是 GitHub 的规则，以防止 workflow 自行无限触发）。这就是为什么下方的 Django workflow 可以监视 `locale/**`，而 Bot 的每次提交都会修改该文件。如果改用个人访问令牌（PAT）或 GitHub App 令牌进行推送（例如为了在 Bot 提交时触发其他 workflow），该推送就会再次触发此 workflow；此时 `paths:` 过滤器将起到决定作用。上面的过滤器排除了翻译文件和 lock 文件，因此 Bot 的提交不会触发运行。Django 过滤器的 `locale/**` 包含了 Bot 提交的 catalog，因此其每次提交都会再次触发一次运行——该运行会发现没有需要翻译的内容并且不提交任何东西。若使用此类令牌，请将其范围缩小到源 catalog（`locale/en/**`），并通过配置文件添加语言。

**每次启动运行时都需要提供商密钥**，即便无需翻译任何内容也是如此：sync 在检查变更内容之前会先检查该方法是否可以运行。在没有源文本变更的情况下手动启动的运行，若缺少 `OPENROUTER_API_KEY` secret（或你的方法对应的密钥），仍然会失败。`local` 不需要密钥，但 runner 上没有模型服务器：在开发者机器上使用 `local` 翻译的项目，在 CI 中会指定托管方法（`--method` / `--model`——即上述 workflow 中被注释掉的 `SYNC_FLAGS` 行）。为了在不翻译任何内容的情况下检查 secret 是否传递到了该步骤，`sync --dry` 会在实际运行可能停止时发出警告并指出缺失的变量（它仍会以 0 退出——dry run 仅用于预览）。它只检查变量是否**已设置**，而不检查密钥是否**有效**：它不发送任何请求，因此任何非空值都会通过——占位符也不例外。错误或已撤销的密钥会在实际运行的第一次请求时暴露出来（错误信息会指出提供商的响应，例如 HTTP 401）。若要在运行任何操作之前因密钥缺失而使作业失败，请添加[同步前检查](#check-before-sync)。

**缓存按方法独立保留。** 翻译会按生成它的方法、语域和 coaching 文件进行缓存（同一方法的不同模型可以复用它——即模型继承）。因此，开发者使用 `local` 翻译与 CI 使用托管模型翻译绝不会共享缓存条目——而且 CI 的缓存本来就是独立的（`.champollion/` 不会被提交）。这并不意味着 CI 会重新翻译整个项目：语言文件中已存在且 lock 文件已提交的内容均视为已完成。CI 只需向托管模型支付自上次提交以来新增或变更的字符串的费用——包括开发者在本地翻译但未提交的字符串——其余内容则无需付费。使用托管模型重新翻译整个项目（`--redo all`）会对每个字符串计费一次。

**按计划调度运行**（而非按推送运行）：将 `on:` 块替换为 `schedule: [{ cron: '0 6 * * *' }]`。

### 同步前检查：及早使作业失败 {#check-before-sync}

无论发现什么，dry run 都会以 `0` 退出——它只是预览——因此 `sync --dry --max-cost 5` 会发出警告提示实际运行会在达到上限时停止，但作为 CI 步骤仍会通过。若要在实际运行会停止（缺少密钥或 `--max-cost`）时使作业失败，请读取 `sync --dry --json` 的摘要。该输出是每行一个 JSON 对象（NDJSON），每个对象包含一个 `level`——stdout 上的 `info`、`ok` 和 `event` 行，stderr 上的 `warn` 和 `error` 行——而最后一行 stdout 是摘要 `{"level": "summary", "command": "sync", …}`。根据其级别进行筛选。**使用与同步相同的标志运行它**：如果不带这些标志，它会检查配置中指定的方法，因此对于配置指定为 `local` 的项目，它会检查本地方法——而不是作业所运行的托管模型——并在没有密钥的 runner 上直接通过。在上述 workflow 中作为“Sync translations”之前的步骤，它会读取相同的 `SYNC_FLAGS`：

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

或者在 shell 中显式写出这些标志——与同步命令中的标志完全相同：

```bash
SYNC_FLAGS="--method llm --model google/gemini-3.8-flash --max-cost 5"
out=$(npx --yes champollion@0.6 sync --dry $SYNC_FLAGS --json)
printf '%s\n' "$out" | jq -e 'select(.level == "summary") | .preflight.ready and (.maxCost.wouldStop | not)' > /dev/null \
  || printf '%s\n' "$out" | jq -r 'select(.level == "summary") | .error // "A real sync would exit \(.realRun.exitCode): \(.realRun.reasons | join("; "))"'
```

当方法所需的密钥缺失（未设置或为空——而不是密钥错误）时，无论是否有内容需要翻译，`preflight.ready` 均为 `false`：托管方法在没有密钥的情况下绝不会就绪。当实际运行会在上限处停止时，`maxCost.wouldStop`（存在 `--max-cost` 时提供）为 `true`。若发生上述任一情况，`jq -e` 都会以 1 退出，然后该步骤会在作业日志中输出原因——例如 `A real sync would exit 1: it would stop before translating: No OpenRouter API key (OPENROUTER_API_KEY) for en:fr`, or `A real sync would exit 2: --max-cost would stop it before any API call (Estimated translation cost exceeds the --max-cost cap: estimate ~$7.1200, cap $5.0000)`。当 sync 根本无法运行（配置损坏）时，该步骤会输出摘要的 `error`。该步骤不会将 stderr 发送到 `/dev/null`，因此警告也会保留在日志中。摘要的 `realRun.exitCode` 说明了实际运行在预览所能判断的范围内将以什么代码退出：当预检会停止运行时为 `1`，当 `--max-cost` 会停止运行、或者运行会部分完成（存在被暂扣的键，或磁盘上的复数消息缺少该语言所使用的形式，具体见 `realRun.reasons`）时为 `2`。质量门禁的拒识（只有实际运行才会发现）仍然可能将 `0` 变为 `2`。若要在预测为部分运行时也使检查失败，请用 `.realRun.exitCode == 0` 替换 `.preflight.ready and (.maxCost.wouldStop | not)`。

### 受保护的 main 分支：发起 Pull Request

上述 workflow 将翻译直接推送到 `main`。如果 `main` 受保护（需要审查或状态检查），该推送就会被拒绝——此时同步已经运行，因此翻译费用已经产生。不过这些费用不会再次产生：即使某个步骤失败，缓存也会在提交步骤之前保存，因此重新运行作业或下一次推送（均会通过 `restore-keys` 恢复该分支最新的缓存）都会从缓存中读取这些翻译。由于 lock 文件从未进入 `main`，下一次运行仍会发现相同的字符串发生变更并重新写入它们——但来自缓存，零成本。

在受保护的 `main` 上，改为提交到 Bot 专属的分支并创建（或更新）Pull Request。保留上述 workflow 并做两处修改：权限以及提交步骤。

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

**何时使用何种方式。** 当 workflow 允许直接推送时推送至 `main`：分支未受保护，或者存在允许 GitHub Actions 绕过保护的规则。当 `main` 受保护，或者需要人工——该语言的母语者——在发布前审阅翻译时，请发起 Pull Request。

- 该分支归 Bot 所有。在 Pull Request 合并之前，`main` 的 lock 文件中不包含其翻译，因此每次运行都会再次提议全套变更——全部来自缓存，所以只对自此之后变更的字符串计费。推送到该分支的手动修改会在下一次运行时被覆盖：请在 Pull Request 中审阅、合并，然后在 `main` 上编辑（后续的批量重做会保留人工编辑）。
- 仓库必须允许 Actions 创建 Pull Request：Settings → Actions → General → "Allow GitHub Actions to create and approve pull requests"。
- 使用 workflow 的 `GITHUB_TOKEN` 打开的 Pull Request 不会触发其他 workflow，因此必需的状态检查绝不会在其上运行。如果 `main` 需要这些检查，请使用 GitHub App 令牌或作为 secret 保管的细粒度令牌（`GH_TOKEN: ${{ secrets.<name> }}`）来创建它，或者使用诸如 `peter-evans/create-pull-request` 之类的 action，它会为你提交代码、更新分支并编辑已打开的 Pull Request（以同样的方式向其传递令牌）。

### gettext（Django、Babel）与 Flutter

Sync 翻译的是现有的 catalog；它不会从代码中提取字符串。Django 项目会在同步步骤之前刷新 catalog，在同步步骤之后检查它们能否编译，并且仅提交 catalog。

`makemessages` 和 `compilemessages` 都会导入你的 settings，因此作业需要为每个步骤统一设置一次它们所需的环境变量：即 settings 模块在导入时读取的任何变量（`SECRET_KEY`、`DATABASE_URL` 等）。这两个命令都不会触及数据库，因此为这些变量提供占位符值就足够了。`DJANGO_SETTINGS_MODULE` 保持注释状态：`startproject` 生成的 `manage.py` 会自行设置它，而在作业中设置的值会覆盖该值——错误的模块名称会导致 `makemessages` 崩溃。仅当你的 `manage.py` 未设置时才去设置它。

它的 `paths:` 过滤器与上述 workflow 不同：源字符串存在于你的 Python 代码和模板中，而 `makemessages` 会在作业中提取它们，因此代码变更可能会引入新的字符串。如果每次推送都会触及 Python，请将匹配模式限定在你的 app 目录下（`myapp/**.py`）。它还会监视 `locale/**`：新语言会作为新的 catalog 文件夹（`makemessages -l <code>`）引入。Bot 自身的提交会修改这些 catalog，但不会触发新的运行，因为它是通过 `GITHUB_TOKEN` 推送的（参见上文的**作业自身的提交绝不会再次触发自身**——以及使用其他令牌推送时应如何缩小范围）。

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

`--all` 会更新所有已存在的 catalog；通过 `makemessages -l <code>`（或 `champollion init --langs <code>`）添加新语言一次即可。`makemessages` 按 domain 分别运行一次：Python 和模板对应 `django`，JavaScript 对应 `djangojs`（`-d djangojs`）。Sync 会翻译找到的每个 domain 的 catalog。最后一步运行 `verify --strict`。翻译中缺少 `few` 或 `many` 形式的俄语复数词条会写入 `other` 形式并标记为 `# champollion:`。只要 catalog 中存在此类词条，每次 sync 都会以 `2` 退出——无论是写入它的那次运行还是之后的每一次，类似于暂扣键的处理方式——且其摘要会指出该词条以及重新发起请求的命令；随后的同步后验证行会显示运行未完成而不是 `[OK]`。因此，“Stop when the sync was partial”步骤会在提交后使作业失败，直到这些形式被补充完整。单独使用时这只是一个警告：单纯的 `verify` 会以 0 退出，而 `--strict` 则会失败。`audit` 会将同样的词条计为未完成。

`compilemessages` 会运行 `msgfmt --check-format`，它还会检查每个 `%(name)s` 是否保留其类型——但仅针对带有 `#, python-format` 标记的词条。`makemessages` 会为它提取的带有 `%` 占位符的词条添加该标记；手动创建的 catalog 可能缺少该标记，因此其词条不会被检查。无论标记如何，`champollion verify` 都会对比每个词条的 printf 占位符（名称和类型字母），并且 sync 会在其翻译的每个词条上保留源词条的标记。提交步骤会显式暂存 `*.po` 和 `.champollion.lock`（以及被替换编辑的记录，如果存在的话）；如果你的项目确实跟踪其 `.mo` 文件，请将 `'*.mo'` 加入其中。缓存步骤、记录退出代码以及 `git pull --rebase` 的存在原因与上述 workflow 完全相同。Babel 项目：在同步前运行 `pybabel extract` + `pybabel update --no-wrap`，在同步后运行 `pybabel compile`。

Flutter 在此作业中无需额外步骤：sync 负责写入 `app_<locale>.arb` 文件，而 `flutter gen-l10n`（或运行它的 `flutter build`）是你应用自身的构建步骤，负责将它们转换为 Dart。

#### 模型遗漏的复数形式 {#plural-gaps}

带有标记的词条不算完成翻译，因此 sync 不会仅仅把它留给人工处理：

- **另一方法或模型会自动重新请求。** 配置（方法、模型、语域、coaching）尚未对该词条给出过回答的同步操作会将其再次发送给模型——而不是发给保存了不完整回答的缓存。因此，当开发者的本地模型遗漏了这些形式时，作业中的托管模型（`SYNC_FLAGS`）会在下一次运行时请求它们，预估费用也会将其计入。lock 文件（`.champollion.lock`，位于 `gaps` 下）会记录在缺少这些形式的情况下给出回答的每种配置，因此本地运行与 CI 运行绝不会轮流为同一个不完整的回答付费。
- **`sync --redo gaps` 会为每一个此类词条发起重新请求**，无论最初是由谁遗漏的——在上述 workflow 中，勾选 **Run workflow** 下的 `redo_gaps` 即可。将 `--model` 添加到 `SYNC_FLAGS` 可换用更强大的模型。
- **如果新回答仍然缺少这些形式，该词条将保持标记状态**，且运行会如前所述以 `2` 退出。此时需手动编写这些形式并删除 `# champollion:` 行。

dry run（`sync --dry`）会列出它将重新请求的词条并为其定价；其 `--json` 摘要会统计不会重新请求的词条数（`totalPluralGaps`），并指出实际运行会因它们而以 `2` 退出（`realRun.exitCode`）。

## 其他方法

下面的代码片段展示了每种方法所需的密钥及其 `sync` 命令。在上述 workflow 的“Sync translations”步骤**内部**使用它们：替换其中的 `env`，将所示标志（`--method openai` 等）放入 workflow 的 `SYNC_FLAGS` 行——以便 dry-run 检查运行相同的方法——并保留该步骤的其余部分（`id: sync` 以及记录退出代码的各行），以便部分完成的运行仍能提交已翻译的内容并保存缓存。

## Google Translate 方法

如果使用内置的 Google Translate 方法而非 OpenRouter：

```yaml
- name: Sync translations
  env:
    GOOGLE_TRANSLATE_API_KEY: ${{ secrets.GOOGLE_TRANSLATE_API_KEY }}
  run: npx --yes champollion@0.6 sync
```

## 直接 LLM 提供商

如果直接使用 `openai`、`anthropic` 或 `gemini` 方法：

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

## 远程翻译 API

如果使用远程翻译端点（例如托管的翻译服务）：

```yaml
- name: Sync translations
  env:
    CHAMPOLLION_API_KEY: ${{ secrets.CHAMPOLLION_API_KEY }}
  run: npx --yes champollion@0.6 sync
```

## 部署前的质量门禁

若要在任何语言区域（locale）不完整或损坏时使构建失败（且不翻译任何内容），请单独运行这些检查。

:::warning[在同步之后运行门禁，而不是在同步之前]
如果翻译仅在合并后运行（上述 workflow），添加了字符串的 Pull Request 就还没有对应的翻译，`audit`/`verify` 会导致所有此类 PR 失败。请在翻译已经存在的地方运行门禁：在同步作业之后的 `main` 上（`needs: sync`，或同步 workflow 的 `on: workflow_run`）。`push` 触发器不会针对同步 Bot 自身的提交触发——它们是通过 `GITHUB_TOKEN` 推送的，不会启动 workflow（见上文）。在 Pull Request 上，仅运行 `lint`，或者先在 PR 分支上运行同步作业。
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

| 检查 | 命令 | 失败条件 |
|-------|---------|------------|
| **Lint** | `lint` | 源代码中包含未出现在语言文件中的字符串——或者未找到要检查的源文件（它会列出所查找的文件夹；可通过 `--src <dir>` 指向其他位置） |
| **Audit** | `audit` | 键缺失、为空或仍为 `[EN]` 回退——或者翻译**已过时**：基于比当前版本更旧的源文本生成（源文本已编辑但重新翻译失败）——或者复数消息缺少该语言日常计数所用的形式（俄语 `few`/`many`；即 `verify --strict` 失败的词条），并附带重新请求的命令 |
| **Verify** | `verify` | 翻译损坏了占位符、ICU 复数、标记语言结构（标签的开启、闭合或嵌套方式发生改变）或脚本——或者键缺失——或者同一段文本被用作多个不同源字符串的翻译（模型重复输出死记硬背的句子）——或者未找到可检查的内容（源文件或 locales 文件夹不在配置所指向的位置） |
| **Verify（严格模式）** | `verify --strict` | 上述任何情况，或出现任何警告 |

`verify` 在出现任何错误时以 `1` 退出，否则以 `0` 退出。警告会打印出来但不会使作业失败：源文本回显、两个语言区域文本完全相同、翻译已过时、翻译丢弃了源文本末尾的 `?` 或 `!`（某些语言使用助词而非标点来表示疑问），以及下文所述的复数警告。多个不同的源字符串对应同一段文本属于错误：两个明显不同的多词字符串被翻译为包含四个或更多词的相同文本，或者在其他情况下为三个或更多词。这是根据 `sync` 门禁拒绝该翻译所依据的规则，在键值、各个复数分支以及语言区域的 Markdown 页面上进行统计的。`verify --strict` 会将所有警告视为失败。例如，当模型遗漏俄语复数形式必须阻止部署时，就可以使用它。过时的翻译在 `verify` 中是警告（结构完好），而在 `audit`（完整性门禁）中是失败，后者会打印重新翻译它们的命令。

复数检查结果取决于该格式如何存储复数：

| 格式 | 错误（`verify` 退出码为 1） | 警告（仅在指定 `--strict` 时失败） |
|--------|--------------------------|--------------------------------------|
| i18next 带后缀的键（`count_one`、`count_other` 等） | 缺少语言区域所需的形式（法语 `count_many`）：属于键缺失。 | 存在该语言区域不具备的形式的键（法语或西班牙语 `count_two`）。`verify` 会打印精确删除这些键的命令 `sync --prune plural-extras`；未经此命令，sync 绝不会删除它们。 |
| ICU 消息（next-intl、ARB、i18next ICU 中的 `{count, plural, …}`） | 复数结构损坏（翻译了变量、关键字或选择器，或者丢失了 `#`）。 | 缺少该语言区域日常计数所用的分支（俄语 `few`、`many`）。仅用于大数的缺失形式（如法语用于 1 000 000 的 `many`）不会报错。 |
| gettext（`msgid_plural`） | 没有翻译的词条（为空或 `fuzzy`）：属于键缺失。 | 当该语言在日常计数中有专属形式时，`msgstr[]` 形式重复了 `other` 形式（带有 `# champollion:` 注释标记）。`msgstr[]` 行数多于 catalog 的 `nplurals`。复数形式按 catalog 自身的 `Plural-Forms` 头信息统计。 |

从另一个形式的文本翻译而来的 i18next 形式可以包含与该形式完全相同的文本（法语 `count_many` 与 `count_other` 相同）。法语中这两者写法可能一致，因此这绝不会触发警告。当 sync 向模型请求某个形式时，它会将其记录在 `.champollion.lock` 中，并附带该回答的指纹。`verify` 仅读取该记录，因此每次克隆同一提交都会获得相同的结果。你的笔记本电脑上的缓存与全新的 CI runner 绝不会产生分歧。没有记录的值（手动编写、由其他工具生成、由无法指定形式的机器翻译引擎生成，或由旧版本生成）会收到一行提示信息，并附带重新请求的命令。`--strict` 不会因此失败。Verify 检查的是结构，而非语义：检查通过仅表示键、占位符、复数、标记语言结构和脚本完好无损，并不代表文本表达的内容完全正确。

---

## 另请参阅

- [CLI 参考](/docs/reference/cli) — 完整命令参考
- [Sync 工作原理](/docs/concepts/how-sync-works) — 了解增量同步
- [翻译记忆库](/docs/concepts/translation-memory) — 缓存与成本节约
- [翻译方法](/docs/guides/translation-methods) — 按语言对选择方法
- [质量门禁](/docs/concepts/quality-gate) — 翻译失败时的处理机制
- [配置](/docs/getting-started/configuration) — 配置参考
