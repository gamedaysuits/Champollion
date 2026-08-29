# 集成指南

与流行框架集成 Champollion 的分步设置。

---

## API 密钥设置

在与任何框架集成之前，您需要一个翻译 API 密钥。Champollion 支持两个提供商：

### 选项 A：OpenRouter（推荐）

[OpenRouter](https://openrouter.ai) 为 200+ 个 LLM 模型提供统一 API。提供免费层级。

```bash
# Sign up at https://openrouter.ai, then:
export OPENROUTER_API_KEY=sk-or-v1-...

# Or add to .env.local:
OPENROUTER_API_KEY=sk-or-v1-your-key-here
```

最适合：内容密集型项目、Markdown 翻译以及需要内容感知屏蔽的项目（代码块、短代码、插值变量）。

### 选项 B：Google Translate

```bash
export GOOGLE_TRANSLATE_API_KEY=...
```

适用场景：大批量键值对字符串（194 种语言）。**不推荐**用于 Markdown 内容 —— Google Translate 无法识别代码块、短代码或插值变量。

显式使用 Google Translate：

```bash
champollion sync --method google-translate
```

> **提示**：如果仅设置了 `GOOGLE_TRANSLATE_API_KEY`（无 OpenRouter 密钥），champollion 会自动切换到 Google Translate。

---

## Hugo（TOML / YAML / Markdown）

### 项目结构

Hugo 使用 `i18n/` 进行字符串翻译，使用 `content/` 进行页面内容：

```
my-hugo-site/
├── i18n/
│   ├── en.toml             ← source of truth
│   ├── fr.toml
│   └── ja.toml
├── content/
│   ├── posts/
│   │   ├── hello.md        ← source (English)
│   │   ├── hello.fr.md
│   │   └── hello.ja.md
│   └── about.md
└── .env.local
```

### 设置

```bash
npm install --save-dev champollion
```

```bash
# .env.local
OPENROUTER_API_KEY=sk-or-v1-your-key-here
```

创建 `champollion.config.json`：

```json
{
  "version": 3,
  "inputLocale": "en",
  "localesDir": "./i18n",
  "contentDir": "./content",
  "format": "auto",
  "languages": ["fr", "de", "ja", "es", "ko", "zh"]
}
```

```bash
champollion sync           # sync i18n string files + content files
champollion sync --dry     # preview changes without writing
```

### 内容翻译详情

**前置元数据**：支持 YAML（`---`）和 TOML（`+++`）分隔符。默认翻译 `title`、`description`、`summary`、`subtitle`、`caption` 和 `linkTitle`。所有其他字段（日期、草稿、标签、权重、slug 等）被保留。使用配置中的 `translatableFields` 自定义。

**块保护**：代码块、Hugo 短代码（`{{< >}}`、`{{% %}}`）、内联代码和原始 HTML 使用 Unicode 哨兵占位符自动屏蔽。它们原封不动地通过。

**文件名约定**：遵循 Hugo 的按文件名翻译模式：
- `my-post.md` → `my-post.fr.md`
- `my-post.en.md` → `my-post.fr.md`（去除源后缀）

**跳过现有**：现有翻译文件永远不会被覆盖。删除目标文件以强制重新翻译。

### 复数形式

TOML 和 YAML 区域设置支持 CLDR 复数形式：

```toml
[items]
one = "{{ .Count }} item"
other = "{{ .Count }} items"
```

在内部表示为 `items.one` 和 `items.other` 用于差异比较，然后在写入时重新序列化为正确的分段格式。

---

## next-intl（JSON）

### 项目结构

```
my-app/
├── messages/
│   └── en.json        ← source of truth
├── src/
│   ├── i18n/
│   │   ├── routing.ts
│   │   └── request.ts
│   └── middleware.ts
└── .env.local
```

### 设置

```bash
npm install --save-dev champollion
```

创建 `champollion.config.json`：

```json
{
  "version": 3,
  "inputLocale": "en",
  "localesDir": "./messages",
  "languages": ["fr", "de", "ja", "es", "ko", "zh", "pt", "ar"]
}
```

```bash
npx champollion sync
```

创建 `messages/fr.json`、`messages/ja.json` 等 — 完全翻译，保留您的嵌套键结构。next-intl 会自动识别它们。

### 开发工作流

```json
{
  "scripts": {
    "dev": "champollion watch & next dev",
    "i18n:sync": "champollion sync",
    "i18n:audit": "champollion audit"
  }
}
```

---

## react-i18next（JSON）

### 平面文件结构（推荐）

```
locales/
├── en.json
├── fr.json
└── ja.json
```

```json
{
  "version": 3,
  "inputLocale": "en",
  "localesDir": "./locales",
  "languages": ["fr", "de", "ja"]
}
```

### 嵌套目录结构

如果您使用 `{locale}/{namespace}.json` 结构，请创建一个同步脚本来扁平化 → 翻译 → 反扁平化。详见 [react-i18next 文档](https://react.i18next.com/)。
