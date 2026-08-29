---
sidebar_position: 9
title: "Agent Guide: Using champollion"
description: "AI agents 如何安装、配置和运行 champollion 来翻译 locale 文件。"
related:
  - label: "Agent Guide: Building & Benchmarking on the Network"
    to: /docs/network/getting-started/agent-guide
    kind: arena
    note: "The eval-side guide for the same agents"
  - label: "Serving a Custom Method as an API"
    to: /docs/guides/serving-a-method
    kind: guide
  - label: "Build a Translation Plugin"
    to: /docs/tutorials/build-a-plugin
    kind: tutorial
  - label: "CLI Reference"
    to: /docs/reference/cli
    kind: reference
---

# 代理指南：使用 champollion

champollion 是一个 CLI 工具，可以通过一条命令翻译你的应用的语言文件。本指南面向 AI 代理（或与 AI 代理合作的开发者），帮助你快速从零开始获得翻译后的语言文件。

:::tip[已经熟悉了？]
如果你只需要命令，跳转到 [CLI 参考](/docs/reference/cli)。如果你想构建和基准测试一个翻译方法，请参阅 [Network Agent Guide](/docs/network/getting-started/agent-guide)。
:::

---

## 环境设置

```bash
# No global install needed — npx runs it directly
npx champollion sync
```

**要求：**
- Node.js 20.11+（原生 ESM）
- 你的翻译提供商的 API 密钥

**API 密钥设置** — champollion 需要至少一个密钥，具体取决于你使用的方法：

```bash
# Option 1: export (session only)
export OPENROUTER_API_KEY="sk-or-..."        # for llm / llm-coached methods
export GOOGLE_TRANSLATE_API_KEY="AIza..."    # for google-translate method

# Option 2: .env file in your project root (persistent, gitignored)
echo 'OPENROUTER_API_KEY=sk-or-...' > .env
```

Champollion 自动读取 `.env.local` 和 `.env`（优先级：`process.env` → `.env.local` → `.env`）。在 [openrouter.ai/keys](https://openrouter.ai/keys) 获取 OpenRouter 密钥。

---

## 首次同步

Champollion 自动检测你的区域设置文件、其格式（JSON、TOML 或 YAML）和你的目标语言：

```bash
npx champollion sync
```

**发生的过程：**
1. 加载 `champollion.config.json`（或自动检测设置）
2. 扫描源语言文件，展平嵌套键
3. 与 `.champollion.lock` 比较（先前翻译值的 SHA-256 哈希）
4. 检查 `.champollion/tm.json` 中的缓存翻译（翻译记忆库）
5. 通过配置的方法翻译**已更改、缺失或过期的键**
6. 对每个翻译运行质量门（5 项检查）
7. 将通过的翻译写入目标语言文件
8. 更新锁定文件和 TM 缓存

在更改一个键后的典型重新运行中，第 4 步从缓存提供 142 个键，第 5 步翻译 1 个键。这就是为什么后续同步速度快且成本低。

---

## 配置

在项目根目录创建 `champollion.config.json`：

```json
{
  "inputLocale": "en",
  "pairs": {
    "en:fr": { "method": "llm-coached" },
    "en:ja": { "method": "google-translate" },
    "en:crk": { "method": "api", "endpoint": "http://localhost:3000/translate" }
  }
}
```

配对键使用**冒号**（`en:fr`），而不是连字符 — 连字符保留用于区域语言代码，如 `es-MX`。

关键字段：

| 字段 | 用途 | 默认值 |
|-------|---------|---------|
| `inputLocale` | 源语言 | `en` |
| `languages` | 目标语言（数组或对象） | `[]` |
| `pairs` | 按配对覆盖（`"src:tgt"` 键）及方法配置 | 可选 |
| `localesDir` | 区域设置文件所在位置 | `./locales` |
| `model` | 用于 `llm`/`llm-coached` 方法的 LLM 模型 | `google/gemini-3.5-flash` |
| `batchSize` | 每个 API 调用的键数 | 80（LLM）；Google Translate 限制为 128 个片段/请求 |
| `jsonConcurrency` | JSON 键的并行区域设置翻译 | 50 |
| `contentConcurrency` | 内容翻译的并行 API 调用 | 48（Docusaurus 文档）、12（Hugo `contentDir`） |

完整参考：[配置](/docs/getting-started/configuration)

---

## 翻译方法

| 方法 | 何时使用 | 成本 | 需要 API 密钥 |
|------|---------|------|-------------|
| **`llm`** | 通用，适合资源充足的语言 | 按令牌计费（取决于模型） | `OPENROUTER_API_KEY` |
| **`llm-coached`** | 当你有目标语言的语法规则/词典时 | 按令牌 + 指导上下文 | `OPENROUTER_API_KEY` |
| **`google-translate`** | 高资源语言，其中 GT 效果良好 | $20/百万字符 | `GOOGLE_TRANSLATE_API_KEY` |
| **`api`** | 托管在 HTTP 端点后的自定义管道 | 服务器决定 | 无（端点处理身份验证） |
| **`plugin`** | 本地安装的预打包方法 | 变化 | 变化 |

详情：[翻译方法](/docs/guides/translation-methods)

---

## 教练数据

对于 `llm-coached` 对，指导数据用显式语言知识引导 LLM。创建一个指导文件：

```json title="coaching/fr.json"
{
  "grammar_rules": [
    "Use formal register (vous) for all UI text",
    "Adjectives agree in gender and number with the noun"
  ],
  "dictionary": {
    "dashboard": "tableau de bord",
    "settings": "paramètres"
  },
  "style_notes": "Prefer active voice. Avoid anglicisms."
}
```

在你的对配置中引用它：

```json
"en:fr": { "method": "llm-coached", "coachingFile": "coaching/fr.json" }
```

质量门验证字典术语是否实际出现在输出中 — 违规被记录为 `[TERM]` 警告。

详情：[指导数据](/docs/concepts/coaching-data)

---

## 质量门

每个翻译在写入磁盘前都要通过五项自动检查：

| 检查 | 捕获内容 | 示例 |
|------|---------|------|
| **空白/空值** | 模型返回空值 | `""` |
| **源回显** | 模型返回未更改的英文输入 | `"Welcome"` 用于日语 |
| **幻觉循环** | 重复的三字组 | `"Qo' Qo' Qo' Qo'"` |
| **长度膨胀** | 输出长度是源的 4 倍以上 | 10 字符源 → 50 字符输出 |
| **脚本合规性** | 语言环境的脚本错误 | 阿拉伯语言环境的拉丁文本 |

失败被记录为 `[GATE]` 前缀。没有静默回退 — 如果翻译失败，它会被报告，而不是被悄悄接受。

详情：[质量门](/docs/concepts/quality-gate)

---

## 翻译记忆库

Champollion 在 `.champollion/tm.json` 中缓存翻译，键为源文本 + 语言环境 + 方法。在后续同步中，未更改的键从缓存提供 — 无 API 调用，无成本。

```
[TM] 142 key(s) served from cache
Translating 3 key(s) to French (llm)... [OK]
```

要在一次运行中绕过缓存：`npx champollion sync --no-tm`

详情：[翻译记忆库](/docs/concepts/translation-memory)

---

## 生成的文件

Champollion 在你的项目中创建多个文件。了解它们是什么，这样你就不会意外删除或提交错误的文件：

| 文件 | 用途 | Git？ |
|------|---------|------|
| `.champollion.lock` | 已翻译源值的 SHA-256 哈希值（变更检测） | **是** — 提交此文件 |
| `.champollion-content.lock` | 相同，但用于 Markdown/MDX 内容文件 | **是** — 提交此文件 |
| `.champollion/` | 内部状态目录（`tm.json` 缓存、XLIFF 导出、备份） | **否** — 添加到 gitignore；`tm.json` 是本地缓存（参见 [配置](/docs/getting-started/configuration)） |
| 你编写的教练文件（例如 `coaching/fr.json`） | 你的语言学知识 | **是** — 提交这些文件 |
| `champollion.config.json` | 项目配置 | **是** — 提交此文件 |

---

## 常见模式

**翻译所有已配置的语言对：**
```bash
npx champollion sync
```
Champollion 会并行翻译所有语言环境。借助 TM 缓存，只有发生更改的键才会请求 API（未更改的语言对直接从缓存中读取，因此完整同步的成本很低）。

**仅翻译特定的语言对：**
```bash
npx champollion sync --pair en:fr          # one pair
npx champollion sync --pair en:fr,en:de    # comma-separated list
```
`--pair` 会将运行限制在指定的语言对上；就绪状态检查和费用消耗仅适用于这些语言对。如果指定的语言对不在已配置的语言对图中，程序会明确报错并列出已配置的语言对列表——绝不会静默失败。

**内容模式（Docusaurus、Hugo 等的 Markdown/MDX）：**
```bash
npx champollion sync --content-dir ./content
```
与区域设置 JSON 一起翻译文档、博客文章和内容文件。内容翻译并行运行；使用 `--content-concurrency` 调整。

**干运行（预览而不写入）：**
```bash
npx champollion sync --dry-run
```

**强制重新翻译特定键：**
```bash
npx champollion sync --force-keys "hero.title,nav.about"
```

**强制重新翻译所有内容文件：**
```bash
npx champollion sync --force-content
```

**检查翻译状态：**
```bash
npx champollion status
```
显示每对的覆盖率、质量层级和插件信息。

**审计未翻译的回退：**
```bash
npx champollion audit
```
列出所有需要翻译的 `[EN]` 回退值。

---

## 故障排除

| 问题 | 解决方案 |
|------|--------|
| `OPENROUTER_API_KEY not set` | 导出密钥或将其添加到项目根目录的 `.env` |
| `No locale files found` | 在配置中设置 `localesDir`，或确保你的语言文件匹配标准命名（`en.json`、`fr.json`） |
| `[GATE] Script compliance failed` | 你的目标语言环境获得了拉丁文本而不是预期的脚本 — 尝试不同的模型或添加指导数据 |
| `[GATE] Source echo` | 模型返回了未更改的英文 — 指导数据或不同的模型通常可以解决此问题 |
| 所有翻译都已缓存 | 使用 `--no-tm` 运行以绕过缓存，或 `--force-keys` 用于特定键 |
| 锁定文件冲突 | `.champollion.lock` 使用 SHA-256 哈希 — 合并冲突可以通过保留任一版本安全解决，然后重新运行同步 |

---

## 接下来

- [快速开始](/docs/getting-started/quick-start) — 完整的入门演练
- [CLI 参考](/docs/reference/cli) — 每个命令和标志
- [工作原理](/docs/how-it-works) — 同步管道解释
- [评估工具桥接](/docs/guides/bridge) — champollion 如何连接到 Network
- **想构建自己的翻译方法？** 请参阅 [Network 代理指南](/docs/network/getting-started/agent-guide) — 构建方法，在公共排行榜上证明其有效性，如果/当奖项开放时竞争奖项（奖项是计划中的机制 — 请参阅 [诚实的局限性](/docs/network/honest-limitations)）。
