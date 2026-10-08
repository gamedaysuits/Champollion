---
sidebar_position: 1
title: "CLI 参考"
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

# CLI 参考

## 命令

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

用于操作共享索引和排行榜（而非您的本地项目）的命令归类在 `champollion network` 下。每个命令也可以在不带前缀的情况下运行：

```
champollion network card <code>        What the index knows about a language (--json for raw output)
champollion network recommend <s> <t>  Methods you can run for a pair, with the evidence for each, and open models that declare the target (or one pair: eng-crk)
champollion network leaderboard        Published results; install a proven method (--install, --apply)
champollion network register-corpus    Register a test set without handing it over (local-only/private/public/sealed)
champollion network seal-corpus <sub>  Sealed-tier crypto verbs: keygen / seal / open (organizer-node bridge)
champollion network submit             Propose an index entry (review-gated): prints a pre-filled GitHub issue
```

运行 `champollion <command> --help` 可获取任意命令的详细帮助
（`champollion network` 列出网络命令）。

## 全局选项

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

### 编写语言对

项目语言对的写法与 `champollion.config.json` 的键值一致：`en:fr`。`sync`、`verify` 和 `serve` 也可以读取 `en>fr` 与 `en-fr`，且 `en-pt-BR` 会与您配置的语言对进行匹配。网络命令（`network register-corpus`、`leaderboard`、`recommend`、`submit`）将语言对写作 `eng>crk`，这是排行榜存储以及 `mt-eval` 所使用的格式，并且以相同方式读取 `eng-crk` 和 `eng:crk`。仅使用连字符时，语言对由两个两字母或三字母的代码组成（`eng-crk`）。本身包含连字符的代码则需要 `>`：`--pair "eng>pt-BR"`。`eng-pt-BR` 会被拒绝，绝不会进行猜测。在 shell 中请给 `>` 形式加上引号：若不加引号，`--pair eng>crk` 会将输出重定向到名为 `crk` 的文件中。

---

## init

交互式设置向导，创建 `champollion.config.json`。引导您完成源语言、目标语言、文件格式和翻译模型的配置。

```bash
champollion init                          # interactive wizard
champollion init --yes                    # skip wizard, use defaults
champollion init --yes --langs fr,de,ja   # quick setup with specific languages
champollion init --source en --dir ./i18n # overrides with defaults
champollion init --yes --langs crk --content-dir newsletters  # also translate a folder of Markdown
champollion init --yes --langs abc --method api --endpoint http://127.0.0.1:8378/translate --accepts-instructions false
```

**`--content-dir` 选项**：除了本地化区域文件（写作 `contentDir`）之外，还要翻译的 Markdown/MDX 文件所在的文件夹。该文件夹必须存在；如果不存在，`init` 将直接停止且不写入任何内容。

**包含仅限本地文件的项目默认使用 `local`**：默认方法为 `llm`（OpenRouter，托管服务）。当项目中的任意文件被标记为仅限本地（如 `champollion network register-corpus --data <file> --tier local-only` 所写，在其旁边带有包含 `"transmission": "local-only"` 的 `<file>.champollion.json`）时，`init`（以及 `--yes`）将转而默认使用 `local` 方法：在本机运行的模型（Ollama 默认的 `http://localhost:11434/v1`，或 `LOCAL_API_BASE` 指定的服务器）。它会说明原因，指出被标记的文件，并说明如何显式选择托管方法：`champollion init --force --method llm --model <model>`。显式指定的 `--method` 始终具有最高优先级；此时 `init` 会在文本输出位置旁边标明该标记文件。

**再次运行 `init`（`--force`）**：若不带 `--force`，当 `champollion.config.json` 已存在时 `init` 会直接停止。若带有该选项，`init` 会基于该文件，并仅重写标志指定的项：`--langs` 设置目标列表（已存在的语言会保留其条目——语体、书写系统、名称），`--method` 设置默认方法（以及附带的模型，除非 `--model` 另有指定），`--model`、`--temperature`、`--source`、`--dir`、`--format`、`--content-dir`、`--script`、`--name`，以及 `--method api` 设置其指定的语言对。仅当该文件无法再找到您的源文件（或 `--dir` 指定了其他文件夹）时，它才会重新检测区域布局。所有其他设置——`batchSize`、`pairs`、`glossary`、回退配置、您选择的语体——均保持原样。它会输出修改的字段和保留的字段，并首先将先前的文件复制到 `champollion.config.json.bak`（当该备份中已有更早的文件时，下一次备份命名为 `.bak.2`、`.bak.3` 等；旧备份绝不会被覆盖）。非有效 JSON 的文件无法保留：它会被备份并写入新文件。若仅更改某一项设置，直接在文件中编辑即可——无需为此再次运行 `init`。

**查找区域文件**：`init` 在写入任何内容之前会先查找源语言的文件。它会优先检查您所用框架的常规文件夹（next-intl `messages/`，i18next 先检查 `public/locales/<lang>/` 后检查 `locales/<lang>/`，vue-i18n `src/locales/`，Hugo `i18n/`），接着检查 `locales`、`messages`、`i18n`、`lang`、`translations`、`public/locales`、`src/locales` 和 `src/i18n`，并输出找到的内容。它绝不会写入不存在的 `localesDir`。参见[区域文件布局](/docs/getting-started/configuration#locale-layouts)。

**`--langs` 选项**：以逗号分隔的目标语言代码列表。跳过语言提示并应用每种语言的默认语体预设——已写入配置文件中，以便清晰可见且可随时修改：`"languages": { "fr": "formal-vous", "es": "neutral-latam" }`（可将其更改为其他预设，或使用您自定义的词语描述语调；没有预设的语言会写作 `{}`）。它还会在您的布局中创建空的目标文件（`fr.json`，或针对每个命名空间的 `fr/common.json`）。可与 `--yes` 结合使用以实现完全非交互式的安装配置。

**`--method api --endpoint <url>`**：符合 champollion API 契约的服务器——例如由 `nmt-forge serve` 提供服务的自训练模型。`init` 会为每个目标写入一个语言对，与模型旁边的 `DEPLOY.md` 具有相同的条目：`"pairs": { "en:abc": { "method": "api", "endpoint": "http://127.0.0.1:8378/translate", "acceptsInstructions": false } }`。`--accepts-instructions true|false` 说明该端点是否遵循逐键指令（使用 nmt-forge 训练的模型则不遵循）；若不指定，`init` 会从同一端点已安装的插件清单（`.champollion/methods/<name>/method.json`）中获取该值，或者将其保留为未声明状态。它需要 `--langs`（端点是按语言对配置的），并且只有非本机端点才需要密钥（`CHAMPOLLION_API_KEY`）。如 `DEPLOY.md` 所示，手动向该语言对添加 `fallback` 方法。

**`--script` 选项**：少数语言在实际书写中存在多种正字法——平原克里语（`crk`：`Latn` = 标准罗马正字法，`Cans` = 音节文字），塞尔维亚语（`sr`：`Latn`，`Cyrl`）。Champollion 不会代社区做出选择：在配置指定正字法之前，`sync` 会拒绝翻译此类语言。向导会进行提示；使用 `--yes` 时，请传入 `--script crk=Cans`（多个语言：`--script crk=Cans,sr=Latn`；若仅有单个目标语言，`--script Cans` 即可），它会写入 `"languages": { "crk": { "script": "Cans" } }`。若未提供，`init --yes` 会说明哪些语言需要做出选择，列出可用选项，并输出需要添加到配置中该语言条目下的 `"script"` 行。

**`--name` 选项**：私用代码（`qaa`–`qtz`，用于尚无确切代码的语言变体）没有语言卡片，因此 `init` 会说明这一点，而不是让您检查拼写。`--name qaa="Ayta (variety not yet confirmed)"` 可为其指定在提示和报告中使用的显示名称，写作 `"languages": { "qaa": { "name": "Ayta (variety not yet confirmed)" } }`（多个语言：`--name "qaa=…;qab=…"`）。在每个语体旁边，`init` 还会输出 LLM 提示针对该语言所携带的性别指引（[性别指引](/docs/getting-started/configuration#gender-guidance)）。

**语言预设**：当系统提示输入目标语言时，您可以输入预设名称：
- `european` → fr, de, es, it, pt, nl
- `asian` → ja, zh, ko
- `global` → fr, es, de, ja, zh, ko, pt, ar
- `nordic` → da, fi, nb, sv

混合预设和单个代码：`european, ja` → fr, de, es, it, pt, nl, ja

---

## sync

翻译所有语言文件中缺失和过期的键。默认运行同步后验证。

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

**翻译记忆库（Translation Memory）**：默认情况下，`sync` 会加载 `.champollion/tm.json`，并针对未更改的源文本直接提供缓存的翻译。切换模型不会丢弃这些缓存：先前模型已翻译的文本将零成本复用，sync 在费用估算前会对此予以说明。若要让新模型重新翻译它们，请使用：`--redo all --fresh-on-model-change`——它会发送早期模型翻译过的键，而新模型已经翻译过的内容仍来自缓存（单独使用 `--fresh-on-model-change` 时仅影响本次运行本来就要翻译的键）。使用 `--no-tm` 可以完全绕过缓存（在调试质量时非常有用）。参见[翻译记忆库](/docs/concepts/translation-memory)。

**费用估算与 `--max-cost`**：该估算仅针对本次运行将要计费的部分。翻译记忆库中已有的键、front-matter 字段和 Markdown 区块计为 $0，表格会显示缓存节省的费用。本机运行的模型（`local`，或位于 `localhost`/`127.0.0.1`/`::1` 的 `api` 端点）显示为 `$0 (local)`——无 API 账单；硬件和电力消耗不计入在内。`--max-cost` 会与该数值进行对比。若超出上限或无法估算（如未公开价格的方法，例如指向其他机器的 `local`），sync 会在发出任何 API 调用之前停止并以 `2` 退出；不会翻译或写入任何内容。结束行会说明向模型发送了多少个键以及有多少个键来自缓存。

在表格下方，有一行指明了计费费率及其来源——对于托管模型，即来自 OpenRouter 公开价格表的每百万输入和输出 token 价格，以及读取时间（`Rate: google/gemini-3.8-flash $0.30 input / $2.50 output per 1M tokens — OpenRouter's price list, read 2026-10-04 14:02 UTC`）；对于直接服务商（`openai`、`anthropic`、`gemini`），同一列表代表服务商自身的价格，当该列表无法读取（或没有该模型的价格）时，将使用 champollion 中保留的副本，并附注最后检查日期和原因；DeepL、Google 和 Microsoft 则采用其公布的每字符价格及日期。这只是一个估算：该行会说明它假定每个键包含多少 token（或字符），实际账单取决于真实长度。使用 `--json` 时，估算会包含详细信息：每个语言对的 `rate` 以及本次运行的 `rates`（`inputPerMillion`、`outputPerMillion` 或 `perMillionChars`、`tokensPerKey`、`from`、`url`、`fetchedAt` 或 `verified`）。

**查看请求内容**：`sync --dry --show-prompt [key]` 会打印该语言对的方法将发送的完整请求——包括由该方法自身代码构建的系统消息和用户消息（或者针对 `api` 端点的请求体），并已隐去 API 密钥——且不会发送任何内容。若指定了一个键（命名方式与 `--redo keys:` 相同：`verb␄Open`、`common::nav.home`；带逗号的 gettext msgid 可以完整传入），无论该键是否排队等待翻译，它都会显示该键对应的请求。当实际运行时不会为其发送任何内容（已是最新、由缓存提供或被阻滞）时，它会进行说明并指出可以发送该请求的 `--redo keys:<key> --fresh` 命令。若未指定键，它会显示每个文件将发送的第一批内容，或者说明不会发送任何内容。这是检查 gettext `msgctxt`、`#.` 注释或 ARB 描述是否已传递给模型的方法。机器翻译引擎（DeepL、Google 等）只接收源文本；预览中会对此说明。使用 `--json` 时，每个请求均为一行 `{"level": "event", "event": "request", …}`。

**预演运行（Dry run）**：`--dry` 不翻译任何内容，也不写入任何内容，但它会先检查实际运行所要检查的内容：当缺少该方法所需的密钥时（`OPENROUTER_API_KEY`、`DEEPL_API_KEY` 等），它会发出警告说明实际运行将会停止，并指出对应的变量名。它只检查该键是否已设置，而不检查其是否有效：由于未发送任何内容，占位符也能通过。它仍然以 `0` 退出——预览绝不会失败（参见[退出代码](#sync-exit-codes)）。`--max-cost` 也是如此：预演运行不会在超出上限时停止，但当估算超出上限（或未知）时，它会在末尾提示一次实际运行将在此处停止并以 `2` 退出。使用 `--json` 时，每一行都是带 `level` 的 JSON 对象（stdout 上为 `info`、`ok`、`event`；stderr 上为 `warn`、`error`），stdout 的最后一行是摘要 `{"level": "summary", "command": "sync", …}`，包含 `preflight: { ready, failures }`、上限 `maxCost: { cap, estimatedCost, wouldStop, exitCode }` 以及 `realRun: { exitCode, wouldStop, reasons }`——即据预览所能判断的实际运行将结束的退出代码（参见[退出代码](#sync-exit-codes)）。请携带实际 sync 使用的标志运行它（`--method`、`--model`）：若不带这些标志，它会检查配置文件中指定的方法。预演运行自身的退出代码绝不会使 CI 步骤失败，因此其 `--max-cost` 警告说明了如何设立门禁：从 `--json` 摘要中读取 `maxCost.wouldStop`（或 `realRun.exitCode`）——例如 `jq -e 'select(.level == "summary") | .preflight.ready and (.maxCost.wouldStop | not)'`。[CI 指南的检查步骤](/docs/guides/ci-cd#check-before-sync)正是这样做的，并且在失败时会打印原因（`realRun.reasons`）而非仅显示无修饰的 `false`。预演运行的 `totalPluralGaps` 会统计磁盘上缺少该语言常用形式且实际运行不会再次请求的复数消息，且 `verify` 为 `{ "ran": false }`（未写入任何内容，因此未进行任何验证）。

**重新翻译**：`--redo` 指定*重新翻译什么*，而 `--fresh` 指定*是否为其付费*。如果不加 `--fresh`，缓存中已有的任何内容都会免费返回（并且仍然会通过质量门禁）；若加上该选项，排队等待的所有内容都会重新翻译并计费。旧的标志（`--force`、`--force-keys`、`--force-content`、`--retranslate`、`--no-tm`）仍然有效，其含义与表格中所述完全一致。

**限定文件范围**：`--files` 将内容处理步骤限定在匹配的文件内，而 `--redo files:<glob> --fresh` 会强制为匹配的文件重新翻译（唯一的刻意重新计费场景）。匹配模式与 sync 输出的路径（相对于 `contentDir`，即 `2026-10.md`）以及项目根目录的相同路径（`newsletter/2026-10.md`）进行匹配：`*` 仅匹配单层文件夹内，`**` 可跨越文件夹。这两个标志都可以重复指定。如果某个模式未匹配到任何文件，运行将在产生任何费用前停止。键值处理步骤本身已经是增量的，按常规运行。

**失败处理**：单个内容文件的失败不会影响其他文件。成功的文件会被记录且其翻译会被缓存，运行结束时会列出失败的文件以及每个文件的遗留状态。当文件中存在未翻译的键时，文件输出行绝不会显示为 `[OK]`。失败摘要会逐键说明下一次 sync 将采取的操作：重新请求（无可用答案）、再次请求一次（因 redo 而处于待处理状态）或阻滞（被质量门禁拒绝）。被门禁拒绝的 Markdown 区块和 front-matter 字段也会按页面以相同方式阻滞；`--redo files:<page>` 或 `--redo content` 会重新请求（[质量门禁](/docs/concepts/quality-gate#refused-markdown-blocks-and-front-matter-fields)）。退出代码为 `0`（全部成功）、`2`（部分成功：完成部分工作，某些内容失败、被阻滞或未通过验证，或者写入的复数消息缺少该语言在常规计数中使用的形式——或者在产生任何费用前被 `--max-cost` 终止）或 `1`（全部未成功）。

**变更检测**：champollion 将 SHA-256 哈希值保存在 `.champollion.lock` 中。当源值发生变化时，下一次 sync 会自动重新翻译这些键。请提交该 lock 文件，以便所有开发者共享基线。lock 文件还会按目标语言区域记录 sync 写入的每个值的指纹（这样人工编辑的值就能被识别，并在批量重做时予以保留——[编辑翻译](/docs/guides/professional-translators#editing-key-value-files)）、redo 未能完成的键（**pending**：下一次 sync 会再次请求一次）以及质量门禁拒绝的键（**held back**：普通 sync 不会再次发送给同一模型——[质量门禁](/docs/concepts/quality-gate#refused-keys-are-held-back)）。

**人工编辑与重做**：`--redo all`、`--force` 以及切换模型操作都会保留人工编辑的值，并指明保留了哪些值；指定键名的 `--redo keys:<key>` 会替换该值；源文本发生变更的键会被重新翻译。被替换的人工编辑内容会被打印并追加到 `.champollion-replaced-edits.jsonl` 中（已被版本控制跟踪——请随 lock 文件一同提交）。

**带有上下文的 gettext 键**：键由 `msgctxt` + U+0004 + `msgid` 构成。报告将分隔符打印为 `␄`，`--redo keys:` 和 `--force-keys` 也能识别该输入；若要手动输入，可写作 `\x04`：`--redo 'keys:django::verb\x04Open'`（单引号可保留反斜杠）。两种拼写均可使用。修复命令会输出 `␄` 格式，其后跟有指出 `\x04` 的 shell 注释。

**指定的键未匹配到任何内容**：当 `--redo keys:` / `--force-keys` 指定的名称不存在于任何源键中时（输入错误，或是仅存在于特定上下文中的 msgid），命令失败并退出 1。错误信息会以两种拼写形式列出最接近的键，包括该 msgid 的所有上下文变体。当没有一个名称匹配时，不会执行任何操作。当部分名称匹配时，匹配项会被重做，随后运行失败并列出剩余未匹配的名称。

**指定的键由缓存提供**：若不带 `--fresh`，redo 会直接提供缓存中的内容（重新核验且无费用）并予以说明，同时给出可再次向模型发出请求的 `--fresh` 命令及其费用。

**并行性**：JSON 键翻译和内容翻译都并行运行。JSON 语言环境同时翻译（默认：200 个并发语言环境），每个语言环境内的批次也并行化（4 个并发批次）。内容翻译（Markdown、MDX、博客文章）在平面工作项池中运行（默认：48 个并发 API 调用）。使用 `--json-concurrency`、`--content-concurrency` 或 `--concurrency` 覆盖（同时设置两者）。

**输出**：同步显示版本横幅、格式/框架检测、成本估计和每个语言环境的进度条：

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

进度条在每批（约 80 个键）处理后就地更新。使用 `--quiet` 可仅输出错误/警告，使用 `--json` 可获得机器可读的 NDJSON 输出。这两个选项都会静音进度条和横幅。使用 `--json` 时，在 `--max-cost` 门禁前会收到 `cost` 事件，每个内容文件和语言区域都会收到 `file` 事件，且每次运行都以 `summary` 结束。

### 退出代码 {#sync-exit-codes}

| 代码 | 实际运行 | 预演运行（`--dry`） |
|------|------------|---------------------|
| `0` | 排队的所有内容均已翻译并通过验证，或没有排队内容。 | 已执行——即使提示实际运行将会停止也是如此。 |
| `2` | 部分成功：完成了部分工作，但有内容失败、被阻滞或未通过验证，或者写入的复数消息缺少该语言在常规计数中使用的形式。此外：`--max-cost` 在发送任何内容之前终止了运行。 | 从不。 |
| `1` | 全部未成功，或运行无法启动：缺少方法所需的密钥、运行所需的模型服务器无响应、重做指定的键未匹配到任何内容、`--files` 模式未匹配到任何文件，或配置无效。 | 预演运行本身无法运行：重做指定的键未匹配到任何内容、`--files` 模式未匹配到任何文件，或配置无效。 |

预演运行特意以 `0` 退出：它是您在做决策前运行的预览，仅作检查的 CI 步骤绝不能直接报错失败。实际运行将执行的操作会显示在预演运行的最后几行以及其 `--json` 摘要中：`preflight.ready: false` 意味着实际运行将在翻译前停止并以 `1` 退出（`preflight.failures` 会说明原因）；`maxCost.wouldStop: true` 意味着它将在达到上限时停止并以 `2` 退出（`maxCost.exitCode: 2`）；`maxCost.exitCode: 1` 伴随 `maxCost.stopsEarlier` 则意味着预检会在检查上限前将其停止。`realRun.exitCode` 将它们以及会导致实际运行处于部分成功状态的因素综合在一起：被阻滞的键，或磁盘上缺少该语言常用形式且不会再次请求的复数消息（`2`；`realRun.reasons` 会列出它们，预演运行的最后一行也会对此说明）。质量门禁的拒绝或验证失败（只有实际运行才能发现）仍可能将预测的 `0` 转变为 `2`。[CI 指南的检查步骤](/docs/guides/ci-cd#check-before-sync)会将它们转化为打印出失败原因的失败 CI 步骤。

---

## watch

源语言文件更改时自动同步。运行直到被 `Ctrl+C` 中断。

```bash
champollion watch
```

---

## audit

完整性门禁。列出每个未翻译的键——缺失、为空或仍为 `[EN]` 回退标记——以及每个**已过期（out of date）**的翻译：即基于早于当前源文本的版本生成的翻译（依据 `.champollion.lock`；源文本被编辑但重新翻译失败时留下的正是这种情况）。每个过期列表末尾都会附上用于重新翻译它的命令。如果发现任何此类键，则以代码 1 退出——可用作 CI 门禁，使包含未完成或过期翻译的构建失败。

```bash
champollion audit
champollion audit --json   # summary carries untranslatedKeys and outOfDateKeys per locale
```

---

## verify

从磁盘重新读取所有语言环境文件，并验证翻译确实存在且正确。这与每次 `sync` 结束时自动运行的验证相同（除非传递了 `--no-verify`）。

```bash
champollion verify                    # verify all locale files
champollion verify --warn-only        # non-blocking
champollion verify --strict           # warnings fail too
champollion verify && echo "All good" # CI gate
champollion verify --json             # one "verify" record per locale (NDJSON)
```

**检查项：**
- 键一致性（Key parity）——每个目标语言中均存在所有源键（对于 i18next 复数键，须包含该区域自身 CLDR 复数形式的键：法语也需要 `count_many`）
- 先前运行留下的 `[EN]` 回退标记
- 空翻译
- 书写系统合规性（Script compliance）——非拉丁语区域不得包含纯拉丁文本；字母按 Unicode 书写系统（script）分类，因此带重音符和全角拉丁字母均计为拉丁字母。在 CJK 排版之外的任何区域中出现全角拉丁字母均视为错误
- 占位符，每项检查发现均根据涉及的语法命名——ICU MessageFormat 结构（`ICU structure error`：`{name}` 参数、被翻译的 plural/select 关键字或选择器、丢失的 `#`）、printf 转换（`printf/python-format placeholder mismatch`：`%s`、`%d`、`%(name)s`——gettext 目录中丢失的 `%(name)s` 命名为 printf 而非 ICU）、i18next 插值（`i18next {{…}} placeholder mismatch`：`{{name}}`，包括写作 `{name}` 的 `{{name}}`，i18next 会将其原样输出），以及 ICU 消息外部的单花括号 `{name}`（`{…} placeholder mismatch`）
- 标记（Markup）——每个标签名具有与源文本相同的开始标签、结束标签和自闭合标签，且具有相同的嵌套方式（丢失 `</strong>` 视为错误）
- 编码问题——BOM 标记、不可见字符
- 源文本回显（Source echoes）——值与源文本完全相同（警告）
- 复数形式——缺少该语言常规计数所用形式的复数消息（俄语 `few`/`many`）、复数形式仅重复 `other` 的 gettext 条目（sync 会用 `# champollion:` 注释标明）、该语言不存在的形式的 i18next 键或 `msgstr[n]`（警告）
- 相同语言区域——两个目标语言区域在绝大多数键上具有相同文本：很可能其中一个区域使用了另一个区域的语言（警告）
- 相同译文，不同源文本——为多个不同的源字符串输出了相同的文本（模型重复背诵的句子）：两个明显不同的多词源字符串返回了相同的包含 4 个或更多词的文本，或者在其他情况下包含 3 个或更多词的文本；早期 sync 捕获到模型重复的句子即使只出现一次也会计入。统计范围涵盖键值、每个 ICU plural/select 分支（一个复数形式的分支计为一个源文本）以及该区域的 Markdown 页面（front-matter 字段和区块；不计 `# ` 和末尾标点），遵循与 `sync` 门禁相同的拒绝规则（错误）
- 过期（Out of date）——基于早于当前源文本的版本生成的翻译（此处为警告；`audit` 会对此报错失败）
- 丢失问号或感叹号——源文本以 `?` 或 `!` 结尾，而译文既不以此结尾，也不以目标书写系统的等效字符（`？`、`؟`、希腊语 `;` 等）结尾。此项为警告：某些语言使用单词或语气词来表示疑问

它检查的是结构而非语义：检查通过仅说明键、占位符、复数形式、标记和书写系统完好无损，并不代表译文表意准确——在正式投入使用前请让该语言母语者进行审校。

**检查哪些区域。**`verify` 检查所有区域；`verify --pair en:fr` 仅检查法语。在 `sync --pair en:fr` 之后，同步后检查仅覆盖运行过的语言对，不包含其他语言对。限定范围的检查会在结束行中予以说明——`Verification passed for fr: … intact (only en:fr was synced; champollion verify checks every locale)` — and never "in every locale"; with `--json` 该行包含 `checked`（已检查的区域）和 `scope`。

**复数覆盖度。**每个语言区域的区块针对其文件包含的每种复数类型各有一行——i18next 后缀键、ICU 复数消息、gettext `msgid_plural` 条目——列出该区域预期拥有的形式（对应的 CLDR 复数类别；在 gettext 目录中为其 `Plural-Forms` 预留槽位的形式），并说明是否每个复数都包含这些形式：

```text
  ── fr ──────────────────────────────────────
  [OK] 7/7 keys present
  Plural forms (CLDR fr): one, many, other ✓ — 2 i18next plural key group(s), every form present
```

`✗` 列出缺少形式的复数。仅在大于 1000 的数字或分数中使用的形式（ICU 消息中的法语 `many`）会单独说明：`other` 形式会作为其替代，这不计为检查发现。该行为汇总行——缺失的形式在其上方也作为检查发现呈现（缺失键、复数警告）。

**`--json`** 每行写入一个 JSON 对象。每个语言区域在 stdout 上对应一条记录——`{"level": "event", "event": "verify", "locale": "fr", …}`——包含 `ok`、`keys`（`expected`、`present`、`missing`、`extra`）、其 `errors`、`warnings` 和 `infos`、`placeholders`（每项发现带有其 `syntax`：`icu`、`printf`、`i18next`、`brace` 或 `markup`）以及 `plurals`（按类别和类型：`categories`、`total`、`complete`、`incomplete`）。各项发现也会作为 `error`/`warn` 行输出到 stderr，结束行保留其级别和消息（检查通过时在 stdout 输出 `ok`，未通过时在 stderr 输出 `error`）并包含 `errors` 和 `warnings` 计数。在 sync 之后，相同的记录会出现在 sync 自身的摘要之前。（Docusaurus 项目的记录不包含 `keys` 或 `plurals`：其 UI 字符串是按文件逐个检查的。）

```bash
npx champollion verify --json 2>/dev/null | jq -c 'select(.event == "verify") | {locale, plurals}'
```

**退出代码：**当发现错误——或完全无法执行检查时（源文件或 locales 文件夹不在配置所指向的位置；错误行会指明路径和配置项）为 `1`，否则为 `0`。警告不会导致命令失败，除非传入 `--strict`，此时遇到任何警告均以 `1` 退出（适用于绝不允许发布例如缺少 `few`/`many` 形式的俄语复数的 CI 环境），并以 `[FAIL]` 行结束，绝不以 `[OK]` 结束；`--warn-only` 也会使错误以 `0` 退出。键数量不正确的区域会明确指出这一点，而非显示 `[OK]`：`8 expected, 9 present (1 extra: count_two)`。

---

## lint

扫描源代码中应使用 i18n 翻译调用的硬编码用户界面字符串。自动检测您的框架（next-intl、react-i18next、vue-i18n、Hugo）。

```bash
champollion lint                    # exits 1 if issues found (or no source files were found)
champollion lint --warn-only        # always exits 0
champollion lint --src ./app        # custom source directory
champollion lint --min-length 4     # minimum string length to flag
```

**检测内容：**
- JSX 文本、`placeholder`、`alt`、`aria-label`、`title` 中的硬编码字符串
- 具有用户界面内容但没有 i18n 框架导入的文件
- 死键 — 没有源文件引用的语言环境键
- 覆盖率分数 — 通过 i18n 的字符串百分比

**排除项**：在项目根目录中创建 `.champollionignore`（glob 模式，如 `.gitignore`）。

**无内容可 lint 即为失败**：当没有源文件匹配时（框架的默认文件夹——对于 Web 项目为 `src/`、`app/`、`pages/`、`components/`——或您的 `--src`），lint 会以 `1` 退出并指出其查找过的文件夹和扩展名。未检查任何内容的 lint 绝不能通过 CI 门禁；请使用 `--src <dir>` 或 `"lint": { "srcDir": "<dir>" }` 将其指向您的代码。

---

## wrap

自动包装由 `lint` 检测到的硬编码字符串，使用 `t()` 调用。在修改文件前创建自动备份。

```bash
champollion wrap                    # auto-wrap with backup
champollion wrap --dry              # preview wrapping changes
champollion wrap --undo             # restore from .champollion-backup/
```

**安全门控：**
1. Git 清洁检查（在干运行中跳过）
2. 自动备份到 `.champollion-backup/`
3. 每次文件写入前的差异预览
4. `--undo` 支持从备份恢复

---

## seo

为多语言网站生成 SEO 工件。

```bash
champollion seo hreflang                                        # print hreflang tags
champollion seo sitemap --base-url https://example.com --out sitemap.xml
champollion seo jsonld --base-url https://example.com           # JSON-LD schema
```

| 子命令 | 输出 |
|--------|--------|
| `hreflang` | `<link rel="alternate" hreflang>` 标签 |
| `sitemap` | 多语言 `sitemap.xml` |
| `jsonld` | JSON-LD WebSite 语言架构 |

---

## integrity

检测翻译语言环境文件中的损坏和漂移。

```bash
champollion integrity               # exits 1 if issues found
champollion integrity --warn-only   # non-blocking
```

**检查项：**
- 占位符损坏（例如源文本中存在 `{name}` 但目标文本中缺失）
- 编码问题（乱码、无效 Unicode）
- 未翻译的副本（目标值与源文本完全相同）——[`noTranslate`](/docs/getting-started/configuration#no-translate) 键可豁免，翻译记忆库确认由流水线生成且经门禁批准的回显文本亦可豁免。剩余被标记的内容恰好是 `sync` 会重新排队的内容——这两个工具对于正常文件不会产生分歧
- 无需翻译项漂移（No-translate drift，即与源文本*不*相同的 `noTranslate` 键）——报告预期值与实际值并将不可见字符转义；运行 `champollion sync` 进行修复
- 非预期的 PUA（在[文字转换](/docs/getting-started/configuration#script-conversion)已关闭的区域中出现私用区码位——若无特殊字体则显示为空白）；运行 `champollion repair-script` 进行修复
- 掏空值（Hollowed values，目标文本为删除了字母的源文本——来自早于内容保留门禁的流水线损坏）；使用 `sync --force-keys <key>` 或 `sync --pair <pair> --force` 重新翻译
- 孤立键（目标文件中存在但在源文件中不存在的键）
- ICU MessageFormat 复数类别完整性（例如阿拉伯语需要 6 个类别）——遵循与 `sync` 和 `verify` 相同的规则：常规计数涵盖的缺失形式（俄语 `few`/`many`）为警告；仅大于 1000 的数字或分数涵盖的形式（法语 `many`，用于 1 000 000）为提示，因为此处会使用 `other` 形式

---

## repair-script

还原不应发生的文字转换：在配置指明转换已关闭的区域中，PUA 编码的值（pIqaD、Tengwar、Kryptonian）会通过转换器自有的反向映射表还原为罗马化拼写。

```bash
champollion repair-script --dry     # preview
champollion repair-script           # repair in place
```

| 选项 | 说明 |
|--------|--------|
| `--dry` | 仅预览修复结果而不写入 |
| `--locale <code>` | 仅修复单个区域 |
| `--json` | 机器可读的 JSON 输出 |
| `--warn-only` | 即使残留无法还原的 PUA 亦以 0 退出 |

pIqaD 可以完全精确还原。Tengwar 和 Kryptonian 的还原无法恢复大小写（标记为 case-lossy）。翻译记忆库无需修复——它存储的是转换前的值。当残留任何已注册转换器无法还原的 PUA 时，命令以 1 退出。

---

## tm

管理翻译记忆库缓存（`.champollion/tm.json`）。TM 存储之前的翻译，并在后续同步中提供它们，而不是调用 API。

```bash
champollion tm stats                  # show cache statistics
champollion tm clear                  # clear cache (with confirmation)
champollion tm clear --yes            # clear without confirmation
champollion tm clear --locale fr      # clear only French entries
```

| 子命令 | 输出 |
|--------|--------|
| `stats` | 条目计数、文件大小、每个语言环境的细分 |
| `clear` | 删除缓存文件（完整或按语言环境） |

| 选项 | 效果 |
|--------|--------|
| `--locale <code>` | 仅清除一个语言环境的条目 |
| `--yes` | 跳过确认提示 |

参见 [翻译记忆库](/docs/concepts/translation-memory) 了解 TM 的工作原理以及何时清除它。

---

## xliff

导出和导入 XLIFF 1.2 文件供专业翻译人员审查。XLIFF 是由 CAT 工具（如 memoQ、SDL Trados 和 Phrase）支持的通用交换格式。

```bash
champollion xliff export --locale fr                   # export French XLIFF
champollion xliff export --locale ja --out ./review/   # custom output path
champollion xliff import .champollion/xliff/fr.xliff       # import reviewed file
champollion xliff import ./reviewed.xliff --dry        # preview import
```

| 子命令 | 输出 |
|--------|--------|
| `export` | 从源 + 目标语言环境文件生成 `.xliff` |
| `import` | 将审查的 `.xliff` 翻译合并到语言环境文件中 |

| 选项 | 效果 |
|--------|--------|
| `--locale <code>` | 导出的目标语言环境（必需） |
| `--out <path>` | 自定义输出路径或目录 |
| `--dry` | 预览导入而不写入 |

参见 [与专业翻译人员合作](/docs/guides/professional-translators) 了解完整工作流程。

---

## status

显示语言对配置、已安装的插件以及基准评分。

配置中设置了 `qualityTier`（`standard`、`high`、`research` 或 `verified`）的语言对会显示该项，并如实指明：这是您选择的标签，而非衡量指标——无论其内容为何，sync 的翻译行为都相同，而 `serve` 会对其进行公开展示。未设置该项的语言对则显示为无（`--json` 仍带有 `qualityTier`，包含 `qualityTierSet: false`）。

```bash
champollion status
```

在切换模型后，它还会指明某个区域的文件何时混合了来自多个模型的文本（源自翻译记忆库：记录了磁盘上的每个值是由哪个模型生成的），并附带可让当前模型翻译早期模型所写内容的命令——`sync --pair <pair> --redo all --fresh-on-model-change`。
对于运行您所选模型的方法（`local`、`api`、`external`），它会重申首次 sync 时打印过一次的许可证说明。对于 OpenAI 兼容的方法（`local`、`openai`），它会显示请求发送到的地址以及选定该地址的配置：环境变量或 `.env` 中的 `LOCAL_API_BASE`，或者默认值（Ollama，`http://localhost:11434/v1`）。若指定了 `contentDir`，它会在键值文件旁列出内容文件夹，包含其拥有的源页面数量，以及按语言统计有多少翻译是最新、已过期或待处理的。
待处理（Pending）表示尚未翻译，或是被质量门禁拒绝且仍保留为源语言的部分（内容 lock 文件中标记为 `pending:<hash>`）。
在每个语体下方，它会显示 LLM 提示所携带的性别指引及其来源（Champollion 对该语言的默认设置、您的配置，或关闭——参见[性别指引](/docs/getting-started/configuration#gender-guidance)）。
对于带有回退方案的语言对，它会统计文件中由回退方案写入的值的数量，并列出前几个。
`--json` 包含与 `requestsGoTo`（在具有此类端点的语言对或回退方案上）、`content`、`genderGuidance` 和 `fallback.valuesInFiles` 相同的内容。

---

## provenance

审计所有已安装插件的翻译资源许可。

```bash
champollion provenance
```

---

## plugin

管理翻译方法插件。插件是预打包的翻译配方，安装到 `.champollion/methods/`。

```bash
champollion plugin list                      # show installed plugins
champollion plugin install ./my-method/      # install from local directory
champollion plugin remove my-method          # remove a plugin
```

参见 [插件规范](/docs/reference/plugin-spec) 了解插件清单格式。

---

## leaderboard

`champollion network leaderboard`（亦可写作 `champollion leaderboard`）。浏览、搜索并安装来自网络排行榜的翻译方法。从排行榜安装的方法附带基准测试评分和完整的规范 MethodConfig——即评估期间使用的精确配置。

```bash
champollion network leaderboard                       # show leaderboard
champollion network leaderboard --pair "eng>fra"      # filter by language pair (quote the >)
champollion network leaderboard --install 1           # install the method ranked 1 as a plugin
champollion network leaderboard --install 1 --apply   # install + patch config
```

| 选项 | 说明 |
|--------|--------|
| `--pair <pair>` | 按排行榜所写格式过滤语言对：`"eng>fra"`（ISO 639-3；需给 `>` 加引号）。`eng-fra` 和 `eng:fra` 亦可使用，且 2 字母代码会自动解析（`en` → `eng`） |
| `--install <rank>` | 将位于该排名的翻译方法（按列表所示）安装为插件 |
| `--apply` | 安装后，自动将 `methodPlugin` 添加至 `champollion.config.json` |

**`--apply` 工作流程：** 当您使用 `--apply` 安装时，champollion 将方法插件写入 `.champollion/methods/` **并且** 修补您的 `champollion.config.json` 以将其用于相关对。这是从"什么分数最高？"到"我在生产中使用它"的最快路径。

---

## fonts

下载和管理构造语言脚本转换器的 PUA 网络字体。使用私有使用区字符的语言（克林贡语、辛达林语、氪星语）需要自定义网络字体来呈现其脚本。此命令从经过验证的开源存储库下载它们。

```bash
champollion fonts list                           # show needed fonts
champollion fonts install                        # download all needed fonts
champollion fonts install --css                  # also generate CSS snippet
champollion fonts install --dir ./public/fonts   # custom output directory
```

| 子命令 | 输出 |
|--------|--------|
| `list` | 显示需要哪些 PUA 字体及其安装状态 |
| `install` | 为配置的语言下载字体 |

| 选项 | 效果 |
|--------|--------|
| `--dir <path>` | 覆盖字体输出目录（从项目类型自动检测） |
| `--css` | 生成 `conlang-fonts.css` 代码片段以及字体 |
| `--config <path>` | 配置文件的路径（用于检测哪些语言需要字体） |

**自动检测：** 输出目录从您的项目结构推断：
- **Docusaurus** → `static/fonts/` 或 `website/static/fonts/`
- **Hugo** → `static/fonts/`
- **默认** → `public/fonts/`

**原生 Unicode 转换器**（`crk` → 克里音节文、`sr` → 塞尔维亚西里尔字母）**不**需要字体安装。

参见 [构造语言、脚本和正字法](/docs/guides/conlangs-scripts-orthography) 了解完整的 PUA 字体详情。

## 三层管道

将 `lint`、`sync` 和 `audit` 一起使用以实现防弹 i18n：

```json title="package.json"
{
  "scripts": {
    "i18n:lint": "champollion lint",
    "i18n:sync": "champollion sync",
    "i18n:audit": "champollion audit"
  }
}
```

| 层 | 命令 | 何时 | 目的 |
|-------|---------|------|---------|
| **Lint** | `lint` | 提交前 | 阻止包含硬编码字符串的提交 |
| **Sync** | `sync` | 提交后 / CI | 翻译缺失和更改的键 |
| **Verify** | `verify` | 同步后 / CI | 确认翻译存在且正确 |
| **Audit** | `audit` | 构建步骤 | 如果任何语言环境有 `[EN]` 标记，则使部署失败 |

---

## 另请参阅

- [配置](/docs/getting-started/configuration) — 配置文件参考
- [翻译方法](/docs/guides/translation-methods) — 每对的方法选择
- [翻译记忆库](/docs/concepts/translation-memory) — 缓存和成本节省
- [与专业翻译人员合作](/docs/guides/professional-translators) — XLIFF 工作流程
- [插件规范](/docs/reference/plugin-spec) — 插件清单格式
- [CI/CD 指南](/docs/guides/ci-cd) — 在管道中自动化 CLI 命令
- [同步工作原理](/docs/concepts/how-sync-works) — 理解同步管道
- [质量门控](/docs/concepts/quality-gate) — 翻译验证方式
