---
sidebar_position: 1
title: "提交方法"
related:
  - label: "Method Interface"
    to: /docs/network/specifications/methods
    kind: spec
    note: "The contract your method implements"
  - label: "Run Card Specification"
    to: /docs/network/specifications/run-card
    kind: spec
    note: "What every published run must disclose"
  - label: "MT Evaluation Rules"
    to: /docs/network/leaderboard/rules
    kind: doc
  - label: "Cookbook: Few-Shot Prompting"
    to: /docs/network/tutorials/few-shot-prompting
    kind: cookbook
    note: "The fastest first method to submit"
  - label: "Agent Guide: Building & Benchmarking on the Network"
    to: /docs/network/getting-started/agent-guide
    kind: guide
---

# 提交方法

> **执行摘要。** 分步快速入门指南，用于向排行榜提交您的第一次基准测试运行。安装测试框架，针对数据集运行它，查看您的运行卡，然后发布。如果您有 API 密钥，需要 10 分钟。

本指南将引导您完成向 Network 排行榜提交第一次基准测试运行的过程。

---

## 前置条件

- **Python 3.11+**
- **一个 OpenRouter API 密钥**（或您的模型提供商的等效密钥）
- **一个翻译方法** — 任何能从源文本生成翻译的方法

```bash
# Install the eval harness (provides the `mt-eval` command)
pip install mt-eval-harness
```

---

## 步骤 1：运行测试框架

测试框架针对标准化数据集对您的方法进行评分：

```bash
mt-eval run \
  --corpus eval-amh-fra-globalvoices-test-v1 \
  --model gemini-pro \
  --name your-method-name \
  --temperature 0.2
```

| 标志 | 功能 |
|---|---|
| `--corpus` | 语料库文件路径或已注册的语料库 id（`.json`、`.jsonl`、`.tsv`） |
| `--model` | 模型 slug — 短别名（例如 `gemini-pro`）或完整 OpenRouter ID |
| `-n, --name` | 运行的人类可读标签（显示在排行榜上） |
| `--temperature` | 采样温度（较低 = 更具确定性） |
| `--fst-retries` | 可选：FST 重试尝试次数 |
| `--publish` | 运行完成时将运行卡发布到排行榜 |

测试框架生成一个**运行卡** — 一个自包含的 JSON 文件，包含您的分数、数据集哈希、模型 slug 和一个将结果与确切实验配置绑定的密码学指纹。

---

## 步骤 2：查看您的运行卡

运行卡保存到 `eval/logs/harness/`。在提交前检查您的卡：

```bash
cat eval/logs/harness/your-run-card.json | python -m json.tool
```

要检查的关键字段：
- `scores.chrf_plus_plus` — 您的主要质量指标
- `scores.exact_match_rate` — 完美翻译的比例
- `scores.fst_acceptance_rate` — 形态学有效性（如果使用了 FST）
- `totals.total_cost_usd` — 运行的成本
- `fingerprint` — 实验的可重现性哈希

查看[运行卡规范](/docs/network/specifications/run-card)了解完整架构。

---

## 步骤 3：提交

### 自动发布

如果您在运行测试框架时传递了 `--publish`，您的运行卡已经上传。

### 手动发布

使用测试框架发布任何运行卡：

```bash
mt-eval publish eval/logs/harness/your-run-card.json
```

如果您不想使用发布流程，请向
[eval harness 仓库](https://github.com/gamedaysuits/Champollion)
提交拉取请求，在 `results/` 目录中包含您的运行卡 JSON。

:::note[提交 API 和网页上传尚未上线]
`POST https://champollion.dev/api/leaderboard/submit` 端点和排行榜上传 UI 已规划但**尚未实现**。在它们发布之前，唯一可用的提交路径是 `mt-eval publish` 和向上述 harness 仓库提交拉取请求。
:::

---

## 接下来会发生什么

1. 您的提交将经过验证（数据集哈希值、运行卡完整性）
2. 结果将显示在排行榜上，标记为 **自我评测**（信任层级 1）
3. 若要获得 **Champollion 认证** 状态，请将您的方法作为可安装的插件提交，以便维护者能够复现您的结果
4. 对于原住民语言方法：如果您的方法达到榜首，[所有权转移](/docs/network/sovereignty/ownership-transfer)流程即会启动

---

## 另请参阅

- [测试框架使用](/docs/network/specifications/harness) — 完整 CLI 参考
- [排行榜规则](/docs/network/leaderboard/rules) — 提交标准和反作弊政策
- [构建方法](/docs/network/specifications/methods) — TranslationMethod 协议
- [数据集](/docs/network/leaderboard/datasets) — 可用的评估数据集
