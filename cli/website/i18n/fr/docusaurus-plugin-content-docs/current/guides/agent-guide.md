---
sidebar_position: 9
title: "Guide de l'agent : Utiliser champollion"
description: "Comment les agents IA peuvent installer, configurer et exécuter champollion pour traduire des fichiers de localisation."
related:
  - label: "Agent Guide: Building & Benchmarking on the Network"
    to: /docs/network/getting-started/agent-guide
    kind: arena
    note: "The eval-side guide for the same agents"
  - label: "Serving a Custom Method as an API"
    to: /docs/guides/serving-a-method
    kind: guide
  - label: "Build a Translation Plugin"
    to: /docs/tutorials/build-a-plugin
    kind: tutorial
  - label: "CLI Reference"
    to: /docs/reference/cli
    kind: reference
---

# Guide de l'agent : Utiliser champollion

champollion est un outil CLI qui traduit les fichiers de paramètres régionaux de votre application en une seule commande. Ce guide s'adresse aux agents IA (ou aux développeurs travaillant avec des agents IA) qui souhaitent passer de zéro à des fichiers de paramètres régionaux traduits rapidement.

:::tip[Déjà familiarisé ?]
Si vous avez besoin uniquement des commandes, consultez la [Référence CLI](/docs/reference/cli). Si vous souhaitez construire et évaluer une méthode de traduction, voir le [Guide Agent Réseau](/docs/network/getting-started/agent-guide).
:::

---

## Configuration de l'environnement

```bash
# No global install needed — npx runs it directly
npx champollion sync
```

**Prérequis :**
- Node.js 20.11+ (ESM natif)
- Une clé API pour votre fournisseur de traduction

**Configuration de la clé API** — champollion a besoin d'au moins une clé selon les méthodes que vous utilisez :

```bash
# Option 1: export (session only)
export OPENROUTER_API_KEY="sk-or-..."        # for llm / llm-coached methods
export GOOGLE_TRANSLATE_API_KEY="AIza..."    # for google-translate method

# Option 2: .env file in your project root (persistent, gitignored)
echo 'OPENROUTER_API_KEY=sk-or-...' > .env
```

Champollion lit `.env.local` et `.env` automatiquement (priorité : `process.env` → `.env.local` → `.env`). Obtenez une clé OpenRouter sur [openrouter.ai/keys](https://openrouter.ai/keys).

---

## Première synchronisation

Champollion détecte automatiquement vos fichiers de locale, leur format (JSON, TOML ou YAML) et vos langues cibles :

```bash
npx champollion sync
```

**Ce qui se passe :**
1. Charge `champollion.config.json` (ou détecte automatiquement les paramètres)
2. Analyse votre fichier de paramètres régionaux source, aplatit les clés imbriquées
3. Compare par rapport à `.champollion.lock` (hachages SHA-256 des valeurs précédemment traduites)
4. Vérifie `.champollion/tm.json` pour les traductions en cache (Mémoire de traduction)
5. Traduit uniquement les clés **modifiées, manquantes ou obsolètes** via la méthode configurée
6. Exécute la porte de qualité (5 vérifications) sur chaque traduction
7. Écrit les traductions réussies dans le fichier de paramètres régionaux cible
8. Met à jour le fichier de verrouillage et le cache TM

Lors d'une réexécution typique après modification d'une clé, l'étape 4 sert 142 clés à partir du cache et l'étape 5 traduit 1 clé. C'est pourquoi les synchronisations ultérieures sont rapides et peu coûteuses.

---

## Configuration

Créez `champollion.config.json` à la racine de votre projet :

```json
{
  "inputLocale": "en",
  "pairs": {
    "en:fr": { "method": "llm-coached" },
    "en:ja": { "method": "google-translate" },
    "en:crk": { "method": "api", "endpoint": "http://localhost:3000/translate" }
  }
}
```

Les clés de paires utilisent un **deux-points** (`en:fr`), non un tiret — les tirets sont réservés aux codes de locale régionaux comme `es-MX`.

Champs clés :

| Champ | Description | Valeur par défaut |
|-------|-------------|-------------------|
| `inputLocale` | Langue source | `en` |
| `languages` | Langues cibles (tableau ou objet) | `[]` |
| `pairs` | Surcharges par paire (clés `"src:tgt"`) avec configuration de méthode | facultatif |
| `localesDir` | Emplacement des fichiers de locale | `./locales` |
| `model` | Modèle LLM pour les méthodes `llm`/`llm-coached` | `google/gemini-3.8-flash` |
| `batchSize` | Clés par appel d'API | 80 (LLM) ; Google Translate limite à 128 segments/requête |
| `jsonConcurrency` | Traductions de locales en parallèle pour les clés JSON | 50 |
| `contentConcurrency` | Appels d'API en parallèle pour la traduction de contenu | 48 (docs Docusaurus), 12 (`contentDir`) |

Référence complète : [Configuration](/docs/getting-started/configuration)

---

## Méthodes de Traduction

| Méthode | Quand l'utiliser | Coût | Clé API nécessaire |
|---------|-----------------|------|-------------------|
| **`llm`** | Usage général, bon pour les langues bien dotées en ressources | Par jeton (dépend du modèle) | `OPENROUTER_API_KEY` |
| **`llm-coached`** | Quand vous avez des règles de grammaire/dictionnaire pour la langue cible | Par jeton + contexte de coaching | `OPENROUTER_API_KEY` |
| **`google-translate`** | Langues à ressources élevées où la traduction automatique fonctionne bien | 20 $/million de caractères | `GOOGLE_TRANSLATE_API_KEY` |
| **`api`** | Pipeline personnalisé hébergé derrière un point de terminaison HTTP | Déterminé par le serveur | Aucune (le point de terminaison gère l'authentification) |
| **`plugin`** | Méthode pré-packagée installée localement | Varie | Varie |

Détails : [Méthodes de traduction](/docs/guides/translation-methods)

---

## Données de coaching

Pour les paires `llm-coached`, les données de coaching orientent le LLM avec des connaissances linguistiques explicites. Créez un fichier de coaching :

```json title="coaching/fr.json"
{
  "grammar_rules": [
    "Use formal register (vous) for all UI text",
    "Adjectives agree in gender and number with the noun"
  ],
  "dictionary": {
    "dashboard": "tableau de bord",
    "settings": "paramètres"
  },
  "style_notes": "Prefer active voice. Avoid anglicisms."
}
```

Référencez-le dans votre configuration de paire :

```json
"en:fr": { "method": "llm-coached", "coachingFile": "coaching/fr.json" }
```

La porte de qualité vérifie que les termes du dictionnaire apparaissent réellement dans la sortie — les violations sont enregistrées comme des avertissements `[TERM]`.

Détails : [Données de coaching](/docs/concepts/coaching-data)

---

## Porte de qualité

Chaque traduction passe par cinq vérifications automatisées avant d'être écrite sur le disque :

| Contrôle | Ce qui est détecté | Exemple |
|----------|-------------------|---------|
| **Vide/blanc** | Le modèle n'a rien renvoyé | `""` |
| **Écho de la source** | Le modèle a renvoyé l'entrée en anglais sans modification | `"Welcome"` pour le japonais |
| **Boucle d'hallucination** | Trigrammes répétés | `"Qo' Qo' Qo' Qo'"` |
| **Gonflement de la longueur** | La sortie dépasse 4× la longueur de la source (exactement 4× est accepté) | Source de 10 car. → sortie de 50 car. |
| **Conformité de l'écriture** | Écriture incorrecte pour la locale | Texte en caractères latins pour une locale arabe |

Les défaillances sont enregistrées avec le préfixe `[GATE]`. Pas de replis silencieux — si une traduction échoue, elle est signalée, pas silencieusement acceptée.

Détails : [Porte de qualité](/docs/concepts/quality-gate)

---

## Mémoire de traduction

Champollion met en cache les traductions dans `.champollion/tm.json`, indexées par texte source + locale + méthode. Lors des synchronisations ultérieures, les clés inchangées sont servies à partir du cache — pas d'appel API, pas de coût.

```
[TM] 142 key(s) served from cache
Translating 3 key(s) to French (llm)... [OK]
```

Pour contourner le cache pour une exécution : `npx champollion sync --no-tm`

Détails : [Mémoire de traduction](/docs/concepts/translation-memory)

---

## Fichiers générés

Champollion crée plusieurs fichiers dans votre projet. Sachez ce qu'ils sont pour ne pas supprimer ou valider accidentellement les mauvais :

| Fichier | Description | Git ? |
|---------|-------------|-------|
| `.champollion.lock` | Hachages SHA-256 des valeurs sources traduites (détection des modifications), ainsi que par locale : ce que la synchronisation a écrit, les clés laissées en attente par une réexécution, les clés retenues après un refus | **Oui** — commitez ce fichier |
| `.champollion-replaced-edits.jsonl` | Traductions modifiées manuellement qu'une synchronisation a remplacées, avec leur formulation (écrit uniquement lorsque cela se produit) | **Oui** — commitez ce fichier |
| `.champollion-content.lock` | Idem, mais pour les fichiers de contenu Markdown/MDX | **Oui** — commitez ce fichier |
| `.champollion/` | Répertoire d'état interne (cache `tm.json`, exports XLIFF, sauvegardes) | **Non** — ajoutez-le au .gitignore ; `tm.json` est un cache local (voir [Configuration](/docs/getting-started/configuration)) |
| Fichiers d'apprentissage créés par vos soins (ex. `coaching/fr.json`) | Vos connaissances linguistiques | **Oui** — commitez-les |
| `champollion.config.json` | Configuration du projet | **Oui** — commitez ce fichier |

---

## Modèles courants

**Traduire toutes les paires configurées :**
```bash
npx champollion sync
```
Champollion traduit toutes les locales en parallèle. Avec la mise en cache de la MT, seules les clés modifiées appellent l'API (les paires inchangées sont servies depuis le cache, ce qui rend une synchronisation complète très économique).

**Traduire uniquement des paires spécifiques :**
```bash
npx champollion sync --pair en:fr          # one pair
npx champollion sync --pair en:fr,en:de    # comma-separated list
```
`--pair` limite l'exécution à la ou aux paires spécifiées ; les vérifications de disponibilité et les dépenses ne s'appliquent qu'à ces paires. Spécifier une paire qui ne figure pas dans votre graphe de paires configuré échoue explicitement en affichant la liste des paires configurées — jamais sous la forme d'une opération nulle silencieuse.

**Comment écrire une paire.** Une paire de projet s'écrit de la manière dont `champollion.config.json` la référence, `en:fr`. `sync`, `verify` et `serve` acceptent également `en>fr` et `en-fr`, et `en-pt-BR` est comparé aux paires que vous avez configurées. Les commandes réseau (`network register-corpus`, `leaderboard`, `recommend`, `submit`) écrivent une paire sous la forme `eng>crk`, le format stocké par le classement, et lisent `eng-crk` et `eng:crk` de la même façon. Dans ce contexte, une paire comportant uniquement des tirets doit être composée de deux codes de deux ou trois lettres (`eng-crk`). Un code contenant son propre tiret nécessite `>` : `--pair "eng>pt-BR"`. `eng-pt-BR` pouvant également signifier `eng-pt` et `BR`, il est refusé et ne fait jamais l'objet d'une devinette. Dans un shell, placez la forme `>` entre guillemets : `--pair "eng>crk"`. Sans guillemets, le shell redirige la sortie vers un fichier nommé `crk`.

**Mode contenu (un dossier de fichiers Markdown/MDX : un `content/` Hugo ou tout autre dossier ; les documents Docusaurus sont détectés sans lui) :**
```bash
npx champollion sync --content-dir ./content
```
Traduit la documentation, les articles de blog et les fichiers de contenu aux côtés des fichiers JSON de locale. Chaque traduction est écrite à côté de sa source sous la forme `<name>.<locale>.md` ; les modifications apportées par un réviseur sont conservées lorsque la source est modifiée par ailleurs ([Traduction de contenu](/docs/guides/content-translation#reviewing-and-editing-translations)). La traduction de contenu s'exécute en parallèle ; ajustez ce comportement avec `--content-concurrency`.

**Exécution à blanc (aperçu sans écriture) :**
```bash
npx champollion sync --dry-run
```

**Forcer la re-traduction de clés spécifiques :**
```bash
npx champollion sync --force-keys "hero.title,nav.about"
```

**Retraiter tous les fichiers de contenu (le texte mis en cache est réutilisé, le texte inchangé ne coûte donc rien) :**
```bash
npx champollion sync --force-content
```

**Traduire à neuf des fichiers de contenu spécifiques (facturé), ou limiter une exécution à certains fichiers :**
```bash
npx champollion sync --retranslate docs/intro.md
npx champollion sync --files "docs/guides/**"
```

**Exécution lisible par machine :** `--json` écrit un objet JSON par ligne (NDJSON), chacun comportant un champ `level` : sur stdout, les messages `info` et `ok`, les enregistrements `event` (`"event": "cost"` — l'estimation, avant le contrôle `--max-cost` — et un `"event": "file"` par fichier de contenu et par locale), et enfin l'événement de clôture `{"level": "summary", "command": "sync", …}` ; sur stderr, les lignes `warn` et `error`, également en JSON. Sélectionnez le résumé d'après son niveau, jamais uniquement d'après sa position dans les lignes : `npx champollion sync --dry --json 2>/dev/null | jq -c 'select(.level == "summary")'`. Le code de sortie `2` indique une exécution partielle (une partie du travail a été effectuée, un élément a échoué).

Dans l'estimation (événement `cost` et `costEstimate` dans le résumé), `totalEstimatedCost` vaut `null` dès lors qu'une partie n'a pas de prix connu — jamais une somme partielle, jamais `0` pour indiquer l'inconnu ; `knownEstimatedCost` contient la partie tarifiée, `unknownCost.reason` liste les paires sans tarif, et `unknownCost.notes` indique ce qui n'en a pas et pourquoi — `{ subject, pairs, note }`, comme un nom de modèle absent de la liste d'OpenRouter (probablement une faute de frappe, avec les noms répertoriés les plus proches), un modèle répertorié sans prix par jeton, ou une grille tarifaire qui n'a pas pu être lue. Un modèle exécuté sur cette machine (un point de terminaison `local` ou `api` sur `localhost`/`127.0.0.1`/`::1`) est tarifé à `0` avec `"local": true`. Le champ `sentToModel` du résumé compte les clés envoyées à la méthode lors de cette exécution (`tmHits` : servies depuis le cache). Le résumé d'un test à blanc (dry run) comporte `preflight: { ready, failures }` — `ready: false` signifie que l'exécution réelle s'arrêterait avec le code de sortie `1` (une clé manquante ou un serveur de modèles requis qui ne répond pas), bien que le test à blanc lui-même se termine avec le code `0` ([codes de sortie](/docs/reference/cli#sync-exit-codes)). Avec `--max-cost`, il comporte également `maxCost: { cap, estimatedCost, wouldStop }` — `wouldStop: true` (avec `exitCode: 2` et le `reason`) signifie que l'exécution réelle s'arrêterait à la limite avant tout appel d'API. `realRun: { exitCode, wouldStop, reasons }` correspond au code de sortie avec lequel l'exécution réelle se terminerait, pour autant qu'une prévisualisation puisse le déterminer : le contrôle préalable et le plafond, plus ce qui laisserait l'exécution partielle — les clés retenues, les messages au pluriel sur le disque dépourvus d'une forme utilisée par la langue pour laquelle il ne ferait pas de nouvelle requête (comptabilisés dans `totalPluralGaps` du test à blanc). Un test à blanc ne vérifie rien (`verify: { "ran": false }`). Exécutez le test à blanc avec les options `--method`/`--model` de l'exécution réelle : sans elles, il vérifie la méthode spécifiée dans la configuration.

**Vérifier l'état de la traduction :**
```bash
npx champollion status
```
Affiche la méthode, le modèle, la couverture et les informations sur les plugins de chaque paire (un `qualityTier` uniquement lorsque la configuration en définit un — une étiquette, pas une mesure).

**Audit pour les replis non traduits :**
```bash
npx champollion audit
```
Liste toutes les valeurs de repli `[EN]` qui nécessitent une traduction.

---

## Dépannage

| Problème | Solution |
|----------|----------|
| `OPENROUTER_API_KEY not set` | Exportez la clé ou ajoutez-la à `.env` à la racine de votre projet |
| `No locale files found` | Définissez `localesDir` dans la configuration, ou assurez-vous que vos fichiers de locale respectent la convention de nommage standard (`en.json`, `fr.json`) |
| `[GATE] Script compliance failed` | Votre locale cible a reçu du texte en caractères latins au lieu de l'écriture attendue — essayez un autre modèle ou ajoutez des données d'apprentissage |
| `[GATE] Source echo` | Le modèle a renvoyé l'anglais sans modification — des données d'apprentissage ou un autre modèle résolvent généralement ce problème |
| Toutes les traductions sont en cache | Exécutez la commande avec `--no-tm` pour ignorer le cache, ou `--force-keys` pour des clés spécifiques |
| Conflits sur le fichier lock | `.champollion.lock` contient des hachages — un conflit de fusion peut être résolu en toute sécurité en conservant l'une ou l'autre version, puis en réexécutant la synchronisation. Conserver l'enregistrement par locale de l'autre branche peut faire en sorte que certaines valeurs soient interprétées comme modifiées manuellement (une réexécution globale les conserve alors et les liste ; `--redo keys:` en remplace une) — jamais l'inverse |
| Clés « retenues » | Le contrôle de qualité a précédemment refusé la réponse de ce modèle ; une synchronisation standard ne la renvoie pas (cela facturerait la même réponse). `champollion sync --redo keys:<key>` effectue une nouvelle demande ; sinon, ajoutez un `fallback`, référencez-le dans `noTranslate` ou rédigez-la manuellement |

---

## Prochaines étapes

- [Démarrage rapide](/docs/getting-started/quick-start) — procédure complète de démarrage
- [Référence CLI](/docs/reference/cli) — chaque commande et drapeau
- [Comment ça marche](/docs/how-it-works) — le pipeline de synchronisation expliqué
- [Le pont du harnais d'évaluation](/docs/guides/bridge) — comment champollion se connecte au réseau
- **Vous voulez construire votre propre méthode de traduction ?** Consultez le [Guide de l'agent réseau](/docs/network/getting-started/agent-guide) — construisez une méthode, prouvez qu'elle fonctionne sur le classement public, et concourez pour un prix si/quand l'un est ouvert (les prix sont un mécanisme prévu — voir [Limitations honnêtes](/docs/network/honest-limitations)).
