---
sidebar_position: 2
title: "快速上手"
related:
  - label: "Installation"
    to: /docs/getting-started/installation
    kind: guide
  - label: "Configuration"
    to: /docs/getting-started/configuration
    kind: reference
    note: "Every config field, explained"
  - label: "Troubleshooting"
    to: /docs/guides/troubleshooting
    kind: guide
---

# 快速上手

60 秒内翻译您的第一个本地化语言文件。

该 CLI 在 [PolyForm Noncommercial License 1.0.0](https://github.com/gamedaysuits/Champollion/blob/main/cli/LICENSE) 许可下可免费用于非商业用途；该许可不涵盖商业用途。学校、公立医院或诊所、慈善机构或个人项目均在许可范围内；商店的商业网站则不在其列。[谁可以使用本工具](/docs/getting-started/who-may-use-this) 详细说明了适用范围。

## 1. 设置本地化文件

创建源语言文件。Champollion 支持 JSON、TOML、YAML 等多种格式——完整列表请参见 [CLI 参考](/docs/reference/cli)：

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

## 2. 设置 API 密钥

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

:::note[手动输入，还是通过脚本运行？]
本页中的命令供您手动输入：`npx champollion` 会运行项目中安装的版本，或者由 npx 获取的版本——首次获取最新发布版，之后使用该缓存版本。由脚本自动运行的命令（CI、`package.json` 脚本、Git 钩子）应当明确指定版本，如 `npx --yes champollion@0.6 sync`，这样新版本的发布就不会改变构建运行时的行为（且 `--yes` 可避免 npx 暂停提示确认）。[CI 指南](/docs/guides/ci-cd)和[框架集成页面](/docs/integrations/frameworks)均采用了这种锁定版本的方式。
:::

:::tip[使用 Gemini？]
如果您选择了选项 B（Gemini），请添加 `--method gemini`：
```bash
npx champollion sync --method gemini
```
:::

Champollion 将会自动：
1. 自动检测 `locales/en.json` 作为源语言
2. 查找（或提示输入）目标语言
3. 翻译所有键
4. 写入 `locales/fr.json`、`locales/ja.json` 等文件
5. 创建 `.champollion.lock` 以跟踪已翻译的内容

## 4. 查看结果

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

## 后续流程是怎样的？

当您修改源字符串时，Champollion 会通过 SHA-256 哈希跟踪检测到更改，并在下一次同步时仅重新翻译该键：

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

未变更的键（`hero.subtitle`）会被**跳过**：其翻译已存在于 `locales/fr.json` 中，因此不会被发送到任何地方，甚至无需查询——不发起调用、不产生费用，也不会计入本次运行的“来自缓存”统计中。

**翻译记忆库**（`.champollion/tm.json`，在每次同步期间自动构建）用于处理*已*排入队列的文本：比如您改回原样的字符串、另一个文件中的相同句子，或是整个语言的重新翻译（`sync --redo all`）。这些内容将免费从缓存中获取，运行输出行会显示命中数量（`… 0 key(s) sent to the model, 12 served from the cache (free)`）。缓存按翻译方法、语域和提示指导（coaching）分别保存——包括语言对及其后备语言对各自分开维护。在切换翻译方法（例如 `local` → `llm`）或修改指导文件的文本（针对语言对、其语言或其后备选项）之后，不会复用任何内容，并且运行输出会说明原因；仅更换模型则会复用先前的翻译。单纯更改配置本身不会触发重新翻译：`sync` 会指明重译操作及其预估费用。

## 可选：创建配置文件

如需更多控制，可生成配置文件：

```bash
npx champollion init                         # guided wizard
npx champollion init --yes --langs fr,de,ja  # quick setup with specific targets
npx champollion init --yes --langs fr,de --method local --model llama3.1   # a model on this machine
```

`--method` 和 `--model` 用于选择翻译方法和模型（`npx champollion init --help` 列出了所有方法）；init 会打印该配置所使用的选项。

引导式向导会带您配置每种语言的**语域预设**——即针对其语言系统微调的预置语气/敬语指令。例如法语拥有 T-V 预设（vouvoiement 与 tutoiement 的尊称与通称对比），韩语拥有敬语层级（해요체 vs 합쇼체 vs 해체），日语则拥有敬语选项（です/ます vs 丁寧語）。

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

运行 `npx champollion init` 即可浏览各语言可用的预设。

## 可选：监听模式

在源文件发生变化时自动翻译：

```bash
npx champollion watch
```

## 后续步骤

- **[配置](/docs/getting-started/configuration)** — 完整配置参考
- **[翻译方法](/docs/guides/translation-methods)** — 为每个语言对选择合适的方法
- **[翻译记忆库](/docs/concepts/translation-memory)** — 缓存如何在重复运行时帮您节省费用
- **[与专业译员协作](/docs/guides/professional-translators)** — 导出 XLIFF 供人工审校
- **[框架集成](/docs/integrations/frameworks)** — Hugo、next-intl、react-i18next
- **[CI/CD](/docs/guides/ci-cd)** — 在流水线中实现翻译自动化
- **[故障排除](/docs/guides/troubleshooting)** — 常见问题及解决方案
