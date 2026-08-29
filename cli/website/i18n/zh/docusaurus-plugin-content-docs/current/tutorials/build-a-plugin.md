---
sidebar_position: 1
title: "构建翻译插件"
description: "端到端教程：开发教练数据、使用评估工具进行基准测试、导出插件，并使用 champollion 部署。"
related:
  - label: "Plugin Specification"
    to: /docs/reference/plugin-spec
    kind: reference
    note: "The full plugin schema"
  - label: "Coaching Data"
    to: /docs/concepts/coaching-data
    kind: concept
    note: "What goes into a coached method"
  - label: "Serving a Custom Method as an API"
    to: /docs/guides/serving-a-method
    kind: guide
  - label: "Submit a Method"
    to: /docs/network/getting-started/submit-a-method
    kind: arena
    note: "Benchmark your plugin on the public leaderboard"
---

# 教程：构建翻译插件

从零开始构建自定义翻译方法，对其进行基准测试，并将其部署为 champollion 插件。这是添加任何现成 API 都不支持的新语言对的完整工作流程。

**你将构建什么：** 一个针对正式法语的有指导翻译插件，具有强制术语、语法规则和基准分数。

**耗时：** 30–45 分钟

**前置条件：**
- 已安装 champollion（`npm install --save-dev champollion`）
- OpenRouter API 密钥（`OPENROUTER_API_KEY`）
- Python 3.10+（用于评估工具）

---

## 第 1 步：识别问题

你正在将 SaaS 仪表板翻译成法语。默认的 `llm` 方法会产生正确但不一致的翻译：

- 有时"dashboard"变成"tableau de bord"，有时变成"panneau de contrôle"
- 语气在 `tu` 和 `vous` 形式之间交替
- 技术术语的英文化处理不一致

你需要通用 LLM 提示无法提供的**术语强制**和**寄存器控制**。

## 第 2 步：创建指导数据

创建一个编码你的语言学要求的指导文件：

```bash
mkdir -p .champollion/coaching
```

```json title=".champollion/coaching/fr.json"
{
  "grammar_rules": [
    "Always use the 'vous' form for formal register",
    "French adjectives agree in gender and number with their noun",
    "Use the present tense for UI instructions, not the imperative",
    "Preserve sentence-final punctuation style from the source"
  ],
  "dictionary": {
    "dashboard": "tableau de bord",
    "deployment": "déploiement",
    "settings": "paramètres",
    "environment variable": "variable d'environnement",
    "webhook": "webhook",
    "API key": "clé API",
    "sign in": "se connecter",
    "sign out": "se déconnecter",
    "repository": "dépôt",
    "pull request": "demande de tirage"
  },
  "style_notes": "Formal technical French. Prefer native French terms over anglicisms where established equivalents exist. Keep UI labels concise — 3 words maximum where possible."
}
```

**每个字段的作用：**
- **`grammar_rules`** — 作为显式约束注入到 LLM 系统提示中
- **`dictionary`** — 与源键匹配；当字典术语出现时，它作为"必需术语"注入到提示中
- **`style_notes`** — 作为一般风格指导附加到系统提示中

## 第 3 步：配置语言对

告诉 champollion 为法语使用 `llm-coached`：

```json title="champollion.config.json"
{
  "version": 3,
  "inputLocale": "en",
  "localesDir": "./locales",
  "pairs": {
    "en:fr": {
      "method": "llm-coached",
      "model": "google/gemini-3.5-flash",
      "temperature": 0.2
    }
  },
  "languages": {
    "fr": {
      "register": "Formal technical French (vous-form)",
      "name": "French"
    }
  }
}
```

## 第 4 步：测试它

```bash
npx champollion sync --dry
```

查看试运行输出。检查以下内容：
- ✅ 字典术语被一致使用（"tableau de bord"，而不是"panneau de contrôle"）
- ✅ `vous` 形式始终被使用
- ✅ 技术术语与你的字典匹配

然后运行真实同步：

```bash
npx champollion sync
```

## 第 5 步：使用评估工具进行基准测试（可选）

如果你想要质量分数——你确实想要，因为插件随附基准数据——使用配套的评估工具。

### 安装工具

```bash
pip install mt-eval-harness
```

### 创建参考语料库

创建一个包含源字符串和已知良好翻译的文件：

```json title="corpus/french-formal.json"
[
  {
    "source": "Dashboard",
    "reference": "Tableau de bord"
  },
  {
    "source": "Sign in to your account",
    "reference": "Connectez-vous à votre compte"
  },
  {
    "source": "Your deployment is ready",
    "reference": "Votre déploiement est prêt"
  },
  {
    "source": "Environment variables",
    "reference": "Variables d'environnement"
  }
]
```

### 运行基准测试

```bash
mt-eval test \
  --corpus corpus/french-formal.json \
  --source en \
  --target fr \
  --model google/gemini-3.5-flash \
  --temperature 0.2 \
  --champollion-config champollion.config.json
```

工具输出：
- **chrF++** — 字符级 F 分数（0–100）。超过 70 表示强劲。
- **BLEU** — N-gram 重叠（0–100）。对于有指导翻译，超过 40 表示可靠。
- **精确匹配率** — 与参考完全匹配的翻译比例。
- **COMET** — 神经质量指标（如果通过 `mt-eval setup --comet` 安装）。

:::tip[测试你要部署的内容]
使用 `--champollion-config` 直接从你的 `champollion.config.json` 导入生产模型、寄存器、温度和指导数据。这确保你正在对你将部署的确切方法进行基准测试。
:::

### 导出插件

一旦你对分数满意：

```bash
mt-eval export \
  --name french-formal-v1 \
  --report eval/logs/harness/run_report.json \
  --output ./french-formal-v1/
```

这会创建：

```
french-formal-v1/
├── method.json          # Manifest with config + benchmarks
└── coaching/
    └── fr.json          # Your coaching data
```

## 第 6 步：在 Champollion 中安装插件

```bash
npx champollion plugin install ./french-formal-v1/
```

这会将插件复制到 `.champollion/methods/french-formal-v1/`。

更新你的配置以使用它：

```json title="champollion.config.json"
{
  "pairs": {
    "en:fr": {
      "methodPlugin": "french-formal-v1"
    }
  }
}
```

## 第 7 步：验证

```bash
# Check plugin is installed and shows benchmark scores
npx champollion status

# Run a sync with the plugin
npx champollion sync

# Audit licensing status
npx champollion provenance
```

`status` 输出将显示：

```
en → fr
  Method:    french-formal-v1 (llm-coached)
  Model:     google/gemini-3.5-flash
  Quality:   high
  chrF++:    74.2
  BLEU:      46.8
  Exact:     42%
```

## 你构建了什么

```mermaid
flowchart LR
    A["Coaching data\n(grammar + dictionary)"] --> B["Eval harness\n(benchmark)"]
    B --> C["method.json\n(export)"]
    C --> D["champollion plugin install"]
    D --> E["champollion sync\n(production)"]
```

你现在拥有：
1. **指导数据** — 强制一致性的语法规则和术语
2. **基准分数** — 随插件一起发布的量化质量
3. **便携式插件** — `method.json` + 指导数据，可在任何机器上安装
4. **生产部署** — 集成到你的同步管道中

## 后续步骤

- **[插件规范](/docs/reference/plugin-spec)** — 完整清单格式参考
- **[翻译方法](/docs/guides/translation-methods)** — 比较所有四种方法
- **[低资源语言](/docs/network/community/low-resource-languages)** — 将此模式应用于没有 API 覆盖的语言
- **[翻译 30 种语言](/docs/tutorials/translate-30-languages)** — 将你的项目扩展到全球受众
