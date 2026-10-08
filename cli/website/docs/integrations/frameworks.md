# Integration Guides

Step-by-step setup for champollion with popular frameworks.

Commands on this page run champollion with `npx --yes champollion@0.5 <command>`: pinned to the 0.5 line, as in the [CI guide](/docs/guides/ci-cd), so your laptop and your CI run the same version and a new release never changes a run by surprise. A project-local install is the alternative. In a Node project, `npm install --save-dev champollion@0.5` adds it to `package.json`, and `npx champollion sync` then runs that copy.

---

## API Key Setup

Before integrating with any framework, you need a translation API key. Champollion supports two providers:

### Option A: OpenRouter (recommended)

[OpenRouter](https://openrouter.ai) provides a unified API for 200+ LLM models. Free tier available.

```bash
# Sign up at https://openrouter.ai, then:
export OPENROUTER_API_KEY=sk-or-v1-...

# Or add to .env.local:
OPENROUTER_API_KEY=sk-or-v1-your-key-here
```

Best for: content-heavy projects, Markdown translation, and projects needing content-aware shielding (code blocks, shortcodes, interpolation variables).

### Option B: Google Translate

```bash
export GOOGLE_TRANSLATE_API_KEY=...
```

Best for: high-volume key-value string pairs (194 languages). **Not recommended** for Markdown content — Google Translate has no awareness of code blocks, shortcodes, or interpolation variables.

To use Google Translate explicitly:

```bash
champollion sync --method google-translate
```

> **Tip**: If only `GOOGLE_TRANSLATE_API_KEY` is set (no OpenRouter key), champollion auto-switches to Google Translate automatically.

---

## Hugo (TOML / YAML / Markdown)

### Project structure

Hugo uses `i18n/` for string translations and `content/` for page content:

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

Create `champollion.config.json`:

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

### Content translation details

**Front matter**: Supports both YAML (`---`) and TOML (`+++`) delimiters. Translates `title`, `description`, `summary`, `subtitle`, `caption`, and `linkTitle` by default. All other fields (date, draft, tags, weight, slug, etc.) are preserved. Customize with `translatableFields` in your config.

**Block protection**: Code blocks, Hugo shortcodes (`{{< >}}`, `{{% %}}`), inline code, and raw HTML are automatically shielded using Unicode sentinel placeholders. They pass through untouched.

**Filename convention**: Follows Hugo's translation-by-filename pattern:
- `my-post.md` → `my-post.fr.md`
- `my-post.en.md` → `my-post.fr.md` (strips source suffix)

**Skip existing**: Existing translated files are never overwritten. Delete a target file to force re-translation.

### Plural forms

TOML and YAML locales support CLDR plural forms:

```toml
[items]
one = "{{ .Count }} item"
other = "{{ .Count }} items"
```

Internally represented as `items.one` and `items.other` for diffing, then re-serialized to the correct sectioned format on write.

---

## next-intl (JSON)

### Project structure

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

Run `npx --yes champollion@0.5 init --yes --langs fr,de,ja,es,ko,zh,pt,ar`. It finds `messages/en.json`, creates the empty target files and writes a config like the one below. Or create `champollion.config.json` yourself:

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

Each target's register (its tone and formality) is written into `languages`, so it is visible and editable: change one to another of the language's presets (`champollion status` lists them) or to your own words. A language with no presets is written as `{}`. A plain list, `"languages": ["fr", "de"]`, works too and uses each language's default.

```bash
npx --yes champollion@0.5 sync
```

Creates `messages/fr.json`, `messages/ja.json`, etc. — fully translated, preserving your nested key structure. next-intl picks them up automatically.

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

### Folder per language (i18next default)

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

`init` finds `public/locales/en/` (or `locales/en/`), points the config at it, and creates `fr/common.json`, `fr/admin/users.json` and the others as empty files. The relevant part of the config it writes:

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

Each namespace file is translated and written to the same path in every language's folder. A string that appears in several namespaces is translated once per language; the other files get it from the Translation Memory. Plural keys (`key_one`, `key_other`) get each language's own forms, read from CLDR through the JavaScript `Intl.PluralRules` API: a form the language uses that the source lacks is added, and one it does not use is left out. With an English source, Spanish and French gain `key_many`, Russian gains `key_few` and `key_many`, and Japanese keeps only `key_other`. Sync names, for your own languages, the forms each one gains. See [i18next plural keys](/docs/getting-started/configuration#i18next-plurals) and [Locale File Layouts](/docs/getting-started/configuration#locale-layouts).

### One file per language

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

### Other layouts

If your files follow another pattern, describe it with `localesPattern` (`{lang}` is the language, `{ns}` the namespace):

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

### Project structure

`flutter gen-l10n` reads one `.arb` file per language. The English one is the template:

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
npx --yes champollion@0.5 init --yes --langs fr,de,pt_BR
```

`init` reads `pubspec.yaml` and `l10n.yaml` (`arb-dir`, `template-arb-file`), takes the source language from the template's name (`app_en.arb` → `en`), and creates `app_fr.arb`, `app_de.arb` and `app_pt_BR.arb` with their `@@locale`. The config it writes:

```json
{
  "version": 3,
  "inputLocale": "en",
  "localesPattern": "lib/l10n/app_{lang}.arb",
  "languages": { "fr": "formal-vous", "de": "formal-Sie", "pt_BR": "professional" }
}
```

If `l10n.yaml` sets `arb-dir: assets/i18n` and `template-arb-file: intl_en.arb`, the pattern is `"assets/i18n/intl_{lang}.arb"`.

```bash
npx --yes champollion@0.5 sync
flutter gen-l10n
```

Only the messages are translated. Each target gets `"@@locale"` set to its own locale, written the way the file name writes it (`"pt_BR"`), because `gen-l10n` refuses a file whose `@@locale` disagrees with its name. Every `@key` metadata object, such as placeholders and their types, is copied from `app_en.arb` unchanged. Keys follow the template's order, and a message that is not translated yet is left out, so Flutter falls back to the English one.

Descriptions in the template's metadata are sent to the model as context:

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

The `{count, plural, …}` syntax, the `{count}` placeholder and the selectors are protected: a translation that changes them is rejected and retried (see [ICU messages](/docs/getting-started/configuration#icu)). French may add a `many` branch and Polish `few` and `many`. `champollion verify` also checks `@@locale` and the placeholder metadata of every target file. If an earlier tool translated them, `champollion sync --pair en:fr --force` rewrites the file. Unchanged messages come from the cache at no cost.

### Locales outside Flutter's own list {#flutter-locales-outside-flutters-own-list}

Your messages come from the `.arb` files. The text inside Flutter's own widgets — a date picker, "Back", "Cancel", the text direction — comes from `flutter_localizations` (`GlobalMaterialLocalizations`, `GlobalCupertinoLocalizations`), which covers a fixed list of languages ([Flutter's list](https://api.flutter.dev/flutter/flutter_localizations/GlobalMaterialLocalizations-class.html)). A private-use code such as `qaa`, and most low-resource languages, are not on it. With such a locale in `supportedLocales`, the app fails at runtime ("No MaterialLocalizations found") unless a delegate supplies that text. `init`, and a sync that creates a new `.arb` file, say so for each target outside the list: they read it from the Flutter SDK on the machine (`FLUTTER_ROOT`, or the `flutter` on `PATH`), and without one they say which targets they could not check.

The smallest fix lends those widgets the text of a language Flutter covers (English here):

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

List it after Flutter's own delegates:

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

The widgets then show English labels inside an app whose own text is in your language. To translate the widgets' text too, Flutter's guide shows a full `MaterialLocalizations` for a new language: [Adding support for a new language](https://docs.flutter.dev/ui/accessibility-and-internationalization/internationalization#adding-support-for-a-new-language).

---

## Django and gettext (.po)

The champollion CLI is source-available under the [PolyForm Noncommercial License 1.0.0](https://github.com/gamedaysuits/Champollion/blob/main/cli/LICENSE): free to use, change and share for noncommercial purposes. Using it for a commercial purpose is not covered by this license ([who may use this](/docs/getting-started/who-may-use-this)).

### Project structure

```
my_site/
├── manage.py
└── locale/
    ├── en/LC_MESSAGES/django.po    ← source catalog (makemessages -l en)
    ├── fr/LC_MESSAGES/django.po
    └── ru/LC_MESSAGES/django.po
```

### Settings: LOCALE_PATHS and LANGUAGES {#django-locale-paths}

Django looks for catalogs in the folders `LOCALE_PATHS` lists and in each installed app's `locale/` folder. A `locale/` beside `manage.py` belongs to no app, so until `LOCALE_PATHS` names it, `compilemessages` still builds its `.mo` files but the site keeps showing the untranslated text. `LANGUAGES` is the list of languages the site offers; Django's default is every language it ships with, so list your own:

```python title="settings.py"
LOCALE_PATHS = [BASE_DIR / "locale"]   # BASE_DIR: the folder with manage.py (startproject defines it)
LANGUAGES = [("en", "English"), ("fr", "Français"), ("ru", "Русский")]
```

### Setup

Create or refresh the catalogs with Django first. The English catalog is the source. Its empty `msgstr`s mean "the msgid is the text":

```bash
django-admin makemessages -l en -l fr -l ru
npx --yes champollion@0.5 init --yes --langs fr,ru
```

`init` finds `manage.py` and `locale/en/LC_MESSAGES/django.po` and writes:

```json
{
  "version": 3,
  "inputLocale": "en",
  "localesPattern": "locale/{lang}/LC_MESSAGES/{ns}.po",
  "languages": { "fr": "formal-vous", "ru": "formal-vy" }
}
```

`{ns}` is the gettext domain, so `django.po` and `djangojs.po` are both synced.

**The defaults are a tone and a gender style; `init` prints both.** `formal-vous` asks the model for "Formal French. Use vous-form (vouvoiement) consistently. Professional, academic register." French's gender guidance asks for *écriture inclusive* with the middle dot when the reader's gender is unknown (`Connecté·e`, `Utilisateur·rice·s`); Russian's (`formal-vy`) uses the masculine, the conventional default. A site that wants something else (a clinic's patient pages, say) changes it in `champollion.config.json`: the register in `languages` (`"fr": "casual-tu"`, or your own words), and `genderGuidance` — `false` for no instruction, or your own, such as `"Use the masculine generic."` ([Gender guidance](/docs/getting-started/configuration#gender-guidance)). A changed setting gets its own cache entries, so `sync --redo all` re-translates what the old one wrote.

**Which method translates, and which key it needs.** Without `--method`, `init` sets up the default, `llm`: a model on [OpenRouter](https://openrouter.ai), which needs `OPENROUTER_API_KEY` in the environment or in a `.env` file beside `manage.py` (`init` prints the line to set when it is missing). On a machine that runs a model server (Ollama, LM Studio, vLLM), `npx --yes champollion@0.5 init --yes --langs fr,ru --method local --model llama3.1` needs no key, and nothing leaves the machine. A CI runner has no model server, so CI names a hosted model for its run (see the [CI guide](/docs/guides/ci-cd)). Every method and the key each needs: [Translation Methods](/docs/guides/translation-methods).

Then:

```bash
npx --yes champollion@0.5 sync
django-admin compilemessages
```

Sync translates every entry with an empty `msgstr` and every `fuzzy` entry, removing the `fuzzy` flag. Entries already translated are left byte for byte, along with their comments. An entry with a `msgctxt` is its own key and its own cache entry, so "Open" the verb and "Open" the adjective are translated separately. `#.` comments and the context are sent to the model — to see the exact request, without sending it, run `npx --yes champollion@0.5 sync --dry --show-prompt 'verb␄Open'` (the context and comment appear under "UI context for these keys").

**Re-translating one entry on purpose.** Name it by its msgid:

```bash
npx --yes champollion@0.5 sync --pair en:fr --redo 'keys:Welcome back\, %(name)s!'
```

This is served from the Translation Memory when the cache already holds that text, so you get the same translation back at no cost, and sync says so with the `--fresh` command. Such a redo needs no model: with `local` and the model server stopped, sync warns that the server does not answer and that this run does not need it, and goes on (a redo that has to send something stops, naming the server). To pay for a new translation, add `--fresh`. A comma inside a msgid is written `\,`, and the quotes keep the shell from reading the rest. An entry with a context is named as reports print it, `verb␄Open`. If you cannot type `␄`, write `\x04` instead: `--redo 'keys:verb\x04Open'`. Both spellings work, and repair commands show both. To name the entry in one domain only, prefix the domain: `django::Welcome`. A name that matches no entry fails the run (exit 1) and lists the closest entries, for example every context of the msgid `Cancel` (`button␄Cancel`, `status␄Cancel`). It never passes as a finished redo.

A catalog that champollion creates (`init --langs`, or sync for a language with no catalog yet) gets the standard gettext header, the fields `msginit` writes, so `msgfmt -c` accepts it. An existing catalog's header is never rewritten.

**`msgfmt -c` header warnings on catalogs `makemessages` started.** `makemessages` writes gettext's template header — `Project-Id-Version: PACKAGE VERSION`, `PO-Revision-Date: YEAR-MO-DA HO:MI+ZONE`, `Last-Translator: FULL NAME <EMAIL@ADDRESS>`, `Language-Team: LANGUAGE <LL@li.org>`, marked `#, fuzzy` — and `msgfmt -c` then warns on every compile that each field "still has the initial default value". Sync leaves those values alone (in an existing header it fills only a placeholder `Plural-Forms` or charset), so fix them once by hand in each catalog: your project's name and version, the date, a translator (or `Automatically generated`) and a team (or `none`); also delete the `#, fuzzy` line above `msgid ""`, which marks the header as not yet reviewed. `makemessages` keeps the values you write. `compilemessages` (`msgfmt --check-format`) does not check the header, so these warnings never fail it.

**Plurals.** `msgid` + `msgid_plural` become one message the model translates with all the forms the language needs. The forms are written to `msgstr[0]`, `msgstr[1]`, … according to the catalog's `Plural-Forms` header. Django writes it for you. A catalog without one gets the header `msginit` writes for the language (French `nplurals=2; plural=(n > 1);`), or one derived from CLDR for a language `msginit` does not list:

```po
msgid "One file"
msgid_plural "%(count)d files"
msgstr[0] "%(count)d файл"
msgstr[1] "%(count)d файла"
msgstr[2] "%(count)d файлов"
```

When the translation leaves out a form the language uses for ordinary counts (Russian `few` or `many`), sync asks the model again for it. If the answer still lacks it, sync writes the `other` form in its place, marks the entry with a `# champollion:` comment and names it with the command that asks again (`--redo 'keys:django::One file' --fresh`). Every sync exits `2` while a marked entry is in the catalog, not only the sync that wrote it, as for a key held back. Its closing verification line says the run is incomplete instead of `[OK]`. Write the forms by hand and delete the comment line, or ask again with a stronger `--model`. A sync with another method or model (CI's hosted model, after a local one) asks for the entry again by itself, and `sync --redo gaps` asks for every marked entry; if the answer lacks the forms too, the entry stays marked. In CI this fails the job after the commit (see the [CI guide](/docs/guides/ci-cd#plural-gaps)).

**Other gettext layouts.**

| Project | Config | Source |
|---------|--------|--------|
| GNU (`po/fr.po`) | `"localesDir": "./po", "format": "po"` | `po/en.po`, or the one `.pot` in `po/` |
| Babel / Flask | `"localesPattern": "translations/{lang}/LC_MESSAGES/messages.po"` | `translations/en/…/messages.po`, or `messages.pot` in `translations/` or the folder above it |

`printf` placeholders (`%s`, `%(name)s`, `%d`) must survive translation, and the quality gate rejects a value that loses one. Still run `msgfmt --check-format` (`compilemessages` does) before shipping. It also checks placeholder types, but only on entries flagged `#, python-format`: `makemessages` adds the flag to the entries it extracts with a `%` placeholder, while a catalog made by hand may lack it, and those entries go unchecked. `champollion verify` compares every entry's printf placeholders (name and type letter) whatever its flags, and sync keeps the source entry's flags on each entry it translates. Catalogs must be UTF-8. See [gettext catalogs](/docs/getting-started/configuration#gettext) for the full rules.
