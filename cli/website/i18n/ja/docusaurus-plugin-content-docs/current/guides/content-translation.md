---
sidebar_position: 5
title: "コンテンツの翻訳"
---

# コンテンツ翻訳 (Markdown)

Champollion は Markdown および MDX ファイルのフロントマターフィールドと本文の両方を翻訳します。コードブロック、ショートコード、その他の構造化要素は翻訳から保護されます。

ファイルは**コンテンツディレクトリ**（`contentDir`）に配置されます。これは Markdown が含まれる任意のフォルダーに設定できます。Hugo サイトの `content/` や、Next.js アプリ内のニュースレターフォルダーなどです。Docusaurus サイト（`docusaurus.config.js` を持つサイト）は異なり、その `docs/` や `blog/` は `contentDir` なしで `i18n/<locale>/` フォルダーに翻訳されます。[フレームワークの統合](/docs/guides/framework-integration)を参照してください。

## セットアップ

設定で `contentDir` を指定するか、コマンドラインで `--content-dir` を渡します。

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

実行の開始時に、sync はフォルダー名と翻訳先を表示します。

```
[INFO] Content directory: newsletters — a folder of Markdown/MDX files (no Hugo site found); each translation is written beside its source as <name>.<locale>.md
```

Hugo サイトでは、検出された証拠（例: `Detected framework: Hugo (hugo.toml)`）も表示されます。`hugo.toml`/`.yaml`/`.yml`/`.json` ファイル、Hugo の `config/_default/` フォルダー、`baseURL` などの Hugo 専用設定を含む `config.toml` や `config.yaml`、`archetypes/` フォルダー、または Hugo テンプレートの `layouts/` フォルダーが存在する場合に Hugo であると判定されます。Hugo であるかどうかに関わらず、ファイルは同じ方法で翻訳され、名前が付けられます。

## 翻訳ファイルの出力先

各翻訳ファイルは、拡張子の前にターゲットロケールが付加された状態で**ソースファイルの隣**に書き出されます。これは Hugo のファイル名による翻訳規則（translation-by-filename convention）です。

```
newsletters/2026-10.md      → newsletters/2026-10.crk.md
newsletters/2026-10.md      → newsletters/2026-10.fr.md
posts/launch.mdx            → posts/launch.crk.mdx       (.mdx stays .mdx)
posts/launch.en.md          → posts/launch.crk.md        (the source-language suffix is dropped)
```

サブフォルダーも同様に検索され、各翻訳ファイルは元のソースファイルと同じフォルダー内に保持されます。アプリケーションはその名前に基づいてロケール用のファイルを取得します。たとえば、Next.js ページは平原クリー語（Plains Cree）に対して `newsletters/2026-10.crk.md` を読み込みます。

**どのファイルがソースとみなされるか。** フォルダー内のすべての `.md` および `.mdx` ファイルは、ファイル名が `.<code>.md`（または `.mdx`）で終わり、`<code>` が言語コードのように見えない限り、ソースとして扱われます。ここでの言語コードとは、2〜3文字の小文字であり、任意で `-Hant` などの文字体系や `-BR` や `-419` などの地域コードが続くものを指します。それらのファイルは翻訳ファイルとみなされ、スキップされます。ソース言語のサフィックス（`launch.en.md`）はソースとして扱われます。注意点として、`guide.faq.md` のような名前のソースファイルも2〜3文字のサフィックスで終わるため、「faq」への翻訳とみなされて翻訳されません。たとえば `guide-faq.md` のようにリネームしてください。

## 翻訳される内容

### フロントマター

YAML（`---`）と TOML（`+++`）の両方の区切り記号に対応しています。デフォルトでは、以下のフィールドが翻訳されます：

- `title`
- `description`
- `summary`
- `subtitle`
- `caption`
- `linkTitle`
- `sidebar_label`

その他のすべてのフィールド（`date`、`draft`、`tags`、`weight`、`slug` など）はソースからそのままコピーされます。設定の `translatableFields` でこの一覧を変更できます。

### 本文コンテンツ

デフォルトでは、本文は段落やその他のトップレベルブロックに分割され、各ブロックが翻訳されます。構造化要素は翻訳前にプレースホルダーによって保護され、翻訳後に復元されます。`contentSegmentation: "page"` を使用すると、本文全体がひとかたまりとして翻訳されます。

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

## ファイルが再翻訳されるタイミング

sync は各ソースファイルのフィンガープリント（SHA-256）を `.champollion-content.lock` に記録します。このファイルは翻訳ファイルと一緒にコミットしてください。

- **ソースに変更がない場合:** 翻訳ファイルは変更されません。
- **ソースに変更があった場合:** ファイルが更新されます。英語の変更がない段落は[翻訳メモリ（Translation Memory）](/docs/concepts/translation-memory)から無償で取得されるため、変更された段落のコストのみが発生します。
- **ロックエントリのない翻訳ファイル**（手動で作成したもの）はそのまま保持され、手動作成分として記録されます。例外として、0.5.0 より前の CLI によって書き込まれた `[EN] ` マーカーが残っているファイルは再翻訳されます。
- **クオリティゲートで拒否され、理由を付与して再試行しても拒否されたブロック**は、ページ上にマーカーを残さず、ソーステキストを維持します。ページのロックエントリには `pending:<hash>` と記録され、拒否の内容は `.champollion-content.lock` に記録されます。その後の sync ではそのブロックが同一モデルに再度送信されることはないため、再度課金されることはありません。`status` や `verify` にそのページが一覧表示されます。`--redo files:<page>` で再試行するか、`fallback` メソッドを追加するか、あるいは段落を手動で記述（保持されます）してください。拒否されたフロントマターフィールドも同様にソーステキストが保持され、ページの残りの部分は書き出されます。[拒否された Markdown ブロックとフロントマターフィールド](/docs/concepts/quality-gate#refused-markdown-blocks-and-front-matter-fields)を参照してください。

ファイルを意図的に再翻訳するには、ファイル名を指定します。パスは sync が表示するコンテンツディレクトリからの相対パスです。

```bash
npx champollion sync --redo files:2026-10.md          # rebuild from the cache (free for unchanged text)
npx champollion sync --redo files:2026-10.md --fresh  # translate it again from scratch (paid again)
```

## 翻訳のレビューと編集 {#reviewing-and-editing-translations}

レビュー担当者は、翻訳された Markdown ファイルを直接編集して修正できます。後からソースが変更された場合でも、Champollion はそれらの修正を保持します。

1. `champollion sync` を実行し、翻訳ファイルを `.champollion-content.lock` と一緒にコミットします。
2. レビュー担当者が翻訳ファイル（例: `newsletters/2026-10.crk.md`）を開いて編集します。任意の段落や、`title` や `description` などの翻訳されたフロントマターフィールドを変更できます。
3. レビュー担当者がファイルをコミットします。編集内容を「承認」するための特別なコマンドは不要です。

次回の `champollion sync` 実行時に編集内容がどうなるか:

| 状況 | sync の動作 |
|---|---|
| ソースに変更がない | 何もしません。翻訳はレビュー担当者が残した状態のまま維持されます。 |
| ソースの**他の**段落が変更された | レビュー担当者の段落とフィールドは**一語一句そのまま保持**され、変更された段落のみが翻訳されます。実行ログにもその旨（例: `kept the edits made by hand to 1 paragraph(s) of 2026-10.crk.md`）が出力されます。レビュー担当者のテキストは以降のすべての sync で保持されます。 |
| レビュー担当者が編集したソース段落**も**変更された | レビュー担当者のバージョンはすでに存在しない英語に対する翻訳であるため、その段落は再翻訳されます。実行時にレビュー担当者が編集した文言を含む警告が表示されるため、引き続き適切であれば再適用できます。 |
| レビュー担当者が段落を追加、削除、または統合した、あるいはペアが `contentSegmentation: "page"` を使用している | 段落ごとの対応付けができません。ソースが変更された場合、ファイルは**完全にそのまま維持**され、解決されるまで毎回の sync で警告および一覧表示されます。手動で最新の状態に更新するか（次回の sync でその編集済みファイルが最新として扱われます）、`--redo files:<path>` を使用して機械翻訳で置き換えてください。 |

コードブロック、段落間の空白行、および翻訳されないフロントマターフィールド（`date`、`tags` など）への編集は、ファイルが書き換えられる際には保持されません。これらの部分は常にソースから取得されます。

**意図的に編集内容を置き換える場合。** 編集内容が置き換えられるのは、ファイルを明示的に指定した場合のみです。`--redo files:2026-10.md` はキャッシュされた機械翻訳に戻します。`--redo files:2026-10.md --fresh`（または `--retranslate 2026-10.md`）はゼロから再翻訳します。ファイルを指定せずにすべてのコンテンツを再処理する実行（`--redo content`、`--force-content`）では、編集内容は保持されます。

**編集の検出方法。** sync は翻訳を書き出すたびに、書き出した各段落の短いフィンガープリントを `.champollion-content.lock` に記録します。ディスク上の段落が一致しなくなった場合、手動で変更されたとみなされます。ロックファイルが失われると編集を認識できなくなるため、必ずバージョン管理に含めてください。古いバージョンの Champollion によって書き出された翻訳は、次回の sync で記録されます。その編集内容が翻訳メモリ内のデータと異なる場合、手動による変更として認識されます。

レビュー担当者のテキストが機械翻訳の出力として翻訳メモリに保存されることはありません。

:::note[XLIFF は文字列ファイルのみを対象とします]
`champollion xliff export` はアプリケーションの**文字列ファイル**（キーと値）を翻訳者の CAT ツールに渡します。[プロの翻訳者との連携](/docs/guides/professional-translators)を参照してください。Markdown コンテンツ用の XLIFF エクスポートはまだ提供されていないため、翻訳された Markdown は上記で説明したようにファイル自体で直接レビューします。
:::

## Markdown 専用のメソッド

:::warning[Google 翻訳と Markdown]
Google 翻訳はコードブロック、ショートコード、または埋め込み変数を**認識しません**。構造化された Markdown コンテンツが破損する原因となります。コンテンツの翻訳には、構造化要素を明示的に保護する LLM メソッド（`llm` または `llm-coached`）を使用してください。
:::

コンテンツ翻訳が Google Translate から LLM メソッドにフォールバックした場合、champollion はその理由を説明する警告をログに出力します。
