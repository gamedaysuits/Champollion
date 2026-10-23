---
title: "使用 nmt-forge 进行训练"
slug: /agents/training
description: "nmt-forge 如何按既定轨道训练和测试模型：模型预设及 --model auto 根据内存自动选择的机制、逐条命令详解带防护机制的循环、解码与长度限制、后台任务与一次仅一项训练的排队队列、磁盘空间（保留的检查点、磁盘检查、tidy）、导出与服务提供、改进轮次（轮次结论、语言使用者的评判）与升级更强模型提议、合成数据、经实测的“现象 → 原因 → 解决办法”对照表，以及故障分类体系。"
---

# 使用 nmt-forge 进行训练

`nmt-forge` 在护轨约束下，使用族群的句对训练模型：它会拒绝任何可能破坏结果的操作，且每次拒绝都会说明具体问题、原因及修复方法。它本身没有实现任何指标——每一个评分都来自评估引擎（`mt-eval`），即为所有其他内容评分的同一套代码。

在轨道流程中，您极少需要手动输入这些命令：`champollion next` 会列出它们，并从 `forge` 步骤开始转发 forge 自带的建议程序（`nmt-forge status`）。本页面将介绍这些步骤的具体操作。

## 模型

`nmt-forge init --model <preset>` 会将预设作为明确的数值写入 `config.json`（哈希到每次运行的标识中：后续的 forge 版本绝不会改变现有项目的运行记录）。`nmt-forge use-model <preset>` 用于切换项目。

| 预设 | 说明 | 需求 | forge 的预期说明 |
|---|---|---|---|
| `cpu-tiny` | 从零开始基于句对训练的小型 transformer，词表大小为 4,000 个词元，从训练行中学习所得 | 仅需 CPU · 无需下载 | “在约 1–2k 句对上：chrF++ 大致为 5–30（仅高度模板化的数据才能达到上限）——记住的是短语和数据的模板，而非通用翻译” |
| `byt5-small` | 经微调的 Google ByT5-small（3 亿参数，读取字节——无需拟合词表） | 需下载约 1.2 GB · 推荐 Apple 芯片或 CUDA GPU | “在 forge 自己的测试中，它从相同句对中学到的内容远多于 cpu-tiny——仍需在开发集上将其与当前在用的模型进行对比测量” |
| `byt5-small-lowmem` | 相同的模型、学习率和长度限制，针对 8–15 GB 内存的计算机进行了配置：Adafactor、梯度检查点，以及 4 个句对的批处理累积 4 次（每步同样是 16 个句对）——每步占用内存更少，耗时更长。尚未在 8 GB 计算机上进行测量 | 同 `byt5-small` | 同 `byt5-small` |
| `cpu-finetune` | 在 CPU 上微调的预训练 Marian/opus-mt 小型模型。基底模型由您指定（`--base`）；绝不盲目猜测 | 仅需 CPU · 需下载约 300 MB | “取决于基底模型的目标语言亲缘关系有多近——请在开发集上将其与 cpu-tiny 对比测量” |
| `nllb-600m` | 采用 LoRA 的 NLLB-200 蒸馏版 600M | CUDA GPU（8 GB 以上）· 需下载约 2.5 GB | “当 NLLB 涵盖相关语言时，是三者中最强的；仍需进行测量——切勿主观臆断” |

每个预设均使用 forge 的训练额外依赖（`nmt-forge[hf]`）进行训练，随机种子为 42。没有任何预设会设定时间预算：该数值由族群决定。

- **不带 `--model` 时**，`init` 写入 `cpu-tiny`。
- **`--model auto`**（轨道传递的参数）读取 forge 可用于训练的 GPU 内存——在配备 Apple 芯片的 Mac 上，为计算机内存（与 GPU 共享）；在 `PATH` 上配合 `nvidia-smi` 时，为最大 NVIDIA 显卡的显存：16 GB 或更大（或无法读取内存大小）→ `byt5-small`；8–15 GB → `byt5-small-lowmem`；8 GB 以下 → `cpu-tiny`。若两者皆无，则为 `cpu-tiny`。原因及检测到的内存量会被打印出来（`chosen: …`），并作为 `model_choice` 在 `--json` 中返回。它并不测试 GPU 是否正常工作。`NMT_FORGE_AUTO_PRESET` 可覆盖该设置（必须指定预设名称）。
- **迭代轮次推荐的更强模型**仅提供给当前在用模型为 `cpu-tiny` 的项目：在 `--model auto` 会选中它的情况下为 `byt5-small-lowmem`，否则为 `byt5-small`——同样适用于 `auto` 会选择 `cpu-tiny` 的计算机；推荐信息中的 `why` 会说明其所需配置。

**注意：** 切勿将预设的预期表现当作保证。务必在开发集上进行测量。

## 带护轨的循环流程

每个命令都接受 `--json`；`--workspace <dir>`（默认为 `.forge`）置于子命令之前。Forge 拒绝接受缩写形式的标志。

| 步骤 | 命令 | 作用 | 拒绝的操作 |
|---|---|---|---|
| 工作坊 | `nmt-forge init <code> --dir . --pair <src>-<tgt> --model auto` | 写入 `.forge/`、`config.json`、`NEXT_STEPS.md` | 无法读取的 `--pair`；缺少 `--base` 的 `cpu-finetune` |
| 测试集 | `nmt-forge registry add project-test <file> --role test` | 固定文件的 sha256；启动其读取日志 | 测试集或封存集中的合成行；已注册但内容不同的名称（除非指定了 `--allow-rotate`） |
| 筛查 | `nmt-forge leak-audit <corpus> --clean-to <clean.jsonl>` | 根据所有已注册的开发集、测试集和封存集筛查每个句对；写入干净副本 | 覆盖正在使用的文件（除非指定了 `--overwrite`）；筛查后无剩余训练数据的结果 |
| 预测 | `nmt-forge prereg new <id> --eval-set <set> --expect "…" --rationale "…"` | 在获得任何评分前写入人员预测 | 已存在的 id；在 forge 或 `mt-eval` 对该数据集进行任何评分读取之后执行写入（除非带有写入台账的 `--allow-after-reads`） |
| 开发集 | `nmt-forge split <clean.jsonl> --test 0 --dev <n> --seed 42 --near-dupe 0.6 --max-group <m> --out data/split --register project` | 分组不相交的开发集划分，注册为 `project-dev`。护轨的 `<n>`：占已筛查句对的十分之一，至少 50 个，至多 500 个——在少于 200 个句对时占四分之一（[shell](/docs/agents/shell#build-and-test-a-model)）。`--near-dupe 0.6` 将近似副本（词重合度 ≥ 0.6）保留在同一侧，这是后续每一轮筛查适用的阈值；护轨将 `--max-group` 设为开发集大小的一半加一，因此基于模板编写的文件仍可被切分 | 某一侧超过请求大小的 1.5 倍，或训练集保留的行数不足一半 |
| 基准线 | `nmt-forge floor <word lists>` | 根据词典逐词翻译开发集，并按与运行的开发集评分相同的方式对其评分 | 未注册开发集 |
| 检查 | `nmt-forge preflight run --config config.json` | 运行该次运行将命中的每个关卡及其修复方案；如果有任何失败则以退出码 2 退出 | — |
| 训练 | `nmt-forge run config.json --detach` | 进行训练，根据开发集选择检查点，删除该次运行的其他检查点（[磁盘空间](#disk-space)），写入带有 `run-manifest.json`、`run-report.md`、`dev-outputs.jsonl` 的 `.forge/runs/<run name>-<8 hex>/` | 已经存在的运行（相同配置、训练文件和开发集）；磁盘空间不足（在写入任何内容之前触发 `disk-room`；可通过 `--skip-disk-check` 覆盖）；正在进行的运行；泄露到测试集或封存集中的训练行；训练集中包含开发集行；标记为禁止训练或隔离的数据；`terms.training: not-allowed`；合成数据超过上限；解码上限短于参考译文；未知的配置键 |
| 测试集评分 | `nmt-forge export <run-manifest.json> --prereg <id> --out export/` | 针对预测对测试集进行一次评分；打包模型，并在其文件夹旁附带 `input-words.json`——即它所训练过的词汇，以便服务器能够指出其从未见过的词汇（[服务部署](/docs/agents/serving#what-an-export-holds)） | 未预注册，或存在多个但未指定 `--prereg`；已用尽的封存集；非空的 `--out` 但缺少 `--force` |
| 选择 | `nmt-forge choose <export>/model` | 记录人员选择的模型 | 不是带有模型的已记录导出的文件夹 |
| 服务部署 | `nmt-forge serve <export>/model --detach` | 在本机上提供服务（[服务部署](/docs/agents/serving#nmt-forge-serve)） | 非环回接口且未提供令牌，或仅限本地的模型且未指定 `--holders-agreed-by` |

所有重要内容均记录在哈希链账本（`.forge/ledger.jsonl`）中：注册信息、读取记录及其用途、预测、评分、封存集消耗、覆盖操作、审核裁定、基准线、导出记录、模型选择、服务提供以及任务启动与退出记录。运行清单即为一次运行的完整记录。

**预检门禁：**配置检查（打印完整配置哈希）、工作区匹配、无正在进行的运行、开发集隔离墙、训练数据、后端已安装、选择插件、测试集近似孪生与开发集近似孪生（警告）、泄露审核、训练数据配比、生成余量、调度合理性。

**解码。**最终开发集解码、测试读取（`export`）、在用模型重新翻译开发集以及被服务的模型均使用束搜索，并带有 `decode.num_beams`（默认为 4，除非 `config.json` 另有说明）；检查点选择会对多个检查点进行排序，采用贪心解码。导出记录中会记录 `beams_applied`，且 `nmt-forge serve` 会按照模型测量时的方式进行解码：缺少该记录的较旧导出模型则以贪心方式提供服务。

**长度限制。**模型最多从源句的 `model.max_src` 个词元及其译文的 `model.max_tgt` 个词元中学习，翻译时最多读取 `model.max_src`，最多写入 `decode.max_new_tokens`（`byt5-small`：各 320 字节——拉丁字母约 320 个字符，音节文字约 100 个字符；`cpu-tiny`：输入 256 个词元，输出 384 个词元）。任何截断都不会静默发生：训练会在截断前统计超出任一限制的句对数，最终开发集解码也会统计输入时被截断的句子以及因达到上限而停止的译文。这两项都会计入运行清单（`length_limits`），且 `status` 会发出警告并给出修复建议：拆分长句，或者在 `config.json` 中调高 `model.max_src` 和 `model.max_tgt`（以及 `decode.max_new_tokens`）——但训练耗时会相应增加。

**注意：**`nmt-forge run` 本身并不要求预测；是轨道流程要求先进行预测。在预测步骤完成之前，请勿进行训练。

**注意：**`export` 是读取测试集的步骤。运行它是具有里程碑意义的节点，此时族群的预测应当已经写入——切勿将其作为常规检查来运行。

## 后台任务

`run --detach` 和 `serve --detach` 会启动受监督的任务并立即返回。

```bash
nmt-forge jobs                          # every job: state, stage, step, time left, last sign of life
nmt-forge jobs stop <name> --wait 120   # stop it, and wait up to 120 s (at most 180) for it to exit
```

- 状态：`running`、`finished`、`refused`、`crashed`、`stalled`、`deadline`、`interrupted`、`lost`。`lost` 表示任务的监督程序在未记录的情况下终止——包括在重启后，其原进程号现已归属于另一个进程。
- **此计算机上同一时间仅进行一项训练。** 训练任务在整机范围内跨所有项目排队，先到先得（`~/.nmt-forge/machine/train-queue`）。排队中的任务保持 `running` 状态，并在 `nmt-forge jobs --json` 中记录 `queued_behind`（它所等待的任务）；`status` 为 `training` 并说明它排在谁后面，随后会自动启动。在等待期间停止会导致任务未启动即终止（`interrupted`）；等待达 24 小时则会自动终止（`deadline`）。
- **边界阈值**（训练任务）：启动时 15 分钟无活动迹象（`--startup-minutes`）；在 10 分钟与单步中位耗时的 30 倍两者较长的时间内无进展（`--stall-minutes`）；截止时间为 `--deadline-hours`，否则为配置的时间预算 × 1.25，再否则为 24 小时。超出边界的任务会被终止并记录在案。
- **停止**：运行在下一步骤中止；监督程序在 60 秒后升级为 terminate，并在 10 秒后 kill。
- **实际耗时门禁**（Hugging Face 后端）：在预热后，forge 会计算步长耗时、预测整个运行时间，并拒绝无法在预算内完成的运行（`wall-clock budget exceeded: …`）。未设置预算时，上限为 24 小时。
- 当训练任务运行时，`status` 为 `training`，轨道步骤为 `wait`。失败的任务会在之后每一次状态查询中显示为警告。
- **恢复训练。** 当上一次训练任务在保存检查点后以 `lost`、`crashed`、`stalled` 或 `deadline` 状态结束时，`status` 会提示 `nmt-forge preflight run --config config.json && nmt-forge run config.json --resume --detach`：这是一次从被中断运行的最后一个检查点开始的新运行（加载其权重、全新的优化器、剩余的周期），且其清单会指明从何处恢复（`resumed_from`）。手动停止后绝不会提供此选项。
- 分离任务仅支持 POSIX 系统（macOS、Linux）。

## 磁盘空间

训练会写入检查点：同时最多保留 `model.save_total_limit` 个（除非 `config.json` 另有说明，否则为 4 个），对于 ByT5-small，每个约为 1.4 GB。在这些规则引入之前，ByT5-small 项目的每个改进轮次都会保留约 5.6 GB，早期轮次生成的新模型没有任何机制进行清理，导致磁盘写满并在保存时中断运行。Forge 中的 GB 是 1024³ 字节。

- **完成的运行仅保留其选定的检查点。** 一旦选定检查点，该运行中的所有其他
  `checkpoint-*` 文件夹都会被移除：后续不会再有任何读取操作（`export` 会复制选定的检查点；下一轮则从当前使用的模型开始）。
  manifest 会记录 `checkpoints_pruned`
  （`removed`、`bytes`、`kept`）。在 `config.json` 的
  `model` 块中设置 `"keep_checkpoints": "all"` 则会保留所有检查点。在读取配置时、任何训练开始之前，
  任何其他值都会被拒绝（`ConfigError`；此处针对值 `x`）：
  `config.model.keep_checkpoints is "selected" (the default: only the checkpoint the run picks stays) or "all", not 'x'`。
- **锁定。** 如果磁盘无法容纳一次运行，则在写入任何内容之前就会被拒绝
  （guard `disk-room`）；detached 运行则会在其作业启动前立即被拒绝。
  预估空间：单个检查点的大小——本工作区中相同基座早期运行所保留的检查点，
  或者基座自身的权重文件（本地文件夹或 Hugging Face 缓存）——乘以
  `model.save_total_limit`，再加上 1 GB 以完成运行；总计绝不低于 2 GB。
  拒绝信息为
  `[disk-room] this computer has <free> free; training this model needs about <need> (<n> checkpoints of about <size> each while it trains, and room to finish)`
  ——或者在大小未知时显示 *“（无论何种模型，至少必须保留这么多可用空间）”*——随后是
  `why: a disk that fills mid-training loses the run as it saves, and slows the whole computer`，
  以及指出 `nmt-forge tidy` 在此处能释放多少空间（如果能释放任何空间）、将其他文件移出磁盘和 `--skip-disk-check` 的 `fix`。
- `nmt-forge run … --skip-disk-check`（带或不带 `--detach`）仍会强制启动。
  manifest 的 `disk_room` 会记录该项检查——`free_bytes`、
  `checkpoint_bytes`（未知时为 `null`）、`checkpoints_at_once`、
  `need_bytes`——或者 `{"skipped": "--skip-disk-check"}`。**注意。** 预估值可能不准；
  是否跳过检查由使用者自行决定。
- **`nmt-forge tidy`** 会列出早期轮次中不再被使用的模型权重——显示每次运行的大小、总量及剩余空间——并且不会删除任何内容。
  `nmt-forge tidy --yes` 会将其删除。它绝不会删除当前使用的模型、最新的运行，
  或是当前使用模型所替代的模型（盲审工作表需用它起草）；输出的 `Kept:` 行会列出每一个保留项及其原因。
  已清理的运行会保留其记录——manifest、开发集翻译、报告——
  且其 manifest 会增加 `model_removed`（`at`、`by`、`bytes`、`why`）；ledger 则会添加一条 `tidy` 条目（`runs`、`bytes`）。若要求已清理的运行执行翻译（例如 `compare-runs` 用其重新翻译开发集），则会被拒绝：
  `run <name>'s model was removed by nmt-forge tidy on <time> to free disk space — its record stays, its weights do not`。
  **注意。** `--yes` 会删除文件：请向使用者展示列表，并仅在他们确认同意后运行。
- **`status` 会发出警告**——当存放工作区的磁盘剩余空间不足 10 GB，或 tidy 可以释放 5 GB
  或更多空间时，`warnings` 中会显示一行提示（由 rails 转播）：*“此计算机剩余 X GB 可用空间；早期 N 轮中不再使用的模型占用了 Y GB——`nmt-forge tidy` 会列出它们，
  `nmt-forge tidy --yes` 会释放空间（当前使用的模型、最新模型及其替代的模型将被保留）”*（分号后面的部分仅在
  tidy 能够释放空间时显示）。

## 改进轮次

一旦模型投入使用，每一轮都会在相同开发集的基础上，使用更多数据训练一次新运行。

**轮次训练方式。** `champollion improve prepare` 会通过以下两种方式之一运行 `nmt-forge round-plan --config config.json`, which rewrites `config.json`，并将计划写入账本（`round-plan`）：

- **在在用模型的基础上继续训练**（`init_from` 其模型文件夹）：以一半的学习率对迄今为止的所有句子进行 4 轮遍历——旧句子可以防止遗忘。这比从头开始训练耗时短得多。完整配置保留在 `config.json` 的 `model_full` 下。
- **从头开始**，恢复完整配置：在尚无在用模型时；模型被更改时（`use-model`，同时会丢弃 `model_full`）；对于词表来自训练句子的 `cpu-tiny`（几分钟即可完成训练）；对于适配器（LoRA）模型；以及每隔 4 轮，以避免多次简短的延续训练发生漂移。

`prepare` 会输出该计划及其原因，并在 `improve/round-<k>/prepared.json` 中记录 `training`（`mode`、`epochs`）。无论采用哪种方式，新运行都会在相同的开发集句子上与当前使用的模型进行评判对比。随后（1、3 和 4 是 forge 建议器命名的状态；2 由护轨记录）：

1. **`improve-compare`**（`auto`）：`nmt-forge compare-runs <in-use
   run-manifest.json> <new run-manifest.json>`——在开发集上按句子逐句配对对比两个模型。
   当开发集句子少于 50 句时，无论得分如何，判定结果均为 **too-few**：*“开发集句子过少，无法判定：少于 50 句时，无论差异多大，都无法可靠地将其与随机偶然区分开”*。从 50 句起：仅当配对检验的 p < 0.05
   **且** 差异的 95% 置信区间大于零时，才判定为 **better**；当
   p < 0.05 且置信区间小于零时判定为 **worse**；否则判定为 **no-change**。每个判定都会说明其开发集能可靠反映的最小差异。测试集绝不会被读取。如果运行针对不同的开发集、某个运行未保存开发集翻译，或者自新运行以来开发集发生了变动，则会被拒绝（`improve-loop`）。
2. **母语者的裁定**，适用于开发集无法判定的情况。未投入使用的一轮模型会在下一份盲审工作表中为一半的草稿行起草（见下文 `draft-newer`），而 `champollion improve
   marks` 会使用 forge 记录母语者的评判计数：
   `nmt-forge speaker-verdict --newer <run> --in-use <run> --newer-right <n> --newer-judged <n> --in-use-right <n> --in-use-judged <n> --json`。
   Forge 仅在得出 **too-few** 或 **no-change** 判定后才会对其进行处理。在 5% 水平上的双侧合并两比例检验（|z| > 1.96）会给出 `clear`：
   `newer`、`in-use` 或 `neither`；ledger 的 `improve-speaker` 条目会保留两个运行名称、四项计数、`z` 和 `clear`——仅包含计数。它会拒绝小于 0 的计数、正确数多于评判总数的计数，以及没有任何评判草稿的模型。其文本显示：*“在同一次走访中进行盲审时，母语者判定新模型在 B 个新句子中有 A 个正确（P%），而当前使用的模型在 D 个中有 C 个正确（Q%）”*，随后显示 *“新模型在这些句子上明显更优——forge 提议将其投入使用”*、*“当前使用的模型在这些句子上明显更优——保持当前模型不变”* 或 *“在这些句子上没有明显差异——保持当前模型不变”*。
3. **`improve-promote`**（`confirm`），在结果为 **better** 时提供——或者在结果为 **too-few** 或
   **no-change** 且针对该运行最新的 `speaker-verdict` 为
   `clear: newer` 时提供（**worse** 时绝不提供）。这只是一个提议：仅凭判定结果不会将任何模型投入使用。经使用者同意后，它会导出新运行且不读取测试集（`--no-eval`），记录为已选定（`choose`），停止正在运行的服务器，并在同一端口上提供新模型服务。只有该
   `export` 和 `choose` 才算作将模型投入使用：在此之前，轮次报告均显示 *“有可衡量的提升：未投入使用——使用者尚未选择它”*，并且其进度、预测和过拟合检查都不会计入该模型。依据母语者的评分，其 `why` 会添加他们的计数及 *“明显差异：新模型在家庭所需的句子上表现更优”*。在下一份工作表中，半数起草行来自它所替代的模型，因此母语者可以双盲检验此次晋级（见下文）。
4. 否则，当前使用的模型保持不变并开始下一轮——除非自上次更换模型以来的最近两轮判定均为
   **no-change** 或 **worse**，且正在使用 `cpu-tiny`。上次更换模型是指 ledger 中最新的 `model-change`（预设切换或 `not-now`）或
   `choose` 条目——即使用者投入使用的任何模型，包括基于母语者评分晋级的模型。判定为 **too-few** 的轮次不属于已评判轮次：只要最近两轮中有一轮为 too-few，就不会提出建议。
   此时会提供 **`improve-stronger-model`**（`ask_user`）：
   `nmt-forge use-model <preset> --config config.json --answer yes`（或
   `not-now`）、预设 `byt5-small` 或 `byt5-small-lowmem`
   （[模型](#models)）。回复槽位为 `try_it`。`yes` 会重写配置中的模型（保留使用者设定的时间预算），并在下一步中对其进行训练；`not-now` 则不作任何更改。两者都会写入 ledger
   （`model-change`），且只有在再进行两轮此类轮次之后，才会再次提出该建议。
   在 MCP 上，此处的“暂不”对应回答 `try_it: "not-now"`；
   此步骤会拒绝 `declined: true`
   （[MCP](/docs/agents/mcp#not-now)）。其 `why` 绝不会说增加句子没有帮助：当开发集过小而无法看出单轮提升时，显示 *“微小的提升可能被掩盖”*；否则表示这些轮次带来了 *“开发集句子无法察觉的变动（约 X 个 chrF++ 点或更多）：这些轮次增加的提升可能低于该值，或者毫无提升”*——在曲线顶部附近，一轮大约增加半个 chrF++ 点，低于 200 个开发集句子所能显示的范围。
   **注意。** `--answer` 默认为 `yes`：请始终显式传递使用者的答复。

护轨驱动轮次的其余部分（`champollion improve …`）：`nmt-forge wishlist` 会写入最有帮助的内容清单（默认 40 个提示，至少留出四分之一开放；模型从未见过的词汇各要求提供两到三个句子，每个句子表达不同的内容——在训练中仅出现一次的词很少能被学会（[度量](/docs/agents/measurement#what-the-wishlist-steers-on)）），`nmt-forge analyze` 会按句子类型细分开发集 chrF++，而 `nmt-forge grow-dev` 会在同名下将母语者的练习句子添加到开发集中——绝不添加开发集中已有的行，也绝不添加其源文本出现在测试集或封存集中的行。仅当某种句子类型的得分明显低于其他类型时，它才会引导心愿单（[度量](/docs/agents/measurement#what-the-wishlist-steers-on)）。`nmt-forge draft-newer`（由 `champollion improve sheet` 运行）会使用另一个模型随机起草下一张评审表中一半的行，且不作标记，以便母语者对两个模型进行双盲评审（[度量](/docs/agents/measurement#the-speakers-marks)）：如果最新训练的模型未被投入使用（该轮次未被启用），则使用该模型；或者在晋升后，使用当前在用模型所替代的那个模型。其 `--json` 会说明是哪一个（`relation`：`newer` 或 `replaced`；当没有其他模型且每一行都属于在用模型时为 `null`），并附带 `other`、`in_use`、各自背后的训练句对（`other_pairs`、`in_use_pairs`）以及 `n`；台账的 `draft-newer` 条目也会记录相同的内容。如何传达轮次情况：[指导](/docs/agents/coaching)。

## 合成数据与反向翻译

- `nmt-forge synth <pack> --out <file>` 运行语言包的生成器。Forge 本身不附带任何语言包。每一行都会经过验证并标记 `synthetic: true`。
- 合成文件作为 `config.json` 中的带标签泳道参与训练（`data.synthetic`、`{"path", "tag": "<synth>"}`）。某种类型的比例超过 15% 时，运行将被拒绝，除非配置中指定了 `mix.synthetic_sample`；`nmt-forge sample --cap 0.15 --key kind` 会抽取受上限限制的样本。
- **反向翻译没有专属命令。** 它是一个库函数（`nmt_forge.training.backtranslation.backtranslate`）：您提供反向模型；它首先对照所有已注册的数据集筛查单语文本，并将其输出标记为 `<bt>`；随后该输出作为合成泳道参与训练。不会对其运行任何质量过滤器。`config.data.monolingual` 会被拒绝。
- **注意：** 单语文本与其他数据一样属于族群的数据：其附带条款同样适用，若反向模型是托管的 LLM，则会将文本发送给提供商（[数据规则](/docs/agents/data-rules)）。

## 现象 → 原因 → 修复方法

| 症状 | 可能的原因 | 解决方法 |
|---|---|---|
| `cpu-tiny` 在开发集上的得分在 5 到 30 chrF++ 之间 | 设计上性能较弱：相当于一个类似于其训练数据常用语的短语手册 | 提供更多真实句对；在 Apple 芯片或 GPU 上使用 `byt5-small`（`nmt-forge use-model byt5-small`；GPU 显存在 8–15 GB 时使用 `byt5-small-lowmem`） |
| “模板上表现良好，真实文本上表现较差” | 规则 R7（迁移平台期）：开发集损失在最后一个检查点之前触底并上升了 5% 或更多。无论开发集 chrF++ 表现如何，只要出现此类上升即会触发——请结合开发集评分进行解读 | 提供更多真实句对。由 `nmt-forge lint <run-manifest.json>` 显示，导出时不显示 |
| 得分看起来过高 | 训练集中存在测试集的副本或近似副本；或者大多数测试行在训练集中存在“孪生对”（R4-recall-not-translation，占一半或更多） | 使用 `leak-audit --drop-test-twins` 获取无孪生对的文件；分别报告包含和不包含孪生对的评分 |
| 两个模型之间的差异很小 | 置信区间过宽（R5-low-power，区间宽度超过 8 点） | `nmt-forge compare`（配对检验）；针对轮次使用 `compare-runs`。扩大开发集规模 |
| 某个轮次提示“开发集句子过少，无法判断”（`too-few`） | 开发集句子少于 50 句：此处无法通过对比做出决断 | 无需修复：下一张评审表会双盲混合两个模型的草稿，并由母语者的评分来决定；在开发集达到 50 句之前，表单中每两行就会有一行是练习行 |
| 某个轮次提示“无显著变化” | 开发集过小，无法看出轮次的增益 | 从母语者的练习句子中扩充开发集（由 `champollion improve prepare` 驱动的 `grow-dev`） |
| 训练被拒绝：`[disk-room] this computer has … free` | 磁盘无法容纳该运行的检查点 | `nmt-forge tidy` 列出早期轮次模型可释放的空间；在人员确认同意后执行 `nmt-forge tidy --yes`；或者从其他位置释放空间。仅当人员判断预估有误时才使用 `--skip-disk-check` |
| 运行未能超过词典基准线 | 训练没有学到词汇表之外的任何内容 | 提供更多句对；检查基准线的覆盖率；如实告知团队人员 |
| 开发集已饱和 | 置信区间的下界达到上限的 99% | 使用更有难度的开发集；得分已无法进一步提升 |
| 训练前被拒绝 | 参见上方的“Train”行；`preflight run` 会列出每个失败的关卡及其修复方案 | 按照修复方案操作。若缺少训练附加依赖：`uv tool install --reinstall --python 3.12 'nmt-forge[hf]'`（或在 forge 自带的 Python 环境中执行 `pip`） |
| 因达到物理时间上限而停止 | 预计运行时间超过了预算（未指定预算时默认 24 小时） | 改用较小的模型或减少训练轮次，或者采用人员设定的预算（`model.time_budget_hours`） |
| 后台作业失败 | `nmt-forge jobs` 显示 `crashed`、`stalled`、`deadline`、`lost` 或 `refused` | 在 `.forge/jobs/<name>/` 中读取其 `stderr.log` 并修复问题；然后重新训练，或者在 `status` 指定了 `--resume` 时从其最后一个检查点恢复 |
| 训练处于等待状态且未启动 | 本机正在运行另一项训练；此训练排在其后等待（`queued_behind`） | 等待即可：它会自动启动。请勿重复启动 |
| 长句子输出被截断 | 长度限制导致：`status` 会附带数量发出警告（训练中截断的句对、输入时截断的开发集句子、达到上限停止的翻译） | 切分长句子；或调高 `model.max_src`、`model.max_tgt` 和 `decode.max_new_tokens`（训练时间会更长） |
| 词汇被输出为未知片段（`cpu-tiny`） | 词表仅从训练行中学习 | 提供更多使用这些词汇的句对；或者使用 `byt5-small`（它以字节为单位读取） |

## 失败分类体系

Forge 的构建基于一份对训练项目误导自身方式的清单汇总。概括如下——“强制执行”意味着工具会拒绝该操作：

| 类别 | 失败现象 | 代码中的处理 |
|---|---|---|
| 泄露 | 答案出现在训练集中；近似副本；跨切分边界的释义；链式模板 | 强制执行（泄露审核、切分防护）。模板同胞样本会被保留并计数 |
| 开发集/测试集污染 | 在测试集上挑选检查点；重复消耗封存集；没有预测的测试集评分；读取后再进行预测 | 强制执行（开发集隔离墙、评估账本、预先注册） |
| 分词器与正字法 | 无法书写该文字的分词器；混杂的拼写规范 | 不检查分词器；拼写规范混杂作为代码检查项，仅在配置中指定时执行 |
| 合成数据 | 过度拟合合成配比；早停机制杀掉合成数据占比过高的运行；模型崩溃；反向翻译在自身错误上恶性循环 | 强制执行早停基准线；其余各项为代码检查项或标签 |
| 覆盖率 | 缺少特定语域所需的词汇 | 当插件报告覆盖率时，作为代码检查项 |
| 测量 | 增量小于其置信区间；单一不透明的数值；在引擎之外进行指标计算 | 强制执行：每个评分均附带置信区间，且均来自引擎 |
| 解码 | 截断的输出；根据损失而非输出质量来挑选检查点 | 强制执行：解码余量、生成指标选择；对长度截断进行计数并告警 |
| 流程 | 未知的配置键；禁止训练的数据；失控的运行 | 强制执行 |

已知尚无代码实现的空白项：分词器覆盖率、反向翻译质量、按语域的截断、黄金数据/合成数据比例、不同随机种子间的方差。

## 面向程序的输出

`--json` 会在标准输出中输出且仅输出一个 JSON 文档。拒绝执行会输出 `{"error": {"type", "guard", "message", "why", "fix", "how_to_get", "text"}}` 并以状态码 2 退出（对于切分和开发集隔离墙拒绝，会添加 `details`）。状态码 1 表示意外崩溃。`nmt-forge run` 以 `RUN EXIT <code>`（0、1、2 或 130）结束；`run --detach` 返回 0 以及任务文档。`nmt-forge status --json` is `{"snapshot", "advice": {"state", "next_command", "why", "ready", "blockers", "warnings", "answers"}}`。

## 深入了解

- [`nmt-forge` 命令参考](/docs/network/getting-started/forge-command-reference) —— 包含所有子命令和标志。
- [测量规则](/docs/agents/measurement) —— 分数的含义。
- [您的第一个翻译器](/docs/your-first-translator) 与 [精益求精](/docs/make-it-better) —— 面向族群的版本。
- [服务提供与部署](/docs/agents/serving) —— 导出包中包含的内容。
