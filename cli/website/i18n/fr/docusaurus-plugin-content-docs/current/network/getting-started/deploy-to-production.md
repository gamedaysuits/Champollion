---
sidebar_position: 5
title: "Déployer en production"
description: "Adoptez une méthode éprouvée du réseau et déployez-la via Champollion."
---

# Déployer en Production

Vous avez prouvé que cela fonctionne dans le Réseau. Maintenant, déployez-le.

Le Réseau est destiné à la R&D — construction, benchmarking et comparaison des méthodes de traduction. **Le déploiement en production** s'effectue via [champollion](https://champollion.dev), l'outil CLI destiné aux développeurs. Ils se connectent via un format de plugin partagé.

```mermaid
graph LR
    A["Network\n(benchmark)"] -->|"method.json\n+ coaching data"| B["champollion\n(production)"]
    B -->|"Speaker feedback\nimproves the method"| A
```

---

## Le Chemin du Déploiement

### 1. Exporter Votre Méthode en tant que Plugin

Créez un manifeste `method.json` qui empaquette vos résultats de benchmarking :

```json
{
  "name": "crk-coached-v3",
  "type": "llm-coached",
  "version": "3.0.0",
  "description": "Coached LLM translation for Plains Cree",
  "locales": ["crk"],
  "config": {
    "model": "google/gemini-2.5-flash",
    "temperature": 0.3
  },
  "benchmarks": {
    "crk": {
      "composite_score": 0.67,
      "fst_acceptance": 0.82,
      "corpus_size": 150
    }
  }
}
```

Incluez toute donnée de coaching (règles grammaticales, dictionnaires) aux côtés du manifeste.

### 2. Installer dans Champollion

```bash
champollion plugin install ./my-method-plugin/
```

### 3. Configurer Votre Paire

```json title="champollion.config.json"
{
  "pairs": {
    "en-crk": { "method": "plugin", "plugin": "crk-coached-v3" }
  }
}
```

### 4. Traduire du Contenu Réel

```bash
npx champollion sync
```

Votre méthode benchmarkée produit maintenant des traductions réelles en production.

---

## Pour les Langues Autochtones

Les méthodes au service des communautés linguistiques autochtones exigent le **consentement de la communauté** avant le déploiement en production. Les principes autochtones de souveraineté des données — la propriété et le contrôle communautaires des données linguistiques — régissent la manière dont les méthodes de traduction sont développées, évaluées et déployées.

Une méthode qui atteint le niveau Déployable (0,70+) ne se déploie pas automatiquement — elle se déploie **si et seulement si** l'organe de gouvernance de la communauté linguistique donne son consentement.

Consultez [Souveraineté des Données](/docs/network/sovereignty/data-sovereignty) et [Transfert de Propriété](/docs/network/sovereignty/ownership-transfer) pour le cadre de gouvernance complet.

---

## Voir aussi

- [Le Pont du Harnais d'Évaluation](https://champollion.dev/docs/guides/bridge) — présentation détaillée du pipeline Réseau→champollion
- [Spécification du Plugin](https://champollion.dev/docs/reference/plugin-spec) — le format du manifeste method.json
- [Guide de l'Agent Champollion](https://champollion.dev/docs/guides/agent-guide) — comment utiliser champollion pour la traduction

