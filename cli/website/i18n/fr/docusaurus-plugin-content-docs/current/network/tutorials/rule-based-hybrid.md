---
sidebar_position: 7
title: "Guide pratique : Hybride basé sur des règles + LLM"
---

# Hybride basé sur des règles + LLM

> **L'idée :** Utiliser des règles linguistiques déterministes pour les motifs dont vous savez qu'ils sont corrects (affixation morphologique, formatage des nombres, structures de phrases connues), et laisser le LLM gérer la traduction créative pour tout le reste. Les règles remplacent le LLM là où elles s'appliquent ; le LLM comble les lacunes.

:::info[Ceci est un guide pratique, non une implémentation finalisée]
Ce guide esquisse l'architecture hybride. Les règles spécifiques dépendent entièrement de la grammaire de votre langue cible et des ressources linguistiques disponibles.
:::

## Quand utiliser cette approche

- Vous disposez d'une **expertise linguistique approfondie** dans la langue cible (ou d'accès à un linguiste)
- Certains motifs de traduction sont **déterministes** — vous connaissez la sortie correcte avec certitude
- Le LLM **échoue régulièrement** sur des motifs spécifiques (formatage des nombres, honorifiques, agglutination)
- Vous souhaitez **garantir la correction** pour les motifs critiques tout en maintenant la fluidité pour le reste

## Comment cela fonctionne

```
Input ──→ [Rule Engine] ──→ [LLM] ──→ [Merge] ──→ Output
              │                │           │
              │ Known patterns │ Unknown    │ Rules override
              │ handled here   │ parts      │ LLM where both
              ▼                ▼            ▼ produced output
         Deterministic     Creative     Final translation
         fragments         translation
```

1. **Définir les règles** — motifs regex, recherches FST, tables de correspondance pour les traductions connues
2. **Pré-traiter** — identifier et extraire les segments correspondant aux règles de la source
3. **Traduire avec le LLM** — le texte restant, avec les sorties des règles comme contraintes
4. **Fusionner** — réassembler la traduction, en privilégiant la sortie des règles si disponible
5. **Valider** — vérification optionnelle FST/règle sur le résultat fusionné

## Exemple : Règles pour les nombres et les dates

```python
import re

# Rule: Numbers stay as-is (don't let the LLM hallucinate number translations)
def rule_preserve_numbers(text):
    return re.sub(r'\b\d+\b', lambda m: f'__NUM_{m.group()}__', text)

# Rule: Known greetings have exact translations
GREETING_RULES = {
    "hello": "tânisi",
    "goodbye": "êkosi",
    "thank you": "kinanâskomitin",
}

# Rule: Date format conversion
def rule_date_format(text):
    # "January 15" → "kisê-pîsim 15" (deterministic month mapping)
    ...
```

## Décisions de conception clés

**Priorité des règles :** Quand une règle et le LLM produisent tous deux une sortie pour le même segment, lequel gagne ? Les règles doivent gagner pour les motifs **critiques pour la correction**. Le LLM doit gagner pour les motifs **critiques pour la fluidité**.

**Granularité :** Règles au niveau des mots (recherche dans un dictionnaire) vs. règles au niveau des phrases (mappage d'idiomes) vs. règles structurelles (réorganisation de phrases). Commencez au niveau des mots ; ajoutez le niveau des phrases à mesure que vous identifiez des motifs.

**Maintenance des règles :** Chaque règle est une obligation de maintenance. Préférez un petit ensemble de règles de haute confiance à un grand ensemble de règles approximatives. Si vous n'êtes pas certain qu'une règle est correcte, laissez-la au LLM.

## Avantages et inconvénients

| | |
|---|---|
| ✅ Correction garantie là où les règles s'appliquent | ❌ Nécessite une expertise linguistique approfondie |
| ✅ Transparent — les règles sont lisibles et vérifiables | ❌ La jonction règle/LLM peut produire une sortie peu naturelle |
| ✅ Les règles sont rapides (pas de coût d'API) | ❌ La charge de maintenance augmente avec le nombre de règles |
| ✅ Progressif — ajoutez des règles au fur et à mesure que vous apprenez | ❌ Difficile de gérer l'inflexion aux limites des règles |

## S'associe bien avec

- **[Pipeline contrôlé par FST](./fst-gated-pipeline)** — FST comme un type spécifique de moteur de règles
- **[LLM augmenté par dictionnaire](./dictionary-augmented-llm)** — la recherche dans un dictionnaire est une règle simple
- **[Incitation du LLM coaché](./coached-llm-prompting)** — le coaching gère les préférences souples, les règles gèrent les exigences strictes

## Voir aussi

- [GiellaLT](https://giellalt.github.io/) — infrastructure FST open-source pour plus de 100 langues
- [Apertium](https://www.apertium.org/) — plateforme de traduction automatique basée sur des règles avec dictionnaires bilingues
- [Soutenir une langue peu dotée en ressources](/docs/network/community/low-resource-languages)
