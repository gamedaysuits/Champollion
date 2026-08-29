---
sidebar_position: 3
title: "設定"
related:
  - label: "Translation Methods"
    to: /docs/guides/translation-methods
    kind: guide
    note: "What the method fields actually select"
  - label: "Cookbook: Translate 30 Languages"
    to: /docs/tutorials/translate-30-languages
    kind: cookbook
    note: "Per-pair methods and registers at scale"
  - label: "Register"
    to: /glossary#term-register
    kind: glossary
    note: "The linguistic term behind the register field"
  - label: "Supported Languages"
    to: /docs/reference/supported-languages
    kind: reference
  - label: "CLI Reference"
    to: /docs/reference/cli
    kind: reference
---

# 設定

Champollion はゼロ設定で動作します — プロジェクトからロケールファイル、フォーマット、翻訳先言語を自動検出します。より細かく制御したい場合は、プロジェクトルートに `champollion.config.json` を作成するか、次のコマンドを実行してください：

```bash
npx champollion init
```

## 設定リファレンス（全項目）

```json title="champollion.config.json"
{
  "version": 3,
  "inputLocale": "en",
  "localesDir": "./locales",
  "contentDir": null,
  "translatableFields": null,
  "format": "auto",
  "model": "google/gemini-3.5-flash",
  "temperature": 0.3,
  "defaultMethod": "llm",
  "batchSize": 80,
  "coachingFile": null,
  "promptContext": null,
  "jsonConcurrency": 200,
  "contentConcurrency": 48,
  "fallbackPrefix": "[EN] ",
  "apiKeyEnvVar": "OPENROUTER_API_KEY",
  "noTranslate": [],
  "noTranslateUrls": true,
  "baseUrl": "",
  "pairs": {},
  "languages": {},
  "lint": {
    "srcDir": null,
    "ignore": ["node_modules", ".next", "dist"],
    "minLength": 2
  },
  "seo": {
    "urlPattern": "/:locale/:path",
    "pages": null
  },
  "typegen": {
    "output": null,
    "autoGenerate": false
  }
}
```

:::note[typegen は未実装です]
`typegen` 設定ブロックは設定ローダーによって認識・保持されますが、TypeScript の型生成はまだ実装されていません。これは予定されている機能のプレースホルダーです。これらの値を設定しても効果はありません。
:::


### フィールド

| フィールド | 型 | デフォルト | 説明 |
|-------|------|---------|-------------|
| `version` | `number` | `3` | 設定スキーマのバージョン。常に `3` です。 |
| `inputLocale` | `string` | `"en"` | ソース言語コード (BCP 47)。 |
| `localesDir` | `string` | `"./locales"` | ロケールファイルへのパス。Champollion はこのディレクトリをスキャンします。 |
| `contentDir` | `string` | `null` | Hugo のコンテンツディレクトリ。Markdown 本文の翻訳を有効にします。 |
| `translatableFields` | `string[]` | `null` | コンテンツ翻訳において、翻訳対象となるデフォルトのフロントマターフィールドを上書きします。`null` の場合は組み込みのデフォルト (`title`, `description`, `summary`) を使用します。 |
| `format` | `string` | `"auto"` | ファイル形式: `json`、`toml`、`yaml`、または `auto` (拡張子から検出)。 |
| `model` | `string` | `"google/gemini-3.5-flash"` | LLM メソッドのデフォルトモデル。OpenRouter の完全なスラッグ (`provider/model`) または `shared/model-aliases.json` の短いエイリアス (例: `gemini-flash`) を受け付けます。直接のプロバイダーはそのままの名前 (例: `gpt-4o`) を使用します。 |
| `temperature` | `number` | `0.3` | LLM の temperature (0.0–2.0)。低いほど決定論的になります。 |
| `defaultMethod` | `string` | `"llm"` | デフォルトの翻訳メソッド: `llm`、`llm-coached`、`google-translate`、`deepl`、`microsoft-translator`、`libretranslate`、`openai`、`anthropic`、`gemini`、`api`。CLI フラグ `--method` で上書き可能です。 |
| `batchSize` | `number` | `80` | 1回の翻訳バッチあたりのキー数。高いほど API 呼び出し回数は減りますが、プロンプトは大きくなります。 |
| `coachingFile` | `string` | `null` | フリーテキストのコーチングプロンプトファイルへのパス (プロジェクトルートからの相対パス)。内容は起動時に読み込まれ、システムプロンプトに `Coaching guidance:` ブロックとして注入されます。 |
| `promptContext` | `string` | `null` | システムプロンプトに注入されるアプリケーションコンテキスト文字列 (例: "E-commerce product descriptions")。モデルがドメインに合わせて翻訳を調整するのに役立ちます。 |
| `jsonConcurrency` | `number` | `200` | JSON キー同期におけるロケール翻訳の最大並列数。CLI フラグ `--json-concurrency` で上書き可能です。 |
| `contentConcurrency` | `number` | `48` | コンテンツ (Markdown/MDX) 翻訳における API 呼び出しの最大並列数。CLI フラグ `--content-concurrency` で上書き可能です。 |
| `fallbackPrefix` | `string` | `"[EN] "` | 以前の実行から残る未翻訳のレガシー値を検出するために `audit` および `verify` が使用するマーカープレフィックス。Champollion はこのプレフィックスを書き込まず、検出のために読み取るのみです。 |
| `apiKeyEnvVar` | `string` | `"OPENROUTER_API_KEY"` | API キーの環境変数名。カスタム環境変数名を使用する場合に上書きします。 |
| `minContentRetention` | `number` | `0.35` | [コンテンツ削除チェック](/docs/concepts/quality-gate) が2つ目のシグナルを参照する前に、出力が保持していなければならないソースの文字/数字の割合。ペアごとおよび言語ごとにも設定可能です。 |
| `noTranslate` | `string[]` | `[]` | 値がすべてのロケールにそのままコピーされるドットパスキーおよびグロブパターン。[翻訳不要キー](#no-translate) を参照してください。`skipKeys` としても受け付けます。 |
| `noTranslateUrls` | `boolean` | `true` | `scheme://` URL のみで構成されるソース値を翻訳不要として扱います。URL を値に持つキーを翻訳バックエンドに送信するには `false` を設定します。 |
| `baseUrl` | `string` | `""` | SEO アーティファクト (hreflang、サイトマップ、JSON-LD) 生成用のベース URL。 |
| `pairs` | `object` | `{}` | ペアごとのメソッド、モデル、品質の上書き。[ペア設定](#pair-configuration) を参照してください。 |
| `languages` | `object` | `{}` | 言語ごとの上書き。[言語設定](#language-configuration) を参照してください。 |
| `lint.srcDir` | `string` | `null` | lint スキャン用のソースディレクトリ。`null` = フレームワークから自動検出します。 |
| `lint.ignore` | `string[]` | `["node_modules", ...]` | lint から除外するグロブパターン。 |
| `lint.minLength` | `number` | `2` | ハードコードとしてフラグを立てる最小文字列長。 |
| `seo.urlPattern` | `string` | `"/:locale/:path"` | hreflang タグ生成用の URL パターンテンプレート。 |
| `seo.pages` | `string[]` | `null` | SEO 用の明示的なページリスト。`null` = ロケールキーから自動検出します。 |
| `typegen.output` | `string` | `null` | 生成された TypeScript 型の出力パス。`null` = 無効。 |
| `typegen.autoGenerate` | `boolean` | `false` | 各同期後に型を自動再生成します。 |

## 翻訳不要キー {#no-translate}

URL、リポジトリパス、パッケージ名、製品識別子など、一部の値はすべての言語において正しい表記が1つしかありません。`https://example.org/paper` の正しい翻訳は `https://example.org/paper` です。

Champollion の [品質ゲート (quality gate)](/docs/concepts/quality-gate) は、ソースエコー (ソースと完全に同一の翻訳) を拒否します。これは通常、モデルが作業を拒否していることを意味するためです。これらのキーの場合、正解が拒否されることになり、モデルがゲートを通過できる出力は存在しません。性能の低いモデルは、値をわずかに変更する (捏造された `#fragment`、余分な末尾のスラッシュ、不可視のゼロ幅スペースなど) ことでゲートを突破しようと学習し、結果としてリンク切れを引き起こします。性能の高いモデルは値を変更せずに返し、ゲートで失敗するため、実行のたびに `sync` がゼロ以外の値で終了することになります。

代わりに、それらのキーを宣言します。

```json title="champollion.config.json"
{
  "noTranslate": ["**.url", "pages.software.*.repo", "meta.appId"]
}
```

一致するキーは**ソースロケールからそのままコピーされます**。翻訳バックエンドに送信されることも、品質ゲートにかけられることも、失敗としてカウントされることも、課金されることもありません。同じ理由から、実行前のコスト見積もりからも除外されます。

### パターン構文

パターンはフラット化されたキー空間上のドットパスであり、2つのワイルドカードを使用できます。

| パターン | 一致する | 一致しない |
|---------|---------|----------------|
| `nav.brand` | `nav.brand` (完全一致のパス) | `nav.brandName` |
| `**.url` | `url`、`pages.a.b.url` (任意の深さにある `url` リーフ) | `pages.urlLabel`、`pages.url.caption` |
| `pages.software.*.repo` | `pages.software.portal.repo` | `pages.software.a.b.repo` |
| `meta.og*` | `meta.ogImage`、`meta.ogTitle` | `meta.twitterImage`、`meta.og.image` |

`*` は単一のセグメント内で一致し、`**` は0個以上のセグメント全体に一致します。
ワイルドカードのないパターンは、完全一致のキーパスになります。

### URL はデフォルトで処理されます

URL を値に持つキーはゲート下で正しい結果を得られないため、デフォルトで `noTranslateUrls` は `true` に設定されています。つまり、絶対 `scheme://` URL のみで構成されるソース値は、設定なしで翻訳不要として扱われます。

検出は意図的に厳密に行われます。トリミングされた値全体が URL である必要があります。
単にリンクを含むだけの文章 (`"Read the paper at https://…"`) は、引き続き通常通り翻訳されます。

URL が実際にロケール固有である場合 (言語ごとのドキュメントホストなど) は、`"noTranslateUrls": false` でこれをオフにし、そうでないものを `noTranslate` で宣言してください。

### 修復と強制

翻訳不要キーの場合、正しいターゲット値は正確に1つしかないため、いかなる違いも欠陥となります。Champollion はこれを双方向で強制します。

- **`sync` はこれを修復します。** ターゲットが欠落している、`[EN] ` プレフィックスが付いている、または変更されている翻訳不要キーは、ソースから書き換えられます。これには API 呼び出しのコストはかからず、冪等性があります。値が一致すると、それ以降の同期ではそのキーは完全にスキップされます。
- **`verify` と `integrity` はこれで失敗します。** 乖離した翻訳不要キーは、期待される値と実際の値とともに `NO-TRANSLATE DRIFT` として報告されます。この種の破損は差分では確認できないため、不可視文字は `\uXXXX` としてエスケープされます。`champollion integrity` は `1` で終了するため、これに接続されたビルドは、リリース前に破損した URL を捕捉します。

設定したばかりのプロジェクトで `integrity` がこのように失敗した場合、それはロケールファイルにすでに存在していた破損を報告しています。修復するには `champollion sync` を一度実行してください。

## 文字体系の変換 {#script-conversion}

Champollion が翻訳する一部の言語は、複数の方法で*表記*することができます。モデルは常にその言語の**ワーキングスクリプト** (ラテン文字化 — Plains Cree の場合は SRO、Klingon の場合は Okrand 式ラテン文字化) で動作し、その後、決定論的コンバーターが出力を表示用スクリプトに書き換えることができます。そうすべきかどうかは設定によって決定され、**デフォルトで適用されることはありません**。

| ロケール | ワーキングスクリプト | 変換先 | 種類 |
|--------|---------------|----------------|------|
| `crk` (Plains Cree) | `Latn` (SRO) | `Cans` (音節文字) | 実際の Unicode — **選択必須** |
| `sr` / `srp` (Serbian) | `Latn` | `Cyrl` (キリル文字) | 実際の Unicode — **選択必須** |
| `tlh` (Klingon) | `Latn` (ラテン文字化) | `Piqd` (pIqaD) | PUA — オプトイン |
| `x-elvish-s` (Sindarin) | `Latn` | `Teng` (Tengwar) | PUA — オプトイン |
| `x-kryptonian` | `Latn` | Kryptonian | PUA — `"script": "x-kryptonian"` 経由のオプトイン |

**実際の Unicode ペア (crk, sr) では選択が必須です。** Cree の音節文字とキリル文字は通常の Unicode であり、どこでもレンダリングされ、どちらの正書法も実際に使用されています。Champollion がプロジェクトに代わってコミュニティの文字体系を選択することはありません。言語を選択する際に `init` が尋ね、設定でどちらかを指定するまで `sync` は実行を拒否します。

```json
{
  "languages": {
    "crk": { "script": "Cans" }
  }
}
```

**PUA スクリプト (tlh, x-elvish-s, x-kryptonian) はデフォルトでラテン文字化されます。** pIqaD、Tengwar、Kryptonian は *Unicode に含まれていません*。コンバーターは私用領域 (Private Use Area) のコードポイントを出力しますが、それらのコードポイントにマッピングされたフォントを提供しない限り、何もレンダリングされません。ラテン文字化はどこでもレンダリングされる唯一の出力であるため、これがデフォルトになります。代わりに表示用スクリプトを出力するには、次のようにします。

```json
{
  "languages": {
    "tlh": { "script": "Piqd" }
  }
}
```

…そして `champollion fonts install` を実行し、サイトにそれを描画できるフォントを用意します。フォントがラテン文字の翻字にキー付けされている場合 (多くの人工言語フォントがそうです)、デフォルトのままにしてください。

`script` は ISO 15924 コードを受け付けます。大文字と小文字は区別されません (`"cans"`、`"Cans"`、`"CANS"` は同じです)。ペアごとに設定することもでき、その場合は言語レベルの設定よりも優先されます。無効な値、またはロケールが生成できないスクリプトを指定した場合、API 呼び出しが行われる前の起動時に失敗します。

### マッピングされていない文字と `scriptFallback` {#script-fallback}

コンバーターは、その正書法で定義されているものだけを変換し、それ以外は変換しません。Klingon のラテン文字化には `d`、`c`、`f`、`g`、`i`、`k`、`s`、`x`、`z` が存在しません。そのため、「GitHub」のような固有名詞を含むモデルの出力は完全には変換できません。Champollion は**半分だけ変換された値を書き込むことは決してありません**。マッピングできない文字が1つでもある場合、値全体がワーキングスクリプトのまま維持され、警告にはその文字と、それをマッピングするための設定行が示されます。

これらのマッピングはご自身で宣言する必要があります。

```json
{
  "languages": {
    "tlh": {
      "script": "Piqd",
      "scriptFallback": { "d": "D", "f": "p", "z": "S" }
    }
  }
}
```

各ルールは、変換が実行される前に、ワーキングスクリプトのシーケンスをコンバーターがマッピング*できる*ものに置き換えます。ルールは起動時に検証され、置換後の文字列自体がマッピング不可能な場合は拒否されます。

Champollion は**独自のフォールバックルールを提供していません**。特に実際の言語の文字体系において、正書法の適応を考案することはインデックスの役割ではないためです。コミュニティやファンダムには慣例があります。プロジェクトごとに意図的にそれらを採用してください。

### 意図しない変換の修復 {#repair-script}

0.3.0 以前は、変換は無条件に行われていました。PUA ロケールをターゲットとするプロジェクトは、望むと望まざるとにかかわらず、レンダリング不可能な出力を受け取っていました。2つのツールがこの問題を解決します。

- **`champollion repair-script`** は、設定で変換が*オフ*になっているロケールをスキャンして PUA コードポイントを探し、コンバーター自身の逆変換テーブルを使用してラテン文字化を復元します (プレビューするには `--dry` を使用)。pIqaD は正確に逆変換されますが、Tengwar と Kryptonian の逆変換では大文字と小文字の区別が失われ、その旨が通知されます。
- **`champollion integrity`** は、変換がオフになっている場所で PUA が見つかった場合に失敗 (終了コード 1) します。これにより、ビルドゲートはリリース前にレンダリング不可能なテキストを捕捉し、レポートには修復方法が記載されます。

翻訳メモリ (Translation Memory) は修復を必要としません。変換前の値を保存するため、後で `script:` をオンまたはオフに切り替えても、キャッシュの操作は不要です。

文字体系の変換は UI 文字列 (キーバリューファイルおよび Docusaurus JSON) に適用されます。Markdown の本文は決して変換されません。貪欲な文字コンバーターには、コードスパン、URL、フロントマターを安全に通過する方法がないためです。

## ペア設定 {#pair-configuration}

ソース→ターゲットの各ペアを個別に設定できます：

```json
{
  "pairs": {
    "en:fr": {
      "method": "google-translate",
      "qualityTier": "high"
    },
    "en:ja": {
      "method": "llm",
      "model": "google/gemini-2.5-pro"
    },
    "en:crk": {
      "methodPlugin": "crk-coached-v1"
    }
  }
}
```

### ペアのフィールド

| フィールド | 型 | 説明 |
|-------|------|-------------|
| `method` | `string` | 翻訳メソッド：`llm`、`llm-coached`、`google-translate`、`deepl`、`microsoft-translator`、`libretranslate`、`openai`、`anthropic`、`gemini`、`api` |
| `methodPlugin` | `string` | インストール済みプラグインの名前（`.champollion/methods/` から） |
| `model` | `string` | このペアのデフォルトモデルを上書きします |
| `temperature` | `number` | このペアのデフォルト温度を上書きします |
| `batchSize` | `number` | このペアのデフォルトバッチサイズを上書きします |
| `register` | `string` | レジスター／トーンの上書き（プリセットキーまたは自由記述テキスト） |
| `endpoint` | `string` | リモート API エンドポイントの URL。`method` が `api` の場合に必須。 |
| `coachingFile` | `string` | このペア用のコーチングプロンプトファイルへのパス |
| `promptContext` | `string` | このペアのアプリケーションコンテキスト |
| `qualityTier` | `string` | 表示ティア：`standard`、`high`、`research`、`verified` |

## 言語設定 {#language-configuration}

言語の指定には 3 つの形式があります：

### コードの配列（最もシンプル）

```json
{
  "languages": ["fr", "de", "ja"]
}
```

各言語は組み込みのレジスターテーブルからデフォルトのレジスターを取得します。デフォルトが定義されていない言語には `"Professional register."` が適用されます。

### レジスター文字列を使ったオブジェクト

値には言語カードの**プリセットキー**、またはカスタムのレジスターテキストを指定できます：

```json
{
  "languages": {
    "fr": "casual-tu",
    "ko": "formal-hapsyo",
    "ja": "Custom: Polite Japanese for a gaming app."
  }
}
```

Champollion は文字列が言語カードのプリセットキーと一致するかどうかを確認します。一致する場合はカードのフルレジスタープロンプトが使用されます。一致しない場合は文字列がそのまま使用されます。利用可能なプリセットについては[サポート言語](/docs/reference/supported-languages#language-cards)を参照してください。

### フル設定オブジェクト

```json
{
  "languages": {
    "crk": {
      "name": "Plains Cree",
      "register": "SRO syllabics with grammatical precision.",
      "model": "google/gemini-2.5-pro",
      "batchSize": 5,
      "maxRetries": 5,
      "script": "Cans"
    }
  }
}
```

同じブロック内で短縮形とフルオブジェクトを混在させることができます。


### 言語フィールド

| フィールド | 型 | 説明 |
|-------|------|-------------|
| `register` | `string` | スタイル/トーンの指示。**プリセットキー** (例: `casual-tu`、`formal-hapsyo`) またはカスタムテキストを指定できます。[言語カード](/docs/reference/supported-languages#language-cards) を参照してください。 |
| `name` | `string` | 人間が読める言語名 (ステータス表示用) |
| `model` | `string` | デフォルトのモデルを上書きします |
| `temperature` | `number` | デフォルトの temperature を上書きします |
| `batchSize` | `number` | デフォルトのバッチサイズを上書きします |
| `coachingFile` | `string` | この言語用のコーチングプロンプトファイルへのパス |
| `promptContext` | `string` | この言語用のアプリケーションコンテキスト |
| `maxRetries` | `number` | 失敗したバッチの最大再試行バジェット (デフォルト: 3) |
| `script` | `string` | Champollion が書き込む正書法の ISO 15924 コード (例: `"Cans"`、`"Piqd"`)。[文字体系の変換](#script-conversion) を参照してください。 |
| `scriptFallback` | `object` | スクリプトコンバーターがマッピングできない文字の翻字ルール。[文字体系の変換](#script-conversion) を参照してください。 |

:::info[継承チェーン]
設定は次の順序で解決されます（先に見つかったものが優先されます）：

**ペアレベル** → **言語レベル** → **グローバル設定** → **デフォルト**

たとえば、`pairs["en:fr"]` が `model` を設定している場合、言語レベルおよびグローバルの `model` の値よりも優先されます。
:::

## 英語以外のソース言語

ソース言語が英語でない場合：

```bash
# CLI flag (one-time)
npx champollion sync --source fr
```

```json title="champollion.config.json (permanent)"
{
  "inputLocale": "fr"
}
```

## ロックファイル

Champollion は翻訳済みソース値の SHA-256 ハッシュを追跡するために `.champollion.lock` を作成します。すべての開発者が同じ翻訳ベースラインを共有できるよう、**このファイルをコミットしてください**。

ソース値が変更されるとハッシュが一致しなくなり、次の同期時に Champollion がそのキーを再翻訳します。

## `.champollionignore`

`.champollionignore` をプロジェクトルートに作成すると、`lint` スキャンからファイルを除外できます。`.gitignore` のように glob パターンを使用します：

```text title=".champollionignore"
src/components/legacy/**
src/utils/constants.js
**/*.test.js
```

## `.champollion/` ディレクトリ

Champollion は内部状態を管理するために、プロジェクトルートに `.champollion/` ディレクトリを作成します。これはローカルの最適化データであり、プロジェクトのソースではないため、通常は **`.gitignore` に追加することをお勧めします**：

```gitignore
.champollion/
```

| ファイル | 用途 | コミット？ |
|------|---------|--------|
| `tm.json` | 翻訳メモリキャッシュ — ソーステキスト・ロケール・メソッドをキーとして過去の翻訳を保存 | しない（ローカルキャッシュ） |
| `xliff/*.xliff` | プロの翻訳者によるレビュー用 XLIFF エクスポートファイル | しない（一時ファイル） |
| `methods/` | インストール済みメソッドプラグインのマニフェスト | する（共有設定） |
| `backups/` | ラップ前のバックアップ（`wrap --undo` によって作成） | しない（安全網） |

`tm.json` の詳細と API コスト削減への活用方法については、[翻訳メモリ](/docs/concepts/translation-memory)を参照してください。

---

## プログラマティック API

ビルドスクリプトやカスタム統合のために、パッケージから直接インポートできます：

```javascript
import { GeminiMethod, runSync, resolveConfig } from 'champollion';

// Use a method class directly
const gemini = new GeminiMethod();
const result = await gemini.translate(
  ['greeting', 'farewell'],
  { greeting: 'Hello', farewell: 'Goodbye' },
  { target: 'fr', name: 'French', register: 'formal', model: 'gemini-2.5-flash' },
  { cwd: process.cwd() }
);
// result = { greeting: 'Bonjour', farewell: 'Au revoir' }
```

### 利用可能なエクスポート

| エクスポート | 機能 |
|--------|-------------|
| `TranslationMethod` | すべてのメソッドの基底クラス |
| `LLMMethod` | LLM メソッド（OpenRouter）の基底クラス |
| `DirectLLMMethod` | 直接 LLM プロバイダー（OpenAI、Anthropic、Gemini）の基底クラス |
| `OpenAIMethod`、`AnthropicMethod`、`GeminiMethod` | 直接 LLM プロバイダークラス |
| `DeepLMethod`、`MicrosoftTranslatorMethod`、`LibreTranslateMethod`、`TildeMethod`、`TranslatedMethod` | 従来の MT クラス |
| `GoogleTranslateMethod` | Google Cloud Translation |
| `LLMCoachedMethod` | コーチング付き LLM（OpenRouter + コーチングデータ） |
| `APIMethod` | リモート API クライアント |
| `runSync`、`runContentSync` | フル同期パイプライン |
| `resolveConfig`、`resolvePairs` | 設定解決 |
| `validateTranslations` | 品質ゲート |
| `loadCoachingData`、`findDictionaryMatches` | コーチングユーティリティ |

### カスタムプロバイダーの拡張

`DirectLLMMethod` を拡張すると、約 40 行で新しい LLM プロバイダーを追加できます：

```javascript
import { DirectLLMMethod } from 'champollion';

class MistralMethod extends DirectLLMMethod {
  constructor(options) {
    super(options);
    this.name = 'mistral';
  }
  _getApiKeyEnvVar()     { return 'MISTRAL_API_KEY'; }
  _getApiKeyOptionsKey() { return 'mistralApiKey'; }
  _getDefaultModel()     { return 'mistral-large-latest'; }
  _getProviderLabel()    { return 'Mistral'; }

  _buildApiRequest({ prompt, systemMessage, apiKey, model, temperature }) {
    return {
      url: 'https://api.mistral.ai/v1/chat/completions',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: {
        model,
        messages: [
          ...(systemMessage ? [{ role: 'system', content: systemMessage }] : []),
          { role: 'user', content: prompt },
        ],
        temperature,
      },
    };
  }

  _extractResponseText(json) {
    return json.choices?.[0]?.message?.content;
  }

  // Optional but recommended: provider-specific setup help when translation fails
  getSetupHelp() {
    if (!process.env.MISTRAL_API_KEY) {
      return [
        '',
        '  ┌─ Missing API Key ─────────────────────────────────────────────┐',
        '  │ Mistral requires an API key from https://console.mistral.ai   │',
        '  │ Run: export MISTRAL_API_KEY=...                               │',
        '  └────────────────────────────────────────────────────────────────┘',
      ];
    }
    return ['        API key is set but translation failed. Check your Mistral dashboard.'];
  }
}
```

翻訳、コーチング、リトライループ、モデル検証、品質ティア、セットアップサポートがすぐに利用できます。HTTP リクエストの形式のみがプロバイダー固有です。生の `fetch()` を使用する非 LLM アダプターの場合は、独自のリトライループを実装する代わりに、`lib/methods/fetch-with-retry.js` の共有ヘルパー `fetchWithRetry()` を使用してください。

---

## 関連項目

- [CLI リファレンス](/docs/reference/cli) — すべてのコマンドとフラグ
- [翻訳メソッド](/docs/guides/translation-methods) — メソッドの選択と組み合わせ
- [翻訳メモリ](/docs/concepts/translation-memory) — キャッシュとコスト削減
- [プロの翻訳者との連携](/docs/guides/professional-translators) — XLIFF ワークフロー
- [プラグイン仕様](/docs/reference/plugin-spec) — メソッドプラグインのマニフェスト形式
- [アーキテクチャ](/docs/concepts/architecture) — 各コンポーネントの連携
- [サポート言語](/docs/reference/supported-languages) — 組み込みの言語サポート
- [同期の仕組み](/docs/concepts/how-sync-works) — 翻訳パイプライン
