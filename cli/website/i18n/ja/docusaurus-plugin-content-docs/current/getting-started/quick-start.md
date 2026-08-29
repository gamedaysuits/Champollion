---
sidebar_position: 2
title: "クイックスタート"
related:
  - label: "Installation"
    to: /docs/getting-started/installation
    kind: guide
  - label: "Configuration"
    to: /docs/getting-started/configuration
    kind: reference
    note: "Every config field, explained"
  - label: "Cookbook: Translate 30 Languages"
    to: /docs/tutorials/translate-30-languages
    kind: cookbook
    note: "Scale from three locales to thirty"
  - label: "Troubleshooting"
    to: /docs/guides/troubleshooting
    kind: guide
---

# クイックスタート

最初のロケールファイルを60秒で翻訳します。

## 1. ロケールファイルを用意する

ソースロケールファイルを作成します。ChampollionはJSON、TOML、YAMLなどをサポートしています。完全なリストについては、[CLIリファレンス](/docs/reference/cli)を参照してください：

```json title="locales/en.json"
{
  "hero": {
    "title": "Welcome to our platform",
    "subtitle": "Build something amazing"
  },
  "nav": {
    "home": "Home",
    "about": "About",
    "contact": "Contact"
  }
}
```

## 2. APIキーを設定する

プロバイダーを選択してキーを設定します：

```bash
# Option A: OpenRouter (200+ models, recommended)
export OPENROUTER_API_KEY=sk-or-v1-...

# Option B: Gemini (free tier — zero cost to start)
export GEMINI_API_KEY=AI...
```

無料の Gemini キーは [aistudio.google.com/apikey](https://aistudio.google.com/apikey) で取得できます。OpenRouter キーは [openrouter.ai](https://openrouter.ai) で取得できます。

## 3. sync を実行する

```bash
npx champollion sync
```

:::tip[Gemini を使用していますか？]
Option B（Gemini）を選択した場合は、`--method gemini` を追加してください：
```bash
npx champollion sync --method gemini
```
:::

Champollion は以下を自動で行います：
1. `locales/en.json` をソースとして自動検出する
2. ターゲット言語を検索する（または入力を求める）
3. すべてのキーを翻訳する
4. `locales/fr.json`、`locales/ja.json` などを書き出す
5. 翻訳済みの内容を追跡するために `.champollion.lock` を作成する

## 4. 結果を確認する

```bash
cat locales/fr.json
```

```json
{
  "hero": {
    "title": "Bienvenue sur notre plateforme",
    "subtitle": "Construisez quelque chose d'incroyable"
  },
  "nav": {
    "home": "Accueil",
    "about": "À propos",
    "contact": "Contact"
  }
}
```

## 次に何が起こるか

ソース文字列を変更すると、Champollion は SHA-256 ハッシュによるトラッキングで変更を検出し、次回の sync 時にそのキーのみを再翻訳します：

```json title="locales/en.json (updated)"
{
  "hero": {
    "title": "Welcome to Acme Platform",  // ← changed
    "subtitle": "Build something amazing"  // ← unchanged, skipped
  }
}
```

```bash
npx champollion sync
# Only "hero.title" is re-translated across all locales
```

変更されていないキー（`hero.subtitle`）は Champollion の**翻訳メモリ**キャッシュから提供されます — API 呼び出しも費用も発生しません。キャッシュはすべての sync 時に自動的に構築され、`.champollion/tm.json` に保存されます。

## オプション：設定ファイルを作成する

より細かく制御するには、設定ファイルを生成します：

```bash
npx champollion init                         # guided wizard
npx champollion init --yes --langs fr,de,ja  # quick setup with specific targets
```

ガイド付きウィザードでは、各言語の**レジスタープリセット**を順番に設定できます。これは言語体系に合わせて調整された、トーン・丁寧さの指示をあらかじめ定義したものです。フランス語には T-V 区別のプリセット（vouvoiement と tutoiement）、韓国語には待遇表現のプリセット（해요체・합쇼체・해체）、日本語には敬語オプション（です/ます vs 丁寧語）があります。

または、プリセットキーを使って手動で設定ファイルを作成することもできます：

```json title="champollion.config.json"
{
  "version": 3,
  "inputLocale": "en",
  "localesDir": "./locales",
  "languages": {
    "fr": "casual-tu",
    "ko": "polite-haeyo",
    "ja": "polite"
  },
  "model": "google/gemini-2.5-flash"
}
```

`npx champollion init` を実行すると、各言語で利用可能なプリセットを確認できます。

## オプション：ウォッチモード

ソースファイルが変更されたときに自動翻訳します：

```bash
npx champollion watch
```

## 次のステップ

- **[設定](/docs/getting-started/configuration)** — 設定の完全なリファレンス
- **[翻訳方法](/docs/guides/translation-methods)** — 言語ペアごとに適切な方法を選択する
- **[翻訳メモリ](/docs/concepts/translation-memory)** — キャッシュによって再実行時のコストを削減する仕組み
- **[プロの翻訳者との連携](/docs/guides/professional-translators)** — 人間によるレビュー用に XLIFF をエクスポートする
- **[フレームワーク連携](/docs/guides/framework-integration)** — Hugo、next-intl、react-i18next
- **[CI/CD](/docs/guides/ci-cd)** — パイプラインで翻訳を自動化する
- **[トラブルシューティング](/docs/guides/troubleshooting)** — よくある問題と解決策
