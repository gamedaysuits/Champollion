---
sidebar_position: 5
title: "コンテンツの翻訳"
---

# コンテンツ翻訳（Hugo Markdown）

Champollion は Hugo Markdown ファイルを翻訳します。フロントマターのフィールドと本文コンテンツの両方を対象とし、コードブロック・ショートコード・構造化要素を完全に保護します。

## セットアップ

Markdown コンテンツ翻訳を有効にするには、設定ファイルで `contentDir` を指定してください：

```json title="champollion.config.json"
{
  "version": 3,
  "inputLocale": "en",
  "localesDir": "./i18n",
  "contentDir": "./content"
}
```

```bash
npx champollion sync    # translates both string files and content files
```

## 翻訳される内容

### フロントマター

YAML（`---`）と TOML（`+++`）の両方の区切り記号に対応しています。デフォルトでは、以下のフィールドが翻訳されます：

- `title`
- `description`
- `summary`
- `subtitle`
- `caption`
- `linkTitle`

その他のフィールド（`date`、`draft`、`tags`、`weight`、`slug` など）はそのまま保持されます。設定ファイルの `translatableFields` でカスタマイズできます。

### 本文コンテンツ

Markdown の本文全体がブロック保護付きで翻訳されます。構造化要素は翻訳前に Unicode センチネルプレースホルダーで保護され、翻訳後に復元されます。

## ブロック保護

以下の要素は翻訳時に変更されません：

| 要素 | 例 | 保護方法 |
|---------|---------|-----------|
| コードブロック | ``````` ```js ... ``` ``````` | ブロック全体を保護 |
| インラインコード | `` `variable` `` | 保護 |
| Hugo ショートコード | `{{< figure >}}`、`{{% note %}}` | ブロック全体を保護 |
| 生の HTML | `<div>`、`<table>` | 保護 |
| リンク（URL） | `[text](https://...)` | URL を保持し、テキストを翻訳 |
| 補間 | `{{ .Count }}` | 保護 |

## ファイル名の規則

Hugo のファイル名による翻訳パターンに従います：

```
my-post.md      → my-post.fr.md
my-post.en.md   → my-post.fr.md  (strips source suffix)
```

## スキップの動作

既存の翻訳済みファイルは**上書きされません**。`my-post.fr.md` がすでに存在する場合はスキップされます。再翻訳を強制するには、対象ファイルを削除してください。

## Markdown 専用のメソッド

:::warning[Google翻訳とMarkdown]
Google翻訳はコードブロック、ショートコード、補間変数を**認識しません**。構造化されたMarkdownコンテンツを破損させる可能性があります。コンテンツの翻訳にはLLMメソッド（`llm`または`llm-coached`）を使用してください。これらのメソッドは構造化要素を明示的に保護します。
:::

コンテンツ翻訳が Google Translate から LLM メソッドにフォールバックした場合、champollion はその理由を説明する警告をログに出力します。
