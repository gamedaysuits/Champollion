---
title: "服务与部署"
slug: /agents/serving
description: "让经过测量的模型投入实际使用：nmt-forge export 写入的 deployment/1 文件、mt-eval translate 与 serve、nmt-forge serve 及其试用页面、service-api/1 的 /translate 契约、由 Agent 驱动的 champollion connect 与 champollion sync——以及仅本地输出允许与禁止的操作。"
---

# 服务与部署

**部署就是仅针对源语言输入的度量流水线。** 一份
deployment/1 文件指定了方法、模型、门禁以及语言对。
同一份文件在测试集上测试、针对文件运行并对外提供服务，因此被度量的就是交付的。本页是面向智能体的半部文档，对应于
[投入使用](/docs/put-it-to-work)。

贯穿始终的原则：从标记为 local-only 的句子中学习的模型可能会复现这些句子，因此**其输出也同样是 local-only 的**。下文中的每个工具都会将该输出保留在本机上，除非数据持有者另有约定，且
`--holders-agreed-by` 会记录谁同意了该约定。**注意。** 仅在对方明确告知持有者已同意之后，才传入对方提供给你的姓名作为该标志的参数。

## deployment/1

`$schema` `https://champollion.dev/schemas/deployment/1.json`。必填字段：`id`、
`pair`（`source`、`target`，可选 `target_script`）、`method`（`method`，
可选 `model`）。可选字段：`gates`（gate-chain/1 文件）和 `serve`
（`host`，默认 `127.0.0.1`；`port`）。路径相对于项目根目录（即 rails 运行命令的位置）。它不指定任何评分。

**由谁写入。** 当导出位于 rails 项目内部（上方存在 `champollion.project.json`）时，`nmt-forge export` 会写入
`deploy/<name>.json` —— `<name>` 为短横线命名法（kebab-case）的 `--name`，否则为
`nmt-forge-<run>`：

```json
{
  "$schema": "https://champollion.dev/schemas/deployment/1.json",
  "id": "nmt-forge-<run>",
  "description": "nmt-forge <backend> model <run> (<src>→<tgt>), written by nmt-forge export <version>",
  "pair": { "source": "<src>", "target": "<tgt>" },
  "method": { "method": "local-model", "model": "<export>/model" }
}
```

在以下情况下它不会写入任何内容（并提示 `no deployment file: …`）：导出位于 rails 项目之外、模型是在解码钩子下选定的（只有 `nmt-forge serve` 会运行 forge 的钩子）、配置未指定语言对、文档未通过校验，或者 `deploy/<name>.json` 已经部署了另一个模型（绝不会被替换）。

**由谁读取。**

```bash
mt-eval run --deployment deploy/<name>.json --corpus <test set>          # measure exactly what it serves
mt-eval translate --deployment deploy/<name>.json --source-file <input> --out <output>
mt-eval serve --deployment deploy/<name>.json
```

**锁定机制。** 使用 `--deployment` 时，`run` 和 `translate` 会拒绝 `--method`、
`-m`/`--model`、`--gates` 与 `--target-script`（*“--deployment … 指定了方法、模型、门禁以及目标脚本；请去掉 …（或修改该文件）”*）；`serve` 还会拒绝 `--pair`。其他语言对的输入将被拒绝（`deployment <id> translates from <src>; this input is in <x>`）。包含回退门禁链的部署可以进行翻译和对外提供服务，但不能进行度量：`mt-eval run` 会拒绝包含回退的门禁链（[方法与门禁](/docs/agents/methods#gate-chains)）。

## 导出包含的内容

`nmt-forge export <run-manifest.json> --prereg <id> --out <dir>` 会写入：

| 路径 | 含义 |
|---|---|
| `<dir>/model/` | 要部署的文件夹：权重与分词器、`forge-model.json`（其训练所用的数据，`trained_on.terms`）、`DEPLOY.md` |
| `<dir>/model/champollion-plugin/method.json` | method/1，类型为 `nmt-checkpoint`，`service.endpoint` `http://127.0.0.1:<port>/translate`（端口为 8378，除非指定 `--port`），`card.commercial_ready: false`，包含测试集 chrF++、其置信区间及 n 的 `evidence` |
| `<dir>/evaluation/` | 测试集凭据。切勿将其与模型一同复制 |
| `<dir>/input-words.json` | 训练句子输入端的词汇，去重后排序（`words`、`english`、`sentences`、`from`，以及指示在运行时无法读取的训练文件的 `notes`）。存放在 `model/` 旁边，绝不放在其中：它们是来自族群数据的词汇。当导出包含模型且其训练文件位于本机时写入；否则导出的摘要会提示 `input_words.written: false` 并附带 `why`。`nmt-forge serve` 读取它以标出模型从未见过的词汇（[见下文](#words-the-model-never-saw)） |
| `<dir>/README.md` | 该导出的说明 |

## `mt-eval translate`

针对文件的流水线，不进行评分。`--out` 接收 `.jsonl`（每个分段一行：`id`、`source`、`output`、`error`，若启用门禁则包含 `gates`、
`shipped_from`、`fallback`）或 `.tsv`（源文本、制表符、输出）。若未指定 `--out`，
它会在输出文件夹中写入 `<run id>.translations.jsonl`（`-o`）。输出会通过 set/1 附属元数据文件携带输入及模型的条款。

**锁定机制。** 当该方法的输出为 local-only 时（或其门禁链回退方法的输出为 local-only 时），在翻译任何内容之前，写入项目外部的目标路径将被拒绝：*“拒绝写入 …：此方法写入的内容为 local-only（…），而该路径位于 … 之外 —— 这是数据持有者并未选择的位置。只有他们才能同意此操作 —— 请向他们征求许可；如果他们同意：--holders-agreed-by "<who
agreed>"（记录在文件的附属文件中；它仍保持标记为 local-only）。或者将其写入项目内部”*。获得同意后，附属文件会记录 `holders_agreed: {by, date}`；对所有工具而言，该文件仍保持 local-only 标记。

`--json` 会打印 `translated`、`errors`、`out`、`run_id`、`marked`、
`holders_agreed` 和 `output_gates`。当所有行均失败时退出代码为 1。`--publish`
会被拒绝：因为不存在评分。

## `mt-eval serve`

| | |
|---|---|
| 默认地址 | `127.0.0.1:8379`（`--host`、`--port`，或部署的 `serve` 块） |
| 服务内容 | 仅限在此进程中运行的方法：`lexicon`、`local-model`，或其 method.json 声明了 `dependency_class` 为 `S` 或 `O` 的插件。LLM 或托管引擎会被拒绝 |
| 令牌 | `MT_EVAL_SERVE_TOKEN`，仅从环境变量读取。监听除 `127.0.0.1`、`::1` 或 `localhost` 之外的任何地址时为必填项；一旦设置，在每个 `POST` 上均为必填（包括环回接口）。`GET /health` 绝不需要它 |
| 限制 | 1,000,000 字节请求体、500 个键、单个字符串 20,000 个字符 —— 超过任何一项均返回 `413` |
| 门禁 | `--gates <chain>`（或部署的 `gates`）。每个门禁插件都必须能在无需参考译文的情况下进行评判，否则不会启动。此处允许使用回退，且必须在此进程中运行 |

**锁定机制 —— 非环回地址。** 未提供令牌时：*“拒绝在未提供令牌的情况下监听 … —— 任何能访问该端口的人都将可以使用该方法”*。在输出为 local-only 且未经同意时：*“拒绝在 … 上提供服务：此方法写入的内容为 local-only（…），而其他机器可访问的地址会将其发送到本机之外。只有数据持有者才能同意此操作 —— 请向他们征求许可；如果他们同意：--holders-agreed-by "<who agreed>"（在 /health 上报告），或者保持 --host 127.0.0.1”*。当词典的附属文件如此声明（或无法读取），或者模型文件夹的 `forge-model.json` 记录了 local-only 训练条款或未记录任何条款时，输出为 local-only；对于没有 `forge-model.json` 的插件或模型文件夹，则报告为未知（`null`）。

`/health` 会响应 `status`、`method`、`model`、`pair`、`deployment`（`id`、
`sha256`）、`runs`（在此进程中 —— 不会向任何地方发送任何内容）、`scored`
（无内容）、`output_gates` 和 `gates`（链 ID、指纹、门禁、回退）、
`output_local_only`、`output_local_only_why`、`holders_agreed_by`、`license`
（`AGPL-3.0-or-later`）、`source`（仓库）和 `version`。

启用门禁时，被拒绝的分段将按其门禁的规定返回：`drop` —— `errors` 下的键；`keep-source` —— 源文本；`flag` —— 输出，即 `meta.gates.flagged` 中指定的键；`fallback` —— 在门禁接受时回退方案的翻译。未启用门禁时，它不会检查返回的任何内容。

## `nmt-forge serve`

```bash
nmt-forge serve <export>/model --detach        # a supervised background job
nmt-forge serve <export>/model --choose        # also record it as the people's choice
nmt-forge jobs                                 # list jobs
nmt-forge jobs stop <name> --wait 120
```

| | |
|---|---|
| 默认地址 | `127.0.0.1`，端口 `NMT_FORGE_SERVE_PORT` 或 8378 |
| 令牌 | `--token` 或 `NMT_FORGE_SERVE_TOKEN`；在非环回地址上为必填。`--detach` 仅从环境变量获取 |
| 路由 | `GET /` —— 供人使用的试用页面（无需令牌；若设置了令牌则会要求输入）；`GET /health`；`POST /translate`（service-api/1）；`POST /v1/chat/completions`（兼容 OpenAI）；`GET /v1/models` |
| `--detach` | 在 `/health` 响应后立即返回；若在 120 秒内未响应则停止。当端口已在响应时会被拒绝 |
| `--no-hook` | 在不使用运行的解码钩子的情况下提供服务（在 `/health` 和 `meta` 中指明） |
| `--allow-locale` | 同时接受这些语言区域代码（可重复传入） |
| `--device` | `auto`（默认）或 `cpu`。使用 `auto` 时，若在同一项目的训练任务运行时启动服务，服务器将占用 CPU 而非共享 GPU，且 `/health` 会说明此情况（`device_note`） |
| 限制 | 单请求支持 1,000,000 字节请求体、500 个键、单个字符串 20,000 个字符、5,000 个模型工作单元 —— 超过任何一项均返回 `413`。模型一次处理 32 个单元，因此来自其他请求的句子只需等待一个分块，绝不需要等待整个请求。运行时间超过 600 秒的请求将被整体拒绝 —— `503`，*“一次发送较少的分块”* —— 绝不返回部分结果 |
| 解码 | 当导出记录了 `beams_applied` 时，使用导出的 `num_beams` 进行束搜索（与度量模型时一致）；较旧的导出则使用贪心搜索。发送的文本会规范化为 NFC，正如训练数据一样 |

**锁定机制。** 在非环回地址上，输出为 local-only 的模型（在 local-only 句子上训练，或没有其学习来源记录的模型）在没有 `--holders-agreed-by` 的情况下将被拒绝。`/health` 会报告 `pair`、`accepts`、
`decode_hook`、`run`、开发集和测试集报告、`score_caveats`、`caveats`、
`trained_on`、`output_local_only`、`holders_agreed_by`、`device_note`、
`limits`（`pieces_per_request`、`pieces_per_turn`、`request_seconds`）、
`unseen_words_check`、`text_pipeline` 与 `output_gates`。来自 local-only 模型的每个 `/translate` 响应均携带 `meta.output_local_only: true`，且每个
`/v1/chat/completions` 响应均携带 `meta.output_local_only`（true 或 false）。
当长度限制截断请求中的任何内容时，其 `meta.cut` 会统计输入端被截断的句子数（`inputs`）以及达到上限而终止的翻译数（`outputs`）（[训练](/docs/agents/training#the-guarded-loop)）。

**注意。** 试用页面是供人使用的。对于 local-only 模型，`try_translation`（MCP）会将他们引导至该页面；绝不要自行调用 `/translate` 来读取其输出（[契约](/docs/agents/contract) §1）。

### 模型从未见过的词汇

句子中若包含模型在训练中从未见过的词汇，无论读起来多么流畅，都极可能翻译错误。在构造的测试语言上，包含模型未曾见过的实义词的留出测试句在 358 次测试中正确翻译的次数为 0（ByT5-small 在 1,600、6,400 和 25,600 个训练对上），且表现出“自信地出错” —— 读来流畅，每个词都是真实存在的形态，但含义完全错误 —— 其比例分别为 32%、55% 和 83%：模型越强大，推测出来的结果就越具有说服力。因此，服务器会明确标出这些词汇。

- **`/health`** 表明其是否支持此功能：`unseen_words_check` 为 `{on: true,
  words_seen: <count of words in input-words.json>, notes}` or `{on: false,
  why}`。
- **`/translate`** 仅在请求包含此类词汇时添加 `meta.unseen_words`（键 → 该键文本中模型从未见过的词汇，按序排列，去重）以及 `meta.unseen_note`。**`/v1/chat/completions`**
  也会添加同样的内容，以所请求的对象为键：分块模式下每个分段为 `SEG_<id>`，页面为 `page`，JSON 对象自身的键，或 `text`。
- **无记录，在每个回复中均作说明。** 服务器从其所提供服务的模型文件夹的上一层目录中读取 `input-words.json`。若那里没有该文件 —— 某台
  export made before 2026-10-13, one made without its training files on this
  计算机，或模型文件夹脱离其导出目录被复制走 —— 则每个回复的
  `meta.unseen_check` 都会说明无法检查及其原因。请直接从模型的
  export, or export it again.
  中提供服务。
- **试用页面** 会标记该行：*“训练中从未见过：… —— 无论读起来多么流畅，此行都极可能翻译错误。”*

词是指任何文字系统中连续的字母序列（内部保留撇号），转为小写并采用 NFC 规范化。当输入端为英语时，常见的英语词尾在双向均视为已见过（见过 `walk` → `walked` 也算见过；见过 `walked` → `walk` 也算见过）。

## service-api/1 —— `/translate` 契约

`$schema` `https://champollion.dev/schemas/service-api/1.json`，遵循
`shared/test-fixtures/framework/service-api-vectors.json`（针对
`mt-eval serve` 与 `nmt-forge serve` 运行）。

- **请求** `POST /translate`：`keys`（键 → 源字符串；必填），
  可选 `source_locale`、`target_locale`、`method`、`text_format`
  （对于文档文本为 `"markdown"`）、`instructions`（键 → 注释；仅发送给声明遵循它们的服务器，`accepts_instructions`）。服务器不使用的字段将被忽略，绝不会被拒绝。
- **响应：** `200` `{translations, meta}` —— `meta` 为必填；`207` 会添加
  `errors`（键 → `{message}`）。错误为 `{error: {message}}`：`400` 表示无法接收的请求，`401` 表示缺少或错误的令牌，`404` 表示未知路由，`413` 表示过大，`500` 表示方法失败 —— 绝不返回部分结果。
  （`nmt-forge serve` 对于超过 600 秒限制的请求还会响应 `503`。）
- **`meta`：** `method`、`model`、`output_gates`、`output_local_only`
  （true、false 或 null）、`cost_usd`；服务器可添加自定义字段。
- **`GET /health`** 必须包含 `status`（`ok`）、`pair`、`output_gates` 与
  `output_local_only`；可选 `output_local_only_why`、`holders_agreed_by`、
  `model`、`method`。
- **规则：** `/health` 声明为 `output_local_only: true` 的服务器必须在每个响应的 `meta` 中放入
  `output_local_only: true`，且客户端仅可在数据持有者同意的位置写入此类输出。

## `champollion connect`

```bash
champollion connect <export>/model --app <app folder>
champollion connect <export>/model --app <app folder> --holders-agreed-by "<who agreed>"
```

它会查找 `method.json`（指定的文件，或文件夹中的 `method.json`、
`champollion-plugin/method.json`、`model/champollion-plugin/method.json`），将其安装到应用的 `.champollion/methods/` 中，并将每个语言对（`<inputLocale>:<target>`）指向它作为 `methodPlugin`，同时保留该语言对的其余配置。应用文件夹需要包含 `champollion.config.json`，且该方法必须从应用的 `inputLocale` 进行翻译。

**锁定机制。** 输出为 local-only 的模型（可从其 `forge-model.json` 中获知，缺失也算作 local-only，或从其服务的 `/health` 中获知）在没有 `--holders-agreed-by` 的情况下将被拒绝：因为它写入应用语言区域文件的内容会随应用一同发布。在提供该参数的情况下，每个语言对都会记录 `holdersAgreed: {by, date, method, what}`。当端点无任何响应时（`nmt-forge serve <dir> --detach` 会启动它），或当 `/health` 未遵循 service-api/1 时，它会发出警告但不会直接失败。`--json` 会打印 `method`、
`kind`、`pairs`、`endpoint`、`answering`、`health_problems`、
`holders_agreed_by`。

## 由智能体驱动的 `champollion sync`

`sync` 使用其 `champollion.config.json` 中指定的方法来翻译应用或网站的语言区域文件。它不进行任何交互式询问。

```bash
champollion sync --dry-run --json      # what would be sent, and its estimated cost
champollion sync --max-cost 2 --json   # stop before any call if the estimate is over $2, or unknown
champollion verify                     # placeholders, scripts, key parity
```

**`--json` 输出**为每行一个 JSON 对象。在标准输出（stdout）上：`{level: "info" |
"ok", message}`, events `{level: "event", event: "cost" | "file" | "verify" |
"request", …}`, and last `{level: "summary", command: "sync", …}`，包含
`dryRun`、`totalProcessed`、`totalFailed`、`totalHeld`、`tmHits`、
`sentToModel`、`verify`（`ran`、`errors`、`warnings`）、`failedPairs`、
`locales`、`costEstimate` 等；演练还会添加 `preflight`、`realRun`
（`exitCode`、`wouldStop`、`reasons`）以及 `maxCost`。在标准错误（stderr）上：`{level: "warn"
| "error", message}`. A hard error prints a summary with `ok: false` 以及
`error`。

| 退出代码 | 含义 |
|---|---|
| 0 | 正常完成 |
| 1 | `--redo` 或 `--force-keys` 名称未匹配到任何键；未处理任何内容即告失败；发生错误 |
| 2 | `--max-cost` 在发起任何调用之前将其终止（或估算值未知）；或部分成功：某些项失败、键被暂扣、缺少复数形式，或校验发现了错误 |

演练不会发送或写入任何内容，不执行校验，且退出代码为 0（除非指定的键未匹配到任何内容或发生错误）。除指定了 `--no-verify` 外，校验会在真正的同步后运行。

**锁定机制 —— local-only 响应。** 对于 `api` 方法，若批处理的 `meta.output_local_only` 为 `true`，则不会写入其内容，除非该语言对的 `holdersAgreed` 指定了该方法；`sync` 会提示一次，并指明 `champollion connect … --holders-agreed-by` 调用。这些键将保持未翻译状态（或转至该语言对的回退方案）。

**锁定机制 —— `local` 方法。** `local` 方法（兼容 OpenAI 的端点）会向服务器的 `/health` 查询一次。当其表明为 `output_local_only: true` 时 —— 就像 `nmt-forge serve` 对在 local-only 句子上训练的模型所做的那样 —— 来自该服务器的任何内容均不会被写入，除非该语言对的 `holdersAgreed` 指定了 `local`：*“位于 … 的模型声明其写入的内容为 local-only … 未写入来自该模型的任何内容”*，随后附上 `champollion connect <the model> --holders-agreed-by "<who agreed>"` 调用。对于 `/health` 未响应或未声明 `true` 的服务器（例如 Ollama 或 LM Studio 服务器），则照常使用。

**注意。** 使用 `champollion connect`（`api` 路由）来连接 forge 模型：它会读取模型自身关于其学习来源的记录，并在所安装的方法下记录持有者对该语言对的同意信息。

**模型从未见过的词汇。** 当 forge 服务器在 `meta.unseen_words` 中列出键时，`local` 和 `api` 方法会针对这些键发出警告 —— 绝不包含文本或词汇本身：*“<API batch N | Local method>：<n> 个键包含模型在训练中从未见过的词汇 —— 无论读起来多么流畅，都极可能翻译错误；请让母语使用者核对它们：<up to 20 keys>”*（随后是 *“以及另外 <n> 个”*）。翻译内容仍会被写入；该警告旨在让人们知晓应当核对哪些内容（[辅导](/docs/agents/coaching)）。

**注意。** 请转达每一行 `warn`。机器翻译的字符串在经母语使用者审核之前均为草稿；切勿称其为正确无误。

## `champollion serve`

另一个服务器：它向其他项目提供**应用项目**自身配置的翻译技术栈（方法、辅导、翻译记忆库、质量门禁）。默认地址为 `127.0.0.1`，端口 1822。即使在环回接口上也需要 Bearer 令牌（`--token` 或 `CHAMPOLLION_SERVE_TOKEN`，至少 12 个字符），除非指定了 `--no-auth`（仅在绑定环回接口时接受）。
`--emit-manifest` 会为使用者写入类型为 `service` 的 method/1 清单。其 `/health` 为 `{ok, service, version}`，而非 service-api/1 健康文档，因此 `champollion connect` 会为其报告健康问题。

## 深入了解

- [投入使用](/docs/put-it-to-work) —— 面向大众的版本。
- [方法与门禁](/docs/agents/methods) —— method/1 与 gate-chain/1。
- [数据与传输规则](/docs/agents/data-rules) —— local-only 与 `holders_agreed`。
- [Rails 模型](/docs/agents/rails-model) —— 单一流水线。
- [`mt-eval` 参考](/docs/reference/mt-eval) 与 [`nmt-forge` 参考](/docs/network/getting-started/forge-command-reference)。
- 应用与网站翻译：[CI/CD](/docs/guides/ci-cd)、[问题排查](/docs/guides/troubleshooting)。
