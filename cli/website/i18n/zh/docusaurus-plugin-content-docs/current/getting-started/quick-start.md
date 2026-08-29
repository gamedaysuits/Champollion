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

## 1. 设置你的语言文件

创建一个源语言环境文件。Champollion 支持 JSON、TOML、YAML 等格式——请查看 [CLI 参考](/docs/reference/cli) 获取完整列表：

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
```

在 [aistudio.google.com/apikey](https://aistudio.google.com/apikey) 获取免费的 Gemini 密钥。在 [openrouter.ai](https://openrouter.ai) 获取 OpenRouter 密钥。

## 3. 运行同步

```bash
npx champollion sync
```

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

未更改的键（`hero.subtitle`）从 champollion 的**翻译记忆库**缓存中提供 — 无 API 调用，无成本。缓存在每次同步期间自动构建，并存储在 `.champollion/tm.json`。

## 可选：创建配置文件

为了获得更多控制，生成一个配置文件：

```bash
npx champollion init                         # guided wizard
npx champollion init --yes --langs fr,de,ja  # quick setup with specific targets
```

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
  "model": "google/gemini-2.5-flash"
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
