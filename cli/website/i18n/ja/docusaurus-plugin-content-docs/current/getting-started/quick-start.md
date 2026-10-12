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

このCLIは、[PolyForm Noncommercial License 1.0.0](https://github.com/gamedaysuits/Champollion/blob/main/cli/LICENSE) のもとで非商用利用において無料で使用できます。商用利用はこのライセンスの対象外です。学校、公立病院や診療所、慈善団体、個人プロジェクトなどは対象となりますが、店舗のECサイトなどは対象外です。詳細は [利用対象者について](/docs/getting-started/who-may-use-this) をご確認ください。

## 1. ロケールファイルを用意する

ソースロケールファイルを作成します。ChampollionはJSON、TOML、YAMLなどに対応しています。全リストは [CLIリファレンス](/docs/reference/cli) をご覧ください。

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

# Option C: a model on your own machine (Ollama, LM Studio, vLLM) — no key
#   nothing to export if it listens on Ollama's default http://localhost:11434/v1
#   another server: export LOCAL_API_BASE=http://localhost:8000/v1 (its address; or put that line in .env.local or .env)
```

Geminiの無料キーは [aistudio.google.com/apikey](https://aistudio.google.com/apikey) から取得できます。OpenRouterのキーは [openrouter.ai](https://openrouter.ai) から取得してください。オプションCの場合、プロジェクトのセットアップ時にモデル名を指定します: `npx champollion init --yes --langs fr,de --method local --model llama3.1`（または `sync --method local --model llama3.1` を実行）。

## 3. sync を実行する

```bash
npx champollion sync
```

:::note[手動で入力するか、スクリプトで実行するか？]
このページにあるコマンドは、ユーザーが手動で入力するものです。`npx champollion` はプロジェクトにインストールされたコピーを実行するか、またはnpxが取得したコピー（初回は最新リリース、それ以降はそのキャッシュされたコピー）を実行します。CI、`package.json` スクリプト、gitフックなど、スクリプトが代わりに実行するコマンドには、新しいリリースによってビルドで実行される内容が変わってしまわないよう、`npx --yes champollion@0.5 sync` のようにバージョンを指定してください（`--yes` を指定すると、npxが確認プロンプトで停止するのを防げます）。[CIガイド](/docs/guides/ci-cd) や [フレームワークのページ](/docs/integrations/frameworks) では、そのようにバージョンを固定しています。
:::

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

変更されていないキー（`hero.subtitle`）は**スキップ**されます。その翻訳はすでに `locales/fr.json` に存在するため、どこにも送信されず、ルックアップすら行われません。呼び出しも発生せず、コストもかからず、実行結果の「キャッシュから提供（served from the cache）」の数値にもカウントされません。

**翻訳メモリ**（`.champollion/tm.json`、各同期時に自動的に構築）は、処理待ちキューに*入った*テキストのためのものです。元に戻した文字列、別ファイル内の同じ文、ロケール全体の再翻訳（`sync --redo all`）などが該当します。これらはキャッシュから無料で提供され、実行時の行にその件数が表示されます（`… 0 key(s) sent to the model, 12 served from the cache (free)`）。キャッシュは、メソッド、レジスター、およびコーチング（言語ペアおよびそのフォールバックのそれぞれ）ごとに保持されます。メソッドを切り替えた後（例: `local` → `llm`）、あるいはコーチングファイルのテキストを変更した後（言語ペア、その言語、またはそのフォールバック上）は何も再利用されず、実行ログにその理由が表示されます。モデルの変更だけであれば、以前の翻訳が再利用されます。設定変更それ自体によって自動的に再翻訳されることはありません。`sync` は再翻訳とそのコストを表示します。

## オプション：設定ファイルを作成する

より細かく制御するには、設定ファイルを生成します：

```bash
npx champollion init                         # guided wizard
npx champollion init --yes --langs fr,de,ja  # quick setup with specific targets
npx champollion init --yes --langs fr,de --method local --model llama3.1   # a model on this machine
```

`--method` と `--model` で翻訳メソッドとモデルを選択します（`npx champollion init --help` でメソッドの一覧を表示）。initを実行すると、設定がどれを使用しているかが出力されます。

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
  "model": "google/gemini-3.8-flash"
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
