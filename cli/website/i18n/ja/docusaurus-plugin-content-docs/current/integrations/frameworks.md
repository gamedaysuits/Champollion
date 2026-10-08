# インテグレーションガイド

人気のフレームワークと champollion を連携するためのステップバイステップのセットアップ手順です。

このページのコマンドは、`npx --yes champollion@0.5 <command>` を指定して champollion を実行します。[CI ガイド](/docs/guides/ci-cd)と同様に 0.5 系列に固定することで、手元のマシンと CI で同じバージョンが実行され、新しいリリースによって不意に動作が変わるのを防ぎます。プロジェクトローカルへのインストールも代替手段として利用できます。Node プロジェクトでは、`npm install --save-dev champollion@0.5` で `package.json` に追加し、`npx champollion sync` でそのローカルコピーを実行します。

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

最適な用途：大量のキー・値の文字列ペア（194言語）。Markdownコンテンツには**推奨されません** — Google Translateはコードブロック、ショートコード、埋め込み変数を認識しません。

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

`npx --yes champollion@0.5 init --yes --langs fr,de,ja,es,ko,zh,pt,ar` を実行します。`messages/en.json` が検出され、空のターゲットファイルが作成され、以下のような設定が書き込まれます。または、手動で `champollion.config.json` を作成することもできます:

```json
{
  "version": 3,
  "inputLocale": "en",
  "localesDir": "./messages",
  "languages": {
    "fr": "formal-vous", "de": "formal-Sie", "ja": "polite", "es": "neutral-latam",
    "ko": "polite-haeyo", "zh": {}, "pt": "professional", "ar": {}
  }
}
```

各ターゲットのレジスター（トーンや丁寧さ）は `languages` に書き込まれるため、確認や編集が可能です。その言語の別のプリセット（`champollion status` に一覧表示されます）や独自の表現に変更できます。プリセットのない言語は `{}` として記述されます。単純なリスト形式（`"languages": ["fr", "de"]`）も使用でき、その場合は各言語のデフォルトが適用されます。

```bash
npx --yes champollion@0.5 sync
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

### 言語ごとのフォルダ（i18next のデフォルト）

```
public/locales/
├── en/
│   ├── common.json        ← source namespaces
│   └── admin/users.json
├── fr/
└── ja/
```

```bash
npx --yes champollion@0.5 init --yes --langs fr,de,ja
```

`init` は `public/locales/en/`（または `locales/en/`）を検出し、設定でそれを参照するように指定した上で、`fr/common.json`、`fr/admin/users.json` などの空ファイルを作成します。書き出される設定の該当部分は次のとおりです。

```json
{
  "version": 3,
  "inputLocale": "en",
  "localesDir": "./public/locales",
  "languages": { "fr": "formal-vous", "de": "formal-Sie", "ja": "polite" }
}
```

```bash
npx --yes champollion@0.5 sync
```

各ネームスペースファイルは翻訳され、各言語のフォルダ内の同じパスに書き込まれます。複数のネームスペースに出現する文字列は、言語ごとに一度だけ翻訳され、他のファイルには翻訳メモリから取得されます。複数形のキー（`key_one`、`key_other`）は、JavaScript の `Intl.PluralRules` API を介して CLDR から読み取られた、各言語固有の形式を受け取ります。ソース言語にはないがターゲット言語で使用される形式が追加され、使用されない形式は除外されます。英語をソースとする場合、スペイン語とフランス語には `key_many` が追加され、ロシア語には `key_few` と `key_many` が追加され、日本語には `key_other` のみが残ります。同期時には、設定された各言語について追加された形式が表示されます。[i18next の複数形キー](/docs/getting-started/configuration#i18next-plurals)および[ロケールファイルのレイアウト](/docs/getting-started/configuration#locale-layouts)を参照してください。

### 言語ごとに1つのファイル

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

### その他のレイアウト

ファイルが別のパターンに従っている場合は、`localesPattern` を使用して記述してください（`{lang}` は言語、`{ns}` はネームスペースです）。

```json
{
  "version": 3,
  "inputLocale": "en",
  "localesPattern": "src/i18n/{ns}/{lang}.json",
  "languages": ["fr", "de", "ja"]
}
```

---

## Flutter (ARB)

### プロジェクト構成

`flutter gen-l10n` は言語ごとに1つの `.arb` ファイルを読み込みます。英語のファイルがテンプレートとなります:

```
my_app/
├── l10n.yaml              ← optional: arb-dir, template-arb-file
├── lib/
│   └── l10n/
│       ├── app_en.arb     ← source of truth (template)
│       ├── app_fr.arb
│       └── app_pt_BR.arb
└── pubspec.yaml           ← flutter: generate: true
```

### セットアップ

```bash
npx --yes champollion@0.5 init --yes --langs fr,de,pt_BR
```

`init` は `pubspec.yaml` と `l10n.yaml`（`arb-dir`、`template-arb-file`）を読み取り、テンプレートの名前からソース言語を取得し（`app_en.arb` → `en`）、それぞれの `@@locale` を持つ `app_fr.arb`、`app_de.arb`、`app_pt_BR.arb` を作成します。書き込まれる設定は以下のとおりです:

```json
{
  "version": 3,
  "inputLocale": "en",
  "localesPattern": "lib/l10n/app_{lang}.arb",
  "languages": { "fr": "formal-vous", "de": "formal-Sie", "pt_BR": "professional" }
}
```

`l10n.yaml` で `arb-dir: assets/i18n` と `template-arb-file: intl_en.arb` が設定されている場合、パターンは `"assets/i18n/intl_{lang}.arb"` になります。

```bash
npx --yes champollion@0.5 sync
flutter gen-l10n
```

メッセージのみが翻訳されます。各ターゲットファイルには、ファイル名の表記に合わせて自身のロケールが `"@@locale"` に設定されます（`"pt_BR"`）。これは、`gen-l10n` がファイル名と一致しない `@@locale` を持つファイルを拒否するためです。プレースホルダーやその型などのすべての `@key` メタデータオブジェクトは、変更されることなく `app_en.arb` からコピーされます。キーはテンプレートの順序に従い、まだ翻訳されていないメッセージは除外されるため、Flutter は英語のメッセージにフォールバックします。

テンプレートのメタデータに含まれる説明文は、コンテキストとしてモデルに送信されます:

```json title="lib/l10n/app_en.arb"
{
  "@@locale": "en",
  "itemCount": "{count, plural, =0{No items} one{1 item} other{{count} items}}",
  "@itemCount": {
    "description": "Badge on the cart icon",
    "placeholders": { "count": { "type": "int" } }
  }
}
```

`{count, plural, …}` 構文、`{count}` プレースホルダー、およびセレクターは保護されます。これらを変更する翻訳は拒否され、再試行されます（[ICU メッセージ](/docs/getting-started/configuration#icu)を参照）。フランス語では `many` 分岐が、ポーランド語では `few` と `many` が追加される場合があります。`champollion verify` は、すべてのターゲットファイルの `@@locale` やプレースホルダーメタデータもチェックします。以前のツールによってこれらが翻訳されてしまっていた場合、`champollion sync --pair en:fr --force` がファイルを書き直します。変更のないメッセージはキャッシュから取得されるため、コストはかかりません。

### Flutter 独自のリストに含まれないロケール {#flutter-locales-outside-flutters-own-list}

アプリケーションのメッセージは `.arb` ファイルから取得されます。一方、Flutter 自体のウィジェット内のテキスト（日付ピッカー、「Back」、「Cancel」、テキストの書字方向など）は `flutter_localizations`（`GlobalMaterialLocalizations`、`GlobalCupertinoLocalizations`）から取得されますが、これは固定された言語リスト（[Flutter のリスト](https://api.flutter.dev/flutter/flutter_localizations/GlobalMaterialLocalizations-class.html)）のみをカバーしています。`qaa` のようなプライベートユースコードや、多くの低リソース言語はそこに含まれていません。そうしたロケールが `supportedLocales` に指定されている場合、デリゲートがそのテキストを提供しない限り、アプリは実行時に失敗します（"No MaterialLocalizations found"）。`init`、および新しい `.arb` ファイルを作成する同期処理では、リスト外の各ターゲットについてその旨を通知します。これらはマシンの Flutter SDK（`FLUTTER_ROOT`、または `PATH` の `flutter`）からリストを読み取ります。SDK がない場合は、確認できなかったターゲットを通知します。

最も手軽な修正方法は、これらのウィジェットに Flutter がサポートしている言語（ここでは英語）のテキストを適用することです:

```dart title="lib/fallback_localizations.dart"
import 'package:flutter/widgets.dart';

/// Flutter's own widget text for the app's locales flutter_localizations
/// does not cover, borrowed from a locale it does cover.
class FallbackLocalizationsDelegate<T> extends LocalizationsDelegate<T> {
  const FallbackLocalizationsDelegate(this.covered, this.languages);

  final LocalizationsDelegate<T> covered; // e.g. GlobalMaterialLocalizations.delegate
  final Set<String> languages;            // your codes outside Flutter's list

  @override
  bool isSupported(Locale locale) => languages.contains(locale.languageCode);

  @override
  Future<T> load(Locale locale) => covered.load(const Locale('en'));

  @override
  bool shouldReload(FallbackLocalizationsDelegate<T> old) => false;
}
```

Flutter 独自のデリゲートの後に記述します:

```dart
MaterialApp(
  localizationsDelegates: const [
    AppLocalizations.delegate,
    GlobalMaterialLocalizations.delegate,
    GlobalWidgetsLocalizations.delegate,
    GlobalCupertinoLocalizations.delegate,
    FallbackLocalizationsDelegate<MaterialLocalizations>(GlobalMaterialLocalizations.delegate, {'qaa'}),
    FallbackLocalizationsDelegate<CupertinoLocalizations>(GlobalCupertinoLocalizations.delegate, {'qaa'}),
  ],
  supportedLocales: AppLocalizations.supportedLocales,
  // …
)
```

これにより、アプリ独自のテキストは目的の言語で表示されつつ、ウィジェットには英語のラベルが表示されるようになります。ウィジェットのテキストも翻訳したい場合、Flutter のガイドで新しい言語向けの完全な `MaterialLocalizations` の実装方法が説明されています: [新しい言語のサポートを追加する](https://docs.flutter.dev/ui/accessibility-and-internationalization/internationalization#adding-support-for-a-new-language)。

---

## Django と gettext (.po)

champollion CLI は [PolyForm Noncommercial License 1.0.0](https://github.com/gamedaysuits/Champollion/blob/main/cli/LICENSE) の下でソース公開されています。非商用目的であれば自由に使用、改変、共有できます。商用目的での使用はこのライセンスの対象外です（[利用対象者について](/docs/getting-started/who-may-use-this)）。

### プロジェクト構成

```
my_site/
├── manage.py
└── locale/
    ├── en/LC_MESSAGES/django.po    ← source catalog (makemessages -l en)
    ├── fr/LC_MESSAGES/django.po
    └── ru/LC_MESSAGES/django.po
```

### 設定: LOCALE_PATHS と LANGUAGES {#django-locale-paths}

Django は、`LOCALE_PATHS` にリストされたフォルダおよびインストールされている各アプリの `locale/` フォルダ内からカタログを検索します。`manage.py` の隣にある `locale/` はどのアプリにも属さないため、`LOCALE_PATHS` に指定されるまで、`compilemessages` は `.mo` ファイルをビルドするものの、サイトでは未翻訳のテキストが表示され続けます。`LANGUAGES` はサイトが提供する言語のリストです。Django のデフォルトは同梱されているすべての言語になっているため、必要な言語のみをリストします:

```python title="settings.py"
LOCALE_PATHS = [BASE_DIR / "locale"]   # BASE_DIR: the folder with manage.py (startproject defines it)
LANGUAGES = [("en", "English"), ("fr", "Français"), ("ru", "Русский")]
```

### セットアップ

まず Django でカタログを作成または更新します。英語のカタログがソースとなります。空の `msgstr` は「msgid がそのままテキストである」ことを意味します:

```bash
django-admin makemessages -l en -l fr -l ru
npx --yes champollion@0.5 init --yes --langs fr,ru
```

`init` は `manage.py` と `locale/en/LC_MESSAGES/django.po` を検出し、以下を書き込みます:

```json
{
  "version": 3,
  "inputLocale": "en",
  "localesPattern": "locale/{lang}/LC_MESSAGES/{ns}.po",
  "languages": { "fr": "formal-vous", "ru": "formal-vy" }
}
```

`{ns}` は gettext のドメインであるため、`django.po` と `djangojs.po` の両方が同期されます。

**デフォルト設定にはトーンとジェンダースタイルが含まれており、`init` はその両方を出力します。** `formal-vous` はモデルに「Formal French. Use vous-form (vouvoiement) consistently. Professional, academic register.」を要求します。フランス語のジェンダーガイドラインでは、読み手のジェンダーが不明な場合に中黒を用いた *écriture inclusive*（包括的記法）を要求します（`Connecté·e`、`Utilisateur·rice·s`）。ロシア語（`formal-vy`）では慣習的なデフォルトである男性形を使用します。別のスタイルを希望するサイト（例えば診療所の患者向けページなど）は、`champollion.config.json` で変更できます。レジスター（言葉遣い・文体）は `languages`（`"fr": "casual-tu"`、または独自の表現）で、`genderGuidance` は指示なしの場合は `false`、または `"Use the masculine generic."` などの独自指示で設定します（[ジェンダーガイダンス](/docs/getting-started/configuration#gender-guidance)）。設定を変更するとキャッシュエントリが別個に作成されるため、`sync --redo all` によって以前の設定で作成された内容が再翻訳されます。

**翻訳方法と必要な API キー。** `--method` を指定しない場合、`init` はデフォルトの `llm` をセットアップします。[OpenRouter](https://openrouter.ai) 上のモデルを使用し、環境変数または `manage.py` と同じ階層の `.env` ファイル内に `OPENROUTER_API_KEY` が必要です（見つからない場合、`init` に設定すべき行が表示されます）。モデルサーバー（Ollama、LM Studio、vLLM）を実行しているマシン上では、`npx --yes champollion@0.5 init --yes --langs fr,ru --method local --model llama3.1` はキーを必要とせず、データがマシンの外に出ることもありません。CI ランナーにはモデルサーバーがないため、CI の実行にはホスト型モデルを指定します（[CI ガイド](/docs/guides/ci-cd)を参照）。各方法と必要なキーの一覧は [翻訳方法](/docs/guides/translation-methods) を参照してください。

その後、次を実行します:

```bash
npx --yes champollion@0.5 sync
django-admin compilemessages
```

同期を実行すると、空の `msgstr` を持つすべてのエントリとすべての `fuzzy` エントリが翻訳され、`fuzzy` フラグが削除されます。すでに翻訳済みのエントリは、コメントを含めてバイト単位でそのまま保持されます。`msgctxt` を持つエントリは独立したキーおよびキャッシュエントリとなるため、動詞の「Open」と形容詞の「Open」は別々に翻訳されます。`#.` コメントとコンテキストはモデルに送信されます。実際に送信せずにリクエスト内容を正確に確認するには、`npx --yes champollion@0.5 sync --dry --show-prompt 'verb␄Open'` を実行します（コンテキストとコメントは「UI context for these keys」の下に表示されます）。

**特定のエントリを意図して再翻訳する。** msgid で指定します:

```bash
npx --yes champollion@0.5 sync --pair en:fr --redo 'keys:Welcome back\, %(name)s!'
```

キャッシュにすでにそのテキストが存在する場合、これは翻訳メモリから提供されるため、コストをかけずに同じ翻訳が返され、sync は `--fresh` コマンドでその旨を伝えます。このようなやり直しにはモデルは不要です。`local` を指定しモデルサーバーが停止している場合でも、sync はサーバーが応答しないこと、および今回の実行にはサーバーが不要であることを警告した上で処理を続行します（何かを送信する必要があるやり直しは、サーバー名を挙げて停止します）。新しい翻訳を生成するには、`--fresh` を追加します。msgid 内のカンマは `\,` と記述し、クォートによってシェルが残りの部分を解釈しないようにします。コンテキストを持つエントリは、レポートに出力されるとおり `verb␄Open` と指定します。`␄` を入力できない場合は、代わりに `\x04` と記述します: `--redo 'keys:verb\x04Open'`。どちらの表記も機能し、修復コマンドには両方が表示されます。特定のドメインのエントリのみを指定するには、ドメインを接頭辞として付加します: `django::Welcome`。どのエントリにも一致しない名前を指定すると、実行は失敗し（exit 1）、最も近いエントリ（例えば msgid `Cancel` のすべてのコンテキスト: `button␄Cancel`、`status␄Cancel`）がリスト表示されます。完了したやり直しとして処理されることは決してありません。

champollion が作成するカタログ（`init --langs`、またはまだカタログが存在しない言語の sync）には、`msginit` が書き込む標準の gettext ヘッダーフィールドが付与されるため、`msgfmt -c` で受け入れられます。既存のカタログのヘッダーが書き換えられることはありません。

**`makemessages` が作成したカタログでの `msgfmt -c` ヘッダー警告。** `makemessages` は gettext のテンプレートヘッダー（`Project-Id-Version: PACKAGE VERSION`、`PO-Revision-Date: YEAR-MO-DA HO:MI+ZONE`、`Last-Translator: FULL NAME <EMAIL@ADDRESS>`、`Language-Team: LANGUAGE <LL@li.org>`、`#, fuzzy` フラグ付き）を書き込みます。そのため、コンパイルのたびに `msgfmt -c` が各フィールドについて「still has the initial default value（初期デフォルト値のままです）」と警告します。Sync はこれらの値を変更しないため（既存のヘッダーではプレースホルダー `Plural-Forms` や charset のみを埋めます）、各カタログで一度手動で修正してください: プロジェクト名とバージョン、日付、翻訳者（または `Automatically generated`）、チーム（または `none`）。また、ヘッダーが未レビューであることを示す `msgid ""` の上の `#, fuzzy` 行も削除してください。`makemessages` は記入した値を保持します。`compilemessages`（`msgfmt --check-format`）はヘッダーをチェックしないため、これらの警告によって失敗することはありません。

**複数形。** `msgid` + `msgid_plural` は1つのメッセージとなり、その言語が必要とするすべての形式を含めてモデルが翻訳します。各形式は、カタログの `Plural-Forms` ヘッダーに従って `msgstr[0]`、`msgstr[1]`、… に書き込まれます。Django はこれを自動的に書き込みます。ヘッダーがないカタログには、その言語用に `msginit` が書き込むヘッダー（フランス語なら `nplurals=2; plural=(n > 1);`）、または `msginit` のリストにない言語の場合は CLDR から導出されたヘッダーが付与されます:

```po
msgid "One file"
msgid_plural "%(count)d files"
msgstr[0] "%(count)d файл"
msgstr[1] "%(count)d файла"
msgstr[2] "%(count)d файлов"
```

翻訳において、その言語が通常のカウントで使用する形式（ロシア語の `few` や `many` など）が欠落している場合、sync はモデルに再要求します。それでも回答に欠落がある場合、sync はその場所に `other` 形式を書き込み、エントリに `# champollion:` コメントを付けてマークし、再要求コマンド（`--redo 'keys:django::One file' --fresh`）でそのエントリ名を通知します。カタログ内にマークされたエントリが存在する限り、保留されたキーと同様に、それを書き込んだ sync だけでなく、後続のすべての sync が `2` で終了します。終了時の検証行には `[OK]` の代わりに実行が不完全であることが示されます。該当の形式を手動で記述してコメント行を削除するか、より強力な `--model` で再要求してください。別の方法やモデルでの同期（ローカルモデル実行後の CI のホスト型モデルなど）は、そのエントリを自動的に再要求し、`sync --redo gaps` はマークされたすべてのエントリを再要求します。その回答でも形式が不足している場合、エントリはマークされたままになります。CI では、コミット後にジョブが失敗します（[CI ガイド](/docs/guides/ci-cd#plural-gaps)を参照）。

**その他の gettext レイアウト。**

| プロジェクト | 設定 | ソース |
|---------|--------|--------|
| GNU (`po/fr.po`) | `"localesDir": "./po", "format": "po"` | `po/en.po`、または `po/` 内の1つの `.pot` |
| Babel / Flask | `"localesPattern": "translations/{lang}/LC_MESSAGES/messages.po"` | `translations/en/…/messages.po`、または `translations/` かその親フォルダ内の `messages.pot` |

`printf` プレースホルダー（`%s`、`%(name)s`、`%d`）は翻訳後も維持される必要があり、品質ゲートはプレースホルダーが欠落した値を拒否します。リリース前には必ず `msgfmt --check-format` を実行してください（`compilemessages` が行います）。これはプレースホルダーの型もチェックしますが、`#, python-format` フラグが付いたエントリのみが対象となります。`makemessages` は `%` プレースホルダーを含む抽出エントリにフラグを追加しますが、手動で作成されたカタログにはフラグがない場合があり、それらのエントリはチェックされません。`champollion verify` はフラグの有無にかかわらず、すべてのエントリの printf プレースホルダー（名前と型の文字）を比較し、sync は翻訳する各エントリにソースエントリのフラグを維持します。カタログは UTF-8 である必要があります。完全なルールについては [gettext カタログ](/docs/getting-started/configuration#gettext) を参照してください。
