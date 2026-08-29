---
sidebar_position: 3
title: "Hugo 多言語サイト"
description: "クックブック: champollion を使って文字列ファイルと Markdown コンテンツの両方を翻訳する、Hugo 多言語サイトのフルセットアップ手順です。"
related:
  - label: "Content Translation"
    to: /docs/guides/content-translation
    kind: guide
    note: "Markdown and long-form content, not just strings"
  - label: "Framework Integration"
    to: /docs/guides/framework-integration
    kind: guide
  - label: "CI/CD"
    to: /docs/guides/ci-cd
    kind: guide
  - label: "Cookbook: Translate 30 Languages"
    to: /docs/tutorials/translate-30-languages
    kind: cookbook
    note: "Scale the same setup to thirty locales"
---

# クックブック：Hugo 多言語サイト

Hugo の多言語システムを設定し、JSON 文字列ファイルと Markdown コンテンツの翻訳の両方を champollion で処理します。プロジェクトのセットアップから本番デプロイまでの完全なワークフローを説明します。

**作成するもの：** 英語・フランス語・日本語に対応した Hugo サイト — ロケールファイルによる文字列翻訳と、Markdown 処理によるコンテンツ翻訳。

---

## プロジェクト構成

Champollion は Hugo の**ファイル名ベース**の翻訳モードを使用します。翻訳済みファイルはソースファイルと同じディレクトリに配置され、ファイル名に言語サフィックスが付加されます（例：`about.fr.md`）：

```
my-hugo-site/
├── content/
│   └── en/
│       ├── _index.md
│       ├── _index.fr.md           ← champollion generates
│       ├── _index.ja.md           ← champollion generates
│       ├── about.md
│       ├── about.fr.md            ← champollion generates
│       ├── about.ja.md            ← champollion generates
│       └── blog/
│           ├── first-post.md
│           ├── first-post.fr.md   ← champollion generates
│           └── first-post.ja.md   ← champollion generates
├── i18n/
│   ├── en.json
│   ├── fr.json                    ← champollion generates
│   └── ja.json                    ← champollion generates
└── hugo.toml
```

:::note[Hugo i18n モード]
Hugo は2つの翻訳戦略をサポートしています：**ファイル名ベース**（`about.fr.md` を `about.md` の隣に配置）と**ディレクトリベース**（別々の `content/fr/about.md` ツリーを使用）です。Champollion はファイル名ベースの翻訳を使用します。これは、`getTargetContentPath()` 関数がソースファイル名に言語サフィックスを付加してターゲットパスを生成するためです。Champollion を使用する際は、`hugo.toml` がファイル名ベースの翻訳用に設定されていることを確認してください。
:::

## ステップ 1：Hugo を設定する

```toml title="hugo.toml"
defaultContentLanguage = 'en'

[languages]
  [languages.en]
    languageName = 'English'
    weight = 1
  [languages.fr]
    languageName = 'Français'
    weight = 2
  [languages.ja]
    languageName = '日本語'
    weight = 3
```

## ステップ 2：Champollion を設定する

Champollion には 2 つの設定が必要です：ロケールファイルのパス（JSON 文字列用）とコンテンツディレクトリ（Markdown 用）。

```json title="champollion.config.json"
{
  "version": 3,
  "inputLocale": "en",
  "localesDir": "./i18n",
  "contentDir": "./content",
  "model": "google/gemini-3.5-flash",
  "pairs": {
    "en:fr": { "method": "llm" },
    "en:ja": { "method": "llm", "model": "openai/gpt-4o" }
  },
  "languages": {
    "fr": { "name": "French", "register": "Formal (vous-form)" },
    "ja": { "name": "Japanese", "register": "Polite/formal" }
  }
}
```

## ステップ 3：ソースコンテンツを作成する

### 文字列翻訳（i18n/）

```json title="i18n/en.json"
{
  "nav": {
    "home": "Home",
    "about": "About",
    "blog": "Blog",
    "contact": "Contact"
  },
  "footer": {
    "copyright": "© 2026 My Company. All rights reserved.",
    "privacy": "Privacy Policy"
  }
}
```

### Markdown コンテンツ（content/en/）

```markdown title="content/en/about.md"
---
title: "About Us"
description: "Learn more about our team and mission"
date: 2026-01-15
---

We build software that helps businesses communicate across languages.

Our platform supports **real-time translation** for over 30 languages,
with specialized support for low-resource languages.

## Our Mission

Language should never be a barrier to understanding.

## The Team

{{< team-grid >}}
```

## ステップ 4：同期を実行する

```bash
npx champollion sync
```

Champollion は両方の種類を処理します：

1. **文字列ファイル**（`i18n/en.json` → `i18n/fr.json`、`i18n/ja.json`）
2. **コンテンツファイル**（`content/en/about.md` → `content/en/about.fr.md`、`content/en/about.ja.md`）

### コンテンツ翻訳の詳細

Markdown を翻訳する際、champollion は自動的に以下を行います：

- コードブロック、ショートコード（`{{< ... >}}`）、インラインコード、HTML を**シールド**する
- フロントマターフィールド（`title`、`description`、`summary`）を**翻訳**する
- その他すべてのフロントマターフィールド（`date`、`draft`、`weight`、`tags`）を**保持**する
- シールドされたブロックを翻訳後に**復元**する

Hugo ショートコード `{{< team-grid >}}` は翻訳されずにそのまま通過します。

## ステップ 5：確認する

```bash
# Preview the site
hugo server

# Check translation status
npx champollion status
```

`localhost:1313/fr/` および `localhost:1313/ja/` にアクセスして、翻訳されたコンテンツを確認してください。

## ステップ 6：Hugo 言語スイッチャー

Hugo レイアウトに言語スイッチャーを追加します：

```html title="layouts/partials/language-switcher.html"
<nav class="language-switcher">
  {{ range $.Site.Home.AllTranslations }}
    <a href="{{ .Permalink }}"
       {{ if eq .Lang $.Site.Language.Lang }}class="active"{{ end }}>
      {{ .Language.LanguageName }}
    </a>
  {{ end }}
</nav>
```

## コンテンツの同期を維持する

英語コンテンツを更新したら、再度同期を実行してください。Champollion は変更されたファイルのみを再翻訳します：

```bash
# Edit content/en/about.md, then:
npx champollion sync
```

ロックファイルはファイルごとにコンテンツのハッシュを追跡するため、変更のないページは再翻訳されません。

## 関連情報

- **[コンテンツ翻訳ガイド](/docs/guides/content-translation)** — シールド処理、フロントマター、エッジケースの詳細解説
- **[フレームワーク統合](/docs/guides/framework-integration)** — Next.js および React のセットアップ
- **[CI/CD ガイド](/docs/guides/ci-cd)** — `content/en/` へのプッシュ時に同期を自動化する
- **[翻訳方式](/docs/guides/translation-methods)** — LLM・TM・ハイブリッド翻訳戦略の比較
- **[対応言語](/docs/reference/supported-languages)** — 対応ロケールと言語コードの一覧
