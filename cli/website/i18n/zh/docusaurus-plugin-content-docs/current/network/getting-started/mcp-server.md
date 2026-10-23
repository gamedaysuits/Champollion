---
title: "MCP Server —— 面向智能体的入口"
sidebar_label: "MCP Server"
description: "通过 Model Context Protocol 将 AI 智能体连接至 Champollion。提供两种预设：rails 预设（默认）通过 6 个工具引导单个语言项目；--profile full 提供 34 个工具，用于查询语言、浏览基准测试队列和语料库注册表、运行评估、训练与导出模型以及进行翻译——并明确标出哪些工具需要的不仅是 npx install。"
---

# MCP Server —— 面向 Agent 的入口

`champollion-mcp-server` 通过 stdio 基于 [Model
Context Protocol](https://modelcontextprotocol.io) 将 Champollion 暴露给 AI Agent。它提供两种预设配置（profile）：

| 配置 | 启动命令 | 提供的服务 | 适用场景 |
|---|---|---|---|
| **rails**（默认） | `npx -y champollion-mcp-server` | 六个工具：`start_project`、`project_status`、`run_next_step`、`add_data`、`try_translation`、`explain` | 在用户自己的电脑上逐步推进单个语言项目，从空文件夹逐步构建到完成评估的模型 |
| **full** | `npx -y champollion-mcp-server --profile full`（或 `CHAMPOLLION_MCP_PROFILE=full`） | 34 个工具、3 项资源以及 4 个 prompt | 发现、基准测试、分步训练、翻译以及网络 |

如果您正在协助他人为其语言构建翻译器，请使用 rails 配置；关于如何驱动该配置，请参阅[通过 MCP 驱动 Rails](/docs/agents/mcp)，您所遵循的规则载于[操作约定](/docs/agents/contract)。

此处的全部内容也可通过纯 HTTP 访问——参见[机器可读端点](#machine-readable-endpoints)——但 MCP 服务端是唯一允许 Agent *采取行动*（翻译、运行基准测试、训练模型）而不仅是读取的接口。

## 安装

```bash
npx -y champollion-mcp-server
```

然后将其注册到您的客户端。对于 Claude Code：

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

若需使用 full 配置，请在 `args` 中的包名后添加 `"--profile", "full"`，或在 `claude mcp add` 命令末尾添加 `--profile full`。

## rails 配置（默认）

这六个工具引导单个语言项目从空文件夹开始，在用户自己的电脑上逐步走到完成评估的模型。每一步都会明确说明应调用哪个工具，而所有只有用户才能回答的问题（谁持有文件、模型是否可以从中学习、其文本是否可以离开电脑、他们的期望是什么、结果是否足够好）都会交还给用户。这些工具只会报告计数和列信息，绝不会报告句子。每个工具都将 `champollion` 命令行作为独立的受限进程驱动——与人工输入的命令完全一致。此配置专为小型 Agent 设计，指令简短明了。

| 工具 | 参数 | 功能说明 |
|---|---|---|
| `start_project` | `folder`、`from`、`to`、`target_name?`、`source_name?`、`purpose?`、`parent_dir?`、`confirmed?` | 创建项目（`champollion new`）。首次调用不会创建任何内容，并返回 `ask_first`：向用户确认翻译方向，然后根据其回答发起指定的调用 |
| `project_status` | `project_dir`、`wait_seconds?`（最多 120） | 下一步，从文件中读取（`champollion next --json`）：其模式、要表达的内容、原因以及执行该步骤的确切调用 |
| `run_next_step` | `project_dir`、`step_id`、`answers?`、`confirmed?` | 运行 `project_status` 刚刚指定的步骤。`confirm` 步骤需要在用户确认同意后传入 `confirmed: true`；`ask_user` 步骤需要用户自己的回答；`human_only` 与 `wait` 步骤会被拒绝，并提示应采取的替代操作 |
| `add_data` | `project_dir`、`path`、`into?`（`parallel`、`test` 或 `lexicon`）、`source_col?`、`target_col?`、`sheet?`、`header?`、`usfm_source?`、`replace?` | 就地引入文件——电子表格、Word 表格、Toolbox 或 LIFT 词典、ELAN 文件或 USFM 经文（`champollion data add`）——并报告计数和列信息，绝不报告句子 |
| `try_translation` | `project_dir`、`text`（最多 10 行） | 使用项目所服务的模型翻译用户的几个句子。对于从仅本地句子中学习的模型，它仅返回模型自身页面的地址，绝不返回文本 |
| `explain` | `topic`：`rails`、`privacy`、`quality`、`modes`、`improve` 或 `off_rails` | 供转达的通俗语言解释 |

## full 配置

以下内容均描述 **full 配置**——包含用于发现、基准测试及网络的全部工具：

```bash
npx -y champollion-mcp-server --profile full
```

## 依赖此配置前必读

**在 full 配置中，34 个工具中有 14 个在纯净的 `npx` 安装下即可工作，`translate` 在配置引擎后即可工作。其余 19 个工具需要 Python 软件包，这些是 npm 包未包含且无法内置的。** 它们不会静默失败——每个工具都会返回可操作的错误信息，指明缺失的依赖——但在进行规划前，您应了解其全貌。

| 工具 | `npx` 后即可使用？ | 还需要什么 |
|---|---|---|
| `search_languages`、`get_language`、`language_overview`、`list_corpora`、`get_results`、`get_run_card`、`get_metric_reliability`、`list_contests`、`get_contest`、`get_project_info`、`list_queue`、`get_queue_item`、`estimate_cost`、`get_training_guardrails` | **是**——只读，由公开端点提供服务 | 无 |
| `translate` | **是**，需要配置引擎 | 所选引擎的 API 密钥——若使用 `local` 方法并在本地机器运行模型服务，则无需密钥 |
| `run_benchmark`、`get_run_status`、`preview_publish`、`publish_report` | 否 | eval harness——`pipx install mt-eval-harness` |
| 15 个 `forge_*` 工具 | 否 | NMT Forge 0.2.0 或更高版本——`python3 -m pip install nmt-forge`（若需训练和服务，请添加 `'nmt-forge[hf]'`）。它自带 eval harness，并能自行查找语言卡片；无需克隆代码仓 |

这一切均无需克隆代码仓库。

## 工具功能详解

**浏览工作与预估开销。** `list_queue` 和 `get_queue_item` 遍历开放的基准测试队列——即最有助于完善语言图谱的优先评估任务列表。`estimate_cost` 可在您产生任何开销前对一组运行进行计价。

**信息检索。** `search_languages` 按名称、代码、语系或地区检索语言卡片，并允许拼写容错。每个结果还会说明该语言的使用地区（国家、地图坐标点、大区）及其别名——仅展示卡片注有来源的事实，并附带对应来源，以便区分名称相似的语言。无来源的位置信息绝不展示；该行会注明这一点并转而链接到该语言的 Glottolog 记录。通过 champollion.dev 已发布的卡片表填充的卡片（在 npm 安装中，指内置核心集以外的所有语言）目前尚未携带逐字段来源——它们将随卡片表的下一次上传一起提供——因此这些行会包含 Glottolog 链接而非位置。`language_overview` 是针对某种语言进行构建的单页起点：包含已有内容、可运行内容以及后续步骤。`get_language` 返回带有完整引用的卡片。`list_corpora` 列出语言对或基准测试语系的已注册评估语料库——仅含元数据（规模、许可证、污染评级，以及 harness 是否能直接抓取、需要访问令牌还是处于隔离状态）；语料内容绝不返回，若某个语言对的所有语料库均被隔离，会明确注明而非显示为不支持。`get_results` 和 `get_run_card` 从公开排行榜读取带有分数的运行记录。`get_metric_reliability` 根据各语系与人类判断的相关性，回答大多数 Agent 都会答错的问题——*对于该目标语言，我应该信任哪种评估指标*。`list_contests` 和 `get_contest` 显示竞赛及其声明条款；参加竞赛属于需人工授权的 CLI 步骤，绝不能由工具执行。

**采取行动。** `translate` 通过经过测试的流水线运行文本，配备翻译记忆库（Translation Memory，重复内容无开销）以及确定性质检门禁。每个返回结果都会注明实际运行的引擎，及其具备的模型和端点信息。
`run_benchmark` 启动评估并**立即返回任务 ID**，因为实际运行时间长于任何客户端超时；您可以使用该 ID 轮询 `get_run_status`。任务在服务端重启后依然有效：运行会继续进行，随后使用同一 ID 轮询仍能获取其状态和结果。除非传入 `publish: true`，否则不会发布任何内容；此时计划会说明将要公开的内容——是带有句子文本的每一行，还是仅含分数；是 prompt 文本，还是仅其哈希值；以及发布位置——而实际发布需要使用计划给出的完全一致的文本传入 `publish_ack`，以确保用户已先看到该说明。未带此参数执行的运行可在此后通过同一门禁进行发布。`preview_publish` 为只读操作：它展示 harness 自带的发布预览、完全一致的文本以及可执行发布的精准 `publish_report` 调用，且本身无法发布。它带有 MCP 注解 `readOnlyHint: true`，因此在每次写入前都会向用户询问的 Agent 宿主可以自行直接放行。`publish_report` 执行写入（带注解 `destructiveHint` 与 `openWorldHint`），而 `scores_only` 会扣留句子文本不予公开。每个计划在开头还会列出目标语言的 `EVAL PACK:` 状态——`missing`（附带安装命令）、`ready` 或 `none needed`——并注明语料库许可证及其 `do_not_train` 条款，因为运行会传递 `--yes`。缺失 FST（分析器或其 pyhfst 运行时）绝不会中断运行：运行仍会继续，且运行卡片会将 FST 接受度标记为未计算。任何其他缺失的组件都会在翻译前终止运行。`skip_fst` 和 `skip_eval_standard` 会在不使用这些组件的情况下评分，且运行卡片会标明遗漏的项。计划还会说明是否会计算 COMET（只要安装了 `unbabel-comet`，harness 就会计算它；`comet: true` 会使运行强制要求该项），并且 `metricx` 和 `fuse` 会请求 harness 的可选 MetricX-24 与 FUSE 风格对比器。对于每一项，计划都会根据 harness 说明其是否已安装、需要安装什么以及它会下载什么。若已确认的运行请求了 harness 无法计算的指标，该运行会被直接拒绝，而不会在缺失该指标的情况下继续运行。计划中的 `Results:` 和 `Cache:` 行会说明运行日志、报告和翻译缓存保存的位置。位于被 `mt-eval contest prepare` 标记为可公开发布（竞赛的 `public/`）的文件夹内的测试文件，其运行输出会改为写入竞赛的 `runs/` 文件夹，以确保运行写入的任何内容都不会随之发布。在您自己机器上的模型（本地服务器，或由 harness 进程内运行且无需认证证明的 `method: "local-model"`）会被报告为 `$0 API cost (runs on this machine)`。

**不自欺地进行训练。** `get_training_guardrails` 返回从真实评估失败中提取出的规则。15 个 `forge_*` 工具以受保护的方式分步运行 [NMT Forge](/docs/agents/training)——首先运行 `forge_status` 并在每一步之后再次运行（它会指明下一个命令及运行该命令的工具）；使用 `forge_preflight` 可在命令拒绝执行前查看它会触发哪些门禁；使用 `forge_prereg_template` 和 `forge_prereg` 在获得任何测试分数之前（以及在测试集进行任何基准测试之前：评分读取操作会阻止后续的事先预注册）记录预测；使用 `forge_export` 对测试集进行单次评分并打包已训练的模型；使用 `forge_compare` 对两个模型进行 A/B 测试，并在获胜者旁附上各自的近孪生警示；使用 `forge_prereg_verdict` 记录用户针对 forge 无法判断的预测（自由文本区间）给出的自身评判——显示为人工评判结果，绝不显示为计算得出的结果。`forge_status` 列出每次已训练的运行及其验证集分数，并在验证集饱和（验证集得分完美，导致检查点选择无法进行区分权衡）时发出提示。当 eval harness 对测试分数提出警示时（例如近乎恒定的输出：对每个源语言句子都只给出少数几种输出），`forge_export`、`forge_status`、`forge_compare` 和 `forge_lint` 会保留 harness 的原话说明，并在下一步中优先呈现重大警示：引用该分数时绝不会漏掉此警示。拒绝响应会返回出错内容、其重要性以及修复方法。有两个步骤的执行时间超出了任何工具调用的承受范围，因而改在终端中运行：训练（`nmt-forge run`）和提供导出模型的服务（`nmt-forge serve`，该步骤会将其置于本地端点之后，供 `translate` 及 CLI 调用）。

### 参数

`name` 为必填，`name?` 为可选。接受单个语言参数的每个工具均支持传入 `language`：“`code` 或 `language`”表示任意名称均可，传入其一即可。原有名称继续保持有效。

| 工具 | 参数 |
|---|---|
| `search_languages` | `query` 或 `language`、`limit?` |
| `language_overview` | `code` 或 `language`、`source?` |
| `get_language` | `code` 或 `language`、`format?` |
| `list_corpora` | `source_language?`、`target_language?`、`family?`（这三者中至少一个）、`include_quarantined?`、`limit?` |
| `get_results` | `source_language?`、`target_language?`、`model?`、`sort?`、`limit?` |
| `get_run_card` | `id` |
| `get_metric_reliability` | `target` 或 `language` |
| `list_contests` | `status?`、`language?`、`limit?` |
| `get_contest` | `id` |
| `get_project_info` | 无 |
| `list_queue` | `language?`、`source_language?`、`model?`、`budget?`、`condition?`、`limit?` |
| `get_queue_item` | `id?` 或 `priority?`（二者选一） |
| `estimate_cost` | `budget?`、`language?`、`source_language?`、`model?`、`condition?` |
| `get_training_guardrails` | `topic?` |
| `translate` | `texts`、`source_language`、`target_language`、`method?`、`model?`、`base_url?`、`endpoint?`、`register?`、`project_dir?`、`context?`（gettext msgctxt：适用于每个文本，或每个文本对应一个）、`script?`、`use_tm?`、`validate?` |
| `run_benchmark` | 一种模式：`budget?` 或 `top?`（队列）、`item_id?`，或带 `model?` 的 `corpus?`（附带 `method_dir`，即插件加载的模型）、`method?` 或 `method_dir?`（方法插件目录；`local-model` 需要 `model`——它没有默认值）、`allow_model_pair_mismatch?`（`local-model`：运行指定其他语言对的 OPUS-MT 对模型，作为相关语言基线）、`attest_local_transport?`（机器翻译引擎或插件；对于 `local-model` 绝不需要）、`provider?`、`base_url?`、`target_language?`、`script?`（LLM 运行：输出必须采用的 ISO 15924 书写系统代码，例如 `Cans` 或 `Latn`；当目标语言卡片列出不止一种时，计划会作出说明）、`source_language?`、`source_field?`、`target_field?`、`max_cost?`、`coaching_file?`、`glossary?`、`attest_no_training?`、`accept_nc_terms?`、`skip_fst?` 和 `skip_eval_standard?`（条目和语料库运行：在缺少 FST 或标准评估指标的情况下评分，标记为未计算）、`comet?`（要求 COMET：未安装时会拒绝运行）、带 `metricx_model?` 的 `metricx?`，以及 `fuse?`（条目和语料库运行：harness 的可选 MetricX-24 与 FUSE 风格对比器，未安装时会拒绝）；然后是 `dry_run?`、`confirm?`、`publish?`、`publish_ack?`（对于实际发布：计划打印的完全一致的文本）、`anonymous?` |
| `get_run_status` | `job_id?` |
| `preview_publish` | `report`（已完成运行的 `*_report.json`）、`scores_only?`、`redact_coaching?`、`anonymous?`（只读：无 `confirm`，无法发布） |
| `publish_report` | `report`（已完成运行的 `*_report.json`）、`scores_only?`、`redact_coaching?`、`anonymous?`、`confirm?`、`publish_ack?`（预览打印的完全一致的文本） |
| `forge_status` | `workspace?`、`project_dir?` |
| `forge_preflight` | `target`（待检查的命令）、`config?`、`workspace?`、`project_dir?` |
| `forge_discover` | `code` 或 `language`、`cards_dir?`、`workspace?`、`project_dir?` |
| `forge_init` | `code` 或 `language`、`dir?`、`pair?`、`model?`、`base?`、`no_card?`、`name?`、`cards_dir?` |
| `forge_split` | `corpus`、`test`、`seed`、`out?`（默认为 `data/split`，即 `forge_init` 的 config.json 所读取的路径）、`dev?`、`register?`（名称前缀，或传入 `true` 代表 `project`）、`allow_rotate?`、`near_dupe?`（Jaccard 阈值，如 0.6，当 forge 建议剔除近似重复项时使用）、`max_group?`（配合 `near_dupe`：最大的近似重复组）、`workspace?`、`project_dir?` |
| `forge_leak_audit` | `corpus`、`strict?`、`clean_to?`、`drop_test_twins?`（带其自身的 `clean_to`，例如 `corpus.notwins.jsonl`——绝不能是全量数据文件）、`companion_config?`（配合 `drop_test_twins`：存放无孪生项模型的配置路径；默认为 `config-notwins.json`）、`overwrite?`（替换某个配置、运行、切分或其他审查所使用的 `clean_to` 文件——若未提供则拒绝执行）、`full_indices?`（完整的每一行行号列表；默认情况下长列表会返回为 `{count, first}`）、`workspace?`、`project_dir?` |
| `forge_register_eval` | `name`、`path`、`role`、`source_field?`、`target_field?`、`allow_rotate?`、`workspace?`、`project_dir?` |
| `forge_prereg_template` | `out?`、`force?`、`project_dir?` |
| `forge_prereg` | `id`、`eval_set`、`predictions`、`author?`、`config_hash?`（将其固定到单次运行）、`allow_after_reads?`（仅适用于在该集合评分读取前写入的预测）、`workspace?`、`project_dir?` |
| `forge_prereg_verdict` | `id`、`prediction`（其序号或自身 ID）、`verdict`（`held` 或 `missed`）、`by`（评判人）、`note?`、`revise?`、`workspace?`、`project_dir?` |
| `forge_export` | `run_manifest`、`out`、`config?`、`no_eval?`、`no_model?`、`glossary?`、`endpoint?`、`port?`、`name?`、`force?`、`prereg?`、`workspace?`、`project_dir?` |
| `forge_evaluate` | `run_manifest`、`config?`、`out_hyps?`、`harness_out?`、`glossary?`、`prereg?`、`workspace?`、`project_dir?` |
| `forge_lint` | `manifest`、`run_manifest?`、`workspace?`、`project_dir?` |
| `forge_report` | `manifest`、`workspace?`、`project_dir?` |
| `forge_compare` | `eval_set`、`hyps_a`、`hyps_b`、`label_a?`、`label_b?`、`run_a?`、`run_b?`（每个模型的运行清单：会对其训练数据检查近似孪生项）、`metric?`、`target_lang?`、`config_hash?`、`prereg?`、`override_respend?`、`workspace?`、`project_dir?` |

例如，`get_metric_reliability { "language": "crk" }` 与
`get_metric_reliability { "target": "crk" }` 查询的是相同的内容。

### 使用已部署的模型进行翻译

`nmt-forge serve` 会打印出其所服务模型的两个地址。将
`translate` 指向其中任一地址即可：

| 参数 | 适用场景 | 示例 |
|---|---|---|
| `base_url` | `method: "local"`——兼容 OpenAI 的服务器（也包括 `"openai"`） | `http://127.0.0.1:8378/v1` |
| `endpoint` | `method: "api"`——champollion API 约定 | `http://127.0.0.1:8378/translate` |
| `model` | 仅限 LLM 引擎；对于不含提示词的机器翻译 API 会被拒绝 | `llama3.1` |
| `project_dir` | 任意方法——使用该项目的翻译记忆库（Translation Memory） | `~/my-app` |

本地机器上的服务器无需密钥。远端 `api` 端点从服务端的环境变量 `CHAMPOLLION_API_KEY` 中读取其密钥。该工具会明确按名称拒绝无法识别的参数，而不是直接忽略，因此拼写错误的参数不会悄悄将您的文本发送到其他模型。

### 服务端状态存储位置

所有内容均存放于 `~/.champollion-mcp/` 中（可设置 `CHAMPOLLION_MCP_HOME` 更改路径）：

- **`translate` 的翻译记忆库**为独立文件，即该目录下的 `.champollion/tm.json`。它与任何项目的 `.champollion/tm.json` 分离。传入 `project_dir` 可改用某个项目的文件（即 `champollion sync` 在该项目中所使用的文件）。
- **`run_benchmark` 任务**记录在 `jobs.json` 中，保留最新的 50 条。每个任务在 `jobs/` 中都有一个文件夹，存放其输出；对于队列条目或已注册语料库，还会包含 harness 的结果。针对您持有的测试文件进行的运行，会将其结果和缓存写入该文件旁边的 `results/` 中——但若文件位于被 `mt-eval contest prepare` 标记为可发布的文件夹中，其运行结果则写入竞赛的 `runs/` 文件夹。每次此类运行都会在该处生成专属的 `mcp-run-<id>/` 文件夹，且 `get_run_status` 会打印覆盖所有这些运行的 `mt-eval compare` 命令（`results/mcp-run-*/*_report.json`）。队列运行则与 harness 的惯常行为一致，将报告写入服务端工作目录下的 `eval/logs/harness/queue/`。

:::note[设计上对开销进行限制]
`run_benchmark` **会拒绝未设上限的队列运行。** 您必须明确传入一种上限条件——`budget`、`top` 或具体的 `item_id`。不存在“直接运行队列”这种调用，因为否则如果 Agent 误解了队列，可能会造成无限开销。
:::

## 协议版本

传输方式**仅限 stdio**——每个 Agent 对应一个独立的 server 进程。

MCP 的 [2026-07-28 修订版](https://blog.modelcontextprotocol.io/posts/2026-07-28/)默认将该协议转为无状态设计，废弃了 `initialize` 握手及 `Mcp-Session-Id` 请求头。本服务端在架构设计上未受影响：它未使用任何已被弃用的功能（Roots、Sampling、Logging），也从未使用过旧版 HTTP+SSE 传输，并且已经遵循了跨调用状态管理的新指南——`run_benchmark` 会生成一个显式的任务句柄供模型传回，而无需依赖传输会话。

由于目前尚未有已发布的 TypeScript SDK 支持该新修订版，本服务端**尚未**升级至该版本。有关完整说明，请参阅[服务端 README](https://github.com/gamedaysuits/Champollion/tree/main/mcp-server)。

## 机器可读端点

访问以下内容无需 MCP 客户端：

| 端点 | 说明 |
|---|---|
| [`/for-agents.md`](https://champollion.dev/for-agents.md) | [面向 Agent 的入口](/for-agents)，原始 Markdown 格式 |
| [`/llms.txt`](https://champollion.dev/llms.txt) | 本站的精选索引 |
| [`/llms-full.txt`](https://champollion.dev/llms-full.txt) | 每个收录页面的内联全文 |
| [`/queue.json`](https://champollion.dev/queue.json) | 完整的基准测试队列 |
| [`/queue-preview.json`](https://champollion.dev/queue-preview.json) | 队列前列项目 |
| [`/registry.json`](https://champollion.dev/registry.json) | 语料库注册表 |
| [`/mesh.json`](https://champollion.dev/mesh.json) | 已测语言图谱 |

## 后续步骤

- [通过 MCP 驱动 Rails](/docs/agents/mcp) —— rails 配置分步详解
- [操作约定](/docs/agents/contract) —— Agent 工作的规则与约束
- [Agent 指南 —— 构建与基准测试](/docs/agents/measurement)
- [Agent 指南 —— 使用 CLI 进行翻译](/docs/agents/serving)
- [提交方法](/docs/network/getting-started/submit-a-method)
