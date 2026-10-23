# 集成指南

Champollion 与主流框架的逐步集成配置指南。

本页中的命令均使用 `npx --yes champollion@0.6 <command>` 运行 champollion：锁定在 0.6 系列，如 [CI 指南](/docs/guides/ci-cd) 中所述，以便让你的本地设备和 CI 运行相同的版本，避免新版本发布带来意外的行为变动。项目本地安装是另一种选择。在 Node 项目中，`npm install --save-dev champollion@0.6` 会将其添加到 `package.json`，随后 `npx champollion sync` 即可运行该副本。

---

## API 密钥配置

在与任何框架集成之前，你需要一个翻译 API 密钥。Champollion 支持两家提供商：

### 选项 A：OpenRouter（推荐）

[OpenRouter](https://openrouter.ai) 为 200 多种 LLM 模型提供统一的 API。提供免费层级。

```bash
# Sign up at https://openrouter.ai, then:
export OPENROUTER_API_KEY=sk-or-v1-...

# Or add to .env.local:
OPENROUTER_API_KEY=sk-or-v1-your-key-here
```

适用场景：内容繁重的项目、Markdown 翻译，以及需要内容感知屏蔽（代码块、短代码、插值变量）的项目。

### 选项 B：Google Translate

```bash
export GOOGLE_TRANSLATE_API_KEY=...
```

适用场景：大批量键值对字符串（支持 194 种语言）。**不推荐**用于 Markdown 内容——Google Translate 无法识别代码块、短代码或插值变量。

显式使用 Google Translate：

```bash
champollion sync --method google-translate
```

> **提示**：如果仅设置了 `GOOGLE_TRANSLATE_API_KEY`（未设置 OpenRouter 密钥），champollion 会自动切换到 Google Translate。

---

## Hugo（TOML / YAML / Markdown）

### 项目结构

Hugo 使用 `i18n/` 处理字符串翻译，使用 `content/` 处理页面内容：

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

### 配置

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

**Front matter**：支持 YAML（`---`）和 TOML（`+++`）定界符。默认翻译 `title`、`description`、`summary`、`subtitle`、`caption` 和 `linkTitle`。所有其他字段（date、draft、tags、weight、slug 等）均予保留。可以在配置中通过 `translatableFields` 自定义。

**块级保护**：代码块、Hugo 短代码（`{{< >}}`、`{{% %}}`）、行内代码和原始 HTML 均会自动使用 Unicode 哨兵占位符屏蔽保护，保持原样透传。

**文件名规范**：遵循 Hugo 基于文件名的翻译模式：
- `my-post.md` → `my-post.fr.md`
- `my-post.en.md` → `my-post.fr.md`（去除源文件后缀）

**跳过已存在内容**：绝不会覆盖已存在的翻译文件。删除目标文件即可强制重新翻译。

### 复数形式

TOML 和 YAML 区域设置支持 CLDR 复数形式：

```toml
[items]
one = "{{ .Count }} item"
other = "{{ .Count }} items"
```

内部表示为 `items.one` 和 `items.other` 用于对比差异，写入时重新序列化为正确的分节格式。

---

## next-intl (JSON)

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

### 配置

```bash
npm install --save-dev champollion
```

运行 `npx --yes champollion@0.6 init --yes --langs fr,de,ja,es,ko,zh,pt,ar`。它会找到 `messages/en.json`，创建空的目标文件，并写入如下所示的配置。你也可以自行创建 `champollion.config.json`：

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

每个目标的语域（register，即语气和正式程度）都会写入 `languages`，因而直观且可编辑：你可以将其更改为该语言的另一种预设（`champollion status` 会列出它们）或自定义描述。没有预设的语言会被写为 `{}`。使用普通列表 `"languages": ["fr", "de"]` 同样可行，并会采用各语言的默认值。

```bash
npx --yes champollion@0.6 sync
```

生成 `messages/fr.json`、`messages/ja.json` 等文件——完全翻译并保留你的嵌套键结构。next-intl 会自动识别它们。

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

## react-i18next (JSON)

### 每种语言独立目录（i18next 默认方式）

```
public/locales/
├── en/
│   ├── common.json        ← source namespaces
│   └── admin/users.json
├── fr/
└── ja/
```

```bash
npx --yes champollion@0.6 init --yes --langs fr,de,ja
```

`init` 会找到 `public/locales/en/`（或 `locales/en/`），将配置指向该路径，并创建 `fr/common.json`、`fr/admin/users.json` 等空文件。其写入的配置相关部分如下：

```json
{
  "version": 3,
  "inputLocale": "en",
  "localesDir": "./public/locales",
  "languages": { "fr": "formal-vous", "de": "formal-Sie", "ja": "polite" }
}
```

```bash
npx --yes champollion@0.6 sync
```

每个命名空间文件都会被翻译并写入每种语言目录下的相同路径。若某个字符串出现在多个命名空间中，每种语言只需翻译一次；其他文件直接从翻译记忆库中获取。复数键（`key_one`、`key_other`）会通过 JavaScript `Intl.PluralRules` API 从 CLDR 读取并获得各语言自身的复数形式：该语言需要但源语言缺少的形式会被添加，不需要的形式则会被忽略。以英语为源语言时，西班牙语和法语会增加 `key_many`，俄语会增加 `key_few` 和 `key_many`，而日语仅保留 `key_other`。同步时会针对你所使用的语言指出各自新增的形式。参见 [i18next 复数键](/docs/getting-started/configuration#i18next-plurals) 与 [区域文件布局](/docs/getting-started/configuration#locale-layouts)。

### 每种语言单个文件

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

### 其他布局

如果你的文件遵循其他模式，可用 `localesPattern` 进行描述（`{lang}` 为语言，`{ns}` 为命名空间）：

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

`flutter gen-l10n` 会为每种语言读取一个 `.arb` 文件。英文文件为模板：

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

### 配置

```bash
npx --yes champollion@0.6 init --yes --langs fr,de,pt_BR
```

`init` 会读取 `pubspec.yaml` 和 `l10n.yaml`（`arb-dir`、`template-arb-file`），从模板名称中提取源语言（`app_en.arb` → `en`），并创建带有相应 `@@locale` 的 `app_fr.arb`、`app_de.arb` 和 `app_pt_BR.arb`。其写入的配置如下：

```json
{
  "version": 3,
  "inputLocale": "en",
  "localesPattern": "lib/l10n/app_{lang}.arb",
  "languages": { "fr": "formal-vous", "de": "formal-Sie", "pt_BR": "professional" }
}
```

若 `l10n.yaml` 设置了 `arb-dir: assets/i18n` 和 `template-arb-file: intl_en.arb`，则模式为 `"assets/i18n/intl_{lang}.arb"`。

```bash
npx --yes champollion@0.6 sync
flutter gen-l10n
```

仅消息内容会被翻译。每个目标文件的 `"@@locale"` 都会设置为其自身的区域设置，且书写格式与文件名一致（`"pt_BR"`），因为若 `@@locale` 与文件名不符，`gen-l10n` 会报错拒绝。每个 `@key` 元数据对象（如占位符及其类型）都会从 `app_en.arb` 原样复制。键的顺序遵循模板顺序，尚未翻译的消息会被忽略，因此 Flutter 会回退至英文版本。

模板元数据中的描述会作为上下文发送给模型：

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

`{count, plural, …}` 语法、`{count}` 占位符以及选择器均受到保护：若翻译更改了它们，则会被拒绝并重试（参见 [ICU 消息](/docs/getting-started/configuration#icu)）。法语可能会增加 `many` 分支，波兰语可能会增加 `few` 和 `many`。`champollion verify` 还会检查每个目标文件的 `@@locale` 及占位符元数据。如果之前的工具有翻译过它们，`champollion sync --pair en:fr --force` 会重写该文件。未修改的消息直接从缓存中获取，无任何开销。

### Flutter 内置列表之外的区域设置 {#flutter-locales-outside-flutters-own-list}

你的应用文本来自 `.arb` 文件。而 Flutter 自身组件中的文本——日期选择器、“返回”、“取消”、文本方向等——则来自 `flutter_localizations`（`GlobalMaterialLocalizations`、`GlobalCupertinoLocalizations`），它只涵盖固定列表中的语言（[Flutter 的语言列表](https://api.flutter.dev/flutter/flutter_localizations/GlobalMaterialLocalizations-class.html)）。像 `qaa` 这样的私用代码以及大多数低资源语言均不在其列。如果在 `supportedLocales` 中使用了此类区域设置，除非有 delegate 提供相应文本，否则应用会在运行时报错崩溃（“No MaterialLocalizations found”）。`init` 以及创建新 `.arb` 文件的 sync 都会针对不在列表中的每个目标发出提示：它们会从本地设备上的 Flutter SDK（`FLUTTER_ROOT`，或 `PATH` 上的 `flutter`）中读取该列表，若找不到 SDK，则会指明哪些目标无法完成检查。

最小成本的修复方案是让这些组件借用 Flutter 已支持语言的文本（此处以英语为例）：

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

将其列在 Flutter 自带的 delegate 之后：

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

这样，组件就会在以你的目标语言呈现的应用中显示英文标签。若要同时翻译这些组件的文本，Flutter 指南提供了为新语言实现完整 `MaterialLocalizations` 的示例：[为新语言添加支持](https://docs.flutter.dev/ui/accessibility-and-internationalization/internationalization#adding-support-for-a-new-language)。

---

## Django 与 gettext (.po)

champollion CLI 在 [PolyForm Noncommercial License 1.0.0](https://github.com/gamedaysuits/Champollion/blob/main/cli/LICENSE) 许可下源码可用：可出于非商业目的免费使用、修改和分享。将其用于商业目的不属于该许可的涵盖范围（详见[谁可以使用本工具](/docs/getting-started/who-may-use-this)）。

### 项目结构

```
my_site/
├── manage.py
└── locale/
    ├── en/LC_MESSAGES/django.po    ← source catalog (makemessages -l en)
    ├── fr/LC_MESSAGES/django.po
    └── ru/LC_MESSAGES/django.po
```

### 配置：LOCALE_PATHS 与 LANGUAGES {#django-locale-paths}

Django 会在 `LOCALE_PATHS` 列出的文件夹以及每个已安装应用的 `locale/` 文件夹中查找翻译编目。与 `manage.py` 同级的 `locale/` 不属于任何应用，因此在 `LOCALE_PATHS` 指定它之前，`compilemessages` 虽仍会构建其 `.mo` 文件，但网站依然会显示未翻译的文本。`LANGUAGES` 是网站提供的语言列表；Django 默认包含其自带的所有语言，因此请列出你所需的语言：

```python title="settings.py"
LOCALE_PATHS = [BASE_DIR / "locale"]   # BASE_DIR: the folder with manage.py (startproject defines it)
LANGUAGES = [("en", "English"), ("fr", "Français"), ("ru", "Русский")]
```

### 配置

首先使用 Django 创建或刷新编目。英文编目为源文件。其空的 `msgstr` 表示“以 msgid 作为文本”：

```bash
django-admin makemessages -l en -l fr -l ru
npx --yes champollion@0.6 init --yes --langs fr,ru
```

`init` 会找到 `manage.py` 与 `locale/en/LC_MESSAGES/django.po` 并写入：

```json
{
  "version": 3,
  "inputLocale": "en",
  "localesPattern": "locale/{lang}/LC_MESSAGES/{ns}.po",
  "languages": { "fr": "formal-vous", "ru": "formal-vy" }
}
```

`{ns}` 是 gettext 域，因此 `django.po` 和 `djangojs.po` 都会被同步。

**默认设置包含语气和性别风格；`init` 会打印这两项。** `formal-vous` 会要求模型使用“Formal French. Use vous-form (vouvoiement) consistently. Professional, academic register.”（正式法语。始终使用尊称 vous 形式。专业、学术语域）。法语的性别指南要求在读者性别未知时使用带间隔号的中性包容写法（*écriture inclusive*，如 `Connecté·e`、`Utilisateur·rice·s`）；而俄语（`formal-vy`）则使用传统默认的阳性形式。如果有其他需求的站点（例如诊所的患者页面），可以在 `champollion.config.json` 中修改它：在 `languages` 中设置语域（`"fr": "casual-tu"` 或自定义词句），以及设置 `genderGuidance`——使用 `false` 表示不提供指令，或使用自定义说明如 `"Use the masculine generic."`（参见[性别指引](/docs/getting-started/configuration#gender-guidance)）。修改后的设置会生成专属的缓存条目，因此 `sync --redo all` 会重新翻译旧设置写入的内容。

**翻译方式及其所需密钥。** 未指定 `--method` 时，`init` 会设置默认的 `llm`：使用 [OpenRouter](https://openrouter.ai) 上的模型，这需要在环境变量中或与 `manage.py` 同级的 `.env` 文件中提供 `OPENROUTER_API_KEY`（缺失时 `init` 会打印需要设置的配置行）。在运行模型服务（Ollama、LM Studio、vLLM）的机器上，`npx --yes champollion@0.6 init --yes --langs fr,ru --method local --model llama3.1` 不需要密钥，也不会有任何数据离开本地设备。CI 执行器通常没有模型服务，因此 CI 在运行时会指定托管模型（参见 [CI 指南](/docs/guides/ci-cd)）。关于每种翻译方式及其所需密钥，请参阅[翻译方法](/docs/guides/translation-methods)。

然后：

```bash
npx --yes champollion@0.6 sync
django-admin compilemessages
```

同步会翻译每个 `msgstr` 为空以及带有 `fuzzy` 的条目，并移除 `fuzzy` 标记。已翻译的条目及其注释会逐字节保持不变。带有 `msgctxt` 的条目拥有独立的键和独立的缓存条目，因此动词“Open”和形容词“Open”会分开翻译。`#.` 注释与上下文均会发送给模型——若想查看确切的请求而不实际发送，可运行 `npx --yes champollion@0.6 sync --dry --show-prompt 'verb␄Open'`（上下文和注释会显示在“UI context for these keys”下方）。

**有意重新翻译单条条目。** 按其 msgid 指定：

```bash
npx --yes champollion@0.6 sync --pair en:fr --redo 'keys:Welcome back\, %(name)s!'
```

当缓存中已包含该文本时，此操作由翻译记忆库直接提供，因此无需成本即可取回相同的翻译结果，且 sync 会通过 `--fresh` 命令明确说明这一点。此类重做不需要模型参与：在使用 `local` 且模型服务已停止的情况下，sync 会发出警告称服务未响应但本次运行不需要它，然后继续执行（而必须发起请求的重做操作则会中止并指明该服务）。若需付费获取全新翻译，请添加 `--fresh`。msgid 内的逗号需写作 `\,`，外层引号可防止 shell 解析其余部分。带有上下文的条目按照报告打印的格式命名：`verb␄Open`。若无法输入 `␄`，可改写为 `\x04`：`--redo 'keys:verb\x04Open'`。两种拼写均可识别，修复命令也会同时展示二者。若仅指定某个域中的条目，可在前面加上域前缀：`django::Welcome`。若指定的名称未匹配到任何条目，运行将失败（退出码 1）并列出最接近的条目，例如 msgid `Cancel` 的每个上下文（`button␄Cancel`、`status␄Cancel`），绝不会误判为已完成重做。

由 champollion 创建的编目（`init --langs`，或针对尚无编目的语言执行 sync）会包含标准的 gettext 头信息及 `msginit` 写入的字段，因此 `msgfmt -c` 可以正常接受它。现有编目的头信息绝不会被重写。

**对于由 `makemessages` 初始化的编目，出现 `msgfmt -c` 头信息警告。** `makemessages` 会写入 gettext 的模板头信息——`Project-Id-Version: PACKAGE VERSION`、`PO-Revision-Date: YEAR-MO-DA HO:MI+ZONE`、`Last-Translator: FULL NAME <EMAIL@ADDRESS>`、`Language-Team: LANGUAGE <LL@li.org>`，并带有 `#, fuzzy` 标记——随后 `msgfmt -c` 在每次编译时都会警告各字段“still has the initial default value”（仍为初始默认值）。同步不会变动这些值（在现有头信息中，它只会填充占位符 `Plural-Forms` 或字符集），因此需要在每个编目中手动修正一次：你的项目名称和版本、日期、译者（或 `Automatically generated`）以及团队（或 `none`）；同时删除 `msgid ""` 上方的 `#, fuzzy` 行（该行标记头信息尚未复核）。`makemessages` 会保留你填写的值。`compilemessages`（`msgfmt --check-format`）不会检查头信息，因此这些警告绝不会导致其失败。

**复数形式。** `msgid` + `msgid_plural` 会组合为一条消息由模型翻译，并生成该语言所需的所有形式。这些形式会根据编目的 `Plural-Forms` 头信息写入 `msgstr[0]`、`msgstr[1]` 等。Django 会为你自动写入该头信息。如果编目中缺少该头信息，则会采用 `msginit` 为该语言写入的头信息（如法语 `nplurals=2; plural=(n > 1);`），或者针对 `msginit` 未列出的语言从 CLDR 推导一个：

```po
msgid "One file"
msgid_plural "%(count)d files"
msgstr[0] "%(count)d файл"
msgstr[1] "%(count)d файла"
msgstr[2] "%(count)d файлов"
```

当翻译遗漏了该语言在常规计数中使用的某种形式（例如俄语的 `few` 或 `many`）时，sync 会重新向模型请求该形式。如果返回的结果依然缺失，sync 会在该位置填入 `other` 形式，用 `# champollion:` 注释标记该条目，并附上再次请求的命令（`--redo 'keys:django::One file' --fresh`）。只要编目中存在带标记的条目，每次 sync 都会以 `2` 状态退出（就像键被扣留一样），而不仅仅是写入该条目的那次 sync。其末尾的校验行会显示运行未完成，而非 `[OK]`。你可以手动填写对应形式并删除注释行，或者使用更强大的 `--model` 重新发起请求。使用其他方法或模型进行的 sync（例如在本地模型之后使用 CI 的托管模型）会自动重新请求该条目，而 `sync --redo gaps` 会请求所有带标记的条目；如果返回的结果依然缺失该形式，则条目仍将保持标记状态。在 CI 中，这会在提交后导致任务失败（参见 [CI 指南](/docs/guides/ci-cd#plural-gaps)）。

**其他 gettext 布局。**

| 项目 | 配置 | 源文件 |
|---------|--------|--------|
| GNU (`po/fr.po`) | `"localesDir": "./po", "format": "po"` | `po/en.po`，或 `po/` 中的单个 `.pot` |
| Babel / Flask | `"localesPattern": "translations/{lang}/LC_MESSAGES/messages.po"` | `translations/en/…/messages.po`，或 `translations/` 及其上级文件夹中的 `messages.pot` |

`printf` 占位符（`%s`、`%(name)s`、`%d`）必须在翻译后保留，质量门禁会拒绝丢失占位符的值。发布前仍建议运行 `msgfmt --check-format`（`compilemessages` 会执行此操作）。它还会检查占位符类型，但仅针对标记为 `#, python-format` 的条目：`makemessages` 会为提取出的带有 `%` 占位符的条目添加该标记，而手动创建的编目可能会缺少它，导致这些条目无法被检查。无论标记如何，`champollion verify` 都会比对每个条目的 printf 占位符（名称和类型字符），且 sync 会在其翻译的每个条目上保留源条目的标记。编目文件必须使用 UTF-8 编码。完整规则请参见 [gettext 编目](/docs/getting-started/configuration#gettext)。
