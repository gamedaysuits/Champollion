---
sidebar_position: 8
title: "Guide pratique : Augmentation par rétrotraduction"
---

# Augmentation par Rétro-traduction

> **L'idée :** Générer des données parallèles synthétiques en traduisant le texte existant en langue cible vers la langue source, puis utiliser ces paires synthétiques pour entraîner ou guider un modèle direct. Cela élargit votre corpus parallèle à faible coût — mais avec des réserves concernant la qualité.

:::info[Ceci est un guide pratique, non une implémentation finalisée]
Ce guide esquisse la stratégie et ses pièges critiques. La rétrotraduction est puissante mais peut amplifier les erreurs si elle n'est pas effectuée avec soin.
:::

## Quand utiliser cette approche

- Vous disposez de **texte monolingue en langue cible** mais de données parallèles limitées
- Vous souhaitez **élargir un corpus d'entraînement** pour l'[ajustement fin](./fine-tuned-model) sans traduction manuelle
- Vous avez besoin de **plus d'exemples few-shot** mais ne pouvez pas obtenir de traductions humaines assez rapidement
- Vous êtes disposé à **filtrer la qualité** des données synthétiques de manière agressive

## Comment cela fonctionne

```
[Target-language text]          "awâsisak mêtawêwak"
        │
        ▼
[Back-translate to source]      "The children are playing"  (via LLM or MT API)
        │
        ▼
[Create synthetic pair]         ("The children are playing", "awâsisak mêtawêwak")
        │
        ▼
[Quality filter]                Keep only high-confidence pairs
        │
        ▼
[Use for training/prompting]    Expand your parallel corpus
```

1. **Collecter du texte monolingue** — livres, articles, transcriptions et médias sociaux en langue cible
2. **Rétro-traduire** — utiliser un LLM ou une API de traduction automatique pour traduire chaque phrase vers la langue source
3. **Filtrer la qualité** — effectuer une traduction aller-retour (traduire à nouveau) et comparer ; conserver les paires où l'aller-retour ≈ original
4. **Utiliser le corpus synthétique** — pour l'ajustement fin, les exemples few-shot ou les données de coaching

## Filtrage de la qualité : le test aller-retour

```python
# Pseudo-code for round-trip quality filtering
for target_text in monolingual_corpus:
    # Back-translate: target → source
    synthetic_source = translate(target_text, "crk", "en")
    
    # Forward-translate: source → target
    round_trip = translate(synthetic_source, "en", "crk")
    
    # Compare round-trip to original
    chrf_score = compute_chrf(target_text, round_trip)
    
    if chrf_score > 0.70:  # High similarity = high-quality pair
        parallel_corpus.append((synthetic_source, target_text))
```

## Piège critique : amplification des erreurs

:::warning[La rétrotraduction amplifie les biais existants du modèle]
Si votre modèle de rétrotraduction commet systématiquement les mêmes erreurs, votre corpus synthétique encodera ces erreurs comme « correctes ». Cela crée une boucle de rétroaction : entraînement sur de mauvaises données → production de traductions plus mauvaises → génération de données synthétiques plus mauvaises. **Filtrez toujours la qualité de manière agressive** et mélangez les données synthétiques avec des traductions humaines vérifiées.
:::

## Où trouver du texte monolingue

- Infolettres communautaires, journaux et publications
- Documents gouvernementaux en langue cible (p. ex., Hansard du Nunavut pour l'inuktitut)
- Matériel pédagogique et manuels scolaires
- Textes religieux (largement disponibles pour de nombreuses langues)
- Médias sociaux (avec les autorisations appropriées et filtrage de qualité)
- Audio/vidéo transcrits provenant de programmes linguistiques

## Avantages et inconvénients

| | |
|---|---|
| ✅ Élargit les données d'entraînement à faible coût | ❌ Amplifie les erreurs du modèle s'il n'est pas filtré |
| ✅ Utilise du texte monolingue abondant | ❌ Plafond de qualité limité par le modèle de rétro-traduction |
| ✅ Facile à générer à grande échelle | ❌ Le filtrage aller-retour est intensif en calcul |
| ✅ Complète d'autres approches | ❌ Les données synthétiques ne sont jamais aussi bonnes que la traduction humaine |

## S'associe bien avec

- **[Modèle ajusté fin](./fine-tuned-model)** — la rétro-traduction crée des données d'entraînement pour l'ajustement fin
- **[Création de corpus](./corpus-creation)** — les données synthétiques complètent les corpus créés manuellement
- **[Coaching de LLM par invite](./coached-llm-prompting)** — les exemples synthétiques peuvent informer les dictionnaires de coaching

## Voir aussi

- [Ensembles de données d'évaluation](/docs/network/leaderboard/datasets) — les données synthétiques ne doivent pas chevaucher les données d'évaluation
- [Règles du classement](/docs/network/leaderboard/rules) — politique de contamination
- [Soutenir une langue peu dotée en ressources](/docs/network/community/low-resource-languages)
