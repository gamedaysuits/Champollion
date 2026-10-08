---
slug: /build-mt-for-your-language
title: "为您的语言构建机器翻译"
description: "从“我们该如何开始？”到形成经过验证的翻译工作流：调研现有方案、保护测试集、评估备选选项、构建更优方案、验证效果并最终部署——每一步均提供具体的命令和 MCP 工具调用。"
---

# 为你的语言构建机器翻译

本页面将带你完成从*“我们想为自己的语言构建翻译——该如何开始？”*到建立一个**在你自己的句子上经过评估**并投入实用的翻译工作流。内容同时面向人类与 AI Agent：每一步都给出了要运行的命令，以及当存在对应工具时 Agent 可以调用的 [MCP 工具](/docs/network/getting-started/mcp-server)。

两个贯穿全文的示例：

- **一所学校**希望为其简报和一个小型应用提供“英语 → 平原克里语（Plains Cree）”翻译。教师们已经核对了几百个句子，并希望保持这些句子的私密性。
- **一家医院**希望为其床边常用语手册提供“英语 → 索引几乎未覆盖的某种语言”翻译。其测试句子包含临床措辞，绝不能发送给外部 AI 服务。

最终你将获得：一个私有测试集、几种方法在该测试集上的评分、一个表现更好的方法（经过指导的模型或你自己训练的模型），以及通过 CLI 部署该方法——并且每一个数字都可以追溯到生成它的具体来源。

:::info[本文档不保证的内容]
这里没有任何手段能确保翻译绝对正确。评分只能告诉你哪种方案**在你提供的句子上错误更少**；译文是否适用仍由熟练的母语者决定。在依赖任何数值之前，请先阅读[客观局限性](/docs/network/honest-limitations)。
:::

:::warning[给 Agent 的提示：在打开用户的任何文件之前]
如果某个测试集可能是私密的（经教师核对、护士核对，或任何社区尚未公开发布的内容），切勿读取它——不要使用 `cat`、`head`，也不要进行预览，甚至不要为了查看其格式而读取。你读取的内容会发送给你的模型提供商。请先询问用户，并将其标记为仅限本地（[步骤 2](#2-gather-your-data--and-protect-your-test-set)）。
:::

## 0. 安装

```bash
npm install -g champollion        # translate + deploy        (Node 20.11+)
python3 -m pip install mt-eval-harness       # measure                   (Python 3.11+)
python3 -m pip install 'nmt-forge[hf]'       # train a model (optional; a CPU is enough to start)
```

对于 Agent，请将 MCP 服务器添加到其配置中：

```json
{
  "mcpServers": {
    "champollion": { "command": "npx", "args": ["-y", "champollion-mcp-server"] }
  }
}
```

## 1. 了解现有资源

了解该语言已知的相关信息——词典、语法书、语料库、分析器（FST）、模型、已发表成果、各项服务——以及每项事实的来源。

```bash
champollion network card crk                 # the cited language card
champollion network recommend eng crk        # methods you can run, with the evidence for each
mt-eval corpora --source eng --target crk   # registered test sets for the pair
nmt-forge discover crk               # what a training project can use
```

**Agent：** `search_languages { "query": "Atya" }` 即使面对拼写错误也能找到对应代码（通过编辑距离匹配最接近的名称）。仅当语言卡片引注了来源时，每个结果才会显示该语言的使用地区，并展示该来源，以便用户在名称相似的语言之间做出选择。未注明来源的地点绝不会显示：该行会明确说明并改为链接到该语言的 Glottolog 记录，从而可以在源头对候选语言进行比对。通过 npm 安装时，内置核心集合之外的语言会从 champollion.dev 发布的卡片表中补全，这些表目前尚未包含逐字段来源（将在下一次表更新上传时提供），因此其对应的行会显示 Glottolog 链接而不是地点。如果展示的信息无法区分候选语言，则由该语言的使用者来决定（见下文）。随后 `language_overview { "code": "<code>" }` 会输出单页内容：存在哪些资源、有哪些基准测试和结果，以及编号的后续步骤。任何接受单一语言的工具也同样接受 `language` 格式。

请严格按照卡片的撰写逻辑来理解：**未提及代表未知，并不代表不存在。** 卡片中未列出词典仅意味着索引尚未收录——并不意味着该语言没有词典。在不同来源存在分歧的地方（使用者人数通常如此），卡片会列出所有来源。

如果你的语言根本没有卡片，你仍然可以完成下文的所有操作；工具只是对其了解较少而已（`nmt-forge init <code> --no-card --name <name>` 依然会启动训练项目）。

### 当语言变体尚未确认时

一个名称可能对应多种语言。例如，“Ayta”对应菲律宾的六种 Ayta 语言，每种都有自己的代码。**请先询问该语言的使用者。** 社区清楚自己使用的是哪种变体，而替他们选择代码则是对他们身份的一种断言。

如果必须在他们给出答复之前就开始，请使用专用私有代码：ISO 639 专门保留了 `qaa` 到 `qtz` 用于此类场景。为其指定一个显示名称，以便提示词和报告能够正确称呼该语言：

```bash
champollion init --yes --langs qaa --name qaa="Ayta (variety not yet confirmed)"
```

这会在 `champollion.config.json` 中写入：

```json
"languages": { "qaa": { "name": "Ayta (variety not yet confirmed)" } }
```

`init` 会提示该代码是没有语言卡片的私有保留代码（不会要求你检查拼写）。

`init`、`sync`、`verify` 和 `network register-corpus` 均支持私有代码。在替换为真实代码之前，你需要承担的代价是：

- **没有卡片事实信息。** 无法从语言卡片中获取语体预设、复数规则或文字书写系统。同步操作会使用通用设置，因此请与母语者核对初步结果。
- **没有 FST。** 私有代码未关联形态分析器，因此无法进行逐词检查。
- **没有既往结果。** 已发布的基准测试和任务队列均以真实代码为键，因此 `recommend` 和 `corpora` 无法显示任何相关内容。

当社区确认了具体的语言变体后，切换为其正式代码：

1. 在 `champollion.config.json` 中，将 `qaa` 替换为正式代码（如果卡片中的名称合适，可去掉 `name`）。
2. 重命名语言环境文件（`messages/qaa.json` → `messages/ayt.json`）。翻译仍然有效：下一次 `champollion sync` 会保留它们，仅翻译新增内容。
3. 在真实语言对下重新注册测试集：
   `champollion network register-corpus --pair "eng>ayt" --data <file> --role test …`。
   该命令会输出需要传入的 `--id`，因为已注册的文件会保留其 ID，除非你主动指定新 ID。（`--pair` 在此处以及 `eng-ayt` 中均接受 `"eng>ayt"` 或 `nmt-forge init`；请给 `>` 形式加上引号，因为 shell 会将裸写的 `>` 解析为“写入文件”）。

## 2. 收集数据——并保护你的测试集

**首先分离出测试集。** 在训练或微调任何模型之前，先将用来评判一切的句子（经教师核对的、经护士核对的句子）单独存放，并且绝不要在这些句子上进行训练。

测试集是一个 TSV 文件：每行一个句对，包含源文本、一个 TAB 制表符，然后是参考译文。以 `# ` 开头的行为注释。

```text
# teacher-checked, 2026 term 1
The library opens at nine.	<the teacher's translation>
```

然后决定它的流转范围：

| 你的需求… | 执行此操作 |
|---|---|
| 任何内容都不离开本机——外部 AI 服务绝不可看到这些句子 | 在其旁边放置一个标记文件（见下文）。只有本机上的模型才能针对它进行测试。 |
| 他人可以知道测试集的存在，但绝不能看到其内容 | `champollion network register-corpus --tier private --role test …` 仅注册元数据 |
| 针对它举办评测竞赛，在由你控制且可能完全物理隔绝（air-gapped）的机器上运行 | `--tier sealed` 加上[主权节点](/docs/network/sovereignty/sovereign-eval-node) |
| 公开且采用开源许可 | `--tier public` 指向其存放位置；我们依然绝不托管它 |

“绝不离开本机”的标记：

```bash
echo '{"transmission": "local-only"}' > data/nurse_checked_test.tsv.champollion.json
```

放置该标记后，`mt-eval run` 会针对该文件拒绝所有远程提供商，并且仅允许针对回环地址（loopback）上的模型运行。详细信息：
[注册语料库](/docs/network/sovereignty/registering-corpora)。

**选择哪种许可证 ID。** 注册时需要提供 `--license`：即数据所有者实际授予的条款，切勿使用占位符。请先询问他们，然后选择能准确表述的 ID：如果他们已在某个 SPDX ID 下发布了文本，则使用该 ID；`community-eval-grant-nc` 表示“仅用于系统评分，绝不用于训练，绝不共享，禁止付费评分”；`community-eval-grant` 与前者相同但允许付费评分；`proprietary` 表示保留所有权利；或者 `LicenseRef-<name>` 表示使用他们自己的条款。后四种是 `LicenseRef-…` ID，即定制授权：在数据管理员记录许可之前，针对这些数据的远程评估将被拒绝。在管理员确认之前，将你的选择记录为临时（provisional）。无论许可证为何，本地专属都会始终保持在本地：由标记文件决定句子的流向，而不是许可证。
[私有测试集该选用哪种许可证 ID](/docs/network/sovereignty/registering-corpora#which-licence-id-for-a-private-test-set)。

**Agent：切勿读取仅限本地的测试文件。** 不要使用 `cat`、`head`，也不要打开它查看。你读取的内容会发送给你的模型提供商，而标记文件明确禁止将这些句子发送到该处。你也没有必要读取：工具在输出内容中会自动剔除这些句子（`mt-eval compare` 会改为显示条目 ID 和得分），而 `--show-text` 只是为终端前的人类用户提供的。

**Agent：** `language_overview { "code": "<code>" }` 列出了该语言的保护选项；`run_benchmark` 会遵循标记，并返回拒绝信息（附带原因），而不是将受保护的句子发送出去。

### 如果你稍后可能训练模型：在进行任何评分之前先注册、筛查、预测

在步骤 3 针对测试集进行任何评估之前，请务必按此顺序完成以下三件事。Forge 会记录对测试集的每一次读取，而基准测试（步骤 3）属于评分读取：在评分读取之后写入的预注册（preregistration）将被拒绝。顺序至关重要；事后补做性质完全不同。

1. **在 NMT Forge 中注册测试集。** 其读取日志从此处开始记录，因此随后的每一次读取都会被计数（注册前进行的评分读取会被列出，但不会被计入次数）。
2. **针对测试集筛查你的训练语料库**（`leak-audit`）。这会以审计为目的读取测试集，而非用于评分，因此不会计入你的预测次数。查看其裁决结果：如果大多数测试行在语料库中都有近乎相同的配对项（near-twin），那么在全部数据上训练出的模型评测出的只是对训练短语的记忆召回率，而不是翻译能力。此时你通常需要训练两个模型：一个基于全量数据，另一个基于去除相似项的数据（`--drop-test-twins` 会写入其语料库和配置文件 `config-notwins.json`）。
3. **写下你的预期指标，为你计划训练的每个模型各建立一份预注册**，并以模型名称命名。这些预测是后续评判测试分数的基准：导出时会根据你通过 `--prereg <id>` 指定的预注册来评判对应模型（如果在同一个测试集上有两个模型，系统会拒绝无端猜测）。你也可以使用 `--config-hash <hash>`（即 `nmt-forge preflight run --config config-notwins.json` 输出的完整哈希值）将预测绑定到模型的配置上。对该配置的任何后续修改（比如调整时间预算）都会改变哈希值并解除绑定，因此在导出时指定预注册名称是更简便的做法。

```bash
nmt-forge init crk --dir school-crk
cd school-crk
nmt-forge registry add project-test ../data/test.tsv --role test
nmt-forge leak-audit ../data/corpus.tsv --clean-to corpus.clean.jsonl
nmt-forge prereg template --out predictions.json      # edit it: what you expect, and why
nmt-forge prereg new all-data --eval-set project-test --predictions predictions.json
cd ..                                                 # step 3 runs from here
```

如果裁决结果为 SEVERE（严重），请添加去除相似项的模型及其专属预测（在 `school-crk/` 中）：

```bash
nmt-forge leak-audit ../data/corpus.tsv --clean-to corpus.notwins.jsonl --drop-test-twins
nmt-forge prereg new notwins --eval-set project-test --predictions predictions-notwins.json  # your edited copy
```

去除相似项后的语料库会存入独立的文件。`corpus.clean.jsonl` 仍保留为全量数据语料库：leak-audit 拒绝覆盖配置文件、运行任务或拆分数据集正在读取的文件，或是其他审计生成的文件（`--overwrite` 会按预期替换其中一个文件）。其 `--json` 应答中列出了各个列表的前几行行号；清洗后语料库旁边的 `.audit.json` 文件则完整保存了所有这些行号。

`--allow-after-reads` 仅适用于在实际读取之前就已经确凿记录下来的预测（例如记录在纸上）。它会被记录下来，且每一份报告、
export and DEPLOY.md then says the predictions came after the scores.

**Agent：** 先执行 `forge_init { "code": "<code>", "dir": "<dir>" }`，然后依次执行 `forge_register_eval { "name": "project-test", "path": "../data/test.tsv", "role": "test", "project_dir": "<dir>" }`、`forge_leak_audit { "corpus": "../data/corpus.tsv", "clean_to": "corpus.clean.jsonl", "project_dir": "<dir>" }`（路径从 `project_dir` 读取，因为上述命令是在项目内部运行的；绝对路径则可在任何位置使用），然后与用户一起执行 `forge_prereg_template` → `forge_prereg { id, eval_set, predictions }`，每个模型一次，各以对应模型命名（之后 `forge_export` 会将该 ID 作为 `prereg` 接收；而在 `forge_prereg` 上使用 `config_hash` 则会将其绑定到其配置）。测试集注册完成后，`forge_status` 会立即提示此步骤。步骤 4 会在同一个项目中进行训练。`language_overview` 同样按此顺序列出这些步骤。

## 3. 评估各项方案

针对**你的**测试集运行每个候选方案（如果你稍后可能训练模型，请先通过 forge 完成注册、筛查和预注册——见[步骤 2](#2-gather-your-data--and-protect-your-test-set)）。评测套件以统一标准对所有方案进行评分，这与机器翻译领域的公开评估标准一致：首要指标是语料库级别的 chrF++ 及其 95% 置信区间，同时并列显示 BLEU、spBLEU 和 TER（绝不会混合为一个单一数值）。完全匹配率和行为检查（如输出文字书写系统错误、幻觉信号）作为诊断指标报告，并附带成本和速度指标。在评测套件为该语言绑定了形态分析器的情况下，它还会补充 FST 接受率和形态准确度作为诊断指标；`mt-eval setup --status` 列出了这些语言，`mt-eval setup --comet` 则在适用的情况下增加 COMET 指标。

```bash
# a hosted model (needs OPENROUTER_API_KEY); --max-cost stops before spending more
mt-eval run --corpus data/test.tsv --source-lang English --target-lang "Plains Cree" \
  --target-lang-code crk --provider openrouter --model google/gemini-3.8-flash \
  --max-cost 1 -n gemini-3.8-flash -o results

# a model on your own machine (Ollama, llama.cpp, vLLM — anything OpenAI-compatible)
mt-eval run --corpus data/test.tsv --source-lang English --target-lang "Plains Cree" \
  --target-lang-code crk --provider local --base-url http://127.0.0.1:11434/v1 \
  --model llama3.1 -n local-llama -o results

mt-eval compare results/*_report.json --significance
```

`compare` 会指明差异是真实的还是属于噪声波动范围（通过成对近似随机化检验）。处于置信区间之内的差异不能构成排名的依据。它会根据所比较的运行任务命名生成 `comparison-<hash>.json`；当运行报告位于同一文件夹时，该文件保存在报告旁边；否则保存在它们上一层的 `comparisons/` 文件夹中，绝不会保存在单个任务自己的独立文件夹中。随后的比较绝不会将其覆盖。

**评估组件包。** 某些语言声明了其指标所需的额外工具（例如平原克里语需要形态分析器）。初次运行 `mt-eval run` 会指出缺失的内容。缺少分析器绝不会阻断运行：FST 接受率会被标记为未计算，`mt-eval setup --lang crk` 可完成安装（每台机器仅需一次），随后 `mt-eval test <run log>` 可以在无需重新翻译的情况下补充该项评分。

**Agent：** `run_benchmark { "corpus": "data/test.tsv", "provider": "local",
"base_url": "http://127.0.0.1:11434/v1", "model": "llama3.1",
"target_language": "crk" }` plans first and runs only with `confirm: true`；
`get_run_status { "job_id": "<id>" }` 返回评分结果。除非你传入 `publish: true`，否则它不会发布任何内容。以 `target_language` 形式传入的代码在进入提示词之前会根据其语言卡片解析为全名（如“Plains Cree”），且执行计划会展示模型将接收到的提示词。指导文件会替换该提示词，且执行计划会对此予以说明。当卡片列出两种文字系统而你未传入 `script` 时，执行计划会读取参考译文使用的文字系统（在本地机器上统计字符，不展示句子内容）并要求使用该文字系统。其报告会保存在测试文件旁边的 `data/results/mcp-run-<id>/` 中，评测套件的翻译缓存保存在 `data/results/cache/` 中。`get_run_status` 会输出针对它们的 `mt-eval compare` 命令，对于在已注册语料库 ID 上运行的任务，它会按路径列出这些报告。`local-model` 计划会首先说明确认操作需要下载的数据量以及下载位置。

**应该信任哪项指标**取决于具体的语言：`get_metric_reliability { "language": "<code>" }`（MCP）会报告是否曾有任何自动评估指标针对该语言经过了人工判定的验证。对于大多数低资源语言而言，均未曾经过验证，因此 chrF++ 是通常的惯例——应将其理解为同一测试集上不同方法之间的相对比较，而非绝对分数。

## 4. 构建更好的方案

有两条途径。两者的评估方式均与步骤 3 相同。

**对通用模型进行指导（Coach）。** 为其提供术语表和指引，然后带上指导配置重新运行步骤 3：

```bash
mt-eval run --corpus data/test.tsv --source-lang English --target-lang "Plains Cree" \
  --target-lang-code crk --provider openrouter --model google/gemini-3.8-flash \
  --coaching-file coaching.json -n gemini-coached -o results
```

`--coaching-file` 支持 Markdown、纯文本或 JSON 格式；文件的完整文本将作为模型的指令原样发送。

为了对术语进行评分（检查列出的每个术语是否都被翻译成了要求的译法），请通过 `--glossary terms.json`（传入 `{"blood pressure": "…"}`，或每个术语的可接受形式列表）为你对比的所有运行任务提供相同的术语列表。术语表仅用于评分，绝不会发送给模型，因此普通运行任务和经过指导的运行任务是在同一批术语上进行评分的。如果没有提供 `--glossary`，则会使用 JSON 指导文件中的 `dictionary`（即[指导式提示词构建](/docs/network/tutorials/coached-llm-prompting)结构：`grammar_rules`、`dictionary`、`style_notes`）。在此情况下，该任务是针对其自身的指导配置进行评分的，输出结果中会注明这一点。Markdown 格式的指导文件以同样的方式进行指导，但不会提供术语表。

参见[指导式提示词构建](/docs/network/tutorials/coached-llm-prompting)和[词典增强型提示词构建](/docs/network/tutorials/dictionary-augmented-llm)。

**使用 NMT Forge 训练你自己的模型**，它能够规避那些导致小样本数据结果虚高的常见错误（测试集句子泄露、不当的数据集拆分、基于测试集选取检查点、将随机噪声误认为训练进展等）：

```bash
cd school-crk     # after step 2: registered, screened, preregistered
nmt-forge split corpus.clean.jsonl --test 0 --dev 100 --seed 42 --out data/split --register project
nmt-forge preflight run --config config.json          # every check run makes, with fixes
nmt-forge run config.json
nmt-forge export .forge/runs/<run>/run-manifest.json --prereg all-data --out export/
```

`preflight run` 执行 `run` 在训练前所做的各项检查——验证集、每个训练文件的数据泄露审计、解码长度——因此通过该检查的运行任务在启动时不会被拒绝。`config.json` 从 `data/split/` 中读取数据集拆分；在其他位置写出的拆分数据会指明需要修改哪些行。

训练句对存放在与测试集类似的 TSV 文件中（或包含 `source` 和 `target` 的 JSONL 中）；`leak-audit`（步骤 2）已经排除了所有会导致测试集泄露到训练集中的句子，并给出了针对每条句子的说明。要训练两个模型？在完成拆分后，再次运行步骤 2 中去除相似项的数据泄露审计（注册开发集后，其对应的行也会从去除相似项的文件中移除），然后执行 `nmt-forge run config-notwins.json`，并
export it to its own folder with `--prereg notwins`. `nmt-forge status` names
在任意时刻查看下一条命令。默认模型在 CPU 上数分钟即可完成训练；在 1000 到 2000 个句对上，预计 chrF++ 分数大约在 5 到 30 之间——它学习的是你数据中的短语和句式，而非这门语言的泛化规律。`export` 会对测试集进行一次评分并生成一份 mt-eval 报告，因此训练好的模型可以直接与步骤 3 中的所有方案进行比较。完整演练请参见：[训练你的第一个模型](/docs/network/getting-started/train-your-first-model)。

**Agent：** 首先执行并在每一步之后执行 `forge_status { "project_dir": "<dir>" }`；在完成步骤 2 的 `forge_init`、`forge_register_eval`、`forge_leak_audit` 和 `forge_prereg` 之后：依次执行 `forge_split { corpus, test, seed, out }`、`forge_preflight { "target": "run" }`，然后在终端中运行 `nmt-forge run` 之后执行 `forge_export { run_manifest, out, prereg }`。在执行 `forge_split` 之前调用一次 `get_training_guardrails`：它会列出 forge 强制执行的每项规则以及该规则所防止的错误。`forge_split` 的 `register` 接受前缀或 `true`（`project`），且 `out` 默认为 `data/split`。在 `forge_init` 之后的每个 forge 工具均接收其返回的 `project_dir`。`get_training_guardrails`（可选 `topic`）对每条规则进行了解释。关于各工具的所有参数，请参见：[MCP 服务器](/docs/network/getting-started/mcp-server#arguments)。

## 5. 验证成效——私密进行或公开展示

评分属于你自己。除非你主动选择，否则不会发布任何内容。

```bash
mt-eval publish results/<run-id>_report.json --dry-run   # shows exactly what would leave, and what is withheld
mt-eval publish results/<run-id>_report.json --scores-only --prod
```

私有或仅限本地的测试集绝不会上传其句子内容；`--dry-run` 会逐行声明这一点。如果想让其他人在完全无法看到测试集的情况下参与评测竞争，可以在由你控制的机器上举办一场竞赛：参赛者提交其方案，方案在你的节点上运行，最终只有评分数据输出。新创建的竞赛在结束前会隐藏所有评分，以防他人针对你的测试集进行过拟合微调。详见[举办主权竞赛](/docs/network/sovereignty/run-a-sovereign-contest)。如果要将你自己训练的模型提交到他人的竞赛中，其导出目录中的 `DEPLOY.md` 第 6 节列出了构成参赛方案的文件以及确切的 `mt-eval contest submit-model` 命令。

**Agent：** `list_contests { "language": "<code>" }`、`get_contest { id }`；针对公共排行榜使用 `get_results { "target_language": "<code>" }` 和 `get_run_card { id }`。

## 6. 择优组合

**首先从你自己的评测结果中进行挑选。** 针对你的测试集完成评分的所有内容都会生成 mt-eval 报告：包括步骤 3 和步骤 4 的基线与指导运行结果，以及每个训练模型的导出结果（位于其
export folder). A terminal run with `-o results` writes to
`results/*_report.json` 中的 `evaluation/runlog_report.json`；通过 MCP `run_benchmark` 启动的运行则写入测试文件旁的 `data/results/mcp-run-<id>/`）。一次性对比所有结果——第一个 glob 表达式用于终端运行，第二个用于 Agent 运行（请使用与你的运行相匹配的表达式；zsh 在 glob 没有任何匹配时会中断报错）：

```bash
mt-eval compare results/*_report.json school-crk/export*/evaluation/runlog_report.json --significance
mt-eval compare data/results/mcp-run-*/*_report.json school-crk/export*/evaluation/runlog_report.json --significance
```

置信区间之内的差异不可作为排名的依据；若某个训练模型的测试行在其训练数据中存在近乎相同的配对项，则该得分属于记忆召回得分：请在旁边附上其去除相似项后的得分（DEPLOY.md 和 `nmt-forge report` 会指明具体数值），以及 mt-eval 对该得分附加的任何**评分警示（score caveat）**。如果出现*输出近乎恒定（near-constant output）*的警示（即针对大量不同的测试句子均给出了极少数固定句子之一），意味着无论得分高低，输出均未遵循输入；forge 会在 `export`、`DEPLOY.md`、`status`、`report`、`compare` 和 `lint` 的评分旁将其打印出来。当有多个导出的模型时，`nmt-forge status` 会列出各个模型及其得分、去除相似项后的得分以及警示信息，并提示你选择部署哪一个。使用 `nmt-forge choose <export>/model`（或 `nmt-forge serve <export>/model --choose`）记录该选择。仅启动模型服务进行试用会被记录为已提供服务，而非你的最终选择，因此 `status` 会持续提示直到你做出选择。

**Agent：** `forge_status { "project_dir": "<dir>" }`——在处于 `choose-export` 状态时，向用户展示 `result.advice.exports`、每个导出模型的得分及其 `score_caveats`，并询问部署哪一个模型；用户的选择通过在终端中运行 `nmt-forge choose` 来记录。临时启动服务不会回答此问题。`forge_compare { eval_set, hyps_a, hyps_b }` 会对两个 forge 模型进行 A/B 测试，并在胜出方案旁显示各自的近配对项警示以及 mt-eval 评分警示；每个模型的假设文件即为 `forge_export` 返回的 `hypotheses` 路径（`<export>/evaluation/battery-hyps.jsonl`）。

随后可以放眼你自己的运行任务之外。对于不同的语言对和不同类型的文本，胜出的方法各有不同。[Network](/docs/network/) 列出了现有的各项方法与服务以及各自的佐证依据——这些是公开发表的内容，而非你实测的数据：

```bash
champollion network recommend eng crk               # runnable methods + cited evidence for the pair
champollion network leaderboard --pair "eng>crk"     # published results for the pair
```

在排行榜上发布了配置的方法可以直接按照其评测时的状态进行安装：`champollion network leaderboard --install <method> --apply` 会将其添加到你的项目中用于该语言对。CLI 按**语言对**配置翻译方法，因此简报中的克里语可以使用你训练的模型，而法语则可以使用托管模型。链式组合方法（例如先通过模型翻译再通过检查器校验）在[链式模型](/docs/network/tutorials/chained-models)中进行了介绍。

## 7. 投入使用

部署经过你实际评测的方法——而不是其他未经测试的方法。

```bash
nmt-forge serve export/model                     # your trained model on http://127.0.0.1:8378
LOCAL_API_BASE=http://127.0.0.1:8378/v1 champollion sync --method local
```

运行时，`nmt-forge status` 会显示 `serving`（用于检查服务器是否仍有响应）；在服务器停止后，它会再次提示 `serve` 命令，并保持使用相同的端口。

或者，对于经过指导的托管模型，在 `champollion.config.json` 中为该语言对进行配置。无论哪种方式：

```bash
champollion init --langs crk     # detects your app's locale files
champollion sync                 # translates only what changed
champollion verify               # placeholders, scripts, key parity
```

**你自己的模型目前尚无法胜任的情况。** 在数千个句对上训练出来的小模型只能学到其中的短语。它经常会损坏占位符（`{name}`）、复数形式和标记语言，或者将诸如“Home”（首页）之类的简短标签翻译成一整句话。质量把关机制（quality gate）会拦截这些输出；绝不会写入任何损坏的内容。为该语言对配置一个**回退（fallback）**方案，这些字符串就会在同一同步流程中转交给第二种方法处理：

```json
"pairs": {
  "en:crk": {
    "method": "api",
    "endpoint": "http://127.0.0.1:8378/translate",
    "fallback": { "method": "llm-coached", "model": "google/gemini-3.8-flash" }
  }
}
```

如果任何文本都不能离开你的机器，可以将回退方案也设置为本机运行的模型：`"fallback": { "method": "local", "model": "<your local model>" }` 会将请求发送到本机兼容 OpenAI 接口的服务器（如 Ollama、llama.cpp、vLLM），API 成本为 0 美元。托管模型通常能提供更有力的参考方案；在允许将文本发送给其提供商时可以使用该方式。

你自己的模型会尽力翻译其能力范围内的所有内容。回退方案仅接收被质量把关机制拦截的内容，以及被遗漏或损坏的 Markdown 块，并且其输出同样要通过相同的质量把关机制。`sync` 会针对每个语言对打印一行包含统计数据的 `[FALLBACK]`，而 `champollion verify` 会列出两种方法均无法翻译的所有内容。详见[回退方法](/docs/getting-started/configuration#fallback)。

如果仅用于一次性应急，也可以通过其他方式单独翻译这些字符串：

```bash
champollion sync --method llm-coached --redo keys:nav.home,greeting
```

……或者手工翻译，或者通过 `champollion xliff export` 交由审核人员处理。此外，请务必将应用本身的字符串加入你的测试集中：一个在教师句对上得分很高的模型，在翻译“你哪里痛？”时依然可能出错。

**文字书写系统。** 如果该语言使用多种文字系统编写（如平原克里语：标准罗马正字法与音节文字），CLI 会在翻译前要求你进行选择。在配置中为该语言设置 `"script"`；提示信息中会列出所有选项。

翻译记忆库确保了未修改的句子绝不会重复计费，且切换模型不会导致重新翻译全部内容。参考 [CI/CD 指南](/docs/guides/ci-cd)将其接入持续集成流程。来自步骤 4 的 `export/model/DEPLOY.md` 包含了针对自训练模型的完整确切配置，包括 `api` 方法以及如何在网络上安全地公开服务。

**Agent：** `translate { texts, source_language, target_language }` 通过相同的流水线处理字符串。对于自行提供服务的模型，添加 `method: "local"` 和 `base_url`，或 `method: "api"` 和 `endpoint`；对于使用多种文字书写的语言，添加 `script`。

## 过程中的关键抉择

| 决策项 | 选择… | 适用场景 |
|---|---|---|
| 测试集存放位置 | 仅限本地（local-only） | 数据较为敏感，或尚未征得编写者同意 |
| | 私有 / 密封（private / sealed） | 希望他人知晓其存在或针对其进行竞争，但不能查看内容 |
| 模型指导或自建训练 | 指导托管模型 | 拥有术语表但双语平行文本较少，且允许使用外部服务 |
| | 使用 forge 自行训练 | 拥有数千对或更多句对，或数据必须保留在本机上 |
| 发布内容 | 仅发布评分 | 适用于任何非你自己编写的内容的默认做法 |
| | 不发布任何内容 | 始终允许——私下评估同样具有实用价值 |

## 成本核算

- 工具对非商业用途免费：学校、公立医院或诊所、慈善机构或研究项目均包含在内（CLI、nmt-forge 和 MCP 服务器遵循 PolyForm Noncommercial 1.0.0；评估套件为开源软件，遵循 AGPL-3.0-or-later）。详见[许可使用人群说明](/docs/getting-started/who-may-use-this)。
- 托管模型的费用取决于其提供商的标准；`--max-cost` 会在花销超过你允许的限额前中止运行，且报告中会显示每句话的开销。本地模型除了消耗你机器的计算时间外完全免费。
- 训练默认的 forge 模型只需要普通的 CPU，耗时仅数分钟；更大的预设模型则需要 GPU。
