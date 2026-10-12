---
sidebar_position: 5
title: "内容翻译"
---

# 内容翻译 (Markdown)

Champollion 可以翻译 Markdown 和 MDX 文件，包括 front matter 字段和正文。代码块、shortcode 以及其他结构化元素都会受到保护，免遭翻译。

这些文件存放在**内容目录**（`contentDir`）中。它可以是任何包含 Markdown 的文件夹：例如 Hugo 站点的 `content/`，或 Next.js 应用中存放 newsletter 的文件夹。Docusaurus 站点（带有 `docusaurus.config.js` 的站点）则有所不同：其 `docs/` 和 `blog/` 会被翻译到 `i18n/<locale>/` 文件夹中，且无需 `contentDir`。请参阅[框架集成](/docs/guides/framework-integration)。

## 设置

在配置中设置 `contentDir`，或在命令行中传入 `--content-dir`：

```json title="champollion.config.json"
{
  "version": 3,
  "inputLocale": "en",
  "localesDir": "./messages",
  "contentDir": "./newsletters"
}
```

```bash
npx champollion sync                              # translates string files and content files
npx champollion sync --content-dir ./newsletters  # same, folder given on the command line
```

在运行开始时，sync 会指明文件夹名称并显示翻译文件的目标位置：

```
[INFO] Content directory: newsletters — a folder of Markdown/MDX files (no Hugo site found); each translation is written beside its source as <name>.<locale>.md
```

在 Hugo 站点中，它还会列出找到的依据，例如 `Detected framework: Hugo (hugo.toml)`。当存在 `hugo.toml`/`.yaml`/`.yml`/`.json` 文件、Hugo 的 `config/_default/` 文件夹、包含 Hugo 特有设置（如 `baseURL`）的 `config.toml` 或 `config.yaml`、`archetypes/` 文件夹，或包含 Hugo 模板的 `layouts/` 文件夹时，即视为检测到 Hugo。无论是否为 Hugo，文件的翻译和命名方式都是相同的。

## 翻译文件的存放位置

每个翻译文件都会写入**源文件所在位置的旁边**，并在扩展名前加上目标语言区域（locale）。这是 Hugo 按文件名组织翻译的约定：

```
newsletters/2026-10.md      → newsletters/2026-10.crk.md
newsletters/2026-10.md      → newsletters/2026-10.fr.md
posts/launch.mdx            → posts/launch.crk.mdx       (.mdx stays .mdx)
posts/launch.en.md          → posts/launch.crk.md        (the source-language suffix is dropped)
```

子文件夹也会被一并搜索，每个翻译文件都会保留在其源文件所在的文件夹中。你的应用可根据该文件名获取对应语言区域的文件。例如，Next.js 页面会读取 `newsletters/2026-10.crk.md` 来呈现平原克里语（Plains Cree）。

**哪些文件算作源文件。** 文件夹中的每个 `.md` 和 `.mdx` 文件都是源文件，除非其名称以 `.<code>.md`（或 `.mdx`）结尾且 `<code>` 看起来像语言代码。此处的语言代码是指两到三个小写字母，后可选择性接书写系统（如 `-Hant`）和/或地区（如 `-BR` 或 `-419`）。这些文件会被视为翻译文件并予以跳过。带有源语言后缀（`launch.en.md`）的文件仍会被视为源文件。需要注意的一个陷阱：名为 `guide.faq.md` 的源文件同样以两到三个字母的后缀结尾，因此会被误认为是翻译成“faq”的文件而不会被翻译。请将其重命名，例如改为 `guide-faq.md`。

## 翻译内容

### 前置元数据

支持 YAML (`---`) 和 TOML (`+++`) 分隔符。默认情况下，这些字段会被翻译：

- `title`
- `description`
- `summary`
- `subtitle`
- `caption`
- `linkTitle`
- `sidebar_label`

所有其他字段（`date`、`draft`、`tags`、`weight`、`slug` 等）都会原样从源文件复制。你可以在配置中使用 `translatableFields` 更改该列表。

### 正文内容

默认情况下，正文会被拆分为段落和其他顶层块，每个块分别进行翻译。结构化元素在翻译前会用占位符进行屏蔽保护，翻译完成后予以恢复。使用 `contentSegmentation: "page"` 时，正文将作为整体一次性翻译。

## 块保护

这些元素在翻译过程中保持不变：

| 元素 | 示例 | 保护 |
|---------|---------|-----------|
| 代码块 | ``````` ```js ... ``` ``````` | 完整块屏蔽 |
| 行内代码 | `` `variable` `` | 屏蔽 |
| Hugo 短代码 | `{{< figure >}}`、`{{% note %}}` | 完整块屏蔽 |
| 原始 HTML | `<div>`、`<table>` | 屏蔽 |
| 链接 (URL) | `[text](https://...)` | URL 保留，文本翻译 |
| 插值 | `{{ .Count }}` | 屏蔽 |

## 何时会重新翻译文件

Sync 会在 `.champollion-content.lock` 中记录每个源文件的指纹（SHA-256）。请将该文件与翻译内容一起提交。

- **源文件未更改：** 不触动翻译文件。
- **源文件已更改：** 更新文件。英文未发生变化的段落将免费从[翻译记忆库（Translation Memory）](/docs/concepts/translation-memory)中获取，因此你只需为发生更改的段落付费。
- **没有锁定条目的翻译文件**（手动编写的文件）将保持原样并记录为你所编写。例外情况是，仍包含由低于 0.5.0 版本的 CLI 写入的 `[EN] ` 标记的文件会被重新翻译。
- **被质量检查门限（Quality Gate）拒绝的块（包括附带原因重新请求后仍被拒绝的块），** 会保留其源文本，页面上不添加任何标记。页面的锁定条目显示为 `pending:<hash>`，且拒绝记录会保存在 `.champollion-content.lock` 中。后续的 sync 不会再将该块发送给同一个模型，因此不会重复计费。`status` 和 `verify` 会列出该页面。你可以使用 `--redo files:<page>` 重新请求、添加 `fallback` 方法，或自行编写该段落（手动编写的内容会被保留）。被拒绝的 front matter 字段同样保留其源文本，页面的其余部分正常写入。请参阅[被拒绝的 Markdown 块与 front-matter 字段](/docs/concepts/quality-gate#refused-markdown-blocks-and-front-matter-fields)。

若要特意重新翻译某个文件，请指定其路径。该路径即 sync 打印的路径，相对于内容目录：

```bash
npx champollion sync --redo files:2026-10.md          # rebuild from the cache (free for unchanged text)
npx champollion sync --redo files:2026-10.md --fresh  # translate it again from scratch (paid again)
```

## 审校与编辑翻译 {#reviewing-and-editing-translations}

审校人员可以直接在翻译后的文件中修正 Markdown。后续源文件发生变更时，Champollion 会保留这些修正。

1. 运行 `champollion sync`，并将翻译文件与 `.champollion-content.lock` 一起提交。
2. 审校人员打开翻译文件（例如 `newsletters/2026-10.crk.md`）并进行编辑。他们可以修改任意段落，或是已翻译的 front matter 字段（例如 `title` 或 `description`）。
3. 审校人员提交该文件。无需任何命令来“接受”这些编辑。

在下一次执行 `champollion sync` 时，这些编辑会发生什么：

| 场景 | sync 的处理方式 |
|---|---|
| 源文件未更改 | 不做任何处理。翻译内容完全保持审校人员修改后的状态。 |
| 源文件在**其他**段落发生了更改 | 审校人员修改的段落和字段会被**逐字保留**，仅翻译发生更改的段落。运行日志会明确提示，例如 `kept the edits made by hand to 1 paragraph(s) of 2026-10.crk.md`。审校人员的文本在后续的每次 sync 中都会被保留。 |
| 审校人员编辑过的源段落**也**发生了更改 | 该段落会被重新翻译，因为审校人员的版本对应的是已不存在的英文原文。运行日志会打印警告并附带审校人员的措辞，以便在依然适用的情况下重新应用。 |
| 审校人员添加、删除或合并了段落，或者该语言对使用了 `contentSegmentation: "page"` | 编辑内容无法按段落进行匹配。当源文件发生更改时，该文件会**完全保持原样**，并且每次 sync 都会发出警告并将其列出，直到问题得到解决。你可以手动将其更新至最新状态（后续 sync 会将编辑后的文件视为最新版本），或者使用 `--redo files:<path>` 将其替换为机器翻译。 |

重写文件时，对代码块、段落间空白以及未翻译的 front matter 字段（如 `date`、`tags` 等）的编辑不会被保留。这些部分始终来自源文件。

**刻意替换编辑内容。** 只有明确指定文件名时，编辑内容才会被替换。`--redo files:2026-10.md` 会恢复缓存中的机器翻译。`--redo files:2026-10.md --fresh`（或 `--retranslate 2026-10.md`）会从头重新翻译该文件。不指定文件名而重新处理所有内容的运行（`--redo content`、`--force-content`）会保留这些编辑。

**如何识别编辑内容。** 每次 sync 写入翻译时，还会在 `.champollion-content.lock` 中记录所写入每个段落的简短指纹。磁盘上不再匹配的段落即判定为由人工修改。如果锁定文件丢失，将无法识别编辑内容，因此请务必将其纳入版本控制。由旧版 Champollion 写入的翻译会在下一次 sync 时记录。如果你对其所做的编辑与翻译记忆库中的内容不同，它们就会被识别为你的人工修改。

审校人员的文本绝不会作为机器输出存储在翻译记忆库中。

:::note[XLIFF 仅支持字符串文件]
`champollion xliff export` 可将应用的**字符串文件**（键和值）交付给译员的 CAT 工具。请参阅[与专业译员协作](/docs/guides/professional-translators)。目前暂不支持导出 Markdown 内容的 XLIFF，因此翻译后的 Markdown 需要如上所述直接在文件本身中进行审校。
:::

## 仅限 Markdown 的方法

:::warning[Google Translate 与 Markdown]
Google Translate **无法识别**代码块、shortcode 或插值变量。它会损坏结构化的 Markdown 内容。进行内容翻译时请使用 LLM 方法（`llm` 或 `llm-coached`），因为它们会显式屏蔽并保护结构化元素。
:::

当内容翻译从 Google Translate 回退到 LLM 方法时，champollion 会记录一条警告，说明原因。
