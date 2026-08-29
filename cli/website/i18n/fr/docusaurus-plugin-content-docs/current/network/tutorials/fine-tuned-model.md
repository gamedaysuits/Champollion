---
sidebar_position: 5
title: "Guide pratique : Modèle ajusté"
---

# Modèle Affiné

> **L'idée :** Affiner un modèle à poids ouvert (Llama, Mistral, Gemma) sur du texte parallèle pour votre paire de langues cible. Potentiellement le plafond de qualité le plus élevé, mais nécessite des données parallèles qui peuvent être rares — et les règles de contamination des données d'évaluation sont strictes.

:::info[Ceci est un guide pratique, non une implémentation finalisée]
Ce guide décrit l'approche, les exigences en matière de données et les pièges potentiels. L'infrastructure d'entraînement réelle sort du cadre de ce harness.
:::

## Quand utiliser cette approche

- Vous avez accès à un **corpus parallèle** (des centaines à des milliers de paires de phrases) qui est **complètement indépendant** de l'ensemble de données d'évaluation
- Vous avez un **accès GPU** pour l'entraînement (matériel local, cloud ou cluster de calcul universitaire)
- Vous souhaitez le **plafond de qualité le plus élevé** pour une paire de langues spécifique et êtes disposé à investir dans l'entraînement
- D'autres approches (incitation guidée, few-shot) ont atteint un plateau de qualité

## Comment cela fonctionne

1. **Assembler les données parallèles** — paires de phrases source-cible provenant de sources indépendantes (manuels scolaires, archives communautaires, dossiers du Hansard, textes religieux, matériels éducatifs)
2. **Préparer le format d'entraînement** — format d'instruction-tuning (invite système + entrée + sortie attendue)
3. **Affiner** — LoRA/QLoRA sur un modèle de base (la quantification 4-bit rend cela réalisable sur des GPU grand public)
4. **Évaluer avec le harnais** — exécuter le modèle affiné via le harnais d'évaluation
5. **Itérer** — ajuster les données d'entraînement, les hyperparamètres, la sélection du modèle de base

## Exigences en matière de données

| Taille du corpus | À quoi s'attendre |
|---|---|
| 50–200 paires | Amélioration marginale par rapport au zero-shot ; risque de surapprentissage |
| 200–1 000 paires | Amélioration notable du style et de la terminologie |
| 1 000–5 000 paires | Gains de qualité significatifs pour la paire de langues spécifique |
| 5 000+ paires | Approche du plafond de qualité du modèle de base |

:::danger[Contamination des données d'évaluation = disqualification]
Vos données d'entraînement NE DOIVENT PAS chevaucher l'ensemble de données d'évaluation. Ni les phrases, ni la liste de vocabulaire, ni les paraphrases du même contenu. Le harness génère une empreinte de vos résultats ; le chevauchement statistique est détectable. Si vous doutez qu'une source de données soit indépendante, privilégiez l'exclusion. Consultez [Règles du Leaderboard](/docs/network/leaderboard/rules).
:::

## Squelette : Affinage LoRA

```python
# Conceptual skeleton — adapt to your framework (HuggingFace, Axolotl, etc.)

# 1. Format your parallel data as instruction pairs
training_data = [
    {"instruction": "Translate to Plains Cree (SRO)", 
     "input": "The children are playing",
     "output": "awâsisak mêtawêwak"},
    # ... hundreds more
]

# 2. Fine-tune with LoRA (4-bit for consumer GPUs)
# Base model: meta-llama/Llama-3.1-8B, google/gemma-2-9b, etc.
# Rank: 16–64, Alpha: 32–128, Epochs: 3–5

# 3. Export and serve via the harness TranslationMethod protocol
```

## Où trouver des données parallèles

- **Archives communautaires** — matériels éducatifs, documents gouvernementaux, publications bilingues
- **Hansard du Nunavut** — 1,3 M paires alignées anglais-inuktitut (RNC Canada)
- **Traductions bibliques** — disponibles pour de nombreuses langues peu dotées en ressources, mais spécifiques au domaine
- **Manuels scolaires** — souvent bilingues dans les contextes d'apprentissage des langues
- **Créer le vôtre** — voir [Guide de Création de Corpus](./corpus-creation)

## Avantages et inconvénients

| | |
|---|---|
| ✅ Plafond de qualité le plus élevé | ❌ Nécessite des données parallèles (rares pour les LRL) |
| ✅ Le modèle apprend les motifs spécifiques à la langue | ❌ Coûts GPU (bien que LoRA aide) |
| ✅ Peut surpasser les approches incitées | ❌ Risque de surapprentissage avec de petits ensembles de données |
| ✅ Coût d'entraînement unique, puis inférence bon marché | ❌ Règles strictes de contamination d'évaluation |

## S'associe bien avec

- **[Création de Corpus](./corpus-creation)** — construire les données d'entraînement dont vous avez besoin
- **[Rétrotraduction](./back-translation)** — élargir votre corpus parallèle synthétiquement
- **[Pipeline Contrôlé par FST](./fst-gated-pipeline)** — modèle affiné + validation morphologique
- **[Incitation Guidée d'LLM](./coached-llm-prompting)** — incitation guidée sur un modèle de base affiné

## Voir aussi

- [Ensembles de Données d'Évaluation](/docs/network/leaderboard/datasets) — sachez ce que vous NE POUVEZ PAS utiliser pour l'entraînement
- [Règles du Classement](/docs/network/leaderboard/rules) — politique de contamination
- [Soutenir une Langue Peu Dotée en Ressources](/docs/network/community/low-resource-languages)
