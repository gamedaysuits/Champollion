# インテグレーションガイド

人気のフレームワークと champollion を連携するためのステップバイステップのセットアップ手順です。

---

## API キーの設定

どのフレームワークと連携する場合も、まず翻訳 API キーが必要です。Champollion は2つのプロバイダーをサポートしています。

### オプション A: OpenRouter（推奨）

[OpenRouter](https://openrouter.ai) は 200 以上の LLM モデルに対応した統合 API です。無料プランも利用できます。

```bash
# Sign up at https://openrouter.ai, then:
export OPENROUTER_API_KEY=sk-or-v1-...

# Or add to .env.local:
OPENROUTER_API_KEY=sk-or-v1-your-key-here
```

最適な用途: コンテンツ量の多いプロジェクト、Markdown の翻訳、コードブロック・ショートコード・補間変数などのコンテンツ認識シールドが必要なプロジェクト。

### オプション B: Google Translate

```bash
export GOOGLE_TRANSLATE_API_KEY=...
```

最適な用途: 大量のキーバリュー文字列ペア（194言語）。Markdownコンテンツには**推奨されません** — Google Translateはコードブロック、ショートコード、補間変数を認識しないためです。

Google Translate を明示的に使用するには:

```bash
champollion sync --method google-translate
```

> **ヒント**: `GOOGLE_TRANSLATE_API_KEY` のみが設定されている場合（OpenRouter キーなし）、champollion は自動的に Google Translate に切り替わります。

---

## Hugo（TOML / YAML / Markdown）

### プロジェクト構成

Hugo は文字列の翻訳に `i18n/` を、ページコンテンツに `content/` を使用します。

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

### セットアップ

```bash
npm install --save-dev champollion
```

```bash
# .env.local
OPENROUTER_API_KEY=sk-or-v1-your-key-here
```

`champollion.config.json` を作成します:

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

### コンテンツ翻訳の詳細

**フロントマター**: YAML（`---`）と TOML（`+++`）の両方のデリミタをサポートしています。デフォルトでは `title`、`description`、`summary`、`subtitle`、`caption`、`linkTitle` を翻訳します。その他のフィールド（date、draft、tags、weight、slug など）はそのまま保持されます。設定ファイルの `translatableFields` でカスタマイズできます。

**ブロック保護**: コードブロック、Hugo ショートコード（`{{< >}}`、`{{% %}}`）、インラインコード、生の HTML は Unicode センチネルプレースホルダーを使用して自動的にシールドされます。これらは変更されずにそのまま通過します。

**ファイル名の規則**: Hugo のファイル名による翻訳パターンに従います:
- `my-post.md` → `my-post.fr.md`
- `my-post.en.md` → `my-post.fr.md`（ソースのサフィックスを除去）

**既存ファイルのスキップ**: 既存の翻訳済みファイルは上書きされません。再翻訳を強制するには、対象ファイルを削除してください。

### 複数形

TOML および YAML ロケールは CLDR の複数形をサポートしています:

```toml
[items]
one = "{{ .Count }} item"
other = "{{ .Count }} items"
```

内部的には差分処理のために `items.one` と `items.other` として表現され、書き込み時に正しいセクション形式に再シリアライズされます。

---

## next-intl（JSON）

### プロジェクト構成

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

### セットアップ

```bash
npm install --save-dev champollion
```

`champollion.config.json` を作成します:

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

`messages/fr.json`、`messages/ja.json` などが生成されます — ネストされたキー構造を保持した完全な翻訳ファイルです。next-intl が自動的に読み込みます。

### 開発ワークフロー

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

### フラットなファイル構成（推奨）

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

### ネストされたディレクトリ構成

`{locale}/{namespace}.json` 構成を使用している場合は、フラット化 → 翻訳 → アンフラット化を行う同期スクリプトを作成してください。詳細は [react-i18next のドキュメント](https://react.i18next.com/) を参照してください。
