---
title: "MCP Server —— 面向智能体的入口"
sidebar_label: "MCP Server"
description: "通过 Model Context Protocol 将 AI 智能体连接至 Champollion：提供 34 个用于查询语言、浏览基准测试队列与语料库注册表、运行评估、训练与导出模型以及进行翻译的工具——并明确指出哪些工具需要除 npx install 之外的额外步骤。"
---

# MCP Server — 面向 Agent 的入口

`champollion-mcp-server` 通过 [Model Context Protocol](https://modelcontextprotocol.io) 向 AI Agent 开放 Champollion。如果你是一个 Agent，或者正在接入一个 Agent，这就是入口：通过 stdio 提供的 **34 个工具、3 个资源和 4 个提示词**。

这里的所有内容也可以通过普通 HTTP 访问——参见 [机器可读端点](#machine-readable-endpoints)——但 MCP 服务器是唯一能让 Agent 执行*操作*（翻译、运行基准测试、训练模型）而不仅仅是读取的接口。

## 安装

```bash
npx -y champollion-mcp-server
```

然后将其注册到你的客户端。对于 Claude Code：

```bash
claude mcp add champollion -- npx -y champollion-mcp-server
```

对于通过文件配置的客户端（Claude Desktop、Cursor、Antigravity），添加：

```json
{
  "mcpServers": {
    "champollion": {
      "command": "npx",
      "args": ["-y", "champollion-mcp-server"]
    }
  }
}
```

## 依赖它之前请先阅读此内容

**34 个工具中有 14 个在纯净的 `npx` 安装下即可使用，而 `translate` 只要配置了引擎即可工作。其余 19 个工具则需要 Python 软件包，这些包是 npm 包没有且无法附带的。** 它们不会静默失败——每个工具都会返回可操作的错误信息，指明缺少的内容——但在围绕它们进行规划之前，你应该了解其整体结构。

| 工具 | 在 `npx` 之后可用？ | 还需要什么 |
|---|---|---|
| `search_languages`, `get_language`, `language_overview`, `list_corpora`, `get_results`, `get_run_card`, `get_metric_reliability`, `list_contests`, `get_contest`, `get_project_info`, `list_queue`, `get_queue_item`, `estimate_cost`, `get_training_guardrails` | **是**——只读，由公共端点提供服务 | 无 |
| `translate` | **是**，需要引擎 | 所选引擎的 API Key——或者在采用方法 `local` 且模型服务器部署在本地机器上时无需 Key |
| `run_benchmark`, `get_run_status`, `preview_publish`, `publish_report` | 否 | 评估框架——`pipx install mt-eval-harness` |
| 15 个 `forge_*` 工具 | 否 | NMT Forge 0.2.0 或更高版本——`python3 -m pip install nmt-forge`（添加 `'nmt-forge[hf]'` 以进行训练和服务）。它自带评估框架并能自行查找语言卡片；无需 clone 仓库 |

所有这一切都无需 clone 代码仓库。

## 工具的功能

**浏览并估算工作成本。** `list_queue` 和 `get_queue_item` 遍历开放的基准测试队列——这是能最大程度改进映射的测量任务排名列表。`estimate_cost` 在你产生任何花费之前，为一组运行任务进行估价。

**信息查询。** `search_languages` 按名称、代码、语系或地区搜索语言卡片，并允许拼写错误。每个结果还会说明该语言的使用地区（国家、地图坐标点、大区）及其别名——仅包含其卡片引用了来源的事实，每项均附带该来源，从而可以区分名称相似的语言。无来源的位置信息绝不展示；相应行会说明这一点，并改为链接到该语言的 Glottolog 记录。根据 champollion.dev 发布的卡片表填充的卡片（在 npm 安装中，指打包的核心集合之外的所有语言）目前尚未携带字段级来源——它们将随卡片表的下一次上传一起提供——因此这些行会携带 Glottolog 链接而非位置。`language_overview` 是为某种语言进行构建的单页起点：现有资源、可运行内容以及后续步骤。`get_language` 返回带有完整引用的卡片。`list_corpora` 列出某个语言对或基准测试家族的已注册评估语料库——仅包含元数据（大小、许可证、污染评级，以及评估框架能否直接获取、是否需要访问令牌，或是否处于隔离状态）；绝不返回语料库内容，如果某个语言对的所有语料库均处于隔离状态，则会明确说明，而不会显示为不支持。`get_results` 和 `get_run_card` 从公共排行榜读取带评分的运行记录。`get_metric_reliability` 根据各语系与人类判断的相关性，回答大多数 Agent 都会答错的问题——*对于该目标语言，我应该信任哪种评估指标*。`list_contests` 和 `get_contest` 展示竞赛及其声明的条款；参与竞赛属于需经人工授权的 CLI 步骤，绝非工具调用。

**执行操作。** `translate` 通过经过测试的流水线运行文本，配备翻译记忆库（Translation Memory，重复内容无成本消耗）和确定性质量门禁。每个回答都会指明实际运行的引擎，并在具备条件时提供其模型和端点。
`run_benchmark` 启动评估并**立即返回任务 ID**，因为实际运行时间长于任何客户端超时；你使用该 ID 轮询 `get_run_status`。任务在服务器重启后依然存在：运行会继续进行，之后轮询同一 ID 仍能返回其状态和结果。除非你传入 `publish: true`，否则不会发布任何内容；此时规划（plan）会说明将公开发布的内容——是每行附带句子文本，还是仅包含分数；是提示词本身，还是仅包含其哈希值；以及发布到何处——而真正的发布需要以规划给出的完全一致的字词传入 `publish_ack`，以确保用户已先行阅览。没有它而进行的运行可以在之后于同一道门禁后发布。`preview_publish` 为只读操作：它展示评估框架自身的发布预览、完全一致的字词以及能够将其发布的完全一致的 `publish_report` 调用，但它本身无法发布。它带有 MCP 注解 `readOnlyHint: true`，因此在每次写入前都会询问的 Agent 宿主可以自行允许它执行。`publish_report` 执行写入（带有注解 `destructiveHint` 和 `openWorldHint`），而 `scores_only` 会扣留句子文本。每个规划开头还会提供目标语言的 `EVAL PACK:` 状态——`missing`（附带安装它的命令）、`ready` 或 `none needed`——并指明语料库许可证及其 `do_not_train` 条款，因为运行传递了 `--yes`。缺失 FST（分析器或其 pyhfst 运行时）绝不会中断运行：运行会继续进行，并且运行卡片会将 FST 接受度标记为未计算。任何其他缺失的部分都会在翻译开始前阻止运行。`skip_fst` 和 `skip_eval_standard` 可以在缺少这些组件的情况下评分，运行卡片会标明遗漏了哪些内容。规划还会说明是否会计算 COMET（只要安装了 `unbabel-comet`，框架就会计算它；`comet: true` 会使运行强制要求该指标），而 `metricx` 和 `fuse` 用于请求框架中可选启用的 MetricX-24 和 FUSE 风格比较器。针对每一项，规划都会根据评估框架说明其是否已安装、需要安装什么以及它会下载什么。若已确认的运行请求了评估框架无法计算的指标，运行将被拒绝，而不是在缺少该指标的情况下继续运行。规划中的 `Results:` 和 `Cache:` 行指明运行日志、报告和翻译缓存的存放位置。位于 `mt-eval contest prepare` 标记为可发布文件夹（竞赛的 `public/`）内的测试文件，其运行结果将写入竞赛的 `runs/` 文件夹，因此运行写入的任何内容都不会随之公开发布。位于你本地机器上的模型（本地服务器，或由评估框架在进程内运行且无需认证证明的 `method: "local-model"`）报告为 `$0 API cost (runs on this machine)`。

**务实训练，避免自欺。** `get_training_guardrails` 返回从实际测量失败中提取的规则。15 个 `forge_*` 工具按受保护的步骤逐步运行 [NMT Forge](/docs/network/getting-started/training-honestly)——在最开始以及每一步之后首先运行 `forge_status`（它会指明下一个命令以及运行它的工具），`forge_preflight` 用于在命令被拒绝之前查看它会触发哪些门禁，`forge_prereg_template` 和 `forge_prereg` 用于在任何测试分数生成之前（以及在测试集进行任何基准测试之前：评分读取会阻止后续的预注册）记录预测结果，`forge_export` 用于对测试集进行一次评分并打包训练好的模型，`forge_compare` 用于对两个模型进行 A/B 测试并在获胜者旁显示各自的近孪生警告，而 `forge_prereg_verdict` 用于记录用户对 Forge 无法判定的预测（自由文本范围）所作出的自主裁决——显示为人工裁决，绝非计算出的结论。`forge_status` 列出每一次训练运行及其 dev 分数，并在开发集饱和（即开发集分数完美，导致检查点选择无法进行区分权衡）时发出提示。当评估框架对测试分数给出警告时（例如近乎恒定的输出：对每个源句都给出少数固定的输出），`forge_export`、`forge_status`、`forge_compare` 和 `forge_lint` 会以评估框架的原话携带该警告，并在下一步中优先显示重大警告：引用分数时绝不会缺少该警告。拒绝响应会返回出错内容、其影响以及修复方法。有两个步骤的运行时间长于任何工具调用，需要在终端中运行：训练（`nmt-forge run`）以及提供导出的模型服务（`nmt-forge serve`，它将其置于 `translate` 和 CLI 可以使用的本地端点后）。

### 参数

`name` 为必填项，`name?` 为选填项。所有接受单个语言的工具也可以将其作为 `language` 传入：“`code` 或 `language`”表示两种名称均可使用，传入其中之一即可。原始名称将继续有效。

| 工具 | 参数 |
|---|---|
| `search_languages` | `query` 或 `language`, `limit?` |
| `language_overview` | `code` 或 `language`, `source?` |
| `get_language` | `code` 或 `language`, `format?` |
| `list_corpora` | `source_language?`, `target_language?`, `family?`（这三者中至少提供一个）, `include_quarantined?`, `limit?` |
| `get_results` | `source_language?`, `target_language?`, `model?`, `sort?`, `limit?` |
| `get_run_card` | `id` |
| `get_metric_reliability` | `target` 或 `language` |
| `list_contests` | `status?`, `language?`, `limit?` |
| `get_contest` | `id` |
| `get_project_info` | 无 |
| `list_queue` | `language?`, `source_language?`, `model?`, `budget?`, `condition?`, `limit?` |
| `get_queue_item` | `id?` 或 `priority?`（其中之一） |
| `estimate_cost` | `budget?`, `language?`, `source_language?`, `model?`, `condition?` |
| `get_training_guardrails` | `topic?` |
| `translate` | `texts`, `source_language`, `target_language`, `method?`, `model?`, `base_url?`, `endpoint?`, `register?`, `project_dir?`, `context?`（gettext msgctxt：对每个文本通用，或每个文本对应一个）, `script?`, `use_tm?`, `validate?` |
| `run_benchmark` | 一种模式：`budget?` 或 `top?`（队列）, `item_id?`, 或带有 `model?` 的 `corpus?`（附带 `method_dir`，即插件加载的模型）, `method?` 或 `method_dir?`（方法插件目录；`local-model` 需要 `model`——它没有默认值）, `allow_model_pair_mismatch?`（`local-model`：运行指定另一个语言对的 OPUS-MT 语言对模型，作为相关语言基线）, `attest_local_transport?`（机器翻译引擎或插件；对 `local-model` 绝非必需）, `provider?`, `base_url?`, `target_language?`, `script?`（LLM 运行：输出必须采用的 ISO 15924 书写系统代码，例如 `Cans` 或 `Latn`；当目标卡片列出多个时，规划会予以说明）, `source_language?`, `source_field?`, `target_field?`, `max_cost?`, `coaching_file?`, `glossary?`, `attest_no_training?`, `accept_nc_terms?`, `skip_fst?` 和 `skip_eval_standard?`（单项和语料库运行：在缺少 FST 或评估标准指标的情况下评分，标记为未计算）, `comet?`（强制要求 COMET：在未安装时拒绝运行）, 带有 `metricx_model?` 的 `metricx?`，以及 `fuse?`（单项和语料库运行：评估框架中可选启用的 MetricX-24 和 FUSE 风格比较器，未安装时拒绝运行）；然后是 `dry_run?`, `confirm?`, `publish?`, `publish_ack?`（进行真实发布时：规划输出的完全一致的字词）, `anonymous?` |
| `get_run_status` | `job_id?` |
| `preview_publish` | `report`（已完成运行的 `*_report.json`）, `scores_only?`, `redact_coaching?`, `anonymous?`（只读：无 `confirm`，无法发布） |
| `publish_report` | `report`（已完成运行的 `*_report.json`）, `scores_only?`, `redact_coaching?`, `anonymous?`, `confirm?`, `publish_ack?`（预览输出的完全一致的字词） |
| `forge_status` | `workspace?`, `project_dir?` |
| `forge_preflight` | `target`（待检查的命令）, `config?`, `workspace?`, `project_dir?` |
| `forge_discover` | `code` 或 `language`, `cards_dir?`, `workspace?`, `project_dir?` |
| `forge_init` | `code` 或 `language`, `dir?`, `pair?`, `model?`, `base?`, `no_card?`, `name?`, `cards_dir?` |
| `forge_split` | `corpus`, `test`, `seed`, `out?`（默认 `data/split`，即 `forge_init` 的 config.json 读取的路径）, `dev?`, `register?`（名称前缀，或代表 `project` 的 `true`）, `allow_rotate?`, `near_dupe?`（Jaccard 阈值，如 0.6，当 Forge 建议剔除近重复项时使用）, `max_group?`（与 `near_dupe` 配合：最大近重复组）, `workspace?`, `project_dir?` |
| `forge_leak_audit` | `corpus`, `strict?`, `clean_to?`, `drop_test_twins?`（附带其自身的 `clean_to`，例如 `corpus.notwins.jsonl`——绝非全量数据文件）, `companion_config?`（与 `drop_test_twins` 配合：无孪生模型的配置存放位置；默认 `config-notwins.json`）, `overwrite?`（替换配置、运行、拆分或其他审计正在使用的 `clean_to` 文件——若无此参数则拒绝）, `full_indices?`（完整的所有行号列表；默认情况下长列表会返回为 `{count, first}`）, `workspace?`, `project_dir?` |
| `forge_register_eval` | `name`, `path`, `role`, `source_field?`, `target_field?`, `allow_rotate?`, `workspace?`, `project_dir?` |
| `forge_prereg_template` | `out?`, `force?`, `project_dir?` |
| `forge_prereg` | `id`, `eval_set`, `predictions`, `author?`, `config_hash?`（固定到单次运行）, `allow_after_reads?`（仅适用于在该集合评分读取之前写入的预测）, `workspace?`, `project_dir?` |
| `forge_prereg_verdict` | `id`, `prediction`（其编号或其自身的 ID）, `verdict`（`held` 或 `missed`）, `by`（裁判是谁）, `note?`, `revise?`, `workspace?`, `project_dir?` |
| `forge_export` | `run_manifest`, `out`, `config?`, `no_eval?`, `no_model?`, `glossary?`, `endpoint?`, `port?`, `name?`, `force?`, `prereg?`, `workspace?`, `project_dir?` |
| `forge_evaluate` | `run_manifest`, `config?`, `out_hyps?`, `harness_out?`, `glossary?`, `prereg?`, `workspace?`, `project_dir?` |
| `forge_lint` | `manifest`, `run_manifest?`, `workspace?`, `project_dir?` |
| `forge_report` | `manifest`, `workspace?`, `project_dir?` |
| `forge_compare` | `eval_set`, `hyps_a`, `hyps_b`, `label_a?`, `label_b?`, `run_a?`, `run_b?`（各模型的运行清单：检查其训练数据是否存在近孪生项）, `metric?`, `target_lang?`, `config_hash?`, `prereg?`, `override_respend?`, `workspace?`, `project_dir?` |

例如，`get_metric_reliability { "language": "crk" }` 和 `get_metric_reliability { "target": "crk" }` 询问的是同一个问题。

### 使用已部署的模型进行翻译

`nmt-forge serve` 会打印出其所服务模型的两个地址。将 `translate` 指向其中任意一个即可：

| 参数 | 搭配使用 | 示例 |
|---|---|---|
| `base_url` | `method: "local"`——兼容 OpenAI 的服务器（也包括 `"openai"`） | `http://127.0.0.1:8378/v1` |
| `endpoint` | `method: "api"`——champollion API 契约 | `http://127.0.0.1:8378/translate` |
| `model` | 仅限 LLM 引擎；对无提示词概念的机器翻译 API 则会拒绝 | `llama3.1` |
| `project_dir` | 任何方法——使用该项目的翻译记忆库 | `~/my-app` |

本地机器上的服务器不需要 Key。远程 `api` 端点会从服务器环境中的 `CHAMPOLLION_API_KEY` 读取其 Key。该工具会明确按名称拒绝无法识别的参数，而不是默默忽略它，因此拼写错误的参数不会悄悄将你的文本发送给其他模型。

### 服务器状态存储位置

所有内容都保存在 `~/.champollion-mcp/` 中（设置 `CHAMPOLLION_MCP_HOME` 可更改路径）：

- **`translate` 的翻译记忆库**是该文件夹中其独立的文件 `.champollion/tm.json`。它与任何项目的 `.champollion/tm.json` 相互独立。传入 `project_dir` 可改用某个项目的文件，即 `champollion sync` 在该项目中使用的文件。
- **`run_benchmark` 任务**记录在 `jobs.json` 中，该文件保留最新的 50 个任务。每个任务在 `jobs/` 中都有一个文件夹，用于存放其输出，对于队列项或已注册语料库，还包含评估框架的结果。在你持有的测试文件上运行，会将结果和缓存写入该文件旁边的 `results/` 中——但若文件位于 `mt-eval contest prepare` 标记为可发布的文件夹中，其运行结果则会写入竞赛的 `runs/` 文件夹。队列运行会将报告写入服务器工作文件夹下的 `eval/logs/harness/queue/`，一如评估框架的常规做法。

:::note[支出在设计上是有上限的]
`run_benchmark` **拒绝无限制的队列运行。** 你必须传递且仅传递一个限制条件——`budget`、`top` 或特定的 `item_id`。不存在“直接运行队列”的调用，因为如果 Agent 误解了队列，可能会导致无限制的支出。
:::

## 协议版本

传输方式**仅限 stdio**——每个 Agent 对应一个服务器进程。

MCP 的 [2026-07-28 修订版](https://blog.modelcontextprotocol.io/posts/2026-07-28/) 默认将协议设为无状态，废弃了 `initialize` 握手和 `Mcp-Session-Id` 标头。本服务器在设计上不受影响：它没有使用任何已弃用的功能（Roots、Sampling、Logging），从未使用过传统的 HTTP+SSE 传输，并且已经遵循了跨调用状态的新指南——`run_benchmark` 会生成一个明确的任务句柄（job handle）供模型传回，而不是依赖于传输会话。

它**尚未**升级到新修订版，因为目前还没有发布的 TypeScript SDK 支持该版本。有关完整立场，请参阅 [服务器 README](https://github.com/gamedaysuits/Champollion/tree/main/mcp-server)。

## 机器可读端点

这些端点不需要 MCP 客户端：

| 端点 | 说明 |
|---|---|
| [`/for-agents.md`](https://champollion.dev/for-agents.md) | [Agent 入口](/for-agents)，原始 Markdown 格式 |
| [`/llms.txt`](https://champollion.dev/llms.txt) | 本站点的精选索引 |
| [`/llms-full.txt`](https://champollion.dev/llms-full.txt) | 每个被索引的页面，内联格式 |
| [`/queue.json`](https://champollion.dev/queue.json) | 完整的基准测试队列 |
| [`/queue-preview.json`](https://champollion.dev/queue-preview.json) | 队列顶部项目 |
| [`/registry.json`](https://champollion.dev/registry.json) | 语料库注册表 |
| [`/mesh.json`](https://champollion.dev/mesh.json) | 已测量的语言图谱 |

## 下一步

- [Agent 指南 — 构建与基准测试](/docs/network/getting-started/agent-guide)
- [Agent 指南 — 使用 CLI 翻译](/docs/guides/agent-guide)
- [提交方法](/docs/network/getting-started/submit-a-method)
