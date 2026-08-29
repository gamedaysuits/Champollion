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
    "en:ja": { "method": "llm", "model": "google/gemini-2.5-pro" },
    "en:de": { "method": "google-translate" },
    "en:ko": { "method": "llm", "register": "polite-haeyo" },
    "en:es": { "method": "api", "endpoint": "https://review.your-lsp.example/mtpe" },
    "en:crk": { "methodPlugin": "crk-coached-v3" }
  }
}
```

法语使用 DeepL（你的团队更喜欢它的欧洲流畅性）。日语使用前沿 LLM。德语使用 Google 翻译（快速、便宜、足够好）。韩语使用具有正式语体的 LLM。西班牙语通过 `api` 方法路由到专业人工/MTPE 服务——人工翻译在这里是一流的方法，而不是附加功能。平原克里语使用社区构建、社区拥有的教练插件。

**相同的命令。相同的 CI 管道。每个语言对使用不同的方法——人工或机器。一个配置文件。**

:::note[社区语言方法具有主权]
上述 Plains Cree 插件不仅仅是"另一种方法"。针对土著语言和其他社区语言的方法是**社区所有和治理的**：社区掌握这些方法背后数据的密钥，制定使用条款，任何非商业 (NC) 语料库或方法在默认情况下都与商业路径分离。如果您的使用是商业性的，请在发布前检查该方法的许可证。参见 [数据主权](/docs/network/sovereignty/data-sovereignty)。
:::

## 排行榜 → 部署工作流

:::tip[`champollion leaderboard` 随 CLI 一同提供]
以下工作流基于 `champollion leaderboard` 命令运行 —— 从终端浏览 [Network](/arena) 排行榜，并直接从中安装方法插件。有关所有选项，请参阅 [CLI 参考](/docs/reference/cli#leaderboard)。
:::

[Network](/arena) 是使用可重现、指纹识别评分对翻译方法进行基准测试的地方。每种方法都获得跨多个指标的综合评分（chrF++、精确匹配、FST 接受度、语义评分）。排行榜跟踪每次提交。

工作流：

```bash
# Browse the leaderboard from your terminal
npx champollion leaderboard --pair en:crk

# Output:
# ┌──────┬───────────────────────┬────────────┬──────────┬───────────┐
# │ Rank │ Method                │ Model      │ chrF++   │ Composite │
# ├──────┼───────────────────────┼────────────┼──────────┼───────────┤
# │  1   │ crk-coached-v3        │ gemini-2.5 │ 43.2     │ 0.67      │
# │  2   │ fst-gated-pipeline    │ gpt-4o     │ 41.8     │ 0.63      │
# │  3   │ prompt-baseline       │ claude-4   │ 38.1     │ 0.55      │
# └──────┴───────────────────────┴────────────┴──────────┴───────────┘

# Install the method that fits as a plugin
npx champollion leaderboard --install crk-coached-v3

# Use it
npx champollion sync
```

*仅供说明之用——上面的排行榜行是示例布局。该排行榜目前对提交开放，尚未发布任何运行。*

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
# In your CI pipeline
npx champollion lint        # Catch hardcoded strings
npx champollion sync        # Translate what changed
npx champollion audit       # Fail if any locale is incomplete
npx champollion integrity   # Validate placeholder consistency
```

三个命令。零手动翻译。管道捕获硬编码字符串，用你选择的方法翻译它们，如果有任何遗漏或损坏则使构建失败。

### 5. 专业审查（可选）

对于高风险内容，导出为 XLIFF 进行人工审查：

```bash
npx champollion xliff export --locale ja --output translations.xliff
# → Send to your translation agency
# → Import corrections back:
npx champollion xliff import translations.xliff
```

机器翻译大部分内容。人工审查关键路径。只在重要的地方支付人工时间。

## 成本模型

champollion **没有订阅费，也没有按席位收费**。该 CLI 在 PolyForm Noncommercial 1.0.0 许可下提供源码 —— 免费用于非商业用途（研究、教育、社区工作）；商业用途需要获得许可，因此请先[联系我们](/get-involved)。除此之外，您只需为翻译 API 调用付费：

| 容量 | Google Translate | LLM (Gemini Flash) | LLM (GPT-4o) |
|--------|-----------------|---------------------|---------------|
| 1,000 个键 × 5 个区域设置 | ~$0.50 | ~$0.30（免费层） | ~$2.00 |
| 10,000 个键 × 15 个区域设置 | ~$15 | ~$8 | ~$60 |
| 50,000 个键 × 30 个区域设置 | ~$75 | ~$40 | ~$300 |

翻译记忆意味着你只需为**更改的键**在后续同步中付费。如果你在 10,000 个字符串中更新 10 个，你只需为 10 个翻译付费，而不是 10,000 个。

## 与 TMS 平台的对比

| | champollion | Crowdin / Phrase / Locize |
|---|---|---|
| **定价** | 非商业用途免费（商业用途需许可）+ API 费用 | $50–$500/月 + 按席位收费 |
| **供应商锁定** | 无 —— 在配置中切换提供商 | 高 —— 数据在他们的云端 |
| **方法选择** | 任何提供商，任何模型，按语言对 | 仅限其提供的服务 |
| **CI/CD** | 原生支持 (`lint → sync → audit`) | 插件/Webhook |
| **自定义方法** | 插件系统，社区插件 | 不支持 |
| **质量门禁** | 内置（错误脚本、回显、长度） | 视情况而定 |
| **自托管** | 支持（LibreTranslate、自定义 API） | 不支持 |

详见 [完整对比](/docs/guides/comparison)。

## 进一步阅读

- **[快速开始](/docs/getting-started/quick-start)** — 在 60 秒内运行你的第一次同步
- **[翻译方法](/docs/guides/translation-methods)** — 完整的方法菜单和决策树
- **[CI/CD 集成](/docs/guides/ci-cd)** — 在你的管道中自动化
- **[与专业翻译人员合作](/docs/guides/professional-translators)** — XLIFF 导出/导入
- **[Network](/arena)** — 基准测试和排行榜
- **[配置参考](/docs/getting-started/configuration)** — 每个配置选项
