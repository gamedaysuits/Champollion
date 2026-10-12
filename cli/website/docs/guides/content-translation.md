---
sidebar_position: 5
title: Content Translation
---

# Content Translation (Markdown)

Champollion translates Markdown and MDX files, both the front matter fields and the body. Code blocks, shortcodes and other structured elements are protected from translation.

The files live in a **content directory** (`contentDir`). That can be any folder of Markdown: a Hugo site's `content/`, or a folder of newsletters inside a Next.js app. A Docusaurus site (one with a `docusaurus.config.js`) is different: its `docs/` and `blog/` are translated into `i18n/<locale>/` folders without a `contentDir`. See [Framework Integration](/docs/guides/framework-integration).

## Setup

Set `contentDir` in your config, or pass `--content-dir` on the command line:

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

At the start of a run, sync names the folder and says where the translations will go:

```
[INFO] Content directory: newsletters — a folder of Markdown/MDX files (no Hugo site found); each translation is written beside its source as <name>.<locale>.md
```

In a Hugo site it also names the evidence it found, for example `Detected framework: Hugo (hugo.toml)`. Hugo counts as found when there is a `hugo.toml`/`.yaml`/`.yml`/`.json` file, Hugo's `config/_default/` folder, a `config.toml` or `config.yaml` with a Hugo-only setting such as `baseURL`, an `archetypes/` folder, or a `layouts/` folder of Hugo templates. Hugo or not, the files are translated and named the same way.

## Where Translations Go

Each translation is written **next to its source**, with the target locale added before the extension. This is Hugo's translation-by-filename convention:

```
newsletters/2026-10.md      → newsletters/2026-10.crk.md
newsletters/2026-10.md      → newsletters/2026-10.fr.md
posts/launch.mdx            → posts/launch.crk.mdx       (.mdx stays .mdx)
posts/launch.en.md          → posts/launch.crk.md        (the source-language suffix is dropped)
```

Subfolders are searched too, and each translation stays in its source's folder. Your app picks the file for a locale by that name. A Next.js page, for example, reads `newsletters/2026-10.crk.md` for Plains Cree.

**Which files count as sources.** Every `.md` and `.mdx` file in the folder is a source, unless its name ends in `.<code>.md` (or `.mdx`) and `<code>` looks like a language code. A language code here is two or three lowercase letters, optionally followed by a script such as `-Hant` and/or a region such as `-BR` or `-419`. Those files are taken to be translations and skipped. A source-language suffix (`launch.en.md`) still counts as a source. One trap: a source file named like `guide.faq.md` also ends in a two-to-three-letter suffix, so it is taken for a translation into "faq" and is not translated. Rename it, for example to `guide-faq.md`.

## What Gets Translated

### Front Matter

Both YAML (`---`) and TOML (`+++`) delimiters are supported. By default, these fields are translated:

- `title`
- `description`
- `summary`
- `subtitle`
- `caption`
- `linkTitle`
- `sidebar_label`

All other fields (`date`, `draft`, `tags`, `weight`, `slug`, etc.) are copied from the source as they are. You can change the list with `translatableFields` in your config.

### Body Content

By default the body is split into paragraphs and other top-level blocks, and each block is translated. Structured elements are shielded by placeholders before translation and restored afterwards. With `contentSegmentation: "page"` the body is translated as one piece.

## Block Protection

These elements pass through translation untouched:

| Element | Example | Protection |
|---------|---------|-----------|
| Code blocks | ``````` ```js ... ``` ``````` | Full block shielded |
| Inline code | `` `variable` `` | Shielded |
| Hugo shortcodes | `{{< figure >}}`, `{{% note %}}` | Full block shielded |
| Raw HTML | `<div>`, `<table>` | Shielded |
| Links (URLs) | `[text](https://...)` | URL preserved, text translated |
| Interpolation | `{{ .Count }}` | Shielded |

## When a File Is Translated Again

Sync records a fingerprint (SHA-256) of each source file in `.champollion-content.lock`. Commit that file with your translations.

- **Source unchanged:** the translation is not touched.
- **Source changed:** the file is updated. Paragraphs whose English is unchanged come from the [Translation Memory](/docs/concepts/translation-memory) at no cost, so you pay only for the paragraphs that changed.
- **A translation file with no lock entry** (one you wrote by hand) is kept as it is and recorded as yours. The exception is a file that still contains `[EN] ` markers written by a CLI older than 0.5.0, which is translated again.
- **A block the quality gate refused, also when asked again with the reason,** keeps its source text, with no marker on the page. The page's lock entry reads `pending:<hash>`, and the refusal is recorded in `.champollion-content.lock`. Later syncs do not send that block to the same model again, so it is not billed again. `status` and `verify` list the page. Ask again with `--redo files:<page>`, add a `fallback` method, or write the paragraph yourself (it is kept). A refused front-matter field keeps its source text in the same way, and the rest of the page is written. See [Refused Markdown blocks and front-matter fields](/docs/concepts/quality-gate#refused-markdown-blocks-and-front-matter-fields).

To translate a file again on purpose, name it. The path is the one sync prints, relative to the content directory:

```bash
npx champollion sync --redo files:2026-10.md          # rebuild from the cache (free for unchanged text)
npx champollion sync --redo files:2026-10.md --fresh  # translate it again from scratch (paid again)
```

## Reviewing and Editing Translations {#reviewing-and-editing-translations}

A reviewer can correct translated Markdown directly in the translated file. Champollion keeps those corrections when the source changes later.

1. Run `champollion sync` and commit the translations together with `.champollion-content.lock`.
2. The reviewer opens the translated file, for example `newsletters/2026-10.crk.md`, and edits it. They can change any paragraph, or a translated front-matter field such as `title` or `description`.
3. The reviewer commits the file. No command is needed to "accept" the edits.

What happens to the edits on the next `champollion sync`:

| Situation | What sync does |
|---|---|
| The source has not changed | Nothing. The translation is left exactly as the reviewer left it. |
| The source changed in **other** paragraphs | The reviewer's paragraphs and fields are **kept word for word** and the changed paragraphs are translated. The run says so, for example `kept the edits made by hand to 1 paragraph(s) of 2026-10.crk.md`. The reviewer's text stays theirs on every later sync. |
| The source paragraph the reviewer edited **also** changed | That paragraph is translated again, because the reviewer's version translates English that no longer exists. The run prints a warning with the reviewer's wording, so it can be re-applied if it still fits. |
| The reviewer added, removed or merged paragraphs, or the pair uses `contentSegmentation: "page"` | The edits can't be matched paragraph by paragraph. When the source changes, the file is **left exactly as it is**, and every sync warns and lists it until it is resolved. Either bring it up to date by hand (the next sync then takes the edited file as current), or replace it with machine translation using `--redo files:<path>`. |

Edits to code blocks, whitespace between paragraphs, and front-matter fields that are not translated (`date`, `tags`, and so on) are not kept when the file is rewritten. Those parts always come from the source.

**Replacing the edits deliberately.** Edits are replaced only when you name the file. `--redo files:2026-10.md` puts the cached machine translation back. `--redo files:2026-10.md --fresh` (or `--retranslate 2026-10.md`) translates it again from scratch. A run that re-processes all content without naming files (`--redo content`, `--force-content`) keeps the edits.

**How the edits are recognised.** Each time sync writes a translation, it also records in `.champollion-content.lock` a short fingerprint of every paragraph it wrote. A paragraph on disk that no longer matches was changed by a person. If the lock file is lost, edits can't be recognised, so keep it in version control. A translation written by an older Champollion version is recorded on the next sync. If your edits to it differ from what the Translation Memory holds, they are recognised as yours.

The reviewer's text is never stored in the Translation Memory as machine output.

:::note[XLIFF covers string files only]
`champollion xliff export` hands your app's **string files** (keys and values) to a translator's CAT tool. See [Working with Professional Translators](/docs/guides/professional-translators). There is no XLIFF export for Markdown content yet, so translated Markdown is reviewed in the files themselves, as described above.
:::

## Markdown-Only Methods

:::warning[Google Translate and Markdown]
Google Translate has **no awareness** of code blocks, shortcodes, or interpolation variables. It will corrupt structured Markdown content. Use LLM methods (`llm` or `llm-coached`) for content translation, because they explicitly shield structured elements.
:::

When content translation falls back from Google Translate to an LLM method, champollion logs a warning explaining why.
