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

- ✅ **已上线：** 语料库注册（元数据卡片、哈希固定、暴露通道）、封存集注册表（摘要 + 托管人组 + 资格集，无内容）、带有封存通道的竞赛机制、授权请求/授予/审计数据层（待处理 → M-of-N 决策 → 单次使用的限时授予，仅追加的哈希链审计日志），以及在数据库层强制执行的仅分数发布。
- ✅ **已上线：组织者评分节点 + 假设通道。** 一条命令即可将您的语料库拆分为公开的开发集（资格集）、盲测集（源文本已发布，参考文本在您的机器上静态封存），以及可选的完全保密集（`mt-eval contest prepare`）。注册封存集、资格集和竞赛是**通过您自己的登录进行自助服务的** —— `contest prepare --self-serve`，或者对于您之前准备好的竞赛使用 `mt-eval contest register --manifest` —— 每一行都在数据库层绑定了身份；没有策展人介入，也没有特权密钥（有关诚实限制，请参见第 4 步）。参与者使用 `mt-eval contest submit-hypotheses` 提交他们的翻译（CLI 会在本地对开发集进行自我评分，并拒绝低于您阈值的上传）；您自托管的节点（`mt-eval node serve`）会自行对开发集证据重新评分，在资格集上进行把关，根据您竞赛的模型进行授权（`per-submission` —— 托管人批准每次评分 —— 或 `blanket` / `open`），根据从未离开过您机器的参考文本对盲测集进行评分，并发布**仅含聚合数据**的运行卡片。该通道**无法**证明：指定的模型方法生成了这些假设（方法身份由参与者声明，并在每张运行卡片上如此标记），并且它无法阻止坚定的对手跨多个不同的提交提取参考信号 —— 速率限制、字节级相同的去重和审计链会减缓这一过程；下面的方法执行通道才是真正的解决方案。
- ✅ **已上线：两个保密集方法通道。** 拥有已发布的假设通道记录的参与者可以针对您的保密集提出他们的方法。节点会根据提交内容选择通道：
  - **通道 A —— 声明式模型（首选）。** 标准的神经模型就是数据：`mt-eval contest submit-model` 发送 safetensors 权重 + 声明式分词器 + 配置文件 —— **没有代码，没有 Dockerfile。** 您的节点会验证它是无代码的（safetensors 而不是 pickle；没有 `trust_remote_code`/`auto_map`；仅包含数据文件），并在其**自己**受信任的引擎（`transformers`，`trust_remote_code=False`，离线）中运行这些权重。架构默认是宽松的（您的引擎原生加载的任何架构）；谨慎的主机可以固定一个允许列表。没有任何不受信任的内容被执行，因此不需要沙盒。发布为 `declarative-model`，方法身份**在构造上是无代码的**。
  - **通道 B —— 可运行包（沙盒后备方案）。** 对于**确实是**代码的方法：`mt-eval contest submit-method` 发送一个 Dockerfile + 入口点（entrypoint）。在您的托管人批准后，您的节点会在一个网络隔离的容器（`--network=none` —— 内部不存在网络栈；只读 root，丢弃的权限，净化的环境）中执行它，首先进行自动静态检查，并且参考文本永远不会进入容器。发布为 `method-execution`，具有**执行验证**的身份。
  无论哪个通道：包的哈希值都会被冻结在授权请求中（运行的内容可证明就是所提议的内容），并且分数通过相同的仅聚合路径发布。为了实现最大程度的隔离，评分机器可以是真正的物理隔离（airgap）：授权请求和经过 Ed25519 签名的仅分数包通过可移动媒体（`mt-eval node relay` / `import-bundle` / `export-scores`）进行交叉传输 —— 保密文本甚至永远不会到达联网的机器。这些通道目前**尚未**包含的内容：节点的硬件证明（身份是自我报告的）、正式的争议机制，以及 —— 特别针对通道 B —— 超出移除网络栈之外的更深层次的容器加固（seccomp 配置文件、microVM；这是首选通道 A 的一个原因）。请参见 [诚实限制](/docs/network/honest-limitations)。
- 🔲 **开发中：阈值签名。** 如今，M-of-N 托管人批准被*记录*在授权和审计表中；但如果没有 M 个份额就无法铸造授权的加密阈值密钥工具尚未构建 —— 当前的封存密钥是一个带标签的单密钥对替代品（`champollion seal-corpus keygen`），而物理隔离的分数包签名是一个单节点密钥（`seal-corpus sign-keygen`），而不是一个管理员仪式（steward ceremony）。
- ❌ **按设计不存在的情况：** Champollion 托管您的语料库、持有您的密钥或持有奖金。参与者的假设（他们自己的翻译）会经过我们的存储；但您的语料库内容永远不会。

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

- **docker 或 podman** — 方法执行通道必需。节点会自动检测 docker，然后检测 podman；如果两者都不存在，它会大声拒绝。**没有备选方案** — 使用 `--network=none` 的容器隔离是承重保证，所以没有容器运行时什么都运行不了。
- **Node.js 20.11+ 和 `champollion` npm CLI** — 该工具不会重新实现密封密码。`champollion seal-corpus`（动词：`keygen`、`seal`、`open`、`sign-keygen`、`sign`、`verify`）是唯一的密码实现（X25519-ECDH → HKDF-SHA256 → AES-256-GCM），组织者节点会调用它。
- **位于 `~/.mt-eval/node.json` 的节点配置。** 每个 `mt-eval node` 命令都拒绝在没有配置的情况下启动——运行其中任何一个，错误消息会告诉你配置路径和模板位置（它随工具源代码一起发布，在 `mt_eval_harness/contest_node.py` 中）。配置包含你的自报身份 `node_id`（绑定到每个请求指纹中）和一个 `contests` 映射，指向你的开发参考和密封工件。
- **一次登录。** 没有单独的账户创建步骤：第一个需要身份的命令（例如 `mt-eval contest prepare --self-serve` 或 `mt-eval publish`）会通过 **GitHub 或 Google**（Supabase Auth）打开浏览器 OAuth 登录。该账户的电子邮件是每个注册表行绑定的身份——使用你的组织控制的邮箱。
- **摄入节流。** 参与者提交按提交者限制为**默认每 24 小时 5 次**（反探测；在准备时使用 `--intake-daily-limit` 按竞赛设置，或作为共享任务版本默认值）。围绕它规划你的竞赛时间表。

**关于自助注册的一个诚实警告。** 在**默认网络托管端点**上，自助注册（`contest prepare --self-serve` / `contest register`）目前在生产端点守卫处停止：CLI 会拒绝并显示明确消息，而不是写入生产项目，等待关于打开这扇门的政策决定。联邦主机（你自己的 Supabase 项目）不受影响。如果你在默认主机上遇到守卫，那就是当前的状态，不是你这边的配置错误——[提交问题](https://github.com/gamedaysuits)，我们会帮你完成注册。

---

## 第 1 步——构建您的保留测试语料库

设计您将针对其进行测量的语料库，并从第一天起将其保留：其中的任何内容都不应该曾经被发布、发布或与模型提供商共享。

- 遵循[语料库设计框架](/docs/network/specifications/corpus-design)了解条目结构、难度等级和注册覆盖范围，以及[语料库创建食谱](/docs/network/tutorials/corpus-creation)了解工具。
- 在密封前让流利的使用者检查条目——[使用者验证协议](/docs/network/specifications/speaker-validation)描述了一个您可以重复使用的审查结构，不仅用于方法审查，还用于语料库质量保证。
- 现在决定语料库**版本**标签（例如 `v1`）。授权授予绑定到特定版本，因此版本控制是安全模型的一部分，而不是簿记。

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

清单保留在您的机器上——注册仅发送无内容的 id、摘要和阈值。每个注册表行都是**身份绑定的**：数据库记录注册它的已登录帐户并冻结该绑定以防止后续编辑，限定符只能对**相同**身份注册的密封集合进行门控。密封集合出生时被隔离（它们永远不能支持普通竞赛或在公开排行榜上排名），限定符出生时处于安全状态，注册受速率限制——所有这些都由每个客户端（包括我们的）下的数据库触发器强制执行。注册表本身是公开可读的，因此您可以验证您的条目说的正是您密封的内容——仅此而已。

**诚实限制。** 自助门仅用于注册（数据库层的仅插入）。**限定符轮换和密封集合退役仍需策展人调解**——开启一个问题或通过 [GitHub](https://github.com/gamedaysuits) 联系项目。在后续步骤中运行组织者评分节点（生命周期进展、授权授予、审计操作）是您自己节点上的单独的、服务凭证通道——自助在公开记录处停止。

## 第 5 步——选择监管人和 M-of-N 规则

选择必须共同批准针对您的语料库的每次评估的人员或机构，以及阈值（例如 **3 of 5**）。监管人应该对您的社区负责，而不是对 Champollion 负责——参见[数据管理](/docs/network/sovereignty/data-sovereignty)和[所有权与条款](/docs/network/sovereignty/ownership-transfer)了解如何设置每个社区的条款。

**诚实框：** 阈值*密码学*工具（密钥份额，使得没有 M 个签名就无法铸造授予）**正在开发中**。今天，M-of-N 规则作为记录的过程强制执行：每个访问请求进入**待处理**队列，监管人决定被记录，授予仅为授权请求铸造，每个授予是**单次使用、时间限制并绑定到一个特定的（方法、语料库版本、评估节点）指纹**，每个事件——包括被阻止的尝试——都进入**仅追加、哈希链式、公开可读的审计日志**。数据库在每个客户端和密钥下拒绝非法状态转换。它无法拒绝的是平台运营商本身的妥协——这就是阈值签名关闭的内容，在它发布之前，您应该将"Champollion 持有零个密钥份额"视为正在构建的设计目标，而不是您今天可以验证的属性。

## 第 6 步——设置奖金

决定并与竞赛一起发布：

- **金额和货币。**
- **赞助商**——谁在出资。
- **资金所在地**——您组织的账户或您指定的社区信托。**Champollion 永远不持有、托管或路由奖金。** 提前发布持有人的身份是使奖金可信的原因；参见条款模板中的[赞助商默认风险说明](/docs/network/sovereignty/terms-templates#trojan-horse-risks)。
- **阈值条件**——方法必须清除的分数条线，按照[奖金规范](/docs/network/specifications/prizes)编写：指标阈值、使用者验证要求、可重现性。使奖项条件可从已发布的分数验证，这样没有人必须相信您的话（或我们的话）关于是否清除了条线。

## 第 7 步——创建竞赛

密封集合上的竞赛使用显式**密封通道**。资格是故障关闭的：除非您的密封集合注册存在且处于活跃状态，否则竞赛被拒绝——创建竞赛**不授予任何人**对语料库的任何访问权限。

```bash
mt-eval contest create \
  --name "EN→CRK Community Challenge 2026" \
  --corpus sealed-eng-crk-v1 \
  --language-pair "en>crk" \
  --visibility public \
  --use-context non-commercial \
  --description "Community-custodied held-out set; scores-only; prize held by <your org/trust>."
```

*（`--corpus` 值是您注册的 `sealed_set_id`。密封通道从密封集合注册**自动**选择——没有额外标志；密封集合永远不能支持普通竞赛，普通隔离数据集永远不能支持任何竞赛。两个规则都在数据库中强制执行，在每个客户端下。如果您在第 4 步中使用 `contest register` 或 `prepare --self-serve` 注册，竞赛行**已经存在**——跳过此步骤；`contest create` 手动仅用于从已注册的密封集合组装竞赛。）*

## 第 8 步——方法首先在公开中获得资格

开发者在您的语言对的**公开**语料库上构建和评分他们的方法——普通的[提交方法](/docs/network/getting-started/submit-a-method)路径。您密封集合的 `current_qualifier_id` 命名方法必须清除的公开轮次，然后才能请求密封运行。这使探测压力远离您的语料库：在任何人展示开放中的真实性能之前，没有人可以针对密封集合。

:::note[参与者：你的竞赛在哪个端点上？]
**网络托管**竞赛不需要设置——工具随附的默认端点包含竞赛机制（假设摄入、预选门、方法提案），`mt-eval contest submit-hypotheses` / `submit-method` 开箱即用。

**联合**竞赛 — 组织者在自己的 Supabase 项目上运行机制，因此提交永不通过我们 — 使用竞赛材料发布其端点。在提交前导出它：

```bash
export MT_EVAL_SUPABASE_URL=https://<contest-host>.supabase.co
export MT_EVAL_SUPABASE_ANON_KEY=<contest-anon-key>
```

如果工具指向没有竞赛机制的端点（比如缺少迁移的联合主机），命令停止并显示*"竞赛通道在此 Supabase 端点上尚不可用"*并告诉您它在与哪个端点通信。（联合组织者：在您的语料库发布旁边发布这两个值，`--node-id` 和 `--corpus-version`。）
:::

## 第 9 步——密封运行：请求、授权、执行、分数输出

对于每个符合条件的方法：

1. 一个**请求**针对您的密封集合提交——它进入 `pending` 并携带（方法 tarball 哈希、语料库 id、语料库版本、`scores-only`、评估节点测量）的不可变指纹。
2. 您的**监管人决定**（M-of-N）。批准铸造一个**授予**：单次使用、过期、仅对该确切指纹有效。
3. 评估在您的节点上的网络隔离沙箱中运行（`mt-eval node run-method`）：自动静态检查、没有网络堆栈的容器、在其外部持有的参考文献——或者，为了最大隔离，在真正的气隙机器上，带有通过可移动媒体交叉的签名仅分数包（参见上面的状态框了解涵盖和未涵盖的内容）。
4. **只有分数离开。** `scores-only` 发出规则在数据库层固定；来自您语料库的每条条目文本永远不会发布。
5. 每一步——请求、投票、授予、使用以及任何被阻止的尝试——都附加到您（和任何人）可以重放的公开、哈希链式审计日志。

## 提交方法（面向参与者）—— 两个通道

大多数 NMT（神经机器翻译）条目并不奇特：一个标准的微调 Transformer 及其权重。对于这些条目，有一个**首选的无代码通道** —— 以及一个针对真正是代码的方法的沙盒后备方案。

### 通道 A —— 声明式模型（标准 NMT 的首选）

如果您的方法是一个标准的神经模型，您将其作为**数据**提交 —— 权重、分词器和配置 —— 组织者会在他们自己受信任的推理引擎中运行它。**没有 Dockerfile，没有代码，没有沙盒。** 因为您提交的任何内容都不会被执行，所以组织者的安全检查是可判定的格式验证，而不是试图证明任意代码是安全的 —— 这对您和语料库来说都是一个绝对更强的保证。

```bash
mt-eval contest submit-model <contest-slug> \
  --model-dir ./my-model \          # config.json + model.safetensors + tokenizer.* at the ROOT
  --name "My NMT" --version 2.0 \
  --architecture MarianMTModel \    # must be on the organizer's trusted whitelist
  --method-class pipeline --paradigm neural-nmt \
  --developer "Your Name" --node-id <organizer-advertised-node-id> --agree
```

您的包必须满足的规则（在上传前在本地进行验证，并由组织者的节点再次验证）：

- **权重是 `safetensors`，绝不能是 pickle。** PyTorch 的 `.bin`/`.pt`/`.ckpt` 是 pickle —— 加载时会执行任意代码 —— 因此会被拒绝。请导出为 `model.safetensors`（`safetensors` / `transformers` 原生支持此操作）。
- **组织者引擎原生加载的架构。** `config.json` 的 `architectures` 可以是主机的 `transformers` 实现的任何架构（Marian、NLLB/M2M100、mBART、T5、Pegasus 等等）—— 主机**默认是宽松的**，因为使用 `trust_remote_code=False` 时，安全性来自于无代码格式，而不是架构名称（不支持的架构只会加载失败，不会运行任何内容）。谨慎的主机可能会发布一个允许列表。不允许使用 `auto_map`，不允许使用 `trust_remote_code` —— 这些会把自定义代码夹带进来，并且总是会被拒绝。
- **声明式分词器**（`tokenizer.json` 或 `sentencepiece` `.model` + 词表），并且**仅包含数据文件** —— 包中不能有 `.py`/脚本/二进制文件。

组织者使用 `trust_remote_code=False` 离线运行它，并且只有分数会输出 —— 发布为 `declarative-model`，方法身份**在构造上是无代码的**。（对于数 GB 大小的权重：使用 `--bundle-out` 进行 sneakernet（物理传输）通道传输，与下文相同。）

### 通道 B —— 可运行包（沙盒，适用于代码方法）

如果您的方法确实是代码 —— 一个流水线、一个 LLM 辅助的混合模型、一个自定义解码器 —— 它就无法以声明式运行，因此它会转而通过网络隔离的沙盒。这确实是一个较弱的通道（它包含不受信任的代码，而不是拒绝运行它），因此只要您的方法是标准模型，就请使用通道 A。

**可运行包契约是 stdin/stdout。** 你的包声明一个入口点（例如 `method/translate.py`）。在容器内，组织者的节点运行：

```
cat /eval/source.txt | <your entrypoint> > /output/translations.txt
```

源句子每行一个到达 stdin；你每行向 stdout 写一个翻译。你作为 `--method-dir` 传递的所有内容都打包在 `method/` 下，并在运行时**以只读方式挂载在 `/method`**——权重包括在内，无需复制到镜像中。容器没有网络栈（`--network=none`），根文件系统为只读，`/tmp` 可写。

**一个最小的 Hugging Face transformers 包装器：**

```python title="method/translate.py"
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
RUN pip install --no-index --find-links=/wheels torch transformers sentencepiece
# Weights are NOT copied — /method is mounted read-only at run time.
```

使用以下方式提交：

```bash
mt-eval contest submit-method <contest-slug> \
  --method-dir ./my-method --dockerfile ./Dockerfile \
  --name "My NMT" --version 1.0 \
  --entrypoint method/translate.py \
  --method-class pipeline --paradigm neural-nmt \
  --developer "Your Name" --node-id <organizer-advertised-node-id> \
  --agree
```

（你需要先为竞赛发布一条假设通道记录——第 9 步的 T1 门——`--agree` 确认方法提交条款。）

**多 GB 权重：使用sneakernet 通道。** 托管摄入路径将你的 tarball 作为**单个 POST** 上传到竞赛主机的存储，所以它受该主机的存储上传限制——对代码和小模型没问题，对多 GB 检查点不行。包契约本身允许更大的工件（tarball 最大 100 GB，构建镜像最大 150 GB）。对于大权重，跳过托管上传：

```bash
# Package + write an exchange directory, no upload:
mt-eval contest submit-method … --offline --bundle-out ./exchange \
  --secret-set <sealed-set-id> --pair eng>crk --developer-email you@example.org
```

交换目录通过可移动媒体（或任何你们都信任的通道）传送给组织者；他们使用 `mt-eval node import-bundle` 摄入它。包的 SHA-256 无论如何都被冻结到授权请求中，所以运行的东西可以证明是你提议的东西。

**组织者：在离线机器上预加载基础镜像。** 因为镜像构建使用 `--network=none` 运行，Dockerfile 的 `FROM` 基础镜像必须已经在机器的本地镜像存储中。在连接的机器上，`docker pull python:3.11-slim && docker save -o base.tar python:3.11-slim`；使用包携带 `base.tar`；在离线机器上，在运行 `mt-eval node run-method` 之前 `docker load -i base.tar`。在你发布的竞赛材料中与参与者就基础镜像达成一致。

## 第 10 步——发布分数，根据您发布的阈值进行奖励

仅分数结果像任何其他运行一样发布到[排行榜](/docs/network/leaderboard/rules)，标记为密封集合评估。如果方法清除了您在第 6 步中发布的阈值条件——包括[使用者验证](/docs/network/specifications/speaker-validation)，这是您社区的门，而不是自动的——**您**（或您的信托）根据您自己发布的条款奖励奖金。Champollion 的角色在测量处结束。

---

## 您永远保留的内容

- **语料库。** 它永远不会离开您的基础设施。将密文离线，密封集合就停止可运行。
- **密钥。** 当您的监管人停止授予访问权限时，访问权限就会消失。
- **资金。** 它从未在其他任何地方。
- **记录。** 审计日志的头摘要是可发布的，因此谁针对您的语料库运行了什么的历史无法被悄悄重写——由任何人，包括我们。

对于您可以调整的条款语言——所有权、仅分数许可和竞赛可能受到攻击的方式的明确说明——参见[条款模板](/docs/network/sovereignty/terms-templates)。
