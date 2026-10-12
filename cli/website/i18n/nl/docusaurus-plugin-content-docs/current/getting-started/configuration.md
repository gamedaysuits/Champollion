---
sidebar_position: 3
title: "Configuratie"
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

# Configuratie

Champollion werkt zonder configuratie — het detecteert automatisch localebestanden, indeling en doeltalen vanuit uw project. Voor meer controle maakt u `champollion.config.json` aan in de hoofdmap van uw project, of voert u het volgende uit:

```bash
npx champollion init
```

## Volledige configuratiereferentie

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

:::note[typegen is nog niet geïmplementeerd]
Het `typegen` configuratieblok wordt herkend en bewaard door de configuratielader, maar het genereren van TypeScript-typen is nog niet geïmplementeerd. Dit is een tijdelijke aanduiding voor een geplande functie. Het instellen van deze waarden heeft geen effect.
:::


### Velden

| Veld | Type | Standaardwaarde | Beschrijving |
|-------|------|---------|-------------|
| `version` | `number` | `3` | Configuratieschemaversie. Altijd `3`. |
| `inputLocale` | `string` | `"en"` | Brontaalsleutel (BCP 47). |
| `localesDir` | `string` | `"./locales"` | Pad naar locale-bestanden. Bevat één bestand per taal (`fr.json`) of één map per taal (`fr/common.json`). Zie [Locale File Layouts](#locale-layouts). |
| `localesPattern` | `string` | `null` | Waar de bestanden van elke taal staan wanneer geen van beide vormen past, met `{lang}` en een optionele `{ns}`: `"public/locales/{lang}/{ns}.json"`, `"src/strings/app_{lang}.json"`. Relatief ten opzichte van de projectroot. Vervangt `localesDir`. Zie [Locale File Layouts](#locale-layouts). |
| `localesLayout` | `string` | `null` | Overschrijft layoutdetectie: `"flat"` (één bestand per taal) of `"dir"` (één map per taal). Alleen nodig wanneer zowel `en.json` als `en/` bestaan. |
| `defaultNamespace` | `string` | `null` | In een project met één map per taal en meerdere bestanden: het bestand waaraan `champollion wrap` nieuwe sleutels toevoegt (bijv. `"common"`). |
| `contentDir` | `string` | `null` | Een map met Markdown/MDX om te vertalen: een Hugo-`content/`-map of een andere map, zoals `./newsletters` in een Next.js-app. Elke vertaling wordt naast de bron weggeschreven als `<name>.<locale>.md`, bijvoorbeeld `2026-10.md` → `2026-10.crk.md`. Bestanden die al `<name>.<code>.md` heten, worden behandeld als vertalingen, niet als bronnen. Zie [Content Translation](/docs/guides/content-translation). |
| `translatableFields` | `string[]` | `null` | Overschrijf standaard vertaalbare frontmatter-velden voor contentvertaling. `null` gebruikt ingebouwde standaardwaarden (`title`, `description`, `summary`). |
| `format` | `string` | `"auto"` | Bestandsformaat: `json`, `toml`, `yaml`, `po` ([gettext](#gettext)), `arb` ([Flutter](#arb)) of `auto` (detecteer aan de hand van de extensie van het bronbestand; `.yml` telt als YAML en doelen behouden `.yml`). Elke andere waarde stopt met een fout. |
| `model` | `string` | `"google/gemini-3.8-flash"` | Standaardmodel voor LLM-methoden. Een exacte modelslug: de volledige OpenRouter-slug (`provider/model`). Korte aliassen (`gemini-flash`) en zwevende id's (`~vendor/…`, `…-latest`) worden geweigerd, onder vermelding van de te gebruiken slug. Directe providers gebruiken kale namen (bijv. `gpt-4o`); een OpenRouter-slug van hun eigen leverancier wordt ernaar gemapt (`openai/gpt-4o` → `gpt-4o`), en een slug waarvoor ze geen model hebben, stopt de run voordat er iets wordt verzonden ([Model Names](/docs/guides/translation-methods#model-names)). |
| `temperature` | `number` | `0.3` | LLM-temperatuur (0.0–2.0). Lager = deterministischer. |
| `defaultMethod` | `string` | `"llm"` | Standaard vertaalmethode: `llm`, `llm-coached`, `openai`, `anthropic`, `gemini`, `local`, `google-translate`, `deepl`, `microsoft-translator`, `libretranslate`, `apertium`, `tilde`, `translated`, `api`. `local` is een OpenAI-compatibele server op uw machine (standaard Ollama). Wordt overschreven door de CLI-vlag `--method`. |
| `batchSize` | `number` | `80` | Sleutels per vertaalbatch. Hoger = minder API-aanroepen, maar grotere prompts. |
| `coachingFile` | `string` | `null` | Pad naar een bestand met vrije tekst voor coaching-prompts (relatief ten opzichte van de projectroot). De inhoud wordt bij het opstarten gelezen en als een `Coaching guidance:`-blok in de systeemprompt geïnjecteerd. |
| `promptContext` | `string` | `null` | Applicatiecontextreeks die in de systeemprompt wordt geïnjecteerd (bijv. "E-commerce product descriptions"). Helpt het model vertalingen af te stemmen op uw domein. |
| `genderGuidance` | `string` \| `false` | `null` | Hoe LLM-prompts omgaan met grammaticaal geslacht. `null` behoudt de standaard van elke taal uit de catalogus van Champollion — voor het Frans, *écriture inclusive* met de interpunct (`Connecté·e`, `Utilisateur·rice·s`); voor het Duits, de dubbelepuntvorm (`Benutzer:innen`). `false` stuurt geen geslachtsinstructie mee; een tekenreeks stuurt uw eigen instructie (bijv. `"Use the masculine generic."`). Ook instelbaar per taal en per paar. Zie [Gender guidance](#gender-guidance). |
| `protectedTerms` | `string[]` | `[]` | Namen die in elke taal exact behouden moeten blijven zoals geschreven: personen, bedrijven, producten (bijv. `["Curtis Forbes", "Game Day Suits"]`). Het model krijgt de instructie deze te behouden, en een waarde die uitsluitend uit deze namen bestaat, wordt nooit gemarkeerd als onvertaald of met een verkeerd schrift. Dit verschilt van `noTranslate`, waarmee volledige **sleutels** worden overgeslagen. |
| `jsonConcurrency` | `number` | `200` | Maximaal aantal parallelle locale-vertalingen voor synchronisatie van JSON-sleutels. Wordt overschreven door de CLI-vlag `--json-concurrency`. |
| `contentConcurrency` | `number` | `48` | Maximaal aantal parallelle API-aanroepen voor contentvertaling (Markdown/MDX). Wordt overschreven door de CLI-vlag `--content-concurrency`. |
| `fallbackPrefix` | `string` | `"[EN] "` | Markeringsvoorvoegsel dat door `audit` en `verify` wordt gebruikt om verouderde onvertaalde waarden uit eerdere runs te detecteren. Champollion schrijft dit voorvoegsel niet — het leest het alleen voor detectie. |
| `apiKeyEnvVar` | `string` | `"OPENROUTER_API_KEY"` | Naam van de omgevingsvariabele voor de API-sleutel. Overschrijf dit voor aangepaste namen van omgevingsvariabelen. |
| `minContentRetention` | `number` | `0.35` | Fractie van de letters/cijfers van de bron die een uitvoer moet behouden voordat de [content-deletion-controle](/docs/concepts/quality-gate) het tweede signaal raadpleegt. Ook instelbaar per paar en per taal. |
| `noTranslate` | `string[]` | `[]` | Punt-padsleutels en glob-patronen waarvan de waarde letterlijk naar elke locale wordt gekopieerd. Zie [No-Translate Keys](#no-translate). Ook geaccepteerd als `skipKeys`. |
| `noTranslateUrls` | `boolean` | `true` | Behandel bronwaarden die niets anders zijn dan een `scheme://`-URL als no-translate. Stel in op `false` om sleutels met URL-waarden naar de vertaal-backend te sturen. |
| `baseUrl` | `string` | `""` | Basis-URL voor het genereren van SEO-artefacten (hreflang, sitemaps, JSON-LD). |
| `pairs` | `object` | `{}` | Methode-, model- en kwaliteitsoverschrijvingen per paar. Zie [Pair Configuration](#pair-configuration). |
| `languages` | `object` | `{}` | Overschrijvingen per taal. Zie [Language Configuration](#language-configuration). |
| `lint.srcDir` | `string` | `null` | Bronmap voor lint-scans. `null` = automatisch detecteren op basis van framework. |
| `lint.ignore` | `string[]` | `["node_modules", ...]` | Glob-patronen om uit te sluiten van lint. |
| `lint.minLength` | `number` | `2` | Minimale tekenreekslengte om als hardcoded te worden aangemerkt. |
| `seo.urlPattern` | `string` | `"/:locale/:path"` | URL-patroonsjabloon voor het genereren van hreflang-tags. |
| `seo.pages` | `string[]` | `null` | Expliciete paginalijst voor SEO. `null` = automatisch detecteren aan de hand van locale-sleutels. |
| `typegen.output` | `string` | `null` | Uitvoerpad voor gegenereerde TypeScript-typen. `null` = uitgeschakeld. |
| `typegen.autoGenerate` | `boolean` | `false` | Genereer typen automatisch opnieuw na elke synchronisatie. |

## Locale File Layouts {#locale-layouts}

Champollion leest uw locale-bestanden daar waar uw framework ze al bewaart. Er zijn drie vormen.

**Één bestand per taal** (`flat`). next-intl, vue-i18n, Hugo, de meeste op maat gemaakte configuraties:

```text
messages/
  en.json      ← source
  fr.json
  de.json
```

```json title="champollion.config.json"
{ "localesDir": "./messages" }
```

**Één map per taal** (`dir`). i18next en react-i18next, waarbij elk bestand een *namespace* is:

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

Champollion kiest `dir` wanneer `<localesDir>/<inputLocale>/` een map met locale-bestanden is. Elk bronbestand wordt gesynchroniseerd naar hetzelfde pad onder de map van elke taal, en ontbrekende bestanden en mappen worden aangemaakt. Een namespace kan een genest pad zijn (`admin/users`).

**Elke andere vorm** (`localesPattern`). Geef het pad op met `{lang}` en, als een taal meerdere bestanden heeft, `{ns}`:

```json title="champollion.config.json"
{ "localesPattern": "src/translations/{ns}/{lang}.json" }
```

`{lang}` mag herhaald worden, zoals in `"{lang}/app_{lang}.json"`. `{ns}` mag één keer voorkomen en kan zich over meerdere mappen uitstrekken. Het formaat wordt bepaald door de extensie, tenzij `format` is ingesteld.

`champollion init` zoekt deze layouts automatisch voor u op. Het controleert eerst op een Flutter-app (`pubspec.yaml`, met `l10n.yaml` indien aanwezig) en gettext-catalogi (`locale/<lang>/LC_MESSAGES/`, `translations/`, GNU `po/`), en schrijft daarvoor een `localesPattern`. Vervolgens controleert het de gebruikelijke map van uw framework (`messages/` voor next-intl, `public/locales/` en daarna `locales/` voor i18next, `src/locales/` voor vue-i18n, `i18n/` voor Hugo), gevolgd door `locales`, `messages`, `i18n`, `lang`, `translations`, `public/locales`, `src/locales` en `src/i18n`. Het gebruikt uitsluitend een map die het bestand van uw brontaal bevat, en geeft weer wat er is gevonden. `init --langs fr,de` maakt ook de lege doelbestanden aan in die layout.

:::note[Hoe een taal met meerdere bestanden synchroniseert]
Elk bestand wordt afzonderlijk vergeleken, vertaald en weggeschreven. `.champollion.lock` legt sleutels vast als `<namespace>::<key>` (`common::nav.home`), en dat geldt ook voor `--force-keys`, `xliff` unit-id's en `sync --dry --json`. Een kale sleutel in `--force-keys` komt overeen met die sleutel in elk bestand. Projecten met één bestand per taal behouden gewone sleutels, waardoor hun lock-bestand niet verandert.

Het Translation Memory is geordend op brontekst, niet op bestand. Een tekenreeks die in twee namespaces voorkomt, wordt per taal één keer vertaald. Het tweede bestand haalt deze kosteloos uit de cache.
:::

Als zowel `en.json` als een gevulde map `en/` bestaan, stopt Champollion en vraagt het u om `"localesLayout": "flat"` of `"dir"` in te stellen in plaats van te gissen.

### i18next-meervoudssleutels {#i18next-plurals}

i18next slaat meervouden op als nevengeschikte sleutels met een CLDR-achtervoegsel: `item_one`, `item_other`. Talen kennen verschillende meervoudsvormen. Het Frans en Spaans gebruiken ook `_many`, het Arabisch gebruikt zes vormen en het Japans alleen `_other`. Wanneer een JSON-bronbestand deze sleutels bevat, krijgt elk doel exact de vormen van zijn eigen taal, uitgelezen uit CLDR via de JavaScript `Intl.PluralRules`-API:

```json title="en.json"
{ "item_one": "{{count}} item", "item_other": "{{count}} items" }
```

Na een synchronisatie heeft `fr.json` de sleutels `item_one`, `item_many` en `item_other`, en `ja.json` heeft alleen `item_other`. Sync meldt voor uw eigen talen welke vormen elke taal erbij krijgt of verliest.

Nieuwe vormen worden vertaald vanuit de `_other`-tekst van de bron, `_one` vanuit `_one`. Een `_zero` in de bron wordt in elke taal behouden, omdat i18next deze in alle talen opzoekt voor een aantal van 0. Als een eerdere synchronisatie een vorm heeft geschreven die de taal niet gebruikt, zoals `item_one` in het Japans, verwijdert sync deze alleen wanneer het Translation Memory aantoont dat sync die waarde heeft geproduceerd. Een handmatig geschreven waarde blijft behouden. Een sleutel voor een vorm die de taal niet heeft en waarvoor de bron evenmin een sleutel heeft (Spaans `item_two`), wordt nooit automatisch verwijderd: `verify` noemt deze, en `sync --prune plural-extras` verwijdert exact die sleutels en somt ze stuk voor stuk op (met `--dry` wordt gemeld wat er verwijderd zou worden). Voor een taal waarvoor CLDR geen meervoudsregels heeft, worden de vormen van de bron één-op-één gekopieerd, en sync meldt dit.

### ICU-berichten {#icu}

Waarden geschreven in ICU MessageFormat (next-intl, react-intl, vue-i18n, Flutter) mengen code met tekst:

```json
{ "items": "{count, plural, =0 {No events} one {# event} other {# events}}" }
```

Alleen de tekst binnen de vertakkingen wordt vertaald. De [quality gate](/docs/concepts/quality-gate) wijst een vertaling af die iets anders wijzigt:

- variabelenamen (`count`, `{name}`), die nooit worden hernoemd of weggelaten;
- de woorden `plural`, `select` en `selectordinal`, en het type van `{price, number}`;
- selectors (`=0`, `one`, `other`, `male`). Een `select` behoudt exact zijn opties. Een `plural` behoudt de selectors van de bron en kan vanuit CLDR de categorieën toevoegen die de doeltaal gebruikt: het Frans voegt `many` toe, het Pools `few` en `many`. Een categorie die de taal niet gebruikt, mag worden weggelaten; zo behoudt het Japans alleen `other`;
- `#` in elke meervoudstak die deze bevat, behalve `zero`, `one`, `two` en `=N`, waar een taal het getal als een woord kan uitschrijven;
- `offset:N`, geneste argumenten en printf-conversies zoals `%s`, `%d` en `%(name)s`.

Het model krijgt te horen welke categorieën de doeltaal gebruikt. Een afgewezen vertaling wordt één keer opnieuw geprobeerd met opgave van de reden, bijvoorbeeld `ICU keyword 'other' was translated to 'óthér'`. Een apostrof voor een tijdelijke aanduiding (`d'{name}`) is toegestaan. `verify` en `integrity` voeren dezelfde controle uit op bestanden die al zijn geschreven. Een gewone `sync` behoudt een waarde die al op schijf staat, dus elke bevinding noemt de opdracht waarmee deze kan worden hersteld, `champollion sync --pair <pair> --redo keys:<key>`. Wanneer de beschadigde waarde afkomstig was uit het Translation Memory, wordt deze uit de cache verwijderd, zodat die opdracht de sleutel opnieuw vertaalt in plaats van dezelfde tekst te leveren; er is geen `--fresh` nodig.

### gettext-catalogi (.po) {#gettext}

Wijs `localesPattern` (of `localesDir`) naar uw catalogi:

```json title="Django"
{ "localesPattern": "locale/{lang}/LC_MESSAGES/{ns}.po" }
```

```json title="GNU (po/fr.po, po/de.po, po/hello.pot)"
{ "localesDir": "./po", "format": "po" }
```

**De bron** is de catalogus van de brontaal, bijvoorbeeld `locale/en/LC_MESSAGES/django.po` vanuit `django-admin makemessages -l en`. De `msgid` daarvan is de te vertalen tekst wanneer `msgstr` leeg is. Wanneer die catalogus niet bestaat, is de bron een `.pot`-sjabloon:

- Met `localesDir`: het ene `.pot`-bestand in die map.
- Met `localesPattern`: `<name>.pot` in de map vóór de eerste tijdelijke aanduiding of de map daarboven. `<name>` is de namespace (`{ns}`, één sjabloon per domein zoals `django.pot`), of de bestandsnaam van het patroon zonder `{lang}` (`messages.po` → `messages.pot`).
- Met `localesLayout: "dir"`: er wordt niet gezocht naar een sjabloon. Bewaar de broncatalogus in `<localesDir>/<source>/`.

Twee sjablonen waar er één wordt verwacht, stoppen de run. Champollion gokt niet welke de bron is.

**Sleutels.** Elke `msgid` is een sleutel. Een item met een `msgctxt` krijgt als sleutel `msgctxt` + U+0004 + `msgid`, de eigen codering van gettext. "Open" als werkwoord en "Open" als bijvoeglijk naamwoord zijn afzonderlijke sleutels en afzonderlijke cache-items. Rapporten drukken het scheidingsteken af als `␄` (`verb␄Open`), en `--force-keys "verb␄Open"` accepteert dit. Als u `␄` niet kunt typen, schrijf dan `\x04` (`--force-keys 'verb\x04Open'`): beide schrijfwijzen werken. `--force-keys` (en `--redo keys:`) splitst op komma's; schrijf een komma binnen een msgid als `\,` en plaats aanhalingstekens om het argument: `--redo 'keys:Welcome back\, %(name)s!'`. Ongewijzigde items worden kosteloos uit de cache gehaald.

**Wat wordt vertaald.** Een item met een lege `msgstr`, of een item gemarkeerd als `fuzzy`, is onvertaald. Sync vertaalt het en verwijdert `fuzzy` samen met de `#|`-regels van de vorige msgid. Opmerkingen van vertalers (`# …`) blijven behouden. Verwijzingen (`#:`), geëxtraheerde opmerkingen (`#.`) en vlaggen zijn afkomstig uit de bron. `#.`-opmerkingen en `msgctxt` worden als context naar het model gestuurd. Items die door sync niet zijn gewijzigd, worden byte voor byte teruggeschreven. Items die de bron niet meer bevat, en verouderde `#~`-items, blijven aan het einde bewaard.

Een catalogus die door Champollion wordt aangemaakt (`init --langs`, of sync voor een locale die nog geen catalogus heeft) krijgt de volledige header die `msginit --no-translator` schrijft en die `msgfmt -c` accepteert: `Project-Id-Version`, `Report-Msgid-Bugs-To` en `POT-Creation-Date` gekopieerd uit het sjabloon (`PACKAGE VERSION` wordt vervangen door de mapnaam van het project, en er is geen `POT-Creation-Date` zonder een sjabloondatum), `PO-Revision-Date` (wanneer het bestand is gemaakt), `Last-Translator: Automatically generated`, `Language-Team: none`, `Language`, `MIME-Version: 1.0`, `Content-Type: text/plain; charset=UTF-8`, `Content-Transfer-Encoding: 8bit` en `Plural-Forms`. De header van een bestaande catalogus wordt nooit herschreven — alleen een tijdelijke aanduiding `Plural-Forms` of `charset=CHARSET` daarin wordt ingevuld.

**Meervouden.** Een item met `msgid_plural` wordt vertaald als één ICU-meervoudsbericht (`{n, plural, one {One file} other {%(count)d files}}`), zodat het model alle vormen in één keer schrijft. Het wordt vervolgens weggeschreven naar `msgstr[0]`…`msgstr[n]` via de `Plural-Forms`-header van het doel. Elke index neemt de CLDR-categorie over van de getallen die deze selecteren. Het Russische `nplurals=3` is `one`, `few`, `many`. Als het doel geen `Plural-Forms`-header heeft, of alleen de sjabloonaanduiding, krijgt het de header die `msginit` voor zijn taal schrijft, zodat de `msgstr[]`-posities van de catalogus overeenkomen met wat gettext en Django selecteren: Frans `nplurals=2; plural=(n > 1);`, Duits `nplurals=2; plural=(n != 1);`, Russisch `nplurals=3; …`. Een taal waarvoor `msginit` geen item heeft, krijgt een van CLDR afgeleide header, gecontroleerd aan de hand van `Intl.PluralRules` voor elk getal tot 3.000 en voor grote getallen. Als de regels van een taal niet als een gettext-expressie kunnen worden geschreven, stopt sync en wordt de opdracht genoemd die de header schrijft: `msginit --locale=<lang> --input=<template>.pot`. Een vorm waarvoor de catalogus geen positie heeft (Frans `many`, voor 1.000.000, in een catalogus met twee vormen) wordt niet opnieuw opgevraagd, noch gemarkeerd of gerapporteerd als ontbrekend; een catalogus met een eigen header behoudt deze, en de posities daarvan worden gecontroleerd.

**Beperkingen.** Catalogi moeten UTF-8 zijn. Converteer andere formaten met `msgconv --to-code=UTF-8`. Een meervouds-msgid waarvan de accolades niet in balans zijn, kan niet als ICU-bericht worden geschreven; deze wordt gerapporteerd en aan u overgelaten om te vertalen. Voer vóór verzending nog steeds `msgfmt --check-format` uit (Django: `compilemessages`). Dit controleert alleen items die gemarkeerd zijn met `#, python-format` (of `c-format`, …): `makemessages` voegt de vlag toe aan de items die het extraheert met een `%`-aanduiding, maar een handmatig gemaakte catalogus kan deze missen, waardoor die items ongecontroleerd blijven. `champollion verify` vergelijkt de printf-aanduidingen van elk item — naam en typeletter — ongeacht de vlaggen, en sync behoudt de vlaggen van het bron-item op elk item dat het vertaalt.

### Flutter ARB-bestanden (.arb) {#arb}

```json title="champollion.config.json"
{ "localesPattern": "lib/l10n/app_{lang}.arb" }
```

Gebruik de `arb-dir` en `template-arb-file` uit uw `l10n.yaml` als deze afwijken (`assets/i18n/intl_{lang}.arb`). Alleen berichten worden vertaald. Bij het wegschrijven:

- `@@locale` wordt ingesteld op het doel in Flutter-formaat, passend bij de bestandsnaam (`app_pt_BR.arb` → `"pt_BR"`). `gen-l10n` weigert een bestand waarvan de `@@locale` niet overeenkomt met de bestandsnaam.
- Elk `@key`-metadata-object (tijdelijke aanduidingen, hun typen, beschrijvingen) wordt gekopieerd uit de bron. Een sleutel waarvoor de bron geen metadata heeft, behoudt die van het doel.
- Sleutels volgen de volgorde van de bron. Onvertaalde berichten worden weggelaten, zodat Flutter terugvalt op het sjabloon.

Bericht-`description`s worden als context naar het model gestuurd. `{name}`-aanduidingen en ICU-meervouden worden beschermd door de [ICU-controle](#icu). `verify` en `integrity` melden ook een onjuiste `@@locale` en metadata van tijdelijke aanduidingen die afwijkt van de bron. Elke synchronisatie die het bestand herschrijft, herstelt beide: `champollion sync --pair en:fr --force` levert elk ongewijzigd bericht uit de cache.

## No-Translate-sleutels {#no-translate}

Sommige waarden hebben in elke taal exact één juiste weergave: een URL, een
repositorypad, een pakketnaam, een productidentificatie. Een juiste vertaling van
`https://example.org/paper` is `https://example.org/paper`.

Champollions [quality gate](/docs/concepts/quality-gate) wijst
source-echo — een vertaling die identiek is aan de bron — af, omdat dit doorgaans
betekent dat een model weigert het werk te doen. Voor deze sleutels leidt dit ertoe
dat het juiste antwoord wordt afgewezen, en er is geen uitvoer die het model kan produceren
die slaagt. Zwakkere modellen leren de gate te omzeilen door de waarde net voldoende te
wijzigen (een verzonnen `#fragment`, een overbodige slash aan het eind, een onzichtbare
spatie met breedte nul), waardoor kapotte links worden opgeleverd. Sterkere modellen
retourneren de waarde ongewijzigd en worden afgekeurd door de gate, waardoor `sync`
bij elke run met een niet-nul-status afsluit.

Declareer in plaats daarvan die sleutels:

```json title="champollion.config.json"
{
  "noTranslate": ["**.url", "pages.software.*.repo", "meta.appId"]
}
```

Een overeenkomende sleutel wordt **letterlijk gekopieerd uit de bron-locale** — nooit naar
een vertaal-backend gestuurd, nooit gecontroleerd door de quality gate, nooit geteld als een
fout en nooit in rekening gebracht. Om dezelfde reden wordt deze uitgesloten van de
kosteninschatting voorafgaand aan de run.

### Patroonsyntaxis

Patronen zijn punt-paden over de afgevlakte sleutelruimte, met twee wildcards:

| Patroon | Komt overeen met | Komt niet overeen met |
|---------|---------|----------------|
| `nav.brand` | `nav.brand` (exact pad) | `nav.brandName` |
| `**.url` | `url`, `pages.a.b.url` (een `url`-leaf op elke diepte) | `pages.urlLabel`, `pages.url.caption` |
| `pages.software.*.repo` | `pages.software.portal.repo` | `pages.software.a.b.repo` |
| `meta.og*` | `meta.ogImage`, `meta.ogTitle` | `meta.twitterImage`, `meta.og.image` |

`*` matcht binnen een enkel segment; `**` matcht nul of meer volledige segmenten.
Een patroon zonder wildcard is een exact sleutelpad.

### URL's worden standaard verwerkt

Omdat een sleutel met een URL-waarde onder de gate geen correct resultaat kan opleveren,
is `noTranslateUrls` standaard `true`: elke bronwaarde die niets anders is dan
een absolute `scheme://`-URL wordt zonder verdere configuratie behandeld als no-translate.

De detectie is bewust strikt — de gehele getrimde waarde moet de URL zijn.
Proza dat slechts een link bevat (`"Read the paper at https://…"`), wordt nog steeds
op de normale wijze vertaald.

Schakel dit uit met `"noTranslateUrls": false` als uw URL's daadwerkelijk
locale-specifiek zijn (bijvoorbeeld documentatiehosts per taal) — en declareer
vervolgens degene die dat niet zijn met `noTranslate`.

### Herstel en handhaving

Voor een no-translate-sleutel is er exact één juiste doelwaarde; elk
verschil is dan ook een defect. Champollion handhaaft dat in beide richtingen:

- **`sync` herstelt het.** Een no-translate-sleutel waarvan het doel ontbreekt,
  een `[EN] `-voorvoegsel heeft of gewijzigd is, wordt herschreven vanuit de bron. Dat kost
  geen API-aanroep en is idempotent: zodra de waarden overeenkomen, slaan latere synchronisaties
  de sleutel volledig over.
- **`verify` en `integrity` falen hierop.** Een afgeweken no-translate-sleutel wordt
  gerapporteerd als `NO-TRANSLATE DRIFT` met de verwachte en werkelijke waarden —
  waarbij onzichtbare tekens worden geëscaped als `\uXXXX`, aangezien dit type corruptie
  anders onmogelijk te zien is in een diff. `champollion integrity` sluit af met code `1`, zodat
  een build die hieraan gekoppeld is een beschadigde URL onderschept voordat deze wordt uitgeleverd.

Als `integrity` op deze manier faalt bij een project dat u zojuist heeft geconfigureerd,
rapporteert het beschadigingen die al in uw locale-bestanden aanwezig waren. Voer `champollion sync`
één keer uit om dit te herstellen.

## Schriftconversie {#script-conversion}

Sommige talen die Champollion vertaalt, kunnen op meer dan één manier worden *geschreven*. Het model werkt altijd in het **werk-schrift** van de taal (Latijnse transcriptie — SRO voor Plains Cree, Okrand-romanisering voor Klingon), waarna een deterministische converter de uitvoer kan herschrijven naar een weergaveschrift. Of dat moet gebeuren, is een beslissing die in de configuratie wordt genomen — **nooit een standaardwaarde**:

| Locale | Werk-schrift | Converteerbaar naar | Type |
|--------|---------------|----------------|------|
| `crk` (Plains Cree) | `Latn` (SRO) | `Cans` (Syllabics) | Echt Unicode — **keuze vereist** |
| `sr` / `srp` (Servisch) | `Latn` | `Cyrl` (Cyrillisch) | Echt Unicode — **keuze vereist** |
| `tlh` (Klingon) | `Latn` (romanisering) | `Piqd` (pIqaD) | PUA — opt-in |
| `x-elvish-s` (Sindarijns) | `Latn` | `Teng` (Tengwar) | PUA — opt-in |
| `x-kryptonian` | `Latn` | Kryptonees | PUA — opt-in via `"script": "x-kryptonian"` |

**Echte Unicode-paren (crk, sr) vereisen de keuze.** Cree Syllabics en Cyrillisch zijn reguliere Unicode — ze worden overal weergegeven — en beide spellingen worden daadwerkelijk gebruikt. Champollion zal niet namens een project het schriftsysteem van een gemeenschap kiezen: `init` vraagt ernaar wanneer u de taal selecteert, en `sync` weigert te draaien totdat de configuratie aangeeft welk schrift gebruikt moet worden:

```json
{
  "languages": {
    "crk": { "script": "Cans" }
  }
}
```

**PUA-schriften (tlh, x-elvish-s, x-kryptonian) vallen standaard terug op romanisering.** pIqaD, Tengwar en Kryptonees zitten *niet in Unicode* — de converters produceren Private Use Area-codepunten die als niets worden weergegeven, tenzij u een lettertype meelevert dat aan die codepunten is gekoppeld. Romanisering is de enige uitvoer die overal correct rendert, en is daarom de standaard. Om in plaats daarvan het weergaveschrift te produceren:

```json
{
  "languages": {
    "tlh": { "script": "Piqd" }
  }
}
```

…en voer `champollion fonts install` uit zodat uw site beschikt over een lettertype dat dit kan weergeven. Als uw lettertypen zijn afgestemd op Latijnse transliteratie (veel conlang-lettertypen zijn dat), behoud dan de standaardwaarde.

`script` accepteert een ISO 15924-code, ongeacht hoofd- of kleine letters (`"cans"`, `"Cans"` en `"CANS"` zijn gelijk). Het kan ook per paar worden ingesteld, wat voorrang heeft op het taalniveau. Een ongeldige waarde, of een schrift dat de locale niet kan produceren, faalt direct bij het opstarten — vóór enige API-aanroep.

### Niet-gemapte letters en `scriptFallback` {#script-fallback}

Converters vertalen wat hun spelling definieert en niets anders. Klingon-romanisering kent geen `d`, `c`, `f`, `g`, `i`, `k`, `s`, `x` of `z` — modeluitvoer die een eigennaam zoals "GitHub" bevat, kan dus niet volledig worden geconverteerd. Champollion **schrijft nooit een half-geconverteerde waarde**: als ook maar één letter niet kan worden gemapt, blijft de gehele waarde in het werk-schrift staan, en noemt de waarschuwing de letters plus de configuratieregel waarmee ze gemapt kunnen worden.

Het is aan u om die toewijzingen te declareren:

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

Elke regel vervangt een reeks in het werk-schrift door een reeks die de converter *wel* kan mappen, voordat de conversie wordt uitgevoerd. Regels worden gevalideerd bij het opstarten — een vervanging die zelf niet gemapt kan worden, wordt afgewezen.

Champollion levert **geen eigen fallback-regels**: het bedenken van orthografische aanpassingen, vooral voor het schriftsysteem van een echte taal, is niet de verantwoordelijkheid van een index. Gemeenschappen en fandoms hanteren conventies — neem deze bewust per project over.

### Ongewenste conversie herstellen {#repair-script}

Vóór versie 0.3.0 was conversie onvoorwaardelijk — projecten die zich richtten op de PUA-locales kregen niet-weer te geven uitvoer, of ze dat nu wilden of niet. Twee hulpmiddelen lossen dit op:

- **`champollion repair-script`** scant locales waarvan de configuratie aangeeft dat conversie *uit* staat op PUA-codepunten en herstelt de romanisering met behulp van de eigen omgekeerde tabel van de converter (gebruik `--dry` voor een voorbeeldweergave). pIqaD keert exact om; Tengwar- en Kryptonese omzettingen verliezen hoofdlettergebruik en melden dat.
- **`champollion integrity`** faalt (exitcode 1) op PUA die wordt aangetroffen terwijl conversie uit staat — zodat een build-gate niet-weer te geven tekst onderschept vóór release, en het rapport noemt de herstelopdracht.

Het Translation Memory hoeft nooit te worden hersteld: het slaat pre-conversiewaarden op, dus het later in- of uitschakelen van `script:` vereist geen cachebewerkingen.

Schriftconversie is van toepassing op UI-strings (sleutel-waarde-bestanden en Docusaurus JSON). Markdown-body's worden nooit geconverteerd — een gretige tekenconverter heeft geen veilige manier om door codefragmenten, URL's en frontmatter heen te werken.

## Paarconfiguratie {#pair-configuration}

Elk bron→doel-paar kan onafhankelijk worden geconfigureerd:

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

### Paarvelden

| Veld | Type | Beschrijving |
|-------|------|-------------|
| `method` | `string` | Vertaalmethode: `llm`, `llm-coached`, `openai`, `anthropic`, `gemini`, `local`, `google-translate`, `deepl`, `microsoft-translator`, `libretranslate`, `apertium`, `tilde`, `translated`, `api` |
| `methodPlugin` | `string` | Naam van een geïnstalleerde plugin (van `.champollion/methods/`) |
| `model` | `string` | Overschrijf het standaardmodel voor dit paar |
| `temperature` | `number` | Overschrijf de standaardtemperatuur voor dit paar |
| `batchSize` | `number` | Overschrijf de standaardbatchgrootte voor dit paar |
| `register` | `string` | Overschrijving van register/toon (preset-sleutel of vrije tekst) |
| `endpoint` | `string` | Externe API-eindpunt-URL. Vereist wanneer `method` `api` is. |
| `coachingFile` | `string` | Pad naar een coaching-promptbestand voor dit paar, gelezen relatief ten opzichte van het project; dit vervangt eventuele minder specifieke coaching, en een bestand dat niet gelezen kan worden stopt de run |
| `promptContext` | `string` | Applicatiecontext voor dit paar |
| `genderGuidance` | `string` \| `false` | Geslachtsinstructie voor de prompts van dit paar: uw eigen tekst, of `false` voor geen. Zie [Gender guidance](#gender-guidance). |
| `qualityTier` | `string` | Een label dat u aan de uitvoer van het paar geeft: `standard`, `high`, `research`, `verified`. Wordt niet gemeten, en sync vertaalt hetzelfde ongeacht wat hier staat; `status` toont het (alleen indien ingesteld) en `serve` adverteert het |
| `fallback` | `object` | Een tweede methode voor wat de methode van dit paar niet veilig kan vertalen. Zie [Fallback-methode](#fallback). `null` verwijdert een fallback die op de taal is ingesteld. |

### Fallback-methode {#fallback}

Een paar kan een tweede methode opgeven. De eigen methode van het paar vertaalt eerst. Alles wat deze niet veilig kan vertalen, gaat eenmalig naar de fallback:

- **Sleutel-waarde-bestanden:** sleutels die de [quality gate](/docs/concepts/quality-gate) heeft geweigerd (een weggelaten `{name}`, een kapot meervoud, een label van twee woorden dat in een alinea is veranderd) en sleutels waarvoor de methode niets heeft geretourneerd.
- **Markdown (Hugo-content en Docusaurus-docs):** frontmatter-velden die zijn weggelaten of waarvan de woorden zijn gewist, en body-blokken die ontbreken in het antwoord, beschadigd zijn (een beschermd element verloren: code, een HTML-tag, een shortcode) of leeggemaakt zijn. Bij `page`-segmentatie: de gehele pagina.

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

Wanneer er geen tekst van uw machines mag vertrekken (een ziekenhuis, een school, een gemeenschap die haar taalgegevens op locatie bewaart), maak de fallback dan een model dat u zelf draait. De methode `local` verstuurt naar een OpenAI-compatibele server op deze machine (Ollama, llama.cpp, vLLM, LM Studio; `LOCAL_API_BASE` stelt het adres in, zie [`local`](/docs/guides/translation-methods#local--your-own-model-ollama-vllm-lm-studio-a-trained-model)):

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

Welke te gebruiken:

- **Een gehost model** (`llm-coached` met een Gemini-model, of een andere API-methode) is doorgaans de sterkere second opinion voor een taal met weinig bronnen, en wordt per verzoek gefactureerd. Gebruik dit wanneer de tekst naar die provider mag worden verzonden.
- **`local`** houdt elke sleutel op deze machine, en de schatting toont dit als `$0 API cost (runs on this machine)`. Gebruik dit wanneer niets de machine mag verlaten, zelfs als het model dat u lokaal kunt draaien kleiner is.

De uitvoer van de fallback doorloopt dezelfde quality gate. Wat deze vertaalt, wordt gecachet onder zijn eigen methode in het Translation Memory, zodat de cache vastlegt welke methode elke waarde heeft geproduceerd. Latere synchronisaties hergebruiken deze in plaats van de eerste methode opnieuw te bevragen; `--fresh` of `--retranslate` vraagt het opnieuw aan. Wat geen van beide methoden vertaalt, blijft zoals het zonder fallback zou zijn. Een sleutel blijft onvertaald en behoudt zijn oude lock-item, zodat de volgende synchronisatie het opnieuw probeert en `champollion verify` deze vermeldt. Een Markdown-blok wordt weggeschreven als bron met `[EN] `-voorvoegsel, niet gecachet, en het bestand wordt bij de volgende synchronisatie opnieuw verwerkt. Een blok of frontmatter-veld dat door de quality gate voor beide methoden is geweigerd, wordt tegengehouden en niet opnieuw naar hen verzonden totdat `--redo files:<page>` de pagina specificeert ([Geweigerde Markdown-blokken en frontmatter-velden](/docs/concepts/quality-gate#refused-markdown-blocks-and-front-matter-fields)). Een frontmatter-veld dat door beide methoden wordt geleegd, of een pagina die geen van beide vertaalt, laat het bestand falen, net als zonder fallback.

Een fallback accepteert dezelfde velden als een paar: `method` (verplicht), `model`, `provider`, `endpoint`, `methodPlugin`, `coachingFile`, `coachingPrompt`, `promptContext`, `register`, `temperature`, `batchSize`, `maxRetries`, `qualityTier`, `contentSegmentation`, `name`. Het wordt op dezelfde wijze opgelost als een paar. Velden die het niet instelt (register, coaching, promptcontext, …) zijn afkomstig van het bijbehorende paar. De eigen `coachingFile` bereikt de prompt en de cachesleutel, en `champollion status` toont deze. Het schriftsysteem behoort toe aan het paar, waardoor `script` en `scriptFallback` op een fallback worden geweigerd, evenals een eigen `fallback` van een fallback. Een onbekende methode, of een fallback die identiek is aan zijn paar, stopt de synchronisatie met een foutmelding die het paar noemt. De fallback moet gereed zijn voor uitvoering voordat de synchronisatie begint, net als de eigen methode van het paar (de API-sleutel moet bijvoorbeeld zijn ingesteld).

- **`--method` en `--model` wijzigen alleen de eigen methode van het paar.** De fallback behoudt wat in het configuratiebestand staat.
- **Kosten.** De inschatting voorafgaand aan de run dekt uitsluitend de eigen methode van het paar: niemand weet van tevoren wat er zal falen. Elke fallback-batch wordt vlak voor uitvoering geprijsd met dezelfde schatter. Met `--max-cost` wordt een batch die de run voorbij het limietbedrag zou brengen (de schatting plus elke fallback-batch tot dan toe) overgeslagen, met een waarschuwing die de sleutels vermeldt. Dat geldt ook voor een fallback waarvan de kosten niet kunnen worden geschat (onbekend is niet gratis). Die sleutels blijven gefaald, en de synchronisatie sluit af met een niet-nul-code, net als bij elke gedeeltelijke mislukking.
- **Rapportage.** `sync` print één regel per paar, bijv. `[FALLBACK] en:crk — 6 key(s) the primary (api) could not translate safely → translated by llm-coached (4 accepted, 2 still failing)`. De samenvatting van `--json` vermeldt per paar wat de fallback heeft gedaan (`method`, `attempted`, `accepted`, `failed`, `cached`): in elk item van `locales` voor sleutel-waarde-bestanden, in `fallback` voor Docusaurus JSON, en in `content.fallback` voor Markdown. `champollion status` toont de fallback onder zijn paar. `--dry` kan niet weten wat er zal falen en rapporteert daarom niets over de fallback.
- **Wanneer de fallback het merendeel heeft geschreven.** Wanneer meer dan de helft van de verse vertalingen van een run voor een paar (de geaccepteerde antwoorden van de methode van het paar plus die van de fallback) afkomstig is van de fallback, voegt `sync` één waarschuwing toe: hoeveel van de hoeveel, met welke methode en welk model, waarom de antwoorden van de methode van het paar niet zijn gebruikt (elke reden geteld: een uit het hoofd geleerde zin herhaald voor verschillende bronstrings, opblazen van lengte, …), en wat te overwegen — de methode van het paar is mogelijk niet geschikt voor deze strings; controleer wat er is geschreven (`verify` controleert de structuur, een spreker controleert de betekenis); een sterkere fallback. De items in `--json` bevatten `primaryAccepted` en `primaryReasons` naast `accepted`. `champollion status` geeft hetzelfde aandeel voor de bestanden ("from the fallback: 8 value(s) in the files (…) — 8 of the 8 sync wrote (100%)"), en meldt wanneer dit het merendeel van de tekst van de locale betreft.
- `champollion serve` maakt ook gebruik van de fallback, binnen de limieten van `--max-cost-per-request` / `--max-session-cost`.

## Taalconfiguratie {#language-configuration}

Talen accepteren drie indelingen:

### Array van codes (eenvoudigst)

```json
{
  "languages": ["fr", "de", "ja"]
}
```

Elke taal krijgt zijn standaardregister uit de ingebouwde registertabel. Talen zonder standaard krijgen `"Professional register."`.

### Object met registerreeksen

De waarde kan een **vooringestelde sleutel** uit de taalkaart zijn, of aangepaste registertekst:

```json
{
  "languages": {
    "fr": "casual-tu",
    "ko": "formal-hapsyo",
    "ja": "Custom: Polite Japanese for a gaming app."
  }
}
```

Champollion controleert of de reeks overeenkomt met een vooringestelde sleutel in de taalkaart. Als dat het geval is, wordt de volledige registerprompt uit de kaart gebruikt. Als dat niet het geval is, wordt de reeks ongewijzigd gebruikt. Zie [Ondersteunde talen](/docs/reference/supported-languages#language-cards) voor beschikbare voorinstellingen.

### Object met volledige configuratie

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

U kunt verkorte notaties en volledige objecten door elkaar gebruiken in hetzelfde blok.


### Taalvelden

| Veld | Type | Beschrijving |
|-------|------|-------------|
| `register` | `string` | Stijl-/tooninstructies. Kan een **preset-sleutel** zijn (bijv. `casual-tu`, `formal-hapsyo`) of aangepaste tekst. Zie [Language Cards](/docs/reference/supported-languages#language-cards). |
| `name` | `string` | Menselijk leesbare taalnaam (voor statusweergave) |
| `model` | `string` | Overschrijf het standaardmodel |
| `temperature` | `number` | Overschrijf de standaardtemperatuur |
| `batchSize` | `number` | Overschrijf de standaardbatchgrootte |
| `coachingFile` | `string` | Pad naar een coaching-promptbestand voor deze taal, gelezen relatief ten opzichte van het project; dit vervangt de coaching op het hoogste niveau, en een bestand dat niet gelezen kan worden stopt de run |
| `promptContext` | `string` | Applicatiecontext voor deze taal |
| `genderGuidance` | `string` \| `false` | Geslachtsinstructie voor de prompts van deze taal: uw eigen tekst, of `false` voor geen. Zie [Gender guidance](#gender-guidance). |
| `maxRetries` | `number` | Maximaal aantal pogingen voor mislukte batches (standaard: 3) |
| `script` | `string` | ISO 15924-code van de spelling die Champollion schrijft (bijv. `"Cans"`, `"Piqd"`). Zie [Script Conversion](#script-conversion). |
| `scriptFallback` | `object` | Transliteratieregels voor letters die de schriftconverter niet kan mappen. Zie [Script Conversion](#script-conversion). |
| `endpoint` | `string` | Externe API-eindpunt-URL, voor `"method": "api"` |
| `fallback` | `object` | Een tweede methode voor wat de methode van deze taal niet veilig kan vertalen. Zie [Fallback-methode](#fallback). |

:::info[Overerveringsketen]
Instellingen worden in deze volgorde opgelost (eerste wint):

**paar-niveau** → **taal-niveau** → **globale configuratie** → **standaardwaarden**

Als `pairs["en:fr"]` bijvoorbeeld `model` instelt, overschrijft dit zowel de `model`-waarden op taal- als op globaal niveau.
:::

### Richtlijnen voor grammaticale geslachten {#gender-guidance}

LLM-prompts bevatten een instructie over grammaticaal geslacht voor talen
die dit kennen. Dit is afkomstig uit de catalogus van Champollion: het Frans vraagt om *écriture
inclusive* met de interpunct wanneer het geslacht van de lezer onbekend is
(`Connecté·e`, niet `Connecté(e)` of `Connectée`; `Utilisateur·rice·s` in het
meervoud), het Duits om de dubbelepuntvorm (`Benutzer:innen`), het Japans om het
neutrale `私`. `champollion init` print dit naast het register van elke taal, en
`champollion status` toont het per paar, inclusief de herkomst ervan.

Kies een andere stijl met `genderGuidance`, voor elke taal of voor een specifieke taal:

```json
{
  "languages": {
    "fr": { "register": "formal-vous", "genderGuidance": "Use the masculine generic (Connecté), as the Académie française recommends." },
    "de": { "register": "formal-Sie", "genderGuidance": false }
  }
}
```

`false` stuurt geen geslachtsinstructie mee; een tekenreeks vervangt die uit de catalogus. De
instelling is van toepassing op methoden die instructies accepteren (de LLM-methoden); engines voor
machinevertaling (DeepL, Google, …) worden niet geïnstrueerd. Een gewijzigde geslachtsinstructie
levert een andere prompt op en heeft daardoor eigen cache-items: wat al
vertaald is, blijft zoals het is totdat u het opnieuw vertaalt (`champollion sync
--redo all`, wat sync voorstelt wanneer de bestanden de eerdere stijl bevatten).

## Niet-Engelse brontaal

Als uw brontaal geen Engels is:

```bash
# CLI flag (one-time)
npx champollion sync --source fr
```

```json title="champollion.config.json (permanent)"
{
  "inputLocale": "fr"
}
```

## Vergrendelingsbestand

Champollion maakt `.champollion.lock` aan om SHA-256-hashes van vertaalde bronwaarden bij te houden. **Commit dit bestand** zodat alle ontwikkelaars dezelfde vertaalbasis delen. In een project met één map per taal worden sleutels vastgelegd als `<namespace>::<key>`.

Per doel-locale legt de lock ook een vingerafdruk vast van elke waarde die door sync is geschreven en van de brontekst die vertaald is (zodat een handmatig bewerkte waarde wordt herkend en een verouderde vertaling wordt gerapporteerd), de sleutels die een redo niet kon afronden (**pending**), en de sleutels die de quality gate heeft geweigerd (**held back** voor hetzelfde model). Zodra er iets van dien aard moet worden vastgelegd, neemt het bestand zijn versie-2-vorm aan, `{"version": 2, "source": {…}, "locales": {…}}`; een versie-1-lock (een platte sleutel → hash-map) wordt gelezen zoals voorheen. Een vervangen handmatige bewerking wordt bewaard in `.champollion-replaced-edits.jsonl` ernaast — commit beide bestanden. Zie [Quality Gate](/docs/concepts/quality-gate#refused-keys-are-held-back) en [Editing translations](/docs/guides/professional-translators#editing-key-value-files).

Wanneer een bronwaarde wijzigt, komt de hash niet meer overeen en vertaalt Champollion die sleutel opnieuw bij de volgende synchronisatie.

## `.champollionignore`

Maak `.champollionignore` aan in de hoofdmap van uw project om bestanden uit te sluiten van `lint`-scanning. Gebruikt globpatronen, zoals `.gitignore`:

```text title=".champollionignore"
src/components/legacy/**
src/utils/constants.js
**/*.test.js
```

## `.champollion/`-map

Champollion maakt een map `.champollion/` aan in uw projectroot voor de interne status. Houd deze buiten versiebeheer — het is een cache per machine, geen projectbron. `champollion init` voegt deze regel toe aan `.gitignore` en maakt het bestand aan als het nog niet bestaat (ook in een map die nog geen git-repository is, zodat een latere `git init` en `git add --all` de cache niet committen):

```gitignore
.champollion/
```

Commit de lock-bestanden ernaast (`.champollion.lock`, `.champollion-content.lock`): deze leggen vast op basis van welke brontekst elke vertaling is gemaakt.

| Bestand | Doel | Committen? |
|------|---------|--------|
| `tm.json` | Translation Memory-cache — slaat eerdere vertalingen op geordend op brontekst + locale + methode | Nee (lokale cache) |
| `xliff/*.xliff` | XLIFF-exportbestanden voor controle door professionele vertalers | Nee (tijdelijk) |
| `methods/` | Manifesten van geïnstalleerde methode-plugins | Genegeerd door de regel `.champollion/`. Om geïnstalleerde plugins te delen, vervangt u die regel door `.champollion/*` en `!.champollion/methods/` |
| `backups/` | Back-ups van vóór het wrappen (aangemaakt door `wrap --undo`) | Nee (vangnet) |

Zie [Vertaalgeheugen](/docs/concepts/translation-memory) voor meer informatie over `tm.json` en hoe het API-kosten bespaart.

---

## Programmatische API

Voor bouwscripts en aangepaste integraties importeert u rechtstreeks vanuit het pakket:

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

### Beschikbare exports

| Export | Wat het doet |
|--------|-------------|
| `TranslationMethod` | Basisklasse voor alle methoden |
| `LLMMethod` | Basisklasse voor LLM-methoden (OpenRouter) |
| `DirectLLMMethod` | Basisklasse voor directe LLM-providers (OpenAI, Anthropic, Gemini) |
| `OpenAIMethod`, `AnthropicMethod`, `GeminiMethod` | Directe LLM-providerklassen |
| `DeepLMethod`, `MicrosoftTranslatorMethod`, `LibreTranslateMethod`, `TildeMethod`, `TranslatedMethod` | Traditionele MT-klassen |
| `GoogleTranslateMethod` | Google Cloud Translation |
| `LLMCoachedMethod` | Gecoachte LLM (OpenRouter + coachinggegevens) |
| `APIMethod` | Externe API-client |
| `runSync`, `runContentSync` | Volledige synchronisatie-pipeline |
| `translateWithFallback`, `translateAndValidate` | De pipeline van één paar voor een batch sleutels, zoals `sync` deze uitvoert: cache, methode, quality gate, cache, vervolgens de fallback van het paar. Geef een paar mee vanuit `resolvePairs`, `tm` vanuit `loadTM`, en `cwd`, de projectmap: de methode leest haar sleutel, eindpunt, coaching en verklarende woordenlijst daar, niet uit `process.cwd()` |
| `createFallbackBudget` | De `--max-cost`-beveiliging voor fallback-batches (`{ maxCost, committed, cwd }`) |
| `discoverLocaleLayout`, `resolveLocaleFiles` | De bestanden waaruit elke locale bestaat (plat, map per locale of `localesPattern`) |
| `resolveConfig`, `resolvePairs` | Configuratieresolutie |
| `validateTranslations` | Quality gate |
| `loadCoachingData`, `findDictionaryMatches` | Coaching-hulpprogramma's |

### Uitbreiding met aangepaste provider

Breid `DirectLLMMethod` uit om een nieuwe LLM-provider toe te voegen in ~40 regels:

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

U krijgt vertaling, coaching, herhaallussen, modelvalidatie, kwaliteitsniveaus en installatiehulp gratis meegeleverd. Alleen de vorm van het HTTP-verzoek is providerspecifiek. Voor niet-LLM-adapters die gebruikmaken van onbewerkte `fetch()`, gebruikt u de gedeelde `fetchWithRetry()`-helper uit `lib/methods/fetch-with-retry.js` in plaats van uw eigen herhaallus te schrijven.

---

## Zie ook

- [CLI-referentie](/docs/reference/cli) — alle opdrachten en vlaggen
- [Vertaalmethoden](/docs/guides/translation-methods) — methoden kiezen en combineren
- [Vertaalgeheugen](/docs/concepts/translation-memory) — caching en kostenbesparing
- [Werken met professionele vertalers](/docs/guides/professional-translators) — XLIFF-workflow
- [Pluginspecificatie](/docs/reference/plugin-spec) — indeling van methode-pluginmanifesten
- [Architectuur](/docs/concepts/architecture) — hoe de onderdelen samenhangen
- [Ondersteunde talen](/docs/reference/supported-languages) — ingebouwde taalondersteuning
- [Hoe synchronisatie werkt](/docs/concepts/how-sync-works) — de vertaalpijplijn
