---
sidebar_position: 3
title: "CI/CD"
---

# CI/CD 集成

在构建管道中自动化翻译。

## GitHub Actions：推送时同步

将翻译同步添加到现有构建管道：

```yaml title=".github/workflows/deploy.yml"
jobs:
  build:
    steps:
      - uses: actions/checkout@v4
      - run: npm ci
      - name: Sync translations
        env:
          OPENROUTER_API_KEY: ${{ secrets.OPENROUTER_API_KEY }}
        run: npx champollion sync
      - run: npm run build
```

## GitHub Actions：定时同步

按计划运行翻译并自动提交：

```yaml title=".github/workflows/i18n-sync.yml"
name: Sync translations
on:
  schedule:
    - cron: '0 6 * * *'
  workflow_dispatch:

jobs:
  sync:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npm ci
      - name: Sync translations
        env:
          OPENROUTER_API_KEY: ${{ secrets.OPENROUTER_API_KEY }}
        run: npx champollion sync
      - name: Commit updated translations
        run: |
          git config user.name "champollion"
          git config user.email "bot@example.com"
          git add i18n/ content/ locales/ messages/
          git diff --staged --quiet || git commit -m "chore: sync translations"
          git push
```

## Google Translate 方法

如果使用内置的 Google Translate 方法而不是 OpenRouter：

```yaml
- name: Sync translations
  env:
    GOOGLE_TRANSLATE_API_KEY: ${{ secrets.GOOGLE_TRANSLATE_API_KEY }}
  run: npx champollion sync
```

## 直接 LLM 提供商

如果直接使用 `openai`、`anthropic` 或 `gemini` 方法：

```yaml
# OpenAI
- name: Sync translations
  env:
    OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
  run: npx champollion sync --method openai

# Anthropic
- name: Sync translations
  env:
    ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
  run: npx champollion sync --method anthropic

# Gemini (free tier available)
- name: Sync translations
  env:
    GEMINI_API_KEY: ${{ secrets.GEMINI_API_KEY }}
  run: npx champollion sync --method gemini
```

## DeepL

```yaml
- name: Sync translations
  env:
    DEEPL_API_KEY: ${{ secrets.DEEPL_API_KEY }}
  run: npx champollion sync --method deepl
```

## 远程翻译 API

如果使用远程翻译端点（例如，托管翻译服务）：

```yaml
- name: Sync translations
  env:
    CHAMPOLLION_API_KEY: ${{ secrets.CHAMPOLLION_API_KEY }}
  run: npx champollion sync
```

## 三层 CI 管道

为了获得最大的 i18n 覆盖，使用所有三个工具来控制管道：

```yaml
jobs:
  i18n:
    steps:
      - uses: actions/checkout@v4
      - run: npm ci

      # 1. Catch hardcoded strings before they ship
      - run: npx champollion lint

      # 2. Translate missing keys
      - run: npx champollion sync
        env:
          OPENROUTER_API_KEY: ${{ secrets.OPENROUTER_API_KEY }}

      # 3. Fail if any locale is incomplete
      - run: npx champollion audit
```

| 层级 | 命令 | 时机 | 目的 |
|-------|---------|------|---------|
| **Lint** | `lint` | 提交前 | 阻止包含硬编码字符串的提交 |
| **Sync** | `sync` | 提交后 / CI | 翻译缺失和更改的键 |
| **Audit** | `audit` | 构建步骤 | 如果任何语言环境不完整，则部署失败 |

:::tip[CI 中的翻译记忆]
如果你的 CI 运行器具有持久工作区（或缓存 `.champollion/`），翻译记忆会自动启用——后续同步只会翻译源文本实际改变的键。对于临时运行器，考虑在运行之间缓存 `.champollion/tm.json`：

```yaml
- uses: actions/cache@v4
  with:
    path: .champollion/tm.json
    key: champollion-tm-${{ hashFiles('locales/en.json') }}
    restore-keys: champollion-tm-
```
:::

---

## 另请参阅

- [CLI 参考](/docs/reference/cli) — 完整命令参考
- [同步工作原理](/docs/concepts/how-sync-works) — 理解增量同步
- [翻译记忆](/docs/concepts/translation-memory) — 缓存和成本节省
- [翻译方法](/docs/guides/translation-methods) — 按语言对选择方法
- [质量门](/docs/concepts/quality-gate) — 翻译失败时会发生什么
- [配置](/docs/getting-started/configuration) — 配置参考
