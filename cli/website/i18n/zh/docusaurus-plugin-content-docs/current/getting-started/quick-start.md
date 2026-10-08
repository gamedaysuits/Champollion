---
sidebar_position: 2
title: "快速开始"
related:
  - label: "Installation"
    to: /docs/getting-started/installation
    kind: guide
  - label: "Configuration"
    to: /docs/getting-started/configuration
    kind: reference
    note: "Every config field, explained"
  - label: "Cookbook: Translate 30 Languages"
    to: /docs/tutorials/translate-30-languages
    kind: cookbook
    note: "Scale from three locales to thirty"
  - label: "Troubleshooting"
    to: /docs/guides/troubleshooting
    kind: guide
---

# 快速开始

在 60 秒内翻译你的第一个语言文件。

根据 [PolyForm Noncommercial License 1.0.0](https://github.com/gamedaysuits/Champollion/blob/main/cli/LICENSE)，本 CLI 免费供非商业用途使用；商业用途不在该许可证许可范围内。学校、公立医院或诊所、慈善机构或个人项目均在许可范围内；商铺店面则不在许可范围内。[谁可以使用本工具](/docs/getting-started/who-may-use-this)对此有完整说明。

## 1. 设置你的语言文件

创建一个源语言区域文件（locale file）。Champollion 支持 JSON、TOML、YAML 等多种格式——完整列表请参见 [CLI 参考](/docs/reference/cli)：

```json title="locales/en.json"
{
  "hero": {
    "title": "Welcome to our platform",
    "subtitle": "Build something amazing"
  },
  "nav": {
    "home": "Home",
    "about": "About",
    "contact": "Contact"
  }
}
```

## 2. 设置你的 API 密钥

选择一个提供商并设置密钥：

```bash
# Option A: OpenRouter (200+ models, recommended)
export OPENROUTER_API_KEY=sk-or-v1-...

# Option B: Gemini (free tier — zero cost to start)
export GEMINI_API_KEY=AI...

# Option C: a model on your own machine (Ollama, LM Studio, vLLM) — no key
#   nothing to export if it listens on Ollama's default http://localhost:11434/v1
#   another server: export LOCAL_API_BASE=http://localhost:8000/v1 (its address; or put that line in .env.local or .env)
```

在 [aistudio.google.com/apikey](https://aistudio.google.com/apikey) 获取免费的 Gemini 密钥。在 [openrouter.ai](https://openrouter.ai) 获取 OpenRouter 密钥。对于选项 C，请在设置项目时指定模型名称：`npx champollion init --yes --langs fr,de --method local --model llama3.1`（或运行 `sync --method local --model llama3.1`）。

## 3. 运行同步

```bash
npx champollion sync
```

:::note[由您手动输入，还是由脚本运行？]
本页中的命令均由您手动输入：`npx champollion` 会运行项目中安装的副本，或者 npx 获取的副本——首次获取最新发布版本，之后使用该缓存副本。由脚本代为运行的命令（CI、`package.json` 脚本、git hook 等）应明确指定版本号，例如 `npx --yes champollion@0.5 sync`，以确保新版本不会影响构建所运行的内容（并且 `--yes` 可以防止 npx 暂停提示确认）。[CI 指南](/docs/guides/ci-cd)和[框架集成页面](/docs/integrations/frameworks)均采用了这种版本锁定方式。
:::

:::tip[使用 Gemini？]
如果你选择了选项 B (Gemini)，请添加 `--method gemini`：
```bash
npx champollion sync --method gemini
```
:::

Champollion 将：
1. 自动检测 `locales/en.json` 作为源语言
2. 查找（或提示输入）目标语言
3. 翻译所有键
4. 写入 `locales/fr.json`、`locales/ja.json` 等
5. 创建 `.champollion.lock` 来追踪已翻译的内容

## 4. 检查结果

```bash
cat locales/fr.json
```

```json
{
  "hero": {
    "title": "Bienvenue sur notre plateforme",
    "subtitle": "Construisez quelque chose d'incroyable"
  },
  "nav": {
    "home": "Accueil",
    "about": "À propos",
    "contact": "Contact"
  }
}
```

## 接下来会发生什么？

当你更改源字符串时，champollion 通过 SHA-256 哈希追踪检测到更改，并在下次同步时仅重新翻译该键：

```json title="locales/en.json (updated)"
{
  "hero": {
    "title": "Welcome to Acme Platform",  // ← changed
    "subtitle": "Build something amazing"  // ← unchanged, skipped
  }
}
```

```bash
npx champollion sync
# Only "hero.title" is re-translated across all locales
```

未更改的键（`hero.subtitle`）将被**跳过**：其翻译已存在于 `locales/fr.json` 中，因此不会发送到任何地方，甚至无需查询——无 API 调用、无成本，也不计入本次运行的“从缓存提供”（served from the cache）数据中。

**翻译记忆库**（Translation Memory，`.champollion/tm.json`，在每次同步期间自动构建）用于处理*已进入队列*的文本：改回原样的字符串、另一个文件中的相同句子、整个语言区域的重译（`sync --redo all`）。这些内容均免费从缓存中提供，运行日志中会显示命中数量（`… 0 key(s) sent to the model, 12 served from the cache (free)`）。缓存按翻译方法、语域（register）以及提示引导（coaching）分别保存——语言对及其回退（fallback）各自独立。在切换翻译方法后（例如 `local` → `llm`），或更改提示引导文件的文本后（针对该语言对、其对应语言或其回退），以往的翻译将不会被复用，运行日志会说明原因；仅更改模型本身仍会复用先前的翻译。单独的更改不会自动触发重新翻译：`sync` 会列出重译内容及其预估费用。

## 可选：创建配置文件

为了获得更多控制，生成一个配置文件：

```bash
npx champollion init                         # guided wizard
npx champollion init --yes --langs fr,de,ja  # quick setup with specific targets
npx champollion init --yes --langs fr,de --method local --model llama3.1   # a model on this machine
```

`--method` 与 `--model` 用于选择翻译方法和模型（`npx champollion init --help` 列出了所有方法）；init 命令会输出配置文件当前使用的选项。

引导式向导会引导你完成每种语言的**寄存器预设** — 预构建的语调/正式程度指令，针对其语言系统进行调整。法语有 T-V 预设（vouvoiement vs tutoiement），韩语有言语级别（해요체 vs 합쇼체 vs 해체），日语有敬语选项（です/ます vs 丁寧語）。

或者使用预设键手动创建配置：

```json title="champollion.config.json"
{
  "version": 3,
  "inputLocale": "en",
  "localesDir": "./locales",
  "languages": {
    "fr": "casual-tu",
    "ko": "polite-haeyo",
    "ja": "polite"
  },
  "model": "google/gemini-3.8-flash"
}
```

运行 `npx champollion init` 来浏览每种语言的可用预设。

## 可选：监视模式

当你的源文件更改时自动翻译：

```bash
npx champollion watch
```

## 后续步骤

- **[配置](/docs/getting-started/configuration)** — 完整配置参考
- **[翻译方法](/docs/guides/translation-methods)** — 为每个语言对选择正确的方法
- **[翻译记忆库](/docs/concepts/translation-memory)** — 缓存如何为你节省重新运行的成本
- **[与专业翻译人员合作](/docs/guides/professional-translators)** — 导出 XLIFF 供人工审查
- **[框架集成](/docs/guides/framework-integration)** — Hugo、next-intl、react-i18next
- **[CI/CD](/docs/guides/ci-cd)** — 在你的管道中自动化翻译
- **[故障排除](/docs/guides/troubleshooting)** — 常见问题和解决方案
