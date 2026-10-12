# 集成指南

与流行框架集成 Champollion 的分步设置。

本页中的命令均使用 `npx --yes champollion@0.5 <command>` 运行 champollion：锁定在 0.5 版本线，正如 [CI 指南](/docs/guides/ci-cd) 中所述，从而确保你的本地电脑与 CI 运行完全相同的版本，避免新版本发布带来意外变动。另一种方式是在本地项目中安装。在 Node 项目中，`npm install --save-dev champollion@0.5` 会将其添加到 `package.json` 中，随后即可使用 `npx champollion sync` 运行该副本。

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

最适合：海量键值字符串对（194 种语言）。**不推荐**用于 Markdown 内容——Google Translate 无法识别代码块、短代码（shortcode）或插值变量。

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

运行 `npx --yes champollion@0.5 init --yes --langs fr,de,ja,es,ko,zh,pt,ar`。它会找到 `messages/en.json`，创建空的目标文件，并写入类似下文的配置。或者你也可以自行创建 `champollion.config.json`：

```json
{
  "version": 3,
  "inputLocale": "en",
  "localesDir": "./messages",
  "languages": {
    "fr": "formal-vous", "de": "formal-Sie", "ja": "polite", "es": "neutral-latam",
    "ko": "polite-haeyo", "zh": {}, "pt": "professional", "ar": {}
  }
}
```

每个目标语言的语域（语气与正式度）都会写入 `languages` 中，以便清晰查看与编辑：可以将其更改为该语言的另一个预设（`champollion status` 列出了这些预设），或者更改为你自定义的描述。没有预设的语言会记录为 `{}`。普通列表格式 `"languages": ["fr", "de"]` 同样支持，并将使用每种语言的默认值。

```bash
npx --yes champollion@0.5 sync
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

### 每个语言一个文件夹（i18next 默认结构）

```
public/locales/
├── en/
│   ├── common.json        ← source namespaces
│   └── admin/users.json
├── fr/
└── ja/
```

```bash
npx --yes champollion@0.5 init --yes --langs fr,de,ja
```

`init` 会找到 `public/locales/en/`（或 `locales/en/`），将配置指向该目录，并将 `fr/common.json`、`fr/admin/users.json` 以及其他文件创建为空文件。其写入的配置相关部分如下：

```json
{
  "version": 3,
  "inputLocale": "en",
  "localesDir": "./public/locales",
  "languages": { "fr": "formal-vous", "de": "formal-Sie", "ja": "polite" }
}
```

```bash
npx --yes champollion@0.5 sync
```

每个命名空间文件都会被翻译并写入到每种语言文件夹下的相同路径中。出现在多个命名空间中的字符串针对每种语言仅翻译一次；其他文件将直接从翻译记忆库中获取。复数键（`key_one`、`key_other`）会通过 JavaScript `Intl.PluralRules` API 从 CLDR 读取并获得每种语言专属的形式：目标语言使用但源语言缺失的形式会被添加，目标语言不使用的形式则会被省略。以英语为源语言时，西班牙语和法语会增加 `key_many`，俄语会增加 `key_few` 和 `key_many`，而日语仅保留 `key_other`。同步命令会针对你所配置的语言明确列出各自增加的形式。详见 [i18next 复数键](/docs/getting-started/configuration#i18next-plurals) 和 [语言文件布局结构](/docs/getting-started/configuration#locale-layouts)。

### 每个语言一个文件

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

### 其他布局结构

如果你的文件遵循其他模式，可以使用 `localesPattern` 进行描述（`{lang}` 表示语言，`{ns}` 表示命名空间）：

```json
{
  "version": 3,
  "inputLocale": "en",
  "localesPattern": "src/i18n/{ns}/{lang}.json",
  "languages": ["fr", "de", "ja"]
}
```

---

## Flutter (ARB)

### 项目结构

`flutter gen-l10n` 会为每种语言读取一个 `.arb` 文件。英文文件作为模板：

```
my_app/
├── l10n.yaml              ← optional: arb-dir, template-arb-file
├── lib/
│   └── l10n/
│       ├── app_en.arb     ← source of truth (template)
│       ├── app_fr.arb
│       └── app_pt_BR.arb
└── pubspec.yaml           ← flutter: generate: true
```

### 设置

```bash
npx --yes champollion@0.5 init --yes --langs fr,de,pt_BR
```

`init` 读取 `pubspec.yaml` 和 `l10n.yaml`（`arb-dir`、`template-arb-file`），从模板名称中提取源语言（`app_en.arb` → `en`），并生成带有各自 `@@locale` 的 `app_fr.arb`、`app_de.arb` 和 `app_pt_BR.arb`。它写入的配置如下：

```json
{
  "version": 3,
  "inputLocale": "en",
  "localesPattern": "lib/l10n/app_{lang}.arb",
  "languages": { "fr": "formal-vous", "de": "formal-Sie", "pt_BR": "professional" }
}
```

如果 `l10n.yaml` 设置了 `arb-dir: assets/i18n` 和 `template-arb-file: intl_en.arb`，则文件匹配模式为 `"assets/i18n/intl_{lang}.arb"`。

```bash
npx --yes champollion@0.5 sync
flutter gen-l10n
```

仅翻译消息内容。每个目标文件的 `"@@locale"` 都会设置为其自身的语言区域，书写方式与文件名保持一致（`"pt_BR"`），因为 `gen-l10n` 会拒绝 `@@locale` 与文件名不一致的文件。所有 `@key` 元数据对象（如占位符及其类型）都会从 `app_en.arb` 原样复制。键的顺序遵循模板的顺序；尚未翻译的消息会被省略，以便 Flutter 回退到英文版本。

模板元数据中的描述信息将作为上下文发送给模型：

```json title="lib/l10n/app_en.arb"
{
  "@@locale": "en",
  "itemCount": "{count, plural, =0{No items} one{1 item} other{{count} items}}",
  "@itemCount": {
    "description": "Badge on the cart icon",
    "placeholders": { "count": { "type": "int" } }
  }
}
```

`{count, plural, …}` 语法、`{count}` 占位符和选择器均受到保护：任何改动它们的翻译都将被拒绝并重试（参见 [ICU 消息](/docs/getting-started/configuration#icu)）。法语可能会增加 `many` 分支，波兰语则增加 `few` 和 `many`。`champollion verify` 还会检查每个目标文件的 `@@locale` 和占位符元数据。如果之前的工具有误翻译了它们，`champollion sync --pair en:fr --force` 会重写该文件。未修改的消息直接从缓存中读取，零开销。

### Flutter 自带列表之外的语言区域 {#flutter-locales-outside-flutters-own-list}

你的应用消息来自 `.arb` 文件。而 Flutter 自身组件内的文本——如日期选择器、“返回”、“取消”、文本方向等——则来自 `flutter_localizations`（`GlobalMaterialLocalizations`、`GlobalCupertinoLocalizations`），它只涵盖一份固定的语言列表（[Flutter 语言列表](https://api.flutter.dev/flutter/flutter_localizations/GlobalMaterialLocalizations-class.html)）。私有代码（如 `qaa`）以及大多数低资源语言均不在该列表中。如果 `supportedLocales` 中包含此类语言区域，除非有委托（delegate）提供这些文本，否则应用在运行时会报错（"No MaterialLocalizations found"）。`init` 以及创建新 `.arb` 文件的同步操作都会针对列表中未包含的每个目标语言给出提示：它们会从本地机器上的 Flutter SDK（`FLUTTER_ROOT` 或 `PATH` 中的 `flutter`）读取该列表；若未检测到 SDK，则会明确指出哪些目标语言无法进行检查。

最简单的修复方法是将这些组件的文本借用自 Flutter 已支持的某种语言（这里以英语为例）：

```dart title="lib/fallback_localizations.dart"
import 'package:flutter/widgets.dart';

/// Flutter's own widget text for the app's locales flutter_localizations
/// does not cover, borrowed from a locale it does cover.
class FallbackLocalizationsDelegate<T> extends LocalizationsDelegate<T> {
  const FallbackLocalizationsDelegate(this.covered, this.languages);

  final LocalizationsDelegate<T> covered; // e.g. GlobalMaterialLocalizations.delegate
  final Set<String> languages;            // your codes outside Flutter's list

  @override
  bool isSupported(Locale locale) => languages.contains(locale.languageCode);

  @override
  Future<T> load(Locale locale) => covered.load(const Locale('en'));

  @override
  bool shouldReload(FallbackLocalizationsDelegate<T> old) => false;
}
```

将其列在 Flutter 自带委托的后面：

```dart
MaterialApp(
  localizationsDelegates: const [
    AppLocalizations.delegate,
    GlobalMaterialLocalizations.delegate,
    GlobalWidgetsLocalizations.delegate,
    GlobalCupertinoLocalizations.delegate,
    FallbackLocalizationsDelegate<MaterialLocalizations>(GlobalMaterialLocalizations.delegate, {'qaa'}),
    FallbackLocalizationsDelegate<CupertinoLocalizations>(GlobalCupertinoLocalizations.delegate, {'qaa'}),
  ],
  supportedLocales: AppLocalizations.supportedLocales,
  // …
)
```

这样，组件就会在应用自身文本为你所选语言的环境中显示英文标签。若要同时翻译这些组件的文本，Flutter 指南中提供了为新语言实现完整 `MaterialLocalizations` 的说明：[添加对新语言的支持](https://docs.flutter.dev/ui/accessibility-and-internationalization/internationalization#adding-support-for-a-new-language)。

---

## Django 与 gettext (.po)

champollion CLI 基于 [PolyForm Noncommercial License 1.0.0](https://github.com/gamedaysuits/Champollion/blob/main/cli/LICENSE) 开放源码：可免费用于非商业用途的使用、修改和共享。用于商业目的不受此许可证保护（[谁可以使用](/docs/getting-started/who-may-use-this)）。

### 项目结构

```
my_site/
├── manage.py
└── locale/
    ├── en/LC_MESSAGES/django.po    ← source catalog (makemessages -l en)
    ├── fr/LC_MESSAGES/django.po
    └── ru/LC_MESSAGES/django.po
```

### 设置：LOCALE_PATHS 与 LANGUAGES {#django-locale-paths}

Django 会在 `LOCALE_PATHS` 列出的文件夹以及每个已安装应用的 `locale/` 文件夹中查找语言包。位于 `manage.py` 旁的 `locale/` 不属于任何特定应用，因此在 `LOCALE_PATHS` 指定它之前，虽然 `compilemessages` 仍会构建其 `.mo` 文件，但网站仍会继续显示未翻译的文本。`LANGUAGES` 是网站提供的语言列表；Django 默认包含其自带的所有语言，因此请明确列出你自己的语言：

```python title="settings.py"
LOCALE_PATHS = [BASE_DIR / "locale"]   # BASE_DIR: the folder with manage.py (startproject defines it)
LANGUAGES = [("en", "English"), ("fr", "Français"), ("ru", "Русский")]
```

### 设置

首先使用 Django 创建或刷新语言包。英文语言包作为源文件。其中空的 `msgstr` 表示“msgid 即为文本内容”：

```bash
django-admin makemessages -l en -l fr -l ru
npx --yes champollion@0.5 init --yes --langs fr,ru
```

`init` 会检测到 `manage.py` 和 `locale/en/LC_MESSAGES/django.po` 并生成：

```json
{
  "version": 3,
  "inputLocale": "en",
  "localesPattern": "locale/{lang}/LC_MESSAGES/{ns}.po",
  "languages": { "fr": "formal-vous", "ru": "formal-vy" }
}
```

`{ns}` 为 gettext 域，因此 `django.po` 和 `djangojs.po` 都会被同步。

**默认配置包含语域和性别风格；`init` 会打印两者。** `formal-vous` 要求模型使用“正式法语。一贯使用敬称（vouvoiement）。专业、学术语域。”法语的性别指引要求在读者性别未知时使用带有间隔号（middle dot）的包容性写作（*écriture inclusive*）（`Connecté·e`、`Utilisateur·rice·s`）；俄语（`formal-vy`）则采用阳性，即常规默认形式。如果网站需要其他风格（例如诊所的患者页面），可在 `champollion.config.json` 中修改：在 `languages` 中调整语域（`"fr": "casual-tu"` 或自定义词句），以及在 `genderGuidance` 中设置——不加指令填 `false`，或使用自定义说明，例如 `"Use the masculine generic."`（参见 [性别指引](/docs/getting-started/configuration#gender-guidance)）。修改后的设置会生成独立的缓存条目，因此 `sync --redo all` 会重新翻译旧配置生成的内容。

**采用哪种翻译方式，以及所需的密钥。** 若未指定 `--method`，`init` 会采用默认配置 `llm`：使用 [OpenRouter](https://openrouter.ai) 上的模型，这需要在环境变量中或在 `manage.py` 旁的 `.env` 文件中配置 `OPENROUTER_API_KEY`（缺失时 `init` 会打印需要设置的代码行）。在运行模型服务器（Ollama、LM Studio、vLLM）的机器上，`npx --yes champollion@0.5 init --yes --langs fr,ru --method local --model llama3.1` 无需密钥，且任何数据都不会离开该机器。CI 执行机没有模型服务器，因此 CI 会在运行时指定托管模型（参见 [CI 指南](/docs/guides/ci-cd)）。有关每种方式及其所需密钥的完整说明，请参阅 [翻译方式](/docs/guides/translation-methods)。

然后：

```bash
npx --yes champollion@0.5 sync
django-admin compilemessages
```

同步操作会翻译所有 `msgstr` 为空以及所有标记为 `fuzzy` 的条目，并移除 `fuzzy` 标记。已翻译的条目及其注释均会逐字节原样保留。带有 `msgctxt` 的条目拥有专属的键和缓存条目，因此动词形式的“Open”和形容词形式的“Open”会分开翻译。`#.` 注释和上下文均会发送给模型——若要查看完整的请求内容而不实际发送，可运行 `npx --yes champollion@0.5 sync --dry --show-prompt 'verb␄Open'`（上下文和注释会显示在“UI context for these keys”下方）。

**刻意重新翻译单个条目。** 通过其 msgid 指定条目：

```bash
npx --yes champollion@0.5 sync --pair en:fr --redo 'keys:Welcome back\, %(name)s!'
```

当缓存中已存在该文本时，此操作将从翻译记忆库中读取，因此你无需花费成本即可获取相同的翻译，同步命令会通过 `--fresh` 给出提示。这种重新生成无需调用模型：如果使用 `local` 且模型服务器处于停止状态，同步操作会警告服务器无响应，但本次运行并不需要它，随后继续执行（只有必须发送请求的重新生成操作才会中止，并指明该服务器）。若要付费获取新的翻译，请添加 `--fresh`。msgid 内的逗号需写作 `\,`，外层引号可防止 Shell 解析其余部分。带有上下文的条目按照报告打印的格式指定：`verb␄Open`。如果你无法输入 `␄`，可改写为 `\x04`：`--redo 'keys:verb\x04Open'`。两种拼写均可使用，修复命令会同时显示两者。若只想在单一域中指定该条目，可添加域名前缀：`django::Welcome`。如果指定的名称未匹配到任何条目，运行将失败（退出代码 1）并列出最接近的条目，例如 msgid `Cancel` 的所有上下文（`button␄Cancel`、`status␄Cancel`），绝不会误判为已完成的重译。

由 champollion 创建的语言包（通过 `init --langs`，或在尚无语言包的目标语言上运行同步），均会包含标准 gettext 头信息（即 `msginit` 写入的字段），以便 `msgfmt -c` 顺利接受。现有语言包的头信息绝不会被重写。

**针对 `makemessages` 生成的语言包中出现的 `msgfmt -c` 头信息警告。** `makemessages` 会写入 gettext 的模板头信息——`Project-Id-Version: PACKAGE VERSION`、`PO-Revision-Date: YEAR-MO-DA HO:MI+ZONE`、`Last-Translator: FULL NAME <EMAIL@ADDRESS>`、`Language-Team: LANGUAGE <LL@li.org>`，并带有 `#, fuzzy` 标记——随后 `msgfmt -c` 在每次编译时都会发出警告，提示每个字段“仍为初始默认值”（still has the initial default value）。同步操作不会修改这些值（在现有头信息中，它仅会补充占位符 `Plural-Forms` 或字符集），因此需要在每个语言包中手动修复一次：填入你的项目名称和版本、日期、译者（或 `Automatically generated`）以及团队（或 `none`）；同时删除 `msgid ""` 上方标记头信息尚未审核的 `#, fuzzy` 行。`makemessages` 会保留你填写的值。`compilemessages`（`msgfmt --check-format`）不会检查头信息，因此这些警告绝不会导致其运行失败。

**复数形式。** `msgid` + `msgid_plural` 会组合为一条消息，供模型翻译出该语言所需的全部形式。这些形式将根据语言包的 `Plural-Forms` 头信息依次写入 `msgstr[0]`、`msgstr[1]`、……。Django 会自动为你生成该头信息。缺失该头信息的语言包会采用 `msginit` 为该语言写入的头信息（法语对应 `nplurals=2; plural=(n > 1);`），或者针对 `msginit` 未收录的语言采用从 CLDR 衍生的头信息：

```po
msgid "One file"
msgid_plural "%(count)d files"
msgstr[0] "%(count)d файл"
msgstr[1] "%(count)d файла"
msgstr[2] "%(count)d файлов"
```

如果翻译结果中缺失了该语言在常规计数中使用的某种形式（例如俄语中的 `few` 或 `many`），同步程序会再次向模型请求补充。如果返回的结果依然缺失该形式，同步程序会在相应位置填入 `other` 形式，添加 `# champollion:` 注释标记该条目，并附上重新请求的命令（`--redo 'keys:django::One file' --fresh`）。只要语言包中存在被标记的条目，每次同步都会退出并返回状态码 `2`（如同遇到被扣留的键一样），而不仅仅是写入该条目的那次同步。其最终的校验输出行会显示运行未完成，而不是 `[OK]`。你可以手动编写这些复数形式并删除注释行，或者使用更强大的 `--model` 重新发起请求。使用其他方式或模型进行的同步（例如在本地模型之后使用 CI 的托管模型）会自动重新请求该条目，而 `sync --redo gaps` 则会请求所有被标记的条目；如果结果仍然缺失所需形式，该条目将保持标记状态。在 CI 中，这会导致提交后的作业失败（参见 [CI 指南](/docs/guides/ci-cd#plural-gaps)）。

**其他 gettext 布局结构。**

| 项目 | 配置 | 源文件 |
|---------|--------|--------|
| GNU (`po/fr.po`) | `"localesDir": "./po", "format": "po"` | `po/en.po`，或 `po/` 中的单个 `.pot` |
| Babel / Flask | `"localesPattern": "translations/{lang}/LC_MESSAGES/messages.po"` | `translations/en/…/messages.po`，或 `translations/` 及其上层文件夹中的 `messages.pot` |

`printf` 占位符（`%s`、`%(name)s`、`%d`）在翻译后必须完整保留，质量门禁会拒绝丢失占位符的译文。在交付前仍需运行 `msgfmt --check-format`（`compilemessages` 会自动执行）。它还会检查占位符类型，但仅针对标记为 `#, python-format` 的条目进行检查：`makemessages` 会自动为其提取的带有 `%` 占位符的条目添加该标记，而手动创建的语言包可能缺失该标记，导致这些条目无法被检查。无论条目带有何种标记，`champollion verify` 都会比对每个条目的 printf 占位符（名称和类型字母），并且同步操作会在翻译时保留源条目的标记。语言包编码必须为 UTF-8。完整规则请参见 [gettext 语言包](/docs/getting-started/configuration#gettext)。
