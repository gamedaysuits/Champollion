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
  "contentDir": null,
  "translatableFields": null,
  "format": "auto",
  "model": "google/gemini-3.5-flash",
  "temperature": 0.3,
  "defaultMethod": "llm",
  "batchSize": 80,
  "coachingFile": null,
  "promptContext": null,
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

| Champ | Type | Défaut | Description |
|-------|------|---------|-------------|
| `version` | `number` | `3` | Version du schéma de configuration. Toujours `3`. |
| `inputLocale` | `string` | `"en"` | Code de la langue source (BCP 47). |
| `localesDir` | `string` | `"./locales"` | Chemin vers les fichiers de paramètres régionaux (locales). Champollion analyse ce répertoire. |
| `contentDir` | `string` | `null` | Répertoire de contenu Hugo. Active la traduction du corps des fichiers Markdown. |
| `translatableFields` | `string[]` | `null` | Remplace les champs frontmatter traduisibles par défaut pour la traduction de contenu. `null` utilise les valeurs par défaut intégrées (`title`, `description`, `summary`). |
| `format` | `string` | `"auto"` | Format de fichier : `json`, `toml`, `yaml` ou `auto` (détecté à partir de l'extension). |
| `model` | `string` | `"google/gemini-3.5-flash"` | Modèle par défaut pour les méthodes LLM. Accepte les identifiants OpenRouter complets (`provider/model`) ou les alias courts de `shared/model-aliases.json` (par ex., `gemini-flash`). Les fournisseurs directs utilisent des noms simples (par ex., `gpt-4o`). |
| `temperature` | `number` | `0.3` | Température du LLM (0.0–2.0). Plus basse = plus déterministe. |
| `defaultMethod` | `string` | `"llm"` | Méthode de traduction par défaut : `llm`, `llm-coached`, `google-translate`, `deepl`, `microsoft-translator`, `libretranslate`, `openai`, `anthropic`, `gemini`, `api`. Remplacée par l'indicateur CLI `--method`. |
| `batchSize` | `number` | `80` | Clés par lot de traduction. Plus élevé = moins d'appels API, mais des invites plus volumineuses. |
| `coachingFile` | `string` | `null` | Chemin vers un fichier d'invite d'encadrement en texte libre (relatif à la racine du projet). Le contenu est lu au démarrage et injecté dans l'invite système sous forme de bloc `Coaching guidance:`. |
| `promptContext` | `string` | `null` | Chaîne de contexte de l'application injectée dans l'invite système (par ex., "Descriptions de produits e-commerce"). Aide le modèle à adapter les traductions à votre domaine. |
| `jsonConcurrency` | `number` | `200` | Nombre maximum de traductions parallèles de paramètres régionaux pour la synchronisation des clés JSON. Remplacé par l'indicateur CLI `--json-concurrency`. |
| `contentConcurrency` | `number` | `48` | Nombre maximum d'appels API parallèles pour la traduction de contenu (Markdown/MDX). Remplacé par l'indicateur CLI `--content-concurrency`. |
| `fallbackPrefix` | `string` | `"[EN] "` | Préfixe de marqueur utilisé par `audit` et `verify` pour détecter les anciennes valeurs non traduites des exécutions précédentes. Champollion n'écrit pas ce préfixe — il le lit uniquement pour la détection. |
| `apiKeyEnvVar` | `string` | `"OPENROUTER_API_KEY"` | Nom de la variable d'environnement pour la clé API. À remplacer pour les noms de variables d'environnement personnalisés. |
| `minContentRetention` | `number` | `0.35` | Fraction de lettres/chiffres de la source qu'une sortie doit conserver avant que la [vérification de suppression de contenu](/docs/concepts/quality-gate) ne consulte son second signal. Également configurable par paire et par langue. |
| `noTranslate` | `string[]` | `[]` | Clés en chemin pointé (dot-path) et motifs glob dont la valeur est copiée textuellement dans chaque paramètre régional. Voir [Clés sans traduction](#no-translate). Également accepté en tant que `skipKeys`. |
| `noTranslateUrls` | `boolean` | `true` | Traite les valeurs sources qui ne sont rien d'autre qu'une URL `scheme://` comme étant sans traduction. Définissez sur `false` pour envoyer les clés contenant des URL au moteur de traduction. |
| `baseUrl` | `string` | `""` | URL de base pour la génération d'artefacts SEO (hreflang, sitemaps, JSON-LD). |
| `pairs` | `object` | `{}` | Remplacements de méthode, de modèle et de qualité par paire. Voir [Configuration des paires](#pair-configuration). |
| `languages` | `object` | `{}` | Remplacements par langue. Voir [Configuration des langues](#language-configuration). |
| `lint.srcDir` | `string` | `null` | Répertoire source pour l'analyse lint. `null` = détection automatique à partir du framework. |
| `lint.ignore` | `string[]` | `["node_modules", ...]` | Motifs glob à exclure du lint. |
| `lint.minLength` | `number` | `2` | Longueur minimale de chaîne pour être signalée comme codée en dur. |
| `seo.urlPattern` | `string` | `"/:locale/:path"` | Modèle de motif d'URL pour la génération de balises hreflang. |
| `seo.pages` | `string[]` | `null` | Liste explicite de pages pour le SEO. `null` = détection automatique à partir des clés de paramètres régionaux. |
| `typegen.output` | `string` | `null` | Chemin de sortie pour les types TypeScript générés. `null` = désactivé. |
| `typegen.autoGenerate` | `boolean` | `false` | Régénération automatique des types après chaque synchronisation. |

## Clés sans traduction {#no-translate}

Certaines valeurs ont exactement un seul rendu correct dans toutes les langues : une URL, un chemin de dépôt, un nom de paquet, un identifiant de produit. Une traduction correcte de `https://example.org/paper` est `https://example.org/paper`.

La [barrière de qualité](/docs/concepts/quality-gate) de Champollion rejette l'écho de la source — une traduction identique à sa source — car il s'agit normalement d'un modèle refusant de faire le travail. Pour ces clés, cela fait de la réponse correcte celle qui est rejetée, et il n'y a aucune sortie que le modèle puisse produire qui soit acceptée. Les modèles plus faibles apprennent à contourner la barrière en modifiant la valeur juste assez (un `#fragment` fabriqué, une barre oblique finale superflue, un espace invisible de largeur nulle), ce qui déploie des liens brisés. Les modèles plus forts renvoient la valeur inchangée et échouent à la barrière, de sorte que `sync` se termine avec un code non nul à chaque exécution.

Déclarez plutôt ces clés :

```json title="champollion.config.json"
{
  "noTranslate": ["**.url", "pages.software.*.repo", "meta.appId"]
}
```

Une clé correspondante est **copiée textuellement depuis le paramètre régional source** — jamais envoyée à un moteur de traduction, jamais soumise à la barrière de qualité, jamais comptée comme un échec, et jamais facturée. Elle est exclue de l'estimation des coûts préalable à l'exécution pour la même raison.

### Syntaxe des motifs

Les motifs sont des chemins pointés (dot-paths) sur l'espace de clés aplati, avec deux caractères génériques :

| Motif | Correspond à | Ne correspond pas à |
|---------|---------|----------------|
| `nav.brand` | `nav.brand` (chemin exact) | `nav.brandName` |
| `**.url` | `url`, `pages.a.b.url` (une feuille `url` à n'importe quelle profondeur) | `pages.urlLabel`, `pages.url.caption` |
| `pages.software.*.repo` | `pages.software.portal.repo` | `pages.software.a.b.repo` |
| `meta.og*` | `meta.ogImage`, `meta.ogTitle` | `meta.twitterImage`, `meta.og.image` |

`*` correspond à l'intérieur d'un seul segment ; `**` correspond à zéro ou plusieurs segments entiers. Un motif sans caractère générique est un chemin de clé exact.

### Les URL sont gérées par défaut

Puisqu'une clé dont la valeur est une URL n'a aucun résultat correct sous la barrière de qualité, `noTranslateUrls` est défini sur `true` par défaut : toute valeur source qui n'est rien d'autre qu'une URL `scheme://` absolue est traitée comme étant sans traduction, sans configuration supplémentaire.

La détection est délibérément stricte — la valeur entière, une fois les espaces supprimés, doit être l'URL. Un texte qui contient simplement un lien (`"Read the paper at https://…"`) est toujours traduit normalement.

Désactivez-la avec `"noTranslateUrls": false` si vos URL sont réellement spécifiques aux paramètres régionaux (des hôtes de documentation par langue, par exemple) — puis déclarez celles qui ne le sont pas avec `noTranslate`.

### Réparation et application

Pour une clé sans traduction, il n'y a exactement qu'une seule valeur cible correcte, donc toute différence est un défaut. Champollion applique cela dans les deux sens :

- **`sync` la répare.** Une clé sans traduction dont la cible est manquante, préfixée par `[EN] `, ou altérée est réécrite à partir de la source. Cela ne coûte aucun appel API, et c'est idempotent : une fois que les valeurs correspondent, les synchronisations ultérieures ignorent entièrement la clé.
- **`verify` et `integrity` échouent sur celle-ci.** Une clé sans traduction ayant dérivé est signalée comme `NO-TRANSLATE DRIFT` avec les valeurs attendue et réelle — les caractères invisibles étant échappés sous la forme `\uXXXX`, car cette catégorie de corruption est autrement impossible à voir dans un diff. `champollion integrity` se termine avec le code `1`, de sorte qu'une compilation qui y est liée détecte une URL corrompue avant son déploiement.

Si `integrity` échoue de cette manière sur un projet que vous venez de configurer, il signale des dommages qui étaient déjà présents dans vos fichiers de paramètres régionaux. Exécutez `champollion sync` une fois pour les réparer.

## Conversion de script {#script-conversion}

Certaines langues traduites par Champollion peuvent être *écrites* de plusieurs manières. Le modèle fonctionne toujours dans le **script de travail** de la langue (romanisation latine — SRO pour le Plains Cree, romanisation d'Okrand pour le Klingon), et un convertisseur déterministe peut ensuite réécrire la sortie dans un script d'affichage. Savoir s'il doit le faire est une décision prise par la configuration — **jamais par défaut** :

| Paramètre régional | Script de travail | Convertible en | Type |
|--------|---------------|----------------|------|
| `crk` (Plains Cree) | `Latn` (SRO) | `Cans` (Syllabique) | Unicode réel — **choix requis** |
| `sr` / `srp` (Serbe) | `Latn` | `Cyrl` (Cyrillique) | Unicode réel — **choix requis** |
| `tlh` (Klingon) | `Latn` (romanisation) | `Piqd` (pIqaD) | PUA — sur adhésion (opt-in) |
| `x-elvish-s` (Sindarin) | `Latn` | `Teng` (Tengwar) | PUA — sur adhésion (opt-in) |
| `x-kryptonian` | `Latn` | Kryptonian | PUA — sur adhésion (opt-in) via `"script": "x-kryptonian"` |

**Les paires en Unicode réel (crk, sr) nécessitent de faire un choix.** Le syllabaire cri et le cyrillique sont de l'Unicode ordinaire — ils s'affichent partout — et les deux orthographes sont réellement utilisées. Champollion ne choisira pas le système d'écriture d'une communauté au nom d'un projet : `init` le demande lorsque vous sélectionnez la langue, et `sync` refuse de s'exécuter tant que la configuration ne précise pas lequel :

```json
{
  "languages": {
    "crk": { "script": "Cans" }
  }
}
```

**Les scripts PUA (tlh, x-elvish-s, x-kryptonian) utilisent la romanisation par défaut.** Le pIqaD, le Tengwar et le Kryptonian ne sont *pas dans Unicode* — les convertisseurs émettent des points de code de la zone à usage privé (Private Use Area) qui ne s'affichent pas à moins que vous ne fournissiez une police mappée sur ces points de code. La romanisation est la seule sortie qui s'affiche partout, c'est donc la valeur par défaut. Pour émettre le script d'affichage à la place :

```json
{
  "languages": {
    "tlh": { "script": "Piqd" }
  }
}
```

…et exécutez `champollion fonts install` pour que votre site dispose d'une police capable de le tracer. Si vos polices sont basées sur la translittération latine (comme c'est le cas pour de nombreuses polices de langues construites), conservez la valeur par défaut.

`script` prend un code ISO 15924, quelle que soit la casse (`"cans"`, `"Cans"` et `"CANS"` sont identiques). Il peut également être défini par paire, ce qui prime sur le niveau de la langue. Une valeur invalide, ou un script que le paramètre régional ne peut pas produire, provoque un échec au démarrage — avant tout appel API.

### Lettres non mappées et `scriptFallback` {#script-fallback}

Les convertisseurs traduisent ce que leur orthographe définit et rien d'autre. La romanisation du Klingon n'a pas de `d`, `c`, `f`, `g`, `i`, `k`, `s`, `x` ou `z` — par conséquent, la sortie du modèle contenant un nom propre comme "GitHub" ne peut pas être entièrement convertie. Champollion **n'écrit jamais une valeur à moitié convertie** : si une lettre ne peut pas être mappée, la valeur entière reste dans le script de travail, et l'avertissement nomme les lettres ainsi que la ligne de configuration qui permettrait de les mapper.

Il vous appartient de déclarer ces mappages :

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

Chaque règle remplace une séquence du script de travail par une séquence que le convertisseur *peut* mapper, avant l'exécution de la conversion. Les règles sont validées au démarrage — un remplacement qui est lui-même impossible à mapper est rejeté.

Champollion ne fournit **aucune règle de repli par défaut** : inventer des adaptations orthographiques, en particulier pour le système d'écriture d'une langue réelle, n'est pas du ressort d'un index. Les communautés et les fandoms ont des conventions — adoptez-les délibérément, par projet.

### Réparation d'une conversion non désirée {#repair-script}

Avant la version 0.3.0, la conversion était inconditionnelle — les projets ciblant les paramètres régionaux PUA obtenaient une sortie impossible à afficher, qu'ils le veuillent ou non. Deux outils bouclent la boucle :

- **`champollion repair-script`** analyse les paramètres régionaux dont la configuration indique que la conversion est *désactivée* pour les points de code PUA et restaure la romanisation en utilisant la propre table inversée du convertisseur (`--dry` pour prévisualiser). Le pIqaD s'inverse exactement ; les inversions du Tengwar et du Kryptonian perdent la majuscule et le signalent.
- **`champollion integrity`** échoue (code de sortie 1) si des PUA sont trouvés là où la conversion est désactivée — ainsi, une barrière de compilation détecte le texte impossible à afficher avant son déploiement, et le rapport nomme la réparation.

La mémoire de traduction n'a jamais besoin d'être réparée : elle stocke les valeurs d'avant la conversion, de sorte que l'activation ou la désactivation ultérieure de `script:` ne nécessite aucun travail sur le cache.

La conversion de script s'applique aux chaînes de l'interface utilisateur (fichiers clé-valeur et JSON Docusaurus). Les corps des fichiers Markdown ne sont jamais convertis — un convertisseur de caractères avide n'a aucun moyen sûr de traverser les blocs de code, les URL et le frontmatter.

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
      "model": "google/gemini-2.5-pro"
    },
    "en:crk": {
      "methodPlugin": "crk-coached-v1"
    }
  }
}
```

### Champs de paire

| Champ | Type | Description |
|-------|------|-------------|
| `method` | `string` | Méthode de traduction : `llm`, `llm-coached`, `google-translate`, `deepl`, `microsoft-translator`, `libretranslate`, `openai`, `anthropic`, `gemini`, `api` |
| `methodPlugin` | `string` | Nom d'un plugin installé (de `.champollion/methods/`) |
| `model` | `string` | Remplace le modèle par défaut pour cette paire |
| `temperature` | `number` | Remplace la température par défaut pour cette paire |
| `batchSize` | `number` | Remplace la taille de lot par défaut pour cette paire |
| `register` | `string` | Remplacement de registre/ton (clé prédéfinie ou texte libre) |
| `endpoint` | `string` | URL du point de terminaison API distant. Requis lorsque `method` est `api`. |
| `coachingFile` | `string` | Chemin d'accès à un fichier d'invite de coaching pour cette paire |
| `promptContext` | `string` | Contexte d'application pour cette paire |
| `qualityTier` | `string` | Niveau d'affichage : `standard`, `high`, `research`, `verified` |

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
      "model": "google/gemini-2.5-pro",
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
| `register` | `string` | Instructions de style/ton. Peut être une **clé prédéfinie** (par ex., `casual-tu`, `formal-hapsyo`) ou un texte personnalisé. Voir [Fiches de langue](/docs/reference/supported-languages#language-cards). |
| `name` | `string` | Nom de la langue lisible par l'homme (pour l'affichage du statut) |
| `model` | `string` | Remplace le modèle par défaut |
| `temperature` | `number` | Remplace la température par défaut |
| `batchSize` | `number` | Remplace la taille de lot par défaut |
| `coachingFile` | `string` | Chemin vers un fichier d'invite d'encadrement pour cette langue |
| `promptContext` | `string` | Contexte de l'application pour cette langue |
| `maxRetries` | `number` | Budget maximum de tentatives pour les lots ayant échoué (par défaut : 3) |
| `script` | `string` | Code ISO 15924 de l'orthographe écrite par Champollion (par ex. `"Cans"`, `"Piqd"`). Voir [Conversion de script](#script-conversion). |
| `scriptFallback` | `object` | Règles de translittération pour les lettres que le convertisseur de script ne peut pas mapper. Voir [Conversion de script](#script-conversion). |

:::info[Chaîne d'héritage]
Les paramètres se résolvent dans cet ordre (le premier gagne) :

**niveau de paire** → **niveau de langue** → **configuration globale** → **valeurs par défaut**

Par exemple, si `pairs["en:fr"]` définit `model`, cela remplace à la fois les valeurs `model` au niveau de la langue et au niveau global.
:::

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

Champollion crée `.champollion.lock` pour suivre les hachages SHA-256 des valeurs source traduites. **Validez ce fichier** afin que tous les développeurs partagent la même base de traduction.

Lorsqu'une valeur source change, le hachage ne correspond plus, et champollion retraduit cette clé lors de la prochaine synchronisation.

## `.champollionignore`

Créez `.champollionignore` à la racine de votre projet pour exclure les fichiers de l'analyse `lint`. Utilise des motifs glob, comme `.gitignore` :

```text title=".champollionignore"
src/components/legacy/**
src/utils/constants.js
**/*.test.js
```

## Répertoire `.champollion/`

Champollion crée un répertoire `.champollion/` à la racine de votre projet pour l'état interne. Vous devriez généralement **ajouter ceci à `.gitignore`** — c'est une optimisation locale, pas une source de projet :

```gitignore
.champollion/
```

| Fichier | Objectif | Valider ? |
|--------|---------|----------|
| `tm.json` | Cache de mémoire de traduction — stocke les traductions précédentes indexées par texte source + locale + méthode | Non (cache local) |
| `xliff/*.xliff` | Fichiers d'export XLIFF pour examen par traducteur professionnel | Non (transitoire) |
| `methods/` | Manifestes de plugin de méthode installée | Oui (configuration partagée) |
| `backups/` | Sauvegardes pré-enveloppe (créées par `wrap --undo`) | Non (filet de sécurité) |

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
|--------|-------------|
| `TranslationMethod` | Classe de base pour toutes les méthodes |
| `LLMMethod` | Classe de base pour les méthodes LLM (OpenRouter) |
| `DirectLLMMethod` | Classe de base pour les fournisseurs LLM directs (OpenAI, Anthropic, Gemini) |
| `OpenAIMethod`, `AnthropicMethod`, `GeminiMethod` | Classes de fournisseur LLM direct |
| `DeepLMethod`, `MicrosoftTranslatorMethod`, `LibreTranslateMethod`, `TildeMethod`, `TranslatedMethod` | Classes de traduction automatique traditionnelle |
| `GoogleTranslateMethod` | Google Cloud Translation |
| `LLMCoachedMethod` | LLM coaché (OpenRouter + données de coaching) |
| `APIMethod` | Client API distant |
| `runSync`, `runContentSync` | Pipeline de synchronisation complète |
| `resolveConfig`, `resolvePairs` | Résolution de configuration |
| `validateTranslations` | Porte de qualité |
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
