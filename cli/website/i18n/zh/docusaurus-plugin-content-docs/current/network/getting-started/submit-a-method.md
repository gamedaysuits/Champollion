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
python3 -m pip install mt-eval-harness
```

---

## 步骤 1：运行测试框架

测试框架针对标准化数据集对您的方法进行评分：

```bash
mt-eval run \
  --corpus eval-amh-fra-globalvoices-test-v1 \
  --model google/gemini-3.1-pro-preview \
  --name your-method-name \
  --temperature 0.2
```

| 选项 | 说明 |
|---|---|
| `--corpus` | 语料库文件路径或已注册的语料库 ID（`.json`、`.jsonl`、`.tsv`） |
| `--model` | 确切的模型 slug —— 完整的 OpenRouter ID（例如 `google/gemini-3.1-pro-preview`）；不接受简短别名和浮动 ID（`…-latest`）。搭配 `--method <plugin dir>` 使用时，作为 `config.method_model` 传递给插件的模型（可使用插件支持的任何命名方式） |
| `-n, --name` | 本次运行的人类可读标签（显示在排行榜上） |
| `--temperature` | 采样温度（越低 = 确定性越高） |
| `--fst-retries` | 可选：FST 重试尝试次数 |
| `--publish` | 运行结束时将运行卡片发布到排行榜 |

测试框架生成一个**运行卡** — 一个自包含的 JSON 文件，包含您的分数、数据集哈希、模型 slug 和一个将结果与确切实验配置绑定的密码学指纹。

---

## 步骤 2：查看您的运行卡

每次运行都会向 `eval/logs/harness/` 写入两个文件：运行日志 `<run-id>.json`
以及评分报告 `<run-id>_report.json`。需要发布的是该报告。
首先对其进行检查：

```bash
python -m json.tool eval/logs/harness/<run-id>_report.json | less
```

报告中 `overall` 块的关键字段：
- `corpus_chrf` —— 语料库级别的 chrF++（0–100），主要指标兼排名指标。其 95% bootstrap 置信区间（CI）为 `confidence_intervals.corpus_chrf`，其 sacreBLEU 签名（signature）为 `sacrebleu_signatures.chrf`
- `scoring_standard`（`"standard/1"`）和 `primary_metric`（`"chrf_plus_plus"`）—— 报告评分所依据的标准
- `corpus_bleu`、`corpus_spbleu`、`corpus_ter` —— 其他标准指标，与 chrF++ 并列展示，绝不与其混合
- `exact_match_rate` —— 诊断指标：完全正确翻译的比例
- `confidence_intervals` —— 上述指标的 bootstrap 置信区间
- `total_cost_usd` —— 运行成本（当模型没有公开价格时为 `null`，例如本地模型；绝不会报告为 $0）

报告还会以指针形式记录向模型提供的内容（`instructions`：指导文件的名称和 SHA-256、系统提示词的 SHA-256，以及完整文本所在的位置 —— 即你机器上的运行日志）。提交到排行榜的运行卡片便是由该报告组装而成的。它添加了方法卡片和可复现性指纹，并以相同的 chrF++ 和 CI 开头；其 `composite` 与 `quality_tier` 均为 `null`，因为两者均已[停用](/docs/network/specifications/scoring#how-runs-are-scored)。（在该标准出台之前编写的报告可能包含 `published_composite`；这是一个遗留的综合指标，现已停用，绝不与 chrF++ 进行对比。）
`mt-eval publish <report> --dry-run` 会打印出与发布时完全一致的卡片内容。有关其模式结构，请参阅[运行卡片规范](/docs/network/specifications/run-card)。

---

## 步骤 3：提交

发布操作会写入**实时**排行榜，因此需要显式传入 `--prod` —— 如果缺少该参数，测试框架将拒绝执行并提示原因。建议先进行预览：

```bash
# See exactly what would be uploaded (no sign-in, no network)
mt-eval publish eval/logs/harness/<run-id>_report.json --dry-run

# Publish (opens a browser sign-in the first time; add --anonymous to skip it)
mt-eval publish eval/logs/harness/<run-id>_report.json --prod
```

如需在运行后直接发布，请在 `mt-eval run` 中添加 `--publish --prod`。即使发布步骤失败，本次运行的分数仍会保存，测试框架会输出准确的重试命令。在环境变量中设置 `MT_EVAL_ALLOW_PROD=1` 相当于在脚本中使用 `--prod`。

:::note[提交 API 和网页上传功能尚未上线]
计划推出 `POST https://champollion.dev/api/leaderboard/submit` 端点和排行榜上传界面，但**尚未实现**。在正式推出之前，唯一可用的提交途径是 `mt-eval publish`（不支持通过 Pull Request 接收）。
:::

---

## 接下来会发生什么

1. 验证你的提交（数据集哈希、运行卡片完整性）
2. 结果在排行榜上显示为 **Self-benchmarked**（信任等级 1）
3. 若要获得 **Champollion Verified** 状态，请将你的方法作为可安装的插件提交，以便维护者复现你的结果
4. 针对原住民语言方法：如果你的方法位列榜首，将启动[所有权转移](/docs/network/sovereignty/ownership-transfer)流程

---

## 另请参阅

- [测试框架使用](/docs/network/specifications/harness) — 完整 CLI 参考
- [排行榜规则](/docs/network/leaderboard/rules) — 提交标准和反作弊政策
- [构建方法](/docs/network/specifications/methods) — TranslationMethod 协议
- [数据集](/docs/network/leaderboard/datasets) — 可用的评估数据集
