---
sidebar_position: 2
title: "Guide pratique : Prompting d'LLM avec assistance"
related:
  - label: "Cookbook: Few-Shot Prompting"
    to: /docs/network/tutorials/few-shot-prompting
    kind: cookbook
  - label: "Cookbook: Fine-Tuned Model"
    to: /docs/network/tutorials/fine-tuned-model
    kind: cookbook
  - label: "Coaching Data"
    to: https://champollion.dev/docs/concepts/coaching-data
    kind: champollion
    note: "How coaching data ships to production"
  - label: "Submit a Method"
    to: /docs/network/getting-started/submit-a-method
    kind: guide
---

# Guidage des modèles de langage par invite

> **L'idée :** Injecter des règles de grammaire, des dictionnaires bilingues et des notes de style directement dans l'invite système du modèle de langage. Pas d'entraînement, pas d'ajustement fin — simplement des connaissances linguistiques structurées qui orientent la sortie vers des traductions valides.

:::info[Ceci est un recueil de recettes, non une implémentation finalisée]
Ce guide esquisse l'approche et ses principales décisions de conception. Adaptez-le à votre paire de langues, aux ressources disponibles et à vos objectifs d'évaluation.
:::

## Quand utiliser cette approche

- Vous disposez de **connaissances linguistiques** sur la langue cible (règles de grammaire, entrées de dictionnaire, préférences de style) mais pas assez de données parallèles pour l'ajustement fin
- Vous souhaitez **itérer rapidement** — les modifications d'invite se déploient en secondes, sans réentraînement
- La langue cible présente des **motifs connus** que le modèle de langage traite mal (accord en genre, conventions d'écriture, niveaux de formalité)
- Vous souhaitez comparer le guidage par invite à une ligne de base et itérer sur ce qui fonctionne

## Comment cela fonctionne

1. **Assembler les données de guidage** — règles de grammaire, dictionnaire bilingue et notes de style dans un fichier JSON structuré
2. **Configurer le registre** — un préfixe d'invite système qui définit la langue, l'écriture et le ton
3. **Exécuter le harnais** — les données de guidage sont injectées dans chaque invite du modèle de langage
4. **Examiner les défaillances** — regardez ce que la porte de qualité rejette, ajoutez des règles pour traiter les motifs
5. **Itérer** — chaque révision du fichier de guidage est une nouvelle expérience ; le harnais les suit toutes

## Structure des données de guidage

```json title="coaching/<locale>.json"
{
  "grammar_rules": [
    "Adjectives agree in gender and number with the noun they modify",
    "Use formal register (vous) for all UI text",
    "Preserve interpolation variables exactly: {{name}}, {count}"
  ],
  "dictionary": {
    "dashboard": "tableau de bord",
    "settings": "paramètres",
    "deploy": "déployer"
  },
  "style_notes": "Prefer active voice. Avoid anglicisms where a native term exists. Keep sentences concise for UI readability."
}
```

## Décisions de conception clés

**Spécificité des règles vs. fenêtre de contexte :** Plus de règles donnent au modèle de langage plus de conseils, mais consomment la fenêtre de contexte disponible pour la traduction réelle. Commencez par 5 à 10 règles à fort impact et n'en ajoutez d'autres que lorsque vous observez des motifs d'échec spécifiques.

**Couverture du dictionnaire :** Vous n'avez pas besoin d'un dictionnaire complet — concentrez-vous sur les termes que le modèle de langage traite systématiquement mal. Même 20 à 30 termes forcés peuvent améliorer considérablement la cohérence.

**L'ordre des règles compte :** Placez les règles les plus importantes en premier. Les modèles de langage accordent plus d'attention aux instructions précoces.

## Exécution d'une expérience

```bash
mt-eval run \
  --corpus eval-amh-fra-globalvoices-test-v1 \
  --model google/gemini-2.5-pro \
  --name coached-v1 \
  --coaching-file coaching/crk.json
```

## Avantages et inconvénients

| | |
|---|---|
| ✅ Coût d'entraînement nul | ❌ Plafond de qualité limité par les connaissances de base du modèle de langage |
| ✅ Itération instantanée (modifier l'invite → réexécuter) | ❌ Les limites de la fenêtre de contexte restreignent la quantité de guidage possible |
| ✅ Fonctionne avec n'importe quel fournisseur de modèle de langage | ❌ Les règles peuvent entrer en conflit — déboguer les interactions d'invite est un art |
| ✅ Transparent — vous pouvez lire exactement ce que le modèle de langage voit | ❌ Ne crée pas de nouvelles connaissances, oriente seulement les connaissances existantes |

## S'associe bien avec

- **[FST-Gated Pipeline](./fst-gated-pipeline)** — le guidage + la validation morphologique capture ce que le guidage seul manque
- **[Dictionary-Augmented LLM](./dictionary-augmented-llm)** — la terminologie forcée est une forme de guidage
- **[Few-Shot Prompting](./few-shot-prompting)** — les exemples + les règles ensemble sont plus puissants que l'un ou l'autre seul

## Voir aussi

- [Method Interface](/docs/network/specifications/methods) — format des données de guidage et protocole TranslationMethod
- [Support a Low-Resource Language](/docs/network/community/low-resource-languages) — le contexte complet
- [Eval Harness](/docs/network/specifications/harness) — comment exécuter des expériences
