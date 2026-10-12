---
sidebar_position: 3
title: "配置"
related:
  - label: "Translation Methods"
    to: /docs/guides/translation-methods
    kind: guide
    note: "What the method fields actually select"
  - label: "Cookbook: Translate 30 Languages"
    to: /docs/tutorials/translate-30-languages
    kind: cookbook
    note: "Per-pair methods and registers at scale"
  - label: "Register"
    to: /glossary#term-register
    kind: glossary
    note: "The linguistic term behind the register field"
  - label: "Supported Languages"
    to: /docs/reference/supported-languages
    kind: reference
  - label: "CLI Reference"
    to: /docs/reference/cli
    kind: reference
---

# 配置

Champollion 开箱即用——它会自动检测项目中的区域设置文件、格式和目标语言。如需更多控制，请在项目根目录创建 `champollion.config.json`，或运行：

```bash
npx champollion init
```

## 完整配置参考

```json title="champollion.config.json"
{
  "version": 3,
  "inputLocale": "en",
  "localesDir": "./locales",
  "localesPattern": null,
  "localesLayout": null,
  "contentDir": null,
  "translatableFields": null,
  "format": "auto",
  "model": "google/gemini-3.8-flash",
  "temperature": 0.3,
  "defaultMethod": "llm",
  "batchSize": 80,
  "coachingFile": null,
  "promptContext": null,
  "genderGuidance": null,
  "protectedTerms": [],
  "jsonConcurrency": 200,
  "contentConcurrency": 48,
  "fallbackPrefix": "[EN] ",
  "apiKeyEnvVar": "OPENROUTER_API_KEY",
  "noTranslate": [],
  "noTranslateUrls": true,
  "baseUrl": "",
  "pairs": {},
  "languages": {},
  "lint": {
    "srcDir": null,
    "ignore": ["node_modules", ".next", "dist"],
    "minLength": 2
  },
  "seo": {
    "urlPattern": "/:locale/:path",
    "pages": null
  },
  "typegen": {
    "output": null,
    "autoGenerate": false
  }
}
```

:::note[typegen 尚未实现]
配置加载器可以识别并保留 `typegen` 配置块，但 TypeScript 类型生成尚未实现。这是计划功能的占位符。设置这些值无效。
:::


### 字段

| 字段 | 类型 | 默认值 | 描述 |
|-------|------|---------|-------------|
| `version` | `number` | `3` | 配置 schema 版本。始终为 `3`。 |
| `inputLocale` | `string` | `"en"` | 源语言代码（BCP 47）。 |
| `localesDir` | `string` | `"./locales"` | 语言环境文件的路径。每个语言包含一个文件（`fr.json`）或每个语言包含一个文件夹（`fr/common.json`）。参见[语言环境文件布局](#locale-layouts)。 |
| `localesPattern` | `string` | `null` | 当两种结构均不匹配时，所有语言文件的存放位置，包含 `{lang}` 以及可选的 `{ns}`：`"public/locales/{lang}/{ns}.json"`、`"src/strings/app_{lang}.json"`。相对于项目根目录。替换 `localesDir`。参见[语言环境文件布局](#locale-layouts)。 |
| `localesLayout` | `string` | `null` | 覆盖布局检测：`"flat"`（每种语言一个文件）或 `"dir"`（每种语言一个文件夹）。仅在 `en.json` 和 `en/` 同时存在时需要。 |
| `defaultNamespace` | `string` | `null` | 在每种语言一个文件夹且包含多个文件的项目中，`champollion wrap` 向其添加新键的文件（例如 `"common"`）。 |
| `contentDir` | `string` | `null` | 待翻译的 Markdown/MDX 文件夹：Hugo 的 `content/` 文件夹或任何其他文件夹，例如 Next.js 应用中的 `./newsletters`。每个译文都会作为 `<name>.<locale>.md` 写入源文件旁，例如 `2026-10.md` → `2026-10.crk.md`。已命名为 `<name>.<code>.md` 的文件被视为译文，而非源文件。参见[内容翻译](/docs/guides/content-translation)。 |
| `translatableFields` | `string[]` | `null` | 覆盖内容翻译的默认可翻译 frontmatter 字段。`null` 使用内置默认值（`title`、`description`、`summary`）。 |
| `format` | `string` | `"auto"` | 文件格式：`json`、`toml`、`yaml`、`po`（[gettext](#gettext)）、`arb`（[Flutter](#arb)）或 `auto`（根据源文件扩展名检测；`.yml` 视为 YAML，且目标文件保留 `.yml`）。任何其他值都会报错中止。 |
| `model` | `string` | `"google/gemini-3.8-flash"` | LLM 方法的默认模型。精确的模型 slug：完整的 OpenRouter slug（`provider/model`）。简短别名（`gemini-flash`）和浮动 ID（`~vendor/…`、`…-latest`）会被拒绝，并指出应写入的 slug。直连提供商使用纯名称（例如 `gpt-4o`）；其所属供应商的 OpenRouter slug 会映射到该名称（`openai/gpt-4o` → `gpt-4o`），若其没有对应模型，则会在发送任何请求前停止运行（[模型名称](/docs/guides/translation-methods#model-names)）。 |
| `temperature` | `number` | `0.3` | LLM 温度（0.0–2.0）。值越低 = 确定性越高。 |
| `defaultMethod` | `string` | `"llm"` | 默认翻译方法：`llm`、`llm-coached`、`openai`、`anthropic`、`gemini`、`local`、`google-translate`、`deepl`、`microsoft-translator`、`libretranslate`、`apertium`、`tilde`、`translated`、`api`。`local` 是本地机器上兼容 OpenAI 的服务器（默认为 Ollama）。可通过 `--method` CLI 标志覆盖。 |
| `batchSize` | `number` | `80` | 每个翻译批次的键数量。值越高 = API 调用越少，但 prompt 越大。 |
| `coachingFile` | `string` | `null` | 自由文本辅导 prompt 文件的路径（相对于项目根目录）。启动时会读取其内容并作为 `Coaching guidance:` 块注入到系统 prompt 中。 |
| `promptContext` | `string` | `null` | 注入到系统 prompt 中的应用上下文提示字符串（例如 "E-commerce product descriptions"）。有助于模型根据您的领域定制翻译。 |
| `genderGuidance` | `string` \| `false` | `null` | LLM prompt 处理语法性别的方式。`null` 保留 Champollion 目录中各语言的默认设置——对于法语，采用带间隔号（interpunct）的包容性书写（*écriture inclusive*）（`Connecté·e`、`Utilisateur·rice·s`）；对于德语，采用冒号形式（`Benutzer:innen`）。`false` 不发送性别指示；传入字符串可发送自定义指示（例如 `"Use the masculine generic."`）。也可按语言和语言对分别设置。参见[性别指引](#gender-guidance)。 |
| `protectedTerms` | `string[]` | `[]` | 在所有语言中需保持原样书写的名称：人名、公司名、产品名（例如 `["Curtis Forbes", "Game Day Suits"]`）。模型会被指示保留它们，且仅由这些名称组成的值绝不会被标记为未翻译或错误文字系统。这与 `noTranslate` 不同，后者跳过的是整个**键**。 |
| `jsonConcurrency` | `number` | `200` | JSON 键同步时的最大并发语言环境翻译数。可通过 `--json-concurrency` CLI 标志覆盖。 |
| `contentConcurrency` | `number` | `48` | 内容（Markdown/MDX）翻译时的最大并发 API 调用数。可通过 `--content-concurrency` CLI 标志覆盖。 |
| `fallbackPrefix` | `string` | `"[EN] "` | `audit` 和 `verify` 用于检测以往运行留下的历史未翻译值的标记前缀。Champollion 不会写入此项前缀——仅在检测时读取它。 |
| `apiKeyEnvVar` | `string` | `"OPENROUTER_API_KEY"` | API 密钥的环境变量名称。用于覆盖自定义环境变量名。 |
| `minContentRetention` | `number` | `0.35` | 在[内容删除检查](/docs/concepts/quality-gate)参考其第二个信号之前，输出必须保留的源文本字母/数字比例。也可按语言对和按语言分别设置。 |
| `noTranslate` | `string[]` | `[]` | 点路径键及 glob 模式，其值会逐字复制到每个语言环境中。参见[不翻译键](#no-translate)。也可写为 `skipKeys`。 |
| `noTranslateUrls` | `boolean` | `true` | 将纯 `scheme://` URL 的源文本值视为不翻译。设置为 `false` 可将值为 URL 的键发送至翻译后端。 |
| `baseUrl` | `string` | `""` | 用于 SEO 产物生成（hreflang、站点地图、JSON-LD）的基准 URL。 |
| `pairs` | `object` | `{}` | 针对特定语言对的方法、模型和质量覆盖项。参见[语言对配置](#pair-configuration)。 |
| `languages` | `object` | `{}` | 针对特定语言的覆盖项。参见[语言配置](#language-configuration)。 |
| `lint.srcDir` | `string` | `null` | 用于 lint 扫描的源码目录。`null` = 自动根据框架检测。 |
| `lint.ignore` | `string[]` | `["node_modules", ...]` | lint 扫描中要排除的 glob 模式。 |
| `lint.minLength` | `number` | `2` | 标记为硬编码的最小字符串长度。 |
| `seo.urlPattern` | `string` | `"/:locale/:path"` | 用于生成 hreflang 标签的 URL 模式模板。 |
| `seo.pages` | `string[]` | `null` | SEO 的显式页面列表。`null` = 自动从语言环境键中检测。 |
| `typegen.output` | `string` | `null` | 生成的 TypeScript 类型的输出路径。`null` = 禁用。 |
| `typegen.autoGenerate` | `boolean` | `false` | 每次同步后自动重新生成类型。 |

## 语言环境文件布局 {#locale-layouts}

Champollion 会直接从您的框架存放语言环境文件的位置读取它们。共有三种结构。

**每种语言一个文件**（`flat`）。next-intl、vue-i18n、Hugo 以及大多数自研配置：

```text
messages/
  en.json      ← source
  fr.json
  de.json
```

```json title="champollion.config.json"
{ "localesDir": "./messages" }
```

**每种语言一个文件夹**（`dir`）。i18next 和 react-i18next，其中每个文件代表一个*命名空间*（namespace）：

```text
public/locales/
  en/
    common.json      ← source namespaces
    admin/users.json
  fr/
    common.json
    admin/users.json
```

```json title="champollion.config.json"
{ "localesDir": "./public/locales" }
```

当 `<localesDir>/<inputLocale>/` 是语言环境文件文件夹时，Champollion 会选择 `dir`。每个源文件都会同步到每种语言文件夹下的相同路径，缺失的文件和文件夹会被自动创建。命名空间也可以是嵌套路径（`admin/users`）。

**任何其他结构**（`localesPattern`）。使用 `{lang}` 指定路径，如果一种语言包含多个文件，还可使用 `{ns}`：

```json title="champollion.config.json"
{ "localesPattern": "src/translations/{ns}/{lang}.json" }
```

`{lang}` 可以重复出现，如 `"{lang}/app_{lang}.json"`。`{ns}` 可以出现一次并可跨越文件夹。除非设置了 `format`，否则格式将根据扩展名推导。

`champollion init` 会为您自动查找这些布局。它首先会检查是否为 Flutter 应用（`pubspec.yaml`，存在时包含 `l10n.yaml`）和 gettext 目录（`locale/<lang>/LC_MESSAGES/`、`translations/`、GNU `po/`），并针对它们写入 `localesPattern`。然后它会检查框架通常使用的文件夹（next-intl 对应 `messages/`，i18next 依次检查 `public/locales/` 和 `locales/`，vue-i18n 对应 `src/locales/`，Hugo 对应 `i18n/`），接着检查 `locales`、`messages`、`i18n`、`lang`、`translations`、`public/locales`、`src/locales` 以及 `src/i18n`。它仅使用包含源语言文件的文件夹，并输出其找到的内容。`init --langs fr,de` 还会按该布局创建空的目标文件。

:::note[多文件语言如何同步]
每个文件都是独立比对、翻译和写入的。`.champollion.lock` 会将键记录为 `<namespace>::<key>`（`common::nav.home`），`--force-keys`、`xliff` 单元 ID 以及 `sync --dry --json` 亦是如此。`--force-keys` 中的裸键会匹配每个文件中的对应键。每种语言一个文件的项目保持普通的纯键格式，因此其锁文件不会改变。

翻译记忆库（Translation Memory）是以源文本为键进行索引的，而不是按文件。出现在两个命名空间中的同一字符串在每种语言中只需翻译一次。第二个文件直接从缓存中获取，无任何开销。
:::

如果 `en.json` 和一个已填充内容的 `en/` 文件夹同时存在，Champollion 会停止运行并要求您设置 `"localesLayout": "flat"` 或 `"dir"`，而不会擅自推测。

### i18next 复数键 {#i18next-plurals}

i18next 将复数形式存储为带有 CLDR 后缀的同级键：`item_one`、`item_other`。不同语言的复数形式各有差异。法语和西班牙语还使用 `_many`，阿拉伯语使用六种形式，而日语仅使用 `_other`。当 JSON 源文件包含这些键时，每个目标语言都会通过 JavaScript `Intl.PluralRules` API 从 CLDR 中读取，仅获取其自身语言所需的形式：

```json title="en.json"
{ "item_one": "{{count}} item", "item_other": "{{count}} items" }
```

同步后，`fr.json` 包含 `item_one`、`item_many` 和 `item_other`，而 `ja.json` 仅包含 `item_other`。同步会针对您配置的语言，说明每种语言新增或删除了哪些形式。

新形式会从源语言的 `_other` 文本翻译而来，`_one` 从 `_one` 翻译而来。源语言中的 `_zero` 会在所有语言中保留，因为 i18next 在所有语言中遇到数量为 0 时都会查找它。如果先前的同步写入了该语言不使用的形式（例如日语中的 `item_one`），仅当翻译记忆库显示该值是由同步生成时，同步才会将其移除。手动编写的值会被保留。若某个键属于该语言没有的形式，且源语言中也没有对应键（如西班牙语的 `item_two`），则绝不会被自动删除：`verify` 会指出它，而 `sync --prune plural-extras` 会精确删除这些键并列出每一项（加上 `--dry` 时，它会预告将要删除的内容）。对于 CLDR 中没有复数规则的语言，源语言的形式会一对一复制，同步时也会进行说明。

### ICU 消息 {#icu}

使用 ICU MessageFormat（next-intl、react-intl、vue-i18n、Flutter）编写的值会将代码与文本混在一起：

```json
{ "items": "{count, plural, =0 {No events} one {# event} other {# events}}" }
```

仅分支内部的文本会被翻译。[质量门禁](/docs/concepts/quality-gate)会拒绝更改了其他任何内容的翻译：

- 变量名（`count`、`{name}`），绝不会被重命名或遗漏；
- 关键词 `plural`、`select` 和 `selectordinal`，以及 `{price, number}` 的类型；
- 选择器（`=0`、`one`、`other`、`male`）。`select` 会完全保留其选项。`plural` 会保留源语言的选择器，并可根据 CLDR 添加目标语言所使用的类别：法语添加 `many`，波兰语添加 `few` 和 `many`。该语言不使用的类别可能会被丢弃，如日语仅保留 `other`；
- 每个包含它的复数分支中的 `#`，除了 `zero`、`one`、`two` 和 `=N`（在这些分支中语言可能会将数字写成文字）；
- `offset:N`、嵌套参数以及类似 `%s`、`%d` 和 `%(name)s` 的 printf 转换符。

模型会被告知目标语言使用了哪些类别。被拒绝的翻译会附带原因重试一次，例如 `ICU keyword 'other' was translated to 'óthér'`。占位符前带有单引号（`d'{name}`）是合法的。`verify` 和 `integrity` 会对已写入的文件运行相同的检查。普通的 `sync` 会保留磁盘上已有的值，因此每个发现的问题都会指出可修复它的命令：`champollion sync --pair <pair> --redo keys:<key>`。当受损的值来自翻译记忆库时，它们会将其从缓存中移除，以便该命令重新翻译该键，而不是返回相同的文本；无需使用 `--fresh`。

### gettext 目录文件 (.po) {#gettext}

将 `localesPattern`（或 `localesDir`）指向您的目录文件：

```json title="Django"
{ "localesPattern": "locale/{lang}/LC_MESSAGES/{ns}.po" }
```

```json title="GNU (po/fr.po, po/de.po, po/hello.pot)"
{ "localesDir": "./po", "format": "po" }
```

**源文件**即源语言的目录文件，例如来自 `django-admin makemessages -l en` 的 `locale/en/LC_MESSAGES/django.po`。当 `msgstr` 为空时，其 `msgid` 就是待翻译的文本。当该目录文件不存在时，源文件为 `.pot` 模板：

- 使用 `localesDir`：该文件夹中唯一的 `.pot`。
- 使用 `localesPattern`：位于第一个占位符之前的文件夹或其上一层文件夹中的 `<name>.pot`。`<name>` 是命名空间（`{ns}`，每个域一个模板，例如 `django.pot`），或者是不带 `{lang}` 的模式文件名（`messages.po` → `messages.pot`）。
- 使用 `localesLayout: "dir"`：不查找模板。将源目录文件保留在 `<localesDir>/<source>/` 中。

若在预期只有一个模板的位置出现了两个模板，将中止运行。Champollion 不会推测哪一个是源文件。

**键。**每个 `msgid` 都是一个键。带有 `msgctxt` 的条目以 `msgctxt` + U+0004 + `msgid` 为键，这是 gettext 自身的编码方式。动词“Open”和形容词“Open”是独立的键，也是独立的缓存条目。报告将分隔符输出为 `␄`（`verb␄Open`），且 `--force-keys "verb␄Open"` 接受此写法。如果您无法输入 `␄`，请写为 `\x04`（`--force-keys 'verb\x04Open'`）：两种写法均可。`--force-keys`（以及 `--redo keys:`）按逗号拆分；若 msgid 内部包含逗号，请写为 `\,` 并给参数加引号：`--redo 'keys:Welcome back\, %(name)s!'`。未修改的条目直接从缓存获取，无任何开销。

**翻译内容。**`msgstr` 为空或带有 `fuzzy` 标记的条目视为未翻译。同步会翻译它，并移除 `fuzzy` 以及 `#|` 先前 msgid 行。译者注释（`# …`）会被保留。引用（`#:`）、提取的注释（`#.`）和标志均来自源文件。`#.` 注释和 `msgctxt` 会作为上下文发送给模型。同步未更改的条目会按字节逐字写回。源文件中已不存在的条目以及已过时的 `#~` 条目会保留在末尾。

Champollion 创建的目录文件（`init --langs`，或针对尚无目录文件的语言环境执行同步）会获得 `msginit --no-translator` 所写入的完整头部，且符合 `msgfmt -c` 的要求：从模板复制 `Project-Id-Version`、`Report-Msgid-Bugs-To` 和 `POT-Creation-Date`（`PACKAGE VERSION` 会替换为项目的文件夹名称，且没有模板日期时不会生成 `POT-Creation-Date`），加上 `PO-Revision-Date`（文件创建时间）、`Last-Translator: Automatically generated`、`Language-Team: none`、`Language`、`MIME-Version: 1.0`、`Content-Type: text/plain; charset=UTF-8`、`Content-Transfer-Encoding: 8bit` 和 `Plural-Forms`。现有目录文件的头部绝不会被重写——仅会填补其中的占位符 `Plural-Forms` 或 `charset=CHARSET`。

**复数形式。**包含 `msgid_plural` 的条目会被翻译为单个 ICU 复数消息（`{n, plural, one {One file} other {%(count)d files}}`），因此模型会一次性写入所有形式。然后通过目标的 `Plural-Forms` 标头将其写入 `msgstr[0]`…`msgstr[n]`。每个索引均采用选择该索引的数字对应的 CLDR 类别。俄语 `nplurals=3` 对应 `one`、`few`、`many`。如果目标没有 `Plural-Forms` 标头，或仅包含模板占位符，它将获取 `msginit` 为该语言写入的标头，从而使目录的 `msgstr[]` 槽位与 gettext 和 Django 所选的槽位保持一致：法语为 `nplurals=2; plural=(n > 1);`，德语为 `nplurals=2; plural=(n != 1);`，俄语为 `nplurals=3; …`。在 `msginit` 中没有条目的语言将获得派生自 CLDR 的标头，并针对不超过 3,000 的每个数字以及大数对照 `Intl.PluralRules` 进行校验。如果某门语言的规则无法编写为 gettext 表达式，同步过程将中止并指出用于写入标头的命令：`msginit --locale=<lang> --input=<template>.pot`。若目录中没有某一形式对应的槽位（例如双形式目录中对应 1 000 000 的法语 `many`），则不会再次请求该形式，也不会将其标记或报告为缺失；拥有自身标头的目录会保留该标头，且实际检查的即为其自身的槽位。

**限制。**目录文件必须是 UTF-8 编码。其他编码请使用 `msgconv --to-code=UTF-8` 转换。大括号不配对的复数 msgid 无法写为 ICU 消息，因此会报错并交由您手动翻译。发布前仍建议运行 `msgfmt --check-format`（Django：`compilemessages`）。它只检查标记为 `#, python-format`（或 `c-format`, …）的条目：`makemessages` 会为其提取的带有 `%` 占位符的条目添加该标志，但手动创建的目录可能缺失该标志，从而导致这些条目未被检查。`champollion verify` 会比对每个条目的 printf 占位符（名称和类型字母），无论其标志为何，且同步会在其翻译的每个条目上保留源条目的标志。

### Flutter ARB 文件 (.arb) {#arb}

```json title="champollion.config.json"
{ "localesPattern": "lib/l10n/app_{lang}.arb" }
```

如果不同，请使用 `l10n.yaml` 中的 `arb-dir` 和 `template-arb-file`（`assets/i18n/intl_{lang}.arb`）。仅翻译消息文本。写入时：

- `@@locale` 会设置为 Flutter 格式的目标语言环境，与文件名一致（`app_pt_BR.arb` → `"pt_BR"`）。`gen-l10n` 会拒绝 `@@locale` 与文件名不一致的文件。
- 每个 `@key` 元数据对象（占位符、其类型、描述）都会从源文件复制。源文件没有元数据的键会保留目标文件原有的元数据。
- 键遵循源文件的顺序。未翻译的消息会被排除，以便 Flutter 回退到模板。

消息的 `description` 会作为上下文发送给模型。`{name}` 占位符和 ICU 复数受 [ICU 检查](#icu)保护。`verify` 和 `integrity` 还会报告错误的 `@@locale` 以及与源文件不同的占位符元数据。任何重写该文件的同步都会同时修复这两者：`champollion sync --pair en:fr --force` 从缓存中提供所有未更改的消息。

## 不翻译键 {#no-translate}

某些值在所有语言中都有且仅有一种正确的表现形式：URL、仓库路径、包名、产品标识符。`https://example.org/paper` 的正确翻译就是 `https://example.org/paper`。

Champollion 的[质量门禁](/docs/concepts/quality-gate)会拒绝“回显源文本”（source-echo）——即与源文本完全相同的翻译——因为这通常意味着模型拒绝执行翻译。对于这些键，这会导致正确答案反而被拒绝，且模型生成的任何输出都无法通过质量门禁。能力较弱的模型会学会通过对值做微小修改（编造 `#fragment`、多余的末尾斜杠、不可见的零宽字符）来规避门禁，从而导致发布损坏的链接。能力较强的模型则原样返回该值但通不过门禁，导致 `sync` 每次运行都返回非零退出码。

作为替代方案，请显式声明这些键：

```json title="champollion.config.json"
{
  "noTranslate": ["**.url", "pages.software.*.repo", "meta.appId"]
}
```

匹配的键将**逐字从源语言环境复制**——绝不会发送到翻译后端、绝不会经过质量门禁、绝不会计为失败，也绝不会计费。出于同样的原因，它也不会包含在运行前的成本预估中。

### 模式语法

模式是针对扁平化键空间的点路径，支持两种通配符：

| 模式 | 匹配 | 不匹配 |
|---------|---------|----------------|
| `nav.brand` | `nav.brand`（精确路径） | `nav.brandName` |
| `**.url` | `url`、`pages.a.b.url`（任意深度的 `url` 叶节点） | `pages.urlLabel`、`pages.url.caption` |
| `pages.software.*.repo` | `pages.software.portal.repo` | `pages.software.a.b.repo` |
| `meta.og*` | `meta.ogImage`、`meta.ogTitle` | `meta.twitterImage`、`meta.og.image` |

`*` 匹配单个分段内的内容；`**` 匹配零个或多个完整分段。
不带通配符的模式表示精确键路径。

### 默认处理 URL

因为在质量门禁下值为 URL 的键没有正确的处理结果，所以 `noTranslateUrls` 开箱即为 `true`：任何仅为绝对 `scheme://` URL 的源文本值无需配置即会被视为不翻译。

检测规则被故意设计得很严格——去除首尾空格后的整个值必须完全是 URL。
仅包含链接的普通文本（`"Read the paper at https://…"`）仍会正常翻译。

如果您的 URL 确实是特定于语言环境的（例如按语言划分的文档站点域名），请使用 `"noTranslateUrls": false` 将其关闭——然后使用 `noTranslate` 声明那些不需要翻译的项。

### 修复与强制校验

对于不翻译键，目标值有且仅有一种正确结果，因此任何差异都属于缺陷。Champollion 会进行双向强制校验：

- **`sync` 负责修复。**若不翻译键的目标值缺失、带有 `[EN] ` 前缀或被篡改，它将直接从源文本重写。这不消耗任何 API 调用，并且是幂等的：一旦值匹配，后续同步将完全跳过该键。
- **`verify` 和 `integrity` 对此报错。**发生漂移的不翻译键会被报告为 `NO-TRANSLATE DRIFT` 并显示预期值和实际值——不可见字符会被转义为 `\uXXXX`，因为这类损坏在 diff 中通常无法肉眼察觉。`champollion integrity` 会以 `1` 退出，因此与其挂接的构建流程可以在发布前捕获损坏的 URL。

如果 `integrity` 在您刚配置的项目上以此种方式报错，说明它报告的是您语言环境文件中早已存在的损坏。运行一次 `champollion sync` 即可将其修复。

## 文字系统转换 {#script-conversion}

Champollion 翻译的某些语言可以使用多种**文字系统**（script）进行书写。模型始终使用该语言的**工作文字系统**（拉丁罗马化转写——平原克里语采用标准罗马字正字法 SRO，克林贡语采用 Okrand 罗马化），然后确定性转换器可以将输出重写为显示用文字系统。是否应当转换是由配置决定的——**绝非默认行为**：

| 语言环境 | 工作文字系统 | 可转换为 | 类别 |
|--------|---------------|----------------|------|
| `crk`（平原克里语） | `Latn` (SRO) | `Cans`（音节文字） | 真实 Unicode——**必须选择** |
| `sr` / `srp`（塞尔维亚语） | `Latn` | `Cyrl`（西里尔字母） | 真实 Unicode——**必须选择** |
| `tlh`（克林贡语） | `Latn`（罗马化） | `Piqd` (pIqaD) | PUA——需主动启用 |
| `x-elvish-s`（辛达林语） | `Latn` | `Teng` (Tengwar) | PUA——需主动启用 |
| `x-kryptonian` | `Latn` | 氪星语（Kryptonian） | PUA——通过 `"script": "x-kryptonian"` 主动启用 |

**真实 Unicode 语言对（crk、sr）必须进行选择。**克里语音节文字和西里尔字母属于普通 Unicode 字符——它们在任何设备上都能正常渲染——且两种正字法都在实际使用中。Champollion 不会代表项目替特定社群挑选书写系统：`init` 会在您选择语言时进行询问，且在配置明确指定之前，`sync` 会拒绝运行：

```json
{
  "languages": {
    "crk": { "script": "Cans" }
  }
}
```

**PUA 文字系统（tlh、x-elvish-s、x-kryptonian）默认采用罗马化。**pIqaD、Tengwar 和 Kryptonian *并不在 Unicode 中*——转换器输出的是私有使用区（PUA）码点，除非您附带了映射到这些码点的字体，否则无法正常显示。罗马化是唯一能在所有地方正常渲染的输出，因此它是默认值。若要改用显示文字系统输出：

```json
{
  "languages": {
    "tlh": { "script": "Piqd" }
  }
}
```

……并运行 `champollion fonts install`，以便您的网站包含能够绘制该文字的字体。如果您的字体是以拉丁转写进行键位映射的（许多人造语言字体都是如此），请保留默认值。

`script` 接收 ISO 15924 代码，不区分大小写（`"cans"`、`"Cans"` 和 `"CANS"` 相同）。也可以针对每个语言对单独设置，且其优先级高于语言级别设置。无效的值或该语言环境无法生成的文字系统会在启动时直接报错——早于任何 API 调用。

### 未映射字母与 `scriptFallback` {#script-fallback}

转换器仅转换其正字法所定义的内容，其他一概不转。克林贡语罗马化中没有 `d`、`c`、`f`、`g`、`i`、`k`、`s`、`x` 或 `z`——因此包含专有名词如 "GitHub" 的模型输出无法完全转换。Champollion **绝不写入半转换的值**：只要有任何字母无法映射，整个值都会保留在工作文字系统中，并且警告会列出这些字母以及可用于映射它们的配置行。

这些映射规则由您自行声明：

```json
{
  "languages": {
    "tlh": {
      "script": "Piqd",
      "scriptFallback": { "d": "D", "f": "p", "z": "S" }
    }
  }
}
```

在执行转换前，每条规则会将工作文字系统中的序列替换为转换器*能够*映射的序列。规则会在启动时进行验证——替换项本身若无法映射则会被拒绝。

Champollion **不自带任何回退规则**：自行发明正字法改写（尤其是对于真实语言的书写系统而言）绝非工具库应当擅自越权做出的决定。相关社群和同好圈子都有既定约定——请在每个项目中审慎地采纳它们。

### 修复非预期的文字转换 {#repair-script}

在 0.3.0 之前，转换是无条件的——无论是否需要，面向 PUA 语言环境的项目都会获得无法正常渲染的输出。现提供两个工具来解决这一问题：

- **`champollion repair-script`** 扫描配置中将转换设为*关闭*的语言环境中的 PUA 码点，并使用转换器自带的反向映射表将其恢复为罗马化形式（使用 `--dry` 可进行预览）。pIqaD 可以完全反向还原；Tengwar 和 Kryptonian 的反向还原会丢失大小写并进行相应提示。
- **`champollion integrity`** 在转换关闭的情况下若检测到 PUA 码点则报错失败（exit 1）——这样构建门禁就能在发布前拦截不可渲染的文本，且报告会指明修复方法。

翻译记忆库绝不需要修复：它存储的是转换前的值，因此后续开启或关闭 `script:` 无需对缓存进行任何处理。

文字系统转换适用于 UI 字符串（键值文件和 Docusaurus JSON）。Markdown 正文绝不会被转换——贪婪的字符转换器无法安全地穿透代码段、URL 和 front matter。

## 对配置 {#pair-configuration}

每个源→目标对可以独立配置：

```json
{
  "pairs": {
    "en:fr": {
      "method": "google-translate",
      "qualityTier": "high"
    },
    "en:ja": {
      "method": "llm",
      "model": "google/gemini-3.1-pro-preview"
    },
    "en:crk": {
      "method": "llm-coached"
    }
  }
}
```

### 对字段

| 字段 | 类型 | 描述 |
|-------|------|-------------|
| `method` | `string` | 翻译方法：`llm`、`llm-coached`、`openai`、`anthropic`、`gemini`、`local`、`google-translate`、`deepl`、`microsoft-translator`、`libretranslate`、`apertium`、`tilde`、`translated`、`api` |
| `methodPlugin` | `string` | 已安装插件的名称（来自 `.champollion/methods/`） |
| `model` | `string` | 覆盖此语言对的默认模型 |
| `temperature` | `number` | 覆盖此语言对的默认温度 |
| `batchSize` | `number` | 覆盖此语言对的默认批处理大小 |
| `register` | `string` | 语域/语调覆盖（预设键或自由格式文本） |
| `endpoint` | `string` | 远程 API 端点 URL。当 `method` 为 `api` 时为必填项。 |
| `coachingFile` | `string` | 此语言对的辅导 prompt 文件路径，相对于项目读取；它会替换任何针对性更弱的辅导 prompt，若文件无法读取则会中止运行 |
| `promptContext` | `string` | 此语言对的应用上下文 |
| `genderGuidance` | `string` \| `false` | 此语言对 prompt 的性别指示：您自定义的文本，或填 `false` 表示无指示。参见[性别指引](#gender-guidance)。 |
| `qualityTier` | `string` | 您为此语言对输出指定的标签：`standard`、`high`、`research`、`verified`。不参与衡量，无论其内容为何，同步翻译行为均一致；`status` 会显示它（仅在设置时），`serve` 会展示它 |
| `fallback` | `object` | 备用方法，用于处理该语言对的主要方法无法安全翻译的内容。参见[回退方法](#fallback)。`null` 可移除在语言级别设置的回退方法。 |

### 回退方法 {#fallback}

每个语言对都可以指定第二种方法。语言对自身的方法会先执行翻译。凡是其无法安全翻译的内容都会转交给回退方法处理一次：

- **键值文件：**[质量门禁](/docs/concepts/quality-gate)拒绝的键（遗漏 `{name}`、复数损坏、将两词标签扩展成一段话等）以及该方法未返回任何内容的键。
- **Markdown（Hugo 内容和 Docusaurus 文档）：**遗漏或清空文本的 front-matter 字段，以及在响应中遗漏、损坏（丢失受保护元素：代码、HTML 标签、shortcode）或清空的正文块。在 `page` 分段模式下，则为整个页面。

```json
{
  "pairs": {
    "en:crk": {
      "method": "api",
      "endpoint": "http://127.0.0.1:8378/translate",
      "fallback": { "method": "llm-coached", "model": "google/gemini-3.8-flash" }
    }
  }
}
```

当任何文本都不能离开您的机器时（医院、学校、在本地保留语言数据的社群），可将回退方法配置为您自行运行的模型。`local` 方法会发送给本地机器上兼容 OpenAI 的服务器（Ollama、llama.cpp、vLLM、LM Studio；`LOCAL_API_BASE` 用于设置地址，参见 [`local`](/docs/guides/translation-methods#local--your-own-model-ollama-vllm-lm-studio-a-trained-model)）：

```json
{
  "pairs": {
    "en:crk": {
      "method": "api",
      "endpoint": "http://127.0.0.1:8378/translate",
      "fallback": { "method": "local", "model": "<your local model>" }
    }
  }
}
```

如何选择：

- **托管模型**（搭配 Gemini 模型的 `llm-coached` 或其他 API 方法）通常是针对低资源语言更强大的第二备选方案，按请求计费。在允许将文本发送至该提供商时使用。
- **`local`** 将所有键保留在本机，且预估成本显示为 `$0 API cost (runs on this machine)`。在任何内容都不得离开本机时使用，即使能在本机运行的模型规模较小。

回退方法的输出同样会经过质量门禁。其翻译的内容会在翻译记忆库中按其自身的方法进行缓存，因此缓存会记录每个值是由哪个方法生成的。后续同步会复用该值，而不会再次请求第一个方法；使用 `--fresh` 或 `--retranslate` 会重新发起请求。两种方法均未翻译的内容将保持未配置回退时的状态。键保持未翻译状态并保留其原有的 lock 条目，因此下次同步会重试该键，且 `champollion verify` 会列出它。Markdown 块会写入为带有 `[EN] ` 前缀的源文本，不进行缓存，且下次同步时会重新处理该文件。两种方法都被质量门禁拒绝的块或 front-matter 字段会被暂扣（held back），在 `--redo files:<page>` 指定该页面之前不会再次发送给它们（[被拒绝的 Markdown 块与 front-matter 字段](/docs/concepts/quality-gate#refused-markdown-blocks-and-front-matter-fields)）。若两种方法都清空了某个 front-matter 字段，或两者都未翻译某个页面，则该文件处理失败，与未设置回退方法时相同。

回退方法支持与语言对相同的字段：`method`（必填）、`model`、`provider`、`endpoint`、`methodPlugin`、`coachingFile`、`coachingPrompt`、`promptContext`、`register`、`temperature`、`batchSize`、`maxRetries`、`qualityTier`、`contentSegmentation`、`name`。其解析机制与语言对相同。未显式设置的字段（语域、辅导 prompt、prompt 上下文……）均继承自该语言对。其自身的 `coachingFile` 会传递到其 prompt 和缓存键中，且 `champollion status` 会显示它。书写系统属于语言对，因此回退方法上禁止配置 `script` 和 `scriptFallback`，且回退方法也不支持嵌套配置其自身的 `fallback`。若指定未知的方法，或回退方法与其语言对完全相同，同步将停止并报错指出该语言对。在同步开始前，回退方法必须已准备就绪，就像该语言对的主方法一样（例如必须已设置其 API 密钥）。

- **`--method` 和 `--model` 仅修改语言对自身的方法。**回退方法仍保留配置文件中的设置。
- **成本。**运行前预估仅涵盖语言对自身的方法：事先无法预知哪些内容会失败。每个回退批次都在运行前由同一个预估器即时计价。在使用 `--max-cost` 的情况下，若某个批次会导致总运行开销超出上限（预估值加上截至目前每个回退批次的开销），则会跳过该批次，并发出警告指出对应的键。无法估算成本的回退方法也会被跳过（未知不代表免费）。这些键将保持失败状态，且同步会像发生任何部分失败一样返回非零退出码。
- **报告。**`sync` 会针对每个语言对输出一行，例如 `[FALLBACK] en:crk — 6 key(s) the primary (api) could not translate safely → translated by llm-coached (4 accepted, 2 still failing)`。`--json` 摘要会按语言对说明回退方法所执行的操作（`method`、`attempted`、`accepted`、`failed`、`cached`）：键值文件记录在 `locales` 的每个条目中，Docusaurus JSON 记录在 `fallback` 中，Markdown 记录在 `content.fallback` 中。`champollion status` 会在语言对下方显示回退方法。`--dry` 无法预知会失败的内容，因此不会报告任何关于回退方法的信息。
- **当回退方法承担了大部分翻译时。**某次运行中若某个语言对的新翻译（该语言对方法接受的译文加上回退方法的译文）超过一半来自回退方法，`sync` 会添加一条警告：数量占比、所用方法和模型、为何未使用语言对主方法的译文（统计每种原因：针对不同源字符串重复死记硬背的句子、长度过度膨胀……），以及应对建议——主方法可能不适合这些字符串；检查已写入的内容（`verify` 检查结构，母语者检查含义）；更换更强的回退方法。`--json` 条目在 `accepted` 旁还带有 `primaryAccepted` 和 `primaryReasons`。`champollion status` 会针对文件给出相同的比例（“from the fallback: 8 value(s) in the files (…) — 8 of the 8 sync wrote (100%)”），并在其占语言环境文本大部分时给出说明。
- `champollion serve` 也会使用回退方法，但受其 `--max-cost-per-request` / `--max-session-cost` 上限约束。

## 语言配置 {#language-configuration}

语言接受三种格式：

### 代码数组（最简单）

```json
{
  "languages": ["fr", "de", "ja"]
}
```

每种语言从内置寄存器表获取其默认寄存器。没有默认值的语言获得 `"Professional register."`。

### 带有寄存器字符串的对象

该值可以是语言卡中的**预设键**，或自定义寄存器文本：

```json
{
  "languages": {
    "fr": "casual-tu",
    "ko": "formal-hapsyo",
    "ja": "Custom: Polite Japanese for a gaming app."
  }
}
```

Champollion 检查字符串是否与语言卡中的预设键匹配。如果匹配，则使用卡中的完整寄存器提示。如果不匹配，则按原样使用字符串。有关可用预设，请参见[支持的语言](/docs/reference/supported-languages#language-cards)。

### 带有完整配置的对象

```json
{
  "languages": {
    "crk": {
      "name": "Plains Cree",
      "register": "SRO syllabics with grammatical precision.",
      "model": "google/gemini-3.1-pro-preview",
      "batchSize": 5,
      "maxRetries": 5,
      "script": "Cans"
    }
  }
}
```

您可以在同一块中混合简写和完整对象。


### 语言字段

| 字段 | 类型 | 描述 |
|-------|------|-------------|
| `register` | `string` | 风格/语调指示。可以是**预设键**（例如 `casual-tu`、`formal-hapsyo`）或自定义文本。参见[语言卡片](/docs/reference/supported-languages#language-cards)。 |
| `name` | `string` | 人类可读的语言名称（用于状态显示） |
| `model` | `string` | 覆盖默认模型 |
| `temperature` | `number` | 覆盖默认温度 |
| `batchSize` | `number` | 覆盖默认批处理大小 |
| `coachingFile` | `string` | 此语言的辅导 prompt 文件路径，相对于项目读取；它会替换顶级辅导 prompt，若文件无法读取则会中止运行 |
| `promptContext` | `string` | 此语言的应用上下文 |
| `genderGuidance` | `string` \| `false` | 此语言 prompt 的性别指示：您自定义的文本，或填 `false` 表示无指示。参见[性别指引](#gender-guidance)。 |
| `maxRetries` | `number` | 失败批次的最大重试次数预算（默认值：3） |
| `script` | `string` | Champollion 写入的正字法的 ISO 15924 代码（例如 `"Cans"`、`"Piqd"`）。参见[文字系统转换](#script-conversion)。 |
| `scriptFallback` | `object` | 针对文字系统转换器无法映射的字母的转写规则。参见[文字系统转换](#script-conversion)。 |
| `endpoint` | `string` | 远程 API 端点 URL，用于 `"method": "api"` |
| `fallback` | `object` | 备用方法，用于处理该语言的方法无法安全翻译的内容。参见[回退方法](#fallback)。 |

:::info[继承链]
设置按此顺序解析（首先获胜）：

**对级别** → **语言级别** → **全局配置** → **默认值**

例如，如果 `pairs["en:fr"]` 设置 `model`，它会覆盖语言级别和全局 `model` 值。
:::

### 性别指引 {#gender-guidance}

对于具有语法性别的语言，LLM prompt 会附带一条关于语法性别的指示。该指示来自 Champollion 的目录：法语在读者性别未知时要求采用带间隔号的包容性书写（*écriture inclusive*）（使用 `Connecté·e`，而非 `Connecté(e)` 或 `Connectée`；复数形式使用 `Utilisateur·rice·s`），德语采用冒号形式（`Benutzer:innen`），日语采用中性的 `私`。`champollion init` 会在各语言的语域旁打印该指示，而 `champollion status` 会按语言对显示该指示及其来源。

使用 `genderGuidance` 可以为所有语言或单个语言选择其他风格：

```json
{
  "languages": {
    "fr": { "register": "formal-vous", "genderGuidance": "Use the masculine generic (Connecté), as the Académie française recommends." },
    "de": { "register": "formal-Sie", "genderGuidance": false }
  }
}
```

`false` 表示不发送性别指示；传入字符串则会替换目录中的指示。此设置仅适用于接收指示的方法（LLM 方法）；机器翻译引擎（DeepL、Google 等）不会收到该指示。修改后的性别指示构成不同的 prompt，因此拥有独立的缓存条目：已翻译的内容会保持原样，直到您重新翻译（`champollion sync --redo all`，当文件仍保留早期风格时，同步会给出此建议）。

## 非英文源

如果您的源语言不是英文：

```bash
# CLI flag (one-time)
npx champollion sync --source fr
```

```json title="champollion.config.json (permanent)"
{
  "inputLocale": "fr"
}
```

## 锁定文件

Champollion 会创建 `.champollion.lock` 来跟踪已翻译源文本值的 SHA-256 哈希。**请将此文件提交至版本控制**，以确保所有开发者共享同一翻译基线。在每种语言一个文件夹的项目中，键会被记录为 `<namespace>::<key>`。

对于每个目标语言环境，锁文件还会记录同步写入的每个值及其翻译的源文本的指纹（以便识别经人工编辑的值并报告过时的翻译）、redo 未能完成的键（**pending**），以及质量门禁拒绝的键（针对同一模型予以**暂扣（held back）**）。当需要记录上述任何内容时，该文件会采用版本 2 格式，即 `{"version": 2, "source": {…}, "locales": {…}}`；版本 1 的锁文件（扁平的 key → hash 映射）仍按原方式读取。被替换的手工编辑内容会保存在其旁边的 `.champollion-replaced-edits.jsonl` 中——两者均请提交。参见[质量门禁](/docs/concepts/quality-gate#refused-keys-are-held-back)与[编辑翻译](/docs/guides/professional-translators#editing-key-value-files)。

当源值更改时，哈希不再匹配，champollion 会在下次同步时重新翻译该键。

## `.champollionignore`

在项目根目录创建 `.champollionignore` 以从 `lint` 扫描中排除文件。使用 glob 模式，如 `.gitignore`：

```text title=".champollionignore"
src/components/legacy/**
src/utils/constants.js
**/*.test.js
```

## `.champollion/` 目录

Champollion 会在您的项目根目录下创建一个 `.champollion/` 目录用于存放内部状态。请勿将其纳入版本控制——它是单机缓存，并非项目源码。`champollion init` 会将此行添加到 `.gitignore` 中，如果文件不存在则会创建它（即使在尚非 git 仓库的文件夹中也是如此，以防日后执行 `git init` 和 `git add --all` 时误将缓存提交）：

```gitignore
.champollion/
```

请提交其旁边的锁文件（`.champollion.lock`、`.champollion-content.lock`）：它们记录了每条译文是由哪段源文本翻译而来的。

| 文件 | 用途 | 是否提交？ |
|------|---------|--------|
| `tm.json` | 翻译记忆库缓存——以源文本 + 语言环境 + 方法为键存储先前的翻译 | 否（本地缓存） |
| `xliff/*.xliff` | 供专业译员审校的 XLIFF 导出文件 | 否（临时文件） |
| `methods/` | 已安装的方法插件清单 | 已被 `.champollion/` 行忽略。若要共享已安装的插件，请将该行替换为 `.champollion/*` 和 `!.champollion/methods/` |
| `backups/` | 自动换行前备份（由 `wrap --undo` 创建） | 否（安全防范） |

有关 `tm.json` 的详细信息以及它如何节省 API 成本，请参见[翻译记忆](/docs/concepts/translation-memory)。

---

## 程序化 API

对于构建脚本和自定义集成，直接从包导入：

```javascript
import { GeminiMethod, runSync, resolveConfig } from 'champollion';

// Use a method class directly
const gemini = new GeminiMethod();
const result = await gemini.translate(
  ['greeting', 'farewell'],
  { greeting: 'Hello', farewell: 'Goodbye' },
  { target: 'fr', name: 'French', register: 'formal', model: 'gemini-2.5-flash' },
  { cwd: process.cwd() }
);
// result = { greeting: 'Bonjour', farewell: 'Au revoir' }
```

### 可用导出

| 导出项 | 功能说明 |
|--------|-------------|
| `TranslationMethod` | 所有方法的基类 |
| `LLMMethod` | LLM 方法的基类 (OpenRouter) |
| `DirectLLMMethod` | 直连 LLM 提供商的基类 (OpenAI, Anthropic, Gemini) |
| `OpenAIMethod`, `AnthropicMethod`, `GeminiMethod` | 直连 LLM 提供商类 |
| `DeepLMethod`, `MicrosoftTranslatorMethod`, `LibreTranslateMethod`, `TildeMethod`, `TranslatedMethod` | 传统机器翻译类 |
| `GoogleTranslateMethod` | Google Cloud Translation |
| `LLMCoachedMethod` | 带辅导 prompt 的 LLM (OpenRouter + 辅导数据) |
| `APIMethod` | 远程 API 客户端 |
| `runSync`, `runContentSync` | 完整同步流水线 |
| `translateWithFallback`, `translateAndValidate` | 单个语言对处理一批键的流水线，正如 `sync` 运行的方式：缓存、方法、质量门禁、缓存，然后是该语言对的回退方法。传入来自 `resolvePairs` 的语言对、来自 `loadTM` 的 `tm` 以及项目目录 `cwd`：方法会在此处读取其密钥、端点、辅导 prompt 和术语表，而不是从 `process.cwd()` 中读取 |
| `createFallbackBudget` | 针对回退批次的 `--max-cost` 保护守卫 (`{ maxCost, committed, cwd }`) |
| `discoverLocaleLayout`, `resolveLocaleFiles` | 构成每个语言环境的文件（扁平结构、每语言环境一个文件夹或 `localesPattern`） |
| `resolveConfig`, `resolvePairs` | 配置解析 |
| `validateTranslations` | 质量门禁 |
| `loadCoachingData`, `findDictionaryMatches` | 辅导实用工具 |

### 自定义提供商扩展

扩展 `DirectLLMMethod` 以在约 40 行中添加新的 LLM 提供商：

```javascript
import { DirectLLMMethod } from 'champollion';

class MistralMethod extends DirectLLMMethod {
  constructor(options) {
    super(options);
    this.name = 'mistral';
  }
  _getApiKeyEnvVar()     { return 'MISTRAL_API_KEY'; }
  _getApiKeyOptionsKey() { return 'mistralApiKey'; }
  _getDefaultModel()     { return 'mistral-large-latest'; }
  _getProviderLabel()    { return 'Mistral'; }

  _buildApiRequest({ prompt, systemMessage, apiKey, model, temperature }) {
    return {
      url: 'https://api.mistral.ai/v1/chat/completions',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: {
        model,
        messages: [
          ...(systemMessage ? [{ role: 'system', content: systemMessage }] : []),
          { role: 'user', content: prompt },
        ],
        temperature,
      },
    };
  }

  _extractResponseText(json) {
    return json.choices?.[0]?.message?.content;
  }

  // Optional but recommended: provider-specific setup help when translation fails
  getSetupHelp() {
    if (!process.env.MISTRAL_API_KEY) {
      return [
        '',
        '  ┌─ Missing API Key ─────────────────────────────────────────────┐',
        '  │ Mistral requires an API key from https://console.mistral.ai   │',
        '  │ Run: export MISTRAL_API_KEY=...                               │',
        '  └────────────────────────────────────────────────────────────────┘',
      ];
    }
    return ['        API key is set but translation failed. Check your Mistral dashboard.'];
  }
}
```

您可以免费获得翻译、指导、重试循环、模型验证、质量层级和设置帮助。只有 HTTP 请求形状是特定于提供商的。对于使用原始 `fetch()` 的非 LLM 适配器，请使用来自 `lib/methods/fetch-with-retry.js` 的共享 `fetchWithRetry()` 助手，而不是编写自己的重试循环。

---

## 另请参阅

- [CLI 参考](/docs/reference/cli) — 所有命令和标志
- [翻译方法](/docs/guides/translation-methods) — 选择和混合方法
- [翻译记忆](/docs/concepts/translation-memory) — 缓存和成本节省
- [与专业翻译人员合作](/docs/guides/professional-translators) — XLIFF 工作流
- [插件规范](/docs/reference/plugin-spec) — 方法插件清单格式
- [架构](/docs/concepts/architecture) — 各部分如何连接
- [支持的语言](/docs/reference/supported-languages) — 内置语言支持
- [同步如何工作](/docs/concepts/how-sync-works) — 翻译管道
