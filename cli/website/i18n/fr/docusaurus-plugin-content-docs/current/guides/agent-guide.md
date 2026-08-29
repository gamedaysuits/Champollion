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

| Champ | Objectif | Défaut |
|-------|---------|--------|
| `inputLocale` | Langue source | `en` |
| `languages` | Langues cibles (tableau ou objet) | `[]` |
| `pairs` | Remplacements par paire (clés `"src:tgt"`) avec configuration de méthode | optionnel |
| `localesDir` | Emplacement des fichiers de locale | `./locales` |
| `model` | Modèle LLM pour les méthodes `llm`/`llm-coached` | `google/gemini-3.5-flash` |
| `batchSize` | Clés par appel API | 80 (LLM) ; Google Translate plafonne à 128 segments/requête |
| `jsonConcurrency` | Traductions de locale parallèles pour les clés JSON | 50 |
| `contentConcurrency` | Appels API parallèles pour la traduction de contenu | 48 (Docusaurus docs), 12 (Hugo `contentDir`) |

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

| Vérification | Ce qu'elle détecte | Exemple |
|--------------|-------------------|---------|
| **Vide/blanc** | Le modèle n'a rien retourné | `""` |
| **Écho source** | Le modèle a retourné l'entrée anglaise inchangée | `"Welcome"` pour le japonais |
| **Boucle d'hallucination** | Trigrammes répétés | `"Qo' Qo' Qo' Qo'"` |
| **Inflation de longueur** | La sortie est 4 fois ou plus plus longue que la source | Source de 10 caractères → sortie de 50 caractères |
| **Conformité du script** | Mauvais script pour la locale | Texte latin pour la locale arabe |

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

| Fichier | Objectif | Git ? |
|--------|---------|-------|
| `.champollion.lock` | Hachages SHA-256 des valeurs source traduites (détection des modifications) | **Oui** — validez ceci |
| `.champollion-content.lock` | Identique, mais pour les fichiers de contenu Markdown/MDX | **Oui** — validez ceci |
| `.champollion/` | Répertoire d'état interne (cache `tm.json`, exports XLIFF, sauvegardes) | **Non** — ajoutez à gitignore ; `tm.json` est un cache local (voir [Configuration](/docs/getting-started/configuration)) |
| Fichiers de coaching que vous créez (p. ex. `coaching/fr.json`) | Vos connaissances linguistiques | **Oui** — validez ceux-ci |
| `champollion.config.json` | Configuration du projet | **Oui** — validez ceci |

---

## Modèles courants

**Traduire toutes les paires configurées :**
```bash
npx champollion sync
```
Champollion traduit toutes les locales en parallèle. Avec la mise en cache de la TM, seules les clés modifiées sollicitent l'API (les paires inchangées sont servies depuis le cache, une synchronisation complète est donc peu coûteuse).

**Traduire uniquement des paires spécifiques :**
```bash
npx champollion sync --pair en:fr          # one pair
npx champollion sync --pair en:fr,en:de    # comma-separated list
```
`--pair` restreint l'exécution à la ou aux paires nommées ; les vérifications de préparation et les dépenses ne s'appliquent qu'à ces paires. Nommer une paire qui ne figure pas dans votre graphe de paires configuré provoque une erreur explicite avec la liste des paires configurées — ce n'est jamais une opération ignorée silencieusement.

**Mode contenu (Markdown/MDX pour Docusaurus, Hugo, etc.) :**
```bash
npx champollion sync --content-dir ./content
```
Traduit les documents, articles de blog et fichiers de contenu aux côtés du JSON de locale. La traduction de contenu s'exécute en parallèle ; ajustez avec `--content-concurrency`.

**Exécution à blanc (aperçu sans écriture) :**
```bash
npx champollion sync --dry-run
```

**Forcer la re-traduction de clés spécifiques :**
```bash
npx champollion sync --force-keys "hero.title,nav.about"
```

**Forcer la re-traduction de tous les fichiers de contenu :**
```bash
npx champollion sync --force-content
```

**Vérifier l'état de la traduction :**
```bash
npx champollion status
```
Affiche la couverture, les niveaux de qualité et les informations de plugin pour chaque paire.

**Audit pour les replis non traduits :**
```bash
npx champollion audit
```
Liste toutes les valeurs de repli `[EN]` qui nécessitent une traduction.

---

## Dépannage

| Problème | Solution |
|---------|----------|
| `OPENROUTER_API_KEY not set` | Exportez la clé ou ajoutez-la à `.env` à la racine de votre projet |
| `No locale files found` | Définissez `localesDir` dans la configuration, ou assurez-vous que vos fichiers de paramètres régionaux correspondent à la dénomination standard (`en.json`, `fr.json`) |
| `[GATE] Script compliance failed` | Votre locale cible a reçu du texte latin au lieu du script attendu — essayez un modèle différent ou ajoutez des données de coaching |
| `[GATE] Source echo` | Le modèle a retourné l'anglais inchangé — les données de coaching ou un modèle différent résolvent généralement ce problème |
| Toutes les traductions en cache | Exécutez avec `--no-tm` pour contourner le cache, ou `--force-keys` pour des clés spécifiques |
| Conflits de fichier de verrouillage | `.champollion.lock` utilise des hachages SHA-256 — les conflits de fusion sont sûrs à résoudre en conservant l'une ou l'autre version, puis en réexécutant la synchronisation |

---

## Prochaines étapes

- [Démarrage rapide](/docs/getting-started/quick-start) — procédure complète de démarrage
- [Référence CLI](/docs/reference/cli) — chaque commande et drapeau
- [Comment ça marche](/docs/how-it-works) — le pipeline de synchronisation expliqué
- [Le pont du harnais d'évaluation](/docs/guides/bridge) — comment champollion se connecte au réseau
- **Vous voulez construire votre propre méthode de traduction ?** Consultez le [Guide de l'agent réseau](/docs/network/getting-started/agent-guide) — construisez une méthode, prouvez qu'elle fonctionne sur le classement public, et concourez pour un prix si/quand l'un est ouvert (les prix sont un mécanisme prévu — voir [Limitations honnêtes](/docs/network/honest-limitations)).
