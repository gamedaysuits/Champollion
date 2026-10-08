---
sidebar_position: 3
title: "Configuration"
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

# Configuration

Champollion fonctionne sans configuration — il détecte automatiquement les fichiers de locale, le format et les langues cibles de votre projet. Pour plus de contrôle, créez `champollion.config.json` à la racine de votre projet, ou exécutez :

```bash
npx champollion init
```

## Référence de configuration complète

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

:::note[typegen n'est pas encore implémenté]
Le bloc de configuration `typegen` est reconnu et préservé par le chargeur de configuration, mais la génération de types TypeScript n'est pas encore implémentée. Ceci est un espace réservé pour une fonctionnalité prévue. La définition de ces valeurs n'a aucun effet.
:::


### Champs

| Champ | Type | Valeur par défaut | Description |
|-------|------|-------------------|-------------|
| `version` | `number` | `3` | Version du schéma de configuration. Toujours `3`. |
| `inputLocale` | `string` | `"en"` | Code de la langue source (BCP 47). |
| `localesDir` | `string` | `"./locales"` | Chemin vers les fichiers de locale. Contient un fichier par langue (`fr.json`) ou un dossier par langue (`fr/common.json`). Voir [Dispositions des fichiers de locale](#locale-layouts). |
| `localesPattern` | `string` | `null` | Emplacement des fichiers de chaque langue lorsqu'aucune de ces structures ne convient, avec `{lang}` et un `{ns}` optionnel : `"public/locales/{lang}/{ns}.json"`, `"src/strings/app_{lang}.json"`. Relatif à la racine du projet. Remplace `localesDir`. Voir [Dispositions des fichiers de locale](#locale-layouts). |
| `localesLayout` | `string` | `null` | Remplace la détection de disposition : `"flat"` (un fichier par langue) ou `"dir"` (un dossier par langue). Requis uniquement lorsque `en.json` et `en/` existent tous les deux. |
| `defaultNamespace` | `string` | `null` | Dans un projet avec un dossier par langue comportant plusieurs fichiers, fichier auquel `champollion wrap` ajoute les nouvelles clés (p. ex. `"common"`). |
| `contentDir` | `string` | `null` | Dossier de fichiers Markdown/MDX à traduire : un dossier `content/` Hugo ou tout autre dossier, tel que `./newsletters` dans une application Next.js. Chaque traduction est écrite aux côtés de sa source sous la forme `<name>.<locale>.md`, par exemple `2026-10.md` → `2026-10.crk.md`. Les fichiers déjà nommés `<name>.<code>.md` sont traités comme des traductions, non comme des sources. Voir [Traduction de contenu](/docs/guides/content-translation). |
| `translatableFields` | `string[]` | `null` | Remplace les champs de frontmatter traduisibles par défaut pour la traduction de contenu. `null` utilise les valeurs par défaut intégrées (`title`, `description`, `summary`). |
| `format` | `string` | `"auto"` | Format de fichier : `json`, `toml`, `yaml`, `po` ([gettext](#gettext)), `arb` ([Flutter](#arb)) ou `auto` (détecté d'après l'extension du fichier source ; `.yml` est traité comme du YAML et les cibles conservent `.yml`). Toute autre valeur s'interrompt avec une erreur. |
| `model` | `string` | `"google/gemini-3.8-flash"` | Modèle par défaut pour les méthodes LLM. Un slug de modèle exact : le slug OpenRouter complet (`provider/model`). Les alias courts (`gemini-flash`) et les identifiants flottants (`~vendor/…`, `…-latest`) sont refusés, en précisant le slug à renseigner. Les fournisseurs directs utilisent des noms bruts (p. ex. `gpt-4o`) ; un slug OpenRouter correspondant à leur propre fournisseur y est mappé (`openai/gpt-4o` → `gpt-4o`), et un slug pour lequel ils n'ont aucun modèle interrompt l'exécution avant tout envoi ([Noms de modèles](/docs/guides/translation-methods#model-names)). |
| `temperature` | `number` | `0.3` | Température du LLM (0,0–2,0). Plus elle est basse, plus le résultat est déterministe. |
| `defaultMethod` | `string` | `"llm"` | Méthode de traduction par défaut : `llm`, `llm-coached`, `openai`, `anthropic`, `gemini`, `local`, `google-translate`, `deepl`, `microsoft-translator`, `libretranslate`, `apertium`, `tilde`, `translated`, `api`. `local` désigne un serveur compatible OpenAI sur votre machine (Ollama par défaut). Remplacée par l'option CLI `--method`. |
| `batchSize` | `number` | `80` | Nombre de clés par lot de traduction. Plus il est élevé, moins il y a d'appels API, mais plus les invites sont volumineuses. |
| `coachingFile` | `string` | `null` | Chemin vers un fichier d'invite de coaching en texte libre (relatif à la racine du projet). Son contenu est lu au démarrage et injecté dans l'invite système sous la forme d'un bloc `Coaching guidance:`. |
| `promptContext` | `string` | `null` | Chaîne de contexte applicatif injectée dans l'invite système (p. ex. « Descriptions de produits e-commerce »). Aide le modèle à adapter les traductions à votre domaine. |
| `genderGuidance` | `string` \| `false` | `null` | Manière dont les invites LLM gèrent le genre grammatical. `null` conserve la valeur par défaut de chaque langue issue du catalogue de Champollion — pour le français, l'*écriture inclusive* avec le point médian (`Connecté·e`, `Utilisateur·rice·s`) ; pour l'allemand, la forme avec deux-points (`Benutzer:innen`). `false` n'envoie aucune consigne de genre ; une chaîne transmet la vôtre (p. ex. `"Use the masculine generic."`). Également définissable par langue et par paire. Voir [Consignes de genre](#gender-guidance). |
| `protectedTerms` | `string[]` | `[]` | Noms à conserver exactement tels quels dans chaque langue : personnes, entreprises, produits (p. ex. `["Curtis Forbes", "Game Day Suits"]`). Le modèle a pour consigne de les préserver, et une valeur composée uniquement de ces noms n'est jamais signalée comme non traduite ou dans un système d'écriture incorrect. Cela diffère de `noTranslate`, qui ignore des **clés** entières. |
| `jsonConcurrency` | `number` | `200` | Nombre maximal de traductions de locales en parallèle pour la synchronisation des clés JSON. Remplacé par l'option CLI `--json-concurrency`. |
| `contentConcurrency` | `number` | `48` | Nombre maximal d'appels API en parallèle pour la traduction de contenu (Markdown/MDX). Remplacé par l'option CLI `--content-concurrency`. |
| `fallbackPrefix` | `string` | `"[EN] "` | Préfixe de marqueur utilisé par `audit` et `verify` pour détecter les anciennes valeurs non traduites provenant d'exécutions antérieures. Champollion n'écrit pas ce préfixe — il le lit uniquement pour la détection. |
| `apiKeyEnvVar` | `string` | `"OPENROUTER_API_KEY"` | Nom de la variable d'environnement contenant la clé API. À remplacer pour des noms de variables d'environnement personnalisés. |
| `minContentRetention` | `number` | `0.35` | Fraction de lettres/chiffres de la source qu'une sortie doit conserver avant que la [vérification de suppression de contenu](/docs/concepts/quality-gate) ne consulte son second signal. Également définissable par paire et par langue. |
| `noTranslate` | `string[]` | `[]` | Clés avec notation par points et motifs glob dont la valeur est copiée textuellement dans chaque locale. Voir [Clés à ne pas traduire](#no-translate). Également accepté sous la forme `skipKeys`. |
| `noTranslateUrls` | `boolean` | `true` | Traiter les valeurs sources consistant uniquement en une URL `scheme://` comme étant à ne pas traduire. Définissez `false` pour transmettre les clés contenant des URL au backend de traduction. |
| `baseUrl` | `string` | `""` | URL de base pour la génération des artefacts SEO (hreflang, sitemaps, JSON-LD). |
| `pairs` | `object` | `{}` | Remplacements de méthode, de modèle et de qualité par paire. Voir [Configuration par paire](#pair-configuration). |
| `languages` | `object` | `{}` | Remplacements par langue. Voir [Configuration par langue](#language-configuration). |
| `lint.srcDir` | `string` | `null` | Répertoire source pour l'analyse de lint. `null` = détection automatique d'après le framework. |
| `lint.ignore` | `string[]` | `["node_modules", ...]` | Motifs glob à exclure du lint. |
| `lint.minLength` | `number` | `2` | Longueur minimale de chaîne pour la signaler comme codée en dur. |
| `seo.urlPattern` | `string` | `"/:locale/:path"` | Modèle de motif d'URL pour la génération des balises hreflang. |
| `seo.pages` | `string[]` | `null` | Liste explicite de pages pour le SEO. `null` = détection automatique d'après les clés de locale. |
| `typegen.output` | `string` | `null` | Chemin de sortie pour les types TypeScript générés. `null` = désactivé. |
| `typegen.autoGenerate` | `boolean` | `false` | Régénérer automatiquement les types après chaque synchronisation. |

## Dispositions des fichiers de locale {#locale-layouts}

Champollion lit vos fichiers de locale là où votre framework les conserve déjà. Trois structures sont possibles.

**Un fichier par langue** (`flat`). next-intl, vue-i18n, Hugo, ainsi que la plupart des configurations personnalisées :

```text
messages/
  en.json      ← source
  fr.json
  de.json
```

```json title="champollion.config.json"
{ "localesDir": "./messages" }
```

**Un dossier par langue** (`dir`). i18next et react-i18next, où chaque fichier représente un *namespace* (espace de noms) :

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

Champollion choisit `dir` lorsque `<localesDir>/<inputLocale>/` est un dossier contenant des fichiers de locale. Chaque fichier source est synchronisé vers le même chemin sous le dossier de chaque langue, et les fichiers ainsi que les dossiers manquants sont créés. Un namespace peut être un chemin imbriqué (`admin/users`).

**Toute autre structure** (`localesPattern`). Indiquez le chemin avec `{lang}` et, si une langue comporte plusieurs fichiers, `{ns}` :

```json title="champollion.config.json"
{ "localesPattern": "src/translations/{ns}/{lang}.json" }
```

`{lang}` peut se répéter, comme dans `"{lang}/app_{lang}.json"`. `{ns}` ne peut apparaître qu'une seule fois et peut s'étendre sur plusieurs dossiers. Le format est déduit de l'extension, sauf si `format` est défini.

`champollion init` détecte ces dispositions pour vous. Il recherche d'abord une application Flutter (`pubspec.yaml`, avec `l10n.yaml` si présent) et des catalogues gettext (`locale/<lang>/LC_MESSAGES/`, `translations/`, GNU `po/`), et génère un `localesPattern` adapté. Il vérifie ensuite le dossier habituel de votre framework (`messages/` pour next-intl, `public/locales/` puis `locales/` pour i18next, `src/locales/` pour vue-i18n, `i18n/` pour Hugo), puis `locales`, `messages`, `i18n`, `lang`, `translations`, `public/locales`, `src/locales` et `src/i18n`. Il n'utilise qu'un dossier qui contient le fichier de votre langue source, et affiche ce qu'il a trouvé. `init --langs fr,de` crée également les fichiers cibles vides selon cette disposition.

:::note[Synchronisation d'une langue multi-fichiers]
Chaque fichier est comparé, traduit et écrit séparément. `.champollion.lock` enregistre les clés sous la forme `<namespace>::<key>` (`common::nav.home`), tout comme `--force-keys`, les identifiants d'unité `xliff` et `sync --dry --json`. Une clé brute dans `--force-keys` correspond à cette même clé dans chaque fichier. Les projets à un fichier par langue conservent des clés simples, de sorte que leur fichier de verrouillage ne change pas.

La mémoire de traduction est indexée par le texte source, et non par fichier. Une chaîne qui apparaît dans deux espaces de noms n'est traduite qu'une seule fois par langue. Le second fichier la récupère depuis le cache sans coût supplémentaire.
:::

Si à la fois `en.json` et un dossier `en/` contenant des fichiers existent, Champollion s'arrête et vous demande de définir `"localesLayout": "flat"` ou `"dir"` plutôt que de deviner.

### Clés de pluriel i18next {#i18next-plurals}

i18next stocke les pluriels sous forme de clés sœurs avec un suffixe CLDR : `item_one`, `item_other`. Les langues ont différentes formes de pluriel. Le français et l'espagnol utilisent également `_many`, l'arabe en utilise six, et le japonais seulement `_other`. Lorsqu'un fichier source JSON contient ces clés, chaque cible reçoit exactement les formes propres à sa langue, lues depuis le CLDR via l'API JavaScript `Intl.PluralRules` :

```json title="en.json"
{ "item_one": "{{count}} item", "item_other": "{{count}} items" }
```

Après une synchronisation, `fr.json` possède `item_one`, `item_many` et `item_other`, tandis que `ja.json` ne possède que `item_other`. La synchronisation indique, pour vos propres langues, quelles formes chacune gagne ou abandonne.

Les nouvelles formes sont traduites à partir du texte `_other` de la source, `_one` à partir de `_one`. Une clé `_zero` présente dans la source est conservée dans toutes les langues, car i18next la recherche pour une valeur de 0 dans toutes les langues. Si une synchronisation antérieure a écrit une forme que la langue n'utilise pas, telle que `item_one` en japonais, la synchronisation ne la supprime que si la mémoire de traduction indique que c'est la synchronisation qui a produit cette valeur. Une valeur rédigée manuellement est conservée. Une clé correspondant à une forme que la langue ne possède pas et pour laquelle la source n'a pas non plus de clé (espagnol `item_two`) n'est jamais supprimée d'elle-même : `verify` la signale, et `sync --prune plural-extras` supprime précisément ces clés en les listant une par une (avec `--dry`, il indique ce qu'il supprimerait). Pour une langue pour laquelle le CLDR n'a pas de règles de pluriel, les formes de la source sont copiées une à une, et la synchronisation le signale.

### Messages ICU {#icu}

Les valeurs écrites au format ICU MessageFormat (next-intl, react-intl, vue-i18n, Flutter) mêlent du code à du texte :

```json
{ "items": "{count, plural, =0 {No events} one {# event} other {# events}}" }
```

Seul le texte situé à l'intérieur des branches est traduit. Le [contrôle qualité](/docs/concepts/quality-gate) rejette toute traduction qui modifie quoi que ce soit d'autre :

- les noms de variables (`count`, `{name}`), qui ne sont jamais renommés ni supprimés ;
- les mots `plural`, `select` et `selectordinal`, ainsi que le type de `{price, number}` ;
- les sélecteurs (`=0`, `one`, `other`, `male`). Un `select` conserve exactement ses options. Un `plural` conserve les sélecteurs de la source et peut ajouter les catégories utilisées par la langue cible, issues du CLDR : le français ajoute `many`, le polonais `few` et `many`. Une catégorie non utilisée par la langue peut être retirée, le japonais ne conservant par exemple que `other` ;
- `#` dans chaque branche de pluriel qui le contient, sauf `zero`, `one`, `two` et `=N`, où une langue peut écrire le nombre sous forme de mot ;
- `offset:N`, les arguments imbriqués et les conversions printf telles que `%s`, `%d` et `%(name)s`.

Le modèle est informé des catégories utilisées par la langue cible. Une traduction rejetée fait l'objet d'une nouvelle tentative avec la raison correspondante, par exemple `ICU keyword 'other' was translated to 'óthér'`. Une apostrophe avant un espace réservé (placeholder, `d'{name}`) est acceptée. `verify` et `integrity` exécutent la même vérification sur les fichiers déjà écrits. Une simple commande `sync` conserve une valeur déjà présente sur le disque ; chaque résultat indique donc la commande permettant de la réparer, `champollion sync --pair <pair> --redo keys:<key>`. Lorsque la valeur endommagée provenait de la mémoire de traduction, celle-ci est retirée du cache afin que cette commande traduise à nouveau la clé au lieu de renvoyer le même texte ; aucun `--fresh` n'est nécessaire.

### Catalogues gettext (.po) {#gettext}

Pointez `localesPattern` (ou `localesDir`) vers vos catalogues :

```json title="Django"
{ "localesPattern": "locale/{lang}/LC_MESSAGES/{ns}.po" }
```

```json title="GNU (po/fr.po, po/de.po, po/hello.pot)"
{ "localesDir": "./po", "format": "po" }
```

**La source** est le catalogue de la langue source, par exemple `locale/en/LC_MESSAGES/django.po` issu de `django-admin makemessages -l en`. Son `msgid` constitue le texte à traduire lorsque `msgstr` est vide. Lorsque ce catalogue n'existe pas, la source est un modèle `.pot` :

- Avec `localesDir` : l'unique fichier `.pot` présent dans ce dossier.
- Avec `localesPattern` : `<name>.pot` dans le dossier précédant le premier placeholder ou dans le dossier parent. `<name>` correspond à l'espace de noms (`{ns}`, un modèle par domaine tel que `django.pot`), ou au nom de fichier du motif sans `{lang}` (`messages.po` → `messages.pot`).
- Avec `localesLayout: "dir"` : aucun modèle n'est recherché. Conservez le catalogue source dans `<localesDir>/<source>/`.

La présence de deux modèles là où un seul est attendu interrompt l'exécution. Champollion ne tente pas de deviner lequel constitue la source.

**Clés.** Chaque `msgid` constitue une clé. Une entrée avec un `msgctxt` a pour clé `msgctxt` + U+0004 + `msgid`, le propre encodage de gettext. « Open » le verbe et « Open » l'adjectif constituent des clés distinctes et des entrées de cache distinctes. Les rapports affichent le séparateur sous la forme `␄` (`verb␄Open`), et `--force-keys "verb␄Open"` l'accepte. Si vous ne pouvez pas saisir `␄`, écrivez `\x04` (`--force-keys 'verb\x04Open'`) : les deux syntaxes fonctionnent. `--force-keys` (et `--redo keys:`) sépare au niveau des virgules ; écrivez une virgule à l'intérieur d'un msgid sous la forme `\,` et placez l'argument entre guillemets : `--redo 'keys:Welcome back\, %(name)s!'`. Les entrées inchangées proviennent du cache sans coût supplémentaire.

**Ce qui est traduit.** Une entrée avec un `msgstr` vide, ou signalée par le drapeau `fuzzy`, est considérée comme non traduite. La synchronisation la traduit et supprime `fuzzy` ainsi que les lignes `#|` du msgid précédent. Les commentaires du traducteur (`# …`) sont conservés. Les références (`#:`), les commentaires extraits (`#.`) et les drapeaux proviennent de la source. Les commentaires `#.` et `msgctxt` sont transmis au modèle comme contexte. Les entrées non modifiées par la synchronisation sont réécrites à l'octet près. Les entrées qui ne figurent plus dans la source, ainsi que les entrées obsolètes `#~`, sont conservées à la fin.

Un catalogue créé par Champollion (`init --langs`, ou la synchronisation d'une locale ne disposant pas encore de catalogue) reçoit l'en-tête complet généré par `msginit --no-translator`, que `msgfmt -c` accepte : `Project-Id-Version`, `Report-Msgid-Bugs-To` et `POT-Creation-Date` copiés depuis le modèle (`PACKAGE VERSION` est remplacé par le nom du dossier du projet, et il n'y a pas de `POT-Creation-Date` en l'absence de date dans le modèle), `PO-Revision-Date` (date de création du fichier), `Last-Translator: Automatically generated`, `Language-Team: none`, `Language`, `MIME-Version: 1.0`, `Content-Type: text/plain; charset=UTF-8`, `Content-Transfer-Encoding: 8bit` et `Plural-Forms`. L'en-tête d'un catalogue existant n'est jamais réécrit — seul un placeholder `Plural-Forms` ou `charset=CHARSET` présent à l'intérieur est renseigné.

**Pluriels.** Une entrée avec `msgid_plural` est traduite comme un message pluriel ICU unique (`{n, plural, one {One file} other {%(count)d files}}`), de sorte que le modèle rédige toutes les formes en une seule fois. Elle est ensuite écrite dans `msgstr[0]`…`msgstr[n]` par le biais de l'en-tête `Plural-Forms` de la cible. Chaque index prend la catégorie CLDR des nombres qui le sélectionnent. Le russe `nplurals=3` donne `one`, `few`, `many`. Si la cible n'a pas d'en-tête `Plural-Forms`, ou seulement le placeholder du modèle, elle reçoit l'en-tête que `msginit` génère pour sa langue, de sorte que les emplacements `msgstr[]` du catalogue correspondent à ceux sélectionnés par gettext et Django : français `nplurals=2; plural=(n > 1);`, allemand `nplurals=2; plural=(n != 1);`, russe `nplurals=3; …`. Une langue pour laquelle `msginit` n'a pas d'entrée reçoit un en-tête dérivé du CLDR, vérifié par rapport à `Intl.PluralRules` pour chaque nombre jusqu'à 3 000 ainsi que pour les grands nombres. Si les règles d'une langue ne peuvent pas être écrites sous forme d'expression gettext, la synchronisation s'arrête et indique la commande permettant d'écrire l'en-tête : `msginit --locale=<lang> --input=<template>.pot`. Une forme pour laquelle le catalogue n'a pas d'emplacement (le français `many`, pour 1 000 000, dans un catalogue à deux formes) n'est plus demandée, ni marquée ou signalée comme manquante ; un catalogue possédant son propre en-tête le conserve, et ce sont ses emplacements qui sont vérifiés.

**Limites.** Les catalogues doivent être encodés en UTF-8. Convertissez les autres avec `msgconv --to-code=UTF-8`. Un msgid pluriel dont les accolades ne sont pas équilibrées ne peut pas être écrit sous forme de message ICU ; il est donc signalé et vous est laissé à traduire manuellement. Exécutez tout de même `msgfmt --check-format` (Django : `compilemessages`) avant la mise en production. Celui-ci ne vérifie que les entrées marquées `#, python-format` (ou `c-format`, …) : `makemessages` ajoute ce drapeau aux entrées qu'il extrait avec un placeholder `%`, mais un catalogue confectionné à la main peut en être dépourvu, auquel cas ces entrées ne sont pas vérifiées. `champollion verify` compare les placeholders printf de chaque entrée — nom et lettre de type — quels que soient ses drapeaux, et la synchronisation conserve les drapeaux de l'entrée source sur chaque entrée qu'elle traduit.

### Fichiers Flutter ARB (.arb) {#arb}

```json title="champollion.config.json"
{ "localesPattern": "lib/l10n/app_{lang}.arb" }
```

Utilisez `arb-dir` et `template-arb-file` définis dans votre `l10n.yaml` s'ils diffèrent (`assets/i18n/intl_{lang}.arb`). Seuls les messages sont traduits. Lors de l'écriture :

- `@@locale` est défini sur la cible selon le format de Flutter, en correspondance avec le nom du fichier (`app_pt_BR.arb` → `"pt_BR"`). `gen-l10n` refuse un fichier dont le `@@locale` ne concorde pas avec son nom.
- Chaque objet de métadonnées `@key` (placeholders, leurs types, descriptions) est copié depuis la source. Une clé pour laquelle la source n'a pas de métadonnées conserve celles de la cible.
- Les clés respectent l'ordre de la source. Les messages non traduits sont omis, de sorte que Flutter se rabat sur le modèle.

Les `description` de message sont transmis au modèle comme contexte. Les placeholders `{name}` et les pluriels ICU sont protégés par la [vérification ICU](#icu). `verify` et `integrity` signalent également un `@@locale` incorrect et des métadonnées de placeholder qui diffèrent de la source. Toute synchronisation réécrivant le fichier répare les deux : `champollion sync --pair en:fr --force` sert chaque message inchangé directement depuis le cache.

## Clés à ne pas traduire {#no-translate}

Certaines valeurs n'ont qu'un seul rendu correct dans toutes les langues : une URL, un
chemin de dépôt, un nom de paquet, un identifiant de produit. Une traduction correcte de
`https://example.org/paper` est `https://example.org/paper`.

Le [contrôle qualité](/docs/concepts/quality-gate) de Champollion rejette
l'écho de la source — une traduction identique à sa source — car cela correspond
généralement à un refus de traduire de la part du modèle. Pour ces clés, la réponse correcte
devient alors celle qui est rejetée, et aucune sortie produite par le modèle ne peut
réussir la validation. Les modèles les moins performants apprennent à contourner ce contrôle
en modifiant tout juste la valeur (un `#fragment` inventé, une barre oblique finale superflue,
un espace sans chasse invisible), ce qui met en production des liens cassés. Les modèles
les plus performants renvoient la valeur inchangée et échouent au contrôle qualité, de sorte
que `sync` se termine avec un code d'erreur à chaque exécution.

Déclarez plutôt ces clés :

```json title="champollion.config.json"
{
  "noTranslate": ["**.url", "pages.software.*.repo", "meta.appId"]
}
```

Une clé correspondante est **copiée textuellement depuis la locale source** — elle n'est
jamais envoyée à un backend de traduction, jamais soumise au contrôle qualité, jamais
comptabilisée comme un échec et jamais facturée. Elle est exclue de l'estimation des coûts
préalable à l'exécution pour la même raison.

### Syntaxe des motifs

Les motifs sont des chemins avec notation par points sur l'espace de clés aplati, avec deux caractères génériques (wildcards) :

| Motif | Correspondances | Ne correspond pas |
|-------|-----------------|-------------------|
| `nav.brand` | `nav.brand` (chemin exact) | `nav.brandName` |
| `**.url` | `url`, `pages.a.b.url` (une feuille `url` à n'importe quelle profondeur) | `pages.urlLabel`, `pages.url.caption` |
| `pages.software.*.repo` | `pages.software.portal.repo` | `pages.software.a.b.repo` |
| `meta.og*` | `meta.ogImage`, `meta.ogTitle` | `meta.twitterImage`, `meta.og.image` |

`*` correspond à l'intérieur d'un seul segment ; `**` correspond à zéro ou plusieurs segments entiers.
Un motif sans caractère générique correspond à un chemin de clé exact.

### Les URL sont gérées par défaut

Puisqu'une clé contenant une URL ne dispose d'aucun résultat acceptable au regard du contrôle qualité,
`noTranslateUrls` vaut `true` par défaut : toute valeur source qui ne consiste en rien d'autre
qu'une URL absolue `scheme://` est traitée comme étant à ne pas traduire, sans configuration requise.

La détection est délibérément stricte — l'intégralité de la valeur nettoyée doit être l'URL.
Le texte qui contient simplement un lien (`"Read the paper at https://…"`) continue
d'être traduit normalement.

Désactivez cette option avec `"noTranslateUrls": false` si vos URL sont véritablement
spécifiques à chaque locale (des hôtes de documentation par langue, par exemple) — puis déclarez
celles qui ne le sont pas avec `noTranslate`.

### Réparation et application stricte

Pour une clé à ne pas traduire, il n'existe qu'une seule valeur cible correcte : toute
différence constitue donc une anomalie. Champollion applique cette règle dans les deux sens :

- **`sync` la répare.** Une clé à ne pas traduire dont la cible est manquante,
  préfixée par `[EN] ` ou altérée est réécrite à partir de la source. Cela ne consomme
  aucun appel API et est idempotent : dès que les valeurs correspondent, les synchronisations
  suivantes ignorent totalement la clé.
- **`verify` et `integrity` échouent en cas d'écart.** Une clé à ne pas traduire
  qui a divergé est signalée sous la forme `NO-TRANSLATE DRIFT` avec les valeurs attendue et réelle —
  les caractères invisibles étant échappés sous la forme `\uXXXX`, car cette catégorie
  d'altération est sinon impossible à déceler dans un diff. `champollion integrity` renvoie le code `1`,
  ce qui permet à un build qui y est relié de détecter une URL corrompue avant sa mise en production.

Si `integrity` échoue de cette manière sur un projet que vous venez de configurer, cela
signifie qu'il signale des altérations qui étaient déjà présentes dans vos fichiers de locale.
Exécutez `champollion sync` une fois pour les réparer.

## Conversion de système d'écriture {#script-conversion}

Certaines langues traduites par Champollion peuvent s'*écrire* de plusieurs manières. Le modèle travaille toujours dans le **système d'écriture de travail** de la langue (romanisation latine — SRO pour le cri des plaines, romanisation d'Okrand pour le klingon), puis un convertisseur déterministe peut réécrire la sortie dans un système d'écriture d'affichage. L'opportunité de cette conversion relève d'une décision définie dans la configuration — **jamais d'un comportement par défaut** :

| Locale | Système d'écriture de travail | Convertible en | Nature |
|--------|-------------------------------|----------------|--------|
| `crk` (cri des plaines) | `Latn` (SRO) | `Cans` (syllabaire) | Unicode standard — **choix obligatoire** |
| `sr` / `srp` (serbe) | `Latn` | `Cyrl` (cyrillique) | Unicode standard — **choix obligatoire** |
| `tlh` (klingon) | `Latn` (romanisation) | `Piqd` (pIqaD) | PUA — activation explicite |
| `x-elvish-s` (sindarin) | `Latn` | `Teng` (tengwar) | PUA — activation explicite |
| `x-kryptonian` | `Latn` | Kryptonien | PUA — activation explicite via `"script": "x-kryptonian"` |

**Les paires en Unicode standard (crk, sr) requièrent un choix.** Le syllabaire cri et l'alphabet cyrillique relèvent d'Unicode standard — ils s'affichent partout — et les deux orthographes sont réellement en usage. Champollion ne choisira pas le système d'écriture d'une communauté à la place d'un projet : `init` vous interroge lors de la sélection de la langue, et `sync` refuse de s'exécuter tant que la configuration n'a pas précisé lequel utiliser :

```json
{
  "languages": {
    "crk": { "script": "Cans" }
  }
}
```

**Les systèmes d'écriture PUA (tlh, x-elvish-s, x-kryptonian) utilisent par défaut la romanisation.** Le pIqaD, le tengwar et le kryptonien *ne font pas partie d'Unicode* — les convertisseurs émettent des points de code de la zone à usage privé (PUA) qui ne s'affichent pas à moins d'intégrer une police associée à ces points de code. La romanisation étant la seule sortie qui s'affiche partout, elle est retenue par défaut. Pour générer plutôt le système d'écriture d'affichage :

```json
{
  "languages": {
    "tlh": { "script": "Piqd" }
  }
}
```

…et exécutez `champollion fonts install` afin que votre site dispose d'une police capable de l'afficher. Si vos polices sont basées sur la translittération latine (ce qui est le cas de nombreuses polices d'idéolangues), conservez le choix par défaut.

`script` accepte un code ISO 15924, quelle que soit la casse (`"cans"`, `"Cans"` et `"CANS"` sont identiques). Il peut également être défini par paire, ce qui prévaut sur le niveau de la langue. Une valeur invalide, ou un système d'écriture que la locale ne peut pas produire, entraîne un échec dès le démarrage — avant tout appel API.

### Lettres non mappées et `scriptFallback` {#script-fallback}

Les convertisseurs traduisent ce que définit leur orthographe et rien d'autre. La romanisation du klingon ne possède ni `d`, `c`, `f`, `g`, `i`, `k`, `s`, `x` ni `z` — de sorte que la sortie d'un modèle contenant un nom propre tel que « GitHub » ne peut pas être intégralement convertie. Champollion **n'écrit jamais une valeur à moitié convertie** : si une seule lettre ne peut être mappée, l'intégralité de la valeur reste dans le système d'écriture de travail, et l'avertissement indique les lettres concernées ainsi que la ligne de configuration permettant de les mapper.

Ces correspondances vous appartiennent :

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

Chaque règle remplace une séquence du système d'écriture de travail par une séquence que le convertisseur *peut* mapper, avant que la conversion ne s'exécute. Les règles sont validées au démarrage — un remplacement lui-même non mappable est rejeté.

Champollion ne fournit **aucune règle de repli par défaut** : inventer des adaptations orthographiques, en particulier pour le système d'écriture d'une langue réelle, ne relève pas de la responsabilité d'un outil d'indexation. Les communautés et les cercles de passionnés disposent de conventions — adoptez-les délibérément, pour chaque projet.

### Réparation d'une conversion non souhaitée {#repair-script}

Avant la version 0.3.0, la conversion était inconditionnelle — les projets ciblant les locales PUA obtenaient une sortie non affichable, qu'ils le veuillent ou non. Deux outils viennent fermer la boucle :

- **`champollion repair-script`** analyse les locales dont la configuration indique que la conversion est *désactivée* pour y rechercher des points de code PUA et rétablit la romanisation à l'aide de la table inverse propre au convertisseur (`--dry` pour prévisualiser). Le pIqaD s'inverse exactement ; les inversions en tengwar et en kryptonien perdent les majuscules et le signalent.
- **`champollion integrity`** échoue (code de sortie 1) si des caractères PUA sont trouvés là où la conversion est désactivée — de sorte qu'une vérification de build intercepte tout texte non affichable avant sa mise en production, le rapport indiquant la réparation à appliquer.

La mémoire de traduction n'a jamais besoin d'être réparée : elle stocke les valeurs préalables à la conversion, si bien qu'activer ou désactiver `script:` ultérieurement ne nécessite aucune intervention sur le cache.

La conversion de système d'écriture s'applique aux chaînes d'interface utilisateur (fichiers clé-valeur et JSON Docusaurus). Les corps de texte Markdown ne sont jamais convertis — un convertisseur glouton de caractères ne dispose d'aucun moyen sûr de traverser les fragments de code, les URL et le frontmatter.

## Configuration par paire {#pair-configuration}

Chaque paire source→cible peut être configurée indépendamment :

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

### Champs de paire

| Champ | Type | Description |
|-------|------|-------------|
| `method` | `string` | Méthode de traduction : `llm`, `llm-coached`, `openai`, `anthropic`, `gemini`, `local`, `google-translate`, `deepl`, `microsoft-translator`, `libretranslate`, `apertium`, `tilde`, `translated`, `api` |
| `methodPlugin` | `string` | Nom d'un plugin installé (issu de `.champollion/methods/`) |
| `model` | `string` | Remplacer le modèle par défaut pour cette paire |
| `temperature` | `number` | Remplacer la température par défaut pour cette paire |
| `batchSize` | `number` | Remplacer la taille de lot par défaut pour cette paire |
| `register` | `string` | Remplacement du registre/ton (clé prédéfinie ou texte libre) |
| `endpoint` | `string` | URL du point de terminaison de l'API distante. Requis lorsque `method` vaut `api`. |
| `coachingFile` | `string` | Chemin vers un fichier d'invite de coaching pour cette paire, lu de manière relative au projet ; il remplace tout coaching moins spécifique, et un fichier illisible interrompt l'exécution |
| `promptContext` | `string` | Contexte applicatif pour cette paire |
| `genderGuidance` | `string` \| `false` | Consigne de genre pour les invites de cette paire : votre propre texte, ou `false` pour aucune. Voir [Consignes de genre](#gender-guidance). |
| `qualityTier` | `string` | Étiquette que vous attribuez à la sortie de la paire : `standard`, `high`, `research`, `verified`. N'est pas mesurée, et la synchronisation traduit de la même manière quelle que soit sa valeur ; `status` l'affiche (uniquement si elle est définie) et `serve` la publie |
| `fallback` | `object` | Seconde méthode pour ce que la méthode principale de cette paire ne peut traduire en toute sécurité. Voir [Méthode de repli](#fallback). `null` supprime un repli défini sur la langue. |

### Méthode de repli {#fallback}

Une paire peut désigner une seconde méthode. La méthode propre à la paire traduit en premier. Tout ce qu'elle ne peut pas traduire en toute sécurité est transmis une fois à la méthode de repli :

- **Fichiers clé-valeur :** les clés rejetées par le [contrôle qualité](/docs/concepts/quality-gate) (un `{name}` omis, un pluriel incorrect, un libellé de deux mots transformé en paragraphe) et les clés pour lesquelles la méthode n'a rien renvoyé.
- **Markdown (contenu Hugo et documentation Docusaurus) :** les champs de frontmatter qu'elle a omis ou vidés de leurs termes, ainsi que les blocs du corps de texte omis de sa réponse, endommagés (perte d'un élément protégé : code, balise HTML, shortcode) ou vidés. Avec la segmentation `page`, l'intégralité de la page.

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

Lorsqu'aucun texte ne doit quitter vos machines (un hôpital, un établissement scolaire, une communauté conservant ses données linguistiques sur place), configurez comme méthode de repli un modèle que vous exécutez vous-même. La méthode `local` s'adresse à un serveur compatible OpenAI sur cette machine (Ollama, llama.cpp, vLLM, LM Studio ; `LOCAL_API_BASE` définit l'adresse, voir [`local`](/docs/guides/translation-methods#local--your-own-model-ollama-vllm-lm-studio-a-trained-model)) :

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

Laquelle choisir :

- **Un modèle hébergé** (`llm-coached` avec un modèle Gemini, ou une autre méthode d'API) constitue généralement le second avis le plus performant pour une langue à faibles ressources, et fait l'objet d'une facturation à chaque requête. Utilisez-le lorsque le texte peut être transmis à ce fournisseur.
- **`local`** conserve chaque clé sur cette machine, et l'estimation le comptabilise comme `$0 API cost (runs on this machine)`. Utilisez-le lorsque rien ne doit quitter la machine, même si le modèle que vous pouvez y exécuter est plus modeste.

La sortie du repli est soumise au même contrôle qualité. Ce qu'il traduit est mis en cache sous sa propre méthode dans la mémoire de traduction, ce qui permet au cache de consigner quelle méthode a produit chaque valeur. Les synchronisations ultérieures la réutilisent au lieu de solliciter à nouveau la première méthode ; `--fresh` ou `--retranslate` formule une nouvelle requête. Ce qu'aucune des deux méthodes ne parvient à traduire reste dans le même état qu'en l'absence de repli. Une clé est laissée non traduite et conserve son ancienne entrée de verrouillage, de sorte que la synchronisation suivante la réessaie et que `champollion verify` la liste. Un bloc Markdown est écrit sous la forme de la source préfixée par `[EN] `, non mis en cache, et le fichier est retraité lors de la synchronisation suivante. Un bloc ou un champ de frontmatter rejeté par le contrôle qualité pour les deux méthodes est retenu, et n'est plus renvoyé à celles-ci tant que `--redo files:<page>` ne mentionne pas la page ([Blocs Markdown et champs de frontmatter refusés](/docs/concepts/quality-gate#refused-markdown-blocks-and-front-matter-fields)). Un champ de frontmatter vidé par les deux méthodes, ou une page qu'aucune ne traduit, met le fichier en échec, comme en l'absence de repli.

Un repli accepte les mêmes champs qu'une paire : `method` (requis), `model`, `provider`, `endpoint`, `methodPlugin`, `coachingFile`, `coachingPrompt`, `promptContext`, `register`, `temperature`, `batchSize`, `maxRetries`, `qualityTier`, `contentSegmentation`, `name`. Il se résout de la même manière qu'une paire. Les champs qu'il ne définit pas (registre, coaching, contexte d'invite, …) proviennent de sa paire. Son propre `coachingFile` parvient à son invite et à sa clé de cache, et `champollion status` l'affiche. Le système d'écriture appartenant à la paire, `script` et `scriptFallback` sont refusés sur un repli, tout comme un `fallback` propre au repli. Une méthode inconnue, ou un repli identique à sa paire, interrompt la synchronisation avec une erreur désignant la paire. Le repli doit être prêt à s'exécuter avant le début de la synchronisation, tout comme la méthode principale de la paire (par exemple, sa clé API doit être configurée).

- **`--method` et `--model` ne modifient que la méthode principale de la paire.** Le repli conserve ce que prescrit le fichier de configuration.
- **Coût.** L'estimation préalable à l'exécution ne couvre que la méthode principale de la paire : nul ne peut savoir à l'avance ce qui échouera. Chaque lot de repli est évalué juste avant son exécution, à l'aide du même estimateur. Avec `--max-cost`, un lot qui ferait dépasser au cycle le plafond défini (l'estimation initiale majorée de chaque lot de repli exécuté jusqu'alors) est ignoré, avec un avertissement indiquant les clés en cause. Il en va de même pour un repli dont le coût ne peut être estimé (un coût inconnu n'est pas un coût nul). Ces clés restent en échec, et la synchronisation se termine par un code d'erreur non nul, comme pour tout échec partiel.
- **Comptes rendus.** `sync` affiche une ligne par paire, p. ex. `[FALLBACK] en:crk — 6 key(s) the primary (api) could not translate safely → translated by llm-coached (4 accepted, 2 still failing)`. Le récapitulatif `--json` précise par paire ce que le repli a réalisé (`method`, `attempted`, `accepted`, `failed`, `cached`) : dans chaque entrée de `locales` pour les fichiers clé-valeur, dans `fallback` pour le JSON Docusaurus, et dans `content.fallback` pour le Markdown. `champollion status` présente le repli sous sa paire. `--dry` ne pouvant pas anticiper les échecs, il n'indique rien sur le repli.
- **Lorsque le repli a rédigé la majeure partie du contenu.** Lorsque plus de la moitié des nouvelles traductions d'une exécution pour une paire (les réponses acceptées de la méthode de la paire plus celles du repli) proviennent du repli, `sync` ajoute un avertissement : proportion exacte, méthode et modèle employés, motifs de non-utilisation des réponses de la méthode de la paire (chaque raison étant comptabilisée : répétition d'une phrase mémorisée pour différentes chaînes sources, inflation de longueur, …), et pistes à envisager — la méthode de la paire n'est peut-être pas adaptée à ces chaînes ; vérifier le contenu produit (`verify` valide la structure, un locuteur en valide le sens) ; adopter un repli plus robuste. Les entrées `--json` comportent `primaryAccepted` et `primaryReasons` aux côtés de `accepted`. `champollion status` indique la même proportion pour les fichiers (« from the fallback: 8 value(s) in the files (…) — 8 of the 8 sync wrote (100%) »), et signale lorsqu'il s'agit de la majorité du texte de la locale.
- `champollion serve` a également recours au repli, dans la limite de ses plafonds `--max-cost-per-request` / `--max-session-cost`.

## Configuration par langue {#language-configuration}

Les langues acceptent trois formats :

### Tableau de codes (le plus simple)

```json
{
  "languages": ["fr", "de", "ja"]
}
```

Chaque langue obtient son registre par défaut à partir du tableau de registres intégré. Les langues sans défaut obtiennent `"Professional register."`.

### Objet avec chaînes de registre

La valeur peut être une **clé prédéfinie** de la carte de la langue, ou du texte de registre personnalisé :

```json
{
  "languages": {
    "fr": "casual-tu",
    "ko": "formal-hapsyo",
    "ja": "Custom: Polite Japanese for a gaming app."
  }
}
```

Champollion vérifie si la chaîne correspond à une clé prédéfinie dans la carte de la langue. Si c'est le cas, l'invite de registre complète de la carte est utilisée. Sinon, la chaîne est utilisée telle quelle. Voir [Langues prises en charge](/docs/reference/supported-languages#language-cards) pour les prédéfinitions disponibles.

### Objet avec configuration complète

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

Vous pouvez mélanger les objets abrégés et complets dans le même bloc.


### Champs de langue

| Champ | Type | Description |
|-------|------|-------------|
| `register` | `string` | Instructions de style/ton. Peut être une **clé prédéfinie** (p. ex. `casual-tu`, `formal-hapsyo`) ou du texte personnalisé. Voir [Fiches linguistiques](/docs/reference/supported-languages#language-cards). |
| `name` | `string` | Nom de la langue lisible par l'humain (pour l'affichage de l'état) |
| `model` | `string` | Remplacer le modèle par défaut |
| `temperature` | `number` | Remplacer la température par défaut |
| `batchSize` | `number` | Remplacer la taille de lot par défaut |
| `coachingFile` | `string` | Chemin vers un fichier d'invite de coaching pour cette langue, lu de manière relative au projet ; il remplace le coaching de premier niveau, et un fichier illisible interrompt l'exécution |
| `promptContext` | `string` | Contexte applicatif pour cette langue |
| `genderGuidance` | `string` \| `false` | Consigne de genre pour les invites de cette langue : votre propre texte, ou `false` pour aucune. Voir [Consignes de genre](#gender-guidance). |
| `maxRetries` | `number` | Budget maximal de nouvelles tentatives pour les lots ayant échoué (par défaut : 3) |
| `script` | `string` | Code ISO 15924 de l'orthographe rédigée par Champollion (p. ex. `"Cans"`, `"Piqd"`). Voir [Conversion de système d'écriture](#script-conversion). |
| `scriptFallback` | `object` | Règles de translittération pour les lettres que le convertisseur ne peut pas mapper. Voir [Conversion de système d'écriture](#script-conversion). |
| `endpoint` | `string` | URL du point de terminaison de l'API distante, pour `"method": "api"` |
| `fallback` | `object` | Seconde méthode pour ce que la méthode de cette langue ne peut traduire en toute sécurité. Voir [Méthode de repli](#fallback). |

:::info[Chaîne d'héritage]
Les paramètres se résolvent dans cet ordre (le premier gagne) :

**niveau de paire** → **niveau de langue** → **configuration globale** → **valeurs par défaut**

Par exemple, si `pairs["en:fr"]` définit `model`, cela remplace à la fois les valeurs `model` au niveau de la langue et au niveau global.
:::

### Consignes de genre {#gender-guidance}

Les invites LLM comportent une consigne relative au genre grammatical pour les langues qui
le possèdent. Elle est issue du catalogue de Champollion : le français demande l'*écriture
inclusive* avec le point médian lorsque le genre d'un lecteur est inconnu
(`Connecté·e`, et non `Connecté(e)` ou `Connectée` ; `Utilisateur·rice·s` au
pluriel), l'allemand demande la forme avec deux-points (`Benutzer:innen`), le japonais le
neutre `私`. `champollion init` l'affiche aux côtés du registre de chaque langue, et
`champollion status` la présente par paire, avec sa provenance.

Choisissez un autre style avec `genderGuidance`, pour l'ensemble des langues ou pour une seule :

```json
{
  "languages": {
    "fr": { "register": "formal-vous", "genderGuidance": "Use the masculine generic (Connecté), as the Académie française recommends." },
    "de": { "register": "formal-Sie", "genderGuidance": false }
  }
}
```

`false` n'envoie aucune instruction de genre ; une chaîne remplace celle du catalogue. Ce
paramètre s'applique aux méthodes qui prennent en charge des instructions (les méthodes LLM) ; les moteurs
de traduction automatique (DeepL, Google, …) n'en sont pas informés. Une consigne de genre
modifiée constituant une invite différente, elle dispose de ses propres entrées de cache : ce qui
est déjà traduit demeure en l'état jusqu'à ce que vous le retraduisez (`champollion sync
--redo all`, ce que la synchronisation suggère lorsque les fichiers contiennent le style précédent).

## Source non-anglaise

Si votre langue source n'est pas l'anglais :

```bash
# CLI flag (one-time)
npx champollion sync --source fr
```

```json title="champollion.config.json (permanent)"
{
  "inputLocale": "fr"
}
```

## Fichier de verrouillage

Champollion génère `.champollion.lock` pour assurer le suivi des empreintes SHA-256 des valeurs sources traduites. **Versionnez ce fichier dans votre gestionnaire de sources (commit)** afin que tous les développeurs partagent la même référence de traduction. Dans un projet disposant d'un dossier par langue, les clés sont consignées sous la forme `<namespace>::<key>`.

Par locale cible, le fichier de verrouillage enregistre également une empreinte de chaque valeur écrite par la synchronisation ainsi que du texte source traduit (afin de reconnaître une valeur modifiée manuellement par une personne et de signaler une traduction obsolète), les clés qu'une réexécution n'a pas pu achever (**pending**), et les clés rejetées par le contrôle qualité (**held back** vis-à-vis du même modèle). Dès lors qu'il y a l'un de ces éléments à enregistrer, le fichier adopte son format de version 2, `{"version": 2, "source": {…}, "locales": {…}}` ; un verrouillage de version 1 (un tableau plat clé → empreinte) est lu comme auparavant. Une modification manuelle remplacée est conservée dans `.champollion-replaced-edits.jsonl` à côté de lui — versionnez les deux. Voir [Contrôle qualité](/docs/concepts/quality-gate#refused-keys-are-held-back) et [Édition des traductions](/docs/guides/professional-translators#editing-key-value-files).

Lorsqu'une valeur source change, le hachage ne correspond plus, et champollion retraduit cette clé lors de la prochaine synchronisation.

## `.champollionignore`

Créez `.champollionignore` à la racine de votre projet pour exclure les fichiers de l'analyse `lint`. Utilise des motifs glob, comme `.gitignore` :

```text title=".champollionignore"
src/components/legacy/**
src/utils/constants.js
**/*.test.js
```

## Répertoire `.champollion/`

Champollion crée un répertoire `.champollion/` à la racine de votre projet pour son état interne. Excluez-le de votre système de gestion de versions — il s'agit d'un cache propre à chaque machine, et non de sources du projet. `champollion init` ajoute cette ligne à `.gitignore`, en créant le fichier s'il n'existe pas encore (y compris dans un dossier qui n'est pas encore un dépôt git, afin qu'un futur `git init` et `git add --all` ne committe pas le cache par inadvertance) :

```gitignore
.champollion/
```

Versionnez les fichiers de verrouillage situés à côté (`.champollion.lock`, `.champollion-content.lock`) : ils consignent le texte source à partir duquel chaque traduction a été réalisée.

| Fichier | Rôle | À committer ? |
|---------|------|---------------|
| `tm.json` | Cache de la mémoire de traduction — stocke les traductions antérieures indexées par texte source + locale + méthode | Non (cache local) |
| `xliff/*.xliff` | Fichiers d'export XLIFF pour la révision par des traducteurs professionnels | Non (éphémère) |
| `methods/` | Manifestes des plugins de méthode installés | Ignoré par la ligne `.champollion/`. Pour partager les plugins installés, remplacez cette ligne par `.champollion/*` et `!.champollion/methods/` |
| `backups/` | Sauvegardes avant habillage/reformatage (créées par `wrap --undo`) | Non (filet de sécurité) |

Voir [Mémoire de traduction](/docs/concepts/translation-memory) pour les détails sur `tm.json` et comment elle économise les coûts d'API.

---

## API programmatique

Pour les scripts de construction et les intégrations personnalisées, importez directement à partir du package :

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

### Exportations disponibles

| Export | Ce qu'il fait |
|--------|---------------|
| `TranslationMethod` | Classe de base pour toutes les méthodes |
| `LLMMethod` | Classe de base pour les méthodes LLM (OpenRouter) |
| `DirectLLMMethod` | Classe de base pour les fournisseurs LLM directs (OpenAI, Anthropic, Gemini) |
| `OpenAIMethod`, `AnthropicMethod`, `GeminiMethod` | Classes des fournisseurs LLM directs |
| `DeepLMethod`, `MicrosoftTranslatorMethod`, `LibreTranslateMethod`, `TildeMethod`, `TranslatedMethod` | Classes de TA traditionnelle |
| `GoogleTranslateMethod` | Google Cloud Translation |
| `LLMCoachedMethod` | LLM avec accompagnement (OpenRouter + données de coaching) |
| `APIMethod` | Client d'API distante |
| `runSync`, `runContentSync` | Pipeline complet de synchronisation |
| `translateWithFallback`, `translateAndValidate` | Pipeline d'une paire pour un lot de clés, tel qu'exécuté par `sync` : cache, méthode, contrôle qualité, cache, puis repli de la paire. Transmettez une paire issue de `resolvePairs`, `tm` issu de `loadTM`, et `cwd`, le répertoire du projet : la méthode y lit sa clé, son point de terminaison, son coaching et son glossaire, et non depuis `process.cwd()` |
| `createFallbackBudget` | Garde `--max-cost` pour les lots de repli (`{ maxCost, committed, cwd }`) |
| `discoverLocaleLayout`, `resolveLocaleFiles` | Fichiers constituant chaque locale (structure plate, dossier par locale ou `localesPattern`) |
| `resolveConfig`, `resolvePairs` | Résolution de la configuration |
| `validateTranslations` | Contrôle qualité (quality gate) |
| `loadCoachingData`, `findDictionaryMatches` | Utilitaires de coaching |

### Extension de fournisseur personnalisé

Étendez `DirectLLMMethod` pour ajouter un nouveau fournisseur LLM en ~40 lignes :

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

Vous obtenez gratuitement la traduction, le coaching, les boucles de tentatives, la validation de modèle, les niveaux de qualité et l'aide à la configuration. Seule la forme de la requête HTTP est spécifique au fournisseur. Pour les adaptateurs non-LLM qui utilisent `fetch()` brut, utilisez l'assistant partagé `fetchWithRetry()` de `lib/methods/fetch-with-retry.js` au lieu d'écrire votre propre boucle de tentatives.

---

## Voir aussi

- [Référence CLI](/docs/reference/cli) — toutes les commandes et tous les drapeaux
- [Méthodes de traduction](/docs/guides/translation-methods) — choisir et mélanger les méthodes
- [Mémoire de traduction](/docs/concepts/translation-memory) — mise en cache et économies de coûts
- [Travailler avec des traducteurs professionnels](/docs/guides/professional-translators) — flux de travail XLIFF
- [Spécification de plugin](/docs/reference/plugin-spec) — format de manifeste de plugin de méthode
- [Architecture](/docs/concepts/architecture) — comment les pièces se connectent
- [Langues prises en charge](/docs/reference/supported-languages) — support de langue intégré
- [Comment fonctionne la synchronisation](/docs/concepts/how-sync-works) — le pipeline de traduction
