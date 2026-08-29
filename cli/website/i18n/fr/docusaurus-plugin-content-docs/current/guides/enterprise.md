---
sidebar_position: 7
title: "Pour les Entreprises"
description: "Comment les organisations peuvent standardiser la traduction avec des méthodes éprouvées par classement, des plugins personnalisés et un déploiement en une seule commande."
---

# champollion pour l'Entreprise

Votre équipe traduit du contenu régulièrement. Vous disposez d'une pile de fichiers de locale, d'un pipeline CI, et d'un processus qui implique probablement que quelqu'un exécute manuellement Google Translate, copie les résultats dans JSON, et croise les doigts. Ou vous payez une plateforme TMS où vous êtes verrouillé dans le moteur de traduction d'un seul fournisseur.

champollion vous offre une option plus sereine : choisissez la bonne méthode pour chaque langue — automatisée ou humaine — et exécutez-les toutes via une seule commande.

## Pourquoi les équipes utilisent champollion

1. **Choisissez la bonne méthode pour chaque langue** — automatisée ou humaine, pas ce que votre fournisseur propose par défaut
2. **Déployez avec une seule commande** — `npx champollion sync` traduit chaque locale, chaque format, à chaque fois
3. **Changez de méthode sans modifier le code** — un changement de configuration, pas une migration
4. **Maîtrisez votre pipeline** — pas de verrouillage fournisseur, pas de tableaux de bord mensuels, pas de comptes

```json title="champollion.config.json"
{
  "version": 3,
  "pairs": {
    "en:fr": { "method": "deepl" },
    "en:ja": { "method": "llm", "model": "google/gemini-2.5-pro" },
    "en:de": { "method": "google-translate" },
    "en:ko": { "method": "llm", "register": "polite-haeyo" },
    "en:es": { "method": "api", "endpoint": "https://review.your-lsp.example/mtpe" },
    "en:crk": { "methodPlugin": "crk-coached-v3" }
  }
}
```

Le français utilise DeepL (votre équipe préfère sa fluidité européenne). Le japonais utilise un LLM de pointe. L'allemand utilise Google Translate (rapide, bon marché, suffisamment bon). Le coréen utilise un LLM avec un registre formel. L'espagnol est acheminé vers un service de traduction humaine professionnelle / MTPE via la méthode `api` — la traduction humaine est une méthode de première classe ici, pas un ajout. Le cri des Plaines utilise un plugin construit et possédé par la communauté.

**Même commande. Même pipeline CI. Différentes méthodes par paire — humaine ou automatisée. Un seul fichier de configuration.**

:::note[Les méthodes pour les langues communautaires sont souveraines]
Le plugin Plains Cree ci-dessus n'est pas simplement « une autre méthode ». Les méthodes pour les langues autochtones et autres langues communautaires sont **détenues et gouvernées par la communauté** : la communauté détient les clés des données qui les sous-tendent, définit les conditions d'utilisation, et tout corpus ou méthode non commercial (NC) est par défaut séparé des voies commerciales. Si votre utilisation est commerciale, vérifiez la licence de la méthode avant de la déployer. Voir [Data Sovereignty](/docs/network/sovereignty/data-sovereignty).
:::

## Le Workflow Leaderboard → Deploy

:::tip[`champollion leaderboard` est fourni avec la CLI]
Le flux de travail ci-dessous s'exécute sur la commande `champollion leaderboard` — parcourez le classement du [Réseau](/arena) depuis votre terminal et installez un plugin de méthode directement à partir de celui-ci. Consultez la [référence de la CLI](/docs/reference/cli#leaderboard) pour toutes les options.
:::

Le [Network](/arena) est l'endroit où les méthodes de traduction sont évaluées avec un scoring reproductible et empreinte numérique. Chaque méthode obtient un score composite sur plusieurs métriques (chrF++, correspondance exacte, acceptation FST, scoring sémantique). Le leaderboard suit chaque soumission.

Le flux de travail :

```bash
# Browse the leaderboard from your terminal
npx champollion leaderboard --pair en:crk

# Output:
# ┌──────┬───────────────────────┬────────────┬──────────┬───────────┐
# │ Rank │ Method                │ Model      │ chrF++   │ Composite │
# ├──────┼───────────────────────┼────────────┼──────────┼───────────┤
# │  1   │ crk-coached-v3        │ gemini-2.5 │ 43.2     │ 0.67      │
# │  2   │ fst-gated-pipeline    │ gpt-4o     │ 41.8     │ 0.63      │
# │  3   │ prompt-baseline       │ claude-4   │ 38.1     │ 0.55      │
# └──────┴───────────────────────┴────────────┴──────────┴───────────┘

# Install the method that fits as a plugin
npx champollion leaderboard --install crk-coached-v3

# Use it
npx champollion sync
```

*À titre illustratif uniquement — les lignes du leaderboard ci-dessus sont un exemple de disposition. Le tableau est actuellement ouvert aux soumissions et n'a pas encore de résultats publiés.*

**Vous ne construisez pas la méthode. Vous n'entraînez pas le modèle. Vous choisissez la méthode qui correspond à votre domaine, votre budget et votre licence — humaine ou automatisée — et vous la déployez.** Si une meilleure méthode apparaît le mois prochain, vous la remplacez avec une seule commande.

## Ce qui est disponible aujourd'hui

Le pont leaderboard-vers-CLI est en développement. Voici ce qui fonctionne maintenant :

### Méthodes intégrées (aucun plugin nécessaire)

| Méthode | Idéale pour | Coût |
|---------|------------|------|
| `llm` (par défaut) | Qualité prioritaire, toute langue | Par jeton via OpenRouter |
| `gemini` | Qualité + niveau gratuit | Gratuit (limité), puis par jeton |
| `google-translate` | Vitesse + volume | $20/M caractères |
| `deepl` | Langues européennes | $25/M caractères |
| `llm-coached` | Langues avec données d'entraînement | Par jeton via OpenRouter |
| `api` | Méthodes personnalisées/auto-hébergées | Auto-hébergé |

### Méthodes par plugin (installation séparée)

Les plugins personnalisés peuvent encapsuler n'importe quelle logique de traduction — un modèle affiné, un pipeline contrôlé par FST, une API communautaire, ou n'importe quoi d'autre qui produit du JSON. Voir [Build a Plugin](/docs/tutorials/build-a-plugin).

## Workflow Entreprise

### 1. Évaluez votre qualité actuelle

```bash
# See what you're getting today
npx champollion status

# Output shows: method per pair, cache hit rate, quality gate stats
```

### 2. Exécutez le harnais d'évaluation sur les candidats

Le [harnais d'évaluation](/docs/network/specifications/harness) vous permet de comparer plusieurs méthodes sur le même ensemble de données. Exécutez un balayage, comparez les scores, choisissez les gagnants :

```bash
# In the eval harness repo
python -m mt_eval_harness.run \
  --methods coached-v3 baseline prompt-tuned \
  --dataset data/your-corpus.json
```

### 3. Configurez les gagnants par paire

Mettez à jour votre configuration pour utiliser la meilleure méthode par paire de langues. Différentes langues ont différentes meilleures méthodes — c'est le point.

### 4. Intégrez dans CI/CD

```bash
# In your CI pipeline
npx champollion lint        # Catch hardcoded strings
npx champollion sync        # Translate what changed
npx champollion audit       # Fail if any locale is incomplete
npx champollion integrity   # Validate placeholder consistency
```

Trois commandes. Zéro traduction manuelle. Le pipeline détecte les chaînes codées en dur, les traduit avec vos méthodes choisies, et échoue la construction si quelque chose manque ou est corrompu.

### 5. Révision professionnelle (optionnel)

Pour le contenu critique, exportez en XLIFF pour révision humaine :

```bash
npx champollion xliff export --locale ja --output translations.xliff
# → Send to your translation agency
# → Import corrections back:
npx champollion xliff import translations.xliff
```

Traduisez automatiquement le gros volume. Révisez humainement les chemins critiques. Payez pour le temps humain uniquement où cela compte.

## Modèle de coût

champollion n'a **aucun abonnement et aucune tarification par utilisateur**. Le code source de la CLI est disponible sous la licence PolyForm Noncommercial 1.0.0 — gratuit pour un usage non commercial (recherche, éducation, travail communautaire) ; l'utilisation commerciale nécessite une autorisation, alors [contactez-nous](/get-involved) au préalable. Au-delà de cela, vous ne payez que pour les appels à l'API de traduction :

| Volume | Google Translate | LLM (Gemini Flash) | LLM (GPT-4o) |
|--------|-----------------|---------------------|---------------|
| 1 000 clés × 5 locales | ~$0,50 | ~$0,30 (niveau gratuit) | ~$2,00 |
| 10 000 clés × 15 locales | ~$15 | ~$8 | ~$60 |
| 50 000 clés × 30 locales | ~$75 | ~$40 | ~$300 |

La mémoire de traduction signifie que vous payez uniquement pour les **clés modifiées** lors des synchronisations ultérieures. Si vous mettez à jour 10 chaînes sur 10 000, vous payez pour 10 traductions, pas 10 000.

## vs. Plateformes TMS

| | champollion | Crowdin / Phrase / Locize |
|---|---|---|
| **Tarification** | Gratuit pour un usage non commercial (commercial sur autorisation) + coûts d'API | 50 $–500 $/mois + par utilisateur |
| **Dépendance au fournisseur** | Aucune — changez de fournisseur dans la configuration | Élevée — données dans leur cloud |
| **Choix de la méthode** | N'importe quel fournisseur, n'importe quel modèle, par paire | Ce qu'ils proposent |
| **CI/CD** | De premier ordre (`lint → sync → audit`) | Plugin/webhook |
| **Méthodes personnalisées** | Système de plugins, plugins communautaires | Non pris en charge |
| **Contrôle qualité** | Intégré (script incorrect, écho, longueur) | Variable |
| **Auto-hébergé** | Oui (LibreTranslate, API personnalisée) | Non |

Voir la [comparaison complète](/docs/guides/comparison) pour les détails.

## Lectures complémentaires

- **[Quick Start](/docs/getting-started/quick-start)** — exécutez votre première synchronisation en 60 secondes
- **[Translation Methods](/docs/guides/translation-methods)** — le menu complet des méthodes avec arbre de décision
- **[CI/CD Integration](/docs/guides/ci-cd)** — automatisez dans votre pipeline
- **[Working with Professional Translators](/docs/guides/professional-translators)** — export/import XLIFF
- **[the Network](/arena)** — benchmark et leaderboard
- **[Configuration Reference](/docs/getting-started/configuration)** — chaque option de configuration
