---
sidebar_position: 9
title: "Guide pratique : Évolutionnaire / Basé sur la recherche"
---

# Traduction Évolutionnaire / Basée sur la Recherche

> **L'idée :** Générer plusieurs traductions candidates, les évaluer par rapport à une fonction d'adaptation (chrF++, acceptation FST, cohérence aller-retour), muter les meilleurs performants, et répéter. Sélection naturelle pour les traductions — les plus aptes survivent.

:::info[Ceci est un cookbook, pas une implémentation finalisée]
Ceci est l'approche la plus expérimentale de la série de cookbooks. Elle n'a pas été éprouvée pour la traduction automatique à grande échelle, mais l'architecture est solide et le harness évaluera volontiers tout ce qu'elle produit.
:::

## Quand utiliser cette approche

- Vous disposez d'une **bonne fonction d'évaluation** mais aucun modèle unique ne produit des résultats cohérents
- Vous souhaitez **explorer l'espace des solutions** plus largement qu'une génération gloutonne unique
- Vous avez un **budget de calcul** pour de nombreuses générations parallèles (des dizaines de candidates par entrée)
- Vous êtes intéressé par la **recherche novatrice** — cette approche est peu explorée pour la TA en ressources limitées

## Comment cela fonctionne

```
[Generation 0]    Generate N candidates (different models, temperatures, prompts)
       │
       ▼
[Score]           Evaluate each candidate: chrF++, FST acceptance, fluency
       │
       ▼
[Select]          Keep top K performers
       │
       ▼
[Mutate]          Prompt an LLM: "improve this translation, fix these issues"
       │
       ▼
[Generation 1]    Score again. Repeat for G generations.
       │
       ▼
[Output]          Best-scoring candidate from final generation
```

## Squelette

```python
async def evolutionary_translate(source, reference=None, generations=3, pop_size=8):
    # Generation 0: diverse candidates
    population = []
    for model in ["gemini-2.5-pro", "gpt-4o", "claude-sonnet-4-6"]:
        for temp in [0.3, 0.7, 1.0]:
            candidate = await translate(source, model=model, temperature=temp)
            population.append(candidate)
    
    for gen in range(generations):
        # Score each candidate
        scored = [(c, score(c, reference)) for c in population]
        scored.sort(key=lambda x: x[1], reverse=True)
        
        # Select top K
        survivors = [c for c, s in scored[:pop_size // 2]]
        
        # Mutate: ask LLM to improve each survivor
        mutants = []
        for survivor in survivors:
            mutant = await improve(source, survivor, feedback=scored[0])
            mutants.append(mutant)
        
        population = survivors + mutants
    
    return max(population, key=lambda c: score(c, reference))
```

## Conception de la Fonction d'Adaptation

La fonction d'adaptation est essentielle. Options :

| Métrique | Ce qu'elle Mesure | Automatisée ? |
|----------|------------------|---------------|
| chrF++ par rapport à la référence | Similarité au niveau des caractères avec l'or | ✅ Oui |
| Taux d'acceptation FST | Validité morphologique | ✅ Oui (si FST disponible) |
| Cohérence aller-retour | La rétrotraduction récupère-t-elle la source ? | ✅ Oui |
| LLM-as-judge | Un autre LLM évalue la fluidité/exactitude | ✅ Oui (mais bruyant) |
| Présence de termes du dictionnaire | Les termes connus apparaissent-ils correctement ? | ✅ Oui |

:::tip[Combiner plusieurs signaux]
Une combinaison pondérée de métriques constitue une fonction de fitness plus robuste que n'importe quelle métrique isolée. Cela reflète le [score composite](/docs/network/leaderboard/rules) du harness lui-même.
:::

## Avantages et inconvénients

| | |
|---|---|
| ✅ Explore des solutions diverses | ❌ Coûteux en calcul (N × G appels API) |
| ✅ Peut découvrir des approches qu'aucun modèle unique ne trouve | ❌ Nécessite une bonne fonction d'adaptation |
| ✅ Parallélisable | ❌ Lent — plusieurs générations par traduction |
| ✅ Agnostique au modèle | ❌ Rendements décroissants après quelques générations |

## S'associe bien avec

- **[Modèles Chaînés](./chained-models)** — l'étape de mutation est une forme de chaînage
- **[Pipeline Contrôlé par FST](./fst-gated-pipeline)** — acceptation FST comme signal d'adaptation
- **[LLM Augmenté par Dictionnaire](./dictionary-augmented-llm)** — présence de termes du dictionnaire comme signal d'adaptation

## Voir aussi

- [Spécification de Carte d'Exécution](/docs/network/specifications/run-card) — le coût et la latence sont enregistrés par entrée
- [Harnais d'Évaluation](/docs/network/specifications/harness) — le harnais évalue votre résultat final, non votre processus
- [Supporter une Langue en Ressources Limitées](/docs/network/community/low-resource-languages)
