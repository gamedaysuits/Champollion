---
title: "数据与传输规则"
slug: /agents/data-rules
description: "每个 Champollion 工具对族群数据所适用的规则：逐字段解析 set/1 sidecar、local-only 及其临时默认值、training not-allowed、已同意的说话人与持有者、各工具输出与绝不输出的内容、四种传输模式、注册层级，以及作为衍生内容的模型输出。"
---

# 数据与传输规则

掌握语言数据的人决定其使用方式。轨道机制会将他们的决定记录在每个文件旁，所有工具都严格遵守这些记录——将社区对语言数据的所有权与控制权作为设计原则，而非可配置项。本页即是完整的规则集：每个字段的作用、工具会拒绝的操作，以及只有您才能保留的部分。

## 边车 (set/1)

在任何数据文件旁，`<file>.champollion.json`，`$schema`
`https://champollion.dev/schemas/set/1.json`。未知键会被拒绝；附注
写在 `x-` 下。在 set/1 之前写入的边车（无 `$schema`）会被读取为 set/0
并保持有效（`champollion upgrade` 会重写它）。

| 字段 | 取值 | 效果 |
|---|---|---|
| `transmission` | `local-only`（唯一取值） | 仅本计算机上的模型可以查看文本；所有工具均拒绝将其发送至任何地方（包括 `mt-eval project offer`） |
| `role` | `train` · `dev` · `test` · `sealed` · `input` · `resource` | 文件的用途。绝不会在 `test` 和 `sealed` 上进行训练 |
| `kind` | `parallel` · `monolingual` · `lexicon` · `grammar` · `glossary` | 包含的内容 |
| `pair` | `{source, target}` | 其列的方向，采用卡片的代码表示 |
| `fields` | `{source, target}` | 哪一列或 JSON 字段保存哪一方语言 |
| `terms.training` | `allowed` · `not-allowed` | `not-allowed`：任何模型均不得在其上进行训练 |
| `terms.owner` | 文本 | 由谁持有，按持有者的原话记录 |
| `terms.speakers` | 文本 | 包含谁的话语，按持有者的原话记录 |
| `terms.speakers_agreed` | `yes` · `not-yet` · `some-said-no` | 话语所属的人群是否同意 |
| `terms.consent_record` | 路径 | 知情同意附注，相对于该文件所在的文件夹 |
| `holders_agreed` | `{by, date}` | 持有者中是谁同意仅限本地的输出可以存放在当前位置（不放宽任何限制） |
| `derived_from` | 路径 | 生成此文件的受保护源文件；其标记已延续至此 |
| `id`、`name`、`license`、`tier`、`segment`、`sha256`、`rows`、`card`、`registeredAt` | | 由 `champollion network register-corpus` 写入；被更改的文件（不同的 sha256）不再获得该卡片的 id |
| `written_by` | 文本 | 写入此文件的命令 |

**锁闭。** 边车只会让文件的限制更严格：绝不会放宽语料库封套或注册表条目所规定的内容。

## 仅限本地与临时默认值

当项目的 `defaults.transmission` 为 `local-only`（即 `champollion new` 写入的值）时，`champollion data add` 会将其写入的文件标记为仅限本地，且对 `--into test` 始终如此。在持有者给出答复之前，该标记作为工具提供的保护，带有 `"x-transmission-default": true` 标识。

- 持有者的首次答复具有决定权。`champollion data mark <file>
  --may-leave` lifts a provisional mark; `--local-only` 会确立他们的决定（该标识会被移除）。
- **注意。** 工具无法辨别是谁运行了命令。仅在获得持有者本人的答复后，才可解除临时标记。
- **锁闭。** 持有者设定的仅限本地标记无法被任何命令解除：*“此文件已被标记为仅限本地，且边车只会变得更加严格。它是否可以离开此计算机由其持有者决定——如果他们同意，请手动编辑边车文件。”*
- **锁闭。** 对尚未标记为仅限本地的文件执行 `data mark` 需要 `--local-only` 或 `--may-leave`：*“此文件的文本是否可以发送至外部 AI 服务由其持有者决定，因此绝不默认假设”*。

各工具中“仅限本地”的具体含义：

| 场景 | 具体表现 |
|---|---|
| 任何评测（`mt-eval run`、forge 打分） | 策略解析为 `sealed`（层级 `local-only`）：仅环回端点、测试框架自身的进程内适配器（`local-model`）或带有 `--attest-local-transport` 运行的外部方法可以查看文本 |
| 终端与 `--json` 输出 | 其句子会被隐匿；转而打印行号、ID、计数和分数，并附带一行说明原因 |
| 从中衍生的文件 | 切分集、清洗副本、假设译文和运行日志保留文本（它们位于用户的文件夹中），并在各自的边车中带有该标记 |
| 在其上训练的模型 | 其输出同样仅限本地（`forge-model.json` `trained_on.terms`；未记录算作仅限本地）：`try_translation` 仅返回模型页面，非环回的 `champollion connect`、`mt-eval serve` 以及项目外部的 `mt-eval translate` 需要 `--holders-agreed-by`，且无论通过 `api` 还是 `local` 方法，`sync` 都会扣留其回答（[服务部署](/docs/agents/serving)） |
| 辅导文件或词典 | 带有边车的辅导文件会将其策略带入提示词；当词典为仅限本地时，词典运行的输出会被隐匿 |

**注意。** `--attest-local-transport` 用于声明方法的端点为本地。仅当您已验证该端点确实位于本机器上时才可传入此参数：环回地址可能是将请求转发至任何位置的代理。

## 训练

- **锁闭。** nmt-forge 拒绝在边车标有 `terms.training: not-allowed` 的文件上进行训练；无法读取的边车视为受限，绝不视为无限制。
- **锁闭。** `champollion data combine` 绝不会合并未获许可的文件：它会将该文件连同其边车移至 `data/not-for-training/`。它会拒绝持有者尚未答复的文件——即没有 `terms.training`，或没有 `terms.speakers_agreed`（*“目前尚无人说明其中话语所属的每个人是否均已同意——champollion 接下来会询问相关人员；之后再进行合并”*）——且合并后的文件将继承所有文件中最严格的条款（只要有一个为仅限本地即为仅限本地，只要有一个为未获许可即为未获许可，并列出每一位所有者）。
- **锁闭。** 引导流程的条款步骤仅在 `data/parallel/`、`data/lexicon/`、`data/grammar/` 或 `data/monolingual/` 中文件的边车同时具有 `terms.training` 和 `terms.speakers_agreed`（且训练答复出自持有者本人，而非下文所述的工具防范提示）时，才将其视为已答复；在此之前它会再次询问，且轨道机制不会继续向下执行。
- **注意。** nmt-forge 读取的是 `terms.training`，而非 `speakers_agreed`。如果只有一份句对文件，则不会发生合并，因此只有条款步骤会等待该答复：绝不要对说话者答复缺失的文件进行训练。
- **锁闭。** `test` 或 `sealed` 文件绝不会用于训练：对其传入 `--training allowed` 会被拒绝，为其赋予其他角色也会被拒绝。
- **锁闭。** `not-allowed` 无法通过命令更改为 `allowed`（*“如果持有者同意用于训练，请手动编辑边车文件”*）——下文提及的一种例外情况除外。
- 经文（USFM）导入时带有作为工具防范提示（`"x-training-default": true`）而标记的 `terms.training: not-allowed`；持有者的答复会替换它。

## 话语所属者及同意情况

`--speakers` 记录该文件包含谁的话语；`--speakers-agreed` 记录他们是否同意。

| `speakers_agreed` | 效果 |
|---|---|
| `yes` | 按照持有者的指示进行训练 |
| `not-yet` | 训练被强制设为 `not-allowed`，直到所有人均同意；该文件会出现在 `waiting_for_agreement` 中 |
| `some-said-no` | 任何模型绝不得从该文件中学习：*“将他们的话语提取到另一个文件中，并对其余部分进行标记”* |
| （无答复） | 条款步骤会持续询问，且 `data combine` 会拒绝该文件（见上文） |

**命令可放宽的唯一例外：** `not-yet` → `yes` 连同
`--training allowed`。此前被 `combine` 搁置的文件随后会返回到
`data/parallel/`，以供下一次合并。

**注意。** 每个会话中仅温和地询问一次 `waiting_for_agreement` 问题，且仅在当事人明确确认每个人均已同意后方可答复。

**`--holders-agreed-by "<who>"`** 记录数据持有者中同意仅限本地的输出可以流向特定位置的某个人员姓名：写入应用程序的区域设置文件（`champollion connect`，记录为句对的 `holdersAgreed`）、发布到其他机器可以访问的地址（`mt-eval serve`、`nmt-forge serve`，在 `/health` 上报告），或写入项目外部的文件（`mt-eval translate`，记录为边车的 `holders_agreed`）。它不会放宽任何其他限制：对所有工具而言，该输出依然保持仅限本地。**注意。** 仅传入当事人提供给您的姓名。

## 工具会打印与绝不打印的内容

| 工具 | 会打印的内容 | 绝不打印的内容 |
|---|---|---|
| `champollion data add` | 计数、列信息（字母、填充率、平均长度、拉丁字母占比）、仅当表头单元格命名了句对语言之一时的表头单元格、按编号列出的 ELAN 层级，以及其行检查所指明的行号 | 句子；任何其他表头单元格（转而打印其长度）；ELAN 层级的 ID |
| `champollion data mark`、`combine`、`next`、`validate` | 字段、计数、状态 | 数据文件的文本——它们绝不打开文件 |
| `champollion improve …` | 计数和百分比 | 表格中的句子 |
| `champollion sync`（`local` 和 `api` 方法） | 文本中包含 forge 模型在训练中从未见过的词汇的键（来自服务器的 `meta.unseen_words`） | 文本或词汇本身 |
| `nmt-forge`、`mt-eval` | 对于仅限本地、已封存或需要知情同意的语料库：ID、行号、计数、分数；错误消息中的 `[sentence withheld]` | 人类可读或 `--json` 输出中的句子 |
| MCP rails 工具 | CLI 打印的内容（经裁剪） | 句子；仅限本地模型的输出 |

**注意。** `--show-text`（nmt-forge；`mt-eval compare`）会打印被隐匿的句子。它仅供用户在其本人的终端上使用，绝不能供智能体使用——您读取的内容会发送给您的模型提供商。

**注意。** 没有任何工具能够阻止您打开文件。切勿打开、打印、总结或粘贴社区的数据文件、测试句子、词表或电子表格——导出文件中的 `input-words.json` 亦是如此：它列出了其训练句子的词汇，并保留在模型文件夹旁边，绝不放入其中（[服务部署](/docs/agents/serving#what-an-export-holds)）。

**行检查。** 在导入文件（句对、测试集或词表）时，`data add` 会对照该文件自身的两列检查各行——不借助词典，也不移除任何内容。它会统计并按行号指明以下问题：

- 原文照搬：译文与源句完全相同（专有名词或借词无妨；否则说明译文缺失）；
- 重复：与先前句对重复；
- 长度异常：译文远长于或远短于该文件的常见比例（被截断，或一个单元格内包含两句话）；
- 疑似颠倒的行：源语言读起来像该文件的译文，反之亦然；
- 疑似错位一行的连续行：其译文与下一行或上一行契合得更好——数字、问号和长度与相隔一行的内容对齐，词汇也是如此：根据两者的词在同文件其余部分中共同出现的频率，计算某一行源语言词汇与某行译文词汇的匹配程度（越罕见的词权重越高；该行本身不计入）。这可以发现模板化句子文件中出现的错位，这类文件的句子长度通常看起来都差不多；当文件中的词汇提供的信息过少时，此检查不会产生额外效果。

每种问题最多打印 12 个行号（错位一行的问题最多打印 6 处连续区间）——对于电子表格，按用户本人文件中的行号计算（包含表头）——并将计数记录在边车的 `x-import.quality` 中。长度、颠倒和错位检查需要至少 20 个句对；词表（`--into lexicon`）仅执行原文照搬和重复检查。**注意。** 请转交这些行号：由社区成员自行查看其文件中的对应行并做出决定。切勿自行打开文件查看。

**ELAN 文件。** 当 `data add` 无法辨别哪个层级对应哪一方语言时（未通过标志指定语言端，且记录为其语言的层级不恰好为一个），它会拒绝处理并按文件中的顺序按编号列出各层级：对于引用了其他层级的层级，显示为 `tier <n> (<language or
"no language">, <count> annotation(s))`, with `, under tier <m>`。请将这些编号作为 `--source-col` 和 `--target-col` 传入（`champollion data add <file> --source-col <number> --target-col <number>`）；边车会记录这些编号（`x-import.elan_tiers`）。未指向任何层级的编号或 ID 会被拒绝（`no such tier — … Name a tier by its number`），记录语言不属于该端的层级也会被拒绝。两个层级仅在其中一个引用了另一个或者二者共享时间槽时才会配对——绝不靠猜测。**注意。** 层级的 ID 是文件制作者随意输入的，通常是人名，因此 `data add` 绝不会打印它。用户本人可以输入准确的 ID；您则传入编号。
LIFT 文件按其语言代码进行匹配，Toolbox 文件则按其 MDF 标记进行匹配（按标准 `\ge` 和 `\xe` 为英语）。

## 传输模式

每次评测在发送任何内容之前都会将其语料库解析为一种模式（`arena/mt_eval_harness/transmission_policy.py`），并记录在运行日志中：

| 模式 | 适用条件 | 远程模型 |
|---|---|---|
| `cleared` | 明确许可重新分发的许可证 | 允许 |
| `no-train` | 标准 Creative Commons 非商业性使用或禁止演绎许可证；或未声明许可证的未注册语料库 | 仅限通过不使用输入进行训练的渠道：固定到 `data_collection: deny` 的 OpenRouter、第一方供应商 API 或本地。此保证仅承诺不用于训练，不保证不保留数据 |
| `consent-required` | 修改过的、定制的或未说明的许可证（`LicenseRef-*`） | 拒绝，直到数据集条目记录了 `transmission_consent` 授权（`granted_by`、`date`、`scope`、`evidence`）；本地仍然可用 |
| `sealed` | 留出集或黄金标准测试片段、隔离数据集或数据保管人标记的仅限本地 | 拒绝，不可覆盖 |

- **锁闭。** `consent-required` 或 `sealed` 语料库的文本也会对终端隐匿。
- 在 `no-train` 语料库上使用外部方法（插件）会收到警告，但不会被拒绝：测试框架无法检测插件的通道。在 `consent-required` 和 `sealed` 语料库上则会被拒绝，除非指定了 `--attest-local-transport`。
- **锁闭。** 本地提供商仅在其端点为环回地址（`localhost`、`127.0.0.1`、`::1`、unix 套接字）时才算作本地——绝不能仅凭其名称判定。
- **注意。** 绝不要擅自记录 `transmission_consent` 授权，也绝不要代权利人解释许可证。授权须由数据集保管人在权利人授予后亲自记录。
- **注意。** `--allow-data-collection` 仅针对未声明许可证的未注册语料库解除不训练固定限制；它声明调用方拥有相应权利。仅在当事人明确表示其拥有权利时才可传入此参数。

## 注册层级

注册语料库是可选的：轨道机制从不需要此操作。注册会写入元数据卡片，以便对语料库进行命名、比对，并在持有者选择的情况下进行列出。`champollion network register-corpus` 在终端中具有交互性，且支持通过标志进行脚本化操作（`--tier`、`--data`、`--license`、`--name`……）。
**注意。** 与每项条款一样，层级的选择完全由持有者决定。

| 层级 | 卡片 | 文本 | 拒绝的情况 |
|---|---|---|---|
| `local-only`（默认） | 写入 `--data` 文件旁（或 `--out`，或此处），绝不写入共享卡片文件夹 | 绝不离开此计算机；边车获得 `transmission: local-only` | — |
| `private` | 带有 `quarantine: true` 的元数据；通过 npm 安装时它保留在本地，列出它是单独的请求（`champollion network submit --type dataset`） | 绝不上传；无传输标记——其许可证决定传输模式 | — |
| `public` | 元数据外加从源端获取的指针（`--repo-url`、`--builder`） | 绝不托管：直接从其源端获取 | 非商业性、禁止演绎、受限或未经确认的许可证（*“请改为以私有或仅限本地方式注册。”*）；`--data` |
| `sealed` | 带有 `quarantine: true` 及已封存数据块的元数据（`--seal-input`、`--threshold-pubkey`、`--custodian-group`、`--qualifier-id`） | 仅存在密文，写入 `<id>.sealed.json` 或 `--seal-out` | 属于公开语料库的字节级副本的文件；`--data` |

在所有层级中，注册时均不会上传任何内容（`--json` 显示为 `uploadedContent: false`）。来自 npm 安装的唯一网络调用是在本计算机上将文件的 sha256 与公共目录进行比对（哈希值绝不外传）；使用 `CHAMPOLLION_OFFLINE=1` 时，卡片会说明未进行比对。使用 `--data` 时，边车会记录 `id`、`name`、`license`、`tier`、`sha256`、`rows`、`card` 和 `registeredAt`。**锁闭。** 已注册的 ID 绝不重新推导：拒绝以另一个 ID 再次注册该文件，被更改的文件（不同的 sha256）不再获得该卡片的 ID 或评级。

## 输出属于衍生作品

模型在受限句子上的输出是其衍生作品，而评测会大规模生成此类输出。工具对待输出的方式与其对待输入完全一致：

- 对于每个非 `cleared` 的语料库，运行过程都会记录并打印一条声明：其预测结果是受限句子的机器衍生内容，不得分发。
- 在文本被隐匿的情况下（仅限本地、已封存、需要知情同意），由其生成的每个文件——运行日志、报告、对比结果、缓存条目、`mt-eval translate` 输出、forge 切分的各语言端、清洗后的语料库和假设译文——都会获得一个带有该标记的 set/1 边车（`derived_from`、`written_by`）。`no-train` 语料库会获得声明，但没有边车。
- 在仅限本地文本上训练的模型，其生成的输出同样仅限本地（见上文）。
- `mt-eval publish` 绝不上传仅限本地语料库的句子（即使指定了 `--publish-entries`），且默认情况下针对此类语料库仅发布经辅导提示词的哈希值。对于其他语料库，除非指定了 `--redact-coaching`，否则均会发布提示词。

**注意。** 发布是社区成员的决定，以他们的原话为准，并须首先向他们展示预览（`--dry-run`）。切勿代他们发布、粘贴或发送运行输出。

## 深入了解

- [操作公约](/docs/agents/contract) §1 和 §3。
- [您的话语，您的规则](/docs/your-words-your-rules)——面向社区的版本。
- [注册语料库](/docs/network/sovereignty/registering-corpora)——各层级及完整参数标志。
- [服务与部署](/docs/agents/serving)——实践中的仅限本地输出。
- [数据主权通俗释义](/docs/learn/data-sovereignty)。
