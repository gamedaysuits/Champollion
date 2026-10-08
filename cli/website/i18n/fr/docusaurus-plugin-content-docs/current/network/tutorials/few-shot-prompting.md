---
sidebar_position: 3
title: "Guide pratique : Prompting avec peu d'exemples"
---

# Incitation par quelques exemples

> **L'idée :** Inclure des paires de traduction vérifiées et de haute qualité comme exemples en contexte afin que le modèle de langage apprenne les motifs, le style et les conventions de la langue cible par démonstration plutôt que par instruction.

:::info[Ceci est un recueil de recettes, non une implémentation finalisée]
Ce guide esquisse l'approche et ses principales décisions de conception. Adaptez-le à votre paire linguistique et aux ressources disponibles.
:::

## Quand utiliser cette approche

- Vous disposez d'un **petit ensemble de traductions vérifiées** (même 5–10 paires de référence aident)
- Vous souhaitez que le modèle de langage corresponde à un **style ou registre spécifique** par l'exemple plutôt que par la règle
- Votre langue cible présente des motifs qui sont **plus faciles à montrer qu'à décrire** (ordre des mots, motifs d'affixation, marqueurs de formalité)

## Comment cela fonctionne

1. **Sélectionner les paires d'exemples** — choisir des traductions source→cible de haute qualité qui démontrent les motifs clés
2. **Formater comme exemples en contexte** — les inclure dans l'invite système ou utilisateur avant la demande de traduction réelle
3. **Exécuter le banc d'essai** — mesurer si les exemples améliorent les métriques par rapport à l'approche sans exemples
4. **Itérer sur la sélection d'exemples** — remplacer les exemples pour couvrir différents modes de défaillance

## Structure d'invite exemple

```
You are translating English to Plains Cree (SRO orthography).

Examples of correct translations:
- "Hello" → "tânisi"
- "Thank you" → "kinanâskomitin"  
- "I am going home" → "nikîwân"
- "The children are playing" → "awâsisak mêtawêwak"

Now translate the following:
- "Welcome to the school"
```

## Règle critique : Pas de contamination des données d'évaluation

:::danger[N'UTILISEZ PAS les données d'évaluation comme exemples few-shot]
Si vos exemples proviennent de l'ensemble de données d'évaluation, votre méthode sera **disqualifiée** du classement. Les exemples few-shot doivent provenir de sources indépendantes — dictionnaires, manuels, paires vérifiées par la communauté, ou un ensemble de développement distinct. Le système d'exécution crée une empreinte digitale de votre invite exacte ; la contamination est détectable.
:::

## Décisions de conception clés

**Combien d'exemples ?** 3–8 est le point optimal. Moins donne au modèle de langage trop peu de signal ; plus consomme la fenêtre de contexte pour des rendements décroissants.

**Quels exemples ?** Privilégier la diversité à la difficulté. Couvrir différentes structures de phrases, longueurs de mots et caractéristiques grammaticales. Ne pas regrouper les exemples autour d'un seul motif.

**Sélection statique ou dynamique ?** Les exemples statiques sont plus simples. La sélection dynamique (choisir des exemples similaires à l'entrée actuelle) peut améliorer la qualité mais ajoute de la complexité — envisagez les [modèles chaînés](./chained-models) pour l'étape de récupération.

## Avantages et inconvénients

| | |
|---|---|
| ✅ Puissant pour l'adaptation de style | ❌ La petite fenêtre de contexte limite le nombre d'exemples |
| ✅ Aucun entraînement requis | ❌ La sélection d'exemples est un art, pas une science |
| ✅ Fonctionne avec n'importe quel modèle de langage | ❌ Risque de contamination des données d'évaluation (disqualification) |
| ✅ Facile à tester A/B différents ensembles d'exemples | ❌ Les exemples peuvent ne pas se généraliser à tous les types d'entrée |

## S'associe bien avec

- **[Incitation de modèle de langage encadré](./coached-llm-prompting)** — les règles + les exemples ensemble surpassent l'un ou l'autre seul
- **[Modèle de langage augmenté par dictionnaire](./dictionary-augmented-llm)** — termes forcés + exemples de style
- **[Pipeline contrôlé par FST](./fst-gated-pipeline)** — exemples pour le style, FST pour la correction morphologique

## Voir aussi

- [Règles d'évaluation MT](/docs/network/leaderboard/rules) — ce qui est disqualifié
- [Ensembles de données d'évaluation](/docs/network/leaderboard/datasets) — savoir ce que vous NE POUVEZ PAS utiliser comme exemples
- [Soutenir une langue peu dotée en ressources](/docs/network/community/low-resource-languages)
