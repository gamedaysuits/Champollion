---
sidebar_position: 0
title: "提交到索引"
description: "提交数据集、资源、方法、人工翻译服务或外部结果——或提出语言卡片修正建议。所有提交内容均由人工审核其知识产权、许可证及主权合规性——绝不自动通过。"
related:
  - label: "Submit a Method"
    to: /docs/network/getting-started/submit-a-method
    kind: guide
    note: "Already have a benchmark run? Publish the run card instead."
  - label: "Registering Corpora"
    to: /docs/network/sovereignty/registering-corpora
    kind: guide
    note: "Exposure tiers for corpora you own"
  - label: "Data Sovereignty"
    to: /docs/network/sovereignty/data-sovereignty
    kind: doc
  - label: "Honest Limitations"
    to: /docs/network/honest-limitations
    kind: doc
---

# 提交到索引

> **执行摘要。** 为 Champollion 索引提议添加内容——一个基准、一项资源、一种翻译方法、人工翻译服务，或已发布的外部结果。你提交一份简短的结构化表单（在浏览器中或从 CLI）；**维护者在手动审查每份提交**，检查知识产权、许可证和社区/主权合规性，然后才会添加任何内容。**没有任何内容会自动批准。**

索引是共享地图：方法进行基准测试的数据集、帮助翻译的词典和工具、方法本身、手工翻译的人员，以及他人已发布的结果。任何人都可以提议添加内容。因为这是语言社区的基础设施，每份提议都必须先通过人工审查关卡。

---

## 你可以提交什么

| 类型 | 定义 | 我们添加的内容 |
|---|---|---|
| **基准 / 数据集** | 评估语料库或基准 | 元数据卡片 + *源头获取* 指针 —— 绝不包含语料库实际内容 |
| **资源** | 词典、档案库、应用程序、FST（形态分析器）或工具 | 包含指针 + 访问级别（开放 / 受限 / 需获同意）的列表条目 |
| **翻译方法** | 机器翻译引擎、LLM 提供商或流水线 | 方法注册表（method-registry）条目，以便运行和进行基准测试 |
| **人工翻译服务** | 选择加入的社区办公室、机构或独立译员 | 按语对列出的条目（联系方式保持带外传输 —— 绝不出现在公开 issue 中） |
| **外部公开发表的结果** | 由其他系统或论文报告的分数 | **引用** —— 外部结果仅作引用，绝不重新托管或作为我们自己的测量结果重新排名 |
| **语言卡片更正** | [语言卡片](/catalogue)上的内容存在错误、过时或遗漏 —— 例如使用人数估算、状态、书写系统或未列出的资源 | **在数据源应用的附带引用的修复**（卡片由程序生成，因此更正会持久生效）；当来源存在分歧时，卡片会同时展示所有来源并注明出处 |

每张语言卡片都带有一个 **“建议更正或补充”** 链接，
点击后将打开已预填该语言的更正表单。

**社区删除和限制请求。** 如果您是社区成员或权威代表，希望对关于您语言的数据进行限制或删除，请使用更正表单（如果您希望保持非公开，也可以通过带外方式联系维护者）。这些请求将享有优先处理权，进入[主权审查](/docs/network/sovereignty/data-sovereignty)流程 —— 无需提供引用证明。

---

## 审查如何进行

这是重要的部分：**提交由人工审查，而不是机器人。** 当你提交时，你打开一个 GitHub 问题。该问题是审查队列。维护者阅读它并根据项目规则检查它，然后才会添加任何内容：

- **知识产权与许可证。** 我们必须获得列出该内容的许可。非商业性、禁止再分发或许可证不明确的材料仍可被*编入目录*，但将被隔绝在任何商业 / 竞赛 / 公开获取通道之外。
- **社区与主权。** 原住民和社区语言数据仅在获得社区同意的情况下列出。在提供者或保管人确认之前，绝不公开提及他们的姓名或名称。
- **我们绝不托管语料库内容。** 数据集仅以元数据及指向数据获取来源的指针形式列出。**请勿在提交内容中粘贴源句/参考句。**
- **禁止个人数据。** 公开 issue 中不得包含电子邮件、电话号码或其他个人身份信息（PII）。对于人工翻译服务，联系方式需通过带外方式提供给维护者。
- **范围限制。** 圣经 / 礼拜仪式及其他带有殖民强加性质的语料库不在收录范围内，将被拒绝。

每个表单都以必需的证明结尾：

> *"我确认这是可公开列出的，不包含任何语料库内容或个人数据，并尊重源的许可证和任何社区/主权限制。"*

---

## 两种提交方式

### 从浏览器

打开问题选择器并选择与你要提交的内容相匹配的表单：

➡️ **[在 GitHub 上打开提交表单](https://github.com/gamedaysuits/Champollion/issues/new/choose)**

每个表单仅询问匹配索引所需的内容（名称、语言/语言对、许可证、源 URL 等）和证明复选框。

### 从 CLI

如果你有 [champollion CLI](/docs/network/getting-started/submit-a-method)，`champollion submit` 收集字段并为你提供相同 GitHub 表单的**预填充**版本：

```bash
# Interactive — pick a type and answer the prompts
champollion submit

# See the submission types
champollion submit --list

# Fully scripted (prints a pre-filled GitHub issue URL)
champollion submit --yes --type dataset --attest \
  --field dataset-name="GlobalVoices eng-amh" \
  --field pairs=eng-amh \
  --field license=CC-BY-4.0 \
  --field source-url=https://globalvoices.org
```

CLI 打印一个 URL——打开它，在浏览器中审查证明，然后提交。添加 `--out submission.json` 也可以保存你正在提议的内容的本地、无内容副本。CLI 本身从不上传任何内容，也从不写入索引。

---

## 提交后会发生什么

1. 你的提交作为 GitHub 问题到达——审查队列。
2. 维护者根据上述知识产权 / 许可证 / 主权规则审查它。
3. **如果接受：** 维护者通过正常更改将条目添加到相关的真实来源（数据集注册表、卡片、方法或人工服务注册表，或外部结果目录），并用**已接受**标签标记问题。
4. **如果它不能按原样列出：** 维护者用**已拒绝**标签标记它（或要求更多信息）并说明原因。

没有自动合并，也没有自动发布。每次都由一个人做出决定。

---

## 另请参阅

- [提交方法](/docs/network/getting-started/submit-a-method) ——已经有基准运行？直接发布运行卡。
- [注册语料库](/docs/network/sovereignty/registering-corpora) ——你拥有的语料库的曝光层级（本地 / 私有 / 公开 / 密封）。
- [数据主权](/docs/network/sovereignty/data-sovereignty) ——语言社区数据控制在这里如何工作。
- [面向语言社区](/docs/network/community/for-language-communities) ——伙伴关系、同意和密钥保管。
