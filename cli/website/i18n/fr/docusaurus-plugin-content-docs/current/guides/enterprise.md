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
    "en:ja": { "method": "llm", "model": "google/gemini-3.1-pro-preview" },
    "en:de": { "method": "google-translate" },
    "en:ko": { "method": "llm", "register": "polite-haeyo" },
    "en:es": { "method": "api", "endpoint": "https://review.your-lsp.example/mtpe" },
    "en:crk": { "method": "llm-coached" }
  }
}
```

Le français utilise DeepL (votre équipe préfère son naturel européen). Le japonais utilise un LLM de pointe. L'allemand utilise Google Translate (rapide, économique, suffisant). Le coréen utilise un LLM avec un registre formel. L'espagnol est acheminé vers un service professionnel de traduction humaine / MTPE via la méthode `api` — la traduction humaine est ici une méthode de premier ordre, et non un simple module d'appoint. Le cri des plaines utilise la méthode de LLM guidé (*coached LLM*), avec des notes grammaticales et un dictionnaire que vous fournissez.

**Même commande. Même pipeline CI. Différentes méthodes par paire — humaine ou automatisée. Un seul fichier de configuration.**

:::note[Les méthodes pour les langues communautaires sont souveraines]
La paire du cri des plaines ci-dessus n'est pas une simple paire parmi d'autres. Les méthodes destinées aux langues autochtones et autres langues communautaires sont **détenues et régies par la communauté** : celle-ci détient les clés des données sous-jacentes, fixe les conditions d'utilisation, et tout corpus ou méthode non commercial (NC) est exclu par défaut des circuits commerciaux. Si votre usage est commercial, vérifiez la licence de la méthode avant de la déployer en production. Voir [Souveraineté des données](/docs/network/sovereignty/data-sovereignty).
:::

## Le Workflow Leaderboard → Deploy

:::tip[`champollion network leaderboard` est inclus avec le CLI]
Le flux de travail ci-dessous s'exécute à l'aide de la commande `champollion network leaderboard` — parcourez le classement du [Network](/arena) depuis votre terminal et installez directement le plugin d'une méthode. Consultez la [référence du CLI](/docs/reference/cli#leaderboard) pour découvrir toutes les options.
:::

Le [Network](/arena) est le lieu où les méthodes de traduction sont évaluées selon des scores reproductibles et assortis d'une empreinte unique (*fingerprinted*). Les exécutions sont classées selon les standards du domaine de la traduction automatique : par le score chrF++ au niveau du corpus avec son intervalle de confiance à 95 %. Les scores BLEU, TER et COMET sont affichés en parallèle, et les diagnostics tels que la correspondance exacte et l'acceptation FST sont rapportés séparément, sans jamais être amalgamés au résultat principal. La supériorité réelle d'une méthode sur une autre repose sur un test de significativité par paires, et non sur un simple écart entre deux nombres. Le classement répertorie chaque soumission.

Le flux de travail :

```bash
# Browse the leaderboard from your terminal
npx champollion network leaderboard --pair "eng>fra"

# Output (abridged):
#   #   Model         chrF++ [95% CI]      BLEU   …   EM     FST
#   1   gemini-3.5    72.3 [70.8, 73.7]    48.1   …   0.31   —
#   2   deepl         70.9 [69.2, 72.4]    46.0   …   0.29   —
#   3   claude-4      68.4 [66.9, 70.0]    43.7   …   0.27   —
#   Headline: chrF++ with its 95% bootstrap CI; rows whose intervals overlap are not distinguishable.

# Install the method that fits as a plugin (by its rank)
npx champollion network leaderboard --install 1

# Use it
npx champollion sync
```

*À titre indicatif uniquement — les lignes du tableau de classement ci-dessus représentent un exemple de présentation. Dans cet exemple, les intervalles des deux premières lignes se chevauchent, ce qui signifie que le tableau n'indique pas qu'une méthode est meilleure que l'autre. Le tableau est actuellement ouvert aux soumissions et ne comporte encore aucune exécution publiée.*

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
# In your CI pipeline — pinned to the 0.5 line, so a new release never
# changes what the pipeline runs (the CI guide has the complete workflow)
npx --yes champollion@0.5 lint        # Catch hardcoded strings
npx --yes champollion@0.5 sync        # Translate what changed
npx --yes champollion@0.5 audit       # Fail if any locale is incomplete
npx --yes champollion@0.5 integrity   # Validate placeholder consistency
```

Trois commandes. Zéro traduction manuelle. Le pipeline détecte les chaînes codées en dur, les traduit avec vos méthodes choisies, et échoue la construction si quelque chose manque ou est corrompu.

### 5. Révision professionnelle (optionnel)

Pour le contenu critique, exportez en XLIFF pour révision humaine :

```bash
npx champollion xliff export --locale ja --out translations.xliff
# → Send to your translation agency
# → Import corrections back:
npx champollion xliff import translations.xliff
```

Traduisez automatiquement le gros volume. Révisez humainement les chemins critiques. Payez pour le temps humain uniquement où cela compte.

## Modèle de coût

champollion ne comporte **aucun abonnement ni tarification par utilisateur**. Le CLI est disponible en accès source sous licence PolyForm Noncommercial 1.0.0 — gratuit pour un usage non commercial : recherche, éducation, organisations caritatives, hôpitaux et cliniques publics, administrations publiques, projets personnels. Une utilisation à des fins commerciales, telle que le produit d'une entreprise à but lucratif, n'est pas couverte par cette licence. Vérifiez [qui peut utiliser cet outil](/docs/getting-started/who-may-use-this) avant de l'adopter. Au-delà, vous ne payez que les appels d'API de traduction :

| Volume | Google Translate | LLM (Gemini Flash) | LLM (GPT-4o) |
|--------|-----------------|---------------------|---------------|
| 1 000 clés × 5 locales | ~$0,50 | ~$0,30 (niveau gratuit) | ~$2,00 |
| 10 000 clés × 15 locales | ~$15 | ~$8 | ~$60 |
| 50 000 clés × 30 locales | ~$75 | ~$40 | ~$300 |

La mémoire de traduction signifie que vous payez uniquement pour les **clés modifiées** lors des synchronisations ultérieures. Si vous mettez à jour 10 chaînes sur 10 000, vous payez pour 10 traductions, pas 10 000.

## vs. Plateformes TMS

| | champollion | Crowdin / Phrase / Locize |
|---|---|---|
| **Tarification** | Gratuit pour un usage non commercial ([qui peut utiliser cet outil](/docs/getting-started/who-may-use-this)) + coûts d'API | 50 $ à 500 $/mois + par utilisateur |
| **Dépendance vis-à-vis du fournisseur** | Aucune — changez de fournisseur dans la configuration | Élevée — données dans leur cloud |
| **Choix de la méthode** | N'importe quel fournisseur, n'importe quel modèle, par paire | Selon leur offre |
| **CI/CD** | De premier ordre (`lint → sync → audit`) | Plugin / webhook |
| **Méthodes personnalisées** | Système de plugins, plugins communautaires | Non pris en charge |
| **Contrôle qualité** | Intégré (système d'écriture incorrect, répétition mot à mot, longueur) | Variable |
| **Auto-hébergé** | Oui (LibreTranslate, API personnalisée) | Non |

Voir la [comparaison complète](/docs/guides/comparison) pour les détails.

## Lectures complémentaires

- **[Quick Start](/docs/getting-started/quick-start)** — exécutez votre première synchronisation en 60 secondes
- **[Translation Methods](/docs/guides/translation-methods)** — le menu complet des méthodes avec arbre de décision
- **[CI/CD Integration](/docs/guides/ci-cd)** — automatisez dans votre pipeline
- **[Working with Professional Translators](/docs/guides/professional-translators)** — export/import XLIFF
- **[the Network](/arena)** — benchmark et leaderboard
- **[Configuration Reference](/docs/getting-started/configuration)** — chaque option de configuration
