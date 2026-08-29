---
sidebar_position: 1
title: "Soumettre une méthode"
related:
  - label: "Method Interface"
    to: /docs/network/specifications/methods
    kind: spec
    note: "The contract your method implements"
  - label: "Run Card Specification"
    to: /docs/network/specifications/run-card
    kind: spec
    note: "What every published run must disclose"
  - label: "MT Evaluation Rules"
    to: /docs/network/leaderboard/rules
    kind: doc
  - label: "Cookbook: Few-Shot Prompting"
    to: /docs/network/tutorials/few-shot-prompting
    kind: cookbook
    note: "The fastest first method to submit"
  - label: "Agent Guide: Building & Benchmarking on the Network"
    to: /docs/network/getting-started/agent-guide
    kind: guide
---

# Soumettre une Méthode

> **Résumé exécutif.** Un guide étape par étape pour soumettre votre première exécution de benchmark au classement. Installez le harnais, exécutez-le sur un ensemble de données, examinez votre carte d'exécution et publiez. Prend 10 minutes si vous disposez d'une clé API.

Ce guide vous accompagne dans la soumission de votre première exécution de benchmark au classement du Réseau.

---

## Prérequis

- **Python 3.11+**
- **Une clé API OpenRouter** (ou équivalent pour votre fournisseur de modèle)
- **Une méthode de traduction** — tout ce qui produit des traductions à partir d'un texte source

```bash
# Install the eval harness (provides the `mt-eval` command)
pip install mt-eval-harness
```

---

## Étape 1 : Exécuter le Harnais

Le harnais évalue votre méthode par rapport à un ensemble de données standardisé :

```bash
mt-eval run \
  --corpus eval-amh-fra-globalvoices-test-v1 \
  --model gemini-pro \
  --name your-method-name \
  --temperature 0.2
```

| Drapeau | Ce qu'il fait |
|---|---|
| `--corpus` | Chemin du fichier corpus ou identifiant corpus enregistré (`.json`, `.jsonl`, `.tsv`) |
| `--model` | Slug du modèle — alias court (p. ex. `gemini-pro`) ou identifiant OpenRouter complet |
| `-n, --name` | Étiquette lisible pour votre exécution (apparaît sur le classement) |
| `--temperature` | Température d'échantillonnage (plus bas = plus déterministe) |
| `--fst-retries` | Optionnel : nombre de tentatives de réessai FST |
| `--publish` | Publier la carte d'exécution sur le classement à la fin de l'exécution |

Le harnais produit une **carte d'exécution** — un fichier JSON autonome contenant vos scores, le hash de l'ensemble de données, le slug du modèle et une empreinte cryptographique reliant les résultats à la configuration exacte de l'expérience.

---

## Étape 2 : Examiner Votre Carte d'Exécution

Les cartes d'exécution sont enregistrées dans `eval/logs/harness/`. Inspectez la vôtre avant de la soumettre :

```bash
cat eval/logs/harness/your-run-card.json | python -m json.tool
```

Champs clés à vérifier :
- `scores.chrf_plus_plus` — votre métrique de qualité principale
- `scores.exact_match_rate` — proportion de traductions parfaites
- `scores.fst_acceptance_rate` — validité morphologique (si FST a été utilisé)
- `totals.total_cost_usd` — le coût de l'exécution
- `fingerprint` — le hash de reproductibilité de l'expérience

Consultez la [Spécification de Carte d'Exécution](/docs/network/specifications/run-card) pour le schéma complet.

---

## Étape 3 : Soumettre

### Publication automatique

Si vous avez passé `--publish` lors de l'exécution du harnais, votre carte d'exécution a déjà été téléchargée.

### Publication manuelle

Publiez n'importe quelle carte d'exécution avec le harnais :

```bash
mt-eval publish eval/logs/harness/your-run-card.json
```

Si vous préférez ne pas utiliser le flux de publication, ouvrez une demande de tirage contre le
[référentiel du harnais d'évaluation](https://github.com/gamedaysuits/Champollion)
avec votre JSON de carte d'exécution dans le répertoire `results/`.

:::note[L'API de soumission et le téléchargement web ne sont pas encore en ligne]
Un point de terminaison `POST https://champollion.dev/api/leaderboard/submit` et une
interface utilisateur de téléchargement du Leaderboard sont prévus mais **pas encore implémentés**. En attendant leur lancement,
les seuls chemins de soumission fonctionnels sont `mt-eval publish` et une demande de tirage vers
le référentiel de harnais ci-dessus.
:::

---

## Ce qui se passe ensuite

1. Votre soumission est validée (hachage du jeu de données, intégrité de la fiche d'exécution)
2. Les résultats apparaissent dans le classement sous la mention **Auto-évalué** (niveau de confiance 1)
3. Pour obtenir le statut **Champollion Verified**, soumettez votre méthode sous forme de plugin installable afin que les mainteneurs puissent reproduire vos résultats
4. Pour les méthodes concernant les langues autochtones : si votre méthode atteint le haut du classement, le processus de [transfert de propriété](/docs/network/sovereignty/ownership-transfer) commence

---

## Voir aussi

- [Utilisation du Harnais](/docs/network/specifications/harness) — référence CLI complète
- [Règles du Classement](/docs/network/leaderboard/rules) — critères de soumission et politiques anti-triche
- [Construire une Méthode](/docs/network/specifications/methods) — le protocole TranslationMethod
- [Ensembles de Données](/docs/network/leaderboard/datasets) — ensembles de données d'évaluation disponibles
