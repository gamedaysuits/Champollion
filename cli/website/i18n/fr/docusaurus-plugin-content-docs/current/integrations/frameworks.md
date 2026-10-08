# Guides d'intégration

Configuration étape par étape de champollion avec les frameworks populaires.

Les commandes de cette page exécutent champollion avec `npx --yes champollion@0.5 <command>` : verrouillé sur la branche 0.5, comme dans le [guide CI](/docs/guides/ci-cd), afin que votre ordinateur portable et votre CI exécutent la même version et qu'une nouvelle version ne modifie jamais une exécution à l'improviste. Une installation locale au projet constitue l'alternative. Dans un projet Node, `npm install --save-dev champollion@0.5` l'ajoute à `package.json`, et `npx champollion sync` exécute ensuite cette copie.

---

## Configuration de la clé API

Avant d'intégrer avec n'importe quel framework, vous avez besoin d'une clé API de traduction. Champollion prend en charge deux fournisseurs :

### Option A : OpenRouter (recommandé)

[OpenRouter](https://openrouter.ai) fournit une API unifiée pour 200+ modèles LLM. Niveau gratuit disponible.

```bash
# Sign up at https://openrouter.ai, then:
export OPENROUTER_API_KEY=sk-or-v1-...

# Or add to .env.local:
OPENROUTER_API_KEY=sk-or-v1-your-key-here
```

Idéal pour : les projets riches en contenu, la traduction Markdown, et les projets nécessitant une protection du contenu consciente (blocs de code, shortcodes, variables d'interpolation).

### Option B : Google Translate

```bash
export GOOGLE_TRANSLATE_API_KEY=...
```

Idéal pour : volumes élevés de paires clé-valeur de chaînes (194 langues). **Non recommandé** pour le contenu en Markdown — Google Translate ne prend pas en compte les blocs de code, les shortcodes ou les variables d'interpolation.

Pour utiliser Google Translate explicitement :

```bash
champollion sync --method google-translate
```

> **Conseil** : Si seul `GOOGLE_TRANSLATE_API_KEY` est défini (pas de clé OpenRouter), champollion bascule automatiquement vers Google Translate.

---

## Hugo (TOML / YAML / Markdown)

### Structure du projet

Hugo utilise `i18n/` pour les traductions de chaînes et `content/` pour le contenu des pages :

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

### Configuration

```bash
npm install --save-dev champollion
```

```bash
# .env.local
OPENROUTER_API_KEY=sk-or-v1-your-key-here
```

Créez `champollion.config.json` :

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

### Détails de la traduction du contenu

**Front matter** : Prend en charge les délimiteurs YAML (`---`) et TOML (`+++`). Traduit `title`, `description`, `summary`, `subtitle`, `caption`, et `linkTitle` par défaut. Tous les autres champs (date, draft, tags, weight, slug, etc.) sont préservés. Personnalisez avec `translatableFields` dans votre configuration.

**Protection des blocs** : Les blocs de code, les shortcodes Hugo (`{{< >}}`, `{{% %}}`), le code en ligne, et le HTML brut sont automatiquement protégés à l'aide de marqueurs sentinelles Unicode. Ils passent sans modification.

**Convention de nommage** : Suit le modèle de traduction par nom de fichier de Hugo :
- `my-post.md` → `my-post.fr.md`
- `my-post.en.md` → `my-post.fr.md` (supprime le suffixe source)

**Ignorer les fichiers existants** : Les fichiers traduits existants ne sont jamais écrasés. Supprimez un fichier cible pour forcer une re-traduction.

### Formes plurielles

Les locales TOML et YAML prennent en charge les formes plurielles CLDR :

```toml
[items]
one = "{{ .Count }} item"
other = "{{ .Count }} items"
```

Représentées en interne sous la forme `items.one` et `items.other` pour la comparaison, puis re-sérialisées au format sectionné correct lors de l'écriture.

---

## next-intl (JSON)

### Structure du projet

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

### Configuration

```bash
npm install --save-dev champollion
```

Exécutez `npx --yes champollion@0.5 init --yes --langs fr,de,ja,es,ko,zh,pt,ar`. La commande détecte `messages/en.json`, crée les fichiers cibles vides et génère une configuration semblable à celle ci-dessous. Vous pouvez également créer `champollion.config.json` vous-même :

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

Le registre de chaque cible (son ton et son niveau de formalité) est inscrit dans `languages`, de sorte qu'il reste visible et modifiable : remplacez-en un par un autre préréglage de la langue (`champollion status` en dresse la liste) ou par vos propres instructions. Une langue sans préréglages est notée sous la forme `{}`. Une simple liste, `"languages": ["fr", "de"]`, fonctionne également et utilise la valeur par défaut de chaque langue.

```bash
npx --yes champollion@0.5 sync
```

Crée `messages/fr.json`, `messages/ja.json`, etc. — entièrement traduits, en préservant votre structure de clés imbriquées. next-intl les récupère automatiquement.

### Flux de travail de développement

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

### Un dossier par langue (valeur par défaut d'i18next)

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

`init` détecte `public/locales/en/` (ou `locales/en/`), fait pointer la configuration vers celui-ci et crée `fr/common.json`, `fr/admin/users.json` ainsi que les autres sous forme de fichiers vides. Voici la section correspondante de la configuration générée :

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

Chaque fichier d'espace de noms est traduit et écrit dans le même chemin au sein du dossier de chaque langue. Une chaîne qui apparaît dans plusieurs espaces de noms est traduite une seule fois par langue ; les autres fichiers la récupèrent depuis la mémoire de traduction. Les clés de pluriel (`key_one`, `key_other`) reçoivent les formes propres à chaque langue, lues depuis CLDR via l'API JavaScript `Intl.PluralRules` : une forme utilisée par la langue mais absente de la source est ajoutée, et une forme qu'elle n'utilise pas est omise. Avec une source en anglais, l'espagnol et le français gagnent `key_many`, le russe gagne `key_few` et `key_many`, et le japonais ne conserve que `key_other`. Sync indique, pour vos propres langues, les formes que chacune gagne. Voir [Clés de pluriel i18next](/docs/getting-started/configuration#i18next-plurals) et [Organisation des fichiers de paramètres régionaux](/docs/getting-started/configuration#locale-layouts).

### Un fichier par langue

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

### Autres organisations

Si vos fichiers suivent un autre modèle, décrivez-le avec `localesPattern` (`{lang}` représente la langue, `{ns}` l'espace de noms) :

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

### Structure du projet

`flutter gen-l10n` lit un fichier `.arb` par langue. Le fichier anglais sert de modèle :

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

### Configuration

```bash
npx --yes champollion@0.5 init --yes --langs fr,de,pt_BR
```

`init` lit `pubspec.yaml` et `l10n.yaml` (`arb-dir`, `template-arb-file`), déduit la langue source du nom du modèle (`app_en.arb` → `en`) et crée `app_fr.arb`, `app_de.arb` et `app_pt_BR.arb` avec leur `@@locale`. La configuration générée est la suivante :

```json
{
  "version": 3,
  "inputLocale": "en",
  "localesPattern": "lib/l10n/app_{lang}.arb",
  "languages": { "fr": "formal-vous", "de": "formal-Sie", "pt_BR": "professional" }
}
```

Si `l10n.yaml` définit `arb-dir: assets/i18n` et `template-arb-file: intl_en.arb`, le motif est `"assets/i18n/intl_{lang}.arb"`.

```bash
npx --yes champollion@0.5 sync
flutter gen-l10n
```

Seuls les messages sont traduits. Chaque cible voit sa propriété `"@@locale"` définie sur ses propres paramètres régionaux, orthographiée de la même façon que dans le nom du fichier (`"pt_BR"`), car `gen-l10n` rejette tout fichier dont la valeur `@@locale` ne correspond pas à son nom. Chaque objet de métadonnées `@key`, tel que les espaces réservés et leurs types, est copié depuis `app_en.arb` sans modification. Les clés suivent l'ordre du modèle, et un message qui n'est pas encore traduit est omis, de sorte que Flutter bascule sur la version anglaise par défaut.

Les descriptions contenues dans les métadonnées du modèle sont transmises au modèle en guise de contexte :

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

La syntaxe `{count, plural, …}`, l'espace réservé `{count}` et les sélecteurs sont protégés : une traduction qui les altère est rejetée et réessayée (voir [Messages ICU](/docs/getting-started/configuration#icu)). Le français peut ajouter une branche `many` et le polonais `few` et `many`. `champollion verify` vérifie également `@@locale` et les métadonnées d'espace réservé de chaque fichier cible. Si un outil antérieur les a traduits, `champollion sync --pair en:fr --force` réécrit le fichier. Les messages inchangés proviennent du cache sans coût supplémentaire.

### Paramètres régionaux hors de la liste propre à Flutter {#flutter-locales-outside-flutters-own-list}

Vos messages proviennent des fichiers `.arb`. Le texte situé à l'intérieur des propres widgets de Flutter — un sélecteur de date, « Back », « Cancel », l'orientation du texte — provient de `flutter_localizations` (`GlobalMaterialLocalizations`, `GlobalCupertinoLocalizations`), qui couvre une liste fixe de langues ([liste de Flutter](https://api.flutter.dev/flutter/flutter_localizations/GlobalMaterialLocalizations-class.html)). Un code à usage privé tel que `qaa`, ainsi que la plupart des langues à faibles ressources, n'y figurent pas. Avec de tels paramètres régionaux dans `supportedLocales`, l'application échoue à l'exécution (« No MaterialLocalizations found »), à moins qu'un délégué ne fournisse ce texte. `init`, ainsi qu'une synchronisation qui crée un nouveau fichier `.arb`, le signalent pour chaque cible hors de la liste : ils le lisent depuis le SDK Flutter sur la machine (`FLUTTER_ROOT`, ou le `flutter` sur `PATH`), et en son absence, indiquent quelles cibles n'ont pas pu être vérifiées.

La solution minimale consiste à prêter à ces widgets le texte d'une langue prise en charge par Flutter (l'anglais dans cet exemple) :

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

Indiquez-le après les propres délégués de Flutter :

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

Les widgets affichent alors des libellés en anglais au sein d'une application dont le texte propre est dans votre langue. Pour traduire également le texte des widgets, le guide de Flutter détaille une implémentation complète de `MaterialLocalizations` pour une nouvelle langue : [Ajouter la prise en charge d'une nouvelle langue](https://docs.flutter.dev/ui/accessibility-and-internationalization/internationalization#adding-support-for-a-new-language).

---

## Django et gettext (.po)

Le CLI champollion est disponible sous la [PolyForm Noncommercial License 1.0.0](https://github.com/gamedaysuits/Champollion/blob/main/cli/LICENSE) : libre d'utilisation, de modification et de partage à des fins non commerciales. Son utilisation à des fins commerciales n'est pas couverte par cette licence ([qui peut l'utiliser](/docs/getting-started/who-may-use-this)).

### Structure du projet

```
my_site/
├── manage.py
└── locale/
    ├── en/LC_MESSAGES/django.po    ← source catalog (makemessages -l en)
    ├── fr/LC_MESSAGES/django.po
    └── ru/LC_MESSAGES/django.po
```

### Paramètres : LOCALE_PATHS et LANGUAGES {#django-locale-paths}

Django recherche les catalogues dans les dossiers listés par `LOCALE_PATHS` et dans le dossier `locale/` de chaque application installée. Un dossier `locale/` placé aux côtés de `manage.py` n'appartient à aucune application ; par conséquent, tant que `LOCALE_PATHS` ne le mentionne pas, `compilemessages` continue de générer ses fichiers `.mo`, mais le site continue d'afficher le texte non traduit. `LANGUAGES` correspond à la liste des langues proposées par le site ; par défaut, Django inclut toutes les langues avec lesquelles il est livré, veillez donc à lister les vôtres :

```python title="settings.py"
LOCALE_PATHS = [BASE_DIR / "locale"]   # BASE_DIR: the folder with manage.py (startproject defines it)
LANGUAGES = [("en", "English"), ("fr", "Français"), ("ru", "Русский")]
```

### Configuration

Créez ou actualisez d'abord les catalogues avec Django. Le catalogue anglais sert de source. Ses `msgstr` vides signifient « le msgid correspond au texte » :

```bash
django-admin makemessages -l en -l fr -l ru
npx --yes champollion@0.5 init --yes --langs fr,ru
```

`init` détecte `manage.py` et `locale/en/LC_MESSAGES/django.po` et écrit :

```json
{
  "version": 3,
  "inputLocale": "en",
  "localesPattern": "locale/{lang}/LC_MESSAGES/{ns}.po",
  "languages": { "fr": "formal-vous", "ru": "formal-vy" }
}
```

`{ns}` est le domaine gettext, ainsi `django.po` et `djangojs.po` sont tous deux synchronisés.

**Les paramètres par défaut définissent un ton et un style de genre ; `init` affiche les deux.** `formal-vous` demande au modèle : « Formal French. Use vous-form (vouvoiement) consistently. Professional, academic register. » Les consignes de genre pour le français préconisent l'écriture inclusive avec le point médian lorsque le genre du lectorat est inconnu (`Connecté·e`, `Utilisateur·rice·s`) ; celles pour le russe (`formal-vy`) emploient le masculin, la valeur par défaut conventionnelle. Un site qui souhaite autre chose (les pages destinées aux patient·es d'une clinique, par exemple) le modifie dans `champollion.config.json` : le registre dans `languages` (`"fr": "casual-tu"`, ou vos propres termes), et `genderGuidance` — `false` pour aucune instruction, ou la vôtre, telle que `"Use the masculine generic."` ([Consignes de genre](/docs/getting-started/configuration#gender-guidance)). Un paramètre modifié génère ses propres entrées de cache, de sorte que `sync --redo all` retraduit ce que l'ancien avait produit.

**Quelle méthode traduit, et de quelle clé elle a besoin.** Sans `--method`, `init` configure l'option par défaut, `llm` : un modèle sur [OpenRouter](https://openrouter.ai), qui nécessite `OPENROUTER_API_KEY` dans l'environnement ou dans un fichier `.env` à côté de `manage.py` (`init` affiche la ligne à définir en cas d'absence). Sur une machine exécutant un serveur de modèles (Ollama, LM Studio, vLLM), `npx --yes champollion@0.5 init --yes --langs fr,ru --method local --model llama3.1` ne requiert aucune clé, et rien ne quitte la machine. Un exécuteur CI ne disposant d'aucun serveur de modèles, la CI spécifie un modèle hébergé pour son exécution (voir le [guide CI](/docs/guides/ci-cd)). Retrouvez chaque méthode et la clé requise dans [Méthodes de traduction](/docs/guides/translation-methods).

Ensuite :

```bash
npx --yes champollion@0.5 sync
django-admin compilemessages
```

La synchronisation traduit chaque entrée dont le `msgstr` est vide ainsi que chaque entrée `fuzzy`, en supprimant l'indicateur `fuzzy`. Les entrées déjà traduites sont conservées à l'octet près, avec leurs commentaires. Une entrée comportant un `msgctxt` constitue sa propre clé et sa propre entrée de cache, de sorte que « Open » le verbe et « Open » l'adjectif sont traduits séparément. Les commentaires `#.` et le contexte sont envoyés au modèle — pour observer la requête exacte sans l'envoyer, exécutez `npx --yes champollion@0.5 sync --dry --show-prompt 'verb␄Open'` (le contexte et le commentaire apparaissent sous « UI context for these keys »).

**Retraduire délibérément une entrée.** Désignez-la par son msgid :

```bash
npx --yes champollion@0.5 sync --pair en:fr --redo 'keys:Welcome back\, %(name)s!'
```

Cette entrée est servie depuis la mémoire de traduction lorsque le cache contient déjà ce texte ; vous récupérez donc la même traduction sans frais, et la synchronisation le signale avec la commande `--fresh`. Une telle réexécution ne nécessite aucun modèle : avec `local` et le serveur de modèles arrêté, la synchronisation avertit que le serveur ne répond pas et que cette exécution n'en a pas besoin, puis poursuit son cours (une réexécution devant envoyer une requête s'interrompt en nommant le serveur). Pour solliciter une nouvelle traduction payante, ajoutez `--fresh`. Une virgule à l'intérieur d'un msgid s'écrit `\,`, et les guillemets empêchent le shell d'interpréter le reste. Une entrée assortie d'un contexte est désignée telle que les rapports l'affichent, `verb␄Open`. Si vous ne pouvez pas saisir `␄`, écrivez plutôt `\x04` : `--redo 'keys:verb\x04Open'`. Les deux syntaxes fonctionnent, et les commandes de réparation affichent les deux. Pour désigner l'entrée dans un seul domaine, préfixez-la par le domaine : `django::Welcome`. Un nom qui ne correspond à aucune entrée fait échouer l'exécution (code de sortie 1) et liste les entrées les plus proches, par exemple chaque contexte du msgid `Cancel` (`button␄Cancel`, `status␄Cancel`). L'opération n'est jamais considérée comme une réexécution réussie.

Un catalogue créé par champollion (`init --langs`, ou sync pour une langue ne disposant pas encore de catalogue) reçoit l'en-tête gettext standard, avec les champs que `msginit` génère, de façon à ce que `msgfmt -c` l'accepte. L'en-tête d'un catalogue existant n'est jamais réécrit.

**Avertissements d'en-tête de `msgfmt -c` sur les catalogues initialisés par `makemessages`.** `makemessages` génère l'en-tête de modèle gettext — `Project-Id-Version: PACKAGE VERSION`, `PO-Revision-Date: YEAR-MO-DA HO:MI+ZONE`, `Last-Translator: FULL NAME <EMAIL@ADDRESS>`, `Language-Team: LANGUAGE <LL@li.org>`, marqué `#, fuzzy` — et `msgfmt -c` avertit ensuite à chaque compilation que chaque champ « still has the initial default value ». La synchronisation ne modifie pas ces valeurs (dans un en-tête existant, elle ne renseigne qu'un espace réservé `Plural-Forms` ou un jeu de caractères) ; corrigez-les donc manuellement une seule fois dans chaque catalogue : le nom et la version de votre projet, la date, une personne traductrice (ou `Automatically generated`) et une équipe (ou `none`) ; supprimez également la ligne `#, fuzzy` située au-dessus de `msgid ""`, qui signale que l'en-tête n'a pas encore été révisé. `makemessages` conserve les valeurs que vous saisissez. `compilemessages` (`msgfmt --check-format`) ne vérifie pas l'en-tête, de sorte que ces avertissements ne le font jamais échouer.

**Pluriels.** `msgid` + `msgid_plural` deviennent un message unique que le modèle traduit avec toutes les formes requises par la langue. Les formes sont inscrites dans `msgstr[0]`, `msgstr[1]`, … conformément à l'en-tête `Plural-Forms` du catalogue. Django le renseigne pour vous. Un catalogue qui en est dépourvu reçoit l'en-tête que `msginit` écrit pour la langue (le français `nplurals=2; plural=(n > 1);`), ou un en-tête dérivé de CLDR pour une langue non répertoriée par `msginit` :

```po
msgid "One file"
msgid_plural "%(count)d files"
msgstr[0] "%(count)d файл"
msgstr[1] "%(count)d файла"
msgstr[2] "%(count)d файлов"
```

Lorsque la traduction omet une forme utilisée par la langue pour le décompte ordinaire (`few` ou `many` en russe), la synchronisation la redemande au modèle. Si la réponse en est toujours dépourvue, la synchronisation écrit la forme `other` à sa place, marque l'entrée avec un commentaire `# champollion:` et la signale avec la commande permettant de réitérer la demande (`--redo 'keys:django::One file' --fresh`). Toute synchronisation se termine avec le code `2` tant qu'une entrée marquée figure dans le catalogue, et non pas seulement la synchronisation qui l'a inscrite, à l'instar d'une clé retenue. Sa ligne de vérification finale indique que l'exécution est incomplète au lieu d'afficher `[OK]`. Renseignez les formes à la main et supprimez la ligne de commentaire, ou réessayez avec un `--model` plus performant. Une synchronisation avec une autre méthode ou un autre modèle (le modèle hébergé de la CI après un modèle local) redemande l'entrée de manière autonome, et `sync --redo gaps` redemande chaque entrée marquée ; si la réponse ne contient toujours pas les formes, l'entrée reste marquée. En CI, cela fait échouer le job après le commit (voir le [guide CI](/docs/guides/ci-cd#plural-gaps)).

**Autres organisations gettext.**

| Projet | Configuration | Source |
|--------|---------------|--------|
| GNU (`po/fr.po`) | `"localesDir": "./po", "format": "po"` | `po/en.po`, ou le `.pot` unique dans `po/` |
| Babel / Flask | `"localesPattern": "translations/{lang}/LC_MESSAGES/messages.po"` | `translations/en/…/messages.po`, ou `messages.pot` dans `translations/` ou le dossier supérieur |

Les espaces réservés `printf` (`%s`, `%(name)s`, `%d`) doivent subsister à la traduction, et le contrôle de qualité rejette toute valeur qui en perd un. Exécutez tout de même `msgfmt --check-format` (ce que fait `compilemessages`) avant le déploiement. Cette commande vérifie également le type des espaces réservés, mais uniquement sur les entrées marquées de l'indicateur `#, python-format` : `makemessages` ajoute cet indicateur aux entrées qu'il extrait avec un espace réservé `%`, tandis qu'un catalogue constitué à la main peut en être dépourvu, laissant ces entrées non vérifiées. `champollion verify` compare les espaces réservés printf de chaque entrée (nom et lettre de type) quels que soient ses indicateurs, et la synchronisation conserve les indicateurs de l'entrée source sur chaque entrée traduite. Les catalogues doivent être encodés en UTF-8. Voir [Catalogues gettext](/docs/getting-started/configuration#gettext) pour l'ensemble des règles.
