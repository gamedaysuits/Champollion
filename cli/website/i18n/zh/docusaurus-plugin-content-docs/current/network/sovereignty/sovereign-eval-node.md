---
sidebar_position: 9
title: "主权评估节点 —— 硬件与物理隔离操作"
description: "运行社区控制的评估节点所需的参考硬件、物理隔离规范和密钥保管操作：秘密测试集绝不离开您的机器；让方法走向数据。"
related:
  - label: "Run a Sovereign Contest"
    to: /docs/network/sovereignty/run-a-sovereign-contest
    kind: doc
    note: "The organizer workflow this node runs"
  - label: "The Derived-Artifacts Commitment"
    to: /docs/network/sovereignty/derived-artifacts
    kind: doc
    note: "Who owns what comes out: you"
  - label: "Benchmark Specification §8 (sandbox)"
    to: /docs/network/specifications/benchmark
    kind: doc
    note: "The isolation model the executor implements"
---

# 主权评估节点 —— 硬件与物理隔离操作

主权评估节点是一台由**你**控制的机器，它保存着一个秘密的测试集，并据此对翻译方法进行评估。方法向数据靠拢；数据绝不离开。只有分数——且仅仅是分数——会被输出。

本页面是实用的规范说明：购买（或重新利用）什么硬件、如何进行设置，以及如何通过操作规范让“测试集从未离开过机器”成为一个你可以捍卫的事实，而不是一个你必须去相信的承诺。

:::info[今日已交付功能与进行中标注功能对比]
组织者节点软件**今日已在 `mt-eval` 中交付**——请参阅
[主权竞赛指南](/docs/network/sovereignty/run-a-sovereign-contest)：
竞赛准备与封装、在**要求任何保管人批准任何内容之前，由节点本身对每个参赛条目重新执行**的公共资格门禁、门限门控评分，以及带有导入扫描的网络隔离方法执行器。节点接受的内容是**模型或方法**——即它可以运行的工件。上传公开来源盲测集的翻译已于 2026-09-06 作为竞赛参赛途径退役，该动词已被删除；公开来源轮次仅作为可选的组织者诊断手段保留，而自报分数属于开放排行榜，该排行榜是一个按语料库和语对方向索引的公开看板，而非竞赛。
**§4 的门限密钥仪式与静态封存工作流也已于今日交付**：`mt-eval node ceremony init|share|verify|restore`、`mt-eval node
seal`、运行时出示的法定份额
（`node run-method --offline --share …`）、基于哈希链的本地授权账本（`node ledger verify|head`）、签名的分数清单
（`node sign-manifest` / `node verify-manifest`），以及 §2–§3 的气隙工具（`node bundle`、`node manifest`、`node egress-check`）。分数捆绑包**在节点上通过 Python** 进行签名——离线捆绑包无需 Node.js 运行时——且相同的分离签名格式可通过任一实现进行验证。组织者侧的**请求暂存也已交付**：
`mt-eval node stage-request` 无需任何数据库即可从捆绑包文件中写入与在线中继完全相同的交换请求（用于演练，或从未连接网络的部署），该请求已按照导入时的验证方式进行预验证，并绑定到节点的 ID；返回的分数可通过清单进行验证，但不会由中继发布，因为不存在可据以发布它们的授权记录。单密钥对替代方案仅保留用于组织者完全持有参考译文的竞赛——每个界面均会标注当前使用的泳道。简而言之，v1 版**不**包含以下内容：未声明硬件远程证明（TEE）（§5），并且平台侧门限*签名*（保管人针对托管基础设施进行手机审批）属于后续工作——在主权节点上，保管权是通过在机器上物理出示 N 份中的 M 份份额来行使的（§4）。更准确地说明密码学细节：这是 Shamir M/N 秘密共享，密钥在**授权运行期间于节点的锁定内存中重构**（随后清零）——这*不是*安全多方计算（MPC），并且该密钥确实会在您的离线机器上短暂以组装状态存在。最后，在社区同意门禁开启之前，该泳道**仅针对合成数据**运行；真实语料库需等待该同意。
:::

## 1. 参考硬件

执行器运行自包含的方法：本地 NMT 解码、FST/形态学验证以及指标计算。在物理隔离环境中不会发生任何云端调用（LLM-API 方法正是物理隔离节点所拒绝的类别——参见[基准测试规范的](/docs/network/specifications/benchmark)方法类别）。

| 层级 | 规格 | 适用场景 | 粗略成本 (2026) |
|---|---|---|---|
| **最低配置** (可用) | 4 核 x86_64 或 Apple/ARM，16 GB RAM，500 GB SSD | 指标 + FST 评估，小型 NMT 模型的 CPU 解码（慢但正确） | 0 美元（闲置笔记本） – 400 美元（二手） |
| **推荐配置** | 8 核，32 GB RAM，1 TB NVMe，NVIDIA GPU ≥ 12 GB VRAM（例如 RTX 4070 级别） | 针对完整测试组的舒适 NMT 解码；并行方法评估 | 约 900–1,600 美元（小型工作站） |
| **机构配置** | 16 核，64–128 GB RAM，2 TB NVMe，24 GB+ VRAM | 多方法竞赛，大型测试组，归档密文存储 | 约 2,500–4,000 美元 |

所有层级的硬性要求：

- **无无线电，或你能证明已关闭的无线电。** 最佳：没有 Wi-Fi/蓝牙网卡的台式机。可接受：物理移除无线网卡或在固件中禁用的笔记本电脑。“飞行模式”不是物理隔离。
- **可以保持拔出状态的有线网卡（NIC）。** 网线的缺失是目前最具可审计性的网络控制手段。
- **两个专用的 USB 驱动器**（标记为 IN 和 OUT —— 见第 3 节），理想情况下，在固件中禁用机器的其他端口。
- **全盘加密**（Linux 上的 LUKS），这样被盗的节点就只是一块砖头；如果你的电源不可靠，还需要一个 UPS —— 在测试组中间中断的评估是可以恢复的，但没必要去冒这个险。

## 2. 软件设置（一次性，约一小时）

1. 在**拔掉网线**的情况下，通过 USB 安装介质安装当前 Linux LTS（Ubuntu/Debian）；在安装时启用全盘加密。
2. 在已安装 harness 的另一台联网机器上
   （`python3 -m pip install mt-eval-harness`，0.2.0 或更高版本），构建离线捆绑包。
   `mt-eval node bundle --out <dir>` 执行四项操作：
   - 将已安装的 harness 及其依赖项打包为 wheel（或通过 `--wheel <file>` 指定特定 wheel）；
   - 根据 harness 内部附带的哈希固定列表获取加密库；
   - 复制所有 `--include` 工件；
   - 为每个文件写入 sha256 清单。

   包含节点将评分的每种语言的**语言卡片**
   （`--include <cards-dir>`）：节点从本地卡片索引中命名运行的语言对，绝不会在线拉取。两个已安装的包均不自带每语言卡片目录，因此请在此处使用 `champollion`
   CLI 写入，每种语言对应一个 `<code>.json`（`champollion network card eng --json >
   node-cards/eng.json`，然后对另一种语言执行相同操作），并传递
   `--include node-cards`。在节点上，它位于
   `<dir>/artifacts/node-cards`；将 `cards_dir` 指向此处。节点所需的一切只需通过 IN 驱动器传输一次。请在与节点运行相同的 Python 版本（3.11 或 3.12）上构建；固定列表会拒绝任何其他版本。
3. 通过 IN 驱动器传输捆绑包；在安装之前，**在节点上**针对清单验证每个工件的 sha256
   （`mt-eval node bundle --verify <dir>`）。然后仅从捆绑的
   wheel 安装：
   `python3 -m pip install --no-index --find-links <dir>/wheels 'mt-eval-harness[node]'`。
   `[node]` 额外组件是 `mt-eval node
   keygen` and the custody ceremony need; a plain `mt-eval-harness` 安装缺少它时所需的 `cryptography` 库。
4. 创建节点的签名密钥对（`mt-eval node keygen`）并记录其公钥部分——您将发布该公钥，以便任何人都可以验证您的分数清单（§5）。
   节点还需要 **Docker**（或 Podman），用于在无网络容器中运行每个提交的方法；如果 `PATH` 上两者皆无，`mt-eval node run-method` 会单行报错指出两者缺失，且请求保持可运行状态。它还需要位于
   `~/.mt-eval/node.json` 的节点配置。该文件指定了节点名称、卡片目录
   （`cards_dir` 或 `MT_EVAL_CARDS_DIR`）以及它所服务的竞赛。
   `mt-eval node init` 会写入一份入门配置，其中包含评分节点读取的每个键，包括公共资格门禁（`qualifier` + `dev_corpus`，节点在打开封存集之前会针对每个方法重新运行该门禁）以及封存保留集的槽位（`holdout_set_id` + `holdout_corpus`；对于没有保留集的竞赛，可删除它们）。
   `mt-eval node init --from-contest <out>` 会根据 `contest prepare` 写入的清单填充竞赛的值（映射关系见[主权竞赛指南](/docs/network/sovereignty/run-a-sovereign-contest#organizer-prerequisites)）。
   其 `sandbox` 块为节点的资源策略（4 GB RAM、4 GB 暂存空间、每次运行 30 分钟、无 GPU），且 `contest submit-method` 默认声明的正是这些值，因此若对其进行修改，请随竞赛一同发布您的资源上限。
   若节点配置仅声明了该门禁的一半，将在启动时被拒绝。
   `mt-eval node ledger verify` 会检查填写完成的文件：一旦发现残留的 `<...>` 值或节点上不存在的声明文件，便会立即拒绝并报错，打印检查内容，然后重放本地账本的哈希链。向节点中继请求的联网机器还需要数据库的 **service-role 密钥**（`MT_EVAL_SUPABASE_SERVICE_KEY`）。处于气隙隔离状态的节点本身绝不需要该密钥。
5. 从此时起，该机器绝不接入网络——并且可以先通过一次封存运行来进行验证：当路由、探测或 DNS 显示存在任何外连途径时，`mt-eval node egress-check`（在节点配置中通过 `assert_airgap` 自动强制执行）将拒绝执行。操作系统更新是一项经过深思熟虑、打包且经过哈希验证的事件，而非后台服务。

## 3. 传输规范（每次竞赛，双向）

物理隔离是一个*流程*，而不是一个产品。该流程如下：

- **IN 驱动器**携带：提交的方法或模型捆绑包及其清单。在运行任何内容之前，节点会针对清单验证每个包的哈希值，并运行导入扫描（它会拒绝导入网络库的方法——此功能现已交付）。
- **OUT 驱动器**携带：签名的分数清单——总评分、所属的方法/配置哈希、审计日志头——以及*仅此而已*。每分段输出保留在节点上，由组织者控制；发布这些输出是一项由社区独立且审慎做出的决策。
- 每个驱动器始终保持单向流动。接触过节点的驱动器绝不能在联网机器上自动挂载——请以 `noexec,nodev` 方式挂载，并手动复制出清单。
- `mt-eval node manifest write <drive> --direction in|out` 在过境传输前计算驱动器上每个文件的哈希；接收端的 `mt-eval node manifest verify` 会拒绝任何新增、更改或缺失的内容。
- 在节点的纸质记录或节点本地日志中记录每一次过境传输（日期、驱动器、清单哈希）。枯燥正是其意义所在：日志能让您用证据回答“是否有其他任何东西被带出？”。

## 4. 密钥保管（M-of-N，社区持有）

封存测试集在静态状态下已加密；解密需要由**社区选定的**保管人（如长者委员会、语言管理机构、教育机构）所持有的密钥份额达到法定人数。该设计确保平台不持有任何份额，因此 Champollion 无法解密封存集，任何单一保管人也无法单独解密。下文所述的仪式尚未在真实保管人参与下运行。

仪式（一次离线会议；已发布的工具使其自动化）：`mt-eval node ceremony init` 在节点上生成集合密钥，将其拆分为 N 个份额（任意 M 个即可重建；少于 M 个则无法泄露任何信息 —— 这种共享是信息论安全的），并同时将密钥清零；`ceremony share` 将每个保管人的份额输出为令牌文件以及可打印的纸质备份；`ceremony verify` 证明分发的副本可以重建 —— 而不持久化任何内容；`ceremony share --wipe-originals`` then destroys the node's own copies. ``mt-eval node seal` 使用仪式的公钥对语料库进行加密：节点仅存储密文和无内容的元数据卡，仅此而已。从那时起，运行评估意味着保管人必须物理提供 N 个份额中的 M 个（`node run-method --offline --share …`）：密钥**仅在执行器的锁定内存中**重建，用于那次受授权绑定的运行，然后清零 —— 它绝不会再次接触磁盘。每一次请求、投票、授权和使用都会附加到哈希链式本地账本（`node ledger verify`）中，没有达到法定人数的尝试将被拒绝*并*记录。

关于该机制的一句实话：这是 Shamir 秘密共享，在社区持有的离线机器的内存中进行重建 —— 而不是多方计算。在授权运行期间，密钥会在社区物理控制的硬件上短暂地组装存在；它所捍卫的属性是*磁盘上没有常驻密钥*、*没有法定人数在场就无法运行*，以及*每次使用都链入可检查的账本中*。平台侧的阈值签名（密钥永远不会在任何地方组装）仍然是未来的工作，并在提及它的任何地方都作了相应标记。

轮换和保管人更换需要重新运行仪式；丢失超过 N−M 个份额意味着该集合需要从社区的源副本重新密封 —— 社区始终保留其自己的明文原件，因为[所有权](/docs/network/sovereignty/data-sovereignty)从来都不属于我们。

## 5. 这里的“证明（attested）”意味着什么 —— 以及不意味着什么

每次评估都会生成一个**签名的分数清单**：节点对分数、方法包哈希、语料库校验和以及仅追加审计日志头部的签名。任何持有节点已发布公钥的人都可以验证它 —— `mt-eval node verify-manifest <manifest> --pubkey <published .pub.json>` —— 证明*这个节点*针对*这些确切的输入*生成了*这些分数*，并且哈希链式日志使得悄悄篡改历史记录的行为变得可被检测。

这就是**软件证明** —— 它证明了记录的完整性，这也是 v1 版本所提供的。它**不**证明是哪块芯片执行了该运行：硬件远程证明（TEE）是未来的工作，并且被刻意声明为不包含在内。v1 版本的诚实安全声明是：组织者的规范（第 3 节）加上签名的清单，再加上社区对机器的物理保管，构成了信任锚点 —— 这也正是主权优先设计希望信任所在的地方。

## 6. 操作循环

1. 公布竞赛；发布节点的公钥 + 开发集门限。
2. 在线接收提交内容（普通机器），组装 IN 清单（`mt-eval node manifest write <drive> --direction in`）。
3. 将 IN 驱动器带到节点；验证哈希（`node manifest verify`）；
   import-scan (`node import-bundle`); queue methods. An entrant's offline
   提案以*待定（pending）*状态到达。节点首先对其进行检查（`node run-method <id> --offline` 在公共开发集上重新执行参赛者的资格门禁代码，并在存在代码参赛条目时检查容器运行时，不打开任何封存内容，并在本地账本中记录通过项）。然后由保管人在节点上记录决定（`node approve <id> --offline --actor <custodian>`，在该检查通过前会被拒绝，或 `node deny … --offline --reason …`：在本地账本中进行投票 + 授权，并生成由节点密钥签名的记录；`node list --offline` 显示等待的内容）。在记录并验证该批准之前，封存运行（再次执行 `node run-method --offline`）会拒绝待定提案。
4. 保管人通过出示法定份额来授权运行（§4 — `node run-method <id> --offline --share … --share …`）；封存集仅解密到执行器中。没有达到法定人数，就不运行——并且该尝试会被记录在账本上。
5. 执行；计算分数；每分段输出保留在节点端。
6. 清理：擦除工作明文；追加审计日志；对清单进行签名。
7. 将 OUT 驱动器带回；发布分数 + 清单；任何人均可验证（`node verify-manifest`）。
8. 记录过境传输；驱动器保持专用；节点保持离线断网。
