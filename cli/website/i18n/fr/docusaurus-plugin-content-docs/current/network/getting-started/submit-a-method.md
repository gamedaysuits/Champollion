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
python3 -m pip install mt-eval-harness
```

---

## Étape 1 : Exécuter le Harnais

Le harnais évalue votre méthode par rapport à un ensemble de données standardisé :

```bash
mt-eval run \
  --corpus eval-amh-fra-globalvoices-test-v1 \
  --model google/gemini-3.1-pro-preview \
  --name your-method-name \
  --temperature 0.2
```

| Option | Description |
|---|---|
| `--corpus` | Chemin du fichier de corpus ou identifiant de corpus enregistré (`.json`, `.jsonl`, `.tsv`) |
| `--model` | Slug exact du modèle — l'identifiant OpenRouter complet (par ex. `google/gemini-3.1-pro-preview`) ; les alias courts et les identifiants flottants (`…-latest`) sont refusés. Avec `--method <plugin dir>`, le modèle transmis à votre plugin en tant que `config.method_model` (selon la nomenclature utilisée par votre plugin) |
| `-n, --name` | Libellé lisible pour votre exécution (apparaît sur le classement) |
| `--temperature` | Température d'échantillonnage (plus basse = plus déterministe) |
| `--fst-retries` | Facultatif : nombre de tentatives de nouvel essai FST |
| `--publish` | Publier la fiche d'exécution sur le classement une fois l'exécution terminée |

Le harnais produit une **carte d'exécution** — un fichier JSON autonome contenant vos scores, le hash de l'ensemble de données, le slug du modèle et une empreinte cryptographique reliant les résultats à la configuration exacte de l'expérience.

---

## Étape 2 : Examiner Votre Carte d'Exécution

Chaque exécution écrit deux fichiers dans `eval/logs/harness/` : le journal d'exécution `<run-id>.json`
et le rapport évalué `<run-id>_report.json`. Le rapport est ce que vous publiez.
Inspectez-le d'abord :

```bash
python -m json.tool eval/logs/harness/<run-id>_report.json | less
```

Champs clés du bloc `overall` du rapport :
- `corpus_chrf` — chrF++ au niveau du corpus (0–100), la métrique principale et de
  classement. Son IC bootstrap à 95 % est `confidence_intervals.corpus_chrf` et sa
  signature sacreBLEU est `sacrebleu_signatures.chrf`
- `scoring_standard` (`"standard/1"`) et `primary_metric`
  (`"chrf_plus_plus"`) — la norme selon laquelle le rapport a été évalué
- `corpus_bleu`, `corpus_spbleu`, `corpus_ter` — les autres métriques standard,
  présentées aux côtés de chrF++ et jamais mélangées avec celle-ci
- `exact_match_rate` — un indicateur de diagnostic : la proportion de traductions parfaites
- `confidence_intervals` — intervalles de bootstrap pour les métriques ci-dessus
- `total_cost_usd` — le coût de l'exécution (`null` lorsque le modèle n'a pas de
  tarif publié, par ex. un modèle local ; jamais rapporté sous la valeur 0 $)

Le rapport consigne également ce qui a été transmis au modèle, sous la forme d'un pointeur
(`instructions` : le nom et le SHA-256 du fichier de guidage, le SHA-256 du prompt
système, ainsi que l'emplacement du texte complet, à savoir le journal d'exécution sur votre machine). La fiche
d'exécution transmise au classement est assemblée à partir de ce rapport. Elle y ajoute la
fiche de méthode et l'empreinte de reproductibilité, et s'ouvre sur les mêmes valeurs de
chrF++ et d'IC ; ses champs `composite` et `quality_tier` valent `null`, car tous deux sont
[obsolètes](/docs/network/specifications/scoring#how-runs-are-scored). (Un rapport
généré avant la norme peut comporter un `published_composite` ; il s'agit d'un score composite
hérité, devenu obsolète, et qui n'est jamais comparé à chrF++.)
`mt-eval publish <report> --dry-run` affiche la fiche exactement telle qu'elle serait
publiée. Consultez la [Spécification de la fiche d'exécution](/docs/network/specifications/run-card)
pour en connaître le schéma.

---

## Étape 3 : Soumettre

La publication écrit sur le classement **en direct**, elle nécessite donc un
`--prod` explicite — sans lui, le banc d'évaluation refuse et vous en informe. Prévisualisez d'abord :

```bash
# See exactly what would be uploaded (no sign-in, no network)
mt-eval publish eval/logs/harness/<run-id>_report.json --dry-run

# Publish (opens a browser sign-in the first time; add --anonymous to skip it)
mt-eval publish eval/logs/harness/<run-id>_report.json --prod
```

Pour publier directement depuis une exécution, ajoutez `--publish --prod` à `mt-eval run`. Si l'étape
de publication échoue, les scores de l'exécution restent enregistrés et le banc d'évaluation affiche la
commande exacte pour réessayer. Définir `MT_EVAL_ALLOW_PROD=1` dans l'environnement est l'équivalent
de `--prod` pour les scripts.

:::note[L'API de soumission et le téléversement web ne sont pas encore opérationnels]
Un point de terminaison `POST https://champollion.dev/api/leaderboard/submit` et une
interface de téléversement vers le classement sont prévus mais **pas encore implémentés**. D'ici leur déploiement,
la seule voie de soumission fonctionnelle est `mt-eval publish` (il n'y a pas
d'admission par pull request).
:::

---

## Ce qui se passe ensuite

1. Votre soumission est validée (hachage du jeu de données, intégrité de la fiche d'exécution)
2. Les résultats apparaissent sur le classement avec la mention **Auto-évalué** (niveau de confiance 1)
3. Pour obtenir le statut **Vérifié par Champollion**, soumettez votre méthode sous forme de plugin installable afin que les mainteneurs puissent reproduire vos résultats
4. Pour les méthodes dédiées aux langues autochtones : si votre méthode atteint la première place, le processus de [transfert de propriété](/docs/network/sovereignty/ownership-transfer) commence

---

## Voir aussi

- [Utilisation du Harnais](/docs/network/specifications/harness) — référence CLI complète
- [Règles du Classement](/docs/network/leaderboard/rules) — critères de soumission et politiques anti-triche
- [Construire une Méthode](/docs/network/specifications/methods) — le protocole TranslationMethod
- [Ensembles de Données](/docs/network/leaderboard/datasets) — ensembles de données d'évaluation disponibles
