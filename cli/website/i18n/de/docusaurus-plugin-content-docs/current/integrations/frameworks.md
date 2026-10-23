# Integrationsanleitungen

Schritt-für-Schritt-Einrichtung für champollion mit beliebten Frameworks.

Befehle auf dieser Seite führen champollion mit `npx --yes champollion@0.6 <command>` aus: fest verankert auf der 0.6-Reihe, wie in der [CI-Anleitung](/docs/guides/ci-cd), damit auf Ihrem Laptop und in Ihrer CI dieselbe Version läuft und eine neue Version einen Durchlauf niemals unerwartet verändert. Eine projektlokale Installation ist die Alternative. In einem Node-Projekt fügt `npm install --save-dev champollion@0.6` es zu `package.json` hinzu, und `npx champollion sync` führt anschließend diese Kopie aus.

---

## Einrichtung des API-Schlüssels

Vor der Integration in ein Framework benötigen Sie einen Übersetzungs-API-Schlüssel. Champollion unterstützt zwei Anbieter:

### Option A: OpenRouter (empfohlen)

[OpenRouter](https://openrouter.ai) bietet eine einheitliche API für über 200 LLM-Modelle. Ein kostenloser Tarif ist verfügbar.

```bash
# Sign up at https://openrouter.ai, then:
export OPENROUTER_API_KEY=sk-or-v1-...

# Or add to .env.local:
OPENROUTER_API_KEY=sk-or-v1-your-key-here
```

Am besten geeignet für: inhaltsschwere Projekte, Markdown-Übersetzung und Projekte, die eine inhaltsbewusste Abschirmung benötigen (Codeblöcke, Shortcodes, Interpolationsvariablen).

### Option B: Google Translate

```bash
export GOOGLE_TRANSLATE_API_KEY=...
```

Am besten geeignet für: umfangreiche Schlüssel-Wert-Zeichenkettenpaare (194 Sprachen). **Nicht empfohlen** für Markdown-Inhalte – Google Translate erkennt weder Codeblöcke noch Shortcodes oder Interpolationsvariablen.

Um Google Translate explizit zu verwenden:

```bash
champollion sync --method google-translate
```

> **Tipp**: Wenn nur `GOOGLE_TRANSLATE_API_KEY` gesetzt ist (kein OpenRouter-Schlüssel), wechselt champollion automatisch zu Google Translate.

---

## Hugo (TOML / YAML / Markdown)

### Projektstruktur

Hugo verwendet `i18n/` für Zeichenkettenübersetzungen und `content/` für Seiteninhalte:

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

### Einrichtung

```bash
npm install --save-dev champollion
```

```bash
# .env.local
OPENROUTER_API_KEY=sk-or-v1-your-key-here
```

Erstellen Sie `champollion.config.json`:

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

### Details zur Inhaltsübersetzung

**Front Matter**: Unterstützt sowohl YAML- (`---`) als auch TOML-Trennzeichen (`+++`). Übersetzt standardmäßig `title`, `description`, `summary`, `subtitle`, `caption` und `linkTitle`. Alle anderen Felder (Datum, Entwurf, Schlagwörter, Gewichtung, Slug usw.) bleiben erhalten. Passen Sie dies mit `translatableFields` in Ihrer Konfiguration an.

**Blockschutz**: Codeblöcke, Hugo-Shortcodes (`{{< >}}`, `{{% %}}`), Inline-Code und reines HTML werden mithilfe von Unicode-Sentinel-Platzhaltern automatisch abgeschirmt. Sie bleiben unberührt.

**Dateinamen-Konvention**: Folgt Hugos Muster für Übersetzung nach Dateiname:
- `my-post.md` → `my-post.fr.md`
- `my-post.en.md` → `my-post.fr.md` (entfernt das Quellsuffix)

**Vorhandene überspringen**: Bereits vorhandene übersetzte Dateien werden niemals überschrieben. Löschen Sie eine Zieldatei, um eine erneute Übersetzung zu erzwingen.

### Pluralformen

TOML- und YAML-Gebietsschemas unterstützen CLDR-Pluralformen:

```toml
[items]
one = "{{ .Count }} item"
other = "{{ .Count }} items"
```

Intern für den Abgleich als `items.one` und `items.other` dargestellt, beim Schreiben dann wieder in das korrekte unterteilte Format serialisiert.

---

## next-intl (JSON)

### Projektstruktur

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

### Einrichtung

```bash
npm install --save-dev champollion
```

Führen Sie `npx --yes champollion@0.6 init --yes --langs fr,de,ja,es,ko,zh,pt,ar` aus. Der Befehl findet `messages/en.json`, erstellt die leeren Zieldateien und schreibt eine Konfiguration wie die unten stehende. Oder erstellen Sie `champollion.config.json` selbst:

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

Das Register jedes Ziels (sein Tonfall und seine Formalität) wird in `languages` eingetragen, sodass es sichtbar und anpassbar ist: Ändern Sie einen Eintrag zu einer anderen Vorgabe der Sprache (`champollion status` listet diese auf) oder zu Ihren eigenen Worten. Eine Sprache ohne Vorgaben wird als `{}` eingetragen. Eine einfache Liste, `"languages": ["fr", "de"]`, funktioniert ebenfalls und verwendet den Standard der jeweiligen Sprache.

```bash
npx --yes champollion@0.6 sync
```

Erstellt `messages/fr.json`, `messages/ja.json` usw. – vollständig übersetzt, unter Beibehaltung Ihrer verschachtelten Schlüsselstruktur. next-intl übernimmt sie automatisch.

### Entwicklungsablauf

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

### Ein Ordner pro Sprache (i18next-Standard)

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

`init` findet `public/locales/en/` (oder `locales/en/`), verweist die Konfiguration darauf und erstellt `fr/common.json`, `fr/admin/users.json` und die weiteren als leere Dateien. Der relevante Teil der geschriebenen Konfiguration:

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

Jede Namensraumdatei wird übersetzt und unter demselben Pfad im Ordner jeder Sprache abgelegt. Eine Zeichenkette, die in mehreren Namensräumen vorkommt, wird pro Sprache einmal übersetzt; die anderen Dateien beziehen sie aus dem Übersetzungsspeicher (Translation Memory). Pluralschlüssel (`key_one`, `key_other`) erhalten die jeweiligen spracheneigenen Formen, die über die JavaScript-API `Intl.PluralRules` aus dem CLDR gelesen werden: Eine Form, die die Sprache verwendet, die der Quelle jedoch fehlt, wird hinzugefügt; eine Form, die sie nicht verwendet, wird weggelassen. Bei einer englischen Quelle erhalten Spanisch und Französisch `key_many`, Russisch erhält `key_few` und `key_many`, und Japanisch behält nur `key_other`. Sync benennt für Ihre eigenen Sprachen die Formen, die jeweils hinzukommen. Siehe [i18next-Pluralschlüssel](/docs/getting-started/configuration#i18next-plurals) und [Dateistrukturen für Gebietsschemas](/docs/getting-started/configuration#locale-layouts).

### Eine Datei pro Sprache

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

### Weitere Strukturen

Falls Ihre Dateien einem anderen Muster folgen, beschreiben Sie es mit `localesPattern` (`{lang}` steht für die Sprache, `{ns}` für den Namensraum):

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

### Projektstruktur

`flutter gen-l10n` liest eine `.arb`-Datei pro Sprache. Die englische Datei dient als Vorlage:

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

### Einrichtung

```bash
npx --yes champollion@0.6 init --yes --langs fr,de,pt_BR
```

`init` liest `pubspec.yaml` und `l10n.yaml` (`arb-dir`, `template-arb-file`), übernimmt die Quellsprache aus dem Namen der Vorlage (`app_en.arb` → `en`) und erstellt `app_fr.arb`, `app_de.arb` und `app_pt_BR.arb` mit deren `@@locale`. Die geschriebene Konfiguration:

```json
{
  "version": 3,
  "inputLocale": "en",
  "localesPattern": "lib/l10n/app_{lang}.arb",
  "languages": { "fr": "formal-vous", "de": "formal-Sie", "pt_BR": "professional" }
}
```

Wenn `l10n.yaml` `arb-dir: assets/i18n` und `template-arb-file: intl_en.arb` festlegt, lautet das Muster `"assets/i18n/intl_{lang}.arb"`.

```bash
npx --yes champollion@0.6 sync
flutter gen-l10n
```

Nur die Meldungen werden übersetzt. Bei jedem Ziel wird `"@@locale"` auf das eigene Gebietsschema gesetzt, und zwar so geschrieben, wie es der Dateiname vorgibt (`"pt_BR"`), da `gen-l10n` eine Datei ablehnt, deren `@@locale` nicht mit ihrem Namen übereinstimmt. Jedes `@key`-Metadatenobjekt, wie etwa Platzhalter und deren Typen, wird unverändert aus `app_en.arb` übernommen. Schlüssel folgen der Reihenfolge der Vorlage, und eine Meldung, die noch nicht übersetzt ist, wird weggelassen, sodass Flutter auf die englische Fassung zurückgreift.

Beschreibungen in den Metadaten der Vorlage werden dem Modell als Kontext übergeben:

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

Die `{count, plural, …}`-Syntax, der Platzhalter `{count}` und die Selektoren sind geschützt: Eine Übersetzung, die diese verändert, wird abgewiesen und wiederholt (siehe [ICU-Meldungen](/docs/getting-started/configuration#icu)). Französisch kann einen `many`-Zweig hinzufügen und Polnisch `few` und `many`. `champollion verify` prüft auch `@@locale` und die Platzhalter-Metadaten jeder Zieldatei. Falls ein früheres Werkzeug diese übersetzt hat, schreibt `champollion sync --pair en:fr --force` die Datei neu. Unveränderte Meldungen werden kostenlos aus dem Cache bezogen.

### Gebietsschemas außerhalb von Flutters eigener Liste {#flutter-locales-outside-flutters-own-list}

Ihre Meldungen stammen aus den `.arb`-Dateien. Der Text innerhalb von Flutters eigenen Widgets – eine Datumsauswahl, „Zurück“, „Abbrechen“, die Textrichtung – stammt aus `flutter_localizations` (`GlobalMaterialLocalizations`, `GlobalCupertinoLocalizations`), das eine feste Liste von Sprachen abdeckt ([Flutters Liste](https://api.flutter.dev/flutter/flutter_localizations/GlobalMaterialLocalizations-class.html)). Ein Code für private Nutzung wie `qaa` sowie die meisten ressourcenarmen Sprachen stehen nicht darauf. Befindet sich ein solches Gebietsschema in `supportedLocales`, stürzt die App zur Laufzeit ab („No MaterialLocalizations found“), sofern kein Delegat diesen Text bereitstellt. `init` und ein Synchronisierungsvorgang, der eine neue `.arb`-Datei erstellt, weisen für jedes Ziel außerhalb der Liste darauf hin: Sie lesen die Liste aus dem Flutter-SDK auf dem Rechner aus (`FLUTTER_ROOT` oder dem `flutter` unter `PATH`), und ohne ein solches SDK geben sie an, welche Ziele nicht geprüft werden konnten.

Die einfachste Abhilfe leiht diesen Widgets den Text einer Sprache, die Flutter abdeckt (hier Englisch):

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

Führen Sie ihn nach Flutters eigenen Delegaten auf:

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

Die Widgets zeigen dann englische Beschriftungen innerhalb einer App, deren eigener Text in Ihrer Sprache verfasst ist. Um auch den Text der Widgets zu übersetzen, zeigt Flutters Anleitung ein vollständiges `MaterialLocalizations` für eine neue Sprache: [Unterstützung für eine neue Sprache hinzufügen](https://docs.flutter.dev/ui/accessibility-and-internationalization/internationalization#adding-support-for-a-new-language).

---

## Django und gettext (.po)

Die CLI von champollion ist quelltextverfügbar unter der [PolyForm Noncommercial License 1.0.0](https://github.com/gamedaysuits/Champollion/blob/main/cli/LICENSE): kostenfrei nutzbar, veränderbar und teilbar für nichtkommerzielle Zwecke. Die Nutzung für kommerzielle Zwecke wird von dieser Lizenz nicht abgedeckt ([wer dies nutzen darf](/docs/getting-started/who-may-use-this)).

### Projektstruktur

```
my_site/
├── manage.py
└── locale/
    ├── en/LC_MESSAGES/django.po    ← source catalog (makemessages -l en)
    ├── fr/LC_MESSAGES/django.po
    └── ru/LC_MESSAGES/django.po
```

### Einstellungen: LOCALE_PATHS und LANGUAGES {#django-locale-paths}

Django sucht nach Katalogen in den Ordnern, die `LOCALE_PATHS` auflistet, sowie im `locale/`-Ordner jeder installierten App. Ein `locale/` neben `manage.py` gehört zu keiner App; solange `LOCALE_PATHS` diesen Ordner also nicht nennt, baut `compilemessages` zwar seine `.mo`-Dateien, die Website zeigt jedoch weiterhin den unübersetzten Text an. `LANGUAGES` ist die Liste der Sprachen, die die Website anbietet; standardmäßig enthält Django jede Sprache, mit der es ausgeliefert wird, führen Sie also Ihre eigenen auf:

```python title="settings.py"
LOCALE_PATHS = [BASE_DIR / "locale"]   # BASE_DIR: the folder with manage.py (startproject defines it)
LANGUAGES = [("en", "English"), ("fr", "Français"), ("ru", "Русский")]
```

### Einrichtung

Erstellen oder aktualisieren Sie die Kataloge zunächst mit Django. Der englische Katalog dient als Quelle. Dessen leere `msgstr` bedeuten „die msgid ist der Text“:

```bash
django-admin makemessages -l en -l fr -l ru
npx --yes champollion@0.6 init --yes --langs fr,ru
```

`init` findet `manage.py` und `locale/en/LC_MESSAGES/django.po` und schreibt:

```json
{
  "version": 3,
  "inputLocale": "en",
  "localesPattern": "locale/{lang}/LC_MESSAGES/{ns}.po",
  "languages": { "fr": "formal-vous", "ru": "formal-vy" }
}
```

`{ns}` ist die gettext-Domäne, sodass `django.po` und `djangojs.po` beide synchronisiert werden.

**Die Standardeinstellungen sind ein Tonfall und ein geschlechterspezifischer Stil; `init` gibt beides aus.** `formal-vous` fordert das Modell auf: „Formal French. Use vous-form (vouvoiement) consistently. Professional, academic register.“ Die Richtlinie zur geschlechtergerechten Formulierung für das Französische verlangt *écriture inclusive* mit Mediopunkt, wenn das Geschlecht der lesenden Person unbekannt ist (`Connecté·e`, `Utilisateur·rice·s`); die des Russischen (`formal-vy`) verwendet das Maskulinum, den herkömmlichen Standard. Eine Website, die etwas anderes wünscht (beispielsweise die Patientenseiten einer Klinik), ändert dies in `champollion.config.json`: das Register in `languages` (`"fr": "casual-tu"` oder eigene Worte) und `genderGuidance` – `false` für keine Anweisung oder eine eigene, wie etwa `"Use the masculine generic."` ([Geschlechterrichtlinien](/docs/getting-started/configuration#gender-guidance)). Eine geänderte Einstellung erhält eigene Cache-Einträge, sodass `sync --redo all` das neu übersetzt, was die vorherige Einstellung geschrieben hat.

**Welche Methode übersetzt und welchen Schlüssel sie benötigt.** Ohne `--method` richtet `init` den Standard ein, `llm`: ein Modell auf [OpenRouter](https://openrouter.ai), das `OPENROUTER_API_KEY` in der Umgebung oder in einer `.env`-Datei neben `manage.py` benötigt (`init` gibt die festzulegende Zeile aus, falls der Schlüssel fehlt). Auf einem Rechner, auf dem ein Modellserver läuft (Ollama, LM Studio, vLLM), benötigt `npx --yes champollion@0.6 init --yes --langs fr,ru --method local --model llama3.1` keinen Schlüssel, und nichts verlässt den Rechner. Ein CI-Runner verfügt über keinen Modellserver, daher benennt die CI für ihren Durchlauf ein gehostetes Modell (siehe die [CI-Anleitung](/docs/guides/ci-cd)). Alle Methoden und die jeweils benötigten Schlüssel: [Übersetzungsmethoden](/docs/guides/translation-methods).

Danach:

```bash
npx --yes champollion@0.6 sync
django-admin compilemessages
```

Sync übersetzt jeden Eintrag mit einer leeren `msgstr` sowie jeden `fuzzy`-Eintrag und entfernt die `fuzzy`-Kennzeichnung. Bereits übersetzte Einträge bleiben Byte für Byte samt ihren Kommentaren unverändert. Ein Eintrag mit einem `msgctxt` stellt einen eigenen Schlüssel und einen eigenen Cache-Eintrag dar, sodass „Open“ als Verb und „Open“ als Adjektiv getrennt übersetzt werden. `#.`-Kommentare und der Kontext werden an das Modell gesendet – um die genaue Anfrage zu sehen, ohne sie abzusenden, führen Sie `npx --yes champollion@0.6 sync --dry --show-prompt 'verb␄Open'` aus (Kontext und Kommentar erscheinen unter „UI context for these keys“).

**Gezieltes Nachübersetzen eines einzelnen Eintrags.** Benennen Sie ihn anhand seiner msgid:

```bash
npx --yes champollion@0.6 sync --pair en:fr --redo 'keys:Welcome back\, %(name)s!'
```

Dies wird aus dem Übersetzungsspeicher bedient, wenn der Cache diesen Text bereits enthält, sodass Sie dieselbe Übersetzung kostenlos zurückerhalten, und Sync weist mit dem Befehl `--fresh` darauf hin. Eine solche Wiederholung benötigt kein Modell: Bei `local` und angehaltenem Modellserver warnt Sync, dass der Server nicht antwortet und dieser Durchlauf ihn nicht benötigt, und fährt fort (eine Wiederholung, die etwas senden muss, bricht unter Nennung des Servers ab). Um eine neue Übersetzung kostenpflichtig anzufordern, fügen Sie `--fresh` hinzu. Ein Komma innerhalb einer msgid wird als `\,` geschrieben, und die Anführungszeichen verhindern, dass die Shell den Rest interpretiert. Ein Eintrag mit einem Kontext wird so benannt, wie Berichte ihn ausgeben: `verb␄Open`. Wenn Sie `␄` nicht eingeben können, schreiben Sie stattdessen `\x04`: `--redo 'keys:verb\x04Open'`. Beide Schreibweisen funktionieren, und Reparaturbefehle zeigen beide an. Um den Eintrag nur in einer Domäne zu benennen, stellen Sie die Domäne voran: `django::Welcome`. Ein Name, der auf keinen Eintrag zutrifft, lässt den Durchlauf fehlschlagen (Exit-Code 1) und listet die ähnlichsten Einträge auf, beispielsweise jeden Kontext der msgid `Cancel` (`button␄Cancel`, `status␄Cancel`). Ein solcher Aufruf gilt niemals als abgeschlossene Neuübersetzung.

Ein Katalog, den champollion erstellt (`init --langs` oder Sync für eine Sprache, die noch keinen Katalog besitzt), erhält den standardmäßigen gettext-Kopfbereich, also die Felder, die `msginit` schreibt, sodass `msgfmt -c` ihn akzeptiert. Der Kopfbereich eines bestehenden Katalogs wird niemals überschrieben.

**`msgfmt -c`-Kopfzeilen-Warnungen bei Katalogen, die `makemessages` begonnen hat.** `makemessages` schreibt den Vorlagen-Kopfbereich von gettext – `Project-Id-Version: PACKAGE VERSION`, `PO-Revision-Date: YEAR-MO-DA HO:MI+ZONE`, `Last-Translator: FULL NAME <EMAIL@ADDRESS>`, `Language-Team: LANGUAGE <LL@li.org>`, markiert als `#, fuzzy` – und `msgfmt -c` warnt daraufhin bei jedem Kompilieren, dass jedes Feld „still has the initial default value“. Sync belässt diese Werte unverändert (in einem bestehenden Kopfbereich füllt es nur einen Platzhalter `Plural-Forms` oder Zeichensatz aus); korrigieren Sie diese also einmal manuell in jedem Katalog: Name und Version Ihres Projekts, das Datum, eine übersetzende Person (oder `Automatically generated`) und ein Team (oder `none`); löschen Sie außerdem die Zeile `#, fuzzy` über `msgid ""`, die den Kopfbereich als noch nicht geprüft markiert. `makemessages` behält die von Ihnen eingetragenen Werte bei. `compilemessages` (`msgfmt --check-format`) prüft den Kopfbereich nicht, sodass diese Warnungen den Befehl niemals fehlschlagen lassen.

**Plurale.** `msgid` + `msgid_plural` werden zu einer einzigen Meldung, die das Modell mit allen Formen übersetzt, die die Sprache benötigt. Die Formen werden gemäß dem `Plural-Forms`-Kopfbereich des Katalogs in `msgstr[0]`, `msgstr[1]`, … geschrieben. Django schreibt diesen für Sie. Ein Katalog ohne einen solchen Kopfbereich erhält denjenigen, den `msginit` für die Sprache schreibt (Französisch `nplurals=2; plural=(n > 1);`), oder einen aus dem CLDR abgeleiteten für eine Sprache, die `msginit` nicht auflistet:

```po
msgid "One file"
msgid_plural "%(count)d files"
msgstr[0] "%(count)d файл"
msgstr[1] "%(count)d файла"
msgstr[2] "%(count)d файлов"
```

Wenn die Übersetzung eine Form auslässt, die die Sprache für gewöhnliche Zählungen verwendet (Russisch `few` oder `many`), fordert Sync diese erneut beim Modell an. Fehlt sie in der Antwort immer noch, schreibt Sync die Form `other` an deren Stelle, kennzeichnet den Eintrag mit einem `# champollion:`-Kommentar und benennt ihn mit dem Befehl für eine erneute Anfrage (`--redo 'keys:django::One file' --fresh`). Jedes Sync wird mit `2` beendet, solange sich ein gekennzeichneter Eintrag im Katalog befindet – nicht nur das Sync, das ihn geschrieben hat, analog zu einem zurückgehaltenen Schlüssel. Seine abschließende Verifizierungszeile meldet, dass der Durchlauf unvollständig ist, statt `[OK]`. Tragen Sie die Formen manuell ein und löschen Sie die Kommentarzeile, oder fragen Sie erneut mit einem leistungsstärkeren `--model` an. Ein Sync mit einer anderen Methode oder einem anderen Modell (dem gehosteten Modell der CI nach einem lokalen) fragt den Eintrag von selbst erneut an, und `sync --redo gaps` fragt jeden gekennzeichneten Eintrag an; fehlen die Formen auch in dieser Antwort, bleibt der Eintrag gekennzeichnet. In der CI schlägt der Job nach dem Commit fehl (siehe die [CI-Anleitung](/docs/guides/ci-cd#plural-gaps)).

**Weitere gettext-Strukturen.**

| Projekt | Konfiguration | Quelle |
|---------|---------------|--------|
| GNU (`po/fr.po`) | `"localesDir": "./po", "format": "po"` | `po/en.po` oder die einzige `.pot` in `po/` |
| Babel / Flask | `"localesPattern": "translations/{lang}/LC_MESSAGES/messages.po"` | `translations/en/…/messages.po` oder `messages.pot` in `translations/` oder dem Ordner darüber |

`printf`-Platzhalter (`%s`, `%(name)s`, `%d`) müssen die Übersetzung unverändert überstehen, und das Quality-Gate weist Werte zurück, die einen davon verlieren. Führen Sie dennoch vor der Veröffentlichung `msgfmt --check-format` aus (`compilemessages` tut dies). Dieser Befehl prüft auch Platzhaltertypen, allerdings nur bei Einträgen mit der Kennzeichnung `#, python-format`: `makemessages` fügt die Kennzeichnung den Einträgen hinzu, die es mit einem `%`-Platzhalter extrahiert, während sie in einem manuell erstellten Katalog fehlen kann und diese Einträge ungeprüft bleiben. `champollion verify` vergleicht die printf-Platzhalter jedes Eintrags (Name und Typbuchstabe) unabhängig von dessen Kennzeichnungen, und Sync behält die Kennzeichnungen des Quelleintrags bei jedem übersetzten Eintrag bei. Kataloge müssen in UTF-8 vorliegen. Siehe [gettext-Kataloge](/docs/getting-started/configuration#gettext) für das vollständige Regelwerk.
