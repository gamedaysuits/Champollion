# Integratiehandleidingen

Stapsgewijze configuratie voor champollion met populaire frameworks.

Commando's op deze pagina voeren champollion uit met `npx --yes champollion@0.6 <command>`: vastgezet op de 0.6-lijn, zoals in de [CI-handleiding](/docs/guides/ci-cd), zodat uw laptop en uw CI dezelfde versie draaien en een nieuwe release een uitvoering nooit onverwachts wijzigt. Een lokaal geïnstalleerde projectversie is het alternatief. In een Node-project voegt `npm install --save-dev champollion@0.6` het toe aan `package.json`, waarna `npx champollion sync` die kopie uitvoert.

---

## Configuratie van API-sleutels

Voordat u met een framework integreert, heeft u een API-sleutel voor vertaling nodig. Champollion ondersteunt twee providers:

### Optie A: OpenRouter (aanbevolen)

[OpenRouter](https://openrouter.ai) biedt een uniforme API voor meer dan 200 LLM-modellen. Er is een gratis niveau beschikbaar.

```bash
# Sign up at https://openrouter.ai, then:
export OPENROUTER_API_KEY=sk-or-v1-...

# Or add to .env.local:
OPENROUTER_API_KEY=sk-or-v1-your-key-here
```

Het meest geschikt voor: contentrijke projecten, Markdown-vertaling en projecten die inhoudsbewuste afscherming vereisen (codeblokken, shortcodes, interpolatievariabelen).

### Optie B: Google Translate

```bash
export GOOGLE_TRANSLATE_API_KEY=...
```

Het meest geschikt voor: grote volumes van sleutel-waardeparen (194 talen). **Niet aanbevolen** voor Markdown-inhoud — Google Translate houdt geen rekening met codeblokken, shortcodes of interpolatievariabelen.

Om Google Translate expliciet te gebruiken:

```bash
champollion sync --method google-translate
```

> **Tip**: Als alleen `GOOGLE_TRANSLATE_API_KEY` is ingesteld (geen OpenRouter-sleutel), schakelt champollion automatisch over naar Google Translate.

---

## Hugo (TOML / YAML / Markdown)

### Projectstructuur

Hugo gebruikt `i18n/` voor tekststringvertalingen en `content/` voor pagina-inhoud:

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

### Setup

```bash
npm install --save-dev champollion
```

```bash
# .env.local
OPENROUTER_API_KEY=sk-or-v1-your-key-here
```

Maak `champollion.config.json` aan:

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

### Details over inhoudsvertaling

**Frontmatter**: Ondersteunt zowel YAML- (`---`) als TOML-scheidingstekens (`+++`). Vertaalt standaard `title`, `description`, `summary`, `subtitle`, `caption` en `linkTitle`. Alle overige velden (date, draft, tags, weight, slug, enz.) blijven behouden. Pas dit aan met `translatableFields` in uw configuratie.

**Blokbescherming**: Codeblokken, Hugo-shortcodes (`{{< >}}`, `{{% %}}`), inline code en ruwe HTML worden automatisch afgeschermd met behulp van Unicode-sentinel-placeholders. Ze worden onaangeroerd doorgegeven.

**Bestandsnaamconventie**: Volgt Hugo's patroon voor vertaling op basis van bestandsnamen:
- `my-post.md` → `my-post.fr.md`
- `my-post.en.md` → `my-post.fr.md` (verwijdert het bronsuffix)

**Bestaande overslaan**: Bestaande vertaalde bestanden worden nooit overschreven. Verwijder een doelbestand om hervertaling af te dwingen.

### Meervoudsvormen

TOML- en YAML-locales ondersteunen CLDR-meervoudsvormen:

```toml
[items]
one = "{{ .Count }} item"
other = "{{ .Count }} items"
```

Intern gerepresenteerd als `items.one` en `items.other` voor diffs, en vervolgens opnieuw geserialiseerd naar het juiste gesegmenteerde formaat bij het schrijven.

---

## next-intl (JSON)

### Projectstructuur

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

### Setup

```bash
npm install --save-dev champollion
```

Voer `npx --yes champollion@0.6 init --yes --langs fr,de,ja,es,ko,zh,pt,ar` uit. Dit vindt `messages/en.json`, maakt de lege doelbestanden aan en schrijft een configuratie zoals hieronder. Of maak zelf `champollion.config.json` aan:

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

Het register van elk doel (de toon en formaliteit) wordt weggeschreven in `languages`, zodat het zichtbaar en bewerkbaar is: wijzig er een naar een van de andere voorinstellingen van de taal (`champollion status` geeft ze weer) of naar uw eigen bewoordingen. Een taal zonder voorinstellingen wordt weggeschreven als `{}`. Een eenvoudige lijst, `"languages": ["fr", "de"]`, werkt ook en gebruikt de standaardwaarde van elke taal.

```bash
npx --yes champollion@0.6 sync
```

Maakt `messages/fr.json`, `messages/ja.json`, enz. aan — volledig vertaald, met behoud van uw geneste sleutelstructuur. next-intl pikt deze automatisch op.

### Ontwikkelingsworkflow

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

### Map per taal (standaard voor i18next)

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

`init` vindt `public/locales/en/` (of `locales/en/`), verwijst de configuratie ernaar en maakt `fr/common.json`, `fr/admin/users.json` en de andere bestanden als lege bestanden aan. Het relevante deel van de configuratie die het schrijft:

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

Elk namespacebestand wordt vertaald en naar hetzelfde pad in de map van elke taal geschreven. Een tekst die in meerdere namespaces voorkomt, wordt eenmaal per taal vertaald; de overige bestanden halen deze uit het vertaalgeheugen (Translation Memory). Meervoudssleutels (`key_one`, `key_other`) krijgen de eigen vormen van elke taal, gelezen uit CLDR via de JavaScript `Intl.PluralRules` API: een vorm die de taal gebruikt maar die in de bron ontbreekt, wordt toegevoegd, en een vorm die niet wordt gebruikt, wordt weggelaten. Met Engels als bron krijgen het Spaans en Frans `key_many`, krijgt het Russisch `key_few` en `key_many`, en behoudt het Japans alleen `key_other`. Sync vermeldt voor uw eigen talen welke vormen elke taal krijgt. Zie [i18next-meervoudssleutels](/docs/getting-started/configuration#i18next-plurals) en [Indelingen van locale-bestanden](/docs/getting-started/configuration#locale-layouts).

### Eén bestand per taal

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

### Andere indelingen

Als uw bestanden een ander patroon volgen, beschrijf dit dan met `localesPattern` (`{lang}` is de taal, `{ns}` de namespace):

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

### Projectstructuur

`flutter gen-l10n` leest één `.arb`-bestand per taal. Het Engelse bestand is de sjabloon:

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

### Setup

```bash
npx --yes champollion@0.6 init --yes --langs fr,de,pt_BR
```

`init` leest `pubspec.yaml` en `l10n.yaml` (`arb-dir`, `template-arb-file`), haalt de brontaal uit de naam van de sjabloon (`app_en.arb` → `en`) en maakt `app_fr.arb`, `app_de.arb` en `app_pt_BR.arb` aan met hun `@@locale`. De configuratie die het schrijft:

```json
{
  "version": 3,
  "inputLocale": "en",
  "localesPattern": "lib/l10n/app_{lang}.arb",
  "languages": { "fr": "formal-vous", "de": "formal-Sie", "pt_BR": "professional" }
}
```

Als `l10n.yaml` `arb-dir: assets/i18n` en `template-arb-file: intl_en.arb` instelt, is het patroon `"assets/i18n/intl_{lang}.arb"`.

```bash
npx --yes champollion@0.6 sync
flutter gen-l10n
```

Alleen de berichten worden vertaald. Bij elk doel wordt `"@@locale"` ingesteld op de eigen locale, geschreven zoals de bestandsnaam het schrijft (`"pt_BR"`), omdat `gen-l10n` een bestand weigert waarvan `@@locale` niet overeenkomt met de bestandsnaam. Elk `@key`-metadataobject, zoals placeholders en hun types, wordt ongewijzigd overgenomen uit `app_en.arb`. Sleutels volgen de volgorde van de sjabloon, en een bericht dat nog niet is vertaald wordt weggelaten, zodat Flutter terugvalt op het Engelse bericht.

Beschrijvingen in de metadata van de sjabloon worden als context naar het model gestuurd:

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

De `{count, plural, …}`-syntaxis, de `{count}`-placeholder en de selectors zijn beschermd: een vertaling die deze wijzigt, wordt afgekeurd en opnieuw geprobeerd (zie [ICU-berichten](/docs/getting-started/configuration#icu)). Het Frans kan een `many`-tak toevoegen en het Pools `few` en `many`. `champollion verify` controleert ook `@@locale` en de metadata van placeholders in elk doelbestand. Als een eerdere tool deze heeft vertaald, herschrijft `champollion sync --pair en:fr --force` het bestand. Ongewijzigde berichten komen kosteloos uit de cache.

### Locales buiten Flutter's eigen lijst {#flutter-locales-outside-flutters-own-list}

Uw berichten komen uit de `.arb`-bestanden. De tekst in de eigen widgets van Flutter — een datumkiezer, "Back", "Cancel", de tekstrichting — is afkomstig van `flutter_localizations` (`GlobalMaterialLocalizations`, `GlobalCupertinoLocalizations`), dat een vaste lijst van talen dekt ([de lijst van Flutter](https://api.flutter.dev/flutter/flutter_localizations/GlobalMaterialLocalizations-class.html)). Een privébruiks-code (private-use code) zoals `qaa` en de meeste talen met weinig digitale bronnen (low-resource languages) staan er niet op. Met een dergelijke locale in `supportedLocales` mislukt de app tijdens runtime ("No MaterialLocalizations found"), tenzij een delegate die tekst levert. `init` en een sync die een nieuw `.arb`-bestand aanmaakt, melden dit voor elk doel buiten de lijst: ze lezen dit uit de Flutter SDK op de machine (`FLUTTER_ROOT`, of de `flutter` op `PATH`), en zonder SDK geven ze aan welke doelen ze niet konden controleren.

De eenvoudigste oplossing leent voor die widgets de tekst van een taal die Flutter wel ondersteunt (hier Engels):

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

Plaats deze na de eigen delegates van Flutter:

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

De widgets tonen dan Engelse labels binnen een app waarvan de eigen tekst in uw taal is. Om ook de tekst van de widgets te vertalen, toont de Flutter-handleiding een volledige `MaterialLocalizations` voor een nieuwe taal: [Ondersteuning voor een nieuwe taal toevoegen](https://docs.flutter.dev/ui/accessibility-and-internationalization/internationalization#adding-support-for-a-new-language).

---

## Django en gettext (.po)

De champollion-CLI is source-available onder de [PolyForm Noncommercial License 1.0.0](https://github.com/gamedaysuits/Champollion/blob/main/cli/LICENSE): gratis te gebruiken, te wijzigen en te delen voor niet-commerciële doeleinden. Gebruik voor een commercieel doel valt niet onder deze licentie ([wie dit mag gebruiken](/docs/getting-started/who-may-use-this)).

### Projectstructuur

```
my_site/
├── manage.py
└── locale/
    ├── en/LC_MESSAGES/django.po    ← source catalog (makemessages -l en)
    ├── fr/LC_MESSAGES/django.po
    └── ru/LC_MESSAGES/django.po
```

### Instellingen: LOCALE_PATHS en LANGUAGES {#django-locale-paths}

Django zoekt naar catalogi in de mappen die `LOCALE_PATHS` vermeldt en in de map `locale/` van elke geïnstalleerde app. Een `locale/` naast `manage.py` hoort bij geen enkele app; totdat `LOCALE_PATHS` deze noemt, bouwt `compilemessages` weliswaar de `.mo`-bestanden, maar blijft de site de onvertaalde tekst tonen. `LANGUAGES` is de lijst van talen die de site aanbiedt; de standaard van Django is elke taal die standaard wordt meegeleverd, dus vermeld hier uw eigen talen:

```python title="settings.py"
LOCALE_PATHS = [BASE_DIR / "locale"]   # BASE_DIR: the folder with manage.py (startproject defines it)
LANGUAGES = [("en", "English"), ("fr", "Français"), ("ru", "Русский")]
```

### Setup

Maak of vernieuw eerst de catalogi met Django. De Engelse catalogus is de bron. De lege `msgstr`'s betekenen "de msgid is de tekst":

```bash
django-admin makemessages -l en -l fr -l ru
npx --yes champollion@0.6 init --yes --langs fr,ru
```

`init` vindt `manage.py` en `locale/en/LC_MESSAGES/django.po` en schrijft:

```json
{
  "version": 3,
  "inputLocale": "en",
  "localesPattern": "locale/{lang}/LC_MESSAGES/{ns}.po",
  "languages": { "fr": "formal-vous", "ru": "formal-vy" }
}
```

`{ns}` is het gettext-domein, waardoor zowel `django.po` als `djangojs.po` worden gesynchroniseerd.

**De standaardinstellingen zijn een toon en een genderstijl; `init` toont beide.** `formal-vous` vraagt het model om "Formal French. Use vous-form (vouvoiement) consistently. Professional, academic register." De genderrichtlijn voor het Frans vraagt om *écriture inclusive* met het middenpunt wanneer het geslacht van de lezer onbekend is (`Connecté·e`, `Utilisateur·rice·s`); die voor het Russisch (`formal-vy`) gebruikt het mannelijk, de gangbare standaard. Een site die iets anders wenst (bijvoorbeeld de patiëntenpagina's van een kliniek), wijzigt dit in `champollion.config.json`: het register in `languages` (`"fr": "casual-tu"`, of uw eigen bewoordingen), en `genderGuidance` — `false` voor geen instructie, of uw eigen instructie, zoals `"Use the masculine generic."` ([Genderrichtlijnen](/docs/getting-started/configuration#gender-guidance)). Een gewijzigde instelling krijgt eigen cache-items, waardoor `sync --redo all` opnieuw vertaalt wat de oude instelling heeft geschreven.

**Welke methode vertaalt en welke sleutel nodig is.** Zonder `--method` configureert `init` de standaardwaarde, `llm`: een model op [OpenRouter](https://openrouter.ai), dat `OPENROUTER_API_KEY` in de omgeving of in een `.env`-bestand naast `manage.py` vereist (`init` toont de in te stellen regel als deze ontbreekt). Op een machine die een modelserver draait (Ollama, LM Studio, vLLM), heeft `npx --yes champollion@0.6 init --yes --langs fr,ru --method local --model llama3.1` geen sleutel nodig en verlaat niets de machine. Een CI-runner heeft geen modelserver, dus CI geeft een gehost model op voor de uitvoering (zie de [CI-handleiding](/docs/guides/ci-cd)). Alle methoden en de sleutel die elk vereist: [Vertaalmethoden](/docs/guides/translation-methods).

Vervolgens:

```bash
npx --yes champollion@0.6 sync
django-admin compilemessages
```

Sync vertaalt elk item met een lege `msgstr` en elk `fuzzy` item, waarbij de vlag `fuzzy` wordt verwijderd. Reeds vertaalde items blijven byte voor byte behouden, samen met hun commentaar. Een item met een `msgctxt` is een eigen sleutel en een eigen cache-item, zodat "Open" als werkwoord en "Open" als bijvoeglijk naamwoord afzonderlijk worden vertaald. `#.`-commentaren en de context worden naar het model gestuurd — om het exacte verzoek te zien zonder het te versturen, voert u `npx --yes champollion@0.6 sync --dry --show-prompt 'verb␄Open'` uit (de context en het commentaar verschijnen onder "UI context for these keys").

**Opzettelijk één item opnieuw vertalen.** Benoem het via zijn msgid:

```bash
npx --yes champollion@0.6 sync --pair en:fr --redo 'keys:Welcome back\, %(name)s!'
```

Dit wordt vanuit het vertaalgeheugen (Translation Memory) geleverd als de cache die tekst al bevat, waardoor u kosteloos dezelfde vertaling terugkrijgt; sync meldt dit met het commando `--fresh`. Een dergelijke herhaling heeft geen model nodig: met `local` en een gestopte modelserver waarschuwt sync dat de server niet reageert en dat deze uitvoering hem niet nodig heeft, en gaat door (een herhaling die wel iets moet verzenden, stopt met vermelding van de server). Voeg `--fresh` toe om voor een nieuwe vertaling te betalen. Een komma binnen een msgid wordt geschreven als `\,`, en de aanhalingstekens voorkomen dat de shell de rest interpreteert. Een item met context wordt aangeduid zoals rapporten het afdrukken, `verb␄Open`. Als u `␄` niet kunt typen, schrijf dan `\x04` in plaats daarvan: `--redo 'keys:verb\x04Open'`. Beide schrijfwijzen werken, en herstelcommando's tonen beide. Om het item in slechts één domein te benoemen, zet u het domein ervoor: `django::Welcome`. Een naam die met geen enkel item overeenkomt, laat de uitvoering mislukken (exit 1) en geeft de dichtstbijzijnde items weer, bijvoorbeeld elke context van de msgid `Cancel` (`button␄Cancel`, `status␄Cancel`). Dit slaagt nooit als een voltooide herhaling.

Een catalogus die champollion aanmaakt (`init --langs`, of sync voor een taal die nog geen catalogus heeft) krijgt de standaard gettext-header, de velden die `msginit` schrijft, zodat `msgfmt -c` deze accepteert. De header van een bestaande catalogus wordt nooit herschreven.

**`msgfmt -c` headerwaarschuwingen bij catalogi gestart door `makemessages`.** `makemessages` schrijft de standaardsjabloonheader van gettext — `Project-Id-Version: PACKAGE VERSION`, `PO-Revision-Date: YEAR-MO-DA HO:MI+ZONE`, `Last-Translator: FULL NAME <EMAIL@ADDRESS>`, `Language-Team: LANGUAGE <LL@li.org>`, gemarkeerd als `#, fuzzy` — en `msgfmt -c` waarschuwt vervolgens bij elke compilatie dat elk veld "still has the initial default value". Sync raakt die waarden niet aan (in een bestaande header vult het alleen een tijdelijke aanduiding voor `Plural-Forms` of charset in), dus pas ze eenmalig handmatig aan in elke catalogus: de naam en versie van uw project, de datum, een vertaler (of `Automatically generated`) en een team (of `none`); verwijder ook de regel `#, fuzzy` boven `msgid ""`, die de header markeert als nog niet gecontroleerd. `makemessages` behoudt de waarden die u schrijft. `compilemessages` (`msgfmt --check-format`) controleert de header niet, dus deze waarschuwingen laten het proces nooit mislukken.

**Meervouden.** `msgid` + `msgid_plural` worden één bericht dat het model vertaalt met alle vormen die de taal vereist. De vormen worden naar `msgstr[0]`, `msgstr[1]`, … geschreven volgens de `Plural-Forms`-header van de catalogus. Django genereert deze voor u. Een catalogus zonder header krijgt de header die `msginit` voor de taal genereert (voor het Frans `nplurals=2; plural=(n > 1);`), of een van CLDR afgeleide header voor een taal die `msginit` niet vermeldt:

```po
msgid "One file"
msgid_plural "%(count)d files"
msgstr[0] "%(count)d файл"
msgstr[1] "%(count)d файла"
msgstr[2] "%(count)d файлов"
```

Wanneer de vertaling een vorm weglaat die de taal gebruikt voor gangbare aantallen (in het Russisch `few` of `many`), vraagt sync het model er opnieuw om. Als het antwoord de vorm nog steeds mist, schrijft sync de vorm `other` in plaats daarvan, markeert het item met een commentaar `# champollion:` en vermeldt het met het commando om het opnieuw te vragen (`--redo 'keys:django::One file' --fresh`). Elke sync sluit af met `2` zolang er een gemarkeerd item in de catalogus staat, niet alleen de sync die het heeft geschreven, zoals bij een achtergehouden sleutel. De afsluitende verificatieregel meldt dat de uitvoering onvolledig is in plaats van `[OK]`. Schrijf de vormen handmatig en verwijder de commentaarregel, of vraag het opnieuw met een krachtigere `--model`. Een sync met een andere methode of een ander model (het gehoste model van CI na een lokaal model) vraagt het item automatisch opnieuw op, en `sync --redo gaps` vraagt elk gemarkeerd item op; als het antwoord de vormen ook mist, blijft het item gemarkeerd. In CI leidt dit tot een mislukte taak na de commit (zie de [CI-handleiding](/docs/guides/ci-cd#plural-gaps)).

**Andere gettext-indelingen.**

| Project | Configuratie | Bron |
|---------|--------|--------|
| GNU (`po/fr.po`) | `"localesDir": "./po", "format": "po"` | `po/en.po`, of het ene `.pot` in `po/` |
| Babel / Flask | `"localesPattern": "translations/{lang}/LC_MESSAGES/messages.po"` | `translations/en/…/messages.po`, of `messages.pot` in `translations/` of de bovenliggende map |

`printf`-placeholders (`%s`, `%(name)s`, `%d`) moeten de vertaling overleven, en de quality gate wijst een waarde af die er een verliest. Voer vóór oplevering toch `msgfmt --check-format` uit (`compilemessages` doet dit ook). Het controleert ook de typen van placeholders, maar alleen bij items met de vlag `#, python-format`: `makemessages` voegt de vlag toe aan de items die het extraheert met een `%`-placeholder, terwijl een handmatig gemaakte catalogus deze mogelijk mist, waardoor die items niet worden gecontroleerd. `champollion verify` vergelijkt de printf-placeholders van elk item (naam en typeletter), ongeacht de vlaggen, en sync behoudt de vlaggen van het bronitem op elk item dat het vertaalt. Catalogi moeten in UTF-8 zijn opgemaakt. Zie [gettext-catalogi](/docs/getting-started/configuration#gettext) voor de volledige regels.
