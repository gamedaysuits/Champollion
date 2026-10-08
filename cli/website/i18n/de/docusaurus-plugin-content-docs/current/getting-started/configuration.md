---
sidebar_position: 3
title: "Konfiguration"
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

# Konfiguration

Champollion funktioniert ohne Konfiguration — es erkennt Locale-Dateien, Format und Zielsprachen automatisch aus Ihrem Projekt. Für mehr Kontrolle erstellen Sie `champollion.config.json` im Stammverzeichnis Ihres Projekts oder führen Sie folgenden Befehl aus:

```bash
npx champollion init
```

## Vollständige Konfigurationsreferenz

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

:::note[typegen ist noch nicht implementiert]
Der Konfigurationsblock `typegen` wird vom Konfigurationslader erkannt und beibehalten, aber die TypeScript-Typgenerierung ist noch nicht implementiert. Dies ist ein Platzhalter für eine geplante Funktion. Das Setzen dieser Werte hat keine Wirkung.
:::


### Felder

| Feld | Typ | Standard | Beschreibung |
|-------|------|---------|-------------|
| `version` | `number` | `3` | Version des Konfigurationsschemas. Immer `3`. |
| `inputLocale` | `string` | `"en"` | Quellsprachcode (BCP 47). |
| `localesDir` | `string` | `"./locales"` | Pfad zu den Locale-Dateien. Enthält eine Datei pro Sprache (`fr.json`) oder einen Ordner pro Sprache (`fr/common.json`). Siehe [Layouts von Locale-Dateien](#locale-layouts). |
| `localesPattern` | `string` | `null` | Speicherort der Dateien jeder Sprache, wenn keines der beiden Formate passt, mit `{lang}` und einem optionalen `{ns}`: `"public/locales/{lang}/{ns}.json"`, `"src/strings/app_{lang}.json"`. Relativ zum Projektstammverzeichnis. Ersetzt `localesDir`. Siehe [Layouts von Locale-Dateien](#locale-layouts). |
| `localesLayout` | `string` | `null` | Überschreibt die Layout-Erkennung: `"flat"` (eine Datei pro Sprache) oder `"dir"` (ein Ordner pro Sprache). Nur erforderlich, wenn sowohl `en.json` als auch `en/` vorhanden sind. |
| `defaultNamespace` | `string` | `null` | In einem Projekt mit einem Ordner pro Sprache und mehreren Dateien: die Datei, zu der `champollion wrap` neue Schlüssel hinzufügt (z. B. `"common"`). |
| `contentDir` | `string` | `null` | Ein Ordner mit zu übersetzenden Markdown/MDX-Dateien: ein Hugo-`content/`-Ordner oder ein beliebiger anderer Ordner, wie etwa `./newsletters` in einer Next.js-App. Jede Übersetzung wird neben ihrer Quelldatei als `<name>.<locale>.md` geschrieben, zum Beispiel `2026-10.md` → `2026-10.crk.md`. Dateien, die bereits nach dem Muster `<name>.<code>.md` benannt sind, werden als Übersetzungen und nicht als Quelldateien behandelt. Siehe [Inhaltsübersetzung](/docs/guides/content-translation). |
| `translatableFields` | `string[]` | `null` | Überschreibt die standardmäßig übersetzbaren Frontmatter-Felder für die Inhaltsübersetzung. `null` verwendet die integrierten Standardwerte (`title`, `description`, `summary`). |
| `format` | `string` | `"auto"` | Dateiformat: `json`, `toml`, `yaml`, `po` ([gettext](#gettext)), `arb` ([Flutter](#arb)) oder `auto` (Erkennung anhand der Dateiendung der Quelldatei; `.yml` gilt als YAML und Zieldateien behalten `.yml`). Jeder andere Wert bricht mit einem Fehler ab. |
| `model` | `string` | `"google/gemini-3.8-flash"` | Standardmodell für LLM-Methoden. Ein exakter Modell-Slug: der vollständige OpenRouter-Slug (`provider/model`). Kurze Aliase (`gemini-flash`) und Floating-IDs (`~vendor/…`, `…-latest`) werden abgelehnt, wobei der anzugebende Slug genannt wird. Direkte Anbieter verwenden einfache Namen (z. B. `gpt-4o`); ein OpenRouter-Slug ihres eigenen Anbieters wird darauf abgebildet (`openai/gpt-4o` → `gpt-4o`), und bei einem Slug, für den sie kein Modell besitzen, wird der Durchlauf abgebrochen, bevor Daten gesendet werden ([Modellnamen](/docs/guides/translation-methods#model-names)). |
| `temperature` | `number` | `0.3` | LLM-Temperatur (0.0–2.0). Niedriger = deterministischer. |
| `defaultMethod` | `string` | `"llm"` | Standard-Übersetzungsmethode: `llm`, `llm-coached`, `openai`, `anthropic`, `gemini`, `local`, `google-translate`, `deepl`, `microsoft-translator`, `libretranslate`, `apertium`, `tilde`, `translated`, `api`. `local` ist ein OpenAI-kompatibler Server auf Ihrem Rechner (standardmäßig Ollama). Wird durch das CLI-Flag `--method` überschrieben. |
| `batchSize` | `number` | `80` | Schlüssel pro Übersetzungscharge (Batch). Höher = weniger API-Aufrufe, aber größere Prompts. |
| `coachingFile` | `string` | `null` | Pfad zu einer Freitext-Coaching-Prompt-Datei (relativ zum Projektstammverzeichnis). Der Inhalt wird beim Start eingelesen und als `Coaching guidance:`-Block in den System-Prompt eingefügt. |
| `promptContext` | `string` | `null` | Anwendungskontext-Zeichenkette, die in den System-Prompt eingefügt wird (z. B. „Produktbeschreibungen für E-Commerce“). Hilft dem Modell, Übersetzungen an Ihre Domäne anzupassen. |
| `genderGuidance` | `string` \| `false` | `null` | Wie LLM-Prompts mit grammatikalischem Geschlecht umgehen. `null` behält den Standard jeder Sprache aus dem Katalog von Champollion bei – für Französisch *écriture inclusive* mit dem Mediopunkt (`Connecté·e`, `Utilisateur·rice·s`); für Deutsch die Doppelpunktform (`Benutzer:innen`). `false` sendet keine Geschlechteranweisung; eine Zeichenkette sendet Ihre eigene (z. B. `"Use the masculine generic."`). Auch pro Sprache und pro Paar konfigurierbar. Siehe [Geschlechter-Richtlinien](#gender-guidance). |
| `protectedTerms` | `string[]` | `[]` | Namen, die in jeder Sprache exakt wie geschrieben beibehalten werden sollen: Personen, Unternehmen, Produkte (z. B. `["Curtis Forbes", "Game Day Suits"]`). Das Modell wird angewiesen, sie beizubehalten, und ein Wert, der nur aus diesen Namen besteht, wird niemals als unübersetzt oder falsche Schrift gekennzeichnet. Dies unterscheidet sich von `noTranslate`, wodurch ganze **Schlüssel** übersprungen werden. |
| `jsonConcurrency` | `number` | `200` | Maximale Anzahl paralleler Locale-Übersetzungen für den JSON-Schlüsselabgleich. Wird durch das CLI-Flag `--json-concurrency` überschrieben. |
| `contentConcurrency` | `number` | `48` | Maximale Anzahl paralleler API-Aufrufe für die Inhaltsübersetzung (Markdown/MDX). Wird durch das CLI-Flag `--content-concurrency` überschrieben. |
| `fallbackPrefix` | `string` | `"[EN] "` | Marker-Präfix, das von `audit` und `verify` verwendet wird, um veraltete unübersetzte Werte aus früheren Durchläufen zu erkennen. Champollion schreibt dieses Präfix nicht – es liest es nur zur Erkennung. |
| `apiKeyEnvVar` | `string` | `"OPENROUTER_API_KEY"` | Name der Umgebungsvariablen für den API-Schlüssel. Überschreiben für benutzerdefinierte Namen von Umgebungsvariablen. |
| `minContentRetention` | `number` | `0.35` | Anteil der Buchstaben/Ziffern der Quelle, die eine Ausgabe beibehalten muss, bevor die [Prüfung auf Inhaltslöschung](/docs/concepts/quality-gate) ihr zweites Signal heranzieht. Auch pro Paar und pro Sprache konfigurierbar. |
| `noTranslate` | `string[]` | `[]` | Punktpfad-Schlüssel und Glob-Muster, deren Wert wörtlich in jedes Locale kopiert wird. Siehe [Nicht zu übersetzende Schlüssel](#no-translate). Wird auch als `skipKeys` akzeptiert. |
| `noTranslateUrls` | `boolean` | `true` | Behandelt Quellwerte, die lediglich eine `scheme://`-URL sind, als nicht zu übersetzen. Setzen Sie `false`, um Schlüssel mit URLs als Wert an das Übersetzungs-Backend zu senden. |
| `baseUrl` | `string` | `""` | Basis-URL für die Erstellung von SEO-Artefakten (hreflang, Sitemaps, JSON-LD). |
| `pairs` | `object` | `{}` | Paarspezifische Überschreibungen für Methode, Modell und Qualität. Siehe [Paarkonfiguration](#pair-configuration). |
| `languages` | `object` | `{}` | Sprachspezifische Überschreibungen. Siehe [Sprachkonfiguration](#language-configuration). |
| `lint.srcDir` | `string` | `null` | Quellverzeichnis für das Lint-Scannen. `null` = automatische Erkennung anhand des Frameworks. |
| `lint.ignore` | `string[]` | `["node_modules", ...]` | Glob-Muster, die vom Linting ausgeschlossen werden sollen. |
| `lint.minLength` | `number` | `2` | Minimale Zeichenkettenlänge, um als fest im Code hinterlegt (hardcoded) markiert zu werden. |
| `seo.urlPattern` | `string` | `"/:locale/:path"` | URL-Muster-Vorlage für die Generierung von hreflang-Tags. |
| `seo.pages` | `string[]` | `null` | Explizite Seitenliste für SEO. `null` = automatische Erkennung anhand von Locale-Schlüsseln. |
| `typegen.output` | `string` | `null` | Ausgabepfad für generierte TypeScript-Typen. `null` = deaktiviert. |
| `typegen.autoGenerate` | `boolean` | `false` | Typen nach jedem Sync automatisch neu generieren. |

## Layouts von Locale-Dateien {#locale-layouts}

Champollion liest Ihre Locale-Dateien dort, wo Ihr Framework sie bereits ablegt. Es gibt drei Strukturen.

**Eine Datei pro Sprache** (`flat`). next-intl, vue-i18n, Hugo, die meisten eigenentwickelten Setups:

```text
messages/
  en.json      ← source
  fr.json
  de.json
```

```json title="champollion.config.json"
{ "localesDir": "./messages" }
```

**Ein Ordner pro Sprache** (`dir`). i18next und react-i18next, bei denen jede Datei ein *Namespace* ist:

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

Champollion wählt `dir`, wenn `<localesDir>/<inputLocale>/` ein Ordner mit Locale-Dateien ist. Jede Quelldatei wird mit demselben Pfad unter dem Ordner der jeweiligen Sprache synchronisiert, und fehlende Dateien sowie Ordner werden erstellt. Ein Namespace kann ein verschachtelter Pfad sein (`admin/users`).

**Jede andere Struktur** (`localesPattern`). Geben Sie den Pfad mit `{lang}` und, falls eine Sprache mehrere Dateien hat, `{ns}` an:

```json title="champollion.config.json"
{ "localesPattern": "src/translations/{ns}/{lang}.json" }
```

`{lang}` darf sich wiederholen, wie in `"{lang}/app_{lang}.json"`. `{ns}` darf einmal vorkommen und sich über Ordner erstrecken. Das Format ergibt sich aus der Dateiendung, sofern `format` nicht gesetzt ist.

`champollion init` findet diese Layouts für Sie. Der Befehl prüft zunächst, ob eine Flutter-App (`pubspec.yaml`, mit `l10n.yaml`, falls vorhanden) oder gettext-Kataloge (`locale/<lang>/LC_MESSAGES/`, `translations/`, GNU `po/`) vorliegen, und schreibt für diese ein `localesPattern`. Anschließend prüft er den üblichen Ordner Ihres Frameworks (`messages/` für next-intl, `public/locales/` dann `locales/` für i18next, `src/locales/` für vue-i18n, `i18n/` für Hugo), danach `locales`, `messages`, `i18n`, `lang`, `translations`, `public/locales`, `src/locales` und `src/i18n`. Er verwendet nur einen Ordner, der die Datei Ihrer Quellsprache enthält, und gibt aus, was gefunden wurde. `init --langs fr,de` erstellt auch die leeren Zieldateien in diesem Layout.

:::note[Wie eine Sprache mit mehreren Dateien synchronisiert wird]
Jede Datei wird separat verglichen, übersetzt und geschrieben. `.champollion.lock` erfasst Schlüssel als `<namespace>::<key>` (`common::nav.home`), ebenso wie `--force-keys`, `xliff`-Unit-IDs und `sync --dry --json`. Ein einfacher Schlüssel in `--force-keys` entspricht diesem Schlüssel in jeder Datei. Projekte mit einer Datei pro Sprache behalten einfache Schlüssel bei, sodass sich deren Lock-Datei nicht ändert.

Das Translation Memory wird nach Quelltext und nicht nach Datei indexiert. Ein String, der in zwei Namespaces vorkommt, wird pro Sprache nur einmal übersetzt. Die zweite Datei bezieht ihn kostenlos aus dem Cache.
:::

Wenn sowohl `en.json` als auch ein befüllter `en/`-Ordner vorhanden sind, bricht Champollion ab und fordert Sie auf, `"localesLayout": "flat"` oder `"dir"` zu setzen, anstatt zu raten.

### i18next-Pluralschlüssel {#i18next-plurals}

i18next speichert Plurale als Geschwisterschlüssel mit einem CLDR-Suffix: `item_one`, `item_other`. Sprachen haben unterschiedliche Pluralformen. Französisch und Spanisch verwenden auch `_many`, Arabisch verwendet sechs Formen und Japanisch nur `_other`. Wenn eine JSON-Quelldatei diese Schlüssel enthält, erhält jedes Ziel genau die Formen seiner eigenen Sprache, ausgelesen aus CLDR über die JavaScript-API `Intl.PluralRules`:

```json title="en.json"
{ "item_one": "{{count}} item", "item_other": "{{count}} items" }
```

Nach einem Sync hat `fr.json` `item_one`, `item_many` und `item_other`, und `ja.json` hat nur `item_other`. Der Sync gibt für Ihre eigenen Sprachen an, welche Formen jeweils hinzukommen oder wegfallen.

Neue Formen werden aus dem `_other`-Text der Quelle übersetzt, `_one` aus `_one`. Ein `_zero` in der Quelle wird in jeder Sprache beibehalten, da i18next diesen bei einer Anzahl von 0 in allen Sprachen abfragt. Wenn ein früherer Sync eine Form geschrieben hat, die die Sprache nicht verwendet, wie etwa `item_one` im Japanischen, entfernt der Sync diese nur dann, wenn das Translation Memory belegt, dass der Sync diesen Wert erzeugt hat. Ein manuell geschriebener Wert bleibt erhalten. Ein Schlüssel für eine Form, die die Sprache nicht besitzt und für die auch die Quelle keinen Schlüssel hat (spanisches `item_two`), wird niemals von selbst entfernt: `verify` nennt ihn, und `sync --prune plural-extras` entfernt genau diese Schlüssel unter Auflistung jedes einzelnen (mit `--dry` wird angezeigt, was entfernt werden würde). Für eine Sprache, für die CLDR keine Pluralregeln enthält, werden die Formen der Quelle eins zu eins kopiert, worauf der Sync hinweist.

### ICU-Nachrichten {#icu}

Werte, die im ICU MessageFormat (next-intl, react-intl, vue-i18n, Flutter) verfasst sind, mischen Code mit Text:

```json
{ "items": "{count, plural, =0 {No events} one {# event} other {# events}}" }
```

Nur der Text innerhalb der Verzweigungen wird übersetzt. Das [Quality-Gate](/docs/concepts/quality-gate) weist Übersetzungen ab, die irgendetwas anderes verändern:

- Variablennamen (`count`, `{name}`), die niemals umbenannt oder weggelassen werden;
- die Wörter `plural`, `select` und `selectordinal` sowie den Typ von `{price, number}`;
- Selektoren (`=0`, `one`, `other`, `male`). Ein `select` behält exakt seine Optionen bei. Ein `plural` behält die Selektoren der Quelle bei und kann die von der Zielsprache verwendeten Kategorien aus CLDR hinzufügen: Französisch fügt `many` hinzu, Polnisch `few` und `many`. Eine Kategorie, die die Sprache nicht verwendet, kann entfallen, so wie Japanisch nur `other` behält;
- `#` in jedem Pluralzweig, der dies enthält, außer `zero`, `one`, `two` und `=N`, wo eine Sprache die Zahl möglicherweise als Wort ausschreibt;
- `offset:N`, verschachtelte Argumente und printf-Konvertierungen wie `%s`, `%d` und `%(name)s`.

Dem Modell wird mitgeteilt, welche Kategorien die Zielsprache verwendet. Eine abgelehnte Übersetzung wird einmal unter Angabe des Grundes wiederholt, beispielsweise `ICU keyword 'other' was translated to 'óthér'`. Ein Apostroph vor einem Platzhalter (`d'{name}`) ist zulässig. `verify` und `integrity` führen dieselbe Prüfung für bereits geschriebene Dateien durch. Ein einfaches `sync` behält einen bereits auf der Festplatte vorhandenen Wert bei, sodass jeder Befund den Befehl nennt, der ihn repariert: `champollion sync --pair <pair> --redo keys:<key>`. Wenn der beschädigte Wert aus dem Translation Memory stammte, entfernen sie ihn aus dem Cache, sodass dieser Befehl den Schlüssel erneut übersetzt, anstatt denselben Text auszuliefern; kein `--fresh` ist erforderlich.

### gettext-Kataloge (.po) {#gettext}

Verweisen Sie mit `localesPattern` (oder `localesDir`) auf Ihre Kataloge:

```json title="Django"
{ "localesPattern": "locale/{lang}/LC_MESSAGES/{ns}.po" }
```

```json title="GNU (po/fr.po, po/de.po, po/hello.pot)"
{ "localesDir": "./po", "format": "po" }
```

**Die Quelle** ist der Katalog der Quellsprache, beispielsweise `locale/en/LC_MESSAGES/django.po` aus `django-admin makemessages -l en`. Dessen `msgid` ist der zu übersetzende Text, wenn `msgstr` leer ist. Wenn dieser Katalog nicht existiert, dient eine `.pot`-Vorlage als Quelle:

- Mit `localesDir`: die eine Datei `.pot` in diesem Ordner.
- Mit `localesPattern`: `<name>.pot` in dem Ordner vor dem ersten Platzhalter oder dem Ordner darüber. `<name>` ist der Namespace (`{ns}`, eine Vorlage pro Domäne wie `django.pot`) oder der Dateiname des Musters ohne `{lang}` (`messages.po` → `messages.pot`).
- Mit `localesLayout: "dir"`: Es wird nach keiner Vorlage gesucht. Belassen Sie den Quellkatalog in `<localesDir>/<source>/`.

Zwei Vorlagen, wo nur eine erwartet wird, brechen den Durchlauf ab. Champollion rät nicht, welche davon die Quelle ist.

**Schlüssel.** Jede `msgid` ist ein Schlüssel. Ein Eintrag mit einem `msgctxt` erhält den Schlüssel `msgctxt` + U+0004 + `msgid`, gettexts eigene Kodierung. „Open“ als Verb und „Open“ als Adjektiv sind separate Schlüssel und separate Cache-Einträge. Berichte geben das Trennzeichen als `␄` aus (`verb␄Open`), und `--force-keys "verb␄Open"` akzeptiert dies. Wenn Sie `␄` nicht eingeben können, schreiben Sie `\x04` (`--force-keys 'verb\x04Open'`): beide Schreibweisen funktionieren. `--force-keys` (und `--redo keys:`) trennt an Kommas; schreiben Sie ein Komma innerhalb einer msgid als `\,` und setzen Sie das Argument in Anführungszeichen: `--redo 'keys:Welcome back\, %(name)s!'`. Unveränderte Einträge kommen kostenlos aus dem Cache.

**Was übersetzt wird.** Ein Eintrag mit leerem `msgstr` oder ein als `fuzzy` markierter Eintrag gilt als unübersetzt. Der Sync übersetzt ihn und entfernt `fuzzy` zusammen mit den vorherigen msgid-Zeilen `#|`. Übersetzerkommentare (`# …`) bleiben erhalten. Referenzen (`#:`), extrahierte Kommentare (`#.`) und Flags stammen aus der Quelle. `#.`-Kommentare und `msgctxt` werden als Kontext an das Modell gesendet. Einträge, die durch den Sync nicht geändert wurden, werden Byte für Byte zurückgeschrieben. Einträge, die in der Quelle nicht mehr vorhanden sind, sowie veraltete `#~`-Einträge werden am Ende beibehalten.

Ein Katalog, den Champollion erstellt (`init --langs` oder Sync für ein Locale, das noch keinen Katalog hat), erhält den vollständigen Header, den `msginit --no-translator` schreibt und den `msgfmt -c` akzeptiert: `Project-Id-Version`, `Report-Msgid-Bugs-To` und `POT-Creation-Date`, kopiert aus der Vorlage (`PACKAGE VERSION` wird durch den Ordnernamen des Projekts ersetzt, und ohne ein Vorlagendatum gibt es kein `POT-Creation-Date`), `PO-Revision-Date` (Erstellungszeitpunkt der Datei), `Last-Translator: Automatically generated`, `Language-Team: none`, `Language`, `MIME-Version: 1.0`, `Content-Type: text/plain; charset=UTF-8`, `Content-Transfer-Encoding: 8bit` und `Plural-Forms`. Der Header eines bestehenden Katalogs wird niemals neu geschrieben – lediglich ein Platzhalter `Plural-Forms` oder `charset=CHARSET` darin wird ausgefüllt.

**Plurale.** Ein Eintrag mit `msgid_plural` wird als eine einzige ICU-Pluralnachricht (`{n, plural, one {One file} other {%(count)d files}}`) übersetzt, sodass das Modell alle Formen auf einmal schreibt. Er wird dann über den `Plural-Forms`-Header des Ziels in `msgstr[0]`…`msgstr[n]` geschrieben. Jeder Index übernimmt die CLDR-Kategorie der Zahlen, die ihn auswählen. Russisches `nplurals=3` ist `one`, `few`, `many`. Wenn das Ziel keinen `Plural-Forms`-Header oder nur den Vorlagenplatzhalter besitzt, erhält es den Header, den `msginit` für seine Sprache schreibt, sodass die `msgstr[]`-Slots des Katalogs genau denen entsprechen, die gettext und Django auswählen: Französisch `nplurals=2; plural=(n > 1);`, Deutsch `nplurals=2; plural=(n != 1);`, Russisch `nplurals=3; …`. Eine Sprache, für die `msginit` keinen Eintrag hat, erhält einen von CLDR abgeleiteten Header, der für jede Zahl bis 3.000 sowie für große Zahlen anhand von `Intl.PluralRules` geprüft wird. Wenn sich die Regeln einer Sprache nicht als gettext-Ausdruck schreiben lassen, bricht der Sync ab und nennt den Befehl, der den Header schreibt: `msginit --locale=<lang> --input=<template>.pot`. Eine Form, für die der Katalog keinen Slot hat (französisches `many` für 1 000 000 in einem Katalog mit zwei Formen), wird weder erneut angefordert noch als fehlend markiert oder gemeldet; ein Katalog mit eigenem Header behält diesen, und seine Slots sind diejenigen, die geprüft werden.

**Einschränkungen.** Kataloge müssen in UTF-8 vorliegen. Konvertieren Sie andere mit `msgconv --to-code=UTF-8`. Eine Plural-msgid, deren geschweifte Klammern nicht ausgeglichen sind, kann nicht als ICU-Nachricht verfasst werden; sie wird gemeldet und verbleibt für Sie zur manuellen Übersetzung. Führen Sie vor der Veröffentlichung dennoch `msgfmt --check-format` aus (Django: `compilemessages`). Dies prüft nur Einträge, die mit `#, python-format` (oder `c-format`, …) gekennzeichnet sind: `makemessages` fügt das Flag den Einträgen hinzu, die es mit einem `%`-Platzhalter extrahiert, aber einem manuell erstellten Katalog fehlt dies möglicherweise, sodass diese Einträge ungeprüft bleiben. `champollion verify` vergleicht die printf-Platzhalter jedes Eintrags – Name und Typbuchstabe – ungeachtet seiner Flags, und der Sync behält die Flags des Quelleintrags bei jedem übersetzten Eintrag bei.

### Flutter-ARB-Dateien (.arb) {#arb}

```json title="champollion.config.json"
{ "localesPattern": "lib/l10n/app_{lang}.arb" }
```

Verwenden Sie `arb-dir` und `template-arb-file` aus Ihrer `l10n.yaml`, falls diese abweichen (`assets/i18n/intl_{lang}.arb`). Es werden nur Nachrichten übersetzt. Beim Schreiben:

- `@@locale` wird für das Ziel in Flutters Format passend zum Dateinamen gesetzt (`app_pt_BR.arb` → `"pt_BR"`). `gen-l10n` lehnt eine Datei ab, deren `@@locale` nicht mit ihrem Namen übereinstimmt.
- Jedes `@key`-Metadatenobjekt (Platzhalter, deren Typen, Beschreibungen) wird aus der Quelle kopiert. Ein Schlüssel, für den die Quelle keine Metadaten besitzt, behält die des Ziels bei.
- Die Schlüssel folgen der Reihenfolge der Quelle. Unübersetzte Nachrichten werden weggelassen, sodass Flutter auf die Vorlage zurückgreift.

`description` von Nachrichten werden als Kontext an das Modell gesendet. `{name}`-Platzhalter und ICU-Plurale werden durch die [ICU-Prüfung](#icu) geschützt. `verify` und `integrity` melden außerdem ein falsches `@@locale` sowie Platzhalter-Metadaten, die von der Quelle abweichen. Jeder Sync, der die Datei neu schreibt, repariert beides: `champollion sync --pair en:fr --force` liefert jede unveränderte Nachricht aus dem Cache aus.

## Nicht zu übersetzende Schlüssel {#no-translate}

Manche Werte haben in jeder Sprache exakt eine korrekte Darstellung: eine URL, ein Repository-Pfad, ein Paketname, ein Produktbezeichner. Eine korrekte Übersetzung von `https://example.org/paper` ist `https://example.org/paper`.

Das [Quality-Gate](/docs/concepts/quality-gate) von Champollion weist Quellen-Echos (source-echo) – eine Übersetzung, die mit ihrer Quelle identisch ist – ab, da dies normalerweise darauf hindeutet, dass ein Modell die Bearbeitung verweigert. Bei solchen Schlüsseln führt dies dazu, dass die korrekte Antwort abgewiesen wird und das Modell keine Ausgabe erzeugen kann, die die Prüfung besteht. Schwächere Modelle lernen, das Gate zu umgehen, indem sie den Wert gerade ausreichend verändern (ein fingiertes `#fragment`, ein überflüssiger abschließender Schrägstrich, ein unsichtbares Nullbreiten-Leerzeichen), was zu defekten Links führt. Leistungsfähigere Modelle geben den Wert unverändert zurück und scheitern am Gate, sodass `sync` bei jedem Durchlauf mit einem Exit-Code ungleich null abbricht.

Deklarieren Sie stattdessen diese Schlüssel:

```json title="champollion.config.json"
{
  "noTranslate": ["**.url", "pages.software.*.repo", "meta.appId"]
}
```

Ein übereinstimmender Schlüssel wird **wörtlich aus dem Quell-Locale kopiert** – er wird niemals an ein Übersetzungs-Backend gesendet, durchläuft kein Quality-Gate, wird nie als Fehler gewertet und verursacht keine Kosten. Aus demselben Grund wird er von der Kostenschätzung vor dem Durchlauf ausgeschlossen.

### Mustersyntax

Muster sind Punktpfade über den flachen Schlüsselraum mit zwei Wildcards:

| Muster | Entspricht | Entspricht nicht |
|---------|---------|----------------|
| `nav.brand` | `nav.brand` (exakter Pfad) | `nav.brandName` |
| `**.url` | `url`, `pages.a.b.url` (ein `url`-Blatt auf beliebiger Tiefe) | `pages.urlLabel`, `pages.url.caption` |
| `pages.software.*.repo` | `pages.software.portal.repo` | `pages.software.a.b.repo` |
| `meta.og*` | `meta.ogImage`, `meta.ogTitle` | `meta.twitterImage`, `meta.og.image` |

`*` matcht innerhalb eines einzelnen Segments; `**` matcht null oder mehr vollständige Segmente. Ein Muster ohne Wildcard ist ein exakter Schlüsselpfad.

### URLs werden standardmäßig verarbeitet

Da ein Schlüssel mit einer URL als Wert unter dem Quality-Gate kein gültiges Ergebnis erzielen kann, ist `noTranslateUrls` standardmäßig `true`: Jeder Quellwert, der lediglich aus einer absoluten `scheme://`-URL besteht, wird ohne zusätzliche Konfiguration als nicht zu übersetzen behandelt.

Die Erkennung ist bewusst eng gefasst – der gesamte getrimmte Wert muss die URL sein. Fließtext, der lediglich einen Link enthält (`"Read the paper at https://…"`), wird weiterhin normal übersetzt.

Deaktivieren Sie dies mit `"noTranslateUrls": false`, wenn Ihre URLs tatsächlich sprachspezifisch sind (beispielsweise separate Dokumentations-Hosts pro Sprache) – und deklarieren Sie diejenigen, die es nicht sind, mit `noTranslate`.

### Reparatur und Durchsetzung

Für einen nicht zu übersetzenden Schlüssel gibt es genau einen korrekten Zielwert; jede Abweichung ist daher ein Fehler. Champollion setzt dies in beiden Richtungen durch:

- **`sync` repariert es.** Ein nicht zu übersetzender Schlüssel, dessen Zielwert fehlt, mit `[EN] ` vorangestellt ist oder geändert wurde, wird anhand der Quelle neu geschrieben. Das erfordert keinen API-Aufruf und ist idempotent: Sobald die Werte übereinstimmen, überspringen spätere Synchronisierungen den Schlüssel vollständig.
- **`verify` und `integrity` schlagen fehl.** Ein abgewichener, nicht zu übersetzender Schlüssel wird als `NO-TRANSLATE DRIFT` mit den erwarteten und tatsächlichen Werten gemeldet – unsichtbare Zeichen werden als `\uXXXX` maskiert, da diese Art von Beschädigung in einem Diff sonst unmöglich zu erkennen ist. `champollion integrity` wird mit `1` beendet, sodass ein daran angebundener Build eine beschädigte URL abfängt, bevor sie ausgeliefert wird.

Wenn `integrity` auf diese Weise bei einem Projekt fehlschlägt, das Sie gerade eingerichtet haben, meldet es Beschädigungen, die bereits in Ihren Locale-Dateien vorhanden waren. Führen Sie `champollion sync` einmal aus, um diese zu reparieren.

## Schriftkonvertierung {#script-conversion}

Einige Sprachen, die Champollion übersetzt, können auf mehr als eine Art *geschrieben* werden. Das Modell arbeitet immer in der **Arbeitsschrift** der Sprache (lateinische Umschrift – SRO für Plains Cree, Okrand-Umschrift für Klingonisch), und ein deterministischer Konverter kann die Ausgabe anschließend in eine Anzeigeschrift umschreiben. Ob dies geschehen soll, ist eine Entscheidung, die in der Konfiguration getroffen wird – **niemals ein Standard**:

| Locale | Arbeitsschrift | Konvertierbar in | Art |
|--------|---------------|----------------|------|
| `crk` (Plains Cree) | `Latn` (SRO) | `Cans` (Silbenschrift) | Echtes Unicode – **Auswahl erforderlich** |
| `sr` / `srp` (Serbisch) | `Latn` | `Cyrl` (Kyrillisch) | Echtes Unicode – **Auswahl erforderlich** |
| `tlh` (Klingonisch) | `Latn` (Umschrift) | `Piqd` (pIqaD) | PUA – Opt-in |
| `x-elvish-s` (Sindarin) | `Latn` | `Teng` (Tengwar) | PUA – Opt-in |
| `x-kryptonian` | `Latn` | Kryptonisch | PUA – Opt-in über `"script": "x-kryptonian"` |

**Echte Unicode-Paare (crk, sr) erfordern die Auswahl.** Cree-Silbenschrift und Kyrillisch sind reguläres Unicode – sie werden überall dargestellt – und beide Orthografien sind im realen Gebrauch. Champollion wählt das Schriftsystem einer Sprachgemeinschaft nicht stellvertretend für ein Projekt aus: `init` fragt nach, wenn Sie die Sprache auswählen, und `sync` verweigert die Ausführung, bis die Konfiguration angibt, welches verwendet werden soll:

```json
{
  "languages": {
    "crk": { "script": "Cans" }
  }
}
```

**PUA-Schriften (tlh, x-elvish-s, x-kryptonian) verwenden standardmäßig die lateinische Umschrift.** pIqaD, Tengwar und Kryptonisch sind *nicht in Unicode* enthalten – die Konverter erzeugen Codepunkte aus dem Bereich für private Nutzung (Private Use Area, PUA), die nur dann dargestellt werden, wenn Sie eine Schriftart mitliefern, die diesen Codepunkten zugeordnet ist. Die Umschrift ist die einzige Ausgabe, die überall gerendert wird, weshalb sie die Standardeinstellung ist. Um stattdessen die Anzeigeschrift auszugeben:

```json
{
  "languages": {
    "tlh": { "script": "Piqd" }
  }
}
```

… und führen Sie `champollion fonts install` aus, damit Ihre Website über eine Schriftart verfügt, die diese darstellen kann. Wenn Ihre Schriftarten auf lateinische Transliteration ausgelegt sind (wie es bei vielen Conlang-Schriftarten der Fall ist), behalten Sie den Standardwert bei.

`script` akzeptiert einen ISO-15924-Code in beliebiger Groß-/Kleinschreibung (`"cans"`, `"Cans"` und `"CANS"` sind identisch). Es kann auch pro Paar festgelegt werden, was Vorrang vor der Sprachebene hat. Ein ungültiger Wert oder eine Schrift, die das Locale nicht erzeugen kann, führt beim Start zum Fehler – noch vor jedem API-Aufruf.

### Nicht zugeordnete Buchstaben und `scriptFallback` {#script-fallback}

Konverter übertragen das, was ihre Orthografie definiert, und nichts anderes. Die klingonische Umschrift kennt kein `d`, `c`, `f`, `g`, `i`, `k`, `s`, `x` oder `z` – daher kann eine Modellausgabe, die einen Eigennamen wie „GitHub“ enthält, nicht vollständig konvertiert werden. Champollion **schreibt niemals einen halb konvertierten Wert**: Wenn ein Buchstabe nicht zugeordnet werden kann, bleibt der gesamte Wert in der Arbeitsschrift, und die Warnung benennt die Buchstaben sowie die Konfigurationszeile, mit der sie zugeordnet werden könnten.

Diese Zuordnungen können Sie selbst deklarieren:

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

Jede Regel ersetzt eine Sequenz der Arbeitsschrift durch eine, die der Konverter zuordnen *kann*, bevor die Konvertierung ausgeführt wird. Regeln werden beim Start validiert – eine Ersetzung, die selbst nicht zugeordnet werden kann, wird abgewiesen.

Champollion liefert **keine eigenen Fallback-Regeln** mit: Das Erfinden orthografischer Anpassungen, insbesondere für das Schriftsystem einer realen Sprache, ist nicht Sache eines Index-Werkzeugs. Gemeinschaften und Fangemeinden haben Konventionen – übernehmen Sie diese gezielt pro Projekt.

### Unerwünschte Konvertierungen reparieren {#repair-script}

Vor Version 0.3.0 erfolgte die Konvertierung bedingungslos – Projekte, die auf PUA-Locales abzielten, erhielten nicht darstellbare Ausgaben, ob sie wollten oder nicht. Zwei Werkzeuge schließen diese Lücke:

- **`champollion repair-script`** durchsucht Locales, deren Konfiguration besagt, dass die Konvertierung *deaktiviert* ist, nach PUA-Codepunkten und stellt die lateinische Umschrift mithilfe der internen Umkehrtabelle des Konverters wieder her (`--dry` zur Vorschau). pIqaD wird exakt umgekehrt; bei Tengwar und Kryptonisch geht die Großschreibung bei der Rückumwandlung verloren, worauf hingewiesen wird.
- **`champollion integrity`** schlägt fehl (Exit-Code 1), wenn PUA an Stellen gefunden wird, an denen die Konvertierung deaktiviert ist – sodass ein Build-Gate nicht darstellbaren Text abfängt, bevor er ausgeliefert wird, und der Bericht nennt die Reparaturmaßnahme.

Das Translation Memory muss niemals repariert werden: Es speichert Werte vor der Konvertierung, sodass das spätere Ein- oder Ausschalten von `script:` keine Anpassung des Caches erfordert.

Die Schriftkonvertierung gilt für UI-Zeichenketten (Key-Value-Dateien und Docusaurus-JSON). Markdown-Inhaltstexte werden niemals konvertiert – ein gieriger Zeichenkonverter kann Codeabschnitte, URLs und Frontmatter nicht sicher durchlaufen.

## Paar-Konfiguration {#pair-configuration}

Jedes Quelle→Ziel-Paar kann unabhängig konfiguriert werden:

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

### Paar-Felder

| Feld | Typ | Beschreibung |
|-------|------|-------------|
| `method` | `string` | Übersetzungsmethode: `llm`, `llm-coached`, `openai`, `anthropic`, `gemini`, `local`, `google-translate`, `deepl`, `microsoft-translator`, `libretranslate`, `apertium`, `tilde`, `translated`, `api` |
| `methodPlugin` | `string` | Name eines installierten Plugins (aus `.champollion/methods/`) |
| `model` | `string` | Überschreibt das Standardmodell für dieses Paar |
| `temperature` | `number` | Überschreibt die Standardtemperatur für dieses Paar |
| `batchSize` | `number` | Überschreibt die Standard-Batchgröße für dieses Paar |
| `register` | `string` | Überschreibung für Sprachregister/Tonfall (Preset-Schlüssel oder Freitext) |
| `endpoint` | `string` | Remote-API-Endpunkt-URL. Erforderlich, wenn `method` auf `api` gesetzt ist. |
| `coachingFile` | `string` | Pfad zu einer Coaching-Prompt-Datei für dieses Paar, relativ zum Projekt gelesen; ersetzt weniger spezifisches Coaching, und eine nicht lesbare Datei bricht den Durchlauf ab |
| `promptContext` | `string` | Anwendungskontext für dieses Paar |
| `genderGuidance` | `string` \| `false` | Geschlechteranweisung für Prompts dieses Paars: Ihr eigener Text oder `false` für keine Anweisung. Siehe [Geschlechter-Richtlinien](#gender-guidance). |
| `qualityTier` | `string` | Ein Label, das Sie der Ausgabe des Paars zuweisen: `standard`, `high`, `research`, `verified`. Wird nicht gemessen, und der Sync übersetzt unabhängig vom Inhalt identisch; `status` zeigt es an (nur wenn gesetzt) und `serve` gibt es bekannt |
| `fallback` | `object` | Eine zweite Methode für Inhalte, die die Methode dieses Paars nicht sicher übersetzen kann. Siehe [Fallback-Methode](#fallback). `null` entfernt einen auf Sprachebene festgelegten Fallback. |

### Fallback-Methode {#fallback}

Ein Paar kann eine zweite Methode angeben. Die eigene Methode des Paars übersetzt zuerst. Was sie nicht sicher übersetzen kann, wird einmal an den Fallback übergeben:

- **Key-Value-Dateien:** Schlüssel, die das [Quality-Gate](/docs/concepts/quality-gate) abgewiesen hat (ein verloren gegangenes `{name}`, ein fehlerhafter Plural, ein aus zwei Wörtern bestehendes Label, das zu einem Absatz wurde) und Schlüssel, für die die Methode kein Ergebnis zurückgeliefert hat.
- **Markdown (Hugo-Inhalte und Docusaurus-Dokumentation):** Frontmatter-Felder, die sie ausgelassen oder deren Wörter sie geleert hat, sowie Textblöcke im Hauptteil, die sie in ihrer Antwort ausgelassen, beschädigt (ein geschütztes Element verloren: Code, ein HTML-Tag, ein Shortcode) oder geleert hat. Bei der Segmentierung mit `page` die gesamte Seite.

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

Wenn kein Text Ihre Rechner verlassen darf (ein Krankenhaus, eine Schule, eine Gemeinschaft, die ihre Sprachdaten vor Ort behält), konfigurieren Sie als Fallback ein Modell, das Sie selbst betreiben. Die Methode `local` sendet Anfragen an einen OpenAI-kompatiblen Server auf diesem Rechner (Ollama, llama.cpp, vLLM, LM Studio; `LOCAL_API_BASE` legt die Adresse fest, siehe [`local`](/docs/guides/translation-methods#local--your-own-model-ollama-vllm-lm-studio-a-trained-model)):

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

Welches verwendet werden sollte:

- **Ein gehostetes Modell** (`llm-coached` mit einem Gemini-Modell oder eine andere API-Methode) ist in der Regel die stärkere Zweitmeinung für eine ressourcenarme Sprache und wird pro Anfrage abgerechnet. Verwenden Sie es, wenn der Text an diesen Anbieter gesendet werden darf.
- **`local`** behält jeden Schlüssel auf diesem Rechner, und die Schätzung weist es als `$0 API cost (runs on this machine)` aus. Verwenden Sie es, wenn nichts den Rechner verlassen darf, selbst wenn das dort ausführbare Modell kleiner ist.

Die Ausgabe des Fallbacks durchläuft dasselbe Quality-Gate. Was übersetzt wird, wird unter dessen eigener Methode im Translation Memory zwischengespeichert, sodass der Cache erfasst, welche Methode welchen Wert erzeugt hat. Spätere Synchronisierungen verwenden ihn wieder, anstatt die primäre Methode erneut abzufragen; `--fresh` oder `--retranslate` fragt erneut an. Was keine der beiden Methoden übersetzt, bleibt so, wie es ohne Fallback der Fall wäre. Ein Schlüssel bleibt unübersetzt und behält seinen alten Lock-Eintrag, sodass der nächste Sync ihn erneut versucht und `champollion verify` ihn auflistet. Ein Markdown-Block wird als Quelltext mit dem Präfix `[EN] ` geschrieben, nicht zwischengespeichert und beim nächsten Sync erneut verarbeitet. Ein Block oder Frontmatter-Feld, das das Quality-Gate bei beiden Methoden abgewiesen hat, wird zurückgehalten und nicht erneut an diese gesendet, bis `--redo files:<page>` die Seite benennt ([Abgewiesene Markdown-Blöcke und Frontmatter-Felder](/docs/concepts/quality-gate#refused-markdown-blocks-and-front-matter-fields)). Ein Frontmatter-Feld, das von beiden Methoden geleert wird, oder eine Seite, die von keiner Methode übersetzt wird, führt zum Fehlschlagen der Datei, genau wie ohne Fallback.

Ein Fallback akzeptiert dieselben Felder wie ein Paar: `method` (erforderlich), `model`, `provider`, `endpoint`, `methodPlugin`, `coachingFile`, `coachingPrompt`, `promptContext`, `register`, `temperature`, `batchSize`, `maxRetries`, `qualityTier`, `contentSegmentation`, `name`. Es wird wie ein Paar aufgelöst. Felder, die es nicht festlegt (Sprachregister, Coaching, Prompt-Kontext, …), stammen von seinem Paar. Dessen eigenes `coachingFile` gelangt in seinen Prompt und seinen Cache-Schlüssel, und `champollion status` zeigt es an. Das Schriftsystem gehört zum Paar, daher werden `script` und `scriptFallback` bei einem Fallback abgelehnt, ebenso wie ein eigenes `fallback` des Fallbacks. Eine unbekannte Methode oder ein Fallback, der mit seinem Paar identisch ist, bricht den Sync mit einem Fehler ab, der das Paar benennt. Der Fallback muss vor Beginn des Syncs betriebsbereit sein, genau wie die primäre Methode des Paars (beispielsweise muss der API-Schlüssel gesetzt sein).

- **`--method` und `--model` ändern ausschließlich die Methode des Paars selbst.** Der Fallback behält die Einstellungen der Konfigurationsdatei bei.
- **Kosten.** Die Vorab-Kostenschätzung deckt nur die primäre Methode des Paars ab: Niemand weiß im Voraus, woran sie scheitern wird. Jede Fallback-Charge wird unmittelbar vor ihrer Ausführung mit demselben Schätzer bewertet. Bei `--max-cost` wird eine Charge übersprungen, die dazu führen würde, dass der Durchlauf das Limit überschreitet (die Schätzung plus alle bisherigen Fallback-Chargen), zusammen mit einer Warnung, die die Schlüssel benennt. Ebenso verhält es sich mit einem Fallback, dessen Kosten nicht geschätzt werden können (unbekannt bedeutet nicht kostenlos). Diese Schlüssel bleiben fehlgeschlagen, und der Sync endet mit einem Exit-Code ungleich null wie bei jedem teilweisen Fehlschlag.
- **Berichterstattung.** `sync` gibt eine Zeile pro Paar aus, z. B. `[FALLBACK] en:crk — 6 key(s) the primary (api) could not translate safely → translated by llm-coached (4 accepted, 2 still failing)`. Die Zusammenfassung von `--json` gibt für jedes Paar an, was der Fallback getan hat (`method`, `attempted`, `accepted`, `failed`, `cached`): in jedem Eintrag von `locales` für Key-Value-Dateien, in `fallback` für Docusaurus-JSON und in `content.fallback` für Markdown. `champollion status` zeigt den Fallback unter seinem Paar an. `--dry` kann nicht wissen, was fehlschlägt, und berichtet daher nichts über den Fallback.
- **Wenn der Fallback den Großteil geschrieben hat.** Wenn mehr als die Hälfte der neuen Übersetzungen eines Durchlaufs für ein Paar (die akzeptierten Antworten der Paarmethode plus die des Fallbacks) aus dem Fallback stammen, fügt `sync` eine Warnung hinzu: wie viele von wie vielen, durch welche Methode und welches Modell, warum die Antworten der Paarmethode nicht verwendet wurden (jeder Grund gezählt: ein memoriertes Satzmuster, das für verschiedene Quellstrings wiederholt wurde, Längeninflation, …) und was zu beachten ist – die Methode des Paars ist für diese Zeichenketten möglicherweise ungeeignet; prüfen Sie, was geschrieben wurde (`verify` prüft die Struktur, ein Muttersprachler die Bedeutung); erwägen Sie einen stärkeren Fallback. Die `--json`-Einträge enthalten `primaryAccepted` und `primaryReasons` neben `accepted`. `champollion status` gibt denselben Anteil für die Dateien an („from the fallback: 8 value(s) in the files (…) — 8 of the 8 sync wrote (100%)“) und weist darauf hin, wenn dies den Großteil des Texts des Locales ausmacht.
- `champollion serve` nutzt den Fallback ebenfalls im Rahmen seiner Obergrenzen von `--max-cost-per-request` / `--max-session-cost`.

## Sprach-Konfiguration {#language-configuration}

Sprachen akzeptieren drei Formate:

### Array von Codes (am einfachsten)

```json
{
  "languages": ["fr", "de", "ja"]
}
```

Jede Sprache erhält ihr Standardregister aus der integrierten Registertabelle. Sprachen ohne Standardwert erhalten `"Professional register."`.

### Objekt mit Register-Zeichenketten

Der Wert kann ein **Preset-Schlüssel** aus der Sprachkarte oder ein benutzerdefinierter Register-Text sein:

```json
{
  "languages": {
    "fr": "casual-tu",
    "ko": "formal-hapsyo",
    "ja": "Custom: Polite Japanese for a gaming app."
  }
}
```

Champollion prüft, ob die Zeichenkette einem Preset-Schlüssel in der Sprachkarte entspricht. Ist dies der Fall, wird der vollständige Register-Prompt aus der Karte verwendet. Andernfalls wird die Zeichenkette unverändert verwendet. Siehe [Unterstützte Sprachen](/docs/reference/supported-languages#language-cards) für verfügbare Presets.

### Objekt mit vollständiger Konfiguration

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

Sie können Kurzform und vollständige Objekte im selben Block mischen.


### Sprach-Felder

| Feld | Typ | Beschreibung |
|-------|------|-------------|
| `register` | `string` | Stil-/Tonfall-Anweisungen. Kann ein **Preset-Schlüssel** (z. B. `casual-tu`, `formal-hapsyo`) oder ein benutzerdefinierter Text sein. Siehe [Sprachkarten](/docs/reference/supported-languages#language-cards). |
| `name` | `string` | Für Menschen lesbarer Sprachname (für die Statusanzeige) |
| `model` | `string` | Überschreibt das Standardmodell |
| `temperature` | `number` | Überschreibt die Standardtemperatur |
| `batchSize` | `number` | Überschreibt die Standard-Batchgröße |
| `coachingFile` | `string` | Pfad zu einer Coaching-Prompt-Datei für diese Sprache, relativ zum Projekt gelesen; ersetzt das Coaching auf oberster Ebene, und eine nicht lesbare Datei bricht den Durchlauf ab |
| `promptContext` | `string` | Anwendungskontext für diese Sprache |
| `genderGuidance` | `string` \| `false` | Geschlechteranweisung für Prompts dieser Sprache: Ihr eigener Text oder `false` für keine Anweisung. Siehe [Geschlechter-Richtlinien](#gender-guidance). |
| `maxRetries` | `number` | Maximales Wiederholungsbudget für fehlgeschlagene Chargen (Standard: 3) |
| `script` | `string` | ISO-15924-Code der Orthografie, die Champollion schreibt (z. B. `"Cans"`, `"Piqd"`). Siehe [Schriftkonvertierung](#script-conversion). |
| `scriptFallback` | `object` | Transliterationsregeln für Buchstaben, die der Schriftkonverter nicht zuordnen kann. Siehe [Schriftkonvertierung](#script-conversion). |
| `endpoint` | `string` | Remote-API-Endpunkt-URL für `"method": "api"` |
| `fallback` | `object` | Eine zweite Methode für Inhalte, die die Methode dieser Sprache nicht sicher übersetzen kann. Siehe [Fallback-Methode](#fallback). |

:::info[Vererbungskette]
Einstellungen werden in dieser Reihenfolge aufgelöst (erste gewinnt):

**Paar-Ebene** → **Sprach-Ebene** → **globale Konfiguration** → **Standardwerte**

Wenn beispielsweise `pairs["en:fr"]` `model` setzt, überschreibt es sowohl die Werte auf Sprach-Ebene als auch die globalen `model`-Werte.
:::

### Geschlechter-Richtlinien {#gender-guidance}

LLM-Prompts enthalten eine Anweisung zum grammatikalischen Geschlecht für Sprachen, die dieses kennen. Sie stammt aus dem Katalog von Champollion: Französisch fordert *écriture inclusive* mit dem Mediopunkt, wenn das Geschlecht der Lesenden unbekannt ist (`Connecté·e`, nicht `Connecté(e)` oder `Connectée`; `Utilisateur·rice·s` im Plural), Deutsch die Doppelpunktform (`Benutzer:innen`), Japanisch das neutrale `私`. `champollion init` gibt dies neben dem Sprachregister jeder Sprache aus, und `champollion status` zeigt es pro Paar zusammen mit seiner Herkunft an.

Wählen Sie mit `genderGuidance` einen anderen Stil, für alle Sprachen oder für eine einzelne:

```json
{
  "languages": {
    "fr": { "register": "formal-vous", "genderGuidance": "Use the masculine generic (Connecté), as the Académie française recommends." },
    "de": { "register": "formal-Sie", "genderGuidance": false }
  }
}
```

`false` sendet keine Geschlechteranweisung; eine Zeichenkette ersetzt die Vorgabe des Katalogs. Die Einstellung gilt für Methoden, die Anweisungen verarbeiten (die LLM-Methoden); Machine-Translation-Engines (DeepL, Google, …) erhalten diese Information nicht. Eine geänderte Geschlechteranweisung ergibt einen anderen Prompt und hat daher eigene Cache-Einträge: Was bereits übersetzt ist, bleibt unverändert, bis Sie es erneut übersetzen (`champollion sync --redo all`, was der Sync vorschlägt, wenn die Dateien noch den früheren Stil enthalten).

## Nicht-englische Quelle

Wenn Ihre Quellsprache nicht Englisch ist:

```bash
# CLI flag (one-time)
npx champollion sync --source fr
```

```json title="champollion.config.json (permanent)"
{
  "inputLocale": "fr"
}
```

## Lock-Datei

Champollion erstellt `.champollion.lock`, um SHA-256-Hashes übersetzter Quellwerte nachzuverfolgen. **Committen Sie diese Datei**, damit alle Entwickler dieselbe Übersetzungsgrundlage nutzen. In einem Projekt mit einem Ordner pro Sprache werden Schlüssel als `<namespace>::<key>` erfasst.

Pro Ziel-Locale erfasst der Lock außerdem einen Fingerabdruck jedes Werts, den der Sync geschrieben hat, sowie des Quelltexts, den er übersetzt hat (sodass ein von Hand bearbeiteter Wert erkannt und eine veraltete Übersetzung gemeldet wird), die Schlüssel, die ein Redo nicht abschließen konnte (**pending**), und die Schlüssel, die das Quality-Gate abgewiesen hat (**held back**, zurückgehalten vor demselben Modell). Sobald davon etwas zu erfassen ist, nimmt die Datei ihre Version-2-Form an: `{"version": 2, "source": {…}, "locales": {…}}`; ein Version-1-Lock (eine flache Schlüssel-zu-Hash-Zuordnung) wird wie zuvor gelesen. Eine ersetzte manuelle Bearbeitung wird in `.champollion-replaced-edits.jsonl` daneben aufbewahrt – committen Sie beides. Siehe [Quality-Gate](/docs/concepts/quality-gate#refused-keys-are-held-back) und [Übersetzungen bearbeiten](/docs/guides/professional-translators#editing-key-value-files).

Wenn sich ein Quellwert ändert, stimmt der Hash nicht mehr überein, und Champollion übersetzt diesen Schlüssel bei der nächsten Synchronisierung erneut.

## `.champollionignore`

Erstellen Sie `.champollionignore` im Stammverzeichnis Ihres Projekts, um Dateien vom `lint`-Scan auszuschließen. Verwendet Glob-Muster, wie `.gitignore`:

```text title=".champollionignore"
src/components/legacy/**
src/utils/constants.js
**/*.test.js
```

## `.champollion/`-Verzeichnis

Champollion erstellt ein Verzeichnis `.champollion/` in Ihrem Projektstammverzeichnis für den internen Status. Halten Sie es von der Versionsverwaltung fern – es handelt sich um einen rechnerbezogenen Cache, nicht um Projektquellcode. `champollion init` fügt diese Zeile zu `.gitignore` hinzu und erstellt die Datei, falls noch keine vorhanden ist (auch in einem Ordner, der noch kein Git-Repository ist, sodass ein späteres `git init` und `git add --all` den Cache nicht committen):

```gitignore
.champollion/
```

Committen Sie die Lock-Dateien daneben (`.champollion.lock`, `.champollion-content.lock`): Sie halten fest, aus welchem Quelltext die jeweilige Übersetzung erstellt wurde.

| Datei | Verwendungszweck | Committen? |
|------|---------|--------|
| `tm.json` | Translation-Memory-Cache – speichert vorherige Übersetzungen, indexiert nach Quelltext + Locale + Methode | Nein (lokaler Cache) |
| `xliff/*.xliff` | XLIFF-Exportdateien für die Überprüfung durch professionelle Übersetzer | Nein (flüchtig) |
| `methods/` | Manifeste installierter Methoden-Plugins | Wird durch die Zeile `.champollion/` ignoriert. Um installierte Plugins zu teilen, ersetzen Sie diese Zeile durch `.champollion/*` und `!.champollion/methods/` |
| `backups/` | Backups vor dem Wrapping (erstellt durch `wrap --undo`) | Nein (Sicherheitsnetz) |

Siehe [Translation Memory](/docs/concepts/translation-memory) für Details zu `tm.json` und wie es API-Kosten spart.

---

## Programmatische API

Für Build-Skripte und benutzerdefinierte Integrationen importieren Sie direkt aus dem Paket:

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

### Verfügbare Exporte

| Export | Funktion |
|--------|-------------|
| `TranslationMethod` | Basisklasse für alle Methoden |
| `LLMMethod` | Basisklasse für LLM-Methoden (OpenRouter) |
| `DirectLLMMethod` | Basisklasse für direkte LLM-Anbieter (OpenAI, Anthropic, Gemini) |
| `OpenAIMethod`, `AnthropicMethod`, `GeminiMethod` | Klassen direkter LLM-Anbieter |
| `DeepLMethod`, `MicrosoftTranslatorMethod`, `LibreTranslateMethod`, `TildeMethod`, `TranslatedMethod` | Klassen für traditionelle maschinelle Übersetzung (MT) |
| `GoogleTranslateMethod` | Google Cloud Translation |
| `LLMCoachedMethod` | Gecoachtes LLM (OpenRouter + Coaching-Daten) |
| `APIMethod` | Remote-API-Client |
| `runSync`, `runContentSync` | Vollständige Sync-Pipeline |
| `translateWithFallback`, `translateAndValidate` | Die Pipeline eines einzelnen Paars für eine Charge von Schlüsseln, wie sie von `sync` ausgeführt wird: Cache, Methode, Quality-Gate, Cache, dann der Fallback des Paars. Übergeben Sie ein Paar aus `resolvePairs`, `tm` aus `loadTM` und `cwd`, das Projektverzeichnis: Die Methode liest ihren Schlüssel, Endpunkt, Coaching und Glossar dort aus, nicht aus `process.cwd()` |
| `createFallbackBudget` | Der Schutzmechanismus (Guard) `--max-cost` für Fallback-Chargen (`{ maxCost, committed, cwd }`) |
| `discoverLocaleLayout`, `resolveLocaleFiles` | Die Dateien, aus denen jedes Locale besteht (flach, Ordner pro Locale oder `localesPattern`) |
| `resolveConfig`, `resolvePairs` | Konfigurationsauflösung |
| `validateTranslations` | Quality-Gate |
| `loadCoachingData`, `findDictionaryMatches` | Coaching-Dienstprogramme |

### Erweiterung für benutzerdefinierte Anbieter

Erweitern Sie `DirectLLMMethod`, um in ~40 Zeilen einen neuen LLM-Anbieter hinzuzufügen:

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

Sie erhalten Übersetzung, Coaching, Wiederholungsschleifen, Modellvalidierung, Qualitätsstufen und Einrichtungshilfe kostenlos. Nur die Form der HTTP-Anfrage ist anbieterspezifisch. Für Nicht-LLM-Adapter, die rohes `fetch()` verwenden, nutzen Sie den geteilten `fetchWithRetry()`-Helfer aus `lib/methods/fetch-with-retry.js`, anstatt Ihre eigene Wiederholungsschleife zu schreiben.

---

## Siehe auch

- [CLI-Referenz](/docs/reference/cli) — alle Befehle und Flags
- [Übersetzungsmethoden](/docs/guides/translation-methods) — Auswahl und Kombination von Methoden
- [Translation Memory](/docs/concepts/translation-memory) — Caching und Kosteneinsparungen
- [Zusammenarbeit mit professionellen Übersetzern](/docs/guides/professional-translators) — XLIFF-Workflow
- [Plugin-Spezifikation](/docs/reference/plugin-spec) — Manifestformat für Methoden-Plugins
- [Architektur](/docs/concepts/architecture) — wie die Teile zusammenhängen
- [Unterstützte Sprachen](/docs/reference/supported-languages) — integrierte Sprachunterstützung
- [Wie die Synchronisierung funktioniert](/docs/concepts/how-sync-works) — die Übersetzungs-Pipeline
