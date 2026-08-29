---
sidebar_position: 2
title: "Traduire 30 langues"
description: "Guide pratique : faire passer un projet de 3 à 30 langues en utilisant le mélange de méthodes par paire, le traitement par lot et l'intégration CI."
related:
  - label: "Writing-style & register metrics"
    to: /docs/network/specifications/harness#writing-style-and-register-metrics-informational
    kind: arena
    note: "Measure register adherence with the eval harness"
  - label: "Register"
    to: /glossary#term-register
    kind: glossary
    note: "What a register is, in plain language"
  - label: "Translation Methods"
    to: /docs/guides/translation-methods
    kind: guide
    note: "When to mix LLM, Google Translate, and coached pairs"
  - label: "Quality Gate"
    to: /docs/concepts/quality-gate
    kind: concept
    note: "How every translation is validated before it lands"
  - label: "CI/CD"
    to: /docs/guides/ci-cd
    kind: guide
    note: "Keep 30 locales current on every push"
---

# Livre de recettes : Traduire 30 langues

Faire passer un projet de quelques paramètres régionaux à une couverture mondiale. Ce livre de recettes vous guide à travers la sélection des méthodes, l'optimisation des coûts et l'intégration CI pour un déploiement multilingue réel.

**Scénario :** Vous disposez d'une application SaaS avec `en`, `fr`, `es`. Vous devez ajouter 27 langues supplémentaires réparties sur trois niveaux d'exigences de qualité.

---

## Étape 1 : Catégoriser vos langues

Les 30 langues ne nécessitent pas toutes la même approche. Regroupez-les selon la qualité de la méthode disponible :

| Niveau | Langues | Méthode | Raison |
|------|-----------|--------|-----|
| **Niveau 1 — Premium** | `ja`, `ko`, `zh`, `de`, `pt` | `llm` (GPT-4o) | Marchés à forte valeur, grammaire nuancée |
| **Niveau 2 — Standard** | `it`, `nl`, `pl`, `sv`, `da`, `fi`, `no`, `cs`, `ro`, `hu`, `el`, `tr`, `id`, `ms`, `th`, `vi`, `uk`, `bg` | `google-translate` | Volume élevé, bien pris en charge par Google |
| **Niveau 3 — Encadré** | `crk`, `oj`, `mi`, `haw` | `llm-coached` + plugins | Ressources limitées, nécessitent l'application de la terminologie |

## Étape 2 : Configurer par paire

```json title="champollion.config.json"
{
  "version": 3,
  "inputLocale": "en",
  "localesDir": "./locales",
  "defaultMethod": "google-translate",
  "model": "google/gemini-3.5-flash",
  "languages": {
    "ja": { "name": "Japanese", "register": "Polite/formal" },
    "ko": { "name": "Korean", "register": "Formal" },
    "zh": { "name": "Simplified Chinese", "register": "Neutral" },
    "de": { "name": "German", "register": "Formal (Sie)" },
    "pt": { "name": "Brazilian Portuguese", "register": "Informal" },
    "crk": { "name": "Plains Cree (SRO)", "register": "Neutral" }
  },
  "pairs": {
    "en:ja": { "method": "llm", "model": "openai/gpt-4o" },
    "en:ko": { "method": "llm", "model": "openai/gpt-4o" },
    "en:zh": { "method": "llm", "model": "openai/gpt-4o" },
    "en:de": { "method": "llm", "model": "openai/gpt-4o" },
    "en:pt": { "method": "llm", "model": "openai/gpt-4o" },
    "en:crk": { "methodPlugin": "crk-coached-v1" }
  }
}
```

**Remarque :** Les langues non listées dans `pairs` héritent de `defaultMethod: "google-translate"`. Vous n'avez pas besoin de lister les 30.

:::info
Le support de `crk` est en cours de développement — consultez [Prendre en charge une langue à ressources limitées](/docs/network/community/low-resource-languages) pour connaître l'état et les directives de contribution.
:::

## Étape 3 : Configurer les clés API

Vous aurez besoin des deux clés API pour cette configuration :

```bash
export OPENROUTER_API_KEY="sk-or-v1-..."
export GOOGLE_TRANSLATE_API_KEY="AIza..."
```

## Étape 4 : Effectuer d'abord un essai à blanc

Prévisualisez toujours avant de traduire 30 langues :

```bash
npx champollion sync --dry
```

Examinez la sortie. Elle affichera :
- Quelles paires utilisent quelle méthode
- Combien de clés sont nouvelles/modifiées par paramètre régional
- Appels API estimés par niveau

## Étape 5 : Exécuter la synchronisation

```bash
npx champollion sync
```

Champollion traite chaque paire indépendamment. Les paires de Niveau 2 utilisant Google Translate seront rapides. Les paires LLM de Niveau 1 seront plus lentes mais de meilleure qualité. Les paires encadrées de Niveau 3 utilisent les données d'encadrement du plugin.

### Mises à jour incrémentielles

Après la synchronisation initiale, les exécutions suivantes ne traduisent que les clés **modifiées ou nouvelles** :

```bash
# Only keys that changed since last sync
npx champollion sync
```

Le fichier de verrouillage (`.champollion.lock`) suit ce qui a été traduit, de sorte que vous ne retraduis jamais le contenu stable.

## Étape 6 : Auditer la qualité

Vérifiez l'état de toutes les paires de langues :

```bash
npx champollion status
```

Cela génère un tableau montrant la méthode, le modèle, le niveau de qualité de chaque paire, et si les données d'encadrement ou les scores de référence sont disponibles.

### La sortie a-t-elle respecté vos registres ?

À l'étape 2, vous avez déclaré un [registre](/glossary#term-register) par langue — `"Polite/formal"` pour le japonais, `"Formal (Sie)"` pour l'allemand. (Nouveau pour ce terme ? Le glossaire l'explique en langage clair.) Ces instructions vont dans l'invite de traduction, mais une invite est une demande, pas une garantie.

Le [harnais Network](/docs/network/specifications/harness) — le même outil qui alimente le classement public — peut mesurer le respect du registre et du style sur un échantillon de vos traductions. Ses métriques de style d'écriture vérifient chaque sortie par rapport au registre attendu (marqueurs formels/informels, pronoms T–V, contractions, dérive de longueur de phrase) et rapportent un `style_consistency_rate` sur l'exécution. Vous pouvez également le pointer vers un profil de voix de marque personnalisé avec `--style-profile`.

```bash
# install the harness, then run your sample corpus through it
pipx install mt-eval-harness
mt-eval run --corpus my-sample.json --style-profile brand-voice.json
```

Deux mises en garde honnêtes : ces métriques sont **informatives** (elles n'entrent jamais dans le score composite du classement), et la détection de formalité est basée sur des marqueurs — un détecteur de dérive, pas un jugement humain. Détails et définitions des métriques : [Métriques de style d'écriture et de registre](/docs/network/specifications/harness#writing-style-and-register-metrics-informational).

## Étape 7 : Intégration CI

Ajoutez à votre flux de travail GitHub Actions pour que les traductions restent à jour à chaque envoi :

```yaml title=".github/workflows/i18n-sync.yml"
name: Sync Translations
on:
  push:
    paths:
      - 'locales/en/**'

jobs:
  translate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20

      - run: npm ci

      - name: Sync translations
        run: npx champollion sync
        env:
          OPENROUTER_API_KEY: ${{ secrets.OPENROUTER_API_KEY }}
          GOOGLE_TRANSLATE_API_KEY: ${{ secrets.GOOGLE_TRANSLATE_API_KEY }}

      - name: Commit updated translations
        run: |
          git config user.name "github-actions[bot]"
          git config user.email "github-actions[bot]@users.noreply.github.com"
          git add locales/
          git diff --staged --quiet || git commit -m "chore(i18n): sync translations"
          git push
```

## Estimation des coûts

Pour un projet avec 500 clés source sur 30 langues :

| Niveau | Langues | Méthode | Coût approximatif |
|------|-----------|--------|-----------------|
| Niveau 1 (5 langues) | ja, ko, zh, de, pt | GPT-4o | ~2,50 $/synchronisation complète |
| Niveau 2 (18 langues) | it, nl, pl, etc. | Google Translate | ~0,90 $/synchronisation complète |
| Niveau 3 (4 langues) | crk, oj, mi, haw | GPT-4o-mini encadré | ~0,40 $/synchronisation complète |
| **Total** | **30 langues** | **Mixte** | **~3,80 $/synchronisation complète** |

Les synchronisations incrémentielles (5–20 clés modifiées) coûtent une fraction d'une synchronisation complète.

## Voir aussi

- [Méthodes de traduction](/docs/guides/translation-methods) — Comment fonctionne chaque méthode de traduction et quand l'utiliser
- [Spécification du plugin](/docs/reference/plugin-spec) — Créer des données d'encadrement pour l'une de vos langues de Niveau 3
- [Guide CI/CD](/docs/guides/ci-cd) — Modèles CI avancés incluant les versions d'aperçu des PR
- [Portail de qualité](/docs/concepts/quality-gate) — Comment Champollion valide chaque traduction avant de l'écrire
- [Langues prises en charge](/docs/reference/supported-languages) — Liste complète des codes de langue et de la compatibilité des méthodes
- [Métriques de style d'écriture et de registre](/docs/network/specifications/harness#writing-style-and-register-metrics-informational) — Mesurer le respect du registre/style avec le harnais d'évaluation (métriques informatives)
- [Glossaire : registre](/glossary#term-register) — Ce que signifie « registre », en langage clair
- [Prendre en charge une langue à ressources limitées](/docs/network/community/low-resource-languages) — Ajouter des données d'encadrement pour les langues sans couverture MT large
