# Champollion

[![npm バージョン](https://img.shields.io/npm/v/champollion.svg)](https://www.npmjs.com/package/champollion)
[![ライセンス: PolyForm Noncommercial 1.0.0](https://img.shields.io/badge/license-PolyForm--Noncommercial--1.0.0-blue.svg)](#license)


**レールに乗り、ガードレールを備えて。** リソースの少ない言語や先住民言語のコミュニティを念頭に置いて構築された、レールに乗った機械翻訳の開発とデプロイメントです。このCLIは、プロジェクトおよびデプロイメント層となります。

**言語モデルの構築**を、ご自身のコンピュータ上で実行します:

```bash
npx champollion new our-language --from English --to "Plains Cree"
cd our-language && npx champollion next
```

標準コードを持たない言語には、私用コードと独自の言語名を使用します:
`npx champollion new our-language --from English --to qaa --target-name "Our language"`
（`qaa` から `qtz` までの任意のコード）。

`champollion new` は、すべての要素を配置する場所を備えたプロジェクトを開始します。`champollion next` は、コミュニティが保持するファイル（スプレッドシート、Wordの表、ToolboxやLIFTの辞書、ELANの書き起こしなど）から、測定されたモデルを経てアプリに組み込むまでの、次のステップを提示します。各ステップでは誰が決定権を持つかが示されます。言語を保持する人々が、その文章がどこへ行き、何を出荷するかを決定します。AIエージェントは、[MCP server](https://www.npmjs.com/package/champollion-mcp-server) を通じて同じステップをたどることができます。このレールが約束するのは品質ではなくプロセスです。モデルが優れていることではなく、モデルがどの程度優れているかを知ることができます。最初の小規模なコミュニティモデルは、通常、測定されたフレーズブックとなります。[champollion.dev/start](https://champollion.dev/start) から始めてください。

**アプリのロケールファイルの翻訳**を1つのコマンドで実行します:

```bash
npx champollion sync
```

Champollionは、ロケールファイル、そのフォーマット、およびターゲット言語を自動検出します。不足しているキーを翻訳し、すでに完了しているものはスキップして、結果を書き出します。これはホストされたエンジン、または自身で構築して提供するモデル（`champollion connect`）から実行されます。

**ライセンス:** [PolyForm Noncommercial License 1.0.0](../LICENSE) の下でソースが公開されています。非営利目的（個人プロジェクト、研究、教育、および慈善団体、学校、公的機関による使用）であれば、無料で使用、変更、共有できます。営利目的での使用は、このライセンスの対象外です。評価ハーネスはオープンソース（AGPL-3.0-or-later）です。[Who may use this](https://champollion.dev/docs/getting-started/who-may-use-this) · [Details](#license)。

## なぜ自分でスクリプトを書かないのか？

英語のキーをループしてGoogle Translateを呼び出す簡単なスクリプトを書くことは可能です。多くの開発者がそうしており、約30行で済みます。しかし、それが破綻する理由は以下の通りです:

- **変更検出がない。** 英語の文字列を更新しても、翻訳は永遠に古いままです。Champollionはすべてのソース値をSHA-256ハッシュで追跡し、変更されたものだけを再翻訳します。
- **バッチ処理がない。** 1キーにつき1回のAPI呼び出しでは、200キー＝200回のラウンドトリップになります。Champollionはインテリジェントにバッチ処理を行います（設定可能、デフォルトはLLMで80キー/バッチ、Googleで128キー/バッチ）。
- **品質ゲートがない。** 機械翻訳はハルシネーションを起こしたり、ソースをそのまま返したり、間違った文字体系で出力したりします。Champollionは書き込む前にすべての翻訳をチェックします。空の出力、ソースのオウム返し、反復ループ、長さの膨張、コンテンツの削除、間違った文字体系は捕捉され、拒否されます。このゲートは、意味の間違いではなく、壊れた出力を捕捉します。
- **フォーマットを認識しない。** JSONにハードコードされていませんか？Champollionは、JSON、TOML、YAML、およびHugo Markdown（フロントマター＋本文）を自動検出で処理します。
- **安全性がない。** Champollionは、プロトタイプ汚染、細工されたロケールコードによるパストラバーサル、Markdown翻訳中のコードブロックの破損から保護します。

Champollionは、そのスクリプトのプロダクション版です。

> [!NOTE]
> **Champollionが翻訳するもの。** Champollionは、**ロケールファイルと構造化コンテンツ**（JSONのキーと値のペア、TOML/YAML設定、Hugo Markdownページ、XLIFF交換ドキュメント）を対象としています。UI文字列、ドキュメント、公式なコミュニケーション、教育資料など、フォーマルな書き言葉に最適化されています。チャットボット、リアルタイム音声翻訳機、汎用的な対話型AIではありません。言語ペアごとに翻訳メソッドを設定可能で、商用API（Google Translate、DeepL）から、コミュニティ開発のプラグイン、公開ベンチマーク、レール上でトレーニングして提供するモデルまで対応しています。

## クイックスタート

```bash
npm install --save-dev champollion
```

### APIキーの取得

Champollionには翻訳バックエンドが必要です。以下から1つ選択してください:

| プロバイダー | キー | 最適な用途 |
|----------|-----|----------|
| **OpenRouter** (推奨) | `OPENROUTER_API_KEY` | コンテンツの多いプロジェクト、Markdown、200以上のモデル |
| **OpenAI** | `OPENAI_API_KEY` | GPT-4oへの直接アクセス |
| **Anthropic** | `ANTHROPIC_API_KEY` | Claudeへの直接アクセス |
| **Gemini** | `GEMINI_API_KEY` | 無料枠あり |
| **DeepL** | `DEEPL_API_KEY` | ヨーロッパ言語、用語集のサポート |
| **Google Translate** | `GOOGLE_TRANSLATE_API_KEY` | 130以上の言語、大量処理 |

**最速のスタート** (無料): [aistudio.google.com](https://aistudio.google.com/apikey) でサインアップして、無料のGeminiキーを取得します:

```bash
export GEMINI_API_KEY=AI...
npx champollion sync --method gemini
```

**OpenRouter** (200以上のモデル): [openrouter.ai](https://openrouter.ai) でサインアップし、以下を実行します:

```bash
export OPENROUTER_API_KEY=sk-or-v1-...
npx champollion sync
```

**Google Translate** の代替 (キーと値のペアのみ — Markdownは認識しません):

```bash
export GOOGLE_TRANSLATE_API_KEY=...
npx champollion sync --method google-translate
```

> **Note**: `GOOGLE_TRANSLATE_API_KEY` のみが設定されている場合、champollionは自動的にGoogle Translateに切り替わります。設定の変更は必要ありません。REST APIを直接使用するため、SDK、サービスアカウント、`pip install` は不要です。キーのみを使用します。

以上です。さらに詳細な制御を行うには、設定ファイルを作成します:

```bash
npx champollion init                        # guided wizard — walks you through registers, methods, and content
npx champollion init --yes --langs fr,de,ja  # quick setup with specific languages and default registers
```

各言語には**レジスタープリセット**が用意されています。これは、その言語体系に合わせて調整された、トーンやフォーマル度の事前構築済み指示です（フランス語のvouvoiement、ドイツ語のSiezen、日本語の「です/ます」、韓国語の해요체など）。初期化ウィザードでプリセットを閲覧して選択するか、`--yes` を渡してデフォルトを受け入れることができます。

### 英語以外のソース

ソース言語が英語でない場合:

```bash
champollion sync --source fr                      # CLI flag
```

または、設定ファイルで永続的に設定します:

```json
{ "inputLocale": "fr" }
```

## 機能

i18nフレームワーク（next-intl、i18next、Hugo）の処理はユーザーが行います。Champollionは翻訳ファイルを処理します。

- **マルチフォーマット** — JSON、TOML、YAML、Hugo Markdown（フロントマター＋本文）、およびXLIFF 1.2
- **インクリメンタル** — 変更されたものだけを翻訳（SHA-256ハッシュ追跡）
- **キャッシュ** — 翻訳メモリが以前の結果を保存。変更されていないキーに対する同期の再実行はコストゼロ
- **品質ゲート** — すべての翻訳で壊れた出力をチェック: 反復ループ、間違った文字体系の出力、ソースのオウム返し、長さの膨張、コンテンツの削除（意味のチェックは行いません）
- **コンテンツ認識** — LLMメソッドは、Markdown翻訳中にコードブロック、ショートコード、リンク、および補間変数を保護
- **パイプラインツール** — CIゲート用の `lint`、`audit`、`integrity`、`seo`
- **XLIFF相互運用** — CATツール（memoQ、SDL Trados、Phrase）での専門家によるレビュー用に翻訳をエクスポートし、再度インポート
- **最小限の依存関係** — 実行時の依存関係は2つのみ: `@translated/lara`（LaraプロバイダーSDK）および `cree-sro-syllabics`（ALTLab/NRCのPlains Cree SRO ⇄ 音節文字コンバーター）。Node 20以上が必要

## Google Translateの先へ

クイックスタートでは、LLMまたはGoogle Translateを使用して実行を開始できます。しかし、Google Translateがサポートしているのは約130言語です。世界には7,000以上の言語が存在します。

**Champollionのコアアイデア: 翻訳メソッドは言語ペアごとに設定可能であること。** フランス語にはGoogle Translateを使用し、Plains Creeには独自の文法ノートと辞書でコーチングしたLLMを使用し、どのサービスもカバーしていない言語には自身でホストするAPIを使用する。これらすべてを同じプロジェクト内で、同じCLIを使用して実行できます。

```json
{
  "version": 3,
  "pairs": {
    "en:fr": { "method": "google-translate" },
    "en:ja": { "method": "llm" },
    "en:crk": { "method": "llm-coached" }
  }
}
```

プロンプトエンジニアリング、コミュニティ辞書、FSTパイプライン、またはファインチューニングされたモデルなどを通じて、ある言語ペアの翻訳方法を見つけ出すことができれば、champollionを使用してそのメソッドをプラグインとしてパッケージ化し、他のすべてのものと一緒にデプロイすることができます。

> 既存のAPIが存在しないPlains Creeへ本番ウェブサイトを翻訳する過程から生まれました。ペアごとのアーキテクチャは理論上のものではありません。あるプロジェクトで、フランス語用のGoogle Translateと、先住民言語用のコーチングされたFSTパイプラインを、同じ同期コマンド内で並行して実行する必要があったために存在しています。

付属の [MT Eval Harness](https://github.com/gamedaysuits/Champollion) を使用すると、翻訳アプローチのベンチマークと評価を行い、機能するメソッドをchampollionプラグインとしてエクスポートできます。両方の言語を話す人なら誰でも、翻訳メソッドを開発、テスト、共有できます。独自のプラットフォームは必要ありません。

### メソッドの選択

Champollionは10種類の翻訳メソッドをサポートしています。言語ペアごとに異なるメソッドを使用できます。

**LLMプロバイダー** — 品質に優れ、Markdownを認識し、コーチングに対応:

| メソッド | キー | 機能 |
|--------|-----|-------------|
| `llm` (デフォルト) | `OPENROUTER_API_KEY` | OpenRouter経由のLLM — 200以上のモデル、自動ルーティング |
| `llm-coached` | `OPENROUTER_API_KEY` | LLM ＋ 文法規則、辞書、スタイルノート |
| `openai` | `OPENAI_API_KEY` | 直接のOpenAI API (gpt-4o, gpt-4o-mini) |
| `anthropic` | `ANTHROPIC_API_KEY` | 直接のAnthropic API (Claude Sonnet, Haiku, Opus) |
| `gemini` | `GEMINI_API_KEY` | 直接のGoogle Gemini API (Flash, Pro) — 無料枠あり |
| `local` | *(なし)* | OpenAI互換エンドポイントの背後にある独自のモデル（Ollama、vLLM、LM Studio、`nmt-forge` でトレーニングされたモデル）。Ollamaのデフォルトでない場合は `LOCAL_API_BASE` を設定します。テキストがインフラストラクチャの外部に出ることはありません |

**従来の機械翻訳 (MT)** — 速度、コスト、大量のキーと値のペアに最適:

| メソッド | キー | 機能 |
|--------|-----|-------------|
| `google-translate` | `GOOGLE_TRANSLATE_API_KEY` | Google Cloud Translation API v2 (130以上の言語) |
| `deepl` | `DEEPL_API_KEY` | 用語集をサポートするDeepL API (30以上の言語) |
| `microsoft-translator` | `MICROSOFT_TRANSLATOR_API_KEY` | Azure Cognitive Services Translator (100以上の言語) |
| `libretranslate` | *(セルフホスト)* | セルフホストのLibreTranslate (AGPL、無料) |

**インフラストラクチャ** — カスタムまたはコミュニティがホストするエンドポイント用:

| メソッド | キー | 機能 |
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
    "en:crk": { "method": "llm-coached" }
  }
}
```

> **Note**: 従来の機械翻訳メソッド（Google Translate、DeepL、Microsoft Translator、LibreTranslate）はキーと値のペアをうまく処理しますが、Markdownコンテンツを安全に翻訳することはできません。コンテンツの多いプロジェクトには、LLMメソッドを推奨します。これらはコードブロック、ショートコード、および補間変数を明示的に保護します。

## プラグイン

プラグインは、特定の言語ペア向けに事前にパッケージ化された翻訳レシピです。これらはコードではなくJSONマニフェストであり、どのメソッドをどのような設定で使用するか、またどのような品質がベンチマークされているかをchampollionに伝えます。

```bash
champollion plugin install ./french-formal-v1/    # install from directory
champollion plugin list                           # see installed plugins
champollion plugin remove french-formal-v1        # uninstall
champollion status                                # shows each pair's method, model + plugin benchmarks
```

マニフェストのフォーマットについては、[the reference docs](https://champollion.dev/docs/reference/plugin-spec) を参照してください。

## コマンド

| コマンド | 目的 |
|---------|---------|
| `init` | 対話型のセットアップウィザード（またはクイックデフォルト用の `--yes`） |
| `sync` | すべてのロケールファイルの翻訳と同期 |
| `serve` | このプロジェクトの翻訳スタックをHTTP経由で提供（api-methodコントラクト） |
| `watch` | ファイル変更時の自動同期 |
| `audit` | 不完全なロケールをフラグ付け（CIゲート） |
| `lint` | ソースコード内のハードコードされた文字列を検索 |
| `status` | ペア設定、メソッド、レジスター、およびプラグインのベンチマークを表示 |
| `provenance` | 翻訳リソースのライセンスを監査 |
| `wrap` | ハードコードされた文字列を `t()` 呼び出しで自動ラップ（元に戻す機能付き） |
| `seo` | hreflang、sitemap.xml、またはJSON-LDスキーマを生成 |
| `integrity` | プレースホルダーの破損、エンコーディング、およびICU複数形の完全性をチェック |
| `plugin` | メソッドプラグインのインストール、削除、または一覧表示 |
| `fonts` | PUA文字体系コンバーター用のWebフォントをダウンロード |
| `tm` | 翻訳メモリキャッシュの管理（統計、クリア、シード、プルーニング） |
| `xliff` | 専門の翻訳者によるレビュー用にXLIFF 1.2をエクスポート/インポート |
| `models` | プロバイダーの利用可能なモデルを一覧表示（`--method gemini`） |
| `verify` | 書き込まれたロケールファイルを再読み込みし、翻訳が存在し正しいことを確認（CIゲート） |
| `doctor` | システムのヘルスチェック: カード、設定、メソッド、およびコンバーター |

プロジェクトではなく、共有インデックスやリーダーボードと連携するコマンドは、`champollion network` の下にグループ化されています（それぞれプレフィックスなしでも機能します）:

| コマンド | 目的 |
|---------|---------|
| `network card` | 言語カードを整形して表示（生データの場合は `network card <code>`、`--json`） |
| `network recommend` | ペアのメソッドガイダンス — 可用性 ＋ 引用されたエビデンス（`network recommend eng fra`、`--use`、`--json`） |
| `network leaderboard` | MTリーダーボードを表示（`--pair`、`--sort`、`--install N`） |
| `network register-corpus` | 評価コーパスの登録: ライセンス ＋ 公開階層（ローカルのみ/プライベート/パブリック/シールド）を選択 |
| `network seal-corpus` | シールド階層の暗号化動詞: `keygen` / `seal` / `open`（オーガナイザーとノードのブリッジ） |
| `network submit` | インデックスエントリを提案（レビューゲート付き） — 事前入力されたGitHub Issueを出力 |

任意のコマンドの詳細なヘルプを表示するには、`champollion <command> --help` を実行します。

完全なリファレンス: [the reference docs](https://champollion.dev/docs/reference/cli)

### Pre-commitゲート

`champollion lint` はコミットゲートとして構築されています。ハードコードされたユーザー向け文字列を見つけた場合は `1` で終了し、クリーンな場合は `0` で終了します（`--warn-only` はブロックせずにレポートします）。プロジェクト内の追跡対象のフックディレクトリに組み込みます:

```bash
mkdir -p .githooks
printf '#!/bin/sh\nnpx --yes champollion@0.6 lint\n' > .githooks/pre-commit   # pinned: a new release never changes what the hook runs
chmod +x .githooks/pre-commit
git config core.hooksPath .githooks   # once per clone
```

または、[lint-staged](https://github.com/lint-staged/lint-staged) からトリガーして、ソースファイルがステージングされたときのみ実行されるようにします:

```json
{
  "lint-staged": {
    "src/**/*.{js,jsx,ts,tsx}": "champollion lint"
  }
}
```

`champollion sync` はpre-commitから除外してください。ネットワークAPI呼び出しを行うため、良くても遅く、最悪の場合はオフライン時にコミットをブロックします。代わりにCIまたはpre-pushフックで実行し、ゲートとして `champollion audit` / `champollion verify` を使用してください。

## 設定

`champollion.config.json` を作成するか、`champollion init` を実行します:

```json
{
  "version": 3,
  "inputLocale": "en",
  "localesDir": "./locales",
  "model": "google/gemini-3.8-flash",
  "pairs": {
    "en:fr": { "qualityTier": "high" },
    "en:ja": { "method": "google-translate" }
  }
}
```

| オプション | デフォルト | 説明 |
|--------|---------|-------------|
| `inputLocale` | `"en"` | ソース言語コード |
| `localesDir` | `"./locales"` | ロケールファイルへのパス: 言語ごとに1ファイル（`fr.json`）または言語ごとに1フォルダー（`fr/common.json`、i18next） |
| `localesPattern` | `null` | その他のレイアウト、例: `"src/i18n/{ns}/{lang}.json"`（`localesDir` を置き換えます） |
| `contentDir` | `null` | 翻訳するMarkdown/MDXのフォルダー（Hugoの `content/` または任意のフォルダー）。各翻訳はソースの横に `<name>.<locale>.md` として書き込まれます |
| `format` | `"auto"` | ファイルフォーマット: `json`、`toml`、`yaml`、または `auto` |
| `model` | `"google/gemini-3.8-flash"` | デフォルトモデル（OpenRouterのスラッグ）。直接のプロバイダーは実行時に独自のデフォルトを解決します。利用可能なモデルを見つけるには `champollion models --method gemini` を実行します。 |
| `defaultMethod` | `"llm"` | デフォルトの翻訳メソッド（`--method` フラグで上書き可能） |
| `batchSize` | `80` | 翻訳バッチあたりのキー数 |
| `pairs` | `{}` | ペアごとのメソッド、モデル、および品質の上書き |

**言語ごとの上書き**: 各言語には [Language Card](https://champollion.dev/docs/reference/language-card-spec) があります。これは、レジスタープリセット、フォーマル度システム、タイポグラフィ規則、およびメソッドサポートフラグを含む50の厳選されたカードの1つです。カードは、大規模なパフォーマンスのために [2層アーキテクチャ](https://champollion.dev/docs/agents/rails-model)（ランタイム＋リファレンス）を使用します。`node scripts/generate-language-card.mjs <code>` を使用して新しいカードの雛形を作成します。プリセットキーを省略形として使用するか、カスタムのレジスターテキストを記述します:

```json
{
  "languages": {
    "fr": "casual-tu",
    "ko": "formal-hapsyo",
    "crk": {
      "name": "Plains Cree",
      "register": "SRO syllabics with grammatical precision.",
      "model": "google/gemini-3.1-pro-preview",
      "batchSize": 5,
      "maxRetries": 5,
      "script": "Cans"
    }
  }
}
```

**ゼロコンフィグモード**: 設定ファイルがありませんか？Champollionは、プロジェクトからロケールファイル、フォーマット、およびターゲット言語を自動検出します。

言語の値には、プリセットキー（例: `"casual-tu"`）、カスタムのレジスターテキスト、またはオブジェクト（完全な制御）を指定できます。`pairs` でのペアレベルの上書きは、言語レベルの設定よりも優先されます。各言語で利用可能なプリセットを閲覧するには、`npx champollion init` を実行します。

フレームワーク固有のセットアップの詳細については、[CLI Reference](https://champollion.dev/docs/reference/cli) を参照してください。

## CLI出力

`sync` を実行すると、champollionは正確に何が起こっているかを表示します:

```
champollion v0.4.0

[INFO] Detected format: json (auto)
[INFO] Detected framework: Hugo
[INFO] Source: en.json (2847 keys)
[INFO] Pairs: es-MX:llm, fr:deepl, it:llm
Estimated translation cost:

  Pair      Method    Keys  TM hits   Est. Cost
  ────────  ──────  ──────  ───────  ──────────
  en:es-MX  llm       2847        0    ~$0.3843
  en:fr     deepl     2847        0    ~$1.7794
  en:it     llm       2847        0    ~$0.3843

  Total: ~$2.5480
  Rates: google/gemini-3.8-flash $0.30 input / $2.50 output per 1M tokens — OpenRouter's price list, read 2026-10-04 14:02 UTC; deepl $25.00 per 1M characters — the provider's published price, as checked 2026-06-08. An estimate: ~200 input + ~30 output tokens or ~25 characters per key assumed — the bill depends on the real lengths (--json has the detail).

[INFO] Translating 3 locale(s) with concurrency 50
[INFO] es-MX.json — 2847 missing
     ████████████████████████████████ 2,847/2,847 keys
[INFO] fr.json — 2847 missing
     ████████████████████████████████ 2,847/2,847 keys
[INFO] it.json — 2847 missing
     ████████████████████████████████ 2,847/2,847 keys
[OK] Synced 8541 keys total — 8541 key(s) sent to the model, 0 served from the cache (free).
```

見積もりの最後の行には、各数値の価格設定レート、その出所、および時期が記載されます（詳細は `--json` に記載されています）。「Translating …」は、何かが送信される場合にのみ表示されます。ドライラン、または送信するものがない実行の場合は、代わりにロケールをチェックしていると表示されます。プログレスバーは、各バッチが完了するたびにインプレースで更新されます（1回の更新につき約80キー）。`contentDir` が設定されている場合、syncはフォルダーと翻訳の出力先を明記します。実際のHugoサイト（`hugo.toml`、Hugo設定を含む `config.toml`、`archetypes/` など）を見つけた場合にのみ `Detected framework: Hugo` と表示します。フォーマット検出は、フォーマットがどのように解決されたかを明確にするために、`(auto)` と `(config)` を区別します。

**出力モード**: `--quiet` は情報出力を抑制します（エラーと警告のみ）。`--json` はCI/CDパイプライン向けに機械可読なNDJSONを出力します。

## 堅牢化

- **エクスポネンシャルバックオフ** — 429/5xxエラー時にジッター付きで3回再試行
- **30秒のリクエストタイムアウト** — AbortControllerがハングアップを防止
- **レスポンスの検証** — 翻訳用に送信されたキーのみを受け入れ
- **品質ゲート** — ハルシネーションループ、間違った文字体系の出力、長さの膨張、ソースのオウム返しを捕捉
- **再試行カスケード** — JSONのパース失敗時、バッチ → 半分のバッチ → 個別のキーの順に再試行（`maxRetries` で予算上限を設定）
- **翻訳メモリ** — `.champollion/tm.json` は、ソーステキスト＋ロケール＋メソッドをキーとして翻訳をキャッシュ。変更されていないキーは後続の同期時にキャッシュから提供され、冗長なAPI呼び出しを排除
- **プロンプトキャッシング** — システム/ユーザーメッセージの分割によりプロバイダーレベルのキャッシングが可能になり、バッチ間のトークンコストを削減
- **用語の強制** — コーチングされた翻訳は、LLMの応答後に辞書の用語と照合して検証
- **プロトタイプ汚染ガード** — `__proto__`、`constructor`、`prototype` をブロック
- **パスの封じ込め** — ファイルの書き込みが設定されたディレクトリ内に留まるよう検証
- **ブロック保護** — コンテンツ翻訳中、コードブロック、ショートコード、HTMLを保護
- **フェイルラウドアーキテクチャ** — 翻訳の失敗は常に実行可能なエラーメッセージとともにスローされ、ゴミデータを暗黙のうちに書き込むことはない
- **同期後の検証** — `verify` コマンドは書き込まれたファイルを再読み込みし、翻訳が存在し、正しい文字体系であり、プレースホルダーがそのまま維持されていることを確認
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

PolyForm Noncommercial 1.0.0。Champollion CLIはソースが公開されており、[PolyForm Noncommercial License 1.0.0](../LICENSE) の下で、非営利目的（研究、教育、コミュニティ活動）であれば無料でインストール、使用、変更できます。営利目的での使用は、このライセンスの対象外です。わかりやすい例を挙げると、学校、公立病院やクリニック、慈善団体、個人または研究プロジェクトは対象となりますが、店舗のフロントエンドなど、営利企業の製品は対象外です: [Who may use this](https://champollion.dev/docs/getting-started/who-may-use-this)（これは要約であり、法的助言ではありません。ライセンスの原文が優先されます）。公開されている `champollion` npmパッケージはPolyForm-Noncommercial-1.0.0です。配布されるパッケージの正式なライセンスは `cli/LICENSE` です。付属のMT Eval Harnessおよび仕様はオープンソースであり、公開されている [harness repository](https://github.com/gamedaysuits/Champollion) にて、AGPL-3.0-or-later（§7 eval-standard-pluginの例外付き）でライセンスされています。
