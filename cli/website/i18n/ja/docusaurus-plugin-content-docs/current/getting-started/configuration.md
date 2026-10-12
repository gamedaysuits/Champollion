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
  "localesPattern": null,
  "localesLayout": null,
  "contentDir": null,
  "translatableFields": null,
  "format": "auto",
  "model": "google/gemini-3.8-flash",
  "temperature": 0.3,
  "defaultMethod": "llm",
  "batchSize": 80,
  "coachingFile": null,
  "promptContext": null,
  "genderGuidance": null,
  "protectedTerms": [],
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
| `inputLocale` | `string` | `"en"` | ソース言語コード（BCP 47）。 |
| `localesDir` | `string` | `"./locales"` | ロケールファイルへのパス。言語ごとに1つのファイル（`fr.json`）または言語ごとに1つのフォルダー（`fr/common.json`）を保持します。[ロケールファイルのレイアウト](#locale-layouts)を参照してください。 |
| `localesPattern` | `string` | `null` | どちらの形式にも当てはまらない場合の各言語ファイルの配置場所。`{lang}` および任意の `{ns}` を指定します: `"public/locales/{lang}/{ns}.json"`、`"src/strings/app_{lang}.json"`。プロジェクトルートからの相対パス。`localesDir` を置き換えます。[ロケールファイルのレイアウト](#locale-layouts)を参照してください。 |
| `localesLayout` | `string` | `null` | レイアウト検出をオーバーライドします: `"flat"`（言語ごとに1ファイル）または `"dir"`（言語ごとに1フォルダー）。`en.json` と `en/` の両方が存在する場合にのみ必要です。 |
| `defaultNamespace` | `string` | `null` | 複数ファイルで構成される言語別フォルダープロジェクトにおいて、新しいキーを `champollion wrap` が追加するファイル（例: `"common"`）。 |
| `contentDir` | `string` | `null` | 翻訳対象の Markdown/MDX フォルダー: Hugo の `content/` フォルダーや、Next.js アプリ内の `./newsletters` などのその他のフォルダー。各翻訳はソースと同じ場所に `<name>.<locale>.md` として書き込まれます（例: `2026-10.md` → `2026-10.crk.md`）。すでに `<name>.<code>.md` という名前のファイルは、ソースではなく翻訳として扱われます。[コンテンツ翻訳](/docs/guides/content-translation)を参照してください。 |
| `translatableFields` | `string[]` | `null` | コンテンツ翻訳用のデフォルトの翻訳対象フロントマターフィールドをオーバーライドします。`null` は組み込みのデフォルト（`title`、`description`、`summary`）を使用します。 |
| `format` | `string` | `"auto"` | ファイル形式: `json`、`toml`、`yaml`、`po`（[gettext](#gettext)）、`arb`（[Flutter](#arb)）、または `auto`（ソースファイルの拡張子から検出。`.yml` は YAML とみなされ、ターゲットも `.yml` を維持）。その他の値を指定するとエラーで停止します。 |
| `model` | `string` | `"google/gemini-3.8-flash"` | LLM 方式のデフォルトモデル。正確なモデルスラッグ: 完全な OpenRouter スラッグ（`provider/model`）。短いエイリアス（`gemini-flash`）や浮動 ID（`~vendor/…`、`…-latest`）は拒否され、指定すべきスラッグが提示されます。直接プロバイダーはプレーンな名前（例: `gpt-4o`）を使用します。自社ベンダーの OpenRouter スラッグはそれに対応付けられ（`openai/gpt-4o` → `gpt-4o`）、モデルを持たないプロバイダーの場合は何も送信する前に実行を停止します（[モデル名](/docs/guides/translation-methods#model-names)）。 |
| `temperature` | `number` | `0.3` | LLM の温度（0.0–2.0）。低いほど決定論的になります。 |
| `defaultMethod` | `string` | `"llm"` | デフォルトの翻訳方式: `llm`、`llm-coached`、`openai`、`anthropic`、`gemini`、`local`、`google-translate`、`deepl`、`microsoft-translator`、`libretranslate`、`apertium`、`tilde`、`translated`、`api`。`local` はローカルマシン上の OpenAI 互換サーバーです（デフォルトは Ollama）。`--method` CLI フラグでオーバーライドされます。 |
| `batchSize` | `number` | `80` | 翻訳バッチごとのキー数。大きいほど API 呼び出しは少なくなりますが、プロンプトが大きくなります。 |
| `coachingFile` | `string` | `null` | フリーテキストのコーチングプロンプトファイルへのパス（プロジェクトルートからの相対パス）。内容は起動時に読み込まれ、`Coaching guidance:` ブロックとしてシステムプロンプトに挿入されます。 |
| `promptContext` | `string` | `null` | システムプロンプトに挿入されるアプリケーションコンテキスト文字列（例: "E-commerce product descriptions"）。モデルがドメインに合わせて翻訳を調整するのに役立ちます。 |
| `genderGuidance` | `string` \| `false` | `null` | LLM プロンプトにおける文法上の性の扱い方。`null` は Champollion のカタログから各言語のデフォルトを維持します（フランス語の場合は中黒付きの *écriture inclusive*（`Connecté·e`、`Utilisateur·rice·s`）、ドイツ語の場合はコロン形式（`Benutzer:innen`））。`false` は性の指示を送信しません。文字列を指定すると独自の指示を送信します（例: `"Use the masculine generic."`）。言語ごと、言語ペアごとにも設定可能です。[性のガイダンス](#gender-guidance)を参照してください。 |
| `protectedTerms` | `string[]` | `[]` | すべての言語でそのまま保持する名前: 人名、会社名、製品名など（例: `["Curtis Forbes", "Game Day Suits"]`）。モデルにはこれらを維持するよう指示され、これらの名前のみで構成される値は未翻訳や誤った用字系としてフラグ付けされることはありません。これは**キー**全体をスキップする `noTranslate` とは異なります。 |
| `jsonConcurrency` | `number` | `200` | JSON キー同期の最大並列ロケール翻訳数。`--json-concurrency` CLI フラグでオーバーライドされます。 |
| `contentConcurrency` | `number` | `48` | コンテンツ（Markdown/MDX）翻訳の最大並列 API 呼び出し数。`--content-concurrency` CLI フラグでオーバーライドされます。 |
| `fallbackPrefix` | `string` | `"[EN] "` | 以前の実行によるレガシーな未翻訳値を検出するために `audit` および `verify` で使用されるマーカープレフィックス。Champollion はこのプレフィックスを書き込むことはなく、検出のために読み取るのみです。 |
| `apiKeyEnvVar` | `string` | `"OPENROUTER_API_KEY"` | API キー用の環境変数名。カスタムの環境変数名を使用する場合にオーバーライドします。 |
| `minContentRetention` | `number` | `0.35` | [コンテンツ削除チェック](/docs/concepts/quality-gate)が第2シグナルを参照するまでに、出力が保持しなければならないソースの文字/数字の割合。言語ペアごと、言語ごとにも設定可能です。 |
| `noTranslate` | `string[]` | `[]` | すべてのロケールに値をそのままコピーするドットパスキーおよび glob パターン。[翻訳除外キー](#no-translate)を参照してください。`skipKeys` としても受け入れられます。 |
| `noTranslateUrls` | `boolean` | `true` | `scheme://` URL のみで構成されるソース値を翻訳除外として扱います。URL 値を持つキーを翻訳バックエンドに送信する場合は `false` に設定します。 |
| `baseUrl` | `string` | `""` | SEO アーティファクト生成（hreflang、サイトマップ、JSON-LD）用のベース URL。 |
| `pairs` | `object` | `{}` | ペアごとの方式、モデル、品質のオーバーライド。[ペア設定](#pair-configuration)を参照してください。 |
| `languages` | `object` | `{}` | 言語ごとのオーバーライド。[言語設定](#language-configuration)を参照してください。 |
| `lint.srcDir` | `string` | `null` | Lint スキャン対象のソースディレクトリ。`null` = フレームワークから自動検出。 |
| `lint.ignore` | `string[]` | `["node_modules", ...]` | Lint から除外する glob パターン。 |
| `lint.minLength` | `number` | `2` | ハードコードとしてフラグ付けする最小文字列長。 |
| `seo.urlPattern` | `string` | `"/:locale/:path"` | hreflang タグ生成用の URL パターンテンプレート。 |
| `seo.pages` | `string[]` | `null` | SEO 用の明示的なページリスト。`null` = ロケールキーから自動検出。 |
| `typegen.output` | `string` | `null` | 生成される TypeScript 型の出力パス。`null` = 無効。 |
| `typegen.autoGenerate` | `boolean` | `false` | 各同期後に型を自動再生成します。 |

## ロケールファイルのレイアウト {#locale-layouts}

Champollion は、フレームワークがすでに配置している場所からロケールファイルを読み込みます。配置形式には以下の3種類があります。

**言語ごとに1ファイル**（`flat`）。next-intl、vue-i18n、Hugo、および多くの独自構成のセットアップ:

```text
messages/
  en.json      ← source
  fr.json
  de.json
```

```json title="champollion.config.json"
{ "localesDir": "./messages" }
```

**言語ごとに1フォルダー**（`dir`）。i18next や react-i18next など、各ファイルが*名前空間*となる構成:

```text
public/locales/
  en/
    common.json      ← source namespaces
    admin/users.json
  fr/
    common.json
    admin/users.json
```

```json title="champollion.config.json"
{ "localesDir": "./public/locales" }
```

Champollion は、`<localesDir>/<inputLocale>/` がロケールファイルのフォルダーである場合に `dir` を選択します。すべてのソースファイルは各言語のフォルダー下の同じパスに同期され、不足しているファイルやフォルダーは作成されます。名前空間はネストされたパス（`admin/users`）にすることも可能です。

**その他の形式**（`localesPattern`）。`{lang}` を使用してパスを指定し、言語に複数のファイルがある場合は `{ns}` も指定します:

```json title="champollion.config.json"
{ "localesPattern": "src/translations/{ns}/{lang}.json" }
```

`{lang}` は `"{lang}/app_{lang}.json"` のように複数回使用できます。`{ns}` は1回のみ使用可能で、フォルダーにまたがることもできます。フォーマットは `format` が設定されていない限り、拡張子から判別されます。

`champollion init` はこれらのレイアウトを自動検出します。まず Flutter アプリ（`pubspec.yaml`、存在する場合は `l10n.yaml` も含む）および gettext カタログ（`locale/<lang>/LC_MESSAGES/`、`translations/`、GNU `po/`）をチェックし、それらに合わせた `localesPattern` を書き込みます。次に、フレームワークで通常使われるフォルダー（next-intl の場合は `messages/`、i18next の場合は `public/locales/` に次いで `locales/`、vue-i18n の場合は `src/locales/`、Hugo の場合は `i18n/`）をチェックし、さらに `locales`、`messages`、`i18n`、`lang`、`translations`、`public/locales`、`src/locales`、`src/i18n` をチェックします。ソース言語のファイルを保持しているフォルダーのみを使用し、検出された内容を出力します。また、`init --langs fr,de` はそのレイアウトで空のターゲットファイルも作成します。

:::note[複数ファイル構成の言語の同期方法]
各ファイルは個別に比較、翻訳、書き込みが行われます。`.champollion.lock` はキーを `<namespace>::<key>`（`common::nav.home`）として記録し、`--force-keys`、`xliff` のユニット ID、および `sync --dry --json` も同様です。`--force-keys` のプレーンなキーは、すべてのファイルの該当キーと一致します。言語ごとに1ファイルのプロジェクトではプレーンなキーが保持されるため、ロックファイルは変更されません。

翻訳メモリ（Translation Memory）はファイルごとではなく、ソーステキストをキーとして管理されます。2つの名前空間に出現する文字列は、言語ごとに1回のみ翻訳されます。2つ目のファイルはキャッシュから追加コストなしでそれを取得します。
:::

`en.json` と中身のある `en/` フォルダーの両方が存在する場合、Champollion は推測で処理を進めずに停止し、`"localesLayout": "flat"` または `"dir"` を設定するよう促します。

### i18next の複数形キー {#i18next-plurals}

i18next は複数形を CLDR サフィックス付きの同階層キーとして保存します: `item_one`、`item_other`。言語によって複数形の形式は異なります。フランス語やスペイン語では `_many` も使用され、アラビア語では6つの形式があり、日本語では `_other` のみを使用します。JSON ソースファイルにこれらのキーがある場合、JavaScript の `Intl.PluralRules` API を通じて CLDR から読み取られた、各言語独自の正確な形式が各ターゲットに付与されます:

```json title="en.json"
{ "item_one": "{{count}} item", "item_other": "{{count}} items" }
```

同期後、`fr.json` には `item_one`、`item_many`、`item_other` が含まれ、`ja.json` には `item_other` のみが含まれます。同期時に、対象の各言語でどの形式が追加または削除されたかが通知されます。

新しい形式はソースの `_other` テキストから翻訳され、`_one` は `_one` から翻訳されます。ソース内の `_zero` はすべての言語で保持されます。これは、i18next がすべての言語でカウント 0 の場合にそれを参照するためです。過去の同期で日本語における `item_one` のようにその言語で使用しない形式が書き込まれた場合、同期処理はその値が同期によって生成されたことが翻訳メモリで確認できる場合にのみ削除します。手動で記述された値は保持されます。ソースにもキーが存在せず、その言語にも存在しない形式のキー（スペイン語の `item_two` など）は、自動的に削除されることはありません。`verify` がそれを指摘し、`sync --prune plural-extras` はそれらのキーを個別にリストアップして正確に削除します（`--dry` を指定すると、何を削除するかが表示されます）。CLDR に複数形ルールが存在しない言語の場合、ソースの形式が1対1でコピーされ、同期処理でその旨が表示されます。

### ICU メッセージ {#icu}

ICU MessageFormat（next-intl、react-intl、vue-i18n、Flutter）で記述された値は、コードとテキストが混在しています:

```json
{ "items": "{count, plural, =0 {No events} one {# event} other {# events}}" }
```

分岐内のテキストのみが翻訳されます。[品質ゲート](/docs/concepts/quality-gate)は、それ以外の部分を変更する翻訳を拒絶します:

- 変数名（`count`、`{name}`）: 名前が変更されたり削除されたりすることはありません。
- `plural`、`select`、`selectordinal` という単語、および `{price, number}` の型。
- セレクター（`=0`、`one`、`other`、`male`）。`select` はその選択肢を正確に維持します。`plural` はソースのセレクターを維持し、ターゲット言語が使用するカテゴリを CLDR から追加できます（フランス語は `many` を追加し、ポーランド語は `few` と `many` を追加）。その言語で使用されないカテゴリは削除される場合があり、例えば日本語は `other` のみを保持します。
- `#` が含まれる各複数形分岐内のハッシュ記号（言語によって数値を単語として記述できる `zero`、`one`、`two`、`=N` を除く）。
- `offset:N`、ネストされた引数、および `%s`、`%d`、`%(name)s` などの printf 変換。

モデルにはターゲット言語が使用するカテゴリが通知されます。拒絶された翻訳は、理由（例: `ICU keyword 'other' was translated to 'óthér'`）を添えて1回再試行されます。プレースホルダーの前のクォート（`d'{name}`）は問題ありません。`verify` と `integrity` は、すでに書き込まれたファイルに対して同じチェックを実行します。通常の `sync` はディスク上の既存の値を維持するため、検出結果ごとにそれを修正するコマンド（`champollion sync --pair <pair> --redo keys:<key>`）が提示されます。破損した値が翻訳メモリに由来する場合、キャッシュから削除されるため、そのコマンドは同じテキストを再利用する代わりにキーを再翻訳します。`--fresh` は必要ありません。

### gettext カタログ (.po) {#gettext}

カタログを `localesPattern`（または `localesDir`）で指定します:

```json title="Django"
{ "localesPattern": "locale/{lang}/LC_MESSAGES/{ns}.po" }
```

```json title="GNU (po/fr.po, po/de.po, po/hello.pot)"
{ "localesDir": "./po", "format": "po" }
```

**ソース**は、ソース言語のカタログ（例: `django-admin makemessages -l en` の `locale/en/LC_MESSAGES/django.po`）です。`msgstr` が空の場合、その `msgid` が翻訳対象テキストとなります。そのカタログが存在しない場合、ソースは `.pot` テンプレートになります:

- `localesDir` の場合: そのフォルダー内にある1つの `.pot`。
- `localesPattern` の場合: 最初のプレースホルダーの前のフォルダー、またはその上位フォルダー内の `<name>.pot`。`<name>` は名前空間（`{ns}`、`django.pot` などのドメインごとに1つのテンプレート）、または `{lang}` を除いたパターンのファイル名（`messages.po` → `messages.pot`）になります。
- `localesLayout: "dir"` の場合: テンプレートは検索されません。ソースカタログを `<localesDir>/<source>/` に保持してください。

テンプレートが1つ期待される場所に2つある場合、実行は停止します。Champollion がどちらがソースかを推測することはありません。

**キー。** 各 `msgid` がキーとなります。`msgctxt` を持つエントリーは、gettext 独自のエンコーディングである `msgctxt` + U+0004 + `msgid` でキー付けされます。動詞の「Open」と形容詞の「Open」は別々のキーであり、別々のキャッシュエントリーになります。レポートでは区切り文字が `␄`（`verb␄Open`）として出力され、`--force-keys "verb␄Open"` もそれを受け入れます。`␄` を入力できない場合は、`\x04`（`--force-keys 'verb\x04Open'`）と記述してください。どちらの表記も機能します。`--force-keys`（および `--redo keys:`）はカンマで分割されるため、msgid 内のカンマは `\,` と記述し、引数をクォートで囲みます: `--redo 'keys:Welcome back\, %(name)s!'`。変更のないエントリーは追加コストなしでキャッシュから取得されます。

**翻訳されるもの。** `msgstr` が空のエントリー、または `fuzzy` のフラグが付いたエントリーは未翻訳とみなされます。同期によってそれが翻訳され、`fuzzy` は以前の msgid 行である `#|` とともに削除されます。翻訳者コメント（`# …`）は保持されます。参照（`#:`）、抽出されたコメント（`#.`）、およびフラグはソースから引き継がれます。`#.` コメントと `msgctxt` はコンテキストとしてモデルに送信されます。同期によって変更されなかったエントリーは、バイト単位でそのまま書き戻されます。ソースに存在しなくなったエントリーや、廃止された `#~` エントリーは末尾に保持されます。

Champollion が作成するカタログ（`init --langs`、またはまだカタログがないロケールの同期）には、`msginit --no-translator` が書き出し、`msgfmt -c` が受け入れる完全なヘッダーが付与されます: テンプレートからコピーされた `Project-Id-Version`、`Report-Msgid-Bugs-To`、`POT-Creation-Date`（`PACKAGE VERSION` はプロジェクトのフォルダー名に置き換えられ、テンプレートの日付がない場合は `POT-Creation-Date` は付与されません）、`PO-Revision-Date`（ファイル作成時）、`Last-Translator: Automatically generated`、`Language-Team: none`、`Language`、`MIME-Version: 1.0`、`Content-Type: text/plain; charset=UTF-8`、`Content-Transfer-Encoding: 8bit`、`Plural-Forms`。既存のカタログのヘッダーが書き直されることはありません。ヘッダー内のプレースホルダー `Plural-Forms` または `charset=CHARSET` のみが入力されます。

**複数形。** `msgid_plural` を持つエントリは1つのICU複数形メッセージ（`{n, plural, one {One file} other {%(count)d files}}`）として翻訳されるため、モデルはすべての形式を一度に出力します。その後、ターゲットの `Plural-Forms` ヘッダーを通じて `msgstr[0]`…`msgstr[n]` に書き出されます。各インデックスには、それを選択する数値のCLDRカテゴリが割り当てられます。ロシア語の `nplurals=3` は `one`、`few`、`many` です。ターゲットに `Plural-Forms` ヘッダーがない場合、あるいはテンプレートのプレースホルダーしかない場合は、その言語向けに `msginit` が書き出すヘッダーが設定されるため、カタログの `msgstr[]` スロットはgettextおよびDjangoが選択するもの（フランス語 `nplurals=2; plural=(n > 1);`、ドイツ語 `nplurals=2; plural=(n != 1);`、ロシア語 `nplurals=3; …`）になります。`msginit` にエントリがない言語にはCLDRから導出されたヘッダーが設定され、3,000までのすべての数値および大きな数値について `Intl.PluralRules` と照合されます。ある言語のルールをgettextの式として記述できない場合、同期は停止し、ヘッダーを書き出すコマンド（`msginit --locale=<lang> --input=<template>.pot`）を表示します。カタログにスロットが存在しない形式（2形式カタログにおける、1 000 000に対するフランス語の `many` など）は、再度の要求や未翻訳としてのマーク・報告は行われません。独自のヘッダーを持つカタログはそのヘッダーを保持し、そのスロットがチェック対象となります。

**制限事項。** カタログは UTF-8 である必要があります。それ以外の場合は `msgconv --to-code=UTF-8` で変換してください。波括弧の対応が取れていない複数形 msgid は ICU メッセージとして記述できないため、報告され、手動翻訳用に残されます。リリース前には必ず `msgfmt --check-format`（Django: `compilemessages`）を実行してください。これは `#, python-format`（または `c-format`、…）のフラグが付いたエントリーのみをチェックします。`makemessages` は `%` プレースホルダーで抽出したエントリーにフラグを追加しますが、手動で作成されたカタログにはフラグがない場合があり、それらのエントリーは未チェックになります。`champollion verify` は、フラグに関係なく、すべてのエントリーの printf プレースホルダー（名前と型文字）を比較し、同期は翻訳する各エントリーに対してソースエントリーのフラグを維持します。

### Flutter ARB ファイル (.arb) {#arb}

```json title="champollion.config.json"
{ "localesPattern": "lib/l10n/app_{lang}.arb" }
```

異なる場合は、`l10n.yaml` の `arb-dir` および `template-arb-file` を使用してください（`assets/i18n/intl_{lang}.arb`）。メッセージのみが翻訳されます。書き込み時:

- `@@locale` はファイル名に合わせて Flutter の形式でターゲットに設定されます（`app_pt_BR.arb` → `"pt_BR"`）。`gen-l10n` は `@@locale` がファイル名と一致しないファイルを拒絶します。
- すべての `@key` メタデータオブジェクト（プレースホルダー、その型、説明）がソースからコピーされます。ソースにメタデータがないキーは、ターゲットのメタデータを保持します。
- キーはソースの順序に従います。未翻訳のメッセージは除外されるため、Flutter はテンプレートにフォールバックします。

メッセージの `description` はコンテキストとしてモデルに送信されます。`{name}` プレースホルダーと ICU 複数形は、[ICU チェック](#icu)によって保護されます。また、`verify` と `integrity` は、誤った `@@locale` やソースと異なるプレースホルダーのメタデータも報告します。ファイルを書き直す同期処理はいずれも両方を修復します。`champollion sync --pair en:fr --force` は変更されていないすべてのメッセージをキャッシュから提供します。

## 翻訳除外キー {#no-translate}

値によっては、すべての言語でまったく同一の表記が正解となるものがあります（URL、リポジトリパス、パッケージ名、製品識別子など）。`https://example.org/paper` の正しい翻訳は `https://example.org/paper` です。

Champollion の[品質ゲート](/docs/concepts/quality-gate)はソースエコー（ソースと完全に同一の翻訳）を拒絶します。これは通常、モデルが処理を拒否していることを意味するためです。しかし、これらのキーの場合、拒絶されるものこそが正解となり、モデルが合格できる出力を生成できなくなります。精度の低いモデルは、値をわずかに変更してゲートを突破しようとし（不要な `#fragment` の付加、余分な末尾のスラッシュ、目に見えないゼロ幅スペースなど）、リンク切れを招きます。精度の高いモデルは値をそのまま返してゲートで失敗するため、`sync` は実行するたびに非ゼロで終了してしまいます。

代わりに、これらのキーを明示的に宣言してください:

```json title="champollion.config.json"
{
  "noTranslate": ["**.url", "pages.software.*.repo", "meta.appId"]
}
```

一致するキーは**ソースロケールから逐語的にコピーされます**。翻訳バックエンドに送信されることも、品質ゲートを通ることも、失敗としてカウントされることも、課金されることもありません。同じ理由で、実行前のコスト見積もりからも除外されます。

### パターン構文

パターンは、フラット化されたキースペースに対するドットパスであり、2種類のワイルドカードを使用できます:

| パターン | 一致するもの | 一致しないもの |
|---------|---------|----------------|
| `nav.brand` | `nav.brand`（完全一致パス） | `nav.brandName` |
| `**.url` | `url`、`pages.a.b.url`（任意の深さの `url` リーフ） | `pages.urlLabel`、`pages.url.caption` |
| `pages.software.*.repo` | `pages.software.portal.repo` | `pages.software.a.b.repo` |
| `meta.og*` | `meta.ogImage`、`meta.ogTitle` | `meta.twitterImage`、`meta.og.image` |

`*` は単一セグメント内で一致します。`**` は0個以上の完全なセグメントに一致します。ワイルドカードのないパターンは、完全一致のキーパスとなります。

### URL はデフォルトで処理されます

URL 値のキーは品質ゲートのもとで正しい結果を得られないため、`noTranslateUrls` は最初から `true` に設定されています。絶対 `scheme://` URL のみで構成されるソース値は、設定なしで翻訳除外として扱われます。

検出条件は意図的に厳格になっています。前後の空白を除去した値全体が URL でなければなりません。テキスト内にリンクが含まれているだけの場合（`"Read the paper at https://…"`）は、通常通り翻訳されます。

URL が実際にロケール固有である場合（言語別のドキュメントホストなど）は `"noTranslateUrls": false` でこの機能を無効にし、ロケール固有でないものを `noTranslate` で明示的に宣言してください。

### 修復と適用

翻訳除外キーにはすべての言語でただ1つの正しいターゲット値が存在するため、いかなる差異も不具合となります。Champollion はこれを双方向で適用します:

- **`sync` による修復。** ターゲットが存在しない、`[EN] ` のプレフィックスが付いている、または変更されている翻訳除外キーは、ソースの値で書き直されます。これには API 呼び出しのコストはかからず、冪等です。値が一致した後は、その後の同期でそのキーは完全にスキップされます。
- **`verify` および `integrity` での失敗。** 乖離が生じた翻訳除外キーは、期待される値と実際の値とともに `NO-TRANSLATE DRIFT` として報告されます。目に見えない文字は diff で判別できないため `\uXXXX` としてエスケープされます。`champollion integrity` は `1` で終了するため、これと連携したビルド処理により、破損した URL がリリースされるのを未然に防ぐことができます。

設定したばかりのプロジェクトで `integrity` がこのように失敗した場合、ロケールファイルにすでに存在していた破損が報告されています。`champollion sync` を1回実行して修復してください。

## 用字系の変換 {#script-conversion}

Champollion が翻訳する言語の中には、複数の表記方法（用字系）を持つものがあります。モデルは常にその言語の**作業用字系**（ラテン文字転写 — 平原クリー語の場合は SRO、クリンゴン語の場合は Okrand 転写）で動作し、決定論的なコンバーターによって出力を表示用字系に書き換えることができます。書き換えるべきかどうかは設定によって決定され、**デフォルトになることは決してありません**:

| ロケール | 作業用字系 | 変換先 | 種類 |
|--------|---------------|----------------|------|
| `crk`（平原クリー語） | `Latn`（SRO） | `Cans`（音節文字） | 実 Unicode — **選択必須** |
| `sr` / `srp`（セルビア語） | `Latn` | `Cyrl`（キリル文字） | 実 Unicode — **選択必須** |
| `tlh`（クリンゴン語） | `Latn`（ラテン文字転写） | `Piqd`（pIqaD） | PUA — オプトイン |
| `x-elvish-s`（シンダール語） | `Latn` | `Teng`（テングワール） | PUA — オプトイン |
| `x-kryptonian` | `Latn` | クリプトン語 | PUA — `"script": "x-kryptonian"` によるオプトイン |

**実 Unicode のペア（crk、sr）は選択が必須です。** クリー音節文字とキリル文字は通常の Unicode であり、どこでも描画でき、どちらの正書法も実際に使用されています。Champollion がプロジェクトに代わってコミュニティの表記体系を選択することはありません。言語を選択すると `init` で確認され、設定でどちらにするかが指定されるまで `sync` は実行を拒否します:

```json
{
  "languages": {
    "crk": { "script": "Cans" }
  }
}
```

**PUA 文字（tlh、x-elvish-s、x-kryptonian）はデフォルトでラテン文字転写になります。** pIqaD、テングワール、クリプトン語は *Unicode に含まれていません*。コンバーターは、それらのコードポイントに対応付けられたフォントを提供しない限り何も表示されない私用領域（PUA）コードポイントを出力します。ラテン文字転写はどこでも表示できる唯一の出力であるため、デフォルトとなっています。代わりに表示用字系を出力するには:

```json
{
  "languages": {
    "tlh": { "script": "Piqd" }
  }
}
```

…そしてサイトに描画可能なフォントが含まれるよう `champollion fonts install` を実行してください。フォントがラテン文字転写に対応付けられている場合（多くの人工言語フォントが該当します）、デフォルトのままにしてください。

`script` には ISO 15924 コードを大文字・小文字を問わず指定できます（`"cans"`、`"Cans"`、`"CANS"` は同一です）。言語ペアごとに設定することもでき、その場合は言語レベルの設定よりも優先されます。無効な値や、そのロケールで生成できない用字系を指定した場合は、API 呼び出しが行われる前の起動時に失敗します。

### マッピングされない文字と `scriptFallback` {#script-fallback}

コンバーターは、その正書法で定義されているもののみを変換し、それ以外は変換しません。クリンゴン語のラテン文字転写には `d`、`c`、`f`、`g`、`i`、`k`、`s`、`x`、`z` が存在しないため、「GitHub」のような固有名詞を含むモデル出力を完全に変換することはできません。Champollion は**中途半端に変換された値を書き込むことは決してありません**。マッピングできない文字が1つでもある場合、値全体が作業用字系のまま維持され、警告には該当する文字とそれらをマッピングするための設定行が表示されます。

これらのマッピングは任意で宣言できます:

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

各ルールは、変換が実行される前に、作業用字系の文字列をコンバーターがマッピング*できる*ものに置き換えます。ルールは起動時に検証され、置換後自体がマッピング不能である場合は拒絶されます。

Champollion 自体には**独自のフォールバックルールは用意されていません**。特に実際の言語の表記体系において、独自の正書法への適応を作り出すことはツールの役割ではないためです。コミュニティやファン層にはそれぞれの慣例が存在します。プロジェクトごとに意図して採用してください。

### 不要な変換の修復 {#repair-script}

0.3.0 より前のバージョンでは、変換は無条件に行われていたため、PUA ロケールを対象とするプロジェクトでは意図に関わらず描画不能な出力が生成されていました。以下の2つのツールがこの問題を解決します:

- **`champollion repair-script`**: 設定で変換が*オフ*になっているロケールから PUA コードポイントをスキャンし、コンバーター自体の逆引きテーブルを使用してラテン文字転写を復元します（プレビューには `--dry` を使用）。pIqaD は正確に復元されます。テングワールとクリプトン語の復元は大文字・小文字の情報が失われ、その旨が表示されます。
- **`champollion integrity`**: 変換がオフの場所で PUA が見つかった場合に失敗（終了コード 1）します。これにより、描画不能なテキストがリリースされるのをビルドゲートで検出し、レポートで修復方法を提示します。

翻訳メモリの修復は不要です。変換前の値が保存されるため、後から `script:` をオン/オフに切り替えてもキャッシュの再構築は必要ありません。

用字系の変換は UI 文字列（キー/値ファイルおよび Docusaurus JSON）に適用されます。Markdown の本文は変換されません。貪欲な文字コンバーターがコードスパン、URL、フロントマターを安全に処理する方法がないためです。

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
      "model": "google/gemini-3.1-pro-preview"
    },
    "en:crk": {
      "method": "llm-coached"
    }
  }
}
```

### ペアのフィールド

| フィールド | 型 | 説明 |
|-------|------|-------------|
| `method` | `string` | 翻訳方式: `llm`、`llm-coached`、`openai`、`anthropic`、`gemini`、`local`、`google-translate`、`deepl`、`microsoft-translator`、`libretranslate`、`apertium`、`tilde`、`translated`、`api` |
| `methodPlugin` | `string` | インストール済みプラグインの名前（`.champollion/methods/` より） |
| `model` | `string` | このペアのデフォルトモデルをオーバーライド |
| `temperature` | `number` | このペアのデフォルト温度をオーバーライド |
| `batchSize` | `number` | このペアのデフォルトバッチサイズをオーバーライド |
| `register` | `string` | レジスター/文体のオーバーライド（プリセットキーまたは自由形式テキスト） |
| `endpoint` | `string` | リモート API エンドポイント URL。`method` が `api` の場合に必須。 |
| `coachingFile` | `string` | このペアのコーチングプロンプトファイルへのパス（プロジェクトからの相対パス）。詳細度の低いコーチングを置き換えます。読み込めないファイルがある場合は実行を停止します |
| `promptContext` | `string` | このペアのアプリケーションコンテキスト |
| `genderGuidance` | `string` \| `false` | このペアのプロンプトに対する性の指示: 独自のテキスト、または指示なしとする `false`。[性のガイダンス](#gender-guidance)を参照してください。 |
| `qualityTier` | `string` | ペアの出力に付与するラベル: `standard`、`high`、`research`、`verified`。測定されることはなく、何が指定されても同期翻訳の結果は同じです。`status` で表示され（設定時のみ）、`serve` で通知されます |
| `fallback` | `object` | このペアの方式で安全に翻訳できない場合に使用する第2の方式。[フォールバック方式](#fallback)を参照してください。`null` は言語に設定されたフォールバックを削除します。 |

### フォールバック方式 {#fallback}

言語ペアには第2の方式を指定できます。まずペア自身の方式で翻訳され、安全に翻訳できなかったものが1度フォールバックに送られます:

- **キー/値ファイル:** [品質ゲート](/docs/concepts/quality-gate)によって拒絶されたキー（`{name}` の欠落、壊れた複数形、2語のラベルが1段落になってしまったものなど）および方式が何も返さなかったキー。
- **Markdown（Hugo コンテンツおよび Docusaurus ドキュメント）:** 除外されたり単語が失われたりしたフロントマターフィールド、および応答から脱落した、破損した（コード、HTML タグ、ショートコードなどの保護要素の消失）、または空になった本文ブロック。`page` セグメンテーションではページ全体。

```json
{
  "pairs": {
    "en:crk": {
      "method": "api",
      "endpoint": "http://127.0.0.1:8378/translate",
      "fallback": { "method": "llm-coached", "model": "google/gemini-3.8-flash" }
    }
  }
}
```

マシン外にテキストを持ち出せない場合（病院、学校、言語データをオンサイトで保持するコミュニティなど）は、フォールバックをご自身で運用するモデルに設定してください。`local` 方式は、このマシン上の OpenAI 互換サーバー（Ollama、llama.cpp、vLLM、LM Studio。`LOCAL_API_BASE` でアドレスを設定、[`local`](/docs/guides/translation-methods#local--your-own-model-ollama-vllm-lm-studio-a-trained-model)を参照）に送信します:

```json
{
  "pairs": {
    "en:crk": {
      "method": "api",
      "endpoint": "http://127.0.0.1:8378/translate",
      "fallback": { "method": "local", "model": "<your local model>" }
    }
  }
}
```

使い分け:

- **ホステッドモデル**（Gemini モデルを使用する `llm-coached`、またはその他の API 方式）は、低リソース言語に対して通常より強力なセカンドオピニオンとなり、リクエストごとに課金されます。テキストをそのプロバイダーに送信しても問題ない場合に使用してください。
- **`local`** はすべてのキーをこのマシン内に保持し、見積もりでは `$0 API cost (runs on this machine)` と表示されます。実行できるモデルが比較的小さい場合であっても、マシン外にデータを一切送信できない場合に使用してください。

フォールバックの出力も同じ品質ゲートを通過します。翻訳された内容は翻訳メモリ内の独自の方式名でキャッシュされるため、どの方式が各値を生成したかがキャッシュに記録されます。以降の同期では、最初の方式に再度問い合わせる代わりにキャッシュが再利用されます（`--fresh` または `--retranslate` を指定すると再問い合わせを行います）。どちらの方式でも翻訳できなかったものは、フォールバックがない場合と同じ状態のままになります。キーは未翻訳のまま以前のロックエントリを保持するため、次回の同期で再試行され、`champollion verify` にリストされます。Markdown ブロックは `[EN] ` プレフィックス付きのソースとして書き込まれ、キャッシュされず、次回の同期でファイルが再処理されます。品質ゲートによって両方の方式で拒絶されたブロックやフロントマターフィールドは保留され、`--redo files:<page>` でページが指定されるまで再送信されません（[拒絶された Markdown ブロックとフロントマターフィールド](/docs/concepts/quality-gate#refused-markdown-blocks-and-front-matter-fields)）。両方の方式で空になったフロントマターフィールドや、どちらも翻訳できなかったページは、フォールバックがない場合と同様にファイル単位で失敗します。

フォールバックはペアと同じフィールドを受け入れます: `method`（必須）、`model`、`provider`、`endpoint`、`methodPlugin`、`coachingFile`、`coachingPrompt`、`promptContext`、`register`、`temperature`、`batchSize`、`maxRetries`、`qualityTier`、`contentSegmentation`、`name`。ペアと同様に解決されます。設定されていないフィールド（レジスター、コーチング、プロンプトコンテキストなど）はペアから継承されます。フォールバック自身の `coachingFile` はそのプロンプトとキャッシュキーに渡され、`champollion status` に表示されます。表記体系はペアに属するため、フォールバックでは `script` と `scriptFallback` は拒絶され、フォールバック独自の `fallback` も拒絶されます。不明な方式や、ペアと同一のフォールバックを指定すると、ペア名を明記したエラーで同期が停止します。フォールバックは、ペア自身の方式と同様に同期が開始される前に実行準備が整っている必要があります（例: API キーが設定されていること）。

- **`--method` および `--model` はペア自身の方式のみを変更します。** フォールバックは設定ファイルの内容を維持します。
- **コスト。** 実行前の見積もりはペア自身の方式のみを対象とします。事前に何が失敗するかは予測できないためです。各フォールバックバッチは、実行直前に同じ見積もりエンジンで計算されます。`--max-cost` を使用している場合、実行全体の上限（初期見積もり＋これまでのすべてのフォールバックバッチ）を超えるバッチは、キー名を明記した警告とともに対象からスキップされます。コストを見積もれないフォールバックも同様です（不明は無料ではありません）。それらのキーは失敗したままとなり、一部失敗と同様に同期は非ゼロで終了します。
- **レポート。** `sync` はペアごとに1行出力します（例: `[FALLBACK] en:crk — 6 key(s) the primary (api) could not translate safely → translated by llm-coached (4 accepted, 2 still failing)`）。`--json` の概要には、フォールバックが何を行ったかがペアごとに表示されます（`method`、`attempted`、`accepted`、`failed`、`cached`）。キー/値ファイルの場合は `locales` の各エントリに、Docusaurus JSON の場合は `fallback` に、Markdown の場合は `content.fallback` に記録されます。`champollion status` はペアの下にフォールバックを表示します。`--dry` は何が失敗するかを把握できないため、フォールバックについては何も報告しません。
- **フォールバックが大半を書き込んだ場合。** 1回の実行でペアの新規翻訳（ペアの方式で承認された回答＋フォールバックの回答）の半分以上がフォールバックによるものであった場合、`sync` は1つの警告を追加します。内訳件数、使用された方式とモデル、ペアの方式の回答が使用されなかった理由（理由ごとのカウント: 異なるソース文字列に対して暗記された文が繰り返された、文字数の膨張など）、および検討すべき事項（ペアの方式がこれらの文字列に適していない可能性、書き込まれた内容の確認（`verify` は構造をチェックし、話者は意味をチェック）、より強力なフォールバックの採用など）。`--json` のエントリには、`accepted` の横に `primaryAccepted` と `primaryReasons` が付与されます。`champollion status` はファイルについても同じ割合を示し（"from the fallback: 8 value(s) in the files (…) — 8 of the 8 sync wrote (100%)"）、ロケールのテキストの大半を占める場合にその旨を伝えます。
- `champollion serve` も `--max-cost-per-request` / `--max-session-cost` の上限内でフォールバックを使用します。

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
      "model": "google/gemini-3.1-pro-preview",
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
| `register` | `string` | スタイル/文体の指示。**プリセットキー**（例: `casual-tu`、`formal-hapsyo`）またはカスタムテキストを指定可能。[言語カード](/docs/reference/supported-languages#language-cards)を参照してください。 |
| `name` | `string` | 人間が読める言語名（ステータス表示用） |
| `model` | `string` | デフォルトモデルをオーバーライド |
| `temperature` | `number` | デフォルト温度をオーバーライド |
| `batchSize` | `number` | デフォルトバッチサイズをオーバーライド |
| `coachingFile` | `string` | この言語のコーチングプロンプトファイルへのパス（プロジェクトからの相対パス）。トップレベルのコーチングを置き換えます。読み込めないファイルがある場合は実行を停止します |
| `promptContext` | `string` | この言語のアプリケーションコンテキスト |
| `genderGuidance` | `string` \| `false` | この言語のプロンプトに対する性の指示: 独自のテキスト、または指示なしとする `false`。[性のガイダンス](#gender-guidance)を参照してください。 |
| `maxRetries` | `number` | 失敗したバッチの最大再試行回数（デフォルト: 3） |
| `script` | `string` | Champollion が書き込む正書法の ISO 15924 コード（例: `"Cans"`、`"Piqd"`）。[用字系の変換](#script-conversion)を参照してください。 |
| `scriptFallback` | `object` | 文字コンバーターがマッピングできない文字の翻字ルール。[用字系の変換](#script-conversion)を参照してください。 |
| `endpoint` | `string` | `"method": "api"` 用のリモート API エンドポイント URL |
| `fallback` | `object` | この言語の方式で安全に翻訳できない場合に使用する第2の方式。[フォールバック方式](#fallback)を参照してください。 |

:::info[継承チェーン]
設定は次の順序で解決されます（先に見つかったものが優先されます）：

**ペアレベル** → **言語レベル** → **グローバル設定** → **デフォルト**

たとえば、`pairs["en:fr"]` が `model` を設定している場合、言語レベルおよびグローバルの `model` の値よりも優先されます。
:::

### 性のガイダンス {#gender-guidance}

文法上の性を持つ言語の場合、LLM プロンプトには性に関する指示が含まれます。これは Champollion のカタログから取得されます。フランス語では読者の性が不明な場合に中黒付きの *écriture inclusive*（`Connecté(e)` や `Connectée` ではなく `Connecté·e`、複数形では `Utilisateur·rice·s`）、ドイツ語ではコロン形式（`Benutzer:innen`）、日本語では中立的な `私` を指定します。`champollion init` は各言語のレジスターの横にこれを表示し、`champollion status` はどこから取得されたかを含めてペアごとに表示します。

`genderGuidance` を使用して、すべての言語または特定の言語に対して別のスタイルを選択できます:

```json
{
  "languages": {
    "fr": { "register": "formal-vous", "genderGuidance": "Use the masculine generic (Connecté), as the Académie française recommends." },
    "de": { "register": "formal-Sie", "genderGuidance": false }
  }
}
```

`false` は性の指示を送信しません。文字列を指定するとカタログの指示が置き換えられます。この設定は、指示を受け付ける方式（LLM 方式）に適用されます。機械翻訳エンジン（DeepL、Google など）には伝達されません。性の指示が変更されるとプロンプトが異なるものとなるため、独自のキャッシュエントリが作成されます。すでに翻訳されているものは、再翻訳するまでそのまま維持されます（`champollion sync --redo all`。ファイルに以前のスタイルが残っている場合に sync がこれを提案します）。

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

Champollion は、翻訳されたソース値の SHA-256 ハッシュを追跡するために `.champollion.lock` を作成します。すべての開発者が同じ翻訳ベースラインを共有できるよう、**このファイルをコミットしてください**。言語ごとに1つのフォルダーを持つプロジェクトでは、キーは `<namespace>::<key>` として記録されます。

ターゲットロケールごとに、ロックファイルには sync が書き込んだ各値とその翻訳元となったソーステキストのフィンガープリント（人の手で編集された値の識別や、古い翻訳の検出のため）、やり直し（redo）で完了できなかったキー（**pending**）、および品質ゲートによって拒絶されたキー（同じモデルから**保留**）も記録されます。これらを記録する場合、ファイルはバージョン2の形式である `{"version": 2, "source": {…}, "locales": {…}}` になります。バージョン1のロック（フラットなキー → ハッシュマップ）は従来通り読み込まれます。置き換えられた手動編集内容は隣の `.champollion-replaced-edits.jsonl` に保持されます。両方をコミットしてください。[品質ゲート](/docs/concepts/quality-gate#refused-keys-are-held-back)および[翻訳の編集](/docs/guides/professional-translators#editing-key-value-files)を参照してください。

ソース値が変更されるとハッシュが一致しなくなり、次の同期時に Champollion がそのキーを再翻訳します。

## `.champollionignore`

`.champollionignore` をプロジェクトルートに作成すると、`lint` スキャンからファイルを除外できます。`.gitignore` のように glob パターンを使用します：

```text title=".champollionignore"
src/components/legacy/**
src/utils/constants.js
**/*.test.js
```

## `.champollion/` ディレクトリ

Champollion は、内部状態を管理するためにプロジェクトルートに `.champollion/` ディレクトリを作成します。これはマシン固有のキャッシュであり、プロジェクトのソースではないため、バージョン管理から除外してください。`champollion init` はこの行を `.gitignore` に追加し、ファイルが存在しない場合は新規作成します（まだ git リポジトリになっていないフォルダーでも同様に行われるため、後から `git init` や `git add --all` を実行してもキャッシュがコミットされることはありません）:

```gitignore
.champollion/
```

その隣にあるロックファイル（`.champollion.lock`、`.champollion-content.lock`）はコミットしてください。これらは各翻訳がどのソーステキストから作成されたかを記録しています。

| ファイル | 用途 | コミット要否 |
|------|---------|--------|
| `tm.json` | 翻訳メモリ（Translation Memory）キャッシュ — ソーステキスト + ロケール + 方式をキーとして以前の翻訳を保存 | 不要（ローカルキャッシュ） |
| `xliff/*.xliff` | プロの翻訳者によるレビュー用 XLIFF エクスポートファイル | 不要（一時ファイル） |
| `methods/` | インストール済み方式プラグインのマニフェスト | `.champollion/` 行により無視されます。インストール済みプラグインを共有する場合は、その行を `.champollion/*` と `!.champollion/methods/` に置き換えてください |
| `backups/` | 折り返し前のバックアップ（`wrap --undo` により作成） | 不要（セーフティネット） |

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

| エクスポート | 役割 |
|--------|-------------|
| `TranslationMethod` | すべての方式の基底クラス |
| `LLMMethod` | LLM 方式（OpenRouter）の基底クラス |
| `DirectLLMMethod` | 直接 LLM プロバイダー（OpenAI、Anthropic、Gemini）の基底クラス |
| `OpenAIMethod`、`AnthropicMethod`、`GeminiMethod` | 直接 LLM プロバイダークラス |
| `DeepLMethod`、`MicrosoftTranslatorMethod`、`LibreTranslateMethod`、`TildeMethod`、`TranslatedMethod` | 従来の機械翻訳（MT）クラス |
| `GoogleTranslateMethod` | Google Cloud Translation |
| `LLMCoachedMethod` | コーチング付き LLM（OpenRouter + コーチングデータ） |
| `APIMethod` | リモート API クライアント |
| `runSync`、`runContentSync` | 完全な同期パイプライン |
| `translateWithFallback`、`translateAndValidate` | `sync` が実行する、キーのバッチに対する1ペアのパイプライン: キャッシュ、方式、品質ゲート、キャッシュ、そしてペアのフォールバック。`resolvePairs` からペア、`loadTM` から `tm`、およびプロジェクトディレクトリである `cwd` を渡します。方式はキー、エンドポイント、コーチング、用語集を `process.cwd()` からではなくそこから読み取ります |
| `createFallbackBudget` | フォールバックバッチ用の `--max-cost` ガード（`{ maxCost, committed, cwd }`） |
| `discoverLocaleLayout`、`resolveLocaleFiles` | 各ロケールを構成するファイル群（フラット、ロケールごとのフォルダー、または `localesPattern`） |
| `resolveConfig`、`resolvePairs` | 設定の解決 |
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
