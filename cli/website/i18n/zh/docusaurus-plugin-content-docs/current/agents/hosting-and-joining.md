---
title: "举办密封测试与加入项目"
slug: /agents/hosting-and-joining
description: "除了自行构建之外的两种参与途径：使用 mt-eval contest 与 mt-eval node 举办密封测试（功能可用，目前尚未纳入轨道，密钥分片由组织者选定的保管人持有），以及使用 mt-eval project 加入已注册的项目——详解每条命令、其发送的内容与目的地，以及它绝不会展示的信息。"
---

# 举办封存测试与加入项目

构建轨道旁的两个通道。两者都是纯粹的 `mt-eval` 命令；都不是 `champollion next` 命名的步骤。

## 举办封存测试

**真实状态。**

- 功能可用：准备封存数据集、密钥仪式（key ceremony）、在气隙（air-gapped）节点上运行参赛方案、裁决与排名，均是带有测试的命令。
- **它尚未接入自动化轨道。** `champollion new --kind task` 会被拒绝；
  目前唯一的流程是语言旅程。请做好手动步骤较长的准备，并
  遵循[竞赛操作手册](/docs/network/sovereignty/run-a-sovereign-contest)。
- **密钥分片由组织者指定的保管人持有。** 代码中没有任何逻辑来
  任命或审核他们。目前尚未针对任何测试任命过社区密钥保管人。
- **Champollion 不持有任何密钥分片和私钥。** 仪式在组织者的
  机器上运行，注册时仅发送标识符、摘要以及资格门槛——绝不会发送密钥、分片或语句。

**注意。** 举办封存测试决定了人们的语句会经历什么，以及谁能够解锁它们。以下每一步都是组织者的决定；仅在他们提出要求时才运行对应步骤。

### 生成的内容

`mt-eval contest prepare` 会对组织者的语料库进行切分：

| 标志 | 数据集 | 谁能查看 |
|---|---|---|
| `--dev-size`（必选） | 资格赛集：源文本与参考译文 | 公开，从 `<out>/public/` 发布 |
| `--secret-size` | 竞赛注册所针对的封存测试集 | 任何人均不可见：封存在 `<out>/local/` 中 |
| `--sealed-holdout-size`（需要 `--secret-size`） | 第二个封存切分集，计分但保留至竞赛结束 | 任何人均不可见 |

`--seed`、`--qualifier-threshold`（大于 0）以及 `--license` 均为必填项——系统不预设任何许可证。`--custodian-group` 和 `--threshold-pubkey` 是必需的（封存数据集加密所针对的密钥）。每个封存数据集的明文在封存后都会被删除；`<out>/local/manifest.json` 保存处理配方且绝不离开本机。封存操作会运行 `champollion network seal-corpus seal`，因此必须安装 `champollion` CLI。

### 保管

**门限保管（M-of-N）。** 在气隙节点上：

```bash
mt-eval node ceremony init --dir <ceremony> --set <sealed set id> --group <group id> --quorum 3 --shares 5 \
  --custodian <name 1> --custodian <name 2> --custodian <name 3> --custodian <name 4> --custodian <name 5>
mt-eval node ceremony share --dir <ceremony> --custodian <name 1> --dest <their token>
mt-eval node ceremony verify --dir <ceremony> --share <a> --share <b> --share <c>
mt-eval node ceremony share --dir <ceremony> --wipe-originals
```

`init` 在单次调用中生成密钥、使用 Shamir 方案进行分片并将其清零；它会写入 `ceremony.json`（公开记录）以及每个保管人一个分片文件。`--set` 必须是机密数据集的 ID，且 `--group` 必须与 prepare 将使用的 `--custodian-group` 一致——prepare 不会检查它们，只有在运行被拒绝时才会发现不匹配。将仪式的记录提供给 prepare：`--threshold-pubkey <ceremony>/ceremony.json`。

**锁定。** 封存数据集仅能通过 `mt-eval node run-method <id>
--offline --share … --share …` 解密，且必须提供至少 M 个来自 ID 与该数据集匹配的不同保管人的分片。门限保管仅在此离线通道上运行。

**单一密钥。** `champollion network seal-corpus keygen --out <dir>` 会生成一对密钥对；持有其密钥文件的人均可单独解密。联网节点通道采用的就是这种方式。

### 组织者操作步骤（门限保管）

```bash
mt-eval node bundle --out <bundle>                    # on a connected machine: the node's install
mt-eval node bundle --verify <bundle>                 # on the node
mt-eval node keygen --out <keys>
# the ceremony, above
mt-eval contest prepare --corpus master.json --slug <slug> --name "<name>" --pair '<src>><tgt>' \
  --dev-size <n> --secret-size <n> --seed <n> --qualifier-threshold <chrF++> --license <licence> \
  --custodian-group <group id> --threshold-pubkey <ceremony>/ceremony.json --out ./<slug> --no-register
mt-eval contest register --manifest ./<slug>/local/manifest.json
mt-eval node init --from-contest ./<slug>
mt-eval node egress-check
mt-eval node import-bundle <exchange>                 # entries, carried in
mt-eval node run-method <request id> --offline --share <s1> --share <s2> --share <s3>
mt-eval node export-scores <exchange>
mt-eval node verdicts --contest <slug> --out verdicts.json --metric chrf_plus_plus --tie-test ar \
  --alpha <a> --n-resamples <n> --seed <n>
mt-eval contest rank <slug>
mt-eval contest close <slug> --node-verdicts verdicts.json --verify-key <score-signing public key>
```

当数据集已针对仪式密钥封存时，`node init --from-contest` 会设置门限保管。参赛者在公开开发集上获取资格（`mt-eval contest
qualify`) and submit methods or models (`mt-eval contest submit-method`，
`mt-eval contest submit-model`，两者均带有一个 `--offline --bundle-out` 路径）。
[节点指南](/docs/network/sovereignty/sovereign-eval-node)中包含全部节点命令。

### 哪些操作需要联网，以及使用谁的连接

| 离线可用 | 需要登录 | 需要数据库服务密钥 |
|---|---|---|
| `contest prepare --no-register`, `contest qualify`（附带 `--offline-qualifier-id`, `--offline-threshold`）, `contest validate`, `submit-* --offline`, 所有 `node ceremony`, `node seal`, `node keygen`, `node init`, `node import-bundle`, `node run-method --offline`, `node export-scores`, `node verdicts`, `node egress-check` | `contest register`, `contest create`, 在线 `submit-*`, `contest open-intake`, `contest close-intake`, `contest close` | 不带 `--no-register` 或 `--self-serve` 的 `contest prepare`, `node serve`, `node list`, `node approve`, `node deny`, 在线 `node run-method`, `node relay`, 以及结果被保留时的 `contest close` |

服务密钥归运行数据库的一方所有。外部组织者可以针对自己的数据库运行这些操作（`MT_EVAL_SUPABASE_URL` 及其密钥），或者坚持使用离线通道——离线通道的得分可通过其签名清单进行验证，但不会录入公开榜单。**注意。** 绝不要设置 `MT_EVAL_ALLOW_PROD`：它会解除工具对写入默认生产数据库的拒绝限制，而这不是智能体能决定的事。

## 加入项目

**已注册项目**是指所有者公开列出的语言项目，以便其他人可以通过提供文件进行协助：语句、词表或方法（目前尚不提供评审时间与算力）。下方的 `mt-eval
project` 命令与项目数据库（`MT_EVAL_SUPABASE_URL`）通信。除 `list`（匿名）和 `review`（运维人员专用）外的每个子命令都需要登录（缓存会话、`MT_EVAL_REFRESH_TOKEN`，或交互式 GitHub/Google 登录）；账户即登录所用的电子邮件地址。

**规则。**

- **列出前须经审核。** 新项目初始状态为 `pending_review`；仅在审核后才会列出。所有者可以关闭项目，绝不列出。
- **所有者按其选择署名**（`--owner-name`）。项目数据行不包含电子邮件；所有者的账户分开保存，仅对其本人可读。
- **公开列表中不含电子邮件。** `project list` 为匿名且仅显示名称和数量；`project offers` 按协助者提供的名称打印他们（`--as`）。
  所有者账户仍可在提供记录中读取协助者的账户电子邮件，且同意声明中会记录双方账户。
- **提供的内容由双方共同留存。** 接受提供会写入一份同意声明，注明提交者与授权者。
- **绝不打印文件内容。** 仅输出名称、数量与状态。

### 所有者

```bash
mt-eval project register --project . --name "<project name>" --owner-name "<as they want to be named>" \
  --purpose "<what the translations are for>"
mt-eval project ask <slug> --kind sentences --what "<what would help>" --how-many 200 --terms "<their terms>"
mt-eval project offers <slug>
mt-eval project accept <offer id> --into .
mt-eval project decline <offer id> --why "<reason>"
```

- `register` 从 `champollion.project.json` 中读取语言对（以及用途，除非指定了 `--purpose`）；可选 `--slug`、`--domain`、`--register`、`--about`。
  每个账户每 24 小时最多可注册 5 次。
- `ask` `--kind` 可以为 `sentences`、`word-list` 或 `method`；请求仅在项目处于已列出状态时才会显示。
- `accept` 会下载文件，**验证其 sha256**（不匹配时拒绝），写入 `inbox/offer-<offer id>-<file name>` 与
  `consent/offer-<offer id>.json`（`offer_id`、`file`、`sha256`、
  `submitted_by`、`authorized_by`、`terms`、`note`、`held_by`），然后将提供标记为已接受。之后该文件就像其他文件一样导入——
  `champollion data add inbox/<file>`——并询问其持有人的条款。
- **注意。** 协助者的 `--terms` 包含在同意声明中。你通过 `champollion data mark` 记录的回答绝不能放宽这些限制。

### 协助者

```bash
mt-eval project list
mt-eval project offer <slug> <file> --as "<your name>" --terms "<what it may be used for>" --ask <ask id> --note "<note>"
mt-eval project withdraw <offer id>
```

- `offer` 将一个不超过 50 MB 的非空文件及其 sha256 上传到项目的专用存储中，且仅限已列出的项目。每位协助者每 24 小时最多可提供 24 次。
- 提供仅能流转一次：`offered` → `accepted`、`declined` 或 `withdrawn`。
- **注意。** 撤回或拒绝会改变提供的状态，但不会从存储中删除已上传的文件。在协助者提供任何日后可能想要收回的内容之前，请明确告知这一点。
- **锁定。** `offer` 在上传任何内容前都会读取文件的附属信息文件（sidecar）。它会拒绝 `local-only` 文件、`sealed` 数据集，以及 `speakers_agreed` 为 `not-yet` 或 `some-said-no` 的文件；无法读取的 sidecar 会终止提供流程。不存在任何覆盖绕过机制：标记只能由持有人修改。`training: not-allowed` 条款会添加到提供的条款中，以便所有者查看。
- **注意。** 提供操作会将文件从协助者的计算机发送到项目数据库的存储中。请务必先征得协助者同意，绝不要替他们提供文件。

`mt-eval project review` 归数据库运维人员使用（它使用服务密钥）。它不是智能体可用的命令。

## 深入探索

- [举办封存测试](/docs/host-a-sealed-test)与
  [加入项目](/docs/join-a-project)——面向普通读者的版本。
- [运行主权竞赛](/docs/network/sovereignty/run-a-sovereign-contest)
  与[主权评估节点](/docs/network/sovereignty/sovereign-eval-node)。
- [所有权转移](/docs/network/sovereignty/ownership-transfer)与
  [条款模板](/docs/network/sovereignty/terms-templates)。
- [数据与传输规则](/docs/agents/data-rules)——封存数据集与纯本地文件。
- [`mt-eval` 参考](/docs/reference/mt-eval)。
