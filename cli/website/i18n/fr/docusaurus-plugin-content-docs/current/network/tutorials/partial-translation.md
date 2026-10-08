---
sidebar_position: 10
title: "Guide pratique : Traduction partielle (humaine + automatisée)"
---

# Traduction Partielle (Humaine + Machine)

> **L'idée :** Traduire manuellement un échantillon représentatif, prouver que votre méthode machine correspond au style humain sur cet échantillon, puis traduire automatiquement le reste en masse. Combine la qualité humaine avec l'échelle machine — l'humain établit la norme, la machine la suit.

:::info[Ceci est un recueil de recettes, non une implémentation finalisée]
Ce guide esquisse le flux de travail hybride humain-machine. Il est particulièrement pertinent pour les agences de traduction, les travailleurs en langues communautaires et les contextes éducatifs.
:::

## Quand utiliser cette approche

- Vous avez **accès à des locuteurs courants** mais leur temps est limité
- Vous devez traduire un **grand volume** mais seule une petite portion doit être parfaite
- Vous souhaitez **établir une ligne de base de qualité** avec la traduction humaine, puis l'étendre avec la TA
- Vous travaillez dans un **contexte éducatif ou communautaire** où l'examen humain d'un sous-ensemble est réalisable

## Comment cela fonctionne

```
[Full corpus: 1,000 entries]
        │
        ├── [100 entries] ──→ Human translator ──→ Gold translations
        │                                              │
        │                                              ▼
        │                                    Train / prompt machine
        │                                    method to match style
        │                                              │
        └── [900 entries] ──→ Machine method ──→ Auto translations
                                                       │
                                                       ▼
                                              [Optional: human review
                                               of flagged entries]
```

1. **Sélectionnez un échantillon représentatif** — couvrez différents types de phrases, longueurs et sujets
2. **Traduisez l'échantillon manuellement** — établissez la norme de référence pour le style, le registre et la terminologie
3. **Configurez votre méthode machine** — utilisez les traductions humaines comme données d'entraînement, exemples few-shot ou données de fine-tuning
4. **Évaluez la machine sur l'échantillon humain** — la machine correspond-elle au style de l'humain ?
5. **Traduisez automatiquement le reste** — si la qualité machine est acceptable sur l'échantillon
6. **Examen humain optionnel** — signalez les résultats à faible confiance pour examen par un locuteur

## Assurance Qualité : Le Test de Correspondance de Style

```bash
# Translate the human-translated sample with your machine method
mt-eval run \
  --corpus data/human-sample.json \
  --name coached-v3

# Compare: does the machine match the human translator's choices?
# Look at: chrF++ (similarity), FST acceptance (validity),
# and qualitative patterns (register, formality, terminology)
```

## Sélection de l'Échantillon

**Couvrez la distribution.** Vos 100 entrées doivent inclure :
- Des phrases courtes (1–3 mots) et des phrases complètes
- Du vocabulaire courant et des termes spécifiques au domaine
- Des structures simples et complexes
- Plusieurs caractéristiques grammaticales (questions, impératifs, conditionnels)

**Ne sélectionnez pas uniquement les faciles.** L'échantillon doit inclure les entrées avec lesquelles votre méthode risque de rencontrer des difficultés — c'est là que la qualité humaine compte le plus.

## Le Flux de Travail d'Examen Communautaire

Pour les communautés de langues autochtones, cette approche respecte le temps des locuteurs :

1. **Le locuteur traduit 50–100 entrées** (2–4 heures de travail concentré)
2. **La machine traduit les 900 restantes** en utilisant le travail du locuteur comme données d'entraînement
3. **Le locuteur examine les entrées signalées** — uniquement celles pour lesquelles la machine avait le moins confiance (encore 1–2 heures)
4. **Résultat :** 1 000 traductions de qualité quasi-humaine, avec ~5 heures de temps du locuteur au lieu de ~50

## Avantages et inconvénients

| | |
|---|---|
| ✅ Combine la qualité humaine avec l'échelle machine | ❌ Nécessite un investissement humain initial |
| ✅ Respecte la disponibilité limitée des locuteurs | ❌ La machine peut ne pas capturer toutes les nuances stylistiques |
| ✅ Flux de travail d'assurance qualité naturel | ❌ Goulot d'étranglement d'examen humain pour les entrées signalées |
| ✅ Excellent pour les contextes communautaires/éducatifs | ❌ La sélection de l'échantillon affecte la qualité globale |

## S'associe bien avec

- **[Coached LLM Prompting](./coached-llm-prompting)** — les traductions humaines informent les données d'entraînement
- **[Few-Shot Prompting](./few-shot-prompting)** — traductions humaines comme exemples en contexte
- **[Corpus Creation](./corpus-creation)** — l'échantillon humain EST la création de corpus

## Voir aussi

- [For Language Communities](/docs/network/community/for-language-communities) — modèle d'engagement communautaire
- [Data Sovereignty](/docs/network/sovereignty/data-sovereignty) — propriété des données de traduction
- [Support a Low-Resource Language](/docs/network/community/low-resource-languages)
