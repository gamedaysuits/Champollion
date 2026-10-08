---
sidebar_position: 9
title: "运行主权竞赛"
slug: /network/sovereignty/run-a-sovereign-contest
description: "自助式、端到端的路径，供社区或组织针对自己的密封、保留的语料库运行机器翻译竞赛——Champollion 不会持有数据或奖金。"
related:
  - label: "Registering Corpora & Exposure Lanes"
    to: /docs/network/sovereignty/registering-corpora
    kind: doc
    note: "The registration lane this path builds on"
  - label: "Data Stewardship"
    to: /docs/network/sovereignty/data-sovereignty
    kind: doc
  - label: "Terms Templates"
    to: /docs/network/sovereignty/terms-templates
    kind: doc
    note: "Adaptable terms ideas, including trojan-horse risks"
  - label: "Prize Specification"
    to: /docs/network/specifications/prizes
    kind: spec
---

# 运行主权竞赛

> **执行摘要。** 社区或组织可以针对一个保留的测试语料库运行评估竞赛——包括赞助奖金——该语料库**永远不会离开其自身基础设施**。您构建语料库、加密它、托管它并持有密钥；网络仅注册一张无内容的元数据卡和密文摘要。方法首先在公开语料库上获得资格；每次针对您的密封集合的运行都需要您的监管人授权；只有**分数**会输出。奖金由**赞助商持有**——由您的组织或您指定的信托持有——**Champollion 永远不接触资金或数据。** 本页是端到端的自助运行手册。

:::warning[今天上线的功能 vs. 开发中的功能]
开始之前要有清醒的认识——这是一个不断演进的非商业研究项目，我们希望你自己验证而不是盲目信任：

- ✅ **已上线：**语料库注册（元数据卡片、哈希固定、暴露通道）、封装数据集注册表（摘要 + 保管人组 + 资格赛，无内容）、带封装通道的竞赛机制、授权请求/授予/审计数据层（待处理 → M-of-N 决策 → 单次有时限授予、仅追加哈希链审计日志），以及在数据库层强制执行的仅分数输出。
- ✅ **已上线：组织者评分节点。**单条命令即可将你的语料库切分为公开开发集（参赛者在其上自行评分的资格集）和封装保密集（你的节点在其上执行参赛项），并将保密的后半部分在你的机器上进行静态加密封装（`mt-eval contest prepare`）。注册封装数据集、资格赛和竞赛完全**基于你自己的登录以自助方式进行**——`contest prepare --self-serve`，或者针对先前准备的竞赛运行 `mt-eval contest register --manifest`——每一行数据都在数据库层进行身份绑定；无需策展人介入，也没有特权密钥（真实限制请参阅步骤 4）。
- ✅ **已上线：参赛项是“方法”，而非翻译。**参加竞赛的方式是向你的节点提交它能够“运行”的内容。参赛者在公开开发集上自行评分（`mt-eval contest qualify`）以获取凭据，然后提交模型或方法；你的节点会在要求任何保管人批准任何操作之前，在自己本地的开发集副本上重新执行该凭据的分数计算，若不符则予以拒绝。节点会根据提交内容选择通道：
  - **通道 A — 声明式模型（首选）。**标准神经模型属于“数据”：`mt-eval contest submit-model` 发送 safetensors 权重 + 声明式分词器 + 配置文件——**无代码，无 Dockerfile。**你的节点会验证其不含任何代码（为 safetensors 而非 pickle；无 `trust_remote_code`/`auto_map`；仅包含数据文件），并在节点“自身的”受信任引擎（`transformers`、`trust_remote_code=False`，离线运行）中运行这些权重。架构默认采用宽松策略（只要你的引擎能原生加载即可）；严谨的主持方也可以固定一份允许列表。由于没有任何不受信任的内容会被执行，因此无需进行沙盒隔离。发布为 `declarative-model`，方法身份**在结构上无代码**。
  - **通道 B — 可运行打包包（沙盒后备方案）。**适用于“确实是代码”的方法：`mt-eval contest submit-method` 发送 Dockerfile + 入口点。在你的保管人批准后，你的节点会在网络隔离的容器内执行它（`--network=none`——容器内部不存在网络栈；只读 root、丢弃 capabilities、净化环境变量），并预先执行自动化静态检查，且参考译文绝不进入容器。发布为 `method-execution`，具有**经执行验证**的身份。
  无论哪种通道：打包包哈希都会冻结到授权请求中（确保所运行的内容可证明正是所提议的内容），且分数都通过相同的仅聚合路径发布。为了实现最大程度的隔离，评分机器可以是真正的物理隔离机（气隙系统）：经授权的请求和经 Ed25519 签名的仅分数打包包通过可移动介质进行传输（`mt-eval node relay` / `import-bundle` / `export-scores`）——保密文本甚至绝不会接触联网机器。这些通道“尚未”包含的功能包括：节点的硬件证明（身份为自报）、正式的争议仲裁机制，以及——特别是针对通道 B——移除网络栈之外更深层的容器加固（seccomp 配置、microVM；这也是建议优先选择通道 A 的原因）。请参阅[真实限制](/docs/network/honest-limitations)。
- ✅ **承诺层现已上线（2026-09-07）。**参赛项声明（主要/对比系统、赛道）、提交阶段、保留结果（`hidden_until_close`），以及一旦存在参赛项便使你声明的承诺不可编辑的冻结机制，均在网络托管端点的数据库中强制执行。联盟式主持方通过应用套件附带的迁移即可获得相同的规则；对于较旧的端点，套件会回退到基础集并给出提示（`declarations_available: false`），而不是弄虚作假。下文步骤中凡是说明“数据库冻结 / 保留”的地方，都是严格执行的。
- 🔲 **开发中：门限签名。**对于使用 `champollion seal-corpus` 封装的数据集，M-of-N 保管人批准会被*记录*在授权和审计表中，而封装密钥是一个带标签的单密钥对占位替代（`champollion seal-corpus keygen`）。在离线节点（`mt-eval node seal`）上封装的数据集使用节点内置的**密钥仪式**（`mt-eval node ceremony`）：数据集密钥按 M-of-N 进行分割，仅在仲裁法定人数授权的运行期间在内存中重组。该仪式从未在真实的保管人场景中使用过，且在 v1 中其份额只是纯文件。两条路径均不具备门限*签名*：气隙分数包签名使用的是单一节点密钥（`seal-corpus sign-keygen`）。
- ❌ **在设计上并不存在：**由 Champollion 托管你的语料库、持有你的密钥或保管奖金。参赛者的打包包（他们自己的模型或代码）在传输到你的节点的过程中会中转我们的存储空间；但你的语料库内容绝不会中转。
- ❌ **直接删除而非留作隐患。**`contest submit-hypotheses`（已于 2026-09-06 废弃）会上传源文本公开的盲测集的翻译；`contest submit`（已于 2026-09-06 废弃）会链接你自己发布的分数。这两者都不再作为竞赛参赛路径。源文本公开的盲测轮次仅作为可选的组织者诊断手段保留，而自行报告的分数仍然归属于开放排行榜——这是一个按语料库和语言对方向索引的公开榜单，而非竞赛。

如果下面的步骤依赖于 🔲 列表中的内容，该步骤会说明。
:::

---

## 交易的形式

| 谁 | 持有 | 永不持有 |
|-----|-------|-------------|
| **您（社区/组织）** | 语料库、加密密钥（通过您的监管人）、奖金、奖项决定 | — |
| **Champollion / 网络** | 元数据卡、密文摘要、授权 + 审计记录、已发布的分数 | 您的语料库内容、您的密钥、您的资金 |
| **方法开发者** | 他们的方法 | 您的测试数据——他们看到分数，永远看不到句子 |

下面的所有内容都是该表的机械扩展。

---

## 组织者的前置条件

在第 1 步之前，了解运行节点端实际需要什么：

- **带 node 额外依赖的测试套件：**
  `python3 -m pip install 'mt-eval-harness[node]'`（0.2.0 或更高版本；请使用 `python3 -m pip`，它可以在测试套件运行的任何环境中工作——裸的 `pip` 并不在每个虚拟环境的 `PATH` 中）。`[node]` 额外项添加了 `cryptography` 库，供 `mt-eval node keygen`、保管人仪式和分数清单签名使用。单纯的 `python3 -m pip install mt-eval-harness` 缺少该库，这些命令将会终止并提示此项安装。
- **docker 或 podman** — 方法执行通道所必需。节点会自动检测 docker，然后检测 podman（`node.json` 中的 `sandbox.runtime` 默认为 `null`；如需强制指定，请在此处命名）。如果两者都不在 `PATH` 中，`mt-eval node run-method` 会在运行任何内容之前以单行拒绝并列出这两者，且请求会保持原状，以便在安装运行时后继续运行。**没有降级方案**。带有 `--network=none` 的容器隔离是核心保障，因此没有容器运行时则不会运行任何内容。
- **Node.js 20.11+ 以及 `champollion` npm CLI** — 测试套件并没有重新实现封装密码算法。`champollion seal-corpus`（动词命令：`keygen`、`seal`、`open`、`sign-keygen`、`sign`、`verify`）是唯一的密码算法实现（X25519-ECDH → HKDF-SHA256 → AES-256-GCM），组织者节点通过 shell 调用它。
- **位于 `~/.mt-eval/node.json` 的节点配置。**没有该配置，每个 `mt-eval node` 命令都会拒绝启动。`mt-eval node init` 会在相应位置写入初始配置（`--print` 则仅显示该配置）。它包含你自行报告的 `node_id`（绑定到每个请求指纹中）以及一个 `contests` 映射，指向你的开发集、封装数据集（`secret_set_id` + `secret_artifact`）、封装保留集（如果你准备了的话，`holdout_set_id` + `holdout_corpus`；如果没有请删除这两个键）以及公开资格门槛（`qualifier` + `dev_corpus`，基于 0–100 资格评分刻度的阈值）。一旦你运行了 `contest prepare`（步骤 1），`mt-eval node init --from-contest ./mytask` 就会写入初始配置，并自动填入来自 `./mytask/local/manifest.json` 的竞赛值，同时列出剩余需要你填写的内容。它所应用的映射如下（如果你愿意也可以手动填写）：

  | `local/manifest.json` | `node.json`（位于 `contests.<contest-id>` 下） |
  |---|---|
  | `contest.language_pair` | `language_pair` |
  | `secret.sealed_set_id` | `secret_set_id` |
  | `secret.corpus_sealed_artifact` | `secret_artifact` |
  | `holdout.sealed_set_id` / `holdout.corpus_sealed_artifact` | `holdout_set_id` / `holdout_corpus`（没有保留集时两者均被移除） |
  | `qualifier.corpus_file` | `dev_corpus` |
  | `qualifier.qualifier_id`, `corpus_card_id`, `threshold`, `metric`, `year` | `qualifier.*`（同名） |
  | `test_suites[].suite_id` / `sha256`, `test_suite_local_copies` | `test_suites[].suite_id` / `corpus_sha256` / `corpus_path`：当 `contest prepare` 读取的副本（`--test-suite <id>=<path>`，或它找到的副本）存在于本机且字节被锁定时；否则由你设置 `corpus_path` |
  | `secret.sealed_block.keyScheme` | `custody`：若数据集针对单一密钥对封装则为 `single-key`（然后设置 `secret_privkey`），若使用仪式则为 `threshold-quorum` |
  | `registration.prize_terms`（由 `contest prepare` 和 `contest register` 记录） | `prize_terms_sha256`：条款的 SHA-256，即参赛者传给 `--accept-terms` 的哈希值（竞赛未声明奖金时留空） |

  竞赛 ID 是你提供给 `contest prepare` 的 `--slug`（如下方示例中的 `mytask`）。prepare 会将其记录在清单中，注册会在该 ID 下创建竞赛，并且这也是参赛者传给 `contest qualify` 和 `submit-method` 的 ID，因此请在发布开发集时一并公布；`--contest-id` 可以覆盖它。（在记录 ID 之前编写的清单会保留从其名称派生的 ID 注册，即 `"My Task 2026"` → `my-task-2026`，因为其竞赛、凭据和节点配置已经在使用该 ID。）没有任何清单会知晓 `node_id`、`cards_dir`、`signing_key` 或你的私钥文件，因此这些内容仍保留为 `<...>` 占位符供你填写。随后 `mt-eval node ledger verify` 会进行检查并说明检查了哪些内容：它会加载配置（托管方式、完整的资格门槛、保留集对、本地卡片索引），在遇到第一个仍为 `<...>` 占位符或声明的文件不在本机上的值时予以拒绝，打印每个竞赛的数据集和文件，然后才重放授权账本的哈希链（新节点上为零条目）。
- **节点携带的本地语言卡片索引。**评分会指定运行的语言对，且节点绝不会通过网络查找语言。请将 `node.json` 中的 `cards_dir` 指向一个包含你节点评分的所有语言卡片的目录（或设置 `MT_EVAL_CARDS_DIR`）；缺少本地索引的节点在启动时会直接拒绝，而不是去联网抓取。这两个已安装的包都没有附带每种语言的卡片目录，因此请在联网机器上使用 `champollion` CLI 编写一份，为你语言对中的每种语言各生成一个 `<code>.json` 文件：

  ```bash
  mkdir -p node-cards
  champollion network card eng --json > node-cards/eng.json
  champollion network card crk --json > node-cards/crk.json
  ```

  然后将 `"cards_dir"` 设置为该目录的绝对路径。对于气隙隔离节点，可将其放在离线打包包（`mt-eval node bundle --out <dir> --include node-cards`）中带入；它会放置在 `<dir>/artifacts/node-cards`，并且节点上的 `cards_dir` 会指向该位置。
- **登录。**没有单独的账户创建步骤：第一个需要身份的命令（例如 `mt-eval contest prepare --self-serve` 或 `mt-eval publish`）会打开浏览器通过 **GitHub 或 Google**（Supabase Auth）进行 OAuth 登录。该账户的电子邮件就是每个注册表行所绑定的身份——请使用你组织所控制的邮箱。
- **接收限流。**针对参赛者的提交，每个提交者**默认每 24 小时限流 5 次**（防探测；可在 prepare 时通过 `--intake-daily-limit` 按竞赛进行设置，或作为 shared-task 版本默认值）。请据此规划你的竞赛时间表。

**关于自助注册的一个坦诚提示。**在**默认的网络托管端点**上，自助注册（`contest prepare --self-serve` / `contest register`）目前会被生产端点保护机制拦截：在尚未做出开放此入口的策略决定之前，CLI 会给出明确的提示信息并拒绝写入生产项目。联盟式主持方（你自己的 Supabase 项目）不受影响。如果你在默认主机上触发了该保护拦截，这是当前的实际状态，而不是你配置有误——请[提交 issue](https://github.com/gamedaysuits/Champollion/issues)，我们将协助你完成注册。

---

## 第 1 步——构建您的保留测试语料库

设计您将针对其进行测量的语料库，并从第一天起将其保留：其中的任何内容都不应该曾经被发布、发布或与模型提供商共享。

- 遵循[语料库设计框架](/docs/network/specifications/corpus-design)了解条目结构、难度等级和注册覆盖范围，以及[语料库创建食谱](/docs/network/tutorials/corpus-creation)了解工具。
- 在密封前让流利的使用者检查条目——[使用者验证协议](/docs/network/specifications/speaker-validation)描述了一个您可以重复使用的审查结构，不仅用于方法审查，还用于语料库质量保证。
- 现在决定语料库**版本**标签（例如 `v1`）。授权授予绑定到特定版本，因此版本控制是安全模型的一部分，而不是簿记。

### 语料库如何切分

只需一条命令，即可根据你选择并记录的随机种子，以确定性的方式从主语料库生成各个层级：

```bash
mt-eval contest prepare --corpus master.json --slug mytask --name "My Task 2026" \
    --pair 'eng>crk' --seed 20260906 --qualifier-threshold 35 \
    --dev-size 400 --secret-size 500 --sealed-holdout-size 250 \
    --test-suite <a public corpus card id> \
    --license <the licence the rights-holder grants> \
    --custodian-group <opaque id> --threshold-pubkey ./contest.pub.json \
    --out ./mytask
```

`--qualifier-threshold` 是方法在公开开发集上必须达到的分数，之后你的节点才会将其运行在封装集和封装保留集上。它采用 **0–100 资格评分刻度**：资格分数是开发集输出与已发布的开发集参考译文相比的**语料库级 chrF++**（sacreBLEU chrF，`word_order=2`）——这是评分标准的核心指标，与 `mt-eval run` 卡片为相同输出所标注的核心数值一致。没有任何其他指标掺杂其中；完全匹配项仅作为诊断信息显示在旁，绝不作为门槛。你的节点在重新运行方法时会计算完全相同的数值，因此参赛者的凭据与你节点的测量结果具有可比性。

请根据你在此开发集上测得的 chrF++ 分数来设置阈值（在基线的开发集输出上运行 `contest qualify`），而不要根据其他评测集上的分数来设置：不同语言和语料库之间的 chrF++ 水平差异很大。在[评分标准](/docs/network/specifications/scoring#how-runs-are-scored)之前注册的、使用已废弃的复合指标作为其度量标准的资格赛仍然有效：其阈值将按 chrF++ 刻度读取，且 qualify 每次都会说明这一点，因此请确认该数值或轮换到新的资格赛。

`--license` 是必需的。它指定了发布的开发集所采用的许可证，mt-eval 绝不会替你挑选。发布的文件将其包含为 `dataset.license`，这正是 `mt-eval run`、`contest qualify` 和 `publish` 所读取的内容，因此参赛者的运行会受到你许可证的约束。请以 SPDX ID 的形式使用权利人自身的授权。使用 `CC-BY-4.0` 时，参赛者可以使用任何模型服务进行评测。对于非商业许可证（例如 `CC-BY-NC-4.0`），远程模型只能在不用于训练的通道上运行。对于你自己的条款（`LicenseRef-<name>`），在记录权利人的许可之前将拒绝远程评测，因此参赛者只能使用本地模型。

发布的文件还会声明主语料库的其他条款，这些条款读取自主语料库自己的卡片（`champollion network register-corpus` 编写的语料库卡片，通过其 `<file>.champollion.json` 附带文件）及其自身的封装信封：`dataset.do_not_train`，以及在主语料库标记为仅限本地时的 `dataset.transmission: "local-only"`（参赛者此时只能使用自己机器上的模型来运行开发集），并由 `dataset.terms_from` 说明各项的来源。当主语料库的卡片未说明训练条款时，传入 `--do-not-train true` 或 `false`；该标志可以收紧主语料库的条款，但绝不能放宽（在 `doNotTrain: true` 主语料库上使用 `--do-not-train false` 会被拒绝）。prepare 会打印这些条款，并在主语料库卡片注明禁止重新分发时发出警告：发布 `public/` 属于重新分发，因此在权利人同意之前请勿发布。

| 切分集 | 谁能看到 | 用途 |
|-------|-------------|----------------|
| **公开开发集** (`--dev-size`) | 所有人——源文本*和*参考译文均已公开发布 | **资格赛**：参赛者在提交之前必须在其上自行评分（步骤 8） |
| **封装集** (`--secret-size`) | 仅你的节点——源文本*和*参考译文保持加密状态 | 参赛项实际评分所依据的数据集 |
| **封装保留集** (`--sealed-holdout-size`，可选) | 仅你的节点 | **第二个**封装切分集，在同一次运行中进行评分，其分数会保留隐藏，直到你关闭竞赛 |
| *盲测集* (`--blind-size`，默认为 0) | 源文本发布，参考译文保留隐藏 | 你自己的可选诊断轮次。它**不是**参赛路径：参加竞赛是通过提交方法进行的，绝非通过上传翻译 |

各个切分集是不相交且可重现的：相同的语料库、相同的种子，永远得到相同的切分。切分配方保存在组织者本地的清单中，绝不会离开你的机器。

**重复句子只保留在一侧。**切分采用组不相交（`group-disjoint/1`，记录在清单的 `split` 块中）：完全共享源文本或参考译文，或者在标准化大小写、标点和空格后共享源文本或参考译文的各行会组成一个组，整个组会完整地划入某一个切分集中。因此，封装集中的任何行都不会与已发布的开发集中的行发生重复。各组会使用你的随机种子进行打乱，并按 dev、blind、secret、holdout 的顺序排列；对于没有重复句子的主语料库，切分结果与逐行打乱完全相同。如果整组无法填满你所要求的大小，prepare 将拒绝执行，并显示重复行的数量及修复方案：移除重复项（每个组仅保留一行），或者将所请求的总量设定为小于主语料库的大小以便排除某些组。

**`public/` 是可公开发布的；运行日志保存在 `runs/` 中。**prepare 会在 `public/` 中写入一个标记文件 `.champollion-releasable.json`。运行日志、报告和翻译缓存绝不会写入该目录：`mt-eval run` 会拒绝位于其内部的 `--output-dir` 或 `--cache-dir`，并在旁边指出 `runs/`（`<out>/runs/`），且 MCP 服务器的 `run_benchmark` 会自动将针对已发布开发集的运行（用于设置阈值的基线运行）放置在 `runs/` 中并予以提示。在该标记出现之前准备的竞赛可以通过其目录布局（`public/` 与 `local/manifest.json` 并列）予以识别。

**为什么需要保留集。**在较长的竞赛周期中，单一的封装集仍然可能被针对性微调——每次提交都是一次探测，足够多的探测就会产生少许泄露。在同一次授权运行中评分、但直到闭赛前任何人都看不到分数的第二个切分集，可以在最后为你提供客观干净的数据：如果一个系统的排名在两组之间发生变动，你就能看出其中有多少是针对性调优、多少是真正的翻译能力。两个数据集由**单次**授权共同覆盖，因此不会给你的保管人带来额外的仪式负担。

**第三方测试套件。**`--test-suite` 指定了一个公开的诊断语料库——来自第三方、经 sha 锁定且可公开下载——每个参赛项也会在其上运行。这些分数**仅供报告，绝不参与排名**：它们的存在是为了让读者能够看清，在封装集上表现优异的分数，在非本次竞赛设计的测试集上是否同样站得住脚。Champollion 会拒绝处于隔离状态、未固定哈希、不适用于你语言对，或者属于你自己切分集的测试套件。

**已经公开的封装行算不上封装。**`contest prepare` 会将你的封装集和封装保留集与所有公开内容进行比对：发布的开发集（上面的组不相交切分保证此处重合为零）、发布的盲测源文本（若有）以及每个声明的测试套件。它支持完全精确匹配以及在标准化大小写、标点和空格后的匹配（与切分组所使用的比对方式相同），然后打印每个重叠项及其数量（例如“30 of 30 rows also appear in test suite …”），并将重合数量记录在 `local/manifest.json` 中。对于第三方测试套件，它只会警告而不会直接拒绝：该套件是第三方的公开文本，由你决定是从主语料库中移除这些行，还是舍弃该套件并重新运行 prepare。为了检查套件，prepare 需要其句子。它会使用本机上已有的副本，在准备期间绝不会进行下载。使用 `--test-suite <id>=<path>` 指定你的副本；其 sha256 必须与注册表的固定值匹配。如果未找到副本，警告信息会提示该套件**未经检查**，而绝不会假定它是干净无重合的。清单会记录 prepare 读取的每个副本的路径，以便 `node init --from-contest` 能将你的节点指向它。

你所声明的保留集和测试套件将成为承诺：一旦首个参赛项送达，竞赛就会将其冻结，因此你无法在竞赛中途添加或删除测试套件。

## 第 2 步——加密它并将其托管在您的基础设施上

在静止状态下加密语料库（任何现代 AEAD 方案——例如 `age`/x25519 或 AES-256-GCM）并在您控制的某处托管**密文**。Champollion 永远不会接收明文*或*密文。

发布恰好一个工件：密文 blob 的 **SHA-256 摘要**。

```bash
shasum -a 256 sealed-corpus-v1.age
# → 3b5f0c…e91a  sealed-corpus-v1.age
```

摘要是公开的；数据不是。任何人以后都可以验证针对其进行评估的 blob 与您密封的 blob 字节相同——完整性而不占有。这与[普通语料库注册](/docs/network/sovereignty/registering-corpora#1-registration-is-metadata-not-content)相同的哈希而非复制规则相同。

## 第 3 步——注册元数据卡

通过标准的、故障私有的[注册通道](/docs/network/sovereignty/registering-corpora)注册语料库：一张卡片，包含 `language_pair`、`license`、`attribution` 和 `do_not_train`——**无句子**。选择**私有**曝光通道；下一步中的密封集合注册是使其符合竞赛资格的原因。

## 第 4 步——将其注册为密封集合

密封集合是一个无内容的注册表条目，将三件事记录在案：

| 字段 | 它对您的承诺 |
|-------|------------------------|
| `ciphertext_digest` | 计为"语料库"的确切字节 |
| `custodian_group_id` | 控制访问的组的不透明 id（在同意前永远不是公开的组织/国家名称） |
| `current_qualifier_id` | 方法必须清除的公开轮次，然后才能提议密封运行 |

注册是**自助的，从您自己的登录**——没有策展人参与，也没有特权密钥：

```bash
# Register a contest you prepared with `mt-eval contest prepare --no-register`
mt-eval contest register --manifest local/manifest.json

# Or do it in one shot at prepare time
mt-eval contest prepare … --self-serve
```

清单始终保留在你的机器上——注册仅发送不包含实际内容的 ID、摘要和阈值。在发送任何内容之前，你可以确切查看它将发送的内容：`contest prepare --no-register` 会按顺序打印注册方案，即 `contest register` 即将写入的每一行——每个封装集的 ID 及其密文的 SHA-256（附带你机器上保持封装状态的行数）、保管人组、资格赛 ID 和阈值、包含记录承诺的竞赛行、策略列，以及合并到竞赛元数据中的所有保留集、测试套件和奖金条款。该方案由发送数据行的同一段代码构建，因此绝不可能描述与所发送内容不一致的信息。每个注册表行都是**身份绑定的**：数据库会记录注册它的登录账户，并冻结该绑定以防止后续修改，且资格赛只能作为**同一**身份所注册的封装集的门槛。封装集创建即处于隔离状态（绝不能支持普通竞赛或在公开排行榜上排名），资格赛创建即处于安全状态，且注册受到速率限制——所有这些均由所有客户端（包括我们的客户端）底层的数据库触发器强制执行。注册表本身是公开可读的，因此你可以验证自己的条目完全符合你所封装的内容——分毫不差。

**真实限制。**自助入口仅用于注册（在数据库层仅支持插入）。**资格赛轮换和封装集停用仍需策展人介入**——请提交 issue 或通过 [GitHub](https://github.com/gamedaysuits/Champollion/issues) 与项目方联系。此外，在后续步骤中运行组织者评分节点（生命周期推进、授权授予、审计操作）是你自己节点上独立的、通过服务凭证授权的通道——自助仅止步于公开记录。

## 第 5 步——选择监管人和 M-of-N 规则

选择必须共同批准针对您的语料库的每次评估的人员或机构，以及阈值（例如 **3 of 5**）。监管人应该对您的社区负责，而不是对 Champollion 负责——参见[数据管理](/docs/network/sovereignty/data-sovereignty)和[所有权与条款](/docs/network/sovereignty/ownership-transfer)了解如何设置每个社区的条款。

**坦诚声明：**门限*签名*（在没有 M 个签名的情况下完全无法生成的授权）目前**处于开发中**。离线节点的密钥仪式（`mt-eval node ceremony`，Shamir M-of-N）已构建，但尚未与真实的保管人共同使用过。在其他方面，M-of-N 规则作为记录在案的流程强制执行：每个访问请求都会进入 **pending**（待处理）队列，保管人的决策会被记录下来，只有在获得授权的请求下才会生成授权凭证，且每个授权都是**单次使用、有时限的，并绑定到特定的（方法、语料库版本、评测节点）指纹**，所有事件——包括被阻止的尝试——都会记录到**仅追加、哈希链式、公开可读的审计日志**中。数据库会在所有客户端和密钥底层拒绝非法的状态转换。它目前尚无法防范的是平台运营方自身遭受入侵——这正是门限签名要解决的问题；在该功能发布之前，你应该将“Champollion 持有零密钥份额”视为正在努力实现的架构设计目标，而非你今天就能验证的既有属性。

## 步骤 6 — 设立奖金并声明其条款

奖金是可选的。**未声明奖金条款的竞赛即视为无奖金**——这是默认设置，并不代表竞赛规格较低。

如果你提供奖金，请与竞赛一同确定并公布以下内容：

- **金额与币种。**
- **赞助方**——出资方是谁。
- **资金存放处**——你组织的账户，或你指定的社区信托。**Champollion 绝不会持有、托管或流转奖金资金。**预先公布资金持有方的身份是确保奖金公信力的关键；请参阅条款模板中的[赞助方违约风险说明](/docs/network/sovereignty/terms-templates#trojan-horse-risks)。
- **阈值条件**——方法必须跨过的分数门槛，依照[奖金规范](/docs/network/specifications/prizes)编写：chrF++ 阈值、你需要的任何诊断门槛（例如最低 FST 接受率——参赛项必须通过的门槛，而非得分本身）、母语者验证要求、可重现性。请确保奖励条件能够依据已发布的分数进行验证，从而无需任何人单凭你（或我们）的一面之词来判断是否达到门槛。
- **奖金条款**——参赛项本身将如何处置。

### 奖金条款由你自行选择

执行方式是固定的：在主权竞赛中，参赛者向你提交模型或方法，并由你的节点运行。在此*之后*对其如何处理则由你选择，共有三种选项之一：

| 条款 | 你向参赛者传达的内容 |
|---|---|
| `pass_to_holders` — *转交持有方* | 方法转交给你（主权基准持有方）。无论谁获胜，你都将对其进行评分并保留该方法。 |
| `retain_ip` — *保留知识产权* | 参赛者保留所有权。你对参赛项进行评分，且最多仅保留一份封装副本用于审计。 |
| `release_open` — *开源发布* | 参赛者保留所有权，但必须在开源许可证下发布该方法。此公开发布是获取奖金的条件。 |

细节直接由条款决定，因此无需填写复杂的矩阵表格：你保留什么（`retention`）、权利是否转移（`rights`）、你可以将其用于什么目的（`host_use`）以及参赛者是否必须发布（`release`），全部**派生**自你所选择的选项。其中两个选项允许你细化缩小一个字段：

- 在 `retain_ip` 下，`--prize-retention delete_after_scoring` 会在完成评分后销毁工件（默认会保留一份封装审计副本）；
- 在 `release_open` 下，`--prize-release-timing` 将发布时机改为 `required_before_scores` 或 `required_after_prize`（默认为 `required_before_prize`），且 `--prize-release-license` 可以指定具体的许可证，而不是接受任意经 OSI 批准的许可证（`any_osi`）。

完整的派生表，以及在奖金发放前如何验证每个选项，请参阅[奖金规范 §2.1，条件 7](/docs/network/specifications/prizes#condition-7-in-detail-the-term-is-one-choice-of-three)。

```bash
# The term…
mt-eval contest prepare … --prize-disposition retain_ip

# …with the one narrowing that option offers
mt-eval contest prepare … --prize-disposition retain_ip \
  --prize-retention delete_after_scoring

# …or the same declaration from a JSON file
mt-eval contest prepare … --prize-terms my-terms.json
```

无论你选择哪一种，在写入任何内容之前，系统都会以通俗易懂的语言将条款连同其 **SHA-256** 打印反馈给你。该哈希值就是接受令牌：参赛者传入 `--accept-terms <hash>`，该接受声明会被打包进其打包包中并由其内容哈希覆盖，如果打包包接受的是其他任何条款，你的节点都会予以拒绝。条款会在竞赛收到首个参赛项的瞬间冻结，因此绝不会有人受到自己从未阅读过的条款约束。

金额刻意*不*作为条款的一部分：金额、币种和赞助方属于竞赛信息，而关于谁拥有方法所有权的条款，与关于支付多少金额的声明在性质上截然不同。

## 第 7 步——创建竞赛

密封集合上的竞赛使用显式**密封通道**。资格是故障关闭的：除非您的密封集合注册存在且处于活跃状态，否则竞赛被拒绝——创建竞赛**不授予任何人**对语料库的任何访问权限。

```bash
mt-eval contest create \
  --name "EN→CRK Community Challenge 2026" \
  --corpus sealed-eng-crk-v1 \
  --language-pair "en>crk" \
  --visibility public \
  --use-context non-commercial \
  --prize-disposition retain_ip \
  --results-visibility hidden_until_close \
  --anonymize-until-close \
  --description "Community-custodied held-out set; scores-only; prize held by <your org/trust>."
```

无论你事后做什么，其中两个标志都会被数据库固定或冻结，另外三个则是**承诺**：

- `--use-context` 是竞赛身份的一部分：它在竞赛注册的瞬间即被固定，且不可更改（如需更改请创建新竞赛）。默认为 `non-commercial`。
- `--primary-metric`（默认为 `chrf_plus_plus`）是排名所使用的指标，一旦竞赛收到首个参赛项便会被冻结。指定已废弃的 `composite` 的新竞赛将被拒绝并说明原因；在[评分标准](/docs/network/specifications/scoring#how-runs-are-scored)之前注册的竞赛仍可继续正常运作。
- `--visibility`（默认为 `public`）、`--description` 以及接收是否开放均不会被冻结。

这三项承诺会在竞赛收到首个参赛项的瞬间冻结：

- `--prize-disposition` / `--prize-terms` — 来自步骤 6 的条款。若两者均省略，则竞赛无奖金。
- `--results-visibility hidden_until_close` — 你的节点测量的所有分数均会被**保留隐藏**，直到你关闭竞赛为止，因此没有人可以根据自己的结果针对封装集进行微调优化。这是默认设置；示例中显式声明它是为了让承诺在你的笔记中清晰可见。如果你希望使用实时榜单，在节点完成时立即发布每个卡片，请传入 `--results-visibility immediate`。
- `--anonymize-until-close` — 在竞赛开放期间，参赛者在你排名中以固定假名显示。（这仅是你的排名视图；一旦卡片发布到公开排行榜，它不会对其进行匿名化。）

相同的三个标志在 `contest prepare` 和 `contest register` 上也可用，大多数组织者都会在这里进行设置，因为这些入口会为你创建竞赛。使用 `contest prepare --no-register` 时，你传入的注册标志（`--results-visibility`、`--anonymize-until-close`、`--primary-metric`、奖金标志、`--visibility`、`--use-context`、`--closed-intake`）会被记录在 `local/manifest.json` 中，且 `contest register --manifest` 会应用它们，除非你传入了其自身的标志（当某个标志替换了记录的值时，它会进行说明）。在注册任何内容之前，prepare 会打印所有这些条款及其值（无论是由你提供还是默认值），并说明何时不再允许更改。其 `--help` 列出了各个默认值。

*（`--corpus` 值是您注册的 `sealed_set_id`。密封通道从密封集合注册**自动**选择——没有额外标志；密封集合永远不能支持普通竞赛，普通隔离数据集永远不能支持任何竞赛。两个规则都在数据库中强制执行，在每个客户端下。如果您在第 4 步中使用 `contest register` 或 `prepare --self-serve` 注册，竞赛行**已经存在**——跳过此步骤；`contest create` 手动仅用于从已注册的密封集合组装竞赛。）*

## 第 8 步——方法首先在公开中获得资格

开发者在你在步骤 1 中发布的**公开开发集**上构建其方法并评分。你的封装集的 `current_qualifier_id` 指定了该轮次，且方法必须跨过其阈值门槛，才能发起封装集运行请求。这可以减轻你语料库面临的探测压力：在公开测试中展现出真正的性能之前，任何人都无法瞄准封装集。

参赛者只需一条命令，即可在离线状态下自行运行：

```bash
mt-eval contest qualify <contest-id> --dev my-dev-output.txt \
    --dev-corpus <the dev corpus you released> \
    --system "acme-nmt" --method-class pipeline \
    --offline-qualifier-id <qualifier id> --offline-threshold <threshold>
```

资格赛 ID 和阈值是评分过程需要从你这里获取的两项信息，因此请在发布开发集时一并公布这两者。对于使用 `contest prepare` 创建的竞赛，资格赛 ID 是开发语料库自身的 ID（即其 `dataset.corpus_id`），并且 prepare 会将阈值写入开发语料库的描述中。如果不带这两个 `--offline-…` 标志，qualify 则会转而从竞赛数据库中读取它们。这仅在竞赛已在参赛者指向的端点上注册时才有效。当竞赛不存在或无法连接到数据库时，qualify 会停止并打印上述离线命令，其中填入了参赛者自身的参数。

`--dev` 接收参赛者按语料库顺序每行一条的开发集翻译，可以是以条目 ID 为键的 JSON，或者是由 `mt-eval run --corpus <the dev corpus>` wrote (or its `_report.json` 生成的运行日志。运行日志按条目 ID 读取，并检查是否为在同一开发语料库上的运行；包含出错条目的日志将被拒绝，因为每个条目都必须评分。摘要随后会说明输出是由测试套件在该次运行中生成的，并根据其文件重新评分（带有该次运行的开销），而绝不会表述为是在测试套件外部生成的；只有纯文本假设译文文件才会以那种方式描述。

**通过资格赛并不等于已提交。**在给出判定后，qualify 会说明它目前能预知的提交相关事项。对于文件夹位于本机的某个方法插件的运行，它会运行与 `submit-method` 以及你节点相同的静态扫描（网络库、shell 网络工具、被禁止的文件系统路径），并指出任何会导致拒绝的内容，例如导入 `urllib` 以调用模型服务器的插件。对于测试套件自身 LLM 路径的运行（通过提供商访问的模型），它会提示当前形式无可提交的方法：节点在无网络环境下运行参赛项，因此模型必须内置在打包包中（参见下文*将方法调用的所有模型一并打包*）。否则，通过提示行会列出在提交时仍需进行的检查。这些检查均不会改变判定结果或凭据。

它会并排打印资格分数（门槛判断依据）与阈值，两者均位于 0–100 chrF++ 资格评分刻度上，随后展示分数的具体构成：语料库级 chrF++ 及其 sacreBLEU 签名、并列的其他标准指标（绝不混合加权）、仅作诊断而不作门槛的完全匹配项，以及任何评分注意事项。qualify 不会发布任何内容。如果某个系统的开发集输出大部分只是复制源文本，则无论其得分多高都会被拒绝：当一半或更多的输出与源文本相同时（忽略大小写、重音符和标点，并排除参考译文本就与源文本相同的行，如人名），说明参赛者并未在进行翻译。当你的节点重新执行时，同一条规则会再次将其拒绝。通过后会在其机器上写入一份**资格凭据**，若缺少该凭据，`submit-model` 和 `submit-method` 将拒绝构建提交。凭据按竞赛和系统分别保存（`--system`），因此使两个系统合格的参赛者会保留两份凭据；重新评估同一系统会保留早先的凭据。`submit-method` 和 `submit-model` 使用对应于 `--system` 的凭据（默认：对应于 `--name` 的凭据，否则为该竞赛的唯一凭据），存在歧义时将列出列表并予以拒绝。该凭据在设计上属于自报性质——因此它并不是最终门槛。在申领任何授权之前，**你的节点会在同一个开发集上重新执行所提交的方法**，并将其自身的测量结果与声明值进行比较；夸大方法性能的凭据将在此处被拒绝，且拒绝信息中会列明声明值与测量值。

**凭据会指明其来源的运行。**当 `--dev` 是运行日志（或其 `_report.json`）时，凭据会记录该运行及其运行的模型：对于 `mt-eval run --method local-model -m <model>`，记录 Hugging Face ID 和版本修订号，或模型目录及其文件的 SHA-256。未指定模型的 `local-model` 运行日志将被拒绝——早期的 0.2.0 构建版本未向该引擎传递 `-m`，导致其使用了后备的 English→Spanish 模型替代运行。随后 `submit-model` 会检查它打包的权重是否属于凭据所命名的文件，若不属于，则会列出两个哈希值并拒绝。从纯假设译文文件评分生成的凭据不会指明模型；对此由节点的重新执行进行检查。

**凭据与节点之间的差异会被标记。**两个数值是通过相同方式计算的——相同的评分器、相同的开发集，以及对于模型而言相同的解码长度规则——因此相同的权重计算结果差异应该在零点几分之内。当节点测得的数值与凭据的数值在 0–100 资格评分刻度上的差异超过 **2.0 分**时，节点会在重新执行后指出这一点；气隙隔离节点还会在其本地账本的检查记录中记录该差异，并在运行 `node approve --offline` 时再次打印给保管人查看。这只是一项标记，绝非拒绝：节点自身的数据才是门槛依据。（2.0 分的界限是特意设定的保守选择，容易触发标记；这是组织者可能需要重新审视的策略值。）

### 参赛者可在提交前预演全流程

任何人都不应该在数天后收到拒绝通知时才得知自己的打包包格式有误。`mt-eval contest validate` 会在参赛者本地机器上无网络的环境下，精确运行你节点首先运行的检查内容：

```bash
# the static checks your node runs on a bundle
mt-eval contest validate ./my-bundle.tar.gz

# …and the qualifier: does my dev output line up, and does it clear the bar?
mt-eval contest validate ./my-bundle.tar.gz --contest <contest-id> \
    --dev my-dev-output.txt --dev-corpus <released dev corpus>
```

它会打印检查结果表格，如果有任何内容会被拒绝，则以非零状态码退出（`--json` 供工具调用）。请在你的参赛征集公告中引导参赛者使用它：只需他们执行一条命令，就能为你省去诸多拒绝处理。

`validate` 不会写入任何内容。它会在不写入凭据的情况下重新对开发集输出评分，然后检查凭据：

- **已打包的打包包**（提交命令写入的 `.tar.gz`）携带打包时附带的凭据，该副本正是你节点所读取的。因此 validate 会针对该副本检查预演情况。它还会在参赛者机器上查找该副本所来源的凭据，并注明其系统，无论打包包的方法名称为何。当 `--system` 指向不同凭据，或者参赛者在打包后又对该系统进行了重新评估合格（打包包仍携带旧凭据）时，它会发出警告。在不带 `--offline-…` 标志的情况下，资格赛 ID 和阈值也来自该副本，这意味着它们是参赛者提供给 `contest qualify` 的值。检查结果会明确说明这一点。
- **源目录**，通过 `--manifest` 打包用于检查：validate 使用 `submit-method` 和 `submit-model` 将要嵌入的凭据，其查找方式与它们一致：`--system`，否则使用与打包包方法同名的凭据，再否则使用该竞赛的唯一凭据。

当该凭据涵盖不同的开发集输出、另一个开发集文件或其他资格赛时，它会发出警告。若不存在凭据，它也会发出警告。凭据仅来自于 `contest qualify`。

这是一次预演，并且它会明确声明这一点。你的节点仍会在无网络环境下构建镜像、运行容器，并亲自重新运行资格赛。validate 无报错仅表示*已知范围内*没有发现问题——并不保证运行一定能得分。

:::note[参赛者须知：你的竞赛位于哪个端点？]
**网络托管型**竞赛无需配置端点——测试套件附带的默认端点便承载了竞赛机制（资格赛门槛、方法提议、授权），且 `mt-eval contest submit-model` / `submit-method` 会直接与其通信。你需要测试套件 **0.2.0 或更高版本**（`mt-eval --version`）；更早的版本缺少 `qualify`、`validate`、`rank` 和 `close`。只有当组织者通过前文注意事项中描述的途径完成注册时，网络托管型竞赛才会开放，因此目前大多数竞赛都是**联盟式**竞赛。

**联合**竞赛 — 组织者在自己的 Supabase 项目上运行机制，因此提交永不通过我们 — 使用竞赛材料发布其端点。在提交前导出它：

```bash
export MT_EVAL_SUPABASE_URL=https://<contest-host>.supabase.co
export MT_EVAL_SUPABASE_ANON_KEY=<contest-anon-key>
```

如果工具指向没有竞赛机制的端点（比如缺少迁移的联合主机），命令停止并显示*"竞赛通道在此 Supabase 端点上尚不可用"*并告诉您它在与哪个端点通信。（联合组织者：在您的语料库发布旁边发布这两个值，`--node-id` 和 `--corpus-version`。）
:::

## 第 9 步——密封运行：请求、授权、执行、分数输出

对于每个参赛项：

1. 针对你的封装集提交一个**请求**——进入 `pending` 状态，并携带由（打包包哈希、语料库 ID、语料库版本、`scores-only`、评测节点测量值）组成的不可变指纹。
2. 你的节点对打包包执行其**自身的静态检查**。对于代码参赛项（通道 B），节点接着检查自己是否具备运行它的基本条件：存在容器运行时，且打包包声明的 RAM、临时暂存盘和运行时间符合你的 `sandbox` 上限。此处不匹配并非对方法优劣的裁定。拒绝信息会指出每一处不匹配（“8 GB RAM requested, this node allows 4 GB (sandbox.max_ram_gb)”），此时不会运行也不会判定驳回，请求保持原状。你可以在 `node.json` 中提高上限并重新运行 `mt-eval node run-method <id>`，无需重新提交。或者参赛者也可以使用拒绝提示打印的标志重新打包（例如 `--ram-gb 4`）；资源需求包含在打包包哈希中，因此这属于新的请求。随后节点在其公开开发集副本上**重新执行参赛者的资格声明**。参赛者的凭据是声明，此处执行的才是测量。若不达标将在此处被拒绝——在要求任何保管人批准任何内容之前，以及在打开封装集之前——且拒绝信息会说明声明值、测量值以及门槛标准。接受了非本次竞赛所声明的奖金条款的打包包也会在此处被拒绝。
3. 你的**保管人做出决策**（M-of-N）。批准会生成一份**授权凭证**：单次使用、有时限、仅对该确切指纹有效。
4. 评测在**你的**节点上的网络隔离沙盒中运行（`mt-eval node run-method`）：容器没有网络栈，参考译文保存在容器外部——或者为了最大程度隔离，在真正的物理隔离气隙机上运行，并通过可移动介质传输经签名的仅分数打包包（有关包含与不包含的内容，请参阅上方的状态框）。完全离线的黑暗节点不上传任何内容：你将经签名的分数包拷出，并在联网机器上发布运行卡片（`mt-eval node relay`）。你的封装保留集和任何已声明的第三方测试套件都在**同一次**授权运行中执行，因此无需保管人举行额外的仪式。
5. **唯有分数流出。**`scores-only` 发射规则在数据库层予以锁定；绝不会发布来自你语料库的逐条文本。
6. 如果你的竞赛承诺了 `hidden_until_close`，分数此时尚不会发布：它将作为仅你可见的推迟结果被**保留隐藏**，且 `contest close` 会在冻结排名之前发布每张被保留的卡片。被保留的结果绝不会丢失。
7. 每一步操作——请求、投票、授权、使用以及任何被拦截的尝试——都会追加到公开的、哈希链式的审计日志中，你（以及任何人）都可以对其进行重放核验。

## 提交方法（针对参赛者）— 两条通道

大多数 NMT 参赛项并不奇特：通常只是标准的微调 Transformer 及其权重。对于这些情况，有一条**首选的、无代码的通道**——而对于真正属于代码的方法，则提供沙盒后备通道。

### 通道 A — 声明式模型（标准 NMT 首选）

如果你的方法是标准神经模型，你可以将其作为**数据**提交——包括权重、分词器和配置文件——由组织者在其自身受信任的推理引擎中运行。**无需 Dockerfile，无代码，无需沙盒。**由于你提交的内容没有任何部分会被直接执行，因此组织者的安全检查变成了可判定的格式验证，而无需去证明任意代码是否安全——这对你和语料库而言都是严格意义上更强的安全保证。

```bash
mt-eval contest submit-model <contest-id> \
  --model-dir ./my-model \          # config.json + model.safetensors + tokenizer.* at the ROOT
  --name "My NMT" --version 2.0 \
  --architecture MarianMTModel \    # must be on the organizer's trusted whitelist
  --method-class pipeline --paradigm neural-nmt \
  --track constrained --training-data-file ./training-data.txt \
  --parameter-count 92487 \
  --weights-license Apache-2.0 --weights-public \
  --developer "Your Name" --node-id <organizer-advertised-node-id> --agree
```

**使用 NMT Forge 训练的模型。**`nmt-forge export` 会写入可部署文件夹 `export/model/`。除权重、配置和分词器外，它还包含 `forge-model.json`（该模型在你私有测试集上的得分以及本地路径）、`DEPLOY.md` 和 `champollion-plugin/`，这些都不属于参赛项的一部分。`submit-model` 仅打包 transformers 读取的文件（权重、`config.json`、`generation_config.json`、分词器文件）并打印排除的所有内容，因此这三项会自动被排除在外。该 `DEPLOY.md` 的第 6 节列出了构成参赛项的文件、来自 `config.json` 的架构，以及从权重文件头部读取的参数量，并附有确切的执行命令。为了精确发送你所检查过的文件，请将它们复制到专门的独立文件夹中，并将其作为 `--model-dir` 传入：

```bash
mkdir -p lane-a
cp export/model/config.json export/model/generation_config.json \
   export/model/model.safetensors export/model/tokenizer.json \
   export/model/tokenizer_config.json lane-a/      # the files DEPLOY.md §6 lists
mt-eval contest submit-model <contest-id> --model-dir lane-a \
  --architecture MarianMTModel --paradigm neural-nmt …
```

**以哪种参数量为准。**通道 A 会对照权重文件检查 `--parameter-count`。它会累加 `safetensors` 头部中的张量大小，并拒绝偏差超过 1% 的声明值。这是文件中实际存储的内容，可能与在 torch 中统计的数量不同。绑定或共享的权重仅存储一次。模型在加载时重新构建的表（例如正弦位置编码）可能根本不会保存。拒绝信息会打印该文件中的实际统计量；请声明该数字。

你的打包包必须满足的规则（在上传前会在本地验证，并由组织者节点再次验证）：

- **权重必须为 `safetensors`，绝不能是 pickle。**PyTorch `.bin`/`.pt`/`.ckpt` 属于 pickle 格式——在加载时可执行任意代码——将被拒绝。请导出为 `model.safetensors`（`safetensors` / `transformers` 原生支持）。
- **组织者引擎能原生加载的架构。**`config.json` 的 `architectures` 可以是主持方的 `transformers` 实现的任何架构（Marian、NLLB/M2M100、mBART、T5、Pegasus 等众多架构）——主持方**默认采取宽松策略**，因为在使用 `trust_remote_code=False` 时，安全性来自于无代码的格式，而非架构名称（不受支持的架构仅仅会加载失败，不会运行任何代码）。严谨的主持方可能会公布允许列表。严禁 `auto_map`，严禁 `trust_remote_code`——这些会将自定义代码夹带混入，一律会被拒绝。
- **声明式分词器**（`tokenizer.json` 或 `sentencepiece` `.model` + 词表），且**仅包含数据文件**——打包包内不得有 `.py`/脚本/二进制文件。

**`submit-model` 打包的内容。**位于 `--model-dir` 根目录下的数据文件（`.safetensors`、`.json`、`.model`、`.txt`、`.spm`、`.vocab`、`.merges`）：包括权重、配置、分词器和生成配置。其他所有内容——`README.md` 或 `DEPLOY.md`、子文件夹、位于 safetensors 旁边的 pickle 检查点——都会被排除，且命令会列出排除的内容。因此，`nmt-forge export` 写入的 `model/` 文件夹可按原样直接提交：其中的 `DEPLOY.md` 和 `champollion-plugin/` 会自动留在本地。`contest validate` 以相同方式打包，并将排除的文件作为 INFO 级别的检查发现进行报告。你节点的检查保持不变：携带非数据文件的打包包仍将在节点处被拒绝。

**输出长度限制。**你的节点始终采用显式长度进行解码：模型声明的 `max_new_tokens` 或 `max_length`（其 `generation_config.json`），否则每句最多生成 `max(64, 4 × source tokens)` 个新 token，且不超过解码器的最大位置限制。`mt-eval run --method local-model` 采用相同规则解码，因此参赛者的凭据与你节点的重新执行结果保持一致。`submit-model` 会打印将要应用的长度并将其写入清单（`model.decodeLength`）；节点会在该次运行的执行事实中记录所应用的长度（`execution.generation`）。若不指定显式长度，transformers 库会在约 20 个 token 时停止，这样所有参赛项的分数都将基于被截断的输出来评估。

组织者使用 `trust_remote_code=False` 离线运行它，且只有分数会流出——发布为 `declarative-model`，方法身份**在结构上无代码**。（数 GB 的多吉字节权重：可使用 `--bundle-out` 走潜网物理介质通道，与下文相同。）

### 通道 B — 可运行打包包（沙盒，适用于代码方法）

如果你的方法确实属于代码——流水线、LLM 指导的混合系统、自定义解码器——它无法以声明方式运行，因此必须转入网络隔离的沙盒中。坦白讲，这是一条安全性相对较弱的通道（它包含了不受信任的代码，而非拒绝运行代码），因此只要你的方法是标准模型，请尽可能使用通道 A。

**将方法调用的所有模型一并打包。**节点在完全无网络的环境下运行你的参赛项，因此调用托管模型 API 的方法（请求云端 LLM 的 LLM 指导混合系统、MT 服务）将无法获得响应，得分为零。LLM 指导的混合系统只有将其 LLM 包含在打包包内才能获得资格：位于 `/method` 下的开放权重，并在进程内运行或由你的入口点启动的本地服务器运行。你的方法在运行时读取的任何词典、FST 或其他数据同理。（[方法规范](/docs/network/specifications/methods#method-validity-and-dependency-classes)将需要托管 LLM 的方法称为依赖类别 A1；目前尚未构建允许此类请求在沙盒中运行的网关。）

**可运行打包包的契约是 stdin/stdout。**在容器内部，组织者节点精确执行：

```
cat /eval/source.txt | <your entrypoint> > /output/translations.txt
```

源语言句子通过 stdin 逐行输入；你在 stdout 上逐行输出一条翻译。容器没有网络栈（`--network=none`）、只读 root，以及可写的 `/tmp`。

**文件存放位置。**你作为 `--method-dir` 传入的文件夹中的所有内容都会被打包到打包包中的 `method/` 下，并在运行时**以只读方式挂载到 `/method`**，包括权重在内，因此无需向镜像中复制任何内容。请按如下方式组织结构：

```text
my-method/              ← --method-dir ./my-method
  translate.py          ← --entrypoint translate.py   (runs as /method/translate.py)
  weights/              ← read at /method/weights
  wheels/               ← vendored dependencies (see the Dockerfile below)
Dockerfile              ← --dockerfile ./Dockerfile
training-data.txt       ← --training-data-file ./training-data.txt
```

`--entrypoint` 是脚本在 `--method-dir` 内的路径。它在打包包内的路径 `method/translate.py` 同样被接受。如果一个名称可能指代两个不同的文件，命令将拒绝并列出这两者；如果文件缺失，它会列出所查找过的每一个路径。

**一个最小的 Hugging Face transformers 包装器：**

```python title="my-method/translate.py"
#!/usr/bin/env python3
import sys
from transformers import AutoModelForSeq2SeqLM, AutoTokenizer

tok = AutoTokenizer.from_pretrained("/method/weights")
model = AutoModelForSeq2SeqLM.from_pretrained("/method/weights")

for line in sys.stdin:
    inputs = tok(line.strip(), return_tensors="pt", truncation=True)
    out = model.generate(**inputs, max_new_tokens=256)
    print(tok.decode(out[0], skip_special_tokens=True), flush=True)
```

**Dockerfile 必须在没有网络的情况下构建。** 组织者使用 `--network=none` 构建你的镜像——离线构建测试*就是*构建——所以每个依赖都必须**供应到包中**（到达 PyPI 的 `pip install` 会导致构建失败，预检静态扫描会在任何东西被发送之前标记网络调用）。在你的方法目录中发布 wheels 并从中安装：

```dockerfile title="Dockerfile"
FROM python:3.11-slim
# The build context is the bundle root: Dockerfile + method/
COPY method/wheels/ /wheels/
RUN python3 -m pip install --no-index --find-links=/wheels torch transformers sentencepiece
# Weights are NOT copied — /method is mounted read-only at run time.
```

**每次提交必须携带的内容。**以下为必填项，若缺少任何一项，命令将在执行任何网络操作之前终止：

- `--method-dir`、`--dockerfile`、`--entrypoint`、`--name`、`--version`、`--method-class`、`--developer`、`--node-id` 和 `--agree`；
- 针对此竞赛和此系统的**合格 `mt-eval contest qualify` 凭据**（步骤 8；如果你有多个合格系统，可通过 `--system` 指定）；
- 两项声明，记录为你的声明项：`--track constrained` 或 `--track unconstrained`（无默认值），以及 `--parameter-count`；
- 对于具有已训练权重的方法（`--parameter-count` 大于 0）：还需提供 `--weights-license <SPDX id or LicenseRef-…>` 以及 `--weights-public` 或 `--weights-private` 之一；
- 对于**无训练权重**的方法（基于规则、词典、FST）：传入 `--parameter-count 0` 且无需权重标志。提交内容会将权重许可证及开放性记录为不适用，而无需你捏造一个许可证；
- 对于**提示 LLM** 的方法（未训练任何内容，仅编写提示词）：参数量为打包包运行的每个模型的参数总和，包含 LLM 在内，即使你并未训练它。请从 LLM 的模型卡片或其权重头部获取该数值，并在其权重可公开下载时将 LLM 的许可证作为 `--weights-license` 传入并带上 `--weights-public`。传入 `--parameter-count 0` 会误述系统：0 意味着该方法完全不运行任何模型。调用托管 LLM 的方法根本无法参加封装竞赛：节点没有网络，且用于承载此类调用的网关尚未构建（参见上文*将方法调用的所有模型一并打包*）。当所评分的输出是通过提供商获取的时，`contest qualify` 已明确指出这一点；
- 配合 `--track constrained` 时：提供 `--training-data-file`，即你用于训练的数据的纯文本列表（完全未经训练的方法需在文件中予以说明）；
- 如果竞赛声明了奖金条款：提供 `--accept-terms <hash>`（在不带此参数的情况下运行一次，系统会打印出条款及需要传回的哈希值）；如果竞赛要求说明：提供 `--description-file`。

**你的方法声明的资源。**打包包会声明其所需的 RAM、临时暂存盘和实际执行时间，组织者节点将拒绝要求超过其 `sandbox` 上限的打包包。默认值是 `mt-eval node init` 写入的节点模板中的上限：`--ram-gb 4`、`--disk-gb 4`、`--max-runtime-minutes 30`，无 GPU。因此，使用默认值打包的打包包可以在配置了模板默认值的节点上运行。如果你的方法需要更多资源，请使用这些标志（以及 `--gpu`）进行声明，并确认组织者节点是否允许。更改了上限的组织者应在竞赛中公布这些信息。如果节点拒绝，拒绝信息会列出各项数值以及节点允许的上限。

使用以下方式提交：

```bash
mt-eval contest submit-method <contest-id> \
  --method-dir ./my-method --dockerfile ./Dockerfile \
  --name "My NMT" --version 1.0 \
  --entrypoint translate.py \
  --method-class pipeline --paradigm neural-nmt \
  --developer "Your Name" --node-id <organizer-advertised-node-id> \
  --track constrained --parameter-count 78000000 \
  --weights-license Apache-2.0 --weights-public \
  --training-data-file ./training-data.txt \
  --primary \
  --agree
```

组织者节点在要求任何保管人批准运行之前，会在其本地的公开开发集副本上重新执行你的方法。`--agree` 用于确认接受方法提交条款。

**数 GB 权重，或无网络连接：使用潜网物理介质通道。**托管式接收路径将你的 tarball 作为**单次 POST 请求**上传到竞赛主持方的存储空间，因此会受到该主持方存储上传限制的约束——适用于代码和小型模型，但不适用于数 GB 的检查点。打包包契约本身允许大得多的工件（tarball 最大可达 100 GB，构建好的镜像最大可达 150 GB）。`--offline` 在完全不依赖网络的情况下打包该打包包并写入交换目录。在没有网络连接的情况下无法读取竞赛数据行，因此它还需要组织者公布的数值：`--bundle-out`、`--secret-set`、`--pair`、`--developer-email`、`--offline-qualifier-id` 以及 `--offline-threshold`（0–100 资格评分刻度上的阈值）。无权重的基于规则的方法离线打包示例：

```bash
mt-eval contest submit-method <contest-id> \
  --method-dir ./my-method --dockerfile ./Dockerfile \
  --name "My Rules" --version 1.0 \
  --entrypoint translate.py \
  --method-class pipeline --paradigm rule-based \
  --developer "Your Name" --developer-email you@example.org \
  --node-id <organizer-advertised-node-id> \
  --track constrained --parameter-count 0 \
  --training-data-file ./training-data.txt \
  --agree \
  --offline --bundle-out ./exchange \
  --secret-set <sealed-set-id> --pair 'eng>crk' \
  --offline-qualifier-id <published-qualifier-id> --offline-threshold 35
```

交换目录通过可移动媒体（或任何你们都信任的通道）传送给组织者；他们使用 `mt-eval node import-bundle` 摄入它。包的 SHA-256 无论如何都被冻结到授权请求中，所以运行的东西可以证明是你提议的东西。

**组织者注意：离线提议与在线提议一样需要等待保管人批准——且节点会按照步骤 9 的顺序先对其进行检查。**它以 *pending*（待处理）请求的形式到达，气隙隔离节点在没有数据库和服务密钥的情况下，自行记录其自身检查结果和保管人的决策：

```bash
mt-eval node import-bundle ./exchange               # stages it: PENDING custodian approval
mt-eval node run-method <request-id> --offline      # the node's checks: re-runs the entrant's qualifier, checks the container runtime
mt-eval node list --offline                         # what is staged, checked, approved or waiting, and the next command
mt-eval node approve <request-id> --offline --actor <custodian>
#   or: mt-eval node deny <request-id> --offline --actor <custodian> --reason "…"
mt-eval node run-method <request-id> --offline      # the sealed run: refuses until the approval is recorded
mt-eval node export-scores ./exchange               # signed scores, or the signed refusal
```

对待处理提议执行的第一次 `node run-method --offline` 不会打开任何封装内容。它会在公开开发集（你的 `node.json` 所声明的 `qualifier` + `dev_corpus`；`node init --from-contest` 会自动填入这两项）上重新执行参赛者的资格赛，并且对于代码参赛项，还会检查是否存在容器运行时，以及打包包声明的 RAM、临时暂存盘和运行时间是否符合你的 `sandbox` 上限。通过的检查会写入节点哈希链式的本地账本。未达到资格标准的情况将在此处被拒绝，记录为节点的驳回，并作为经签名的拒绝信息传回：不会询问任何保管人。如果节点自身无法运行该参赛项（缺少运行时、上限设置过小），则作为节点问题予以拒绝，不记录任何内容，且请求保持原状。

在账本中针对该请求的确切指纹和打包包记录有合格检查之前，`node approve --offline` 将拒绝执行，且其报错信息会指明需要首先运行的命令。随后，它将投票和授权写入同一账本（保管人份额仪式所使用的账本），并生成一条使用节点 `signing_key` 签名的决策记录，其中指明了给出该决策所依据的检查。在运行任何封装内容之前，第二次执行 `node run-method --offline` 会对这三项进行全面检查（账本通过验证、显示该请求在所导入的指纹下获得授权，且签名记录通过验证并指明该请求），因此待处理的提议绝不可能仅凭操作员的一面之词就得以运行。接着，在封装集打开之前，它会重新运行运行时检查和资格赛。驳回同样以此种方式记录，并作为经签名的拒绝信息传回给参赛者；保管人可以在任何阶段拒绝，无论是否经过检查。到达时已获得授权的请求——中继导出（已在竞赛数据库中获得授权）或 `node stage-request`（暂存组织者即为授权方）——无需进行第二次决策。

**组织者：在离线机器上预加载基础镜像。** 因为镜像构建使用 `--network=none` 运行，Dockerfile 的 `FROM` 基础镜像必须已经在机器的本地镜像存储中。在连接的机器上，`docker pull python:3.11-slim && docker save -o base.tar python:3.11-slim`；使用包携带 `base.tar`；在离线机器上，在运行 `mt-eval node run-method` 之前 `docker load -i base.tar`。在你发布的竞赛材料中与参与者就基础镜像达成一致。

## 步骤 10 — 排名、关闭、导出

仅分数结果会像其他任何运行一样发布到[排行榜](/docs/network/leaderboard/rules)，并标记为封装集评测。竞赛自身的排名由你来构建、冻结和发布：

```bash
mt-eval contest open-intake <contest-id>     # entry intake on — submit-model / submit-method admitted (owner only)
mt-eval contest close-intake <contest-id>    # intake off — work already received still scores
mt-eval contest rank <contest-id> --json     # provisional ranking, any time
mt-eval contest close <contest-id>           # one-way: freezes the ranking, shuts intake
mt-eval contest export <contest-id> --format csv --out results.csv
```

`rank` 的具体机制（以便你在规则中说明）：参赛项根据竞赛**记录的主要指标**进行排名（创建时为 `--primary-metric`；默认为 chrF++），次要排序依次为 chrF++ → BLEU → COMET → 最早提交时间。它**默认仅包含已验证项**——即节点发布的运行卡片——并会统计其隐藏的任何自行报告的卡片。每对相邻项都带有标记的平局判定：在存在逐段行时执行逐段配对显著性检验，否则根据 **95% 置信区间重叠**，再否则根据点估计值相等。**封装竞赛绝不发布逐段数据行**（在设计上仅输出聚合数据），因此其配对检验会在你的节点上运行。在关闭竞赛之前，请在节点上运行 `mt-eval node verdicts --contest <id> --out verdicts.json`；它仅写入签名的判定结果（每对包含：p 值、分数差、置信区间、句子段数——不含文本）。然后使用 `--node-verdicts verdicts.json --verify-key <the node's .pub.json>` 关闭竞赛。若没有判定文件，平局判断将退化为基于 CI 重叠。无论哪种方式，输出都会指明所使用的依据，且平局系统共享相同名次（`1, 1, 3`）。

`close` 是单向不可逆的操作。它根据记录的指标进行排名，在仍有提交正在评分时会拒绝执行（除非你强制执行），向你展示结果表格、进行确认提示，然后将排名冻结到竞赛记录中。`export` 会逐字逐句返回该冻结结果（JSON 或 CSV 格式），供你的总结报告或结果页面使用。在任何其他数据集上评分的卡片（完全保密的 T2 数据集、多余的开发集卡片）都会单独列出，绝不会混入主排名中。

### 决定结果何时公开

你在创建时做出的两项承诺，且事后无法悄悄更改——一旦你的竞赛有了参赛项，数据库就会立即将这两项冻结：

```bash
mt-eval contest create … \
  --results-visibility hidden_until_close \   # no score is visible while the contest runs
  --anonymize-until-close                     # pseudonyms in YOUR ranking artifacts
```

**`--results-visibility hidden_until_close` 是真正用于隐藏分数的选项。**在该选项下，你节点评分的每张卡片都会被保留隐藏而非直接发布：方法依然执行了，授权依然消耗了，卡片也完整组装、验证并原样存储——只是没有展示在榜单上。`contest close` 会**首先**发布所有保留的卡片，然后构建并冻结排名，因此不会丢失任何内容，且冻结的结果会为你持有的所有项进行排名。即使在强制关闭时也是如此：强制操作仅针对仍处于处理中的工作，绝不是扣下竞赛应公布的分数。冻结的快照会确切列出关闭操作所发布的结果。

保留隐藏是一种**记录在案的状态，而非丢失的运行**：被保留的卡片不可编辑，且标明其发布位置的指针在写入一次后绝不会被重新指向——这两点均在数据库层强制执行，位于所有客户端底层。在竞赛开放期间，`rank` 会告诉你当前有多少个结果处于保留隐藏状态，因此临时排名在未完成时绝不会被误读为完整结果。

**`--anonymize-until-close` 的作用相对有限，有必要明确说明它的具体行为。**在竞赛开放期间，它会在*你的*排名产物中——即 `rank` 表格、其 JSON 及 CSV——将参赛者名称替换为确定性的假名，并由 `close` 揭晓真实名称。它**不会**对公开排行榜进行匿名化：已发布的卡片会显示该参赛项所声明的署名。如果你希望参赛者在竞赛结束前无法看到彼此的结果，应该使用 `--results-visibility hidden_until_close`；当前标志并不能代替它。

如果某个方法跨过了你在步骤 6 中公布的阈值条件——包括[母语者验证](/docs/network/specifications/speaker-validation)（这是你社区的把关门槛，而非自动化流程）——则由**你**（或你的信托基金）根据你公布的条款颁发奖金。Champollion 的职责仅到测量评分环节为止。

---

## 您永远保留的内容

- **语料库。** 它永远不会离开您的基础设施。将密文离线，密封集合就停止可运行。
- **密钥。** 当您的监管人停止授予访问权限时，访问权限就会消失。
- **资金。** 它从未在其他任何地方。
- **记录。** 审计日志的头摘要是可发布的，因此谁针对您的语料库运行了什么的历史无法被悄悄重写——由任何人，包括我们。

对于您可以调整的条款语言——所有权、仅分数许可和竞赛可能受到攻击的方式的明确说明——参见[条款模板](/docs/network/sovereignty/terms-templates)。
