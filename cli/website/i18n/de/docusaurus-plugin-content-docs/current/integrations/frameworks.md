# Integrationsleitfäden

Schritt-für-Schritt-Einrichtung von champollion mit gängigen Frameworks.

Befehle auf dieser Seite führen champollion mit `npx --yes champollion@0.5 <command>` aus: fest an die Version 0.5 gebunden, wie im [CI-Leitfaden](/docs/guides/ci-cd), damit auf Ihrem Laptop und in Ihrer CI dieselbe Version läuft und ein neues Release eine Ausführung nie unerwartet verändert. Eine projektlokale Installation ist die Alternative. In einem Node-Projekt fügt `npm install --save-dev champollion@0.5` es zu `package.json` hinzu, und `npx champollion sync` führt anschließend diese Kopie aus.

---

## Einrichtung des API-Schlüssels

Bevor Sie eine Integration mit einem Framework vornehmen, benötigen Sie einen Übersetzungs-API-Schlüssel. Champollion unterstützt zwei Anbieter:

### Option A: OpenRouter (empfohlen)

[OpenRouter](https://openrouter.ai) bietet eine einheitliche API für mehr als 200 LLM-Modelle. Eine kostenlose Variante ist verfügbar.

```bash
# Sign up at https://openrouter.ai, then:
export OPENROUTER_API_KEY=sk-or-v1-...

# Or add to .env.local:
OPENROUTER_API_KEY=sk-or-v1-your-key-here
```

Am besten geeignet für: inhaltslastige Projekte, Markdown-Übersetzung und Projekte, die eine inhaltsbewusste Abschirmung (Codeblöcke, Shortcodes, Interpolationsvariablen) benötigen.

### Option B: Google Translate

```bash
export GOOGLE_TRANSLATE_API_KEY=...
```

Am besten geeignet für: großvolumige Schlüssel-Wert-Zeichenkettenpaare (194 Sprachen). **Nicht empfohlen** für Markdown-Inhalte – Google Translate erkennt weder Codeblöcke noch Shortcodes oder Interpolationsvariablen.

Um Google Translate explizit zu verwenden:

```bash
champollion sync --method google-translate
```

> **Tipp**: Wenn nur `GOOGLE_TRANSLATE_API_KEY` gesetzt ist (kein OpenRouter-Schlüssel), wechselt champollion automatisch zu Google Translate.

---

## Hugo (TOML / YAML / Markdown)

### Projektstruktur

Hugo verwendet `i18n/` für Zeichenketten-Übersetzungen und `content/` für Seiteninhalte:

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

**Front Matter**: Unterstützt sowohl YAML- (`---`) als auch TOML-Trennzeichen (`+++`). Übersetzt standardmäßig `title`, `description`, `summary`, `subtitle`, `caption` und `linkTitle`. Alle anderen Felder (date, draft, tags, weight, slug usw.) bleiben erhalten. Passen Sie dies mit `translatableFields` in Ihrer Konfiguration an.

**Blockschutz**: Codeblöcke, Hugo-Shortcodes (`{{< >}}`, `{{% %}}`), Inline-Code und rohes HTML werden automatisch mithilfe von Unicode-Sentinel-Platzhaltern abgeschirmt. Sie werden unverändert durchgereicht.

**Dateinamenskonvention**: Folgt dem Muster der Übersetzung nach Dateiname von Hugo:
- `my-post.md` → `my-post.fr.md`
- `my-post.en.md` → `my-post.fr.md` (entfernt das Quellsuffix)

**Vorhandene überspringen**: Vorhandene übersetzte Dateien werden niemals überschrieben. Löschen Sie eine Zieldatei, um eine erneute Übersetzung zu erzwingen.

### Pluralformen

TOML- und YAML-Locales unterstützen CLDR-Pluralformen:

```toml
[items]
one = "{{ .Count }} item"
other = "{{ .Count }} items"
```

Intern als `items.one` und `items.other` für das Diffing dargestellt und beim Schreiben wieder in das korrekte sektionierte Format serialisiert.

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

Führen Sie `npx --yes champollion@0.5 init --yes --langs fr,de,ja,es,ko,zh,pt,ar` aus. Es findet `messages/en.json`, erstellt die leeren Zieldateien und schreibt eine Konfiguration wie die unten stehende. Oder erstellen Sie `champollion.config.json` selbst:

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

Das Register jedes Ziels (Tonfall und Formalitätsgrad) wird in `languages` eingetragen, sodass es sichtbar und anpassbar ist: Ändern Sie einen Wert zu einer anderen Voreinstellung der Sprache (`champollion status` listet diese auf) oder zu Ihren eigenen Formulierungen. Eine Sprache ohne Voreinstellungen wird als `{}` eingetragen. Eine einfache Liste, `"languages": ["fr", "de"]`, funktioniert ebenfalls und verwendet den Standard der jeweiligen Sprache.

```bash
npx --yes champollion@0.5 sync
```

Erstellt `messages/fr.json`, `messages/ja.json` usw. — vollständig übersetzt, wobei Ihre verschachtelte Schlüsselstruktur erhalten bleibt. next-intl erkennt sie automatisch.

### Entwicklungsworkflow

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
npx --yes champollion@0.5 init --yes --langs fr,de,ja
```

`init` findet `public/locales/en/` (oder `locales/en/`), verweist in der Konfiguration darauf und erstellt `fr/common.json`, `fr/admin/users.json` und die weiteren als leere Dateien. Der relevante Teil der geschriebenen Konfiguration:

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

Jede Namespace-Datei wird übersetzt und unter demselben Pfad im Ordner jeder Sprache abgelegt. Eine Zeichenkette, die in mehreren Namespaces vorkommt, wird pro Sprache einmal übersetzt; die übrigen Dateien übernehmen sie aus dem Translation Memory. Pluralschlüssel (`key_one`, `key_other`) erhalten die jeweiligen Formen der Sprache, die über die JavaScript-`Intl.PluralRules`-API aus dem CLDR ausgelesen werden: Eine Form, die die Sprache verwendet, die der Quelle jedoch fehlt, wird hinzugefügt, und eine Form, die sie nicht verwendet, wird weggelassen. Bei einer englischen Quelle erhalten Spanisch und Französisch `key_many`, Russisch erhält `key_few` und `key_many`, und Japanisch behält nur `key_other`. Sync benennt für Ihre eigenen Sprachen die Formen, die jeweils hinzukommen. Siehe [i18next-Pluralschlüssel](/docs/getting-started/configuration#i18next-plurals) und [Locale-Dateilayouts](/docs/getting-started/configuration#locale-layouts).

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

### Weitere Layouts

Wenn Ihre Dateien einem anderen Muster folgen, beschreiben Sie dieses mit `localesPattern` (`{lang}` steht für die Sprache, `{ns}` für den Namespace):

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

`flutter gen-l10n` liest eine `.arb`-Datei pro Sprache ein. Die englische dient als Vorlage:

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
npx --yes champollion@0.5 init --yes --langs fr,de,pt_BR
```

`init` liest `pubspec.yaml` sowie `l10n.yaml` (`arb-dir`, `template-arb-file`), übernimmt die Ausgangssprache aus dem Namen der Vorlage (`app_en.arb` → `en`) und erstellt `app_fr.arb`, `app_de.arb` sowie `app_pt_BR.arb` mitsamt ihren `@@locale`. Die Konfiguration, die dabei geschrieben wird:

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
npx --yes champollion@0.5 sync
flutter gen-l10n
```

Nur die Nachrichten werden übersetzt. Bei jedem Ziel wird `"@@locale"` auf dessen eigenes Locale gesetzt, genau so geschrieben wie im Dateinamen (`"pt_BR"`), da `gen-l10n` eine Datei ablehnt, deren `@@locale` nicht mit ihrem Namen übereinstimmt. Jedes `@key`-Metadatenobjekt, wie etwa Platzhalter und deren Typen, wird unverändert aus `app_en.arb` übernommen. Die Schlüssel folgen der Reihenfolge der Vorlage, und eine Nachricht, die noch nicht übersetzt ist, wird weggelassen, sodass Flutter auf die englische Version zurückgreift.

Beschreibungen in den Metadaten der Vorlage werden dem Modell als Kontext übermittelt:

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

Die `{count, plural, …}`-Syntax, der `{count}`-Platzhalter und die Selektoren sind geschützt: Eine Übersetzung, die diese verändert, wird abgelehnt und erneut versucht (siehe [ICU-Nachrichten](/docs/getting-started/configuration#icu)). Französisch kann einen `many`-Zweig hinzufügen und Polnisch `few` sowie `many`. `champollion verify` prüft außerdem `@@locale` und die Platzhalter-Metadaten jeder Zieldatei. Falls ein früheres Tool diese übersetzt hat, schreibt `champollion sync --pair en:fr --force` die Datei neu. Unveränderte Nachrichten werden ohne zusätzliche Kosten aus dem Cache geladen.

### Locales außerhalb der internen Flutter-Liste {#flutter-locales-outside-flutters-own-list}

Ihre Nachrichten stammen aus den `.arb`-Dateien. Der Text innerhalb von Flutters eigenen Widgets – etwa eine Datumsauswahl, „Zurück“, „Abbrechen“, die Textrichtung – stammt aus `flutter_localizations` (`GlobalMaterialLocalizations`, `GlobalCupertinoLocalizations`), welches eine feste Liste von Sprachen abdeckt ([Flutters Liste](https://api.flutter.dev/flutter/flutter_localizations/GlobalMaterialLocalizations-class.html)). Ein Code für die private Nutzung wie `qaa` und die meisten ressourcenarmen Sprachen sind darin nicht enthalten. Befindet sich ein solches Locale in `supportedLocales`, stürzt die App zur Laufzeit ab („No MaterialLocalizations found“), sofern kein Delegate diesen Text bereitstellt. `init` sowie ein Sync, der eine neue `.arb`-Datei erstellt, weisen für jedes Ziel außerhalb der Liste darauf hin: Sie lesen diese Information aus dem Flutter-SDK auf dem Rechner aus (`FLUTTER_ROOT` oder dem `flutter` unter `PATH`), und falls keines vorhanden ist, geben sie an, welche Ziele sie nicht prüfen konnten.

Die einfachste Lösung leiht diesen Widgets den Text einer Sprache, die Flutter abdeckt (hier Englisch):

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

Führen Sie ihn hinter Flutters eigenen Delegates auf:

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

Die Widgets zeigen dann englische Beschriftungen innerhalb einer App an, deren eigener Text in Ihrer Sprache verfasst ist. Um auch den Text der Widgets zu übersetzen, zeigt die Flutter-Dokumentation eine vollständige `MaterialLocalizations` für eine neue Sprache: [Unterstützung für eine neue Sprache hinzufügen](https://docs.flutter.dev/ui/accessibility-and-internationalization/internationalization#adding-support-for-a-new-language).

---

## Django und gettext (.po)

Die champollion-CLI ist quelloffen („source-available“) unter der [PolyForm Noncommercial License 1.0.0](https://github.com/gamedaysuits/Champollion/blob/main/cli/LICENSE) verfügbar: frei zur Nutzung, Änderung und Weitergabe für nicht-kommerzielle Zwecke. Die Nutzung für kommerzielle Zwecke wird von dieser Lizenz nicht abgedeckt ([wer dies nutzen darf](/docs/getting-started/who-may-use-this)).

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

Django sucht in den Ordnern, die `LOCALE_PATHS` auflistet, sowie im Ordner `locale/` jeder installierten App nach Katalogen. Ein `locale/` neben `manage.py` gehört zu keiner App; solange `LOCALE_PATHS` diesen Ordner also nicht benennt, erstellt `compilemessages` zwar weiterhin seine `.mo`-Dateien, die Website zeigt jedoch weiterhin den unübersetzten Text an. `LANGUAGES` ist die Liste der Sprachen, die die Website anbietet; standardmäßig verwendet Django jede mitgelieferte Sprache. Listen Sie daher Ihre eigenen auf:

```python title="settings.py"
LOCALE_PATHS = [BASE_DIR / "locale"]   # BASE_DIR: the folder with manage.py (startproject defines it)
LANGUAGES = [("en", "English"), ("fr", "Français"), ("ru", "Русский")]
```

### Einrichtung

Erstellen oder aktualisieren Sie die Kataloge zuerst mit Django. Der englische Katalog dient als Quelle. Seine leeren `msgstr` bedeuten „die msgid ist der Text“:

```bash
django-admin makemessages -l en -l fr -l ru
npx --yes champollion@0.5 init --yes --langs fr,ru
```

`init` findet `manage.py` sowie `locale/en/LC_MESSAGES/django.po` und schreibt:

```json
{
  "version": 3,
  "inputLocale": "en",
  "localesPattern": "locale/{lang}/LC_MESSAGES/{ns}.po",
  "languages": { "fr": "formal-vous", "ru": "formal-vy" }
}
```

`{ns}` ist die gettext-Domäne, sodass sowohl `django.po` als auch `djangojs.po` synchronisiert werden.

**Die Standardeinstellungen umfassen einen Tonfall und einen Gender-Stil; `init` gibt beides aus.** `formal-vous` fordert das Modell auf: „Formal French. Use vous-form (vouvoiement) consistently. Professional, academic register.“ Die Gender-Vorgabe für Französisch verlangt *écriture inclusive* mit dem Mediopunkt, wenn das Geschlecht der lesenden Person unbekannt ist (`Connecté·e`, `Utilisateur·rice·s`); die Vorgabe für Russisch (`formal-vy`) verwendet das Maskulinum als herkömmlichen Standard. Eine Website, die etwas anderes wünscht (beispielsweise die Patientenseiten einer Klinik), ändert dies in `champollion.config.json`: das Register in `languages` (`"fr": "casual-tu"` oder eigene Formulierungen) und `genderGuidance` – `false` für keine Anweisung oder eine eigene wie `"Use the masculine generic."` ([Gender-Vorgaben](/docs/getting-started/configuration#gender-guidance)). Eine geänderte Einstellung erhält eigene Cache-Einträge, sodass `sync --redo all` das neu übersetzt, was unter der alten Einstellung geschrieben wurde.

**Welche Methode übersetzt und welchen Schlüssel sie benötigt.** Ohne `--method` richtet `init` den Standard ein, `llm`: ein Modell auf [OpenRouter](https://openrouter.ai), welches `OPENROUTER_API_KEY` in der Umgebung oder in einer `.env`-Datei neben `manage.py` benötigt (`init` gibt die zu setzende Zeile aus, wenn er fehlt). Auf einem Rechner, auf dem ein Modellserver läuft (Ollama, LM Studio, vLLM), benötigt `npx --yes champollion@0.5 init --yes --langs fr,ru --method local --model llama3.1` keinen Schlüssel, und es verlässt nichts den Rechner. Ein CI-Runner verfügt über keinen Modellserver, daher benennt die CI für ihren Durchlauf ein gehostetes Modell (siehe den [CI-Leitfaden](/docs/guides/ci-cd)). Alle Methoden und die jeweils benötigten Schlüssel: [Übersetzungsmethoden](/docs/guides/translation-methods).

Anschließend:

```bash
npx --yes champollion@0.5 sync
django-admin compilemessages
```

Sync übersetzt jeden Eintrag mit leerer `msgstr` und jeden `fuzzy`-Eintrag und entfernt dabei das `fuzzy`-Flag. Bereits übersetzte Einträge bleiben Byte für Byte mitsamt ihren Kommentaren unverändert erhalten. Ein Eintrag mit einem `msgctxt` stellt einen eigenen Schlüssel und einen eigenen Cache-Eintrag dar, sodass „Open“ als Verb und „Open“ als Adjektiv separat übersetzt werden. `#.`-Kommentare und der Kontext werden an das Modell gesendet – um die exakte Anfrage einzusehen, ohne sie abzusenden, führen Sie `npx --yes champollion@0.5 sync --dry --show-prompt 'verb␄Open'` aus (Kontext und Kommentar erscheinen unter „UI context for these keys“).

**Einen einzelnen Eintrag gezielt neu übersetzen.** Benennen Sie ihn anhand seiner msgid:

```bash
npx --yes champollion@0.5 sync --pair en:fr --redo 'keys:Welcome back\, %(name)s!'
```

Dies wird aus dem Translation Memory bedient, wenn der Cache diesen Text bereits enthält, sodass Sie dieselbe Übersetzung kostenlos zurückerhalten; Sync weist mit dem Befehl `--fresh` darauf hin. Eine solche Wiederholung benötigt kein Modell: Bei `local` und angehaltenem Modellserver warnt Sync, dass der Server nicht antwortet und dieser Durchlauf ihn nicht benötigt, und fährt fort (eine Wiederholung, die Daten senden muss, stoppt und nennt den Server). Um eine neue Übersetzung kostenpflichtig anzufordern, fügen Sie `--fresh` hinzu. Ein Komma innerhalb einer msgid wird als `\,` geschrieben, und die Anführungszeichen verhindern, dass die Shell den Rest interpretiert. Ein Eintrag mit Kontext wird so benannt, wie Berichte ihn ausgeben: `verb␄Open`. Wenn Sie `␄` nicht eingeben können, schreiben Sie stattdessen `\x04`: `--redo 'keys:verb\x04Open'`. Beide Schreibweisen funktionieren, und Reparaturbefehle zeigen beide an. Um den Eintrag nur in einer Domäne zu benennen, stellen Sie die Domäne voran: `django::Welcome`. Ein Name, der auf keinen Eintrag zutrifft, lässt den Durchlauf fehlschlagen (Exit-Code 1) und listet die ähnlichsten Einträge auf, beispielsweise jeden Kontext der msgid `Cancel` (`button␄Cancel`, `status␄Cancel`). Er gilt niemals als abgeschlossene Wiederholung.

Ein von champollion erstellter Katalog (`init --langs` oder ein Sync für eine Sprache, die noch keinen Katalog besitzt) erhält den standardmäßigen gettext-Header mit den Feldern, die `msginit` schreibt, sodass `msgfmt -c` ihn akzeptiert. Der Header eines bestehenden Katalogs wird niemals überschrieben.

**`msgfmt -c`-Header-Warnungen bei Katalogen, die `makemessages` initiiert hat.** `makemessages` schreibt gettexts Vorlagen-Header – `Project-Id-Version: PACKAGE VERSION`, `PO-Revision-Date: YEAR-MO-DA HO:MI+ZONE`, `Last-Translator: FULL NAME <EMAIL@ADDRESS>`, `Language-Team: LANGUAGE <LL@li.org>`, markiert mit `#, fuzzy` – und `msgfmt -c` warnt anschließend bei jeder Kompilierung, dass jedes Feld „still has the initial default value“. Sync lässt diese Werte unberührt (in einem bestehenden Header füllt es nur einen Platzhalter `Plural-Forms` oder Zeichensatz aus); passen Sie diese daher einmal manuell in jedem Katalog an: Name und Version Ihres Projekts, das Datum, ein Übersetzer (oder `Automatically generated`) und ein Team (oder `none`); löschen Sie außerdem die Zeile `#, fuzzy` über `msgid ""`, die den Header als noch nicht überprüft kennzeichnet. `makemessages` behält die von Ihnen eingetragenen Werte bei. `compilemessages` (`msgfmt --check-format`) prüft den Header nicht, sodass diese Warnungen den Befehl nie fehlschlagen lassen.

**Plurale.** `msgid` + `msgid_plural` werden zu einer Nachricht zusammengefasst, die das Modell mit allen Formen übersetzt, die die Sprache benötigt. Die Formen werden gemäß dem `Plural-Forms`-Header des Katalogs in `msgstr[0]`, `msgstr[1]`, … geschrieben. Django schreibt diesen Header für Sie. Ein Katalog ohne diesen Header erhält denjenigen, den `msginit` für die Sprache schreibt (Französisch `nplurals=2; plural=(n > 1);`), oder einen aus dem CLDR abgeleiteten Header für Sprachen, die `msginit` nicht auflistet:

```po
msgid "One file"
msgid_plural "%(count)d files"
msgstr[0] "%(count)d файл"
msgstr[1] "%(count)d файла"
msgstr[2] "%(count)d файлов"
```

Wenn die Übersetzung eine Form auslässt, die die Sprache für gewöhnliche Zählungen verwendet (im Russischen `few` oder `many`), fordert Sync diese beim Modell erneut an. Fehlt sie in der Antwort weiterhin, schreibt Sync stattdessen die `other`-Form, markiert den Eintrag mit einem `# champollion:`-Kommentar und benennt ihn mitsamt dem Befehl zur erneuten Anforderung (`--redo 'keys:django::One file' --fresh`). Jeder Sync bricht mit `2` ab, solange sich ein markierter Eintrag im Katalog befindet – nicht nur derjenige, der ihn geschrieben hat, analog zu einem zurückgehaltenen Schlüssel. Die abschließende Überprüfungszeile meldet, dass der Durchlauf unvollständig ist, anstelle von `[OK]`. Tragen Sie die Formen von Hand ein und löschen Sie die Kommentarzeile, oder fordern Sie sie mit einem stärkeren `--model` erneut an. Ein Sync mit einer anderen Methode oder einem anderen Modell (das gehostete CI-Modell nach einem lokalen) fordert den Eintrag automatisch erneut an, und `sync --redo gaps` fragt jeden markierten Eintrag an; fehlen die Formen auch in dieser Antwort, bleibt der Eintrag markiert. In der CI lässt dies den Job nach dem Commit fehlschlagen (siehe den [CI-Leitfaden](/docs/guides/ci-cd#plural-gaps)).

**Weitere gettext-Layouts.**

| Projekt | Konfiguration | Quelle |
|---------|--------|--------|
| GNU (`po/fr.po`) | `"localesDir": "./po", "format": "po"` | `po/en.po` oder die eine Datei `.pot` in `po/` |
| Babel / Flask | `"localesPattern": "translations/{lang}/LC_MESSAGES/messages.po"` | `translations/en/…/messages.po` oder `messages.pot` in `translations/` oder dem übergeordneten Ordner |

`printf`-Platzhalter (`%s`, `%(name)s`, `%d`) müssen die Übersetzung unverändert überstehen, und das Quality Gate lehnt jeden Wert ab, der einen verliert. Führen Sie vor der Veröffentlichung dennoch `msgfmt --check-format` aus (`compilemessages` tut dies). Dieser Befehl prüft auch Platzhaltertypen, jedoch nur bei Einträgen, die mit `#, python-format` gekennzeichnet sind: `makemessages` fügt das Flag denjenigen Einträgen hinzu, die es mit einem `%`-Platzhalter extrahiert, während es in einem manuell erstellten Katalog fehlen kann und diese Einträge ungeprüft bleiben. `champollion verify` vergleicht die printf-Platzhalter jedes Eintrags (Name und Typbuchstabe) unabhängig von dessen Flags, und Sync behält die Flags des Quelleintrags bei jedem übersetzten Eintrag bei. Kataloge müssen UTF-8-kodiert sein. Die vollständigen Regeln finden Sie unter [gettext-Kataloge](/docs/getting-started/configuration#gettext).
