---
title: "通过 MCP 驱动 rails"
slug: /agents/mcp
description: "将 MCP 客户端连接到 Champollion 的 rails 配置，并通过六个工具逐步推进语言项目：各客户端设置、所有参数与返回值、循环机制、单步模式、拒绝响应以及 explain 主题。"
---

# 通过 MCP 驱动轨道

MCP 服务端的默认配置预设为轨道模式（rails）：包含六个工具，可引导一个语言项目从空文件夹一路走到用户自己电脑上经过评测的模型。每个工具都会将 `champollion` CLI 作为单独的有界进程运行——与用户手动输入的命令完全一致。服务端还会在连接时向你的客户端提供简要的操作说明（`instructions-rails.md`）。

## 连接

服务端通过 stdio 进行 MCP 通信，需要 Node.js 20.11 或更高版本。各基于文件配置的客户端配置如下：

```json
{
  "mcpServers": {
    "champollion": { "command": "npx", "args": ["-y", "champollion-mcp-server"] }
  }
}
```

| 客户端 | 配置位置 |
|---|---|
| Claude 桌面端 | Settings → Developer → Edit Config。添加该条目，保存并重启应用 |
| Claude Code | `claude mcp add champollion -- npx -y champollion-mcp-server` |
| Cursor | 项目 `.cursor` 文件夹中的 `mcp.json`，或主目录中的 `.cursor` |

其他能够启动本地 stdio 服务端的客户端使用相同的命令；本页面仅介绍上述三款。

**工具路径。** 服务端会自动寻找其所依赖的 CLI。它会先在 `PATH` 上查找 `nmt-forge`，然后在 `UV_TOOL_BIN_DIR` 中查找（默认为 `~/.local/bin`，即 `uv tool install` 的存放路径）——从桌面应用启动的客户端其 `PATH` 往往比终端更精简。可在服务端配置项的 `env` 中通过环境变量进行覆盖：

| 变量 | 作用 |
|---|---|
| `CHAMPOLLION_MCP_PROFILE` | `rails`（默认）或 `full` |
| `CHAMPOLLION_CLI_BIN` | 用于替代内置版本的 `champollion` CLI 入口点 |
| `NMT_FORGE_BIN` | `nmt-forge` 可执行文件（CLI 的完整流程同样遵循该变量） |
| `UV_TOOL_BIN_DIR` | `PATH` 之后查找 `nmt-forge` 和 `uv` 的路径 |

## 配置文件预设

| 配置预设 | 选择方式 | 包含内容 |
|---|---|---|
| rails | 默认预设 | 六个工具与简要说明；端到端驱动单个语言项目 |
| full | `args` 中的 `--profile full`，或 `CHAMPOLLION_MCP_PROFILE=full` | 全部工具：语言卡片、语料库、基准评测、队列、评测竞赛、Forge 训练、发布 |

任何其他值都会停止服务端：`unknown MCP profile "<value>" (rails or
full)`。完整的工具列表详见 [MCP 服务端页面](/docs/network/getting-started/mcp-server)。对于单个语言项目，请保留在 rails 配置预设：它的每一步操作都是直接从项目文件中读取的。

## 循环流程

1. 尚无项目 → `start_project`。第一次调用不会创建任何内容：向用户告知返回的
   `ask_first`，然后根据用户的回答发起它给出的调用。
2. `project_status` → 读取 `step.mode`、`step.say`、`step.why`。
3. 按照模式（mode）的说明执行，使用 `step.call`——即执行该步骤的具体调用。
4. 返回第 2 步。在你或用户手动进行任何修改后，再次调用
   `project_status`：下一步操作始终直接从文件中读取。
5. `step: null` → 轨道流程已完成。向用户传达 `finished` 中的内容。

| `step.mode` | 操作要求 | `step.call` |
|---|---|---|
| `auto` | 直接运行 | 带有 `project_dir`、`step_id` 的 `run_next_step` |
| `confirm` | 告知用户具体操作（安装、训练）；询问是或否；仅在得到肯定回答时运行。如果用户表示“暂不需要”，则记录下来：不运行任何内容 | 在用户确认后附带 `confirmed: true` 的 `run_next_step`；若为“暂不需要”则使用 `declined: true` |
| `ask_user` | 用浅显通俗的话询问 `step.question`；按 `step.answers` 中的键传递其回答。如果用户表示“暂不需要”：当 `not-now` 本身是槽位可选的 `enum` 之一时，它属于有效回答——予以传递；否则记录下来：不运行任何内容 | 带有 `answers` 的 `run_next_step`——每个槽位写作 `<…>`，需替换为用户的原话；若“暂不需要”不是预设回答选项，则使用 `declined: true` |
| `wait` | 后台正在运行某项任务 | 带有 `wait_seconds: 120` 的 `project_status`；在模式保持为 `wait` 期间重复调用 |
| `use_tool` | 由你现在使用 `step.tool` 完成；不要退回给用户 | 例如带有 `path: "<each file the person named, where it is>"` 的 `add_data` |
| `human_only` | 由用户完成：向他们转达 `step.say` | 无 |

`step.command` 是轨道运行的内容——绝不是工具名称。调用中的 `<…>` 是供用户填写回答或文件的槽位；原样发回的槽位将被拒绝。

## 六个工具

### `start_project`

| 参数 | 类型 | 含义 |
|---|---|---|
| `folder` | 字符串，必填 | 项目的新文件夹，相对于 `parent_dir` |
| `from` | 字符串，必填 | 用户输入的源语言：代码或名称 |
| `to` | 字符串，必填 | 输出的目标语言：代码或名称 |
| `target_name`、`source_name` | 字符串 | 族群对该语言的自称称谓；对于私用代码（`qaa`–`qtz`）为必填项 |
| `purpose` | 字符串 | 翻译的用途，以用户的原话表述 |
| `parent_dir` | 字符串 | 在何处创建文件夹（默认：服务端的工作目录） |
| `confirmed` | 布尔值 | 仅在用户同意翻译方向后设为 `true` |

若未设置 `confirmed: true`，它会运行 `champollion new --dry` 并返回
`made: false`、`ask_first`（供转述的一句话：*“该翻译器接收 X 并返回 Y——即输入 X，输出 Y。这是您想要的翻译方向吗？”*）、`if_yes` 和 `if_the_other_way`（各自为完整的调用）以及
`languages`——每个名称解析出的结果；若用户输入的词是卡片记录的另一别名，则附带 `matchedAs`；若同一个词指代了多种其他语言，则附带 `alsoNamed`。请将这两项均向用户转述。若设置了 `confirmed: true`，它将创建项目并返回 `project`、`languages` 和 `next`（第一步）。

若没有卡片收录该名称且无相近匹配：拒绝信息中会附带
`if_it_has_no_code`，即附带 `to: "qaa"` 并将其名称作为 `target_name` 的相同调用。仅在用于用户提供的确切名称时使用它。

### `project_status`

参数：`project_dir`（必填）；`wait_seconds`（0–120）。设置
`wait_seconds` 后，当步骤处于 `wait` 时，它每 5 秒重新读取一次，并在步骤变更或超时后返回。

返回 `project`、`stage`（`"2/6 Gather your data"`）、`step`（`id`、`mode`、
`say`、`why`、`call`，并在存在时返回 `question`、`answers`、`command`、
`tool`、`for_the_person`），以及在适用时返回以下字段：

| 字段 | 内容含义 | 你的操作 |
|---|---|---|
| `true_now` | Forge 自身的记录（以完整语句呈现）：已训练的模型及其在开发集上的最高 chrF++、每个测试集的数据泄漏审计结论、测试集得分、训练是否在运行中、模型是否已提供服务及部署位置 | 仅根据这些语句向用户说明已完成的工作，切勿自行添加 |
| `waiting_for_agreement` | 尚未获得说话者同意的文件（`speakers_agreed: not-yet`）：每个文件均附带 `file`、`question`、`say` 及其专属的 `call` | 每个会话中温和地询问一次各问题；仅在用户表示所有人都已同意时发起其调用 |
| `files_not_added` | 本会话中 `add_data` 拒绝且尚未加入项目的文件，每个均附有其拒绝原因 | 逐个引入文件（拒绝信息中会说明具体方法），或者向用户说明遗漏了哪些文件及原因 |
| `model_in_use` | 模型提供服务后，紧随改进轮次各步骤呈现：`say`（其体验页面及使用方式）和 `for_the_person`（将其接入用户应用或网站的 `champollion connect` 命令） | 向用户告知一次；当他们需要时自行运行 connect |
| `blockers`、`warnings` | Forge 原文 | 逐字逐句转达 |
| `finished` | 当没有剩余步骤时：用户现在可以做的事情（在模型页面试用；接入应用） | 告知用户 |
| `error` | 无法指定步骤的原因 | 予以转达 |

不存在或不含 `champollion.project.json` 的项目文件夹会被拒绝，并在拒绝信息中列出临近找到的项目。

### `run_next_step`

| 参数 | 类型 | 含义 |
|---|---|---|
| `project_dir` | 字符串，必填 | 项目文件夹 |
| `step_id` | 字符串，必填 | 刚返回的 `step.id`（或 `waiting_for_agreement` 条目的 id） |
| `answers` | 字符串键值对象 | `ask_user`：按 `step.answers` 中的键填写的用户回答 |
| `confirmed` | 布尔值 | `confirm`：仅在用户明确确认后设为 `true`。此外：连续失败两次的步骤，仅在用户指示按原样重试时使用 |
| `declined` | 布尔值 | 当用户对 `confirm` 步骤或自身没有 `not-now` 选项的问题表示“暂不需要”时设为 `true`：不运行任何内容，且本会话不再重复询问。若 `not-now` 本身属于选项之一，请在 `answers` 中传递 |

在运行任何内容之前，它会重新读取下一步。**锁定规则（Locks）：**

- 不匹配的 id 会被拒绝：`the project changed since that step was named
  — call project_status again`, with `current`。
- `human_only` 会被拒绝（`a person does this step: …`）；智能体使用工具执行的 `human_only` 步骤会被拒绝，并提示应使用的工具。
- `wait` 会被拒绝；未带有 `confirmed: true` 的 `confirm` 会被拒绝（`ask the
  person first, then call again with confirmed: true`）。
- `ask_user`：每个回答均为必填（`missing the answer "<key>" — ask the
  person who holds the data; never answer for them`); a `<…>` 占位符会被拒绝；超出 `enum` 范围的回答会被拒绝。
- 仅运行轨道自带的程序：`champollion`、`nmt-forge` 以及 `uv tool
  install … nmt-forge`. A command using `|`, `;`, `<`, `>`, `` ` ``, `$` 或单独的 `&` 会被拒绝；`&&` 用于拼接各个部分，依次运行并在遇到第一个失败时停止。
- 每个部分执行时间限制为 10 分钟（`uv` 安装限制为 15 分钟）。
- 在既非 `confirm` 也非 `ask_user` 的步骤上传递 `declined: true` 会被拒绝：`this step does not wait on the person's yes (<mode>) — there is
  nothing to decline`。
- 在 `answers` 包含 `not-now`（目前为更强模型提议中的 `try_it`）的步骤上传递 `declined: true` 会被拒绝，拒绝信息中会附带该步骤的 `answers`：`"not now" is one of this step's own answers — pass it in
  answers (try_it: "not-now"): it is recorded, and this comes back only after
  more rounds; declined would ask again next session`。

返回 `ran`——每个部分包含：`command`、`exit_code`、发生超时时的 `timed_out`，以及 `output` 的最后 40 行——并返回 `next`，即具有 `project_status` 格式的下一步。

#### “暂不需要”

有两种记录方式，具体由步骤类型决定：

| 步骤 | “暂不需要”的表现形式 | 记录位置 | 何时再次出现 |
|---|---|---|---|
| `answers` 包含 `not-now` 的 `ask_user` 步骤（更强模型提议：`try_it`、`yes` 或 `not-now`） | 作为一个回答：`answers: {"try_it": "not-now"}` | Forge 账本（`model-change`、`answer: "not-now"`）；其他内容不变 | 开发集评估判定为 **no-change** 或 **worse** 两个轮次之后——跨会话生效 |
| `confirm` 步骤（训练、安装、上线使用模型），或用户暂时无法回答的问题 | `declined: true` | 仅保存在当前服务端的内存中 | 当服务端重启时（下一个会话） |

`declined: true` 不会运行任何内容，并返回 `declined`（步骤 id）、`ran: []`、
`say`（*“未运行任何内容。本会话不再重复询问；若用户主动提及并确认，届时再执行。”*）以及 `next`。拒绝记录在服务端生命周期内保留——即单次会话；服务端重启后将被遗忘。在拒绝生效期间，该步骤从 `project_status` 和 `run_next_step` 返回时会带上
`declined_this_session`（拒绝发生的时间，ISO 格式），其 `say` 以 *“They
said not now (HH:MM UTC) to this: …”* 开头，并以 *“Do not ask again this
session — nothing that needs their yes runs. If they bring it up themselves
and say yes, take it with confirmed: true (or their answers).”* 结尾。后续如果传入
`confirmed: true` 或 answers，将执行该步骤并清除此拒绝状态。
**注意。** 本会话中切勿再次询问，也不要绕开该步骤；如果用户主动提起并确认，届时再执行。

#### 当步骤失败时

**锁定规则。** 连续失败两次的步骤（非零退出码或超时，在服务端生命周期内累计）在第三次调用时将被拒绝，除非传入 `confirmed: true`，
并附带其 `last_output`。**注意。** 该标志由你负责设置：向用户说明具体错误信息，由用户进行修正（在终端中运行修正后的命令即可——然后调用 `project_status`），或者由用户指示按原样重试。

### `add_data`

| 参数 | 类型 | 含义 |
|---|---|---|
| `project_dir` | 字符串，必填 | 项目文件夹 |
| `path` | 字符串，必填 | 文件的具体路径：绝对路径，或相对于项目文件夹/服务端启动路径的相对路径 |
| `into` | `parallel`（默认）· `test` · `lexicon` | 用于学习的句子对；校验过的测试句；词表 |
| `source_col`、`target_col` | 字符串 | 列表达方式：字母（`A`）、数字或表头；对于 ELAN，为拒绝信息中列出的层级（tier）编号（或用户输入的精确层级 id）；对于 LIFT，为语言代码 |
| `sheet` | 字符串 | 当有多个工作表或表格时，指定具体的工作表或表格 |
| `header` | 布尔值 | `true`：首行为表头；`false`：首行为数据 |
| `usfm_source` | 字符串 | 仅限 USFM 经文文本：另一种语言的文本（`.usfm` 文件或文件夹） |
| `replace` | 布尔值 | 重新读取已添加的文件（更改表头或列）；数据持有者的回答将被保留 |

它会运行 `champollion data add`。首次调用时仅提供路径即可：若表头命名了对应语言对，即可确定列；否则它会进行询问，由你转问用户——切勿根据内容自行决定。它支持读取电子表格（`.xlsx`、`.ods`、`.csv`）、`.tsv` 和 `.txt`、Word `.docx` 中的表格、Toolbox 与 LIFT 词典、ELAN `.eaf` 文件以及 USFM。

返回 `result`（CLI 的报告：统计数量、列、按编号列出的 ELAN 层级，以及行检查列出的行号——包括副本、重复、异常长度、调换或错位的行，不删除任何内容——绝不输出句子内容）、当文件从服务端起始文件夹找到时的 `read_from`，以及当文件包含更多内容时（词典中的例句作为句对，或其释义作为词表）的 `also`——每个条目均为一个完整的 `add_data` 调用。除非用户对该文件的使用条款有所限制，否则直接发起调用。原样转达行检查结果：由用户在他们自己的文件中查看这些行（[数据规则](/docs/agents/data-rules#what-tools-print-and-never-print)）。切勿要求用户移动文件；`inbox/` 仅供用户放置文件。

### `try_translation`

参数：`project_dir`；`text`——最多 10 行，至多 2,000 个字符，每行一句，填入用户提供的原文。

它会在仅限本机范围内找到该项目提供服务的模型（`nmt-forge jobs --json` 中最新的健康 `serve` 任务），并读取其 `/health`。

- **锁定规则。** 若 `output_local_only` 不是 `false`（为 true 或 unknown），它不会返回任何翻译：而是返回 `shown_to_person_only: true`、`open`（模型专属页面）以及 `say`。请引导用户前往该页面；不要让用户把那里的翻译复制粘贴发回给你。
- 要求提供令牌的服务端会被拒绝：令牌绝不能传递给智能体。
- 否则它会返回 `model`、`pair`、`translations`（每行对应 `source`、`translation`）、`errors`（若有）以及 `say`：请按原样传达；服务端不会校验其返回的任何内容。

### `explain`

参数：`topic`。供转达的通俗说明文本：

| `topic` | 涵盖内容 |
|---|---|
| `rails` | 项目文件夹与步骤顺序 |
| `privacy` | 伴随文件（sidecar）的含义；为何切勿自行打开文件 |
| `quality` | 评分能保证什么、不能保证什么 |
| `modes` | 如何执行各类步骤 |
| `improve` | 模型投入使用后的各个轮次：大约每十行审核行中有一行*“特意取自早期表格（表格中有相应标注……）”*；提议使用更优模型并获得用户同意（*“单凭判定结果不会改变任何内容”*）；数据过少（too-few）判定；在*“开发集能够判定的轮次中连续两轮无增益（从上一个投入使用的模型算起）”*之后提出更强模型提议 |
| `off_rails` | 脱离轨道：运行专家命令，然后调用 `project_status` |

## 整个会话的注意事项

- **注意。** 你读取的所有内容都会发送给你的模型提供商。`add_data`、`project_status` 和 `run_next_step` 仅汇报数量、列和状态，绝不汇报句子；请保持这一原则。切勿自行打开文件。
- **注意。** `ask_user` 的回答、`confirmed: true` 以及 `waiting_for_agreement` 的确认必须来自用户本人。工具仅会检查回答是否存在且格式规范；只有你才能确保这些回答真正出自用户。
- **注意。** 逐字逐句转达 `blockers`、`warnings` 及每项警告提示，转达每个数值时请一并说明其单位以及所基于的测试集（[指导原则](/docs/agents/coaching)）。

## 深入了解

- [运行契约](/docs/agents/contract) —— 锁定规则与注意事项。
- [轨道模型](/docs/agents/rails-model) —— 完整流程、运行模式以及这些工具所读取的步骤 id。
- [从 Shell 驱动轨道](/docs/agents/shell) —— 以命令行形式执行相同的步骤。
- [MCP 服务端](/docs/network/getting-started/mcp-server) —— 两种配置预设与完整工具目录。
