---
title: "轨道模型"
slug: /agents/rails-model
description: "基于 Champollion 轨道的项目构建方式：项目树、每个工具都会读取的六种经 Schema 验证的格式、从准入输入到实测输出的单一流水线、作为数据的流转历程，以及每一次拒绝的具体结构。"
---

# 导轨模型

导轨上的项目是一个由普通文件构成的文件夹。每个工具——`champollion` CLI、`nmt-forge`、`mt-eval` 以及 MCP 服务器——都能原生读取相同的文件，对照相同的 Schema，给出相同的判定结果。下一步操作始终直接从文件中读取，绝不依靠记忆。（有两项内容位于项目之外：MCP 服务器在其自身生命周期内统计某个步骤的失败次数，以及 nmt-forge 在 `~/.nmt-forge` 中维护一个全机范围的训练队列。）手动修改文件，然后查询下一步操作，返回的答案就会反映出这一修改。

本页是导图。操作规则见[合约](/docs/agents/contract)；工具调用见 [MCP](/docs/agents/mcp) 与 [Shell](/docs/agents/shell)。

## 工具

| 工具 | 安装方式 | 在导轨上的功能 |
|---|---|---|
| `champollion` | npm (Node 20.11+) | 启动项目、导入数据、记录其条款、指出下一步操作、运行改进轮次、将模型连接到应用 |
| `nmt-forge` | PyPI (`uv tool install --python 3.12 nmt-forge`) | 训练、筛查、拆分、记录预测、在测试集上评估模型并导出它们、提供服务；维护账本 |
| `mt-eval` | 随 `nmt-forge` 提供（`mt-eval-harness` 软件包） | 对测试集、文件或请求运行方法；应用关卡；评分 |
| `champollion-mcp-server` | npx | 以有界子进程的方式驱动 `champollion` CLI；导轨 profile 包含六个工具 |

每个工具都作为独立进程运行。MCP 服务器运行与人工键入完全相同的命令（其 `run_next_step` 会拒绝除 `champollion`、`nmt-forge` 和 `uv tool install … nmt-forge` 之外的任何程序）。

## 项目目录树

`champollion new <folder> --from <language> --to <language>` 写入：

```text
<folder>/
  champollion.project.json   project/1 — the decisions (kind, name, pair, purpose, defaults)
  README.md                  what goes where, for the people
  NEXT.md                    the next step, as a page (rewritten by `champollion next --write`)
  AGENTS.md                  the operating contract, for an AI agent working in the folder (an existing one is kept)
  .gitignore                 keeps data/, inbox/, consent/, models/, runs/, export*/, .forge/runs/, .champollion/ out of git
  inbox/                     files as the people have them
  data/parallel/             sentence pairs to learn from
  data/test/                 sentences a fluent speaker checked — never learned from
  data/lexicon/              word lists and dictionaries
  data/grammar/              grammar notes
  data/monolingual/          one-language text (kept; kept; not used for training)
  consent/                   notes recording who agreed to what, and when
```

若文件夹中已存在项目（退出码 1）或包含任何非隐藏文件（退出码 1），或者 `kind` 不是 `language`，它将拒绝执行：`task` 和 `service` 项目目前尚未接入导轨。`--dry` 仅解析语言，不写入任何内容。

各个步骤在运行时会添加其余内容：

| 路径 | 写入方 | 存放内容 |
|---|---|---|
| `<file>.champollion.json` | `champollion data add`、`data mark`、`data combine`、`improve marks` | set/1 —— 其旁侧文件的条款 |
| `data/combined-from/` | `champollion data combine` | 经 combine 合并的原始文件（已移动，绝不删除） |
| `data/not-for-training/` | `champollion data combine` | 其权利人声明任何模型均不得用于学习的文件 |
| `.forge/` | `nmt-forge init` | 工作区：`eval-registry.json`、`ledger.jsonl`、预注册、`runs/` |
| `config.json`、`NEXT_STEPS.md` | `nmt-forge init` | 训练配置（展开为具体数值的模型预设） |
| `data/clean/` | `nmt-forge leak-audit --clean-to` | 经筛选的训练对 |
| `data/split/` | `nmt-forge split`、`champollion improve prepare` | 开发集；每轮的训练文件 |
| `data/dev/practice-round-<k>.tsv` | `champollion improve marks` | 说话人为开发集编写的句子 —— 角色为 `dev`，仅保留在本地，绝不参与训练 |
| `improve/time.json` | `champollion improve time` | 说话人的时间记录，用他们自己的话表达 |
| `improve/round-<k>/` | improve 步骤 | `wishlist.md`、`to-translate.txt`、`review.csv`、`sheet-key.json`（另一个模型起草了哪些行 —— 尚未使用的新模型，或已被晋级替换的模型：行号、运行名称、对应关系以及各模型的训练对数量 —— 并且从第 2 轮起，`repeat_rows`：再次显示的行、每个 `row`、`from_round`、`from_row` 以及早期的 `mark`）、`marks.json`（各项计数、带有区间的正确比例、`blind` 以及 `repeats`：`shown`、`judged`、`agreed`、`agreement`、`wrong_to_right`、`right_to_wrong`、`wrong_before`、`rounds_apart_wrong_before`）、`prepared.json`、`report.json` |
| `export*/` | `nmt-forge export` | 导出的模型及其 method.json |
| `deploy/<name>.json` | `nmt-forge export`（在 rails 项目内部） | deployment/1 —— 部署的内容 |
| `gates/*.json` | 人工 | gate-chain/1 —— 输出与实际交付内容之间的检查 |
| `methods/<id>/method.json` | 人工 | method/1（亦由 `nmt-forge export` 写入模型文件夹、`mt-eval export` 与 `champollion serve --emit-manifest`） |

## 数据格式

`shared/schemas/framework/` 中包含六个框架 Schema。每个文档都在 `$schema` 中指明其 Schema。未知的键会被拒绝；自定义键须置于 `x-` 下。

| 格式 | `$schema` | 位置 | 定义说明 |
|---|---|---|---|
| project/1 | `https://champollion.dev/schemas/project/1.json` | `champollion.project.json` | 仅包含决策：`kind`、`name`、`pair`、`purpose`、`defaults`、`created_with` |
| set/1 | `https://champollion.dev/schemas/set/1.json` | `<file>.champollion.json` | 数据文件的条款：`transmission`、`role`、`kind`、`pair`、`fields`、`terms`、注册字段、`derived_from`、`holders_agreed` |
| method/1 | `https://champollion.dev/schemas/method/1.json` | `method.json` | 单个方法：`id`、`name`、`kind` 以及该类别特有的配置项、`pairs`、`decode`、`card`、`evidence` |
| gate-chain/1 | `https://champollion.dev/schemas/gate-chain/1.json` | `gates/*.json` | 有序的 `metric-threshold` 关卡及可选的 `fallback` |
| deployment/1 | `https://champollion.dev/schemas/deployment/1.json` | `deploy/*.json` | 单个方法、其关卡、一个语言对；可选的 `serve` 主机与端口 |
| service-api/1 | `https://champollion.dev/schemas/service-api/1.json` | `/translate` 合约 | 请求、响应、错误及 `/health` 文档 |

`project.defaults`——在未作其他声明时添加到项目中的数据所获得的默认设置。`champollion new` 写入 `{"transmission": "local-only",
"training": "ask", "share_scores": "ask"}`. The values: `transmission`
为 `local-only` 或 `ask`；`training` 为 `allowed`、`not-allowed` 或 `ask`；
`share_scores` 为 `never` 或 `ask`。`ask` 会让工具停下来询问——导轨绝不会凭空捏造答案。

还有两项记录不属于框架 Schema，但也是该模型的一部分：

- **Forge 账本**，`.forge/ledger.jsonl`：仅追加且哈希链化（每个条目都嵌入前一个条目的哈希；任何修改都会导致 `nmt-forge ledger verify` 失败）。它记录注册、对已注册集的每次读取、预注册、评分、密封集开销、覆盖、泄漏审计结论、词典保底阈值、导出、选择、服务、轮次结论（`improve-compare`：少于 50 个开发集句对时的 `better`、`worse`、`no-change` 或 `too-few`）、每轮的训练方式（`round-plan`）、评审表中另一模型的草稿（`draft-newer`：运行名称、`relation`、每个模型的训练对计数以及草稿计数）、母语者对新模型的盲审结论（`improve-speaker`：运行名称、四项计数、`z`、`clear`）、模型变更（`model-change`，包含 `not-now`）以及 `nmt-forge tidy` 移除了什么（`tidy`：运行和字节）。只记录计数、哈希和路径——绝不记录句子。这是防篡改簿记，而非加密安全。
- **运行卡（Run card）**：`mt-eval run` 为已评分运行记录的内容，以及已发布结果所携带的内容。请参阅[运行卡规范](/docs/network/specifications/run-card)。

**锁定检查。**`champollion validate [folder]` 对照这些 Schema 检查项目文件、每个 sidecar 文件、每个 `method.json`（位于根目录、`methods/*/` 和 `.champollion/methods/*/` 中）、`gates/*.json` 以及 `deploy/*.json`。测试框架以相同的判定结果读取相同的文件。退出码 0 = 无错误，1 = 文档无效，2 = 用法错误。它仅打开这些 JSON 文件，绝不打开数据文件。

`champollion upgrade [folder]` 将在 set/1 之前编写的 sidecar 文件（没有 `$schema`）重写为 set/1 格式，同时保留每个值（set/1 无法识别的键会移至 `x-<key>` 下）。它不会触动无效的 sidecar 文件，并且会列出旧版 `method.json` 而不作修改：所有工具仍可将其作为 method/0 读取，并输出警告。

## 单一流水线

方法与文本接触的每种方式，在评测引擎中都归结为同一条流水线：

1. **准入（Admit）。**读取输入的条款（set/1 sidecar、JSON 封装包、注册表条目），并在进行任何翻译之前解析并强制执行其传输策略。策略不允许的通道将在此处被拒绝（参见[数据规则](/docs/agents/data-rules)）。
2. **方法（Method）。**调用一种方法进行翻译（method/1 类型：`llm`、`llm-coached`、`mt-api`、`local-model`、`nmt-checkpoint`、`lexicon`、`python`、`service`、`human`）。
3. **关卡（Gates）。**若指定了关卡链，则对每个句段进行评定；首个做出拒绝的关卡将决定最终交付的内容（`drop`、`keep-source`、`flag`、`fallback`）。参见[方法与关卡](/docs/agents/methods)。
4. **输出（Outputs）。**写入运行日志；从已标记输入中切分出的文件会在其相邻的 sidecar 中携带其条款。
5. **指标（Metrics）。**仅当参考译文存在时：基准主分针对实际交付内容评分，未经关卡过滤的得分并列显示。参见[度量评估](/docs/agents/measurement)。

各种模式本质上是针对不同输入的同一条流水线：

| 模式 | 命令 | 输入 | 指标评估 |
|---|---|---|---|
| 评估测量 | `mt-eval run`（`mt-eval test` 对运行日志重新评分） | 测试集或开发集 | 是 |
| 翻译文件 | `mt-eval translate --out <file>` | 仅源语文本 | 否 |
| 提供服务 | `mt-eval serve` | 一次一个请求 | 否 |

**部署本质上就是针对仅源语输入的评估流水线。**同一个 deployment/1 文件可用于测试（`mt-eval run --deployment`）、对文件运行（`mt-eval translate --deployment`）以及提供服务（`mt-eval serve --deployment`），确保所测即所发。使用 `--deployment` 时，该文件所决定的标志（`--method`、`-m`/`--model`、`--gates`、`--target-script`）会被拒绝传入。部署配置不包含任何分数：测得的数值属于运行结果，随运行一同保存。参见[服务部署](/docs/agents/serving)。

## 数据形式的执行旅程

工作顺序定义在一个文件中：`shared/journeys/language.json`。求值器 `cli/lib/framework/journey.js` 是唯一的读取者；`champollion next`、MCP 导轨 profile 以及 `NEXT.md` 都向它提出同一个问题。**首个尚未完成的步骤就是下一步。**它仅读取 sidecar、项目文件以及 forge 的注册表和账本——绝不读取数据文件的文本——并且除了在安装步骤执行 `nmt-forge --version`（限时 30 秒）以及工作进入训练阶段后执行 `nmt-forge status --json`（限时 60 秒）之外，不会运行任何其他程序。

**阶段。**`start` → `gather` → `protect` → `tools` → `build` → `improve`。

**一个步骤**包含 `id`、`stage`、`mode`、用通俗直白的话向人员说明的内容（`say`）及其重要性原因（`why`），通常还包含 `command`。可选字段包括：

| 字段 | 含义 |
|---|---|
| `done_when` | 表明该步骤已完成的检查项。必填（委托步骤除外） |
| `when` | 该步骤要生效所必须满足的检查项（词典底线仅在 `data/lexicon/` 包含文件时适用） |
| `question`、`answers` | `ask_user` 步骤的问题及其答案槽位：`{"enum": [...]}` 或 `{"type": "string", "say": "…"}` |
| `agent`、`agent_tool` | Agent 为人工步骤自行执行的操作（使用 `add_data` 导入指定文件） |
| `outdated` | 当检查发现工具版本过旧时使用的变体 |
| `delegate` | `"nmt-forge"`：转交由 forge 自身的 Advisor 处理 |

`say`、`question` 和 `command` 中的 `{placeholders}` 会根据项目文件和所发现的文件进行填充。

**检查项**是一个封闭集合；若遇到未知检查项，求值器将抛出异常：`project_valid`、`data_files`、`every_data_file_has_terms`、`protected_test_set`、`tool_on_path`（附带 `min_version`）、`path_exists`、`forge_test_registered`、`single_file`、`forge_role_registered`、`forge_ledger_event`、`screened_rows`、`lines_in_file`、`review_marked`、`improve_prepared`、`forge_trained_on_current`。

**模式：**

| 模式 | 操作主体 | 导轨所允许的行为 |
|---|---|---|
| `auto` | Agent | 运行命令 |
| `confirm` | Agent（获得确认后） | 安装、训练、任何产生花费或发布的操作；仅在人员明确确认后运行 |
| `ask_user` | 人员回答 | 询问 `question`；按 `answers` 中的键传递其回答；绝不代其作答 |
| `wait` | 无 | 某项任务正在运行中；稍后再次查询 |
| `human_only` | 人工 | 收集句子、标记草稿、做出选择 |
| `use_tool` | Agent（使用自身工具） | 仅限 MCP：带有 `agent` 字段的 `human_only` 步骤显示为带有 `step.tool` 的 `use_tool` |

**委托。**在 `forge` 步骤中，旅程会调用 `nmt-forge status --json`，并将 forge 的状态作为该步骤。Forge 的状态映射到如下模式：`training` → `wait`；`ready-to-train` 和 `needs-training-extra` → `confirm`；`missing-preregistration` → `ask_user`；`choose-export` → `human_only`；`improve-compare` → `auto`；`improve-promote` → `confirm`；`improve-stronger-model` → `ask_user`。对于任何其他状态，若 forge 指定了命令则为 `auto`，未指定时则为 `human_only`。状态为 `serving` 时，构建阶段结束，改进阶段开始。

有两类步骤来自步骤列表之外：

- **判定预测结果。**在对测试集评分后的导出模型完成之后，由人工用自己的话语写下的预测将等待其判定：一个包含 `answers` `verdict`（`held` 或 `missed`）和 `by`（评审人）的 `ask_user` 步骤，它会运行 `nmt-forge prereg verdict`。
- **等待达成一致。**对于 sidecar 中标明 `speakers_agreed: not-yet` becomes its own `ask_user` question in `waiting` 的每个文件，只要人员得到答复即可通过其自身的步骤 ID 进行响应。它绝不会阻塞导轨其余部分的运行。

**步骤 ID** 为 `<journey step id>:<8 hex characters>`——即步骤及其已填充命令的哈希值。如果项目发生变更，ID 也会改变，携带旧 ID 的 `run_next_step` 将被拒绝（`the project changed since that step was named`）。

**`champollion next --json` 返回的内容：**`project`、`kind`、`stage`（`n`、`of`、`id`、`title`）、`done`（步骤 ID）、`step`（`id`、`mode`、`say`、`why`，以及存在时的 `command`、`question`、`answers`、`agent`、`agent_tool`、`file`、`source`）、`now`（forge 的事实状态——当前的真实状态）、`waiting`、`forge`（`state`、`blockers`、`warnings`）、`finished`（在没有剩余步骤时）以及 `error`。存在错误且没有步骤时退出码为 1。

## 拒绝响应的形式

每次拒绝都会说明发生了什么，且大多数都会说明原因及修复方法。

| 工具 | 人工可读输出 | 机器可读输出 | 退出码 |
|---|---|---|---|
| `nmt-forge` | `[guard] message`，然后是 `  why: …` 与 `  fix: …` | `--json`：标准输出中的 `{"error": {"type", "guard", "message", "why", "fix", "how_to_get", "text"}}` | 2 表示拒绝 |
| `champollion` | 标准错误中的 `[ERR] message` | 在命令支持的情况下为 `--json` | 1 表示拒绝，2 表示用法错误 |
| MCP 导轨工具 | — | 带有 `isError: true` 的 `{"refused": "<reason>", …}`，若存在重试信息还会附带重试项（`if_it_has_no_code`、`current`、`last_output`、`question`、`answers`） | — |

Forge 错误中的 `type` 是异常类（参数错误时为 `UsageError` —— forge 拒绝缩写标志，而不是去猜测）。Forge 的守卫名称包括 `split-guard`、`dev-fence`、`leak-audit`、`preregister`、`eval-ledger`、`ci-scoring`、`registry`、`improve-loop` 和 `disk-room`（磁盘无法容纳的训练运行）。当错误需要引用保留语料库中的句子时，该句子将显示为 `[sentence withheld]`，且对象会添加 `text_withheld`。

用通俗直白的语言转述拒绝信息并遵照其修复方法处理，或者重新查询下一步。失败过两次的步骤不会再次运行，直至人工做出决定（[MCP](/docs/agents/mcp#when-a-step-fails)）。

## 深入了解

- [操作合约](/docs/agents/contract)——规则、锁与附注。
- [通过 MCP 驱动导轨](/docs/agents/mcp)与[从 Shell 驱动导轨](/docs/agents/shell)。
- [数据与传输规则](/docs/agents/data-rules)——set/1 完整说明。
- [方法与关卡](/docs/agents/methods)及[服务提供](/docs/agents/serving)——method/1、gate-chain/1、deployment/1、service-api/1。
- [运行卡规范](/docs/network/specifications/run-card)与[测试框架规范](/docs/network/specifications/harness)。
- [`mt-eval` 命令参考](/docs/reference/mt-eval)与 [`nmt-forge` 命令参考](/docs/network/getting-started/forge-command-reference)。
