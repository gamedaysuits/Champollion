---
sidebar_position: 1
title: "CLI 参考"
related:
  - label: "Quick Start"
    to: /docs/getting-started/quick-start
    kind: guide
  - label: "Configuration"
    to: /docs/getting-started/configuration
    kind: reference
  - label: "CI/CD"
    to: /docs/guides/ci-cd
    kind: guide
  - label: "Troubleshooting"
    to: /docs/guides/troubleshooting
    kind: guide
---

# CLI 参考

## 命令

```
champollion init              Interactive setup wizard (--yes for quick defaults)
champollion sync              Translate & sync all locale files
champollion watch             Auto-sync when the source file changes
champollion audit             List all untranslated [EN] fallback values
champollion lint              Scan source code for hardcoded strings
champollion wrap              Auto-wrap hardcoded strings in t() calls (with undo)
champollion seo <sub>         Generate hreflang, sitemap.xml, or JSON-LD schema
champollion integrity         Audit locale files for format/encoding issues
champollion repair-script     Restore romanization where script conversion was unwanted
champollion verify            Verify translations are present and correct (CI gate)
champollion status            Show pair configuration, plugins, and quality tiers
champollion provenance        Audit translation resource licensing
champollion plugin <sub>      Manage method plugins (install, remove, list)
champollion fonts <sub>       Download web fonts for PUA script converters
champollion leaderboard       Browse and install methods from the Network leaderboard
champollion tm <sub>          Manage Translation Memory cache (stats, clear, seed, prune)
champollion xliff <sub>       Export/import XLIFF 1.2 for professional review
champollion card <code>       Pretty-print a language card (--json for raw output)
champollion models            List available models from a provider (--method <provider>)
champollion doctor            System health check (cards, config, FSTs, API keys, methods)
champollion recommend         Method guidance for a pair — availability + cited evidence
champollion register-corpus   Register a corpus: pick a license + exposure tier (local-only/private/public/sealed)
champollion submit            Propose an index entry (review-gated): prints a pre-filled GitHub issue
champollion seal-corpus <sub> Sealed-tier crypto verbs: keygen / seal / open (organizer-node bridge)
```

运行 `champollion <command> --help` 获取任何命令的详细帮助。

## 全局选项

```
--help, -h              Show help (global or per-command)
--version, -v           Print version and exit
--yes, -y               Skip interactive prompts, use defaults
--config <path>         Custom config file path
--dir <path>            Override locales directory
--content-dir <path>    Hugo/Docusaurus content directory for Markdown translation
--source <code>         Override source locale (default: en)
--model <model>         Override translation model (full slug or alias from shared/model-aliases.json)
--method <method>       Translation method: llm, google-translate (default: from config)
--temperature <n>       LLM temperature (0.0–2.0, default: 0.3)
--coaching-file <path>  Path to free-text coaching prompt file (injected into system prompt)
--format <fmt>          Locale file format: json, toml, yaml, or auto
--dry, --dry-run        Preview changes without writing files
--list-keys             With --dry: name every queued key per reason
--concurrency <n>       Max parallel API calls (sets both JSON and content, default: 48)
--json-concurrency <n>  Max parallel locale translations for JSON keys (default: 200)
--content-concurrency <n> Max parallel API calls for content translation (default: 48)
--force                 Re-queue every source key (whole-locale rebuild; scope with --pair)
--force-content         Re-translate all content files (clears content lock)
--force-keys <keys>     Comma-separated dot-notation keys to force re-translate
--no-tm                 Skip Translation Memory cache for this sync run
--no-verify             Skip post-sync verification pass
--locale <code>         Target locale (xliff export, tm clear)
--quiet                 Errors and warnings only — suppress banner, progress bar, and info lines
--json                  Machine-readable NDJSON output — one JSON object per event
```

---

## init

交互式设置向导，创建 `champollion.config.json`。引导您完成源语言、目标语言、文件格式和翻译模型的配置。

```bash
champollion init                          # interactive wizard
champollion init --yes                    # skip wizard, use defaults
champollion init --yes --langs fr,de,ja   # quick setup with specific languages
champollion init --source en --dir ./i18n # overrides with defaults
```

**`--langs` 选项**：逗号分隔的目标语言代码列表。跳过语言提示，为每种语言应用默认寄存器预设。与 `--yes` 结合使用可实现完全非交互式设置。

**语言预设**：当系统提示输入目标语言时，您可以输入预设名称：
- `european` → fr, de, es, it, pt, nl
- `asian` → ja, zh, ko
- `global` → fr, es, de, ja, zh, ko, pt, ar
- `nordic` → da, fi, nb, sv

混合预设和单个代码：`european, ja` → fr, de, es, it, pt, nl, ja

---

## sync

翻译所有语言文件中缺失和过期的键。默认运行同步后验证。

```bash
champollion sync                                   # translate everything
champollion sync --dry-run                         # preview only
champollion sync --dry --list-keys                 # preview AND name every queued key
champollion sync --force-keys "hero.title"         # force re-translate
champollion sync --force-keys "a.title,a.subtitle" # multiple keys
champollion sync --pair en:tlh --force             # rebuild one whole locale
champollion sync --pair en:tlh --force --no-tm     # ...bypassing a suspect cache
champollion sync --force-content                   # re-translate all Markdown/MDX
champollion sync --content-dir ./content           # include Hugo Markdown
champollion sync --method google-translate          # force Google Translate
champollion sync --concurrency 20                  # 20 parallel API calls (both phases)
champollion sync --json-concurrency 30              # 30 parallel locale translations (JSON)
champollion sync --content-concurrency 8            # 8 parallel content translations
champollion sync --no-verify                        # skip post-sync verification
champollion sync --no-tm                            # skip cache, fresh API calls
```

**翻译记忆库**：默认情况下，`sync` 加载 `.champollion/tm.json` 并为未更改的源值提供缓存翻译。使用 `--no-tm` 绕过缓存（在切换翻译提供商或调试质量时很有用）。参见 [翻译记忆库](/docs/concepts/translation-memory)。

**变更检测**：champollion 在 `.champollion.lock` 中存储 SHA-256 哈希值。当源值更改时，下一次同步会自动重新翻译这些键。提交锁定文件，以便所有开发人员共享基线。

**并行性**：JSON 键翻译和内容翻译都并行运行。JSON 语言环境同时翻译（默认：200 个并发语言环境），每个语言环境内的批次也并行化（4 个并发批次）。内容翻译（Markdown、MDX、博客文章）在平面工作项池中运行（默认：48 个并发 API 调用）。使用 `--json-concurrency`、`--content-concurrency` 或 `--concurrency` 覆盖（同时设置两者）。

**输出**：同步显示版本横幅、格式/框架检测、成本估计和每个语言环境的进度条：

```
champollion v0.1.0

[INFO] Detected format: json (auto)
[INFO] Source: en.json (2,847 keys)
[INFO] Pairs: es-MX:llm, fr:deepl

[INFO] es-MX.json — 2,847 missing
     ████████████████████████████████ 2,847/2,847 keys
[INFO] fr.json — 2,847 missing
     ████████████████████████████████ 2,847/2,847 keys
[OK] Synced 5,694 keys total.
```

进度条在每个批次（约 80 个键）后原地更新。使用 `--quiet` 仅显示错误/警告，或使用 `--json` 获取机器可读的 NDJSON 输出。两者都会抑制进度条和横幅。

---

## watch

源语言文件更改时自动同步。运行直到被 `Ctrl+C` 中断。

```bash
champollion watch
```

---

## audit

列出之前运行中所有未翻译的 `[EN]` 前缀回退值。如果找到任何值，则以代码 1 退出 — 用作 CI 门控以使包含不完整翻译的构建失败。

```bash
champollion audit
```

---

## verify

从磁盘重新读取所有语言环境文件，并验证翻译确实存在且正确。这与每次 `sync` 结束时自动运行的验证相同（除非传递了 `--no-verify`）。

```bash
champollion verify                    # verify all locale files
champollion verify --warn-only        # non-blocking
champollion verify && echo "All good" # CI gate
```

**检查内容：**
- 键奇偶性 — 每个目标中都存在所有源键
- 来自之前运行的 `[EN]` 回退标记
- 空翻译
- 脚本合规性 — 非拉丁语言环境应具有非 ASCII 翻译
- 占位符保留 — ICU 占位符与源匹配
- 编码问题 — BOM 标记、不可见字符
- 源回显 — 值与源相同（警告）

---

## lint

扫描源代码中应使用 i18n 翻译调用的硬编码用户界面字符串。自动检测您的框架（next-intl、react-i18next、vue-i18n、Hugo）。

```bash
champollion lint                    # exits 1 if issues found
champollion lint --warn-only        # always exits 0
champollion lint --src ./app        # custom source directory
champollion lint --min-length 4     # minimum string length to flag
```

**检测内容：**
- JSX 文本、`placeholder`、`alt`、`aria-label`、`title` 中的硬编码字符串
- 具有用户界面内容但没有 i18n 框架导入的文件
- 死键 — 没有源文件引用的语言环境键
- 覆盖率分数 — 通过 i18n 的字符串百分比

**排除项**：在项目根目录中创建 `.champollionignore`（glob 模式，如 `.gitignore`）。

---

## wrap

自动包装由 `lint` 检测到的硬编码字符串，使用 `t()` 调用。在修改文件前创建自动备份。

```bash
champollion wrap                    # auto-wrap with backup
champollion wrap --dry              # preview wrapping changes
champollion wrap --undo             # restore from .champollion-backup/
```

**安全门控：**
1. Git 清洁检查（在干运行中跳过）
2. 自动备份到 `.champollion-backup/`
3. 每次文件写入前的差异预览
4. `--undo` 支持从备份恢复

---

## seo

为多语言网站生成 SEO 工件。

```bash
champollion seo hreflang                                        # print hreflang tags
champollion seo sitemap --base-url https://example.com --out sitemap.xml
champollion seo jsonld --base-url https://example.com           # JSON-LD schema
```

| 子命令 | 输出 |
|--------|--------|
| `hreflang` | `<link rel="alternate" hreflang>` 标签 |
| `sitemap` | 多语言 `sitemap.xml` |
| `jsonld` | JSON-LD WebSite 语言架构 |

---

## integrity

检测翻译语言环境文件中的损坏和漂移。

```bash
champollion integrity               # exits 1 if issues found
champollion integrity --warn-only   # non-blocking
```

**它检查的内容：**
- 占位符损坏（例如，源文件中存在 `{name}` 但目标文件中缺失）
- 编码问题（乱码、无效的 Unicode）
- 未翻译的副本（目标值与源值完全相同）——[`noTranslate`](/docs/getting-started/configuration#no-translate) 键被豁免，翻译记忆库（Translation Memory）确认为管道生成且通过门控批准的原样返回内容（echoes）也被豁免。剩余被标记的内容正是 `sync` 会重新排队的内容——这两个工具对于健康文件的判定不会有分歧
- 不翻译漂移（no-translate drift，即 `noTranslate` 键*不*等同于源值）——报告预期值/实际值并转义不可见字符；运行 `champollion sync` 进行修复
- 意外的 PUA（在[脚本转换](/docs/getting-started/configuration#script-conversion)已关闭的语言环境中的私有使用区代码点——如果没有特殊字体会显示为空白）；运行 `champollion repair-script` 进行修复
- 被掏空的值（目标值是删除了字母的源值——这是早于内容保留门控的旧管道造成的损坏）；使用 `sync --force-keys <key>` 或 `sync --pair <pair> --force` 重新翻译
- 孤立键（目标文件中存在但源文件中不存在的键）
- ICU MessageFormat 复数类别的完整性（例如，阿拉伯语需要 6 个类别）

---

## repair-script

撤销本不该发生的脚本转换：在配置为关闭转换的语言环境中，PUA 编码的值（pIqaD、Tengwar、Kryptonian）将通过转换器自身的反向表恢复为罗马化拼写。

```bash
champollion repair-script --dry     # preview
champollion repair-script           # repair in place
```

| 选项 | 效果 |
|--------|--------|
| `--dry` | 预览修复而不写入 |
| `--locale <code>` | 仅修复一个语言环境 |
| `--json` | 机器可读的 JSON 输出 |
| `--warn-only` | 即使存在不可逆的 PUA 也以 0 退出 |

pIqaD 可以完全精确反转。Tengwar 和 Kryptonian 的反转无法恢复大小写（被标记为大小写有损）。翻译记忆库（Translation Memory）不需要修复——它存储的是转换前的值。当存在任何已注册转换器都无法反转的 PUA 时，以 1 退出。

---

## tm

管理翻译记忆库缓存（`.champollion/tm.json`）。TM 存储之前的翻译，并在后续同步中提供它们，而不是调用 API。

```bash
champollion tm stats                  # show cache statistics
champollion tm clear                  # clear cache (with confirmation)
champollion tm clear --yes            # clear without confirmation
champollion tm clear --locale fr      # clear only French entries
```

| 子命令 | 输出 |
|--------|--------|
| `stats` | 条目计数、文件大小、每个语言环境的细分 |
| `clear` | 删除缓存文件（完整或按语言环境） |

| 选项 | 效果 |
|--------|--------|
| `--locale <code>` | 仅清除一个语言环境的条目 |
| `--yes` | 跳过确认提示 |

参见 [翻译记忆库](/docs/concepts/translation-memory) 了解 TM 的工作原理以及何时清除它。

---

## xliff

导出和导入 XLIFF 1.2 文件供专业翻译人员审查。XLIFF 是由 CAT 工具（如 memoQ、SDL Trados 和 Phrase）支持的通用交换格式。

```bash
champollion xliff export --locale fr                   # export French XLIFF
champollion xliff export --locale ja --out ./review/   # custom output path
champollion xliff import .champollion/xliff/fr.xliff       # import reviewed file
champollion xliff import ./reviewed.xliff --dry        # preview import
```

| 子命令 | 输出 |
|--------|--------|
| `export` | 从源 + 目标语言环境文件生成 `.xliff` |
| `import` | 将审查的 `.xliff` 翻译合并到语言环境文件中 |

| 选项 | 效果 |
|--------|--------|
| `--locale <code>` | 导出的目标语言环境（必需） |
| `--out <path>` | 自定义输出路径或目录 |
| `--dry` | 预览导入而不写入 |

参见 [与专业翻译人员合作](/docs/guides/professional-translators) 了解完整工作流程。

---

## status

显示对配置、已安装插件、质量等级和基准分数。

```bash
champollion status
```

---

## provenance

审计所有已安装插件的翻译资源许可。

```bash
champollion provenance
```

---

## plugin

管理翻译方法插件。插件是预打包的翻译配方，安装到 `.champollion/methods/`。

```bash
champollion plugin list                      # show installed plugins
champollion plugin install ./my-method/      # install from local directory
champollion plugin remove crk-coached-v1     # remove a plugin
```

参见 [插件规范](/docs/reference/plugin-spec) 了解插件清单格式。

---

## leaderboard

浏览、搜索和安装来自网络排行榜的翻译方法。从排行榜安装的方法附带基准分数和完整的规范 MethodConfig — 评估期间使用的确切配置。

```bash
champollion leaderboard                          # show leaderboard
champollion leaderboard --pair en:fr             # filter by language pair
champollion leaderboard --install crk-coached-v8 # install a method plugin
champollion leaderboard --install crk-coached-v8 --apply  # install + patch config
```

| 选项 | 效果 |
|--------|--------|
| `--pair <code>` | 按语言对过滤排行榜（例如 `en:fr`） |
| `--install <name>` | 从排行榜安装方法插件 |
| `--apply` | 安装后，自动将 `methodPlugin` 添加到 `champollion.config.json` |

**`--apply` 工作流程：** 当您使用 `--apply` 安装时，champollion 将方法插件写入 `.champollion/methods/` **并且** 修补您的 `champollion.config.json` 以将其用于相关对。这是从"什么分数最高？"到"我在生产中使用它"的最快路径。

---

## fonts

下载和管理构造语言脚本转换器的 PUA 网络字体。使用私有使用区字符的语言（克林贡语、辛达林语、氪星语）需要自定义网络字体来呈现其脚本。此命令从经过验证的开源存储库下载它们。

```bash
champollion fonts list                           # show needed fonts
champollion fonts install                        # download all needed fonts
champollion fonts install --css                  # also generate CSS snippet
champollion fonts install --dir ./public/fonts   # custom output directory
```

| 子命令 | 输出 |
|--------|--------|
| `list` | 显示需要哪些 PUA 字体及其安装状态 |
| `install` | 为配置的语言下载字体 |

| 选项 | 效果 |
|--------|--------|
| `--dir <path>` | 覆盖字体输出目录（从项目类型自动检测） |
| `--css` | 生成 `conlang-fonts.css` 代码片段以及字体 |
| `--config <path>` | 配置文件的路径（用于检测哪些语言需要字体） |

**自动检测：** 输出目录从您的项目结构推断：
- **Docusaurus** → `static/fonts/` 或 `website/static/fonts/`
- **Hugo** → `static/fonts/`
- **默认** → `public/fonts/`

**原生 Unicode 转换器**（`crk` → 克里音节文、`sr` → 塞尔维亚西里尔字母）**不**需要字体安装。

参见 [构造语言、脚本和正字法](/docs/guides/conlangs-scripts-orthography) 了解完整的 PUA 字体详情。

## 三层管道

将 `lint`、`sync` 和 `audit` 一起使用以实现防弹 i18n：

```json title="package.json"
{
  "scripts": {
    "i18n:lint": "champollion lint",
    "i18n:sync": "champollion sync",
    "i18n:audit": "champollion audit"
  }
}
```

| 层 | 命令 | 何时 | 目的 |
|-------|---------|------|---------|
| **Lint** | `lint` | 提交前 | 阻止包含硬编码字符串的提交 |
| **Sync** | `sync` | 提交后 / CI | 翻译缺失和更改的键 |
| **Verify** | `verify` | 同步后 / CI | 确认翻译存在且正确 |
| **Audit** | `audit` | 构建步骤 | 如果任何语言环境有 `[EN]` 标记，则使部署失败 |

---

## 另请参阅

- [配置](/docs/getting-started/configuration) — 配置文件参考
- [翻译方法](/docs/guides/translation-methods) — 每对的方法选择
- [翻译记忆库](/docs/concepts/translation-memory) — 缓存和成本节省
- [与专业翻译人员合作](/docs/guides/professional-translators) — XLIFF 工作流程
- [插件规范](/docs/reference/plugin-spec) — 插件清单格式
- [CI/CD 指南](/docs/guides/ci-cd) — 在管道中自动化 CLI 命令
- [同步工作原理](/docs/concepts/how-sync-works) — 理解同步管道
- [质量门控](/docs/concepts/quality-gate) — 翻译验证方式
