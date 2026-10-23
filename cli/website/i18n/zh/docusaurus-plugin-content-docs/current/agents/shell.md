---
title: "通过 Shell 驱动轨道"
slug: /agents/shell
description: "轨道上的每一步都是一条普通命令：安装、启动项目、导入数据、记录术语、使用 nmt-forge 训练和测试模型、运行改进轮次、使用 mt-eval 翻译并提供服务——此外还包含离线模式、工具读取的环境变量以及退出代码。"
---

# 通过 Shell 运行规范流程

规范流程中的每一步都是一条普通命令。没有 MCP 的智能体——或是坐在终端前的人——只需三个程序即可走完同样的流程：`champollion`、`nmt-forge` 和 `mt-eval`。完全不需要死记执行顺序：`champollion next` 会从项目文件中读取信息，指明下一步、其模式以及确切的命令。

规则与通过 MCP 运行时相同。`confirm` 步骤仅在用户同意后运行；`ask_user` 步骤的回答由用户给出（[契约说明](/docs/agents/contract)）。

## 安装

```bash
npm install -g champollion                  # Node.js 20.11 or newer
uv tool install --python 3.12 nmt-forge     # brings mt-eval (mt-eval-harness) with it
```

**注意。** 两者都会下载软件包：处于 `confirm` 模式——先询问。如果 `uv --version` 失败，需由用户从 https://docs.astral.sh/uv/ 安装 uv；智能体不能自行下载安装程序。训练还需要 forge 的训练扩展包（PyTorch 和 Hugging Face transformers，数百 MB）。缺少时 forge 会指明（状态 `needs-training-extra`）：

```bash
uv tool install --reinstall --python 3.12 'nmt-forge[hf]'
```

流程需要 `nmt-forge` 0.3.0 或更高版本；若是旧版本，会指明其升级命令（`uv tool install --upgrade --python 3.12 nmt-forge`）。

## 循环流程

```bash
champollion next              # the next step: what to say, why, the command, how to take it
champollion next --json       # the same, for a program (see the rails model page for the shape)
champollion next --write      # also rewrite NEXT.md, the person's copy
```

面向人类输出中的 `How:` 表示模式：`run it`（`auto`）、`先询问，然后
运行` (`confirm`), `询问数据持有者——绝不要替
他们回答` (`ask_user`), `等待，然后再次询问` (`wait`), `由人工执行`
（`human_only`）。运行它指明的命令，然后再次询问。偏离既定流程完全可以——运行任何专家命令，然后执行 `champollion next`：下一步会从文件中读取。

## 开始

```bash
champollion new family --from English --to qaa --target-name "Our language" --dry
champollion new family --from English --to qaa --target-name "Our language" --purpose "notes for the grandchildren"
cd family
```

语言可以是代码或名称，通过语言卡片解析。没有代码的变体使用私用代码（`qaa`–`qtz`）以及其族人赋予的名称（`--target-name`、`--source-name`）。**注意。** 在创建项目前，请向用户复述确认翻译方向：`--dry` 会解析两种语言且不写入任何内容。传入每种语言时，必须完全按照用户的命名方式。

## 收集并记录条款

```bash
champollion data add ../family-files/grandpa.xlsx                     # pairs → data/parallel/
champollion data add ../family-files/grandpa.xlsx --source-col A --target-col B --header
champollion data add ../family-files/words.lift --into lexicon        # a word list → data/lexicon/
champollion data add ../family-files/recording.eaf --source-col <number> --target-col <number>   # ELAN: tier numbers
```

`data add` 可读取 `.xlsx`、`.ods`、`.csv`、`.tsv`、`.txt`、Word `.docx` 表格、Toolbox 和 LIFT 词典、ELAN `.eaf` 以及 USFM（`--usfm-source`）。它会写入 `<stem>.tsv` 及其附随文件（sidecar），保留原始文件不变，并输出计数、列名以及行检查所指出的行号（副本、重复、异常长度、对调或错位的行——不会删除任何内容）——绝不会输出具体句子。当它无法判断哪一列（或按编号区分的 ELAN 层级，或 LIFT 语言）对应什么内容时，会拒绝执行并提问；此时请询问用户。`--replace` 会使用其他列重新读取同一原始文件，同时保留持有者的回答；`--name <stem>` 则以另一个名称添加新文件。参见[数据规则](/docs/agents/data-rules#what-tools-print-and-never-print)。

然后根据用户的回答，逐个文件记录条款：

```bash
champollion data mark data/parallel/grandpa.tsv --speakers "grandpa" --speakers-agreed yes \
  --owner "our family" --training allowed --local-only
```

对于尚未设置为仅限本地（local-only）的文件，必须指定 `--local-only` 或 `--may-leave`。
journey 的 terms 步骤会依次询问 `data/parallel/`、`data/lexicon/`、`data/grammar/` 和 `data/monolingual/` 中的每个文件，直至记录其训练回答与 `--speakers-agreed`。每个值均由数据持有者决定——有关各项的作用以及该命令会拒绝的情况，请参见[数据规则](/docs/agents/data-rules)。

## 保护测试集

```bash
champollion data add ../family-files/checked.tsv --into test
champollion data mark data/test/checked.tsv --role test --training not-allowed --local-only
```

## 构建并测试模型

journey 会按顺序指明这些步骤（其 `{placeholders}` 会从项目中填入）：

```bash
nmt-forge init qaa --dir . --pair eng-qaa --no-card --name "Our language" --model auto
nmt-forge registry add project-test data/test/checked.tsv --role test
champollion data combine
nmt-forge leak-audit data/parallel/combined.tsv --clean-to data/clean/combined.clean.jsonl
nmt-forge prereg new first-model --eval-set project-test --expect "<their words>" --rationale "<their reason>"
nmt-forge split data/clean/combined.clean.jsonl --test 0 --dev 50 --seed 42 --near-dupe 0.6 --max-group 26 --out data/split --register project
nmt-forge floor data/lexicon/words.tsv
```

- `init --model auto` 根据本台计算机的内存，挑选出能在数小时内完成训练的最强模型（参见[训练](/docs/agents/training#models)）。若已有语言卡，则会省略 `--no-card --name`。
- `data combine` 仅在 `data/parallel/` 包含多个文件时运行。它会保留所合并文件当中最严格的条款，并拒绝其持有者尚未回应的文件——即模型是否可以从中学习，以及话语被收录其中的每个人是否都已同意。
- `prereg new` 是一个 `ask_user` 步骤：`--expect` 和 `--rationale` 是族人原原本本说出的话，在产生任何评分之前就已写下。提问时不应暗示任何具体数字，你也不应暗示。
- 该流程填入的开发集大小（`dev_n`）为筛选后句对的十分之一，最少 50 对，最多 500 对；少于 200 对时，则取其四分之一，以便训练集保留绝大多数——且此时少于 50 对。因此：160 对句对提取 40 句开发集，200 到 500 对提取 50 句，1,600 对提取 160 句，5,000 对或更多提取 500 句。在少于 50 句的情况下，无法在开发集上评估任何轮次（参见[衡量评估](/docs/agents/measurement#comparing-two-models)）。`--near-dupe 0.6` 会将近似副本保留在同一侧；`--max-group` 是开发集大小的一半（向下取整）再加一。
- `floor` 仅在 `data/lexicon/` 包含词表时适用。

从这里开始，forge 自带的 advisor 会指明每个步骤。`champollion next` 会转述它；`nmt-forge status` 则直接说明：

```bash
nmt-forge preflight run --config config.json && nmt-forge run config.json --detach
nmt-forge jobs                      # what is running
nmt-forge status                    # the next step, with what is ready and what blocks it
nmt-forge export <run-manifest.json> --prereg first-model --out export/
nmt-forge serve export/model --detach
nmt-forge tidy                      # earlier rounds' model weights nothing uses, and the space they take
```

训练过程为 `confirm`（会消耗计算资源，耗时数分钟到数小时）；当后台分离运行的训练进行时，该步骤为 `wait`。在启动前，`nmt-forge run` 会拒绝磁盘无法容纳的运行（`[disk-room]`），并显示剩余空间、预估所需空间以及 `nmt-forge tidy` 可释放的空间；`nmt-forge tidy --yes` 执行清理释放，而在 `run` 上指定 `--skip-disk-check` 则会强制启动，并记录在该次运行中。这两项由使用者决定，而不是由你决定（参见[训练](/docs/agents/training#disk-space)）。
导出步骤会在测试集上根据预测对模型评分一次。在多个导出之间做出选择由使用者决定（`nmt-forge choose <model folder>`）。在测试集评分之后，族人会评审其预测：

```bash
nmt-forge prereg verdict first-model --prediction 1 --held --by "grandma"
```

（未达预期时使用 `--missed`；`--prediction` 为预期的编号，单个 `--expect` 时为 1；`--by` 记录判定人员，如实记下他们所说的名字。）有关 forge 的所有命令及拒绝情形，请参见[训练](/docs/agents/training)。

## 改进轮次

一旦模型投入服务，轮次即告开始：

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

- `improve sheet`：当开发（练习）集不足 200 句时，部分行没有初稿——不足 50 句时为每两行中有一行，50 句起为每四行中有一行——由母语者进行编写。`improve marks` 将它们写入 `data/dev/`，且 `improve prepare` 会将它们添加到开发集中（`nmt-forge grow-dev`），绝不用于训练。它还会运行 `nmt-forge draft-newer`。当存在另一个模型时——若最新的训练模型未投入使用（在其轮次之后未投入使用：样本太少无法判断、无明显变化或表现更差），或者在晋级之后，当前使用的模型所替代的模型——该模型会对已有初稿的行中随机抽取一半进行起草，不作标记，而对照记录保留在工作表旁（`sheet-key.json`）。`improve marks` 随后会分别统计各个模型——即盲测对比，晋级之后，报告需要通过这项检查才能将提升认定为真正的进展（[度量](/docs/agents/measurement#the-speakers-marks)）。
- `improve sheet`，从第 2 轮起：每 10 个新句中就有一行（向下取整）是母语者在先前的表格中标记为 `Y` 或 `N` 的初稿，这些初稿在未标记的状态下重新出现在随机位置。表格的首行说明故意重新放入了少数行，但绝不指明是哪些行；`sheet-key.json` 会列出它们（`repeat_rows`）。该命令会输出重新放回了多少行、*“（未标记具体是哪几行）”*，以及它们耗时*“每行约 10 秒，绝不再用于训练”*。
- `improve marks` 仅根据母语者早前的标记来评判重新展示的行——绝不计入本轮份额、训练对或盲测对比——将 `repeats` 写入 `marks.json`，并输出*“重新展示的行：母语者对 J 行中的 A 行做出了与之前相同的标记 (P%)——W 处先前错误现已正确，R 处先前正确现已错误。不计入本轮份额，且绝不再用于训练。”*
- `improve marks`，当另一个模型为较新的模型且母语者对每个模型的初稿都至少评判过一次时，会使用 forge 记录计数（仅限计数，绝不包含句子）：

  ```bash
  nmt-forge speaker-verdict --newer <run> --in-use <run> --newer-right <n> --newer-judged <n> --in-use-right <n> --in-use-judged <n> --json
  ```

  当母语者判定较新模型正确的次数明显更多时，它会输出 *"forge recorded it: it offers to put the newer model to use (the people say yes first)"*；当 forge 未安装或拒绝时，它会说明评分未被记录及其原因。
- `improve prepare` 以 `nmt-forge round-plan` 结束：该轮训练从当前使用的模型继续（对迄今为止的所有句子进行 4 轮遍历），或者从头开始训练，并说明原因（参见[训练](/docs/agents/training#the-improve-rounds)）。

Forge 随后将新模型与当前使用的模型进行评测
（`nmt-forge compare-runs <in-use run-manifest.json> <new run-manifest.json>`、
`auto`），且仅在效果有可衡量的提升时，才提议将其投入使用（`confirm`）——或者，当评测样本过少无法断定（少于 50 个开发集句子）或没有可衡量的变化时，只要母语者的盲测打分明显更青睐新模型即可。单凭评测结论不会启用任何内容：只有大家的认可（该步骤的 `nmt-forge export` 和 `nmt-forge choose`）才会将其投入使用。来自 `improve marks` 的新句对会先确立各自的术语——流程中会就此进行询问。如何转达报告：[指导](/docs/agents/coaching)。

## 使用 mt-eval 进行翻译与服务部署

在项目内部运行 `nmt-forge export` 会写入 `deploy/<name>.json`（deployment/1）。
同一个文件可用于评测、翻译和服务部署：

```bash
mt-eval translate --deployment deploy/<name>.json --source-file <input file> --out <output file>
mt-eval serve --deployment deploy/<name>.json      # http://127.0.0.1:8379 by default
mt-eval run --deployment deploy/<name>.json --corpus <dev or test file>
```

- **注意。** 在测试文件上运行 `mt-eval run` 无需预注册——它仅记录读取操作。请务必通过 `nmt-forge export`（或在预期写入之后）对测试集进行评分，绝不可在此之前。
- `--gates gates/<chain>.json` 会向 `run`、`translate` 或 `serve` 添加门控链（无需 `--deployment`）；`run` 和 `test` 会拒绝带有回退的门控链。参见[方法与门控](/docs/agents/methods)以及[服务部署](/docs/agents/serving)。

## 脱离轨道：某种语言的现有资源

```bash
champollion network card <code>                    # the cited language card
champollion network recommend <source> <target>    # methods that can run, with their evidence
mt-eval corpora --source <source> --target <target>   # registered test sets for the pair
nmt-forge discover <code>                          # what a training project can use
```

## 检查并升级文件

```bash
champollion validate        # project file, sidecars, method.json, gates/, deploy/ — 0 ok, 1 invalid, 2 usage
champollion upgrade --dry   # what upgrading older sidecars to set/1 would change; drop --dry to write
```

## 离线环境

`CHAMPOLLION_OFFLINE=1` 可禁止 `champollion` CLI 访问网络：
语言卡片仅从内置集合与本地缓存中读取（不会拉取长尾语言卡片），跳过每日卡片缓存刷新，且 `register-corpus` 不会将文件哈希值与公共目录进行比对（会将比对记录为未执行）。它不会改变方法所发送的内容：调用服务商的方法仍需联网，且传输规则依然适用。

`MT_EVAL_NO_REMOTE_REGISTRY=1` 可禁止 `mt-eval` 从网络拉取其数据集注册表（适用于物理隔离机器）。

无论如何，在规范流程中仍需联网的操作包括：安装工具、训练扩展包，以及首次下载预训练模型（`byt5-small` 或 `byt5-small-lowmem`，约 1.2 GB；`cpu-tiny` 则无需下载任何内容）。

## 环境变量

由代码读取，供运维人员使用。只有调用服务商的方法才需要服务商 API 密钥，规范流程的默认路径中绝不需要。

| 变量 | 读取方 | 作用 |
|---|---|---|
| `CHAMPOLLION_MCP_PROFILE` | MCP 服务器 | `rails`（默认）或 `full` |
| `CHAMPOLLION_CLI_BIN` | MCP 服务器 | 要运行的 `champollion` 入口点 |
| `NMT_FORGE_BIN` | `champollion`、MCP 服务器 | `nmt-forge` 可执行文件 |
| `UV_TOOL_BIN_DIR` | `champollion`、MCP 服务器 | `PATH` 之后查找 `nmt-forge` 和 `uv` 的位置（默认 `~/.local/bin`） |
| `CHAMPOLLION_OFFLINE` | `champollion` | `1`：不对卡片或目录查找使用网络 |
| `CHAMPOLLION_CARDS_CACHE_DIR` | `champollion` | 每用户卡片缓存路径（默认 `~/.champollion/cards`） |
| `CHAMPOLLION_CARDS_TTL_HOURS` | `champollion` | 检查卡片缓存更新的频率（默认 24 小时） |
| `NMT_FORGE_AUTO_PRESET` | `nmt-forge init --model auto` | 固定 `auto` 所选的预设（必须为预设名称） |
| `NMT_FORGE_SERVE_PORT` | `nmt-forge serve` | 默认端口（未指定时为 8378） |
| `NMT_FORGE_SERVE_TOKEN` | `nmt-forge serve` | Bearer 令牌；非环回地址时必须提供 |
| `NMT_FORGE_NO_MONITOR` | `nmt-forge run` | `1`：不显示实时训练面板 |
| `MT_EVAL_SERVE_TOKEN` | `mt-eval serve` | Bearer 令牌（绝不作为命令行参数传递） |
| `CHAMPOLLION_SERVE_TOKEN` | `champollion serve` | CLI 自身服务器的 Bearer 令牌 |
| `MT_EVAL_NO_REMOTE_REGISTRY` | `mt-eval` | `1`：不拉取注册表 |
| `MT_EVAL_DATA_ROOT` | `mt-eval` | 优先解析已注册数据集路径的位置 |
| `OPENROUTER_API_KEY` | `champollion`、`mt-eval` | 默认托管模型服务商的密钥 |

## 面向程序的输出

| 工具 | 机器输出 | 退出代码 |
|---|---|---|
| `champollion` | 规范流程命令（`new`、`next`、`data add`、`data mark`、`data combine`、`improve report`、`improve status`、`connect`、`upgrade`）支持 `--json` | 0 正常 · 1 拒绝 · 2 用法错误 |
| `nmt-forge` | 每个子命令均支持 `--json`：在 stdout 输出单个 JSON 文档，其余所有内容输出到 stderr | 0 正常 · 2 拒绝（`{"error": …}`） |
| `mt-eval` | 每个子命令均支持 `--json` 和 `--non-interactive` | 0 正常 · 非零值拒绝 |

拒绝格式参见：[规范流程模型](/docs/agents/rails-model#refusal-shapes)。

## 深入了解

- [`champollion` 命令参考](/docs/reference/cli)、
  [`nmt-forge`](/docs/network/getting-started/forge-command-reference) 与
  [`mt-eval`](/docs/reference/mt-eval)。
- [规范流程模型](/docs/agents/rails-model)——journey 与 `next --json`。
- [通过 MCP 运行规范流程](/docs/agents/mcp)——将相同步骤拆分为六个工具。
- [使用 nmt-forge 训练](/docs/agents/training)与[数据规则](/docs/agents/data-rules)。
