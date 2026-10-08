# Mga Gabay sa Integrasyon

Step-by-step na pag-setup para sa champollion gamit ang mga popular na framework.

Ang mga command sa pahinang ito ay nagpapatakbo ng champollion gamit ang `npx --yes champollion@0.5 <command>`: naka-pin sa linyang 0.5, tulad sa [gabay sa CI](/docs/guides/ci-cd), upang ang inyong laptop at ang inyong CI ay magpatakbo ng parehong bersyon at ang isang bagong release ay hindi kailanman magbago ng pagpapatakbo nang di-inaasahan. Ang project-local na pag-install ang alternatibo. Sa isang proyektong Node, idinadagdag ito ng `npm install --save-dev champollion@0.5` sa `package.json`, at pagkatapos ay pinapatakbo ng `npx champollion sync` ang kopyang iyon.

---

## Pag-setup ng API Key

Bago mag-integrate sa anumang framework, kailangan ninyo ng translation API key. Sinusuportahan ng Champollion ang dalawang provider:

### Opsyon A: OpenRouter (inirerekomenda)

Nagbibigay ang [OpenRouter](https://openrouter.ai) ng unified API para sa 200+ LLM models. May available na free tier.

```bash
# Sign up at https://openrouter.ai, then:
export OPENROUTER_API_KEY=sk-or-v1-...

# Or add to .env.local:
OPENROUTER_API_KEY=sk-or-v1-your-key-here
```

Pinakamainam para sa: mga proyektong content-heavy, Markdown translation, at mga proyektong nangangailangan ng content-aware shielding (code blocks, shortcodes, interpolation variables).

### Opsyon B: Google Translate

```bash
export GOOGLE_TRANSLATE_API_KEY=...
```

Pinakamainam para sa: malalaking bulto ng mga key-value string pair (194 na wika). **Hindi inirerekomenda** para sa nilalamang Markdown — walang kakayahan ang Google Translate na kumilala ng mga code block, shortcode, o interpolation variable.

Upang gamitin ang Google Translate nang explicit:

```bash
champollion sync --method google-translate
```

> **Tip**: Kung `GOOGLE_TRANSLATE_API_KEY` lamang ang naka-set (walang OpenRouter key), awtomatikong lilipat ang champollion sa Google Translate.

---

## Hugo (TOML / YAML / Markdown)

### Istruktura ng proyekto

Ginagamit ng Hugo ang `i18n/` para sa string translations at ang `content/` para sa page content:

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

Gumawa ng `champollion.config.json`:

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

### Mga detalye ng content translation

**Front matter**: Sinusuportahan ang parehong YAML (`---`) at TOML (`+++`) delimiters. Bilang default, tina-translate ang `title`, `description`, `summary`, `subtitle`, `caption`, at `linkTitle`. Pinananatili ang lahat ng iba pang fields (date, draft, tags, weight, slug, atbp.). I-customize gamit ang `translatableFields` sa inyong config.

**Block protection**: Awtomatikong sini-shield ang code blocks, Hugo shortcodes (`{{< >}}`, `{{% %}}`), inline code, at raw HTML gamit ang Unicode sentinel placeholders. Dumadaan ang mga ito nang hindi nagagalaw.

**Filename convention**: Sinusunod ang translation-by-filename pattern ng Hugo:
- `my-post.md` → `my-post.fr.md`
- `my-post.en.md` → `my-post.fr.md` (inaalis ang source suffix)

**Skip existing**: Hindi kailanman ino-overwrite ang mga umiiral nang translated files. Mag-delete ng target file upang puwersahin ang re-translation.

### Plural forms

Sinusuportahan ng TOML at YAML locales ang CLDR plural forms:

```toml
[items]
one = "{{ .Count }} item"
other = "{{ .Count }} items"
```

Internal na kinakatawan bilang `items.one` at `items.other` para sa diffing, pagkatapos ay muling sine-serialize sa tamang sectioned format kapag nagsusulat.

---

## next-intl (JSON)

### Istruktura ng proyekto

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

Patakbuhin ang `npx --yes champollion@0.5 init --yes --langs fr,de,ja,es,ko,zh,pt,ar`. Mahahanap nito ang `messages/en.json`, lilikhain ang mga bakanteng target file, at isusulat ang isang config tulad ng nasa ibaba. O likhain ang `champollion.config.json` nang manu-mano:

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

Ang register ng bawat target (ang tono at pormalidad nito) ay nakasulat sa `languages`, kaya makikita at mae-edit ito: baguhin ang isa sa iba pang preset ng wika (inililista ang mga ito ng `champollion status`) o sa sarili ninyong mga salita. Ang isang wikang walang mga preset ay isinusulat bilang `{}`. Gumagana rin ang isang payak na listahan, `"languages": ["fr", "de"]`, at ginagamit nito ang default ng bawat wika.

```bash
npx --yes champollion@0.5 sync
```

Gumagawa ng `messages/fr.json`, `messages/ja.json`, atbp. — ganap na translated, habang pinananatili ang inyong nested key structure. Awtomatikong nakukuha ng next-intl ang mga ito.

### Development workflow

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
npx --yes champollion@0.5 init --yes --langs fr,de,ja
```

Hahanapin ng `init` ang `public/locales/en/` (o `locales/en/`), ituturo ang config dito, at lilikha ng `fr/common.json`, `fr/admin/users.json` at ang iba pa bilang mga bakanteng file. Ang kaugnay na bahagi ng config na isinusulat nito:

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

Ang bawat namespace file ay isinasalin at isinusulat sa parehong path sa folder ng bawat wika. Ang isang string na lumalabas sa ilang namespace ay isinasalin nang minsan bawat wika; kinukuha ito ng iba pang mga file mula sa Translation Memory. Ang mga plural key (`key_one`, `key_other`) ay nakakakuha ng sariling mga anyo ng bawat wika, na binabasa mula sa CLDR sa pamamagitan ng JavaScript `Intl.PluralRules` API: ang isang anyo na ginagamit ng wika na wala sa source ay idinadagdag, at ang hindi nito ginagamit ay inaalis. Gamit ang English na source, nakakakuha ang Spanish at French ng `key_many`, nakakakuha ang Russian ng `key_few` at `key_many`, at pinapanatili lamang ng Japanese ang `key_other`. Isinasaad ng Sync, para sa inyong sariling mga wika, ang mga anyong nakukuha ng bawat isa. Tingnan ang [mga i18next plural key](/docs/getting-started/configuration#i18next-plurals) at [Mga Layout ng Locale File](/docs/getting-started/configuration#locale-layouts).

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

Kung sumusunod ang inyong mga file sa ibang pattern, ilarawan ito gamit ang `localesPattern` (`{lang}` ang wika, `{ns}` ang namespace):

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

### Istruktura ng proyekto

Binabasa ng `flutter gen-l10n` ang isang `.arb` file bawat wika. Ang English ang template:

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
npx --yes champollion@0.5 init --yes --langs fr,de,pt_BR
```

Binabasa ng `init` ang `pubspec.yaml` at `l10n.yaml` (`arb-dir`, `template-arb-file`), kinukuha ang source language mula sa pangalan ng template (`app_en.arb` → `en`), at nililikha ang `app_fr.arb`, `app_de.arb`, at `app_pt_BR.arb` kasama ang kanilang `@@locale`. Ang config na isinusulat nito:

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
npx --yes champollion@0.5 sync
flutter gen-l10n
```

Ang mga mensahe lamang ang isinasalin. Bawat target ay nakakakuha ng `"@@locale"` na nakatakda sa sarili nitong locale, na nakasulat sa paraan ng pagkakasulat ng pangalan ng file (`"pt_BR"`), dahil tinatanggihan ng `gen-l10n` ang isang file na ang `@@locale` ay hindi tumutugma sa pangalan nito. Bawat metadata object na `@key`, tulad ng mga placeholder at ang mga uri ng mga ito, ay kinokopya mula sa `app_en.arb` nang walang pagbabago. Sinusunod ng mga key ang pagkakasunod-sunod ng template, at ang isang mensahe na hindi pa naisasalin ay hindi isinasama, upang mag-fallback ang Flutter sa English.

Ang mga paglalarawan sa metadata ng template ay ipinapadala sa modelo bilang konteksto:

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

Ang syntax na `{count, plural, …}`, ang placeholder na `{count}`, at ang mga selector ay protektado: ang isang salin na nagbabago sa mga ito ay tinatanggihan at muling sinusubukan (tingnan ang [mga ICU message](/docs/getting-started/configuration#icu)). Maaaring magdagdag ang French ng sangay na `many` at ang Polish ng `few` at `many`. Sinusuri rin ng `champollion verify` ang `@@locale` at ang metadata ng placeholder ng bawat target file. Kung isinalin ang mga ito ng isang naunang tool, muling isinusulat ng `champollion sync --pair en:fr --force` ang file. Ang mga hindi nagbagong mensahe ay nagmumula sa cache nang walang karagdagang gastusin.

### Mga locale na wala sa sariling listahan ng Flutter {#flutter-locales-outside-flutters-own-list}

Ang inyong mga mensahe ay nagmumula sa mga `.arb` file. Ang teksto sa loob ng sariling mga widget ng Flutter — isang date picker, "Back", "Cancel", ang direksyon ng teksto — ay nagmumula sa `flutter_localizations` (`GlobalMaterialLocalizations`, `GlobalCupertinoLocalizations`), na sumasaklaw sa isang nakatakdang listahan ng mga wika ([listahan ng Flutter](https://api.flutter.dev/flutter/flutter_localizations/GlobalMaterialLocalizations-class.html)). Ang isang private-use code tulad ng `qaa`, at karamihan sa mga low-resource na wika, ay wala rito. Kapag may ganoong locale sa `supportedLocales`, nagkakaroon ng error ang app sa runtime ("No MaterialLocalizations found") maliban kung may delegate na nagbibigay ng tekstong iyon. Sinasabi ito ng `init`, at ng sync na lumilikha ng bagong `.arb` file, para sa bawat target na wala sa listahan: binabasa nila ito mula sa Flutter SDK sa makina (`FLUTTER_ROOT`, o ang `flutter` sa `PATH`), at kung wala nito ay sinasabi nila kung aling mga target ang hindi nila masuri.

Ang pinakasimpleng solusyon ay ipahiram sa mga widget na iyon ang teksto ng isang wikang saklaw ng Flutter (English dito):

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

Magpapakita pagkatapos ang mga widget ng mga English na label sa loob ng isang app na ang sariling teksto ay nasa inyong wika. Upang isalin din ang teksto ng mga widget, ipinapakita sa gabay ng Flutter ang isang kumpletong `MaterialLocalizations` para sa isang bagong wika: [Pagdaragdag ng suporta para sa isang bagong wika](https://docs.flutter.dev/ui/accessibility-and-internationalization/internationalization#adding-support-for-a-new-language).

---

## Django at gettext (.po)

Ang champollion CLI ay source-available sa ilalim ng [PolyForm Noncommercial License 1.0.0](https://github.com/gamedaysuits/Champollion/blob/main/cli/LICENSE): libreng gamitin, baguhin, at ibahagi para sa mga layuning di-komersyal. Ang paggamit nito para sa komersyal na layunin ay hindi saklaw ng lisensyang ito ([kung sino ang maaaring gumamit nito](/docs/getting-started/who-may-use-this)).

### Istruktura ng proyekto

```
my_site/
├── manage.py
└── locale/
    ├── en/LC_MESSAGES/django.po    ← source catalog (makemessages -l en)
    ├── fr/LC_MESSAGES/django.po
    └── ru/LC_MESSAGES/django.po
```

### Mga Setting: LOCALE_PATHS at LANGUAGES {#django-locale-paths}

Naghahanap ang Django ng mga catalog sa mga folder na inililista ng `LOCALE_PATHS` at sa folder na `locale/` ng bawat naka-install na app. Ang isang `locale/` sa tabi ng `manage.py` ay hindi kabilang sa alinmang app, kaya hangga't hindi ito pinapangalanan ng `LOCALE_PATHS`, binubuo pa rin ng `compilemessages` ang mga `.mo` file nito ngunit patuloy na ipinapakita ng site ang hindi naisaling teksto. Ang `LANGUAGES` ay ang listahan ng mga wikang iniaalok ng site; ang default ng Django ay ang bawat wikang kasama nito, kaya ilista ang inyong sarili:

```python title="settings.py"
LOCALE_PATHS = [BASE_DIR / "locale"]   # BASE_DIR: the folder with manage.py (startproject defines it)
LANGUAGES = [("en", "English"), ("fr", "Français"), ("ru", "Русский")]
```

### Pag-setup

Likhain o i-refresh muna ang mga catalog gamit ang Django. Ang English na catalog ang source. Ang mga bakanteng `msgstr` nito ay nangangahulugang "ang msgid ang siyang teksto":

```bash
django-admin makemessages -l en -l fr -l ru
npx --yes champollion@0.5 init --yes --langs fr,ru
```

Nahahanap ng `init` ang `manage.py` at `locale/en/LC_MESSAGES/django.po` at isinusulat ang:

```json
{
  "version": 3,
  "inputLocale": "en",
  "localesPattern": "locale/{lang}/LC_MESSAGES/{ns}.po",
  "languages": { "fr": "formal-vous", "ru": "formal-vy" }
}
```

Ang `{ns}` ay ang gettext domain, kaya parehong naka-sync ang `django.po` at `djangojs.po`.

**Ang mga default ay tono at estilo ng kasarian; inililimbag ng `init` ang dalawa.** Humihiling ang `formal-vous` sa modelo ng "Formal French. Use vous-form (vouvoiement) consistently. Professional, academic register." Ang gabay sa kasarian ng French ay humihiling ng *écriture inclusive* na may middle dot kapag hindi alam ang kasarian ng mambabasa (`Connecté·e`, `Utilisateur·rice·s`); ang sa Russian (`formal-vy`) ay gumagamit ng masculine, ang nakasanayang default. Ang isang site na may ibang nais (halimbawa, mga pahina ng pasyente ng isang klinika) ay binabago ito sa `champollion.config.json`: ang register sa `languages` (`"fr": "casual-tu"`, o ang inyong sariling mga salita), at `genderGuidance` — `false` para sa walang tagubilin, o ang sarili ninyo, tulad ng `"Use the masculine generic."` ([Gabay sa kasarian](/docs/getting-started/configuration#gender-guidance)). Ang binagong setting ay nakakakuha ng sarili nitong mga cache entry, kaya muling isinasalin ng `sync --redo all` ang isinulat ng luma.

**Aling pamamaraan ang nagsasalin, at aling key ang kailangan nito.** Kung walang `--method`, itinatakda ng `init` ang default, `llm`: isang modelo sa [OpenRouter](https://openrouter.ai), na nangangailangan ng `OPENROUTER_API_KEY` sa environment o sa isang `.env` file sa tabi ng `manage.py` (inililimbag ng `init` ang linyang dapat itakda kapag kulang ito). Sa isang makinang nagpapatakbo ng model server (Ollama, LM Studio, vLLM), ang `npx --yes champollion@0.5 init --yes --langs fr,ru --method local --model llama3.1` ay hindi nangangailangan ng key, at walang lumalabas sa makina. Walang model server ang isang CI runner, kaya tinutukoy ng CI ang isang hosted model para sa pagpapatakbo nito (tingnan ang [gabay sa CI](/docs/guides/ci-cd)). Ang bawat pamamaraan at ang key na kailangan ng bawat isa: [Mga Paraan ng Pagsasalin](/docs/guides/translation-methods).

Pagkatapos:

```bash
npx --yes champollion@0.5 sync
django-admin compilemessages
```

Isinasalin ng sync ang bawat entry na may bakanteng `msgstr` at bawat `fuzzy` entry, habang inaalis ang flag na `fuzzy`. Ang mga entry na naisalin na ay hindi ginagalaw bawat byte, kasama ang kanilang mga komento. Ang isang entry na may `msgctxt` ay may sariling key at sariling cache entry, kaya ang pandiwang "Open" at ang pang-uring "Open" ay hiwalay na isinasalin. Ang mga komentong `#.` at ang konteksto ay ipinapadala sa modelo — upang makita ang eksaktong kahilingan nang hindi ito ipinapadala, patakbuhin ang `npx --yes champollion@0.5 sync --dry --show-prompt 'verb␄Open'` (lumilitaw ang konteksto at komento sa ilalim ng "UI context for these keys").

**Sinadyang muling pagsasalin ng isang entry.** Pangalanan ito gamit ang msgid nito:

```bash
npx --yes champollion@0.5 sync --pair en:fr --redo 'keys:Welcome back\, %(name)s!'
```

Ito ay ibinibigay mula sa Translation Memory kapag nasa cache na ang tekstong iyon, kaya makukuha ninyo ang parehong salin pabalik nang walang karagdagang gastusin, at sinasabi ito ng sync gamit ang command na `--fresh`. Ang ganitong pag-uulit ay hindi nangangailangan ng modelo: gamit ang `local` at nakahinto ang model server, nagbabala ang sync na hindi sumasagot ang server at hindi ito kailangan ng pagpapatakbong ito, at nagpapatuloy (ang isang pag-uulit na kailangang magpadala ng anuman ay humihinto, na tinutukoy ang server). Upang magbayad para sa isang bagong salin, idagdag ang `--fresh`. Ang kuwit sa loob ng msgid ay isinusulat bilang `\,`, at pinipigilan ng mga panipi ang shell sa pagbasa ng natitira. Ang isang entry na may konteksto ay pinapangalanan tulad ng paglimbag nito sa mga ulat, `verb␄Open`. Kung hindi ninyo mai-type ang `␄`, isulat ang `\x04` sa halip: `--redo 'keys:verb\x04Open'`. Gumagana ang parehong baybay, at ipinapakita ng mga repair command ang dalawa. Upang pangalanan ang entry sa isang domain lamang, i-prefix ang domain: `django::Welcome`. Ang pangalang hindi tumutugma sa anumang entry ay nagpapabagsak sa pagpapatakbo (exit 1) at naglilista ng mga pinakamalapit na entry, halimbawa ang bawat konteksto ng msgid na `Cancel` (`button␄Cancel`, `status␄Cancel`). Hindi kailanman ito pumapasa bilang tapos nang redo.

Ang isang catalog na nililikha ng champollion (`init --langs`, o sync para sa isang wikang wala pang catalog) ay nakakakuha ng karaniwang gettext header, ang mga field na isinusulat ng `msginit`, kaya tinatanggap ito ng `msgfmt -c`. Ang header ng isang umiiral nang catalog ay hindi kailanman muling isinusulat.

**Mga babala sa header ng `msgfmt -c` sa mga catalog na sinimulan ng `makemessages`.** Isinusulat ng `makemessages` ang template header ng gettext — `Project-Id-Version: PACKAGE VERSION`, `PO-Revision-Date: YEAR-MO-DA HO:MI+ZONE`, `Last-Translator: FULL NAME <EMAIL@ADDRESS>`, `Language-Team: LANGUAGE <LL@li.org>`, na minarkahang `#, fuzzy` — at nagbabala pagkatapos ang `msgfmt -c` sa bawat pag-compile na ang bawat field ay "still has the initial default value". Hindi ginagalaw ng sync ang mga value na iyon (sa isang umiiral na header, pinupunan lamang nito ang isang placeholder na `Plural-Forms` o charset), kaya ayusin ang mga ito nang minsan nang manu-mano sa bawat catalog: ang pangalan at bersyon ng inyong proyekto, ang petsa, isang tagasalin (o `Automatically generated`), at isang pangkat (o `none`); tanggalin din ang linyang `#, fuzzy` sa itaas ng `msgid ""`, na nagmamarka sa header bilang hindi pa nasusuri. Pinapanatili ng `makemessages` ang mga value na inyong isinulat. Hindi sinusuri ng `compilemessages` (`msgfmt --check-format`) ang header, kaya hindi kailanman nabibigo ito dahil sa mga babalang ito.

**Mga Plural.** Ang `msgid` + `msgid_plural` ay nagiging isang mensahe na isinasalin ng modelo kasama ang lahat ng anyong kailangan ng wika. Ang mga anyo ay isinusulat sa `msgstr[0]`, `msgstr[1]`, … ayon sa header na `Plural-Forms` ng catalog. Isinusulat ito ng Django para sa inyo. Ang isang catalog na walang ganito ay nakakakuha ng header na isinusulat ng `msginit` para sa wika (French `nplurals=2; plural=(n > 1);`), o isang nakuha mula sa CLDR para sa wikang hindi inililista ng `msginit`:

```po
msgid "One file"
msgid_plural "%(count)d files"
msgstr[0] "%(count)d файл"
msgstr[1] "%(count)d файла"
msgstr[2] "%(count)d файлов"
```

Kapag hindi naisama sa salin ang isang anyong ginagamit ng wika para sa karaniwang pagbilang (Russian `few` o `many`), hihilingin muli ito ng sync sa modelo. Kung kulang pa rin ang sagot, isusulat ng sync ang anyong `other` sa lugar nito, mamarkahan ang entry ng isang komentong `# champollion:`, at papangalanan ito gamit ang command na muling humihiling (`--redo 'keys:django::One file' --fresh`). Ang bawat sync ay nag-e-exit nang `2` habang may minarkahang entry sa catalog, hindi lamang ang sync na sumulat nito, tulad ng para sa isang key na pinigil. Ang pangwakas na linya ng pag-verify nito ay nagsasabing hindi kumpleto ang pagpapatakbo sa halip na `[OK]`. Isulat ang mga anyo nang manu-mano at tanggalin ang linya ng komento, o humiling muli gamit ang mas malakas na `--model`. Ang isang sync gamit ang ibang paraan o modelo (ang hosted model ng CI, kasunod ng isang lokal) ay awtomatikong hihiling muli para sa entry, at ang `sync --redo gaps` ay humihiling para sa bawat minarkahang entry; kung kulang pa rin sa mga anyo ang sagot, mananatiling minarkahan ang entry. Sa CI, pinapabagsak nito ang trabaho pagkatapos ng commit (tingnan ang [gabay sa CI](/docs/guides/ci-cd#plural-gaps)).

**Iba pang mga layout ng gettext.**

| Proyekto | Config | Source |
|---------|--------|--------|
| GNU (`po/fr.po`) | `"localesDir": "./po", "format": "po"` | `po/en.po`, o ang nag-iisang `.pot` sa `po/` |
| Babel / Flask | `"localesPattern": "translations/{lang}/LC_MESSAGES/messages.po"` | `translations/en/…/messages.po`, o `messages.pot` sa `translations/` o ang folder sa itaas nito |

Dapat manatili ang mga placeholder ng `printf` (`%s`, `%(name)s`, `%d`) sa pagsasalin, at tinatanggihan ng quality gate ang isang value na nawalan ng isa sa mga ito. Patakbuhin pa rin ang `msgfmt --check-format` (ginagawa ito ng `compilemessages`) bago mag-ship. Sinusuri rin nito ang mga uri ng placeholder, ngunit sa mga entry lamang na may flag na `#, python-format`: idinadagdag ng `makemessages` ang flag sa mga entry na kinukuha nito na may `%` placeholder, samantalang ang isang catalog na ginawa nang manu-mano ay maaaring walang nito, at ang mga entry na iyon ay hindi masusuri. Inihahambing ng `champollion verify` ang mga printf placeholder ng bawat entry (pangalan at titik ng uri) anuman ang mga flag nito, at pinapanatili ng sync ang mga flag ng source entry sa bawat entry na isinasalin nito. Dapat UTF-8 ang mga catalog. Tingnan ang [mga gettext catalog](/docs/getting-started/configuration#gettext) para sa buong mga panuntunan.
