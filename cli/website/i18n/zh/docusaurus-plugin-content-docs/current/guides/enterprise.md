---
sidebar_position: 7
title: "企业版"
description: "组织如何通过排行榜验证的方法、自定义插件和一键部署来标准化翻译。"
---

# champollion 企业版

你的团队定期翻译内容。你有一堆区域设置文件、一条 CI 管道，以及一个可能涉及某人手动运行 Google 翻译、将结果复制到 JSON 中并祈祷一切顺利的流程。或者你正在为一个 TMS 平台付费，被锁定在一个供应商的翻译引擎中。

champollion 给你一个更平静的选择：为每种语言选择正确的方法——机器或人工——并通过一个命令运行它们。

## 团队为什么使用 champollion

1. **为每种语言选择正确的方法** — 机器或人工，而不是你的供应商默认的任何方法
2. **用一个命令部署** — `npx champollion sync` 翻译每个区域设置、每种格式、每一次
3. **无需更改代码即可切换方法** — 只需配置更改，无需迁移
4. **掌控你的管道** — 无供应商锁定、无月度仪表板、无账户

```json title="champollion.config.json"
{
  "version": 3,
  "pairs": {
    "en:fr": { "method": "deepl" },
    "en:ja": { "method": "llm", "model": "google/gemini-3.1-pro-preview" },
    "en:de": { "method": "google-translate" },
    "en:ko": { "method": "llm", "register": "polite-haeyo" },
    "en:es": { "method": "api", "endpoint": "https://review.your-lsp.example/mtpe" },
    "en:crk": { "method": "llm-coached" }
  }
}
```

法语采用 DeepL（你的团队更青睐其欧洲语言的流畅度）。日语采用前沿 LLM。德语采用 Google Translate（快速、便宜且足够好用）。韩语采用带有正式语域（formal register）的 LLM。西班牙语通过 `api` 方法路由到专业的人工翻译 / MTPE 服务 —— 在这里，人工翻译是一等公民级别的内置方法，而非事后拼凑的附加组件。平原克里语（Plains Cree）则采用辅导式 LLM（coached LLM）方法，并附带由你提供的语法说明和词典。

**相同的命令。相同的 CI 管道。每个语言对使用不同的方法——人工或机器。一个配置文件。**

:::note[社区语言方法具有主权性]
上述平原克里语语言对不仅仅是又一个普通语言对。针对原住民及其他社区语言的方法由**社区拥有并治理**：社区掌握其背后数据的控制权，设定使用条款，且任何非商业（NC）语料库或方法默认均被排除在商业路径之外。如果你的用途属于商业性质，请在上线前检查该方法的许可证。参见[数据主权](/docs/network/sovereignty/data-sovereignty)。
:::

## 排行榜 → 部署工作流

:::tip[`champollion network leaderboard` 随 CLI 一同提供]
以下工作流运行在 `champollion network leaderboard` 命令上 —— 直接从终端浏览 [Network](/arena) 排行榜，并直接从中安装方法插件。所有选项请参阅 [CLI 参考](/docs/reference/cli#leaderboard)。
:::

[Network](/arena) 是对翻译方法进行可复现、带指纹评分基准测试的地方。各次运行（runs）的排名方式与机器翻译（MT）领域的惯例完全一致：依据语料库级别的 chrF++ 及其 95% 置信区间。旁边同时显示 BLEU、TER 和 COMET 指标，而完全匹配（exact match）和 FST 接受度等诊断指标则单独报告，绝不会混入主要得分中。一种方法是否真正优于另一种方法，取决于配对显著性检验（paired significance test），而非仅仅看两个数字之间的差距。排行榜会追踪每一次提交。

工作流如下：

```bash
# Browse the leaderboard from your terminal
npx champollion network leaderboard --pair "eng>fra"

# Output (abridged):
#   #   Model         chrF++ [95% CI]      BLEU   …   EM     FST
#   1   gemini-3.5    72.3 [70.8, 73.7]    48.1   …   0.31   —
#   2   deepl         70.9 [69.2, 72.4]    46.0   …   0.29   —
#   3   claude-4      68.4 [66.9, 70.0]    43.7   …   0.27   —
#   Headline: chrF++ with its 95% bootstrap CI; rows whose intervals overlap are not distinguishable.

# Install the method that fits as a plugin (by its rank)
npx champollion network leaderboard --install 1

# Use it
npx champollion sync
```

*仅供示意说明 —— 上述排行榜行仅为示例布局。在此示例中，前两行的置信区间重叠，因此排行榜并不能判定其中一个优于另一个。目前排行榜已开放提交，尚无已发布的运行记录。*

**你不构建方法。你不训练模型。你选择适合你的领域、预算和许可证的方法——人工或机器——并部署它。** 如果下个月出现更合适的方法，你可以用一个命令切换它。

## 今天可用的内容

排行榜到 CLI 的桥接正在开发中。以下是目前有效的内容：

### 内置方法（无需插件）

| 方法 | 最适合 | 成本 |
|--------|----------|------|
| `llm`（默认） | 质量优先、任何语言 | 通过 OpenRouter 按令牌计费 |
| `gemini` | 质量 + 免费层 | 免费（有限制），然后按令牌计费 |
| `google-translate` | 速度 + 容量 | $20/M 字符 |
| `deepl` | 欧洲语言 | $25/M 字符 |
| `llm-coached` | 具有教练数据的语言 | 通过 OpenRouter 按令牌计费 |
| `api` | 自定义/社区托管方法 | 自托管 |

### 插件方法（单独安装）

自定义插件可以包装任何翻译逻辑——微调模型、FST 门控管道、社区 API 或任何其他生成 JSON 的内容。参见 [构建插件](/docs/tutorials/build-a-plugin)。

## 企业工作流

### 1. 评估你当前的质量

```bash
# See what you're getting today
npx champollion status

# Output shows: method per pair, cache hit rate, quality gate stats
```

### 2. 在候选方法上运行评估工具

[评估工具](/docs/network/specifications/harness) 让你对相同数据集的多种方法进行基准测试。运行扫描、比较评分、选择赢家：

```bash
# In the eval harness repo
python -m mt_eval_harness.run \
  --methods coached-v3 baseline prompt-tuned \
  --dataset data/your-corpus.json
```

### 3. 为每个语言对配置赢家

更新你的配置以为每个语言对使用最佳方法。不同的语言有不同的最佳方法——这就是重点。

### 4. 集成到 CI/CD

```bash
# In your CI pipeline — pinned to the 0.5 line, so a new release never
# changes what the pipeline runs (the CI guide has the complete workflow)
npx --yes champollion@0.5 lint        # Catch hardcoded strings
npx --yes champollion@0.5 sync        # Translate what changed
npx --yes champollion@0.5 audit       # Fail if any locale is incomplete
npx --yes champollion@0.5 integrity   # Validate placeholder consistency
```

三个命令。零手动翻译。管道捕获硬编码字符串，用你选择的方法翻译它们，如果有任何遗漏或损坏则使构建失败。

### 5. 专业审查（可选）

对于高风险内容，导出为 XLIFF 进行人工审查：

```bash
npx champollion xliff export --locale ja --out translations.xliff
# → Send to your translation agency
# → Import corrections back:
npx champollion xliff import translations.xliff
```

机器翻译大部分内容。人工审查关键路径。只在重要的地方支付人工时间。

## 成本模型

champollion **没有订阅费，也没有按席位计费**。该 CLI 在 PolyForm Noncommercial 1.0.0 许可证下开放源码 —— 非商业用途免费：研究、教育、慈善机构、公立医院和诊所、政府部门、个人项目。将其用于商业目的（例如营利性企业的产品）不在该许可证涵盖范围内。在采用之前，请查看[适用人群与使用条件](/docs/getting-started/who-may-use-this)。除此之外，你只需支付翻译 API 调用的费用：

| 容量 | Google Translate | LLM (Gemini Flash) | LLM (GPT-4o) |
|--------|-----------------|---------------------|---------------|
| 1,000 个键 × 5 个区域设置 | ~$0.50 | ~$0.30（免费层） | ~$2.00 |
| 10,000 个键 × 15 个区域设置 | ~$15 | ~$8 | ~$60 |
| 50,000 个键 × 30 个区域设置 | ~$75 | ~$40 | ~$300 |

翻译记忆意味着你只需为**更改的键**在后续同步中付费。如果你在 10,000 个字符串中更新 10 个，你只需为 10 个翻译付费，而不是 10,000 个。

## 与 TMS 平台的对比

| | champollion | Crowdin / Phrase / Locize |
|---|---|---|
| **价格** | 非商业用途免费（[适用人群与使用条件](/docs/getting-started/who-may-use-this)）+ API 成本 | $50–$500/月 + 按席位计费 |
| **供应商锁定** | 无 —— 在配置中随时切换提供商 | 极高 —— 数据存储在对方云端 |
| **方法选择** | 支持任意提供商、任意模型，按语言对配置 | 仅限平台提供的选项 |
| **CI/CD** | 原生一等公民支持（`lint → sync → audit`） | 插件 / webhook |
| **自定义方法** | 插件系统、社区插件 | 不支持 |
| **质量门禁** | 内置（错误文字系统、回声复读、长度异常） | 参差不齐 |
| **自托管** | 是（LibreTranslate、自定义 API） | 否 |

详见 [完整对比](/docs/guides/comparison)。

## 进一步阅读

- **[快速开始](/docs/getting-started/quick-start)** — 在 60 秒内运行你的第一次同步
- **[翻译方法](/docs/guides/translation-methods)** — 完整的方法菜单和决策树
- **[CI/CD 集成](/docs/guides/ci-cd)** — 在你的管道中自动化
- **[与专业翻译人员合作](/docs/guides/professional-translators)** — XLIFF 导出/导入
- **[Network](/arena)** — 基准测试和排行榜
- **[配置参考](/docs/getting-started/configuration)** — 每个配置选项
