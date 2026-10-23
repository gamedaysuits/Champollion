# Mga Gabay sa Integrasyon

Hakbang-hakbang na pag-setup para sa champollion kasama ang mga sikat na framework.

Pinapatakbo ng mga command sa pahinang ito ang champollion gamit ang `npx --yes champollion@0.6 <command>`: naka-pin sa linyang 0.6, tulad ng nasa [gabay sa CI](/docs/guides/ci-cd), upang ang inyong laptop at ang inyong CI ay magpatakbo ng parehong bersyon at ang isang bagong release ay hindi kailanman magbago ng pagpapatakbo nang hindi inaasahan. Ang lokal na pag-install sa proyekto ang alternatibo. Sa isang proyektong Node, idinaragdag ito ng `npm install --save-dev champollion@0.6` sa `package.json`, at pinapatakbo naman ng `npx champollion sync` ang kopyang iyon.

---

## Pag-setup ng API Key

Bago mag-integrate sa anumang framework, kailangan ninyo ng translation API key. Sinusuportahan ng Champollion ang dalawang provider:

### Opsyon A: OpenRouter (inirerekomenda)

Nagbibigay ang [OpenRouter](https://openrouter.ai) ng pinag-isang API para sa 200+ modelong LLM. May available na libreng tier.

```bash
# Sign up at https://openrouter.ai, then:
export OPENROUTER_API_KEY=sk-or-v1-...

# Or add to .env.local:
OPENROUTER_API_KEY=sk-or-v1-your-key-here
```

Pinakamainam para sa: mga proyektong maraming nilalaman, pagsasalin ng Markdown, at mga proyektong nangangailangan ng content-aware na proteksyon (mga code block, shortcode, interpolation variable).

### Opsyon B: Google Translate

```bash
export GOOGLE_TRANSLATE_API_KEY=...
```

Pinakamainam para sa: bultuhang pares ng key-value string (194 na wika). **Hindi inirerekomenda** para sa nilalamang Markdown — walang kamalayan ang Google Translate sa mga code block, shortcode, o interpolation variable.

Upang tahasang gamitin ang Google Translate:

```bash
champollion sync --method google-translate
```

> **Tip**: Kung `GOOGLE_TRANSLATE_API_KEY` lamang ang nakatakda (walang OpenRouter key), awtomatikong lumilipat ang champollion sa Google Translate.

---

## Hugo (TOML / YAML / Markdown)

### Estruktura ng proyekto

Gumagamit ang Hugo ng `i18n/` para sa mga pagsasalin ng string at `content/` para sa nilalaman ng pahina:

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

### Pag-setup

```bash
npm install --save-dev champollion
```

```bash
# .env.local
OPENROUTER_API_KEY=sk-or-v1-your-key-here
```

Likhain ang `champollion.config.json`:

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

### Mga detalye ng pagsasalin ng nilalaman

**Front matter**: Sumusuporta sa parehong delimiter ng YAML (`---`) at TOML (`+++`). Nagsasalin ng `title`, `description`, `summary`, `subtitle`, `caption`, at `linkTitle` bilang default. Napananatili ang lahat ng iba pang field (date, draft, tags, weight, slug, atbp.). I-customize gamit ang `translatableFields` sa inyong config.

**Proteksyon sa block**: Awtomatikong pinoprotektahan ang mga code block, Hugo shortcode (`{{< >}}`, `{{% %}}`), inline code, at hilaw na HTML gamit ang mga Unicode sentinel placeholder. Dumadaan ang mga ito nang hindi nagagalaw.

**Kumbensiyon sa pangalan ng file**: Sumusunod sa pattern ng translation-by-filename ng Hugo:
- `my-post.md` → `my-post.fr.md`
- `my-post.en.md` → `my-post.fr.md` (inaalis ang suffix ng pinagmulan)

**Laktawan ang umiiral**: Hindi kailanman ino-overwrite ang mga umiiral nang naisaling file. Burahin ang isang target na file upang puwersahin ang muling pagsasalin.

### Mga anyong maramihan (plural)

Sumusuporta ang mga TOML at YAML locale sa mga anyong maramihan ng CLDR:

```toml
[items]
one = "{{ .Count }} item"
other = "{{ .Count }} items"
```

Kinakatawan sa loob bilang `items.one` at `items.other` para sa diffing, pagkatapos ay muling isinasaayos sa tamang sectioned format kapag isinusulat.

---

## next-intl (JSON)

### Estruktura ng proyekto

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

### Pag-setup

```bash
npm install --save-dev champollion
```

Patakbuhin ang `npx --yes champollion@0.6 init --yes --langs fr,de,ja,es,ko,zh,pt,ar`. Hinahanap nito ang `messages/en.json`, nililikha ang mga walang lamang target file at nagsusulat ng config na tulad ng nasa ibaba. O likhain ang `champollion.config.json` nang mag-isa:

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

Ang register ng bawat target (ang tono at pormalidad nito) ay nakasulat sa `languages`, upang ito ay makita at ma-edit: baguhin ang isa tungo sa isa pa sa mga preset ng wika (inililista ang mga ito ng `champollion status`) o sa sarili ninyong mga salita. Ang wikang walang mga preset ay isinusulat bilang `{}`. Gumagana rin ang payak na listahan, `"languages": ["fr", "de"]`, at ginagamit nito ang default ng bawat wika.

```bash
npx --yes champollion@0.6 sync
```

Lumilikha ng `messages/fr.json`, `messages/ja.json`, atbp. — ganap na naisalin, na pinapanatili ang inyong nested key structure. Awtomatikong kinukuha ang mga ito ng next-intl.

### Daloy ng pagbuo (development workflow)

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

### Folder bawat wika (default ng i18next)

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

Hinahanap ng `init` ang `public/locales/en/` (o `locales/en/`), itinuturo ang config dito, at nililikha ang `fr/common.json`, `fr/admin/users.json` at ang iba pa bilang mga walang lamang file. Ang nauugnay na bahagi ng config na isinusulat nito:

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

Isinasalin ang bawat namespace file at isinusulat sa parehong path sa folder ng bawat wika. Ang isang string na lumilitaw sa ilang namespace ay isinasalin nang isang beses bawat wika; kinukuha ito ng iba pang mga file mula sa Translation Memory. Nakukuha ng mga plural key (`key_one`, `key_other`) ang sariling mga anyo ng bawat wika, na binabasa mula sa CLDR sa pamamagitan ng JavaScript `Intl.PluralRules` API: ang isang anyo na ginagamit ng wika ngunit wala sa pinagmulan ay idinaragdag, at ang hindi nito ginagamit ay iniiwan. Sa pinagmulang Ingles, nakakukuha ang Espanyol at Pranses ng `key_many`, nakakukuha ang Ruso ng `key_few` at `key_many`, at pinapanatili naman ng Hapon ang `key_other` lamang. Pinapangalanan ng Sync, para sa sarili ninyong mga wika, ang mga anyong nakukuha ng bawat isa. Tingnan ang [mga i18next plural key](/docs/getting-started/configuration#i18next-plurals) at [Mga Layout ng Locale File](/docs/getting-started/configuration#locale-layouts).

### Isang file bawat wika

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

### Iba pang mga layout

Kung sumusunod ang inyong mga file sa isa pang pattern, ilarawan ito gamit ang `localesPattern` (`{lang}` ang wika, `{ns}` ang namespace):

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

### Estruktura ng proyekto

Nagbabasa ang `flutter gen-l10n` ng isang `.arb` file bawat wika. Ang nasa Ingles ang template:

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

### Pag-setup

```bash
npx --yes champollion@0.6 init --yes --langs fr,de,pt_BR
```

Binabasa ng `init` ang `pubspec.yaml` at `l10n.yaml` (`arb-dir`, `template-arb-file`), kinukuha ang pinagmulang wika mula sa pangalan ng template (`app_en.arb` → `en`), at nililikha ang `app_fr.arb`, `app_de.arb` at `app_pt_BR.arb` kasama ang kanilang `@@locale`. Ang config na isinusulat nito:

```json
{
  "version": 3,
  "inputLocale": "en",
  "localesPattern": "lib/l10n/app_{lang}.arb",
  "languages": { "fr": "formal-vous", "de": "formal-Sie", "pt_BR": "professional" }
}
```

Kung itinatakda ng `l10n.yaml` ang `arb-dir: assets/i18n` at `template-arb-file: intl_en.arb`, ang pattern ay `"assets/i18n/intl_{lang}.arb"`.

```bash
npx --yes champollion@0.6 sync
flutter gen-l10n
```

Ang mga mensahe lamang ang isinasalin. Nakukuha ng bawat target ang `"@@locale"` na nakatakda sa sarili nitong locale, na nakasulat sa paraang isinusulat ito ng pangalan ng file (`"pt_BR"`), dahil tinatanggihan ng `gen-l10n` ang isang file na ang `@@locale` ay hindi tumutugma sa pangalan nito. Ang bawat metadata object na `@key`, tulad ng mga placeholder at mga uri ng mga ito, ay kinokopya mula sa `app_en.arb` nang walang pagbabago. Sumusunod ang mga key sa pagkakasunud-sunod ng template, at ang isang mensahe na hindi pa naisasalin ay iniiwan, upang mag-fallback ang Flutter sa Ingles.

Ipinapadala sa modelo ang mga paglalarawan sa metadata ng template bilang konteksto:

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

Protektado ang syntax na `{count, plural, …}`, ang placeholder na `{count}` at ang mga selector: ang isang salin na nagbabago sa mga ito ay tinatanggihan at muling sinusubukan (tingnan ang [mga mensaheng ICU](/docs/getting-started/configuration#icu)). Maaaring magdagdag ang Pranses ng sangay na `many` at ang Polish ng `few` at `many`. Sinusuri rin ng `champollion verify` ang `@@locale` at ang metadata ng placeholder sa bawat target na file. Kung isinalin ang mga ito ng isang naunang tool, muling isinusulat ng `champollion sync --pair en:fr --force` ang file. Ang mga hindi nabagong mensahe ay kinukuha mula sa cache nang walang bayad.

### Mga locale sa labas ng sariling listahan ng Flutter {#flutter-locales-outside-flutters-own-list}

Ang inyong mga mensahe ay nagmumula sa mga `.arb` file. Ang teksto sa loob ng sariling mga widget ng Flutter — isang date picker, "Back", "Cancel", ang direksyon ng teksto — ay nagmumula sa `flutter_localizations` (`GlobalMaterialLocalizations`, `GlobalCupertinoLocalizations`), na sumasaklaw sa isang nakatakdang listahan ng mga wika ([listahan ng Flutter](https://api.flutter.dev/flutter/flutter_localizations/GlobalMaterialLocalizations-class.html)). Ang isang private-use code tulad ng `qaa`, at karamihan sa mga low-resource na wika, ay wala roon. Kapag may ganoong locale sa `supportedLocales`, pumapalya ang app sa runtime ("No MaterialLocalizations found") maliban kung may delegate na nagbibigay ng tekstong iyon. Sinasabi ito ng `init`, at ng sync na lumilikha ng bagong `.arb` file, para sa bawat target sa labas ng listahan: binabasa nila ito mula sa Flutter SDK sa makina (`FLUTTER_ROOT`, o ang `flutter` sa `PATH`), at kung wala ito ay sinasabi nila kung aling mga target ang hindi nila nasuri.

Ang pinakamaliit na solusyon ay ipahiram sa mga widget na iyon ang teksto ng isang wikang saklaw ng Flutter (Ingles dito):

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

Ilista ito kasunod ng sariling mga delegate ng Flutter:

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

Magpapakita pagkatapos ang mga widget ng mga label sa Ingles sa loob ng isang app na ang sariling teksto ay nasa inyong wika. Upang maisalin din ang teksto ng mga widget, ipinapakita ng gabay ng Flutter ang isang buong `MaterialLocalizations` para sa isang bagong wika: [Pagdaragdag ng suporta para sa isang bagong wika](https://docs.flutter.dev/ui/accessibility-and-internationalization/internationalization#adding-support-for-a-new-language).

---

## Django at gettext (.po)

Ang champollion CLI ay source-available sa ilalim ng [PolyForm Noncommercial License 1.0.0](https://github.com/gamedaysuits/Champollion/blob/main/cli/LICENSE): libreng gamitin, baguhin, at ibahagi para sa mga layuning di-komersyal. Ang paggamit nito para sa komersyal na layunin ay hindi saklaw ng lisensyang ito ([sino ang maaaring gumamit nito](/docs/getting-started/who-may-use-this)).

### Estruktura ng proyekto

```
my_site/
├── manage.py
└── locale/
    ├── en/LC_MESSAGES/django.po    ← source catalog (makemessages -l en)
    ├── fr/LC_MESSAGES/django.po
    └── ru/LC_MESSAGES/django.po
```

### Mga Setting: LOCALE_PATHS at LANGUAGES {#django-locale-paths}

Naghahanap ang Django ng mga catalog sa mga folder na inililista ng `LOCALE_PATHS` at sa folder na `locale/` ng bawat naka-install na app. Ang isang `locale/` sa tabi ng `manage.py` ay hindi pagmamay-ari ng anumang app, kaya hangga't hindi ito pinapangalanan ng `LOCALE_PATHS`, bubuuin pa rin ng `compilemessages` ang mga `.mo` file nito ngunit patuloy na ipapakita ng site ang hindi naisaling teksto. Ang `LANGUAGES` ay ang listahan ng mga wikang iniaalok ng site; ang default ng Django ay bawat wikang kasama nito, kaya ilista ang sarili ninyo:

```python title="settings.py"
LOCALE_PATHS = [BASE_DIR / "locale"]   # BASE_DIR: the folder with manage.py (startproject defines it)
LANGUAGES = [("en", "English"), ("fr", "Français"), ("ru", "Русский")]
```

### Pag-setup

Likhain o i-refresh muna ang mga catalog gamit ang Django. Ang catalog sa Ingles ang pinagmulan. Ang mga walang laman nitong `msgstr` ay nangangahulugang "ang msgid ang siyang teksto":

```bash
django-admin makemessages -l en -l fr -l ru
npx --yes champollion@0.6 init --yes --langs fr,ru
```

Hinahanap ng `init` ang `manage.py` at `locale/en/LC_MESSAGES/django.po` at isinusulat ang:

```json
{
  "version": 3,
  "inputLocale": "en",
  "localesPattern": "locale/{lang}/LC_MESSAGES/{ns}.po",
  "languages": { "fr": "formal-vous", "ru": "formal-vy" }
}
```

Ang `{ns}` ang gettext domain, kaya parehong naka-sync ang `django.po` at `djangojs.po`.

**Ang mga default ay tono at estilo ng kasarian; inililimbag ng `init` ang pareho.** Hinihiling ng `formal-vous` sa modelo ang "Formal French. Use vous-form (vouvoiement) consistently. Professional, academic register." Ang gabay sa kasarian para sa Pranses ay humihiling ng *écriture inclusive* na may gitnang tuldok kapag hindi alam ang kasarian ng mambabasa (`Connecté·e`, `Utilisateur·rice·s`); ang sa Ruso (`formal-vy`) ay gumagamit ng panlalaki, ang nakagawiang default. Ang isang site na may ibang nais (halimbawa, mga pahina ng pasyente sa isang klinika) ay binabago ito sa `champollion.config.json`: ang register sa `languages` (`"fr": "casual-tu"`, o sarili ninyong mga salita), at `genderGuidance` — `false` para sa walang tagubilin, o ang sarili ninyo, tulad ng `"Use the masculine generic."` ([Gabay sa kasarian](/docs/getting-started/configuration#gender-guidance)). Ang isang binagong setting ay nakakakuha ng sarili nitong mga entry sa cache, kaya muling isinasalin ng `sync --redo all` ang isinulat ng luma.

**Aling pamamaraan ang nagsasalin, at aling key ang kailangan nito.** Kung walang `--method`, itinatakda ng `init` ang default, `llm`: isang modelo sa [OpenRouter](https://openrouter.ai), na nangangailangan ng `OPENROUTER_API_KEY` sa environment o sa isang `.env` file sa tabi ng `manage.py` (inililimbag ng `init` ang linyang itatakda kapag nawawala ito). Sa makinang nagpapatakbo ng model server (Ollama, LM Studio, vLLM), hindi kailangan ng `npx --yes champollion@0.6 init --yes --langs fr,ru --method local --model llama3.1` ng key, at walang lumalabas sa makina. Ang isang CI runner ay walang model server, kaya tinutukoy ng CI ang isang hosted model para sa pagpapatakbo nito (tingnan ang [gabay sa CI](/docs/guides/ci-cd)). Bawat pamamaraan at ang key na kailangan ng bawat isa: [Mga Pamamaraan sa Pagsasalin](/docs/guides/translation-methods).

Pagkatapos:

```bash
npx --yes champollion@0.6 sync
django-admin compilemessages
```

Isinasalin ng Sync ang bawat entry na may walang lamang `msgstr` at bawat `fuzzy` na entry, at inaalis ang `fuzzy` flag. Ang mga entry na naisalin na ay iniiwan nang bawat byte, kasama ang kanilang mga komento. Ang isang entry na may `msgctxt` ay sarili nitong key at sarili nitong cache entry, kaya ang "Open" na pandiwa at "Open" na pang-uri ay hiwalay na isinasalin. Ang mga komentong `#.` at ang konteksto ay ipinapadala sa modelo — upang makita ang eksaktong kahilingan nang hindi ito ipinapadala, patakbuhin ang `npx --yes champollion@0.6 sync --dry --show-prompt 'verb␄Open'` (lumilitaw ang konteksto at komento sa ilalim ng "UI context for these keys").

**Sadyang muling pagsasalin ng isang entry.** Pangalanan ito ayon sa msgid nito:

```bash
npx --yes champollion@0.6 sync --pair en:fr --redo 'keys:Welcome back\, %(name)s!'
```

Ito ay ibinibigay mula sa Translation Memory kapag nasa cache na ang tekstong iyon, kaya makukuha ninyo ang parehong salin nang walang karagdagang bayad, at sinasabi ito ng sync gamit ang command na `--fresh`. Ang ganoong pag-ulit ay hindi nangangailangan ng modelo: gamit ang `local` at kapag nakatigil ang model server, nagbababala ang sync na hindi sumasagot ang server at hindi ito kailangan ng pagpapatakbong ito, at nagpapatuloy (ang pag-ulit na kailangang magpadala ng anuman ay humihinto, na pinapangalanan ang server). Upang magbayad para sa isang bagong salin, idagdag ang `--fresh`. Ang kuwit sa loob ng isang msgid ay isinusulat bilang `\,`, at pinipigilan ng mga panipi ang shell na basahin ang iba pa. Ang isang entry na may konteksto ay pinapangalanan tulad ng paglilimbag dito sa mga ulat, `verb␄Open`. Kung hindi ninyo mai-type ang `␄`, isulat ang `\x04` sa halip: `--redo 'keys:verb\x04Open'`. Parehong gumagana ang dalawang baybay, at ipinapakita ng mga repair command ang pareho. Upang pangalanan ang entry sa isang domain lamang, i-prefix ang domain: `django::Welcome`. Ang isang pangalan na hindi tumutugma sa anumang entry ay nagpapabigo sa pagpapatakbo (exit 1) at naglilista ng pinakamalapit na mga entry, halimbawa bawat konteksto ng msgid na `Cancel` (`button␄Cancel`, `status␄Cancel`). Hindi kailanman ito pumapasa bilang isang tapos na pag-ulit.

Ang catalog na nililikha ng champollion (`init --langs`, o sync para sa isang wikang wala pang catalog) ay nakakakuha ng karaniwang gettext header, ang mga field na isinusulat ng `msginit`, upang tanggapin ito ng `msgfmt -c`. Ang header ng isang umiiral nang catalog ay hindi kailanman muling isinusulat.

**Mga babala sa header ng `msgfmt -c` sa mga catalog na sinimulan ng `makemessages`.** Isinusulat ng `makemessages` ang template header ng gettext — `Project-Id-Version: PACKAGE VERSION`, `PO-Revision-Date: YEAR-MO-DA HO:MI+ZONE`, `Last-Translator: FULL NAME <EMAIL@ADDRESS>`, `Language-Team: LANGUAGE <LL@li.org>`, na minarkahang `#, fuzzy` — at nagbababala pagkatapos ang `msgfmt -c` sa bawat pag-compile na ang bawat field ay "still has the initial default value". Hinahayaan ng Sync ang mga value na iyon (sa isang umiiral na header ay pinupunan lamang nito ang isang placeholder na `Plural-Forms` o charset), kaya ayusin ang mga ito nang manu-mano nang minsan sa bawat catalog: ang pangalan at bersyon ng inyong proyekto, ang petsa, isang tagasalin (o `Automatically generated`) at isang pangkat (o `none`); burahin din ang linyang `#, fuzzy` sa itaas ng `msgid ""`, na nagmamarka sa header bilang hindi pa nasusuri. Pinapanatili ng `makemessages` ang mga value na inyong isinulat. Hindi sinusuri ng `compilemessages` (`msgfmt --check-format`) ang header, kaya hindi ito kailanman nabibigo sa mga babalang ito.

**Mga anyong maramihan (plurals).** Ang `msgid` + `msgid_plural` ay nagiging isang mensahe na isinasalin ng modelo kasama ang lahat ng anyong kailangan ng wika. Ang mga anyo ay isinusulat sa `msgstr[0]`, `msgstr[1]`, … ayon sa `Plural-Forms` header ng catalog. Isinusulat ito ng Django para sa inyo. Ang isang catalog na walang header ay nakakakuha ng header na isinusulat ng `msginit` para sa wika (Pranses `nplurals=2; plural=(n > 1);`), o isa na hinango mula sa CLDR para sa isang wikang hindi inililista ng `msginit`:

```po
msgid "One file"
msgid_plural "%(count)d files"
msgstr[0] "%(count)d файл"
msgstr[1] "%(count)d файла"
msgstr[2] "%(count)d файлов"
```

Kapag hindi naisama sa salin ang isang anyo na ginagamit ng wika para sa karaniwang pagbibilang (Ruso `few` o `many`), muling humihiling ang sync sa modelo para dito. Kung kulang pa rin ang sagot, isinusulat ng sync ang `other` na anyo sa lugar nito, minamarkahan ang entry ng `# champollion:` na komento at pinapangalanan ito gamit ang command na muling humihiling (`--redo 'keys:django::One file' --fresh`). Ang bawat sync ay nag-e-exit nang `2` habang may minarkahang entry sa catalog, hindi lamang ang sync na sumulat nito, tulad ng para sa isang key na ipinagpaliban. Sinasabi ng pansarang verification line nito na hindi kumpleto ang pagpapatakbo sa halip na `[OK]`. Isulat ang mga anyo nang manu-mano at burahin ang linya ng komento, o humiling muli gamit ang mas malakas na `--model`. Ang isang sync gamit ang ibang pamamaraan o modelo (ang hosted model ng CI, pagkatapos ng lokal) ay kusang humihiling muli para sa entry, at ang `sync --redo gaps` ay humihiling para sa bawat minarkahang entry; kung kulang pa rin sa mga anyo ang sagot, nananatiling minarkahan ang entry. Sa CI, nagpapabigo ito sa job pagkatapos ng commit (tingnan ang [gabay sa CI](/docs/guides/ci-cd#plural-gaps)).

**Iba pang mga layout ng gettext.**

| Proyekto | Config | Pinagmulan |
|---------|--------|--------|
| GNU (`po/fr.po`) | `"localesDir": "./po", "format": "po"` | `po/en.po`, o ang nag-iisang `.pot` sa `po/` |
| Babel / Flask | `"localesPattern": "translations/{lang}/LC_MESSAGES/messages.po"` | `translations/en/…/messages.po`, o `messages.pot` sa `translations/` o ang folder sa itaas nito |

Dapat manatili ang mga placeholder ng `printf` (`%s`, `%(name)s`, `%d`) pagkatapos ng pagsasalin, at tinatanggihan ng quality gate ang isang value na nawalan nito. Patakbuhin pa rin ang `msgfmt --check-format` (ginagawa ito ng `compilemessages`) bago mag-ship. Sinusuri rin nito ang mga uri ng placeholder, ngunit sa mga entry lamang na may flag na `#, python-format`: idinaragdag ng `makemessages` ang flag sa mga entry na kinukuha nito gamit ang isang `%` placeholder, samantalang ang isang catalog na ginawa nang manu-mano ay maaaring walang nito, at ang mga entry na iyon ay hindi nasusuri. Inihahambing ng `champollion verify` ang mga printf placeholder ng bawat entry (pangalan at titik ng uri) anuman ang mga flag nito, at pinapanatili ng sync ang mga flag ng pinagmulang entry sa bawat entry na isinasalin nito. Dapat ay UTF-8 ang mga catalog. Tingnan ang [mga gettext catalog](/docs/getting-started/configuration#gettext) para sa buong mga panuntunan.
