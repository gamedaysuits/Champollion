# Champollion

[![npm version](https://img.shields.io/npm/v/champollion.svg)](https://www.npmjs.com/package/champollion)
[![License: Apache-2.0](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](#license)


1つのコマンドでロケールファイルを翻訳します。

```bash
npx champollion sync
```

Champollionは、ロケールファイル、そのフォーマット、およびターゲット言語を自動検出します。不足しているキーを翻訳し、すでに翻訳済みのものはスキップして、結果を書き込みます。これだけで完了です。

> **Champollionの一部** — あらゆる言語において信頼できる機械翻訳を実現するためのオープンソースインフラストラクチャです。このCLIは、テストセットを構築し、誰が何を翻訳できるか、各手法が各種類のテキストでどの程度優れているか、そしてどこにまだギャップがあるかを示すマップを作成する大規模プロジェクトのデプロイメントエンドです。これは2種類のベンチマークで実行されます。オープンデータに基づく公開ベンチマーク（広範で安価、あらゆる手法を歓迎）と、ソブリンベンチマーク（コミュニティが作成、所有、管理し、私たちが決して見ることのない秘密のテストセット）です。インフラストラクチャはオープンソースであり、単一の管理下に置かれますが、コミュニティの言語のためのテストセットと手法は、そのコミュニティに属します。コミュニティと共に構築され、コミュニティからスクレイピングされることは決してありません。鍵を握るのはコミュニティです。人間による翻訳も機械翻訳も、あらゆる手法を歓迎します。ネットワークの探索は [champollion.dev/docs/network](https://champollion.dev/docs/network/) から行えます。

## なぜ自分でスクリプトを書かないのか？

英語のキーをループしてGoogle Translateを呼び出す簡単なスクリプトを書くことは可能です。多くの開発者がそうしており、約30行で書けます。しかし、それが破綻する理由は以下の通りです。

- **変更検出がない。** 英語の文字列を更新しても、翻訳は古いまま永遠に残ります。Champollionはすべてのソース値をSHA-256ハッシュで追跡し、変更されたものだけを再翻訳します。
- **バッチ処理がない。** 1キーにつき1回のAPI呼び出しでは、200キーで200回のラウンドトリップが発生します。Champollionはインテリジェントにバッチ処理を行います（設定可能、デフォルトはLLMで80キー/バッチ、Googleで128キー/バッチ）。
- **品質ゲートがない。** 機械翻訳はハルシネーションを起こしたり、ソースをそのまま返したり、間違った文字体系で出力したりします。Champollionは書き込む前にすべての翻訳を検証し、文字体系の誤り、文字数の異常な増加、ソースのオウム返しを検出して拒否します。
- **フォーマット認識がない。** JSONにハードコードされていませんか？ChampollionはJSON、TOML、YAML、Hugo Markdown（フロントマター＋本文）を自動検出して処理します。
- **安全性がない。** Champollionは、プロトタイプ汚染、細工されたロケールコードによるパストラバーサル、Markdown翻訳中のコードブロックの破損から保護します。

Champollionは、そのスクリプトのプロダクション版です。

> [!NOTE]
> **Champollionが翻訳するもの。** Champollionは、**ロケールファイルと構造化コンテンツ**（JSONのキーバリューペア、TOML/YAML設定、Hugo Markdownページ、XLIFF交換ドキュメント）を対象としています。UI文字列、ドキュメント、公式なコミュニケーション、教育資料など、フォーマルな書き言葉に最適化されています。チャットボット、リアルタイムの音声翻訳機、汎用の対話型AIではありません。各言語ペアの翻訳手法は設定可能であり、商用API（Google Translate、DeepL）から、[MT Eval Arena](https://champollion.dev/arena) を通じてベンチマークされたコミュニティ開発のプラグインまで対応しています。

## クイックスタート

```bash
npm install --save-dev champollion
```

### APIキーの取得

Champollionには翻訳バックエンドが必要です。以下から1つ選択してください。

| プロバイダー | キー | 最適な用途 |
|----------|-----|----------|
| **OpenRouter** (推奨) | `OPENROUTER_API_KEY` | コンテンツの多いプロジェクト、Markdown、200以上のモデル |
| **OpenAI** | `OPENAI_API_KEY` | GPT-4oへの直接アクセス |
| **Anthropic** | `ANTHROPIC_API_KEY` | Claudeへの直接アクセス |
| **Gemini** | `GEMINI_API_KEY` | 無料枠あり |
| **DeepL** | `DEEPL_API_KEY` | ヨーロッパ言語、用語集のサポート |
| **Google Translate** | `GOOGLE_TRANSLATE_API_KEY` | 130以上の言語、大量処理 |

**最速のスタート** (無料): [aistudio.google.com](https://aistudio.google.com/apikey) で登録し、無料のGeminiキーを取得します。

```bash
export GEMINI_API_KEY=AI...
npx champollion sync --method gemini
```

**OpenRouter** (200以上のモデル): [openrouter.ai](https://openrouter.ai) で登録し、以下を実行します。

```bash
export OPENROUTER_API_KEY=sk-or-v1-...
npx champollion sync
```

**Google Translate** の代替 (キーバリューペアのみ — Markdown認識なし):

```bash
export GOOGLE_TRANSLATE_API_KEY=...
npx champollion sync --method google-translate
```

> **注**: `GOOGLE_TRANSLATE_API_KEY` のみが設定されている場合、champollionは自動的にGoogle Translateに切り替わります。設定の変更は必要ありません。REST APIを直接使用するため、SDK、サービスアカウント、`pip install` は不要です。キーのみを使用します。

これだけで完了です。さらに詳細な制御を行うには、設定ファイルを作成します。

```bash
npx champollion init                        # guided wizard — walks you through registers, methods, and content
npx champollion init --yes --langs fr,de,ja  # quick setup with specific languages and default registers
```

各言語には**レジスタープリセット**が用意されています。これは、その言語体系に合わせて調整された、トーンやフォーマル度の事前構築済み指示です（フランス語のvouvoiement、ドイツ語のSiezen、日本語の「です/ます」、韓国語の「해요체」など）。初期化ウィザードでプリセットを閲覧して選択するか、`--yes` を渡してデフォルトを受け入れることができます。

### 英語以外のソース

ソース言語が英語でない場合:

```bash
champollion sync --source fr                      # CLI flag
```

または、設定ファイルで永続的に設定します。

```json
{ "inputLocale": "fr" }
```

## 主な機能

i18nフレームワーク（next-intl、i18next、Hugo）の処理はユーザーが行い、Champollionは翻訳ファイルを処理します。

- **マルチフォーマット** — JSON、TOML、YAML、Hugo Markdown（フロントマター＋本文）、およびXLIFF 1.2
- **インクリメンタル** — 変更されたものだけを翻訳（SHA-256ハッシュ追跡）
- **キャッシュ** — 翻訳メモリが以前の結果を保存。変更されていないキーの再同期にはコストがかかりません
- **品質ゲート** — すべての翻訳を検証。ハルシネーション、文字体系の誤り、ソースのオウム返し、文字数の異常な増加を検出
- **コンテンツ認識** — LLM手法により、Markdown翻訳中のコードブロック、ショートコード、リンク、補間変数を保護
- **パイプラインツール** — CIゲート用の `lint`、`audit`、`integrity`、`seo`
- **XLIFF相互運用性** — CATツール（memoQ、SDL Trados、Phrase）での専門家によるレビュー用に翻訳をエクスポートし、再度インポート可能
- **最小限の依存関係** — ランタイム依存関係は2つのみ（バンドルされた言語データベース用のbetter-sqlite3、CLDRロケール名）。プロバイダーのSDKは不要。Node 20以上が必要

## Google Translateの先へ

クイックスタートでは、LLMまたはGoogle Translateを使用して実行を開始できます。しかし、Google Translateがサポートしているのは約130言語です。世界には7,000以上の言語が存在します。

**Champollionのコアアイデア：翻訳手法は言語ペアごとに設定可能であること。** フランス語にはGoogle Translateを、平原クリー語（Plains Cree）には形態論的コーチングを伴うLLMを、ケチュア語にはコミュニティがホストするAPIを使用する。これらすべてを同じプロジェクト内で、同じCLIを使用して実行できます。

```json
{
  "version": 3,
  "pairs": {
    "en:fr": { "method": "google-translate" },
    "en:ja": { "method": "llm" },
    "en:crk": { "methodPlugin": "crk-coached-v1" }
  }
}
```

プロンプトエンジニアリング、コミュニティの辞書、FSTパイプライン、またはファインチューニングされたモデルなどを通じて、ある言語ペアの翻訳方法を見つけ出すことができれば、champollionを使用してその手法をプラグインとしてパッケージ化し、他のすべてのものと一緒にデプロイすることができます。

> 既存のAPIが存在しない平原クリー語（Plains Cree）へ本番ウェブサイトを翻訳する過程から生まれました。ペアごとのアーキテクチャは理論上のものではありません。あるプロジェクトで、フランス語用のGoogle Translateと、先住民言語用のコーチングされたFSTパイプラインを、同じ同期コマンド内で並行して実行する必要があったために存在しています。

付属の [MT Eval Harness](https://github.com/gamedaysuits/Champollion) を使用すると、翻訳アプローチのベンチマークと評価を行い、機能する手法をchampollionプラグインとしてエクスポートできます。両方の言語を話す人なら誰でも、独自のプラットフォームを必要とせずに、翻訳手法を開発、テスト、共有できます。

### 手法の選択

Champollionは10種類の翻訳手法をサポートしています。各言語ペアで異なる手法を使用できます。

**LLMプロバイダー** — 品質、Markdown認識、コーチングの互換性に最適:

| 手法 | キー | 機能 |
|--------|-----|-------------|
| `llm` (デフォルト) | `OPENROUTER_API_KEY` | OpenRouter経由のLLM — 200以上のモデル、自動ルーティング |
| `llm-coached` | `OPENROUTER_API_KEY` | LLM ＋ 文法規則、辞書、スタイルノート |
| `openai` | `OPENAI_API_KEY` | OpenAI APIへの直接アクセス (gpt-4o, gpt-4o-mini) |
| `anthropic` | `ANTHROPIC_API_KEY` | Anthropic APIへの直接アクセス (Claude Sonnet, Haiku, Opus) |
| `gemini` | `GEMINI_API_KEY` | Google Gemini APIへの直接アクセス (Flash, Pro) — 無料枠あり |

**従来の機械翻訳 (MT)** — 速度、コスト、大量のキーバリューペアに最適:

| 手法 | キー | 機能 |
|--------|-----|-------------|
| `google-translate` | `GOOGLE_TRANSLATE_API_KEY` | Google Cloud Translation API v2 (130以上の言語) |
| `deepl` | `DEEPL_API_KEY` | 用語集をサポートするDeepL API (30以上の言語) |
| `microsoft-translator` | `MICROSOFT_TRANSLATOR_API_KEY` | Azure Cognitive Services Translator (100以上の言語) |
| `libretranslate` | *(セルフホスト)* | セルフホストのLibreTranslate (AGPL、無料) |

**インフラストラクチャ** — カスタムまたはコミュニティがホストするエンドポイント用:

| 手法 | キー | 機能 |
|--------|-----|-------------|
| `api` | *(プロバイダーごと)* | 任意のRESTエンドポイント用の軽量HTTPクライアント |

```bash
# Force a specific method for one run
champollion sync --method deepl

# Or configure per pair
```

```json
{
  "pairs": {
    "en:fr": { "method": "deepl" },
    "en:ja": { "method": "openai", "model": "gpt-4o" },
    "en:crk": { "methodPlugin": "crk-coached-v1" }
  }
}
```

> **注**: 従来の機械翻訳手法（Google Translate、DeepL、Microsoft Translator、LibreTranslate）はキーバリューペアの処理には適していますが、Markdownコンテンツを安全に翻訳することはできません。コンテンツの多いプロジェクトには、LLM手法を推奨します。これらはコードブロック、ショートコード、補間変数を明示的に保護します。

## プラグイン

プラグインは、特定の言語ペア向けに事前にパッケージ化された翻訳レシピです。これらはコードではなくJSONマニフェストであり、どの手法をどのような設定で使用するか、またどのような品質がベンチマークされているかをchampollionに伝えます。

```bash
champollion plugin install ./french-formal-v1/    # install from directory
champollion plugin list                           # see installed plugins
champollion plugin remove french-formal-v1        # uninstall
champollion status                                # shows quality tiers + benchmarks
```

マニフェストのフォーマットについては、[website/docs/reference/plugin-spec.md](../website/docs/reference/plugin-spec.md) を参照してください。

## コマンド

| コマンド | 目的 |
|---------|---------|
| `init` | インタラクティブなセットアップウィザード (またはクイックデフォルト用の `--yes`) |
| `sync` | すべてのロケールファイルを翻訳および同期 |
| `watch` | ファイル変更時の自動同期 |
| `audit` | 不完全なロケールをフラグ付け (CIゲート) |
| `card` | 言語カードを整形して表示 (生データ用は `card <code>`、`--json`) |
| `register-corpus` | 評価コーパスの登録: ライセンスと公開ティア (ローカルのみ/プライベート/パブリック/シールド) を選択 |
| `submit` | インデックスエントリの提案 (レビューゲート付き) — 事前入力されたGitHub Issueを出力 |
| `lint` | ソースコード内のハードコードされた文字列を検索 |
| `status` | ペアの設定、手法、レジスター、品質ティアを表示 |
| `provenance` | 翻訳リソースのライセンスを監査 |
| `wrap` | ハードコードされた文字列を `t()` 呼び出しで自動ラップ (元に戻す機能付き) |
| `seo` | hreflang、sitemap.xml、またはJSON-LDスキーマを生成 |
| `integrity` | プレースホルダーの破損、エンコーディング、ICUの複数形の完全性をチェック |
| `plugin` | 手法プラグインのインストール、削除、または一覧表示 |
| `fonts` | PUA文字体系コンバーター用のWebフォントをダウンロード |
| `tm` | 翻訳メモリキャッシュの管理 (統計、クリア、ロケールごと) |
| `xliff` | 専門の翻訳者によるレビュー用にXLIFF 1.2をエクスポート/インポート |
| `models` | プロバイダーの利用可能なモデルを一覧表示 (`--method gemini`) |
| `verify` | 書き込まれたロケールファイルを再読み込みし、翻訳が存在し正しいことを確認 (CIゲート) |
| `leaderboard` | MTリーダーボードを表示 (`--pair`、`--sort`、`--install N`) |
| `doctor` | システムヘルスチェック: カード、設定、手法、コンバーター |

任意のコマンドの詳細なヘルプを表示するには、`champollion <command> --help` を実行します。

完全なリファレンス: [website/docs/reference/cli.md](../website/docs/reference/cli.md)

### Pre-commitゲート

`champollion lint` はコミットゲートとして構築されています。ユーザー向けのハードコードされた文字列を見つけた場合は `1` で終了し、クリーンな場合は `0` で終了します（`--warn-only` はブロックせずにレポートします）。プロジェクト内の追跡対象のhooksディレクトリに組み込みます。

```bash
mkdir -p .githooks
printf '#!/bin/sh\nnpx champollion lint\n' > .githooks/pre-commit
chmod +x .githooks/pre-commit
git config core.hooksPath .githooks   # once per clone
```

または、[lint-staged](https://github.com/lint-staged/lint-staged) からトリガーして、ソースファイルがステージングされたときにのみ実行されるようにします。

```json
{
  "lint-staged": {
    "src/**/*.{js,jsx,ts,tsx}": "champollion lint"
  }
}
```

`champollion sync` はpre-commitから除外してください。ネットワークAPI呼び出しを行うため、良くても処理が遅くなり、最悪の場合はオフライン時にコミットをブロックします。代わりにCIまたはpre-pushフックで実行し、ゲートとして `champollion audit` / `champollion verify` を使用してください。

## 設定

`champollion.config.json` を作成するか、`champollion init` を実行します。

```json
{
  "version": 3,
  "inputLocale": "en",
  "localesDir": "./locales",
  "model": "google/gemini-3.5-flash",
  "pairs": {
    "en:fr": { "qualityTier": "high" },
    "en:ja": { "method": "google-translate" }
  }
}
```

| オプション | デフォルト | 説明 |
|--------|---------|-------------|
| `inputLocale` | `"en"` | ソース言語コード |
| `localesDir` | `"./locales"` | ロケールファイルへのパス |
| `contentDir` | `null` | Hugoコンテンツディレクトリ (Markdown翻訳を有効化) |
| `format` | `"auto"` | ファイルフォーマット: `json`、`toml`、`yaml`、または `auto` |
| `model` | `"google/gemini-3.5-flash"` | デフォルトモデル (OpenRouterスラッグ)。直接プロバイダーは実行時に独自のデフォルトを解決します。利用可能なモデルを見つけるには `champollion models --method gemini` を実行します。 |
| `defaultMethod` | `"llm"` | デフォルトの翻訳手法 (`--method` フラグで上書き可能) |
| `batchSize` | `80` | 翻訳バッチあたりのキー数 |
| `pairs` | `{}` | ペアごとの手法、モデル、品質の上書き |

**言語ごとの上書き**: 各言語には [言語カード (Language Card)](../website/docs/reference/language-card-spec.md) があります。これは、レジスタープリセット、フォーマル度システム、タイポグラフィ規則、手法サポートフラグを含む50の厳選されたカードの1つです。カードは、大規模なパフォーマンスのために [2層アーキテクチャ](../website/docs/concepts/architecture.md) (ランタイム＋リファレンス) を使用します。`node scripts/generate-language-card.mjs <code>` を使用して新しいカードの雛形を作成します。プリセットキーを省略形として使用するか、カスタムのレジスターテキストを記述します。

```json
{
  "languages": {
    "fr": "casual-tu",
    "ko": "formal-hapsyo",
    "crk": {
      "name": "Plains Cree",
      "register": "SRO syllabics with grammatical precision.",
      "model": "google/gemini-2.5-pro",
      "batchSize": 5,
      "maxRetries": 5,
      "script": "cans"
    }
  }
}
```

**ゼロコンフィグモード**: 設定ファイルがありませんか？Champollionは、プロジェクトからロケールファイル、フォーマット、ターゲット言語を自動検出します。

言語の値には、プリセットキー（例: `"casual-tu"`）、カスタムのレジスターテキスト、またはオブジェクト（完全な制御）を指定できます。`pairs` でのペアレベルの上書きは、言語レベルの設定よりも優先されます。各言語で利用可能なプリセットを閲覧するには、`npx champollion init` を実行します。

フレームワーク固有のセットアップの詳細については、[CLIリファレンス](../website/docs/reference/cli.md) を参照してください。

## CLI出力

`sync` を実行すると、champollionは現在何が起きているかを正確に表示します。

```
champollion v0.1.0

[INFO] Detected format: json (auto)
[INFO] Detected framework: Hugo
[INFO] Source: en.json (2,847 keys)
[INFO] Pairs: es-MX:llm, fr:deepl, it:llm
[INFO] Estimated translation cost:

  Pair       Method   Keys  Est. Cost
  ────────   ──────   ────  ─────────
  en:es-MX   llm      2847    ~$0.8400
  en:fr      deepl    2847    ~$0.5694
  en:it      llm      2847    ~$0.8400

  Total: ~$2.2494

[INFO] es-MX.json — 2,847 missing
     ████████████████████████████████ 2,847/2,847 keys
[INFO] fr.json — 2,847 missing
     ████████████████████████████████ 2,847/2,847 keys
[OK] Synced 5,694 keys total.
```

プログレスバーは、各バッチが完了するたびにインプレースで更新されます（1回の更新につき約80キー）。フレームワーク検出は、`contentDir` が設定されている場合に `Hugo` を表示します。フォーマット検出は、フォーマットがどのように解決されたかを明確にするために、`(auto)` と `(config)` を区別します。

**出力モード**: `--quiet` は情報出力を抑制します（エラーと警告のみ）。`--json` は、CI/CDパイプライン向けに機械可読なNDJSONを出力します。

## 堅牢化

- **エクスポネンシャルバックオフ** — 429/5xxエラー時にジッター付きで3回再試行
- **30秒のリクエストタイムアウト** — AbortControllerによりハングアップを防止
- **レスポンス検証** — 翻訳用に送信されたキーのみを受け入れ
- **品質ゲート** — ハルシネーションのループ、文字体系の誤り、文字数の異常な増加、ソースのオウム返しを検出
- **再試行カスケード** — JSONのパース失敗時、バッチ → ハーフバッチ → 個別のキーの順に再試行（`maxRetries` による予算上限あり）
- **翻訳メモリ** — `.champollion/tm.json` は、ソーステキスト＋ロケール＋手法をキーとして翻訳をキャッシュ。変更されていないキーは後続の同期時にキャッシュから提供され、冗長なAPI呼び出しを排除
- **プロンプトキャッシュ** — システム/ユーザーメッセージの分割によりプロバイダーレベルのキャッシュが可能になり、バッチ間のトークンコストを削減
- **用語の強制** — コーチングされた翻訳は、LLMの応答後に辞書の用語と照合して検証
- **プロトタイプ汚染ガード** — `__proto__`、`constructor`、`prototype` をブロック
- **パスの封じ込め** — ファイルの書き込みが設定されたディレクトリ内に留まるよう検証
- **ブロック保護** — コンテンツ翻訳中、コードブロック、ショートコード、HTMLを保護
- **フェイルラウドアーキテクチャ** — 翻訳の失敗時は常に実用的なエラーメッセージをスローし、ゴミデータを暗黙のうちに書き込むことは決してない
- **同期後の検証** — `verify` コマンドは、書き込まれたファイルを再読み込みし、翻訳が存在すること、正しい文字体系であること、プレースホルダーがそのまま保たれていることを確認
- **部分的な成功** — 1つのバッチが失敗しても、残りのバッチはブロックされない

## テスト

```bash
npm test      # all tests
npm run test:unit                # core sync pipeline
npm run test:redteam             # adversarial edge cases
npm run test:format              # TOML/YAML adapters
npm run test:content             # Markdown content parser
npm run test:hugo                # full Hugo E2E
npm run test:lint                # hardcoded string detection
npm run test:pairs               # pair graph resolution
npm run test:methods             # translation method suite
```

**最小限の依存関係** — 上記を参照してください。

## ライセンス

Apache-2.0。Champollion CLIはオープンソースであり、[Apache License, Version 2.0](../LICENSE) の条件の下で、無料でインストール、使用、変更、再配布が可能です。公開されている `champollion` npmパッケージはApache-2.0です。配布されるパッケージの正式なライセンスは `cli/LICENSE` です。付属のMT Eval Harnessと仕様もオープンソースであり、公開されている [harnessリポジトリ](https://github.com/gamedaysuits/Champollion) にて、AGPL-3.0-or-later（§7 eval-standard-plugin 例外付き）でライセンスされています。
