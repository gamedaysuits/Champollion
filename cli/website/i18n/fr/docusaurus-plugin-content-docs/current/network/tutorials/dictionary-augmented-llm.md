---
sidebar_position: 4
title: "Guide pratique : LLM augmenté par dictionnaire"
---

# LLM Augmenté par Dictionnaire

> **L'idée :** Imposer des traductions connues et vérifiées pour des termes spécifiques à partir d'un dictionnaire bilingue, et laisser le LLM gérer la structure des phrases et le vocabulaire inconnu. Le dictionnaire fournit des ancres de correction ; le LLM fournit la fluidité.

:::info[Ceci est un guide pratique, non une implémentation finalisée]
Ce guide esquisse l'approche. La stratégie spécifique d'appariement de dictionnaire et d'injection dépendra de votre paire de langues et des ressources lexicales disponibles.
:::

## Quand utiliser cette approche

- Un **dictionnaire bilingue existe** pour votre paire de langues (même un petit)
- Le LLM **hallucine régulièrement des termes clés** — invente des mots qui n'existent pas
- Vous avez besoin de **cohérence terminologique** dans les traductions (le même mot traduit de la même façon partout)
- Vous traduisez du **contenu spécialisé** où les traductions standard du LLM sont incorrectes (juridique, médical, éducatif)

## Comment ça fonctionne

1. **Charger un dictionnaire bilingue** — paires clé→valeur mappant les termes source aux traductions cibles vérifiées
2. **Appareiller le texte source au dictionnaire** — identifier les termes dans l'entrée qui ont des traductions connues
3. **Injecter les correspondances dans l'invite** — dire au LLM « ces termes DOIVENT être traduits comme suit »
4. **Le LLM génère la traduction** — avec les contraintes du dictionnaire comme exigences strictes
5. **Post-traitement** — vérifier que les termes du dictionnaire apparaissent dans la sortie ; réessayer s'ils ne le font pas

## Format du dictionnaire

```json title="dictionaries/crk-terms.json"
{
  "school": "kiskinwahamâtowikamik",
  "teacher": "okiskinwahamâkêw",
  "student": "kiskinwahamâkan",
  "book": "masinahikan",
  "home": "kīwēwin",
  "water": "nipiy"
}
```

## Structure de l'invite

```
Translate the following English to Plains Cree (SRO).

REQUIRED TERMINOLOGY — use these exact translations:
- "school" → "kiskinwahamâtowikamik"
- "teacher" → "okiskinwahamâkêw"

Source: "The teacher went to the school"
```

## Décisions de conception clés

**Stratégie d'appariement :** L'appariement exact est le plus simple. L'appariement lemmatisé (« teachers » correspond à « teacher ») en capture davantage mais nécessite un lemmatiseur de la langue source. L'appariement flou risque les faux positifs.

**Gestion de l'inflexion :** Dans les langues polysynthétiques, la forme du dictionnaire peut nécessiter une inflexion pour s'adapter à la phrase. Vous pouvez fournir la racine et laisser le LLM inflexionner, ou fournir plusieurs formes inflexionnées. Un [FST](./fst-gated-pipeline) peut valider le résultat.

**Résolution des conflits :** Que faire si le LLM ignore un terme du dictionnaire ? Options : (a) réessayer avec une instruction plus forte, (b) post-traiter par remplacement de chaîne, (c) accepter et signaler pour révision.

## Avantages et inconvénients

| | |
|---|---|
| ✅ Élimine l'hallucination pour les termes connus | ❌ La couverture du dictionnaire est toujours incomplète |
| ✅ Garantit la cohérence pour le vocabulaire clé | ❌ L'inflexion/conjugaison peut ne pas correspondre au contexte de la phrase |
| ✅ Facile à auditer et mettre à jour | ❌ Une sur-contrainte peut produire une sortie non naturelle |
| ✅ Le dictionnaire est un atout réutilisable | ❌ Nécessite qu'un dictionnaire existe en premier lieu |

## Où trouver des dictionnaires

- **[itwêwina](https://itwewina.altlab.app/)** — Plains Cree–Anglais (basé sur FST ; la plateforme morphodict est open source — le contenu du dictionnaire en lui-même n'est pas sous licence libre)
- **[Wolvengrey, *nêhiyawêwin: itwêwina / Cree: Words*](https://uofrpress.ca/Books/C/Cree-Words)** — ouvrage de référence exhaustif pour le Plains Cree (University of Regina Press)
- **[Apertium](https://www.apertium.org/)** — dictionnaires bilingues pour des dizaines de paires de langues
- **[Giellatekno](https://giellalt.github.io/)** — dictionnaires pour les langues Sámi, Uralic et autres langues minoritaires
- Glossaires créés par la communauté, supports pédagogiques, listes de termes

## S'associe bien avec

- **[Coached LLM Prompting](./coached-llm-prompting)** — les entrées du dictionnaire sont une forme de données de coaching
- **[FST-Gated Pipeline](./fst-gated-pipeline)** — FST valide que les termes du dictionnaire sont correctement inflexionnés
- **[Rule-Based + LLM Hybrid](./rule-based-hybrid)** — recherche déterministe dans le dictionnaire comme une couche de règles

## Voir aussi

- [Support a Low-Resource Language](/docs/network/community/low-resource-languages) — le contexte complet
- [Method Interface](/docs/network/specifications/methods) — comment les méthodes sont structurées
