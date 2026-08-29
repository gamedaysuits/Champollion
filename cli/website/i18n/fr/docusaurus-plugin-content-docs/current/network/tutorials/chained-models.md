---
sidebar_position: 6
title: "Guide pratique : Modèles chaînés"
---

# Modèles Chaînés (Pipeline Multi-Étapes)

> **L'idée :** Le modèle A génère une traduction brute → Le modèle B la post-édite → Le modèle C l'évalue ou la valide. Chaque étape se spécialise dans une tâche. La sortie du pipeline est meilleure que celle de n'importe quel modèle seul.

:::info[Ceci est un guide pratique, non une implémentation finalisée]
Ce guide esquisse l'architecture d'un pipeline multi-étapes. Les modèles spécifiques et la configuration de la chaîne dépendent de votre paire de langues et de votre budget.
:::

## Quand utiliser cette approche

- Un modèle unique produit une **qualité incohérente** — bonne sur certaines entrées, mauvaise sur d'autres
- Vous souhaitez **séparer la génération de la validation** — un modèle crée, un autre critique
- Vous disposez d'un budget pour **plusieurs appels API par traduction** (la latence et le coût augmentent linéairement avec les étapes)
- Vous souhaitez combiner des modèles aux **forces différentes** (par exemple, un générateur créatif + un éditeur précis)

## Comment cela fonctionne

```
Input ──→ [Stage 1: Generator] ──→ [Stage 2: Editor] ──→ [Stage 3: Validator] ──→ Output
              │                         │                        │
              │ "Translate this"        │ "Fix errors in         │ "Rate 1-5 and
              │                         │  this translation"     │  flag issues"
              ▼                         ▼                        ▼
         Raw translation          Polished translation      Score + accept/reject
```

## Exemple : Pipeline à Trois Étapes

```python
# Stage 1: Fast model generates candidate
raw = await fast_model.translate(source, target_lang="crk")

# Stage 2: Strong model post-edits
edited = await strong_model.complete(
    f"The following {target_lang} translation may contain errors. "
    f"Fix any grammatical or vocabulary mistakes:\n"
    f"Source: {source}\nTranslation: {raw}\nCorrected:"
)

# Stage 3: Validator model scores
score = await validator.complete(
    f"Rate this translation 1-5 for accuracy and fluency:\n"
    f"Source: {source}\nTranslation: {edited}\nScore:"
)

# Accept if score >= 3, otherwise retry Stage 1 with different temperature
```

## Motifs de Chaîne Courants

| Motif | Étapes | Cas d'Usage |
|---------|--------|----------|
| **Générer → Éditer** | LLM rapide → LLM puissant | Amélioration de la qualité rentable |
| **Générer → Valider → Réessayer** | LLM → FST/règles → LLM (réessai en cas d'échec) | Correction morphologique (voir [FST-Gated](./fst-gated-pipeline)) |
| **Générer → Rétro-traduire → Évaluer** | LLM(en→crk) → LLM(crk→en) → comparer | Vérification de cohérence aller-retour |
| **Ensemble → Vote** | 3 LLMs indépendamment → vote majoritaire | Robustesse par la diversité |

## Décisions de conception clés

**Budget de latence :** Chaque étape multiplie la latence. Une chaîne à 3 étapes avec 2s par étape = 6s par traduction. Pour l'évaluation par lot, c'est acceptable ; pour le temps réel, ce peut ne pas l'être.

**Multiplicateur de coût :** 3 étapes = 3× le coût API. Utilisez des modèles moins chers pour les étapes initiales, des modèles coûteux pour les étapes critiques.

**Propagation d'erreurs :** Une mauvaise sortie de l'étape 1 peut induire l'étape 2 en erreur. Incluez la source originale à chaque étape afin que les modèles ultérieurs puissent se rétablir.

## Avantages et inconvénients

| | |
|---|---|
| ✅ Peut combiner les forces des spécialistes | ❌ La latence et le coût se multiplient par étape |
| ✅ Séparation des préoccupations (génération vs. validation) | ❌ Complexe à déboguer — quelle étape a introduit l'erreur ? |
| ✅ Facile de remplacer des étapes individuelles | ❌ Propagation d'erreurs entre les étapes |
| ✅ La validation aller-retour détecte les hallucinations | ❌ Rendements décroissants au-delà de 2-3 étapes |

## S'associe bien avec

- **[FST-Gated Pipeline](./fst-gated-pipeline)** — FST comme étape de validation
- **[Dictionary-Augmented LLM](./dictionary-augmented-llm)** — injection de dictionnaire à l'étape de génération
- **[Coached LLM Prompting](./coached-llm-prompting)** — coaching dans une ou plusieurs étapes

## Voir aussi

- [Eval Harness](/docs/network/specifications/harness) — le harnais mesure la sortie du pipeline de bout en bout
- [Run Card Specification](/docs/network/specifications/run-card) — la latence et le coût sont enregistrés par entrée
- [Support a Low-Resource Language](/docs/network/community/low-resource-languages)
