# 統合ガイド

主要なフレームワークでchampollionを設定するためのステップバイステップガイドです。

このページのコマンドは、[CIガイド](/docs/guides/ci-cd)と同様に、0.6系に固定された`npx --yes champollion@0.6 <command>`でchampollionを実行します。これにより、お使いのPCとCIで同じバージョンが実行され、新しいリリースによって実行結果が予期せず変わってしまうことを防げます。プロジェクトローカルへのインストールも可能です。Nodeプロジェクトでは、`npm install --save-dev champollion@0.6`で`package.json`に追加し、`npx champollion sync`でそのコピーを実行します。

---

## APIキーの設定

フレームワークと統合する前に、翻訳APIキーが必要です。Champollionは2つのプロバイダーに対応しています：

### 選択肢A：OpenRouter（推奨）

[OpenRouter](https://openrouter.ai)は、200以上のLLMモデルに対して統一されたAPIを提供します。無料枠も利用可能です。

```bash
# Sign up at https://openrouter.ai, then:
export OPENROUTER_API_KEY=sk-or-v1-...

# Or add to .env.local:
OPENROUTER_API_KEY=sk-or-v1-your-key-here
```

最適な用途：コンテンツ中心のプロジェクト、Markdown翻訳、およびコンテンツを考慮した保護（コードブロック、ショートコード、補間変数）が必要なプロジェクト。

### 選択肢B：Google翻訳

```bash
export GOOGLE_TRANSLATE_API_KEY=...
```

最適な用途：大量のキー・値の文字列ペア（194言語）。Markdownコンテンツには**おすすめしません** — Google翻訳はコードブロック、ショートコード、補間変数を認識しません。

明示的にGoogle翻訳を使用する場合：

```bash
champollion sync --method google-translate
```

> **ヒント**: `GOOGLE_TRANSLATE_API_KEY`のみが設定されている場合（OpenRouterキーがない場合）、champollionは自動的にGoogle翻訳に切り替わります。

---

## Hugo（TOML / YAML / Markdown）

### プロジェクト構造

Hugoは、文字列の翻訳に`i18n/`を、ページコンテンツに`content/`を使用します：

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

### 設定

```bash
npm install --save-dev champollion
```

```bash
# .env.local
OPENROUTER_API_KEY=sk-or-v1-your-key-here
```

`champollion.config.json`を作成します：

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

**フロントマター**: YAML（`---`）とTOML（`+++`）の両方の区切り文字に対応しています。デフォルトで`title`、`description`、`summary`、`subtitle`、`caption`、`linkTitle`を翻訳します。その他のすべてのフィールド（date、draft、tags、weight、slugなど）はそのまま保持されます。設定の`translatableFields`でカスタマイズできます。

**ブロック保護**: コードブロック、Hugoショートコード（`{{< >}}`、`{{% %}}`）、インラインコード、生のHTMLは、Unicodeセンチネルプレースホルダーを使用して自動的に保護されます。これらは変更されずにそのまま通過します。

**ファイル名の命名規則**: Hugoのファイル名による翻訳パターンに従います：
- `my-post.md` → `my-post.fr.md`
- `my-post.en.md` → `my-post.fr.md`（ソースの接尾辞を削除）

**既存ファイルのスキップ**: 既存の翻訳済みファイルが上書きされることはありません。強制的に再翻訳するには、対象ファイルを削除してください。

### 複数形

TOMLおよびYAMLのロケールはCLDRの複数形に対応しています：

```toml
[items]
one = "{{ .Count }} item"
other = "{{ .Count }} items"
```

差分抽出のために内部では`items.one`および`items.other`として表現され、書き込み時に正しいセクション形式に再シリアライズされます。

---

## next-intl (JSON)

### プロジェクト構造

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

### 設定

```bash
npm install --save-dev champollion
```

`npx --yes champollion@0.6 init --yes --langs fr,de,ja,es,ko,zh,pt,ar`を実行します。`messages/en.json`が検出され、空のターゲットファイルが作成され、以下のような設定が書き込まれます。または、自分で`champollion.config.json`を作成することもできます：

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

各ターゲットのレジスター（トーンや丁寧さ）が`languages`に書き込まれるため、確認や編集が可能です。その言語の別のプリセット（`champollion status`で一覧表示）やご自身の言葉に変更できます。プリセットのない言語は`{}`と記述されます。`"languages": ["fr", "de"]`のような単純なリストも機能し、各言語のデフォルトが使用されます。

```bash
npx --yes champollion@0.6 sync
```

`messages/fr.json`、`messages/ja.json`などが作成されます。ネストされたキー構造を保持したまま完全に翻訳され、next-intlが自動的に読み込みます。

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

## react-i18next (JSON)

### 言語ごとのフォルダ（i18nextのデフォルト）

```
public/locales/
├── en/
│   ├── common.json        ← source namespaces
│   └── admin/users.json
├── fr/
└── ja/
```

```bash
npx --yes champollion@0.6 init --yes --langs fr,de,ja
```

`init`を実行すると、`public/locales/en/`（または`locales/en/`）が検出されて設定がその場所を指すようになり、`fr/common.json`や`fr/admin/users.json`などが空のファイルとして作成されます。書き込まれる設定の該当部分は以下のとおりです：

```json
{
  "version": 3,
  "inputLocale": "en",
  "localesDir": "./public/locales",
  "languages": { "fr": "formal-vous", "de": "formal-Sie", "ja": "polite" }
}
```

```bash
npx --yes champollion@0.6 sync
```

各名前空間ファイルが翻訳され、すべての言語のフォルダ内の同じパスに書き込まれます。複数の名前空間に出現する文字列は言語ごとに1回だけ翻訳され、他のファイルは翻訳メモリ（Translation Memory）からそれを取得します。複数形のキー（`key_one`、`key_other`）は、JavaScriptの`Intl.PluralRules` API経由でCLDRから読み取られた各言語固有の形式を受け取ります。ソース言語に欠けていて対象言語で使用される形式は追加され、使用されない形式は除外されます。英語をソースとした場合、スペイン語とフランス語には`key_many`が追加され、ロシア語には`key_few`と`key_many`が追加され、日本語は`key_other`のみを保持します。同期（Sync）は、設定された言語ごとにそれぞれに追加される形式を出力します。[i18nextの複数形キー](/docs/getting-started/configuration#i18next-plurals)および[ロケールファイルのレイアウト](/docs/getting-started/configuration#locale-layouts)をご覧ください。

### 言語ごとに1ファイル

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

ファイルが別のパターンに従っている場合は、`localesPattern`で記述します（`{lang}`は言語、`{ns}`は名前空間です）：

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

### プロジェクト構造

`flutter gen-l10n`は言語ごとに1つの`.arb`ファイルを読み込みます。英語のファイルがテンプレートとなります：

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

### 設定

```bash
npx --yes champollion@0.6 init --yes --langs fr,de,pt_BR
```

`init`は`pubspec.yaml`と`l10n.yaml`（`arb-dir`、`template-arb-file`）を読み取り、テンプレートの名前からソース言語を取得し（`app_en.arb` → `en`）、それぞれの`@@locale`を持つ`app_fr.arb`、`app_de.arb`、`app_pt_BR.arb`を作成します。書き込まれる設定は以下のとおりです：

```json
{
  "version": 3,
  "inputLocale": "en",
  "localesPattern": "lib/l10n/app_{lang}.arb",
  "languages": { "fr": "formal-vous", "de": "formal-Sie", "pt_BR": "professional" }
}
```

`l10n.yaml`で`arb-dir: assets/i18n`と`template-arb-file: intl_en.arb`が設定されている場合、パターンは`"assets/i18n/intl_{lang}.arb"`になります。

```bash
npx --yes champollion@0.6 sync
flutter gen-l10n
```

メッセージのみが翻訳されます。`gen-l10n`は`@@locale`がファイル名と一致しないファイルを拒否するため、各ターゲットにはファイル名の表記通りに自身のロケールが設定された`"@@locale"`が付与されます（`"pt_BR"`）。プレースホルダーやその型などのすべての`@key`メタデータオブジェクトは、`app_en.arb`からそのままコピーされます。キーはテンプレートの順序に従い、まだ翻訳されていないメッセージは除外されるため、Flutterは英語のメッセージにフォールバックします。

テンプレートのメタデータ内の説明（description）は、コンテキストとしてモデルに送信されます：

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

`{count, plural, …}`構文、`{count}`プレースホルダー、およびセレクターは保護されます。これらを変更する翻訳は拒否され、再試行されます（[ICUメッセージ](/docs/getting-started/configuration#icu)を参照）。フランス語では`many`分岐が追加される場合があり、ポーランド語では`few`と`many`が追加される場合があります。`champollion verify`は、すべてのターゲットファイルの`@@locale`とプレースホルダーメタデータもチェックします。以前のツールがそれらを翻訳してしまっていた場合、`champollion sync --pair en:fr --force`がファイルを書き直します。変更のないメッセージはキャッシュから取得され、コストはかかりません。

### Flutter独自の一覧に含まれないロケール {#flutter-locales-outside-flutters-own-list}

アプリのメッセージは`.arb`ファイルから読み込まれます。日付ピッカー、「戻る」、「キャンセル」、テキストの記述方向といったFlutter独自のウィジェット内のテキストは`flutter_localizations`（`GlobalMaterialLocalizations`、`GlobalCupertinoLocalizations`）から読み込まれ、これには固定の言語一覧（[Flutterの一覧](https://api.flutter.dev/flutter/flutter_localizations/GlobalMaterialLocalizations-class.html)）が用意されています。`qaa`のような私用領域コードや、大半のリソースの少ない言語はこの一覧に含まれていません。デリゲートがそのテキストを提供しない限り、`supportedLocales`にそのようなロケールがあると、アプリは実行時に失敗します（「No MaterialLocalizations found」）。`init`、および新しい`.arb`ファイルを作成する同期処理は、マシン上のFlutter SDK（`FLUTTER_ROOT`、または`PATH`上の`flutter`）から読み取って、一覧に含まれていない各ターゲットについてその旨を通知します。SDKがない場合は、確認できなかったターゲットを通知します。

最も小さな修正方法は、それらのウィジェットにFlutterがカバーしている言語（ここでは英語）のテキストを流用することです：

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

Flutter独自のデリゲートの後にこれを指定します：

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

これにより、アプリ自体のテキストはお使いの言語で表示されつつ、ウィジェットには英語のラベルが表示されるようになります。ウィジェットのテキストも翻訳したい場合、Flutterのガイドに新しい言語向けの完全な`MaterialLocalizations`の作成方法が説明されています：[新しい言語のサポートを追加する](https://docs.flutter.dev/ui/accessibility-and-internationalization/internationalization#adding-support-for-a-new-language)。

---

## Djangoとgettext（.po）

champollion CLIは、[PolyForm Noncommercial License 1.0.0](https://github.com/gamedaysuits/Champollion/blob/main/cli/LICENSE)のもとでソースコードが利用可能（source-available）です。非営利目的であれば、自由に使用、変更、共有できます。営利目的での使用はこのライセンスの対象外です（[利用対象者について](/docs/getting-started/who-may-use-this)）。

### プロジェクト構造

```
my_site/
├── manage.py
└── locale/
    ├── en/LC_MESSAGES/django.po    ← source catalog (makemessages -l en)
    ├── fr/LC_MESSAGES/django.po
    └── ru/LC_MESSAGES/django.po
```

### 設定：LOCALE_PATHSとLANGUAGES {#django-locale-paths}

Djangoは、`LOCALE_PATHS`にリストされたフォルダと、インストールされた各アプリの`locale/`フォルダからカタログを探します。`manage.py`の隣にある`locale/`はどのアプリにも属さないため、`LOCALE_PATHS`で指定するまでは、`compilemessages`が`.mo`ファイルをビルドしても、サイトには未翻訳のテキストが表示され続けます。`LANGUAGES`はサイトが提供する言語の一覧です。Djangoのデフォルトには同梱されているすべての言語が含まれているため、ご自身の言語をリストしてください：

```python title="settings.py"
LOCALE_PATHS = [BASE_DIR / "locale"]   # BASE_DIR: the folder with manage.py (startproject defines it)
LANGUAGES = [("en", "English"), ("fr", "Français"), ("ru", "Русский")]
```

### 設定

まずDjangoを使ってカタログを作成または更新します。英語のカタログがソースになります。空の`msgstr`は「msgidがそのままテキストである」ことを意味します：

```bash
django-admin makemessages -l en -l fr -l ru
npx --yes champollion@0.6 init --yes --langs fr,ru
```

`init`が`manage.py`と`locale/en/LC_MESSAGES/django.po`を検出し、次のように書き込みます：

```json
{
  "version": 3,
  "inputLocale": "en",
  "localesPattern": "locale/{lang}/LC_MESSAGES/{ns}.po",
  "languages": { "fr": "formal-vous", "ru": "formal-vy" }
}
```

`{ns}`はgettextのドメインであるため、`django.po`と`djangojs.po`の両方が同期されます。

**デフォルトではトーンとジェンダースタイルが設定されており、`init`は両方を出力します。** `formal-vous`はモデルに対して「Formal French. Use vous-form (vouvoiement) consistently. Professional, academic register.（フォーマルなフランス語。一貫してvous形を使用。プロフェッショナルで学術的なトーン。）」を要求します。フランス語のジェンダー指針では、読者の性別が不明な場合に中黒（・）を用いた*écriture inclusive*（包括的表記）を求めます（`Connecté·e`、`Utilisateur·rice·s`）。ロシア語（`formal-vy`）では慣例的なデフォルトである男性形を使用します。それ以外のスタイルを希望するサイト（例えば診療所の患者向けページなど）は、`champollion.config.json`で変更します。レジスターは`languages`（`"fr": "casual-tu"`、またはご自身の言葉）、そして`genderGuidance`は、指示なしの場合は`false`、または`"Use the masculine generic."`のようなご自身の指示を指定します（[ジェンダーの指針](/docs/getting-started/configuration#gender-guidance)を参照）。設定を変更すると専用のキャッシュエントリが作成されるため、`sync --redo all`は以前の設定で書き込まれた内容を再翻訳します。

**翻訳方法と必要なキー。** `--method`を指定しない場合、`init`はデフォルトの`llm`を設定します。これは[OpenRouter](https://openrouter.ai)上のモデルであり、環境変数または`manage.py`と同じ場所にある`.env`ファイル内に`OPENROUTER_API_KEY`が必要です（不足している場合、`init`が設定すべき行を出力します）。モデルサーバー（Ollama、LM Studio、vLLM）を実行しているマシン上では、`npx --yes champollion@0.6 init --yes --langs fr,ru --method local --model llama3.1`はキーを必要とせず、データがマシンの外に出ることもありません。CIランナーにはモデルサーバーがないため、CIの実行時にはホスト型モデルを指定します（[CIガイド](/docs/guides/ci-cd)を参照）。各方法と必要なキーの一覧については、[翻訳方法](/docs/guides/translation-methods)をご覧ください。

次に：

```bash
npx --yes champollion@0.6 sync
django-admin compilemessages
```

同期（Sync）は、空の`msgstr`を持つすべてのエントリとすべての`fuzzy`エントリを翻訳し、`fuzzy`フラグを削除します。翻訳済みのエントリは、コメントも含めてバイト単位でそのまま保持されます。`msgctxt`を持つエントリは個別のキーおよびキャッシュエントリとなるため、動詞の「Open」と形容詞の「Open」は別々に翻訳されます。`#.`コメントとコンテキストはモデルに送信されます — リクエストを実際に送信せずに内容を確認するには、`npx --yes champollion@0.6 sync --dry --show-prompt 'verb␄Open'`を実行します（コンテキストとコメントは「UI context for these keys」の下に表示されます）。

**特定のエントリを意図して再翻訳する。** msgidで指定します：

```bash
npx --yes champollion@0.6 sync --pair en:fr --redo 'keys:Welcome back\, %(name)s!'
```

キャッシュにすでにそのテキストが保持されている場合、これは翻訳メモリから提供されるため、追加コストなしで同じ翻訳が返され、同期処理は`--fresh`コマンドとともにその旨を表示します。このような再実行にはモデルは不要です。`local`を使用していてモデルサーバーが停止している場合でも、同期処理はサーバーが応答しないことと、今回の実行にはサーバーが不要であることを警告し、そのまま続行します（何かを送信する必要がある再実行は、サーバー名を挙げて停止します）。新しい翻訳を実行して費用を支払うには、`--fresh`を追加します。msgid内のカンマは`\,`と記述し、クォートによってシェルが後続を誤認するのを防ぎます。コンテキストを持つエントリは、レポートに出力されるとおりに`verb␄Open`と指定します。`␄`が入力できない場合は、代わりに`\x04`と記述します：`--redo 'keys:verb\x04Open'`。どちらの表記も機能し、修復コマンドには両方が表示されます。特定のドメインのみのエントリを指定するには、ドメインを接頭辞として付与します：`django::Welcome`。どの一意のエントリにも一致しない名前を指定すると、実行は失敗し（終了コード1）、最も近いエントリ（例えばmsgid `Cancel`のすべてのコンテキスト：`button␄Cancel`、`status␄Cancel`など）が一覧表示されます。完了した再実行として誤ってパスすることはありません。

champollionが作成するカタログ（`init --langs`、またはカタログがまだない言語の同期）には、標準のgettextヘッダー（`msginit`が書き込むフィールド）が設定されるため、`msgfmt -c`に受け入れられます。既存のカタログのヘッダーが書き直されることはありません。

**`makemessages`が初期化したカタログに対する`msgfmt -c`のヘッダー警告。** `makemessages`はgettextのテンプレートヘッダー（`Project-Id-Version: PACKAGE VERSION`、`PO-Revision-Date: YEAR-MO-DA HO:MI+ZONE`、`Last-Translator: FULL NAME <EMAIL@ADDRESS>`、`Language-Team: LANGUAGE <LL@li.org>`、および`#, fuzzy`とマークされたもの）を書き込みます。そのため、コンパイルのたびに`msgfmt -c`が各フィールドに「still has the initial default value（初期デフォルト値のままです）」という警告を出します。同期処理はそれらの値を変更しません（既存のヘッダーではプレースホルダーの`Plural-Forms`またはcharsetのみを補完します）。そのため、各カタログで一度手動で修正してください：プロジェクト名とバージョン、日付、翻訳者（または`Automatically generated`）、チーム（または`none`）。また、ヘッダーが未確認であることを示す`msgid ""`の上の`#, fuzzy`行も削除してください。`makemessages`は入力された値を保持します。`compilemessages`（`msgfmt --check-format`）はヘッダーをチェックしないため、これらの警告によって失敗することはありません。

**複数形。** `msgid` + `msgid_plural`は1つのメッセージとなり、モデルはその言語が必要とするすべての形式を含めて翻訳します。各形式は、カタログの`Plural-Forms`ヘッダーに従って`msgstr[0]`、`msgstr[1]`、…に書き込まれます。Djangoがこれを自動的に書き込みます。ヘッダーがないカタログには、その言語に対して`msginit`が書き込むヘッダー（フランス語の場合は`nplurals=2; plural=(n > 1);`）、または`msginit`に記載されていない言語の場合はCLDRから導出されたヘッダーが設定されます：

```po
msgid "One file"
msgid_plural "%(count)d files"
msgstr[0] "%(count)d файл"
msgstr[1] "%(count)d файла"
msgstr[2] "%(count)d файлов"
```

通常のカウントで言語が使用する形式（ロシア語の`few`や`many`など）が翻訳から抜け落ちている場合、同期処理はモデルに再度要求します。それでも回答に不足している場合、同期処理はその代わりに`other`形式を書き込み、エントリに`# champollion:`コメントで印を付け、再要求コマンド（`--redo 'keys:django::One file' --fresh`）を指定します。保留されたキーと同様に、マークされたエントリがカタログにある限り、それを書き込んだ同期処理だけでなく、すべての同期処理が`2`で終了します。最後の検証行には、`[OK]`ではなく、実行が不完全であることが表示されます。手作業で形式を記述してコメント行を削除するか、より強力な`--model`で再要求してください。別の方法やモデル（ローカルモデル実行後のCIのホスト型モデルなど）で同期を行うと、そのエントリが自動的に再要求され、`sync --redo gaps`はマークされたすべてのエントリを再要求します。その回答でも形式が不足している場合、エントリはマークされたままになります。CIでは、コミット後にジョブが失敗します（[CIガイド](/docs/guides/ci-cd#plural-gaps)を参照）。

**その他のgettextレイアウト。**

| プロジェクト | 設定 | ソース |
|---------|--------|--------|
| GNU（`po/fr.po`） | `"localesDir": "./po", "format": "po"` | `po/en.po`、または`po/`内の1つの`.pot` |
| Babel / Flask | `"localesPattern": "translations/{lang}/LC_MESSAGES/messages.po"` | `translations/en/…/messages.po`、または`translations/`もしくはその上のフォルダ内の`messages.pot` |

`printf`プレースホルダー（`%s`、`%(name)s`、`%d`）は翻訳後も維持される必要があり、品質ゲートはこれらが欠落した値を拒否します。それでも、リリース前には`msgfmt --check-format`を実行してください（`compilemessages`が実行します）。これはプレースホルダーの型もチェックしますが、`#, python-format`フラグが付いたエントリのみが対象です。`makemessages`は`%`プレースホルダーを持つ抽出エントリにフラグを追加しますが、手動で作成されたカタログにはフラグがない場合があり、それらのエントリはチェックされません。`champollion verify`はフラグに関係なく各エントリのprintfプレースホルダー（名前と型文字）を比較し、同期処理は翻訳する各エントリにソースエントリのフラグを保持します。カタログはUTF-8である必要があります。すべてのルールについては、[gettextカタログ](/docs/getting-started/configuration#gettext)を参照してください。
