---
sidebar_position: 1
title: "Référence CLI"
related:
  - label: "Quick Start"
    to: /docs/getting-started/quick-start
    kind: guide
  - label: "Configuration"
    to: /docs/getting-started/configuration
    kind: reference
  - label: "CI/CD"
    to: /docs/guides/ci-cd
    kind: guide
  - label: "Troubleshooting"
    to: /docs/guides/troubleshooting
    kind: guide
---

# Référence CLI

## Commandes

```
champollion init              Interactive setup wizard (--yes for quick defaults)
champollion sync              Translate & sync all locale files
champollion watch             Auto-sync when the source file changes
champollion audit             List all untranslated [EN] fallback values
champollion lint              Scan source code for hardcoded strings
champollion wrap              Auto-wrap hardcoded strings in t() calls (with undo)
champollion seo <sub>         Generate hreflang, sitemap.xml, or JSON-LD schema
champollion integrity         Audit locale files for format/encoding issues
champollion repair-script     Restore romanization where script conversion was unwanted
champollion verify            Verify translations are present and correct (CI gate)
champollion status            Show pair configuration, plugins, and quality tiers
champollion provenance        Audit translation resource licensing
champollion plugin <sub>      Manage method plugins (install, remove, list)
champollion fonts <sub>       Download web fonts for PUA script converters
champollion leaderboard       Browse and install methods from the Network leaderboard
champollion tm <sub>          Manage Translation Memory cache (stats, clear, seed, prune)
champollion xliff <sub>       Export/import XLIFF 1.2 for professional review
champollion card <code>       Pretty-print a language card (--json for raw output)
champollion models            List available models from a provider (--method <provider>)
champollion doctor            System health check (cards, config, FSTs, API keys, methods)
champollion recommend         Method guidance for a pair — availability + cited evidence
champollion register-corpus   Register a corpus: pick a license + exposure tier (local-only/private/public/sealed)
champollion submit            Propose an index entry (review-gated): prints a pre-filled GitHub issue
champollion seal-corpus <sub> Sealed-tier crypto verbs: keygen / seal / open (organizer-node bridge)
```

Exécutez `champollion <command> --help` pour obtenir une aide détaillée sur n'importe quelle commande.

## Options globales

```
--help, -h              Show help (global or per-command)
--version, -v           Print version and exit
--yes, -y               Skip interactive prompts, use defaults
--config <path>         Custom config file path
--dir <path>            Override locales directory
--content-dir <path>    Hugo/Docusaurus content directory for Markdown translation
--source <code>         Override source locale (default: en)
--model <model>         Override translation model (full slug or alias from shared/model-aliases.json)
--method <method>       Translation method: llm, google-translate (default: from config)
--temperature <n>       LLM temperature (0.0–2.0, default: 0.3)
--coaching-file <path>  Path to free-text coaching prompt file (injected into system prompt)
--format <fmt>          Locale file format: json, toml, yaml, or auto
--dry, --dry-run        Preview changes without writing files
--list-keys             With --dry: name every queued key per reason
--concurrency <n>       Max parallel API calls (sets both JSON and content, default: 48)
--json-concurrency <n>  Max parallel locale translations for JSON keys (default: 200)
--content-concurrency <n> Max parallel API calls for content translation (default: 48)
--force                 Re-queue every source key (whole-locale rebuild; scope with --pair)
--force-content         Re-translate all content files (clears content lock)
--force-keys <keys>     Comma-separated dot-notation keys to force re-translate
--no-tm                 Skip Translation Memory cache for this sync run
--no-verify             Skip post-sync verification pass
--locale <code>         Target locale (xliff export, tm clear)
--quiet                 Errors and warnings only — suppress banner, progress bar, and info lines
--json                  Machine-readable NDJSON output — one JSON object per event
```

---

## init

Assistant de configuration interactif qui crée `champollion.config.json`. Vous guide à travers la locale source, les langues cibles, le format de fichier et le modèle de traduction.

```bash
champollion init                          # interactive wizard
champollion init --yes                    # skip wizard, use defaults
champollion init --yes --langs fr,de,ja   # quick setup with specific languages
champollion init --source en --dir ./i18n # overrides with defaults
```

**Option `--langs`** : Liste de codes de langue cibles séparés par des virgules. Ignore l'invite de langue et applique les présets de registre par défaut pour chaque langue. Combinez avec `--yes` pour une configuration entièrement non-interactive.

**Présets de langue** : Lorsque vous êtes invité à entrer les langues cibles, vous pouvez taper les noms des présets :
- `european` → fr, de, es, it, pt, nl
- `asian` → ja, zh, ko
- `global` → fr, es, de, ja, zh, ko, pt, ar
- `nordic` → da, fi, nb, sv

Mélangez les présets et les codes individuels : `european, ja` → fr, de, es, it, pt, nl, ja

---

## sync

Traduit les clés manquantes et obsolètes dans tous les fichiers de locale. Exécute la vérification post-synchronisation par défaut.

```bash
champollion sync                                   # translate everything
champollion sync --dry-run                         # preview only
champollion sync --dry --list-keys                 # preview AND name every queued key
champollion sync --force-keys "hero.title"         # force re-translate
champollion sync --force-keys "a.title,a.subtitle" # multiple keys
champollion sync --pair en:tlh --force             # rebuild one whole locale
champollion sync --pair en:tlh --force --no-tm     # ...bypassing a suspect cache
champollion sync --force-content                   # re-translate all Markdown/MDX
champollion sync --content-dir ./content           # include Hugo Markdown
champollion sync --method google-translate          # force Google Translate
champollion sync --concurrency 20                  # 20 parallel API calls (both phases)
champollion sync --json-concurrency 30              # 30 parallel locale translations (JSON)
champollion sync --content-concurrency 8            # 8 parallel content translations
champollion sync --no-verify                        # skip post-sync verification
champollion sync --no-tm                            # skip cache, fresh API calls
```

**Mémoire de traduction** : Par défaut, `sync` charge `.champollion/tm.json` et fournit les traductions en cache pour les valeurs source inchangées. Utilisez `--no-tm` pour contourner le cache (utile lors du changement de fournisseur de traduction ou du débogage de la qualité). Consultez [Mémoire de traduction](/docs/concepts/translation-memory).

**Détection des modifications** : champollion stocke les hachages SHA-256 dans `.champollion.lock`. Lorsque les valeurs source changent, la synchronisation suivante retraduit automatiquement ces clés. Validez le fichier de verrouillage pour que tous les développeurs partagent la ligne de base.

**Parallélisme** : La traduction des clés JSON et la traduction du contenu s'exécutent en parallèle. Les locales JSON sont traduites simultanément (par défaut : 200 locales concurrentes), avec des lots au sein de chaque locale également parallélisés (4 lots concurrents). La traduction du contenu (Markdown, MDX, articles de blog) s'exécute dans un pool d'éléments de travail plat (par défaut : 48 appels API concurrents). Remplacez avec `--json-concurrency`, `--content-concurrency` ou `--concurrency` (définit les deux).

**Sortie** : La synchronisation affiche une bannière de version, la détection du format/framework, une estimation des coûts et des barres de progression par locale :

```
champollion v0.1.0

[INFO] Detected format: json (auto)
[INFO] Source: en.json (2,847 keys)
[INFO] Pairs: es-MX:llm, fr:deepl

[INFO] es-MX.json — 2,847 missing
     ████████████████████████████████ 2,847/2,847 keys
[INFO] fr.json — 2,847 missing
     ████████████████████████████████ 2,847/2,847 keys
[OK] Synced 5,694 keys total.
```

Les barres de progression se mettent à jour sur place après chaque lot (~80 clés). Utilisez `--quiet` pour les erreurs/avertissements uniquement, ou `--json` pour une sortie NDJSON lisible par machine. Les deux suppriment la barre de progression et la bannière.

---

## watch

Synchronisation automatique lorsque le fichier de locale source change. S'exécute jusqu'à interruption avec `Ctrl+C`.

```bash
champollion watch
```

---

## audit

Énumère toutes les valeurs de secours préfixées par `[EN]` non traduites des exécutions précédentes. Quitte avec le code 1 si des valeurs sont trouvées — utilisez comme porte de CI pour échouer les builds avec des traductions incomplètes.

```bash
champollion audit
```

---

## verify

Relit tous les fichiers de locale depuis le disque et vérifie que les traductions sont réellement présentes et correctes. C'est la même vérification qui s'exécute automatiquement à la fin de chaque `sync` (sauf si `--no-verify` est passé).

```bash
champollion verify                    # verify all locale files
champollion verify --warn-only        # non-blocking
champollion verify && echo "All good" # CI gate
```

**Ce qu'il vérifie :**
- Parité des clés — toutes les clés source présentes dans chaque cible
- Marqueurs de secours `[EN]` des exécutions précédentes
- Traductions vides
- Conformité des scripts — les locales non-latines doivent avoir des traductions non-ASCII
- Préservation des espaces réservés — les espaces réservés ICU correspondent à la source
- Problèmes d'encodage — marqueurs BOM, caractères invisibles
- Échos source — valeurs identiques à la source (avertissement)

---

## lint

Analyse le code source pour les chaînes de caractères codées en dur visibles par l'utilisateur qui devraient utiliser les appels de traduction i18n. Détecte automatiquement votre framework (next-intl, react-i18next, vue-i18n, Hugo).

```bash
champollion lint                    # exits 1 if issues found
champollion lint --warn-only        # always exits 0
champollion lint --src ./app        # custom source directory
champollion lint --min-length 4     # minimum string length to flag
```

**Ce qu'il détecte :**
- Chaînes codées en dur dans le texte JSX, `placeholder`, `alt`, `aria-label`, `title`
- Fichiers avec du contenu visible par l'utilisateur mais sans importation de framework i18n
- Clés mortes — clés de locale qu'aucun fichier source ne référence
- Score de couverture — pourcentage de chaînes passant par i18n

**Exclusions** : Créez `.champollionignore` à la racine de votre projet (motifs glob, comme `.gitignore`).

---

## wrap

Enveloppe automatiquement les chaînes codées en dur détectées par `lint` dans les appels `t()`. Crée des sauvegardes automatiques avant de modifier les fichiers.

```bash
champollion wrap                    # auto-wrap with backup
champollion wrap --dry              # preview wrapping changes
champollion wrap --undo             # restore from .champollion-backup/
```

**Portes de sécurité :**
1. Vérification de propreté Git (ignorée en mode dry-run)
2. Sauvegarde automatique vers `.champollion-backup/`
3. Aperçu des différences avant chaque écriture de fichier
4. Support `--undo` pour restaurer à partir de la sauvegarde

---

## seo

Générez des artefacts SEO pour les sites multilingues.

```bash
champollion seo hreflang                                        # print hreflang tags
champollion seo sitemap --base-url https://example.com --out sitemap.xml
champollion seo jsonld --base-url https://example.com           # JSON-LD schema
```

| Sous-commande | Sortie |
|------------|--------|
| `hreflang` | Balises `<link rel="alternate" hreflang>` |
| `sitemap` | `sitemap.xml` multilingue |
| `jsonld` | Schéma JSON-LD WebSite language |

---

## integrity

Détecte la corruption et la dérive dans les fichiers de locale traduits.

```bash
champollion integrity               # exits 1 if issues found
champollion integrity --warn-only   # non-blocking
```

**Ce qu'il vérifie :**
- Corruption des espaces réservés (par ex., `{name}` présent dans la source mais manquant dans la cible)
- Problèmes d'encodage (mojibake, Unicode invalide)
- Copies non traduites (valeur cible identique à la source) — les clés [`noTranslate`](/docs/getting-started/configuration#no-translate) sont exemptées, tout comme les échos que la mémoire de traduction confirme comme étant produits par le pipeline et approuvés par le point de contrôle. Ce qui reste signalé est exactement ce que `sync` remettrait en file d'attente — les deux outils ne peuvent pas être en désaccord sur un fichier sain
- Dérive de non-traduction (une clé `noTranslate` qui n'est *pas* identique à la source) — signalée avec les valeurs attendues/réelles et les caractères invisibles échappés ; exécutez `champollion sync` pour réparer
- PUA inattendu (points de code de la zone à usage privé dans une locale dont la [conversion de script](/docs/getting-started/configuration#script-conversion) est désactivée — produit un rendu vide sans une police spéciale) ; exécutez `champollion repair-script` pour réparer
- Valeurs évidées (une cible qui est sa source avec les lettres supprimées — dommage causé par un pipeline plus ancien que le point de contrôle de préservation du contenu) ; retraduisez avec `sync --force-keys <key>` ou `sync --pair <pair> --force`
- Clés orphelines (clés dans la cible qui n'existent pas dans la source)
- Exhaustivité des catégories de pluriel ICU MessageFormat (par ex., l'arabe nécessite 6 catégories)

---

## repair-script

Annule la conversion de script qui n'aurait jamais dû se produire : les valeurs encodées en PUA (pIqaD, Tengwar, Kryptonien) dans les locales dont la configuration indique que la conversion est désactivée sont restaurées en romanisation via la propre table d'inversion du convertisseur.

```bash
champollion repair-script --dry     # preview
champollion repair-script           # repair in place
```

| Option | Effet |
|--------|--------|
| `--dry` | Prévisualiser les réparations sans écrire |
| `--locale <code>` | Réparer une seule locale |
| `--json` | Sortie JSON lisible par une machine |
| `--warn-only` | Quitter avec le code 0 même s'il reste des PUA irréversibles |

Le pIqaD s'inverse exactement. Les inversions du Tengwar et du Kryptonien ne peuvent pas récupérer la casse (signalées comme entraînant une perte de casse). La mémoire de traduction ne nécessite aucune réparation — elle stocke les valeurs d'avant la conversion. Quitte avec le code 1 lorsqu'il reste des PUA qu'aucun convertisseur enregistré ne peut inverser.

---

## tm

Gérez le cache de mémoire de traduction (`.champollion/tm.json`). TM stocke les traductions précédentes et les fournit lors des synchronisations suivantes au lieu d'appeler l'API.

```bash
champollion tm stats                  # show cache statistics
champollion tm clear                  # clear cache (with confirmation)
champollion tm clear --yes            # clear without confirmation
champollion tm clear --locale fr      # clear only French entries
```

| Sous-commande | Sortie |
|------------|--------|
| `stats` | Nombre d'entrées, taille du fichier, répartition par locale |
| `clear` | Supprimer le fichier cache (complet ou par locale) |

| Option | Effet |
|--------|--------|
| `--locale <code>` | Effacer uniquement les entrées d'une locale |
| `--yes` | Ignorer l'invite de confirmation |

Consultez [Mémoire de traduction](/docs/concepts/translation-memory) pour comprendre le fonctionnement de TM et quand l'effacer.

---

## xliff

Exportez et importez des fichiers XLIFF 1.2 pour l'examen par des traducteurs professionnels. XLIFF est le format d'échange universel pris en charge par les outils TAO comme memoQ, SDL Trados et Phrase.

```bash
champollion xliff export --locale fr                   # export French XLIFF
champollion xliff export --locale ja --out ./review/   # custom output path
champollion xliff import .champollion/xliff/fr.xliff       # import reviewed file
champollion xliff import ./reviewed.xliff --dry        # preview import
```

| Sous-commande | Sortie |
|------------|--------|
| `export` | Générez `.xliff` à partir des fichiers de locale source + cible |
| `import` | Fusionnez les traductions `.xliff` examinées dans les fichiers de locale |

| Option | Effet |
|--------|--------|
| `--locale <code>` | Locale cible pour l'export (obligatoire) |
| `--out <path>` | Chemin ou répertoire de sortie personnalisé |
| `--dry` | Aperçu de l'import sans écriture |

Consultez [Travailler avec des traducteurs professionnels](/docs/guides/professional-translators) pour le flux de travail complet.

---

## status

Affiche la configuration de la paire, les plugins installés, les niveaux de qualité et les scores de référence.

```bash
champollion status
```

---

## provenance

Auditez les licences des ressources de traduction pour tous les plugins installés.

```bash
champollion provenance
```

---

## plugin

Gérez les plugins de méthode de traduction. Les plugins sont des recettes de traduction pré-packagées installées dans `.champollion/methods/`.

```bash
champollion plugin list                      # show installed plugins
champollion plugin install ./my-method/      # install from local directory
champollion plugin remove crk-coached-v1     # remove a plugin
```

Consultez [Spécification des plugins](/docs/reference/plugin-spec) pour le format du manifeste des plugins.

---

## leaderboard

Parcourez, recherchez et installez les méthodes de traduction du classement du réseau. Les méthodes installées à partir du classement sont accompagnées de scores de référence et de la MethodConfig canonique complète — la configuration exacte utilisée lors de l'évaluation.

```bash
champollion leaderboard                          # show leaderboard
champollion leaderboard --pair en:fr             # filter by language pair
champollion leaderboard --install crk-coached-v8 # install a method plugin
champollion leaderboard --install crk-coached-v8 --apply  # install + patch config
```

| Option | Effet |
|--------|--------|
| `--pair <code>` | Filtrez le classement par paire de langues (par exemple, `en:fr`) |
| `--install <name>` | Installez un plugin de méthode à partir du classement |
| `--apply` | Après l'installation, ajoutez automatiquement `methodPlugin` à `champollion.config.json` |

**Flux de travail `--apply` :** Lorsque vous installez avec `--apply`, champollion écrit le plugin de méthode dans `.champollion/methods/` **et** corrige votre `champollion.config.json` pour l'utiliser pour la paire pertinente. C'est le chemin le plus rapide de « qu'est-ce qui obtient les meilleurs scores ? » à « je l'utilise en production ».

---

## fonts

Télécharge et gère les polices web PUA pour les convertisseurs de scripts de langues construites. Les langues qui utilisent des caractères de zone d'utilisation privée (Klingon, Sindarin, Kryptonien) ont besoin de polices web personnalisées pour rendre leurs scripts. Cette commande les télécharge à partir de référentiels open-source vérifiés.

```bash
champollion fonts list                           # show needed fonts
champollion fonts install                        # download all needed fonts
champollion fonts install --css                  # also generate CSS snippet
champollion fonts install --dir ./public/fonts   # custom output directory
```

| Sous-commande | Sortie |
|------------|--------|
| `list` | Affiche les polices PUA nécessaires et leur statut d'installation |
| `install` | Télécharge les polices pour les langues configurées |

| Option | Effet |
|--------|--------|
| `--dir <path>` | Remplacez le répertoire de sortie des polices (détection automatique à partir du type de projet) |
| `--css` | Générez un extrait `conlang-fonts.css` aux côtés des polices |
| `--config <path>` | Chemin du fichier de configuration (utilisé pour détecter les langues qui ont besoin de polices) |

**Détection automatique :** Le répertoire de sortie est déduit de votre structure de projet :
- **Docusaurus** → `static/fonts/` ou `website/static/fonts/`
- **Hugo** → `static/fonts/`
- **Par défaut** → `public/fonts/`

**Convertisseurs Unicode natifs** (`crk` → Syllabaires du Cree, `sr` → Cyrillique serbe) ne nécessitent PAS d'installation de polices.

Consultez [Conlangs, Scripts & Orthographie](/docs/guides/conlangs-scripts-orthography) pour les détails complets des polices PUA.

## Pipeline à trois niveaux

Utilisez `lint`, `sync` et `audit` ensemble pour une i18n infaillible :

```json title="package.json"
{
  "scripts": {
    "i18n:lint": "champollion lint",
    "i18n:sync": "champollion sync",
    "i18n:audit": "champollion audit"
  }
}
```

| Niveau | Commande | Quand | Objectif |
|-------|---------|------|---------|
| **Lint** | `lint` | Pré-commit | Bloquez les commits avec des chaînes codées en dur |
| **Sync** | `sync` | Post-commit / CI | Traduisez les clés manquantes et modifiées |
| **Verify** | `verify` | Post-sync / CI | Confirmez que les traductions sont présentes et correctes |
| **Audit** | `audit` | Étape de build | Échouez le déploiement si une locale a des marqueurs `[EN]` |

---

## Voir aussi

- [Configuration](/docs/getting-started/configuration) — référence du fichier de configuration
- [Méthodes de traduction](/docs/guides/translation-methods) — sélection de méthode par paire
- [Mémoire de traduction](/docs/concepts/translation-memory) — mise en cache et économies de coûts
- [Travailler avec des traducteurs professionnels](/docs/guides/professional-translators) — flux de travail XLIFF
- [Spécification des plugins](/docs/reference/plugin-spec) — format du manifeste des plugins
- [Guide CI/CD](/docs/guides/ci-cd) — automatisation des commandes CLI dans votre pipeline
- [Comment fonctionne la synchronisation](/docs/concepts/how-sync-works) — comprendre le pipeline de synchronisation
- [Porte de qualité](/docs/concepts/quality-gate) — comment les traductions sont validées
