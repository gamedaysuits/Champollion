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
  - label: "Troubleshooting"
    to: /docs/guides/troubleshooting
    kind: guide
---

# クイックスタート

最初のロケールファイルを60秒で翻訳できます。

CLIは[PolyForm Noncommercial License 1.0.0](https://github.com/gamedaysuits/Champollion/blob/main/cli/LICENSE)のもとで非商用利用において無料で使用できます。商用利用はこのライセンスの対象外です。学校、公立病院や診療所、慈善団体、個人プロジェクトは対象となりますが、店舗の店頭サイトなどは対象外です。詳細は[利用条件](/docs/getting-started/who-may-use-this)をご覧ください。

## 1. ロケールファイルの準備

ソースロケールファイルを作成します。ChampollionはJSON、TOML、YAMLなどに対応しています。完全な一覧は[CLIリファレンス](/docs/reference/cli)をご覧ください。

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

## 2. APIキーの設定

プロバイダーを選び、キーを設定します。

```bash
# Option A: OpenRouter (200+ models, recommended)
export OPENROUTER_API_KEY=sk-or-v1-...

# Option B: Gemini (free tier — zero cost to start)
export GEMINI_API_KEY=AI...

# Option C: a model on your own machine (Ollama, LM Studio, vLLM) — no key
#   nothing to export if it listens on Ollama's default http://localhost:11434/v1
#   another server: export LOCAL_API_BASE=http://localhost:8000/v1 (its address; or put that line in .env.local or .env)
```

Geminiの無料キーは[aistudio.google.com/apikey](https://aistudio.google.com/apikey)で取得できます。OpenRouterのキーは[openrouter.ai](https://openrouter.ai)で取得できます。選択肢Cの場合は、プロジェクトの設定時にモデル名を指定してください: `npx champollion init --yes --langs fr,de --method local --model llama3.1`（または`sync --method local --model llama3.1`を実行します）。

## 3. 同期の実行

```bash
npx champollion sync
```

:::note[手動で入力するか、スクリプトで実行するか？]
このページに記載されているコマンドは、手動で入力するものを想定しています。`npx champollion`はプロジェクトにインストールされたコピーを実行するか、npxが取得するもの（初回は最新リリース、以降はそのキャッシュされたコピー）を実行します。CIや`package.json`スクリプト、gitフックなど、スクリプトが自動で実行するコマンドでは、`npx --yes champollion@0.6 sync`のようにバージョンを指定すべきです。これにより、新しいリリースによってビルドで実行される内容が変わるのを防ぐことができます（また、`--yes`を指定することでnpxが確認のために停止するのを防ぎます）。[CIガイド](/docs/guides/ci-cd)や[フレームワークのページ](/docs/integrations/frameworks)でも、このようにバージョンを固定しています。
:::

:::tip[Geminiを使用する場合]
選択肢B（Gemini）を選んだ場合は、`--method gemini`を追加してください。
```bash
npx champollion sync --method gemini
```
:::

Champollionは以下の処理を行います。
1. `locales/en.json`をソースとして自動検出
2. 対象言語を検出（または確認プロンプトを表示）
3. すべてのキーを翻訳
4. `locales/fr.json`や`locales/ja.json`などを書き出し
5. 翻訳済みの内容を追跡するための`.champollion.lock`を作成

## 4. 結果の確認

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

## この後の動作

ソース文字列を変更すると、ChampollionはSHA-256ハッシュによる追跡で変更を検知し、次回の同期時にそのキーのみを再翻訳します。

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

変更されていないキー（`hero.subtitle`）は**スキップ**されます。その翻訳はすでに`locales/fr.json`内に存在するため、どこにも送信されず、検索すら行われません。API呼び出しもコストも発生せず、実行結果の「キャッシュから提供」の数値にもカウントされません。

**翻訳メモリ**（`.champollion/tm.json`、毎回の同期時に自動で構築）は、処理待ちキューに*入った*テキストのためのものです。元の文字列に戻した場合、別のファイルにある同じ文、ロケール全体のやり直し（`sync --redo all`）などが該当します。これらはキャッシュから無料で提供され、実行時の行にその件数が表示されます（`… 0 key(s) sent to the model, 12 served from the cache (free)`）。キャッシュは、方式（method）、レジスター（register）、コーチング（coaching）ごとに保持されます（言語ペアごと、およびそのフォールバックごとにそれぞれ保持）。方式を切り替えた後（例えば`local` → `llm`）、またはコーチングファイルのテキストを変更した後（ペア、その言語、またはそのフォールバックにおいて）は、何も再利用されず、実行ログにその理由が表示されます。モデルの変更だけであれば以前の翻訳が再利用されます。設定変更それ自体によって自動的に再翻訳が行われることはありません。`sync`を実行することでやり直しとその推定費用が表示されます。

## 任意: 設定ファイルの作成

より詳細に制御したい場合は、設定ファイルを生成します。

```bash
npx champollion init                         # guided wizard
npx champollion init --yes --langs fr,de,ja  # quick setup with specific targets
npx champollion init --yes --langs fr,de --method local --model llama3.1   # a model on this machine
```

`--method`と`--model`で翻訳方式とモデルを選択します（`npx champollion init --help`で使用可能な方式を一覧表示できます）。initの実行時に、設定ファイルがどれを使用しているかが出力されます。

対話形式のウィザードに沿って、各言語の**レジスタープリセット**（その言語体系に合わせて調整された、口調や丁寧さの事前定義済み指示）を設定できます。フランス語にはT-Vプリセット（vouvoiement vs tutoiement）、韓国語にはスピーチレベル（해요체 vs 합쇼체 vs 해체）、日本語には敬語の選択肢（です/ます vs 丁寧語）が用意されています。

または、プリセットキーを使用して手動で設定ファイルを作成することもできます。

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
  "model": "google/gemini-3.8-flash"
}
```

各言語で利用可能なプリセットを確認するには、`npx champollion init`を実行してください。

## 任意: ウォッチモード

ソースファイルが変更されたときに自動翻訳します。

```bash
npx champollion watch
```

## 次のステップ

- **[設定](/docs/getting-started/configuration)** — 設定リファレンスの全容
- **[翻訳方式](/docs/guides/translation-methods)** — 言語ペアごとに最適な方式の選択
- **[翻訳メモリ](/docs/concepts/translation-memory)** — キャッシュによる再実行時のコスト削減の仕組み
- **[プロの翻訳者との連携](/docs/guides/professional-translators)** — 人手によるレビューのためのXLIFFエクスポート
- **[フレームワークとの連携](/docs/integrations/frameworks)** — Hugo、next-intl、react-i18next
- **[CI/CD](/docs/guides/ci-cd)** — パイプラインでの翻訳自動化
- **[トラブルシューティング](/docs/guides/troubleshooting)** — よくある問題と解決策
