---
sidebar_position: 3
title: "Du benchmark à l'utilisation quotidienne : le parcours de post-édition"
slug: '/network/perspectives/from-benchmark-to-daily-use'
description: "Comment une méthode de traduction évaluée devient un flux de travail de traduction communautaire : brouillon automatisé, post-édition par locuteur·rice fluide, texte publié — avec des seuils de qualité honnêtes à chaque étape."
related:
  - label: "Deploy to Production"
    to: /docs/network/getting-started/deploy-to-production
    kind: guide
    note: "From proven method to live translation"
  - label: "Cookbook: Partial Translation (Human + Machine)"
    to: /docs/network/tutorials/partial-translation
    kind: cookbook
  - label: "Scoring Specification"
    to: /docs/network/specifications/scoring
    kind: spec
    note: "The quality thresholds behind the path"
  - label: "Translation Is Not Revitalization"
    to: /docs/network/perspectives/translation-is-not-revitalization
    kind: position
---

# Du benchmark à l'utilisation quotidienne : le chemin de la post-édition

> **La version courte.** Un score au classement n'est pas un produit. Le chemin qui va de « cette méthode obtient un score de 0,78 » à « le bureau de bande publie des documents dans la langue chaque semaine » passe par exactement un flux de travail : la machine produit un brouillon, un locuteur courant le corrige, et seul le texte corrigé est publié. Chaque seuil de qualité dans nos spécifications est calibré pour ce flux de travail — non pour la sortie machine non supervisée, que nous n'endossons pour aucune langue sur cette plateforme.

Les gens demandent parfois quand une méthode de traduction sera « assez bonne pour être utilisée simplement ». Pour les langues que ce Réseau sert, cette question contient un piège. La réponse honnête est que le seuil qui vaut la peine d'être visé n'est pas « assez bon pour publier sans révision » — c'est **« assez bon pour que réviser un brouillon soit mieux que traduire à partir de zéro »**. Ce seuil est beaucoup plus bas, il est mesurable, et le franchir change ce qu'un bureau de traduction communautaire peut produire en une semaine.

---

## Le flux de travail, de bout en bout

```
 English source document
        │
        ▼
 Machine draft  ←  a benchmarked, community-owned method
        │
        ▼
 Fluent-speaker post-edit  ←  the human gate; nothing skips it
        │
        ▼
 Published text  ←  carries human approval, not a machine score
        │
        ▼
 (Optional, community-controlled) corrections become
 data that improves the next version of the method
```

Trois choses à remarquer :

1. **La machine ne publie jamais.** L'unité de sortie est un brouillon. La passe de correction du locuteur n'est pas une assurance qualité ajoutée à la fin — c'est le flux de travail.
2. **Le temps du locuteur est la ressource en cours d'optimisation.** Une méthode est meilleure qu'une autre méthode exactement dans la mesure où elle laisse moins à corriger au locuteur. La recherche sur la post-édition pour les langues bien dotées en ressources constate régulièrement que c'est plus rapide que de traduire à partir de zéro à une qualité TA modérée (Plitt & Masselot 2010 ; Green, Heer & Manning 2013, tous deux cités avec des liens dans [Translation Is Not Revitalization](/docs/network/perspectives/translation-is-not-revitalization)). Que cela s'applique aux langues polysynthétiques est précisément ce que le benchmark existe pour découvrir — nous le traitons comme une hypothèse à vérifier par langue, non comme une hypothèse.
3. **La boucle de rétroaction est possédée.** Chaque document corrigé est un potentiel d'entraînement et de données de coaching — et il appartient à la communauté, pour être réinjecté (ou non) selon ses conditions en vertu des règles de [souveraineté des données](/docs/network/sovereignty/data-sovereignty). Le mécanisme de rétroaction est un objectif de conception de la plateforme, pas encore une fonctionnalité construite ; voir [Reporting Errors and Owning Corrections](/docs/network/perspectives/reporting-errors-and-owning-corrections) pour savoir comment les corrections et la provenance sont censées fonctionner.

## Ce que les niveaux de qualité signifient pour l'utilisation réelle

Le classement évalue les méthodes sur un composite de métriques automatisées ([Scoring Specification](/docs/network/specifications/scoring)), et les scores correspondent à des niveaux nommés. Voici la traduction honnête de ces niveaux en termes d'utilisation quotidienne :

| Niveau (composite) | Ce que cela signifie pour le chemin de la post-édition |
|---|---|
| **Baseline** (0,00–0,30) | Non utilisable pour quoi que ce soit. La sortie n'est largement pas la langue cible. Utile uniquement comme plancher de recherche. |
| **Emerging** (0,30–0,50) | Toujours pas un outil de brouillon. Des fragments corrects apparaissent, mais un locuteur passerait plus de temps à corriger qu'à écrire à partir de zéro. |
| **Functional** (0,50–0,70) | Le premier niveau où la post-édition *pourrait* battre la traduction à partir de zéro pour les textes faciles — vaut la peine de tester avec un locuteur, pas la peine de dépendre. Des erreurs morphologiques fréquentes subsistent. |
| **Deployable** (0,70–0,85) | Le niveau cible pour le flux de travail ci-dessus : des brouillons où la plupart de la morphologie est correcte et un locuteur courant peut corriger significativement plus vite que de retraduire. **« Deployable » signifie déployable *dans un flux de travail de post-édition* — jamais « publier sans révision »**. |
| **Fluent** (0,85–1,00) | S'approchant d'une traduction humaine compétente ; les erreurs sont rares et mineures. La passe de révision reste — elle devient juste plus rapide. |

Deux règles d'honnêteté structurelle se situent au-dessus de ce tableau, directement issues de la [Benchmark Specification §5 et §7](/docs/network/specifications/benchmark#5-quality-tiers) :

- **Les niveaux automatisés sont des étiquettes provisoires, pas des verdicts.** Ce sont des nominations pour examen humain. Les seuils seront recalibrés à mesure que les données de validation des locuteurs s'accumulent, et ils peuvent être différents pour différentes langues.
- **Aucune méthode ne peut prétendre à Deployable ou supérieur sans révision communautaire.** Un échantillon stratifié de sa sortie va à des locuteurs bilingues, qui évaluent chaque traduction *rejeter / gist / acceptable / excellent*. L'organisation de gouvernance — pas le classement — décide si la méthode progresse.

À titre de comparaison, le seuil du [Founder's Prize](/docs/network/specifications/prizes) (composite ≥ 0,80, ≥99 % de mots morphologiquement valides, ≥70 % de locuteurs évalués acceptable-ou-mieux) décrit une méthode dont les erreurs restantes sont des *erreurs de langue réelle* — mauvaise inflexion, pas des mots fabriqués. C'est ce que « un brouillon qui vaut le temps d'un locuteur » ressemble en chiffres.

## D'une méthode gagnante à un bureau fonctionnel

Supposons qu'une méthode franchisse ces portes. Les étapes restantes sont organisationnelles, et elles sont spécifiées plutôt qu'improvisées :

1. **La propriété est transférée.** Le code de la méthode devient la propriété de l'organisation de gouvernance de la communauté — le développeur conserve les droits d'attribution et de publication ([Ownership Transfer](/docs/network/sovereignty/ownership-transfer)).
2. **La méthode devient un service — le service de la communauté.** Elle est emballée en tant que plugin que l'organisation de gouvernance peut exécuter sur sa propre infrastructure, contrôlant l'accès et les utilisations autorisées ([Deploy to Production](/docs/network/getting-started/deploy-to-production)). Si la communauté choisit de l'offrir commercialement, c'est son affaire à tous les égards — Champollion ne prend aucune part ([How the Work Is Funded](/docs/network/sovereignty/economic-model)).
3. **Les traducteurs l'intègrent dans leur journée.** Un bureau de traduction pointe son flux de travail de document existant vers l'API de la méthode : texte source en, brouillon en sortie, post-édition, publication. Le texte publié porte le nom et l'autorité du traducteur — la machine est un outil sur son bureau, comme un dictionnaire.

## Où cela en est aujourd'hui

Clairement : le chemin complet est spécifié de bout en bout, et partiellement construit. Le harnais d'évaluation, les métriques, les fiches de course et le classement public existent ; le corpus de développement des Cris des Plaines et un prix actif existent ; la plateforme de déploiement existe. L'interface d'examen communautaire, le bac à sable d'évaluation et la boucle de rétroaction du texte corrigé sont spécifiés mais pas encore opérationnels — les spécifications les marquent comme prévus, et nous aussi. Aucune méthode n'a encore complété l'ensemble du voyage du benchmark à l'utilisation quotidienne communautaire. Ce voyage est la définition du succès du projet, ce qui est exactement pourquoi nous ne le revendiquerons pas prématurément.

---

## Ce que cela signifie pour vous

:::info[Si vous êtes un membre de la communauté]
Un badge « Deployable » sur un classement ne signifie jamais qu'une machine publiera dans votre langue sans supervision — cela signifie qu'un générateur de brouillon peut être prêt à *auditionner* auprès de vos traducteurs, selon vos conditions, avec vos locuteurs comme juges (rémunérés — voir [Comment les locuteurs sont rémunérés](/docs/network/perspectives/how-speakers-get-paid)). Si votre communauté gère un bureau de traduction, la question pertinente à nous poser est : « À quoi ressemblerait un projet pilote, et qui examine le résultat ? »
:::

:::info[Si vous êtes un chercheur]
Le cadre de la post-édition change ce qui vaut la peine d'être mesuré : le temps jusqu'à un texte acceptable avec un locuteur dans la boucle, et non seulement un score composite. Les métriques du Réseau sont des approximations de cela ([Spécification de notation §1](/docs/network/specifications/scoring)), et les études de post-édition par langue pour les langues morphologiquement complexes constituent une lacune de recherche ouverte que cette infrastructure est conçue pour soutenir.
:::

:::info[Si vous êtes un développeur]
Optimisez pour l'éditeur, non pour la métrique. Une méthode qui produit des mots réels avec des inflexions occasionnellement incorrectes est corrigeable en quelques secondes par un locuteur ; une méthode qui hallucine des formes plausibles empoisonne l'ensemble du flux de travail — c'est pourquoi la validité morphologique est si strictement contrôlée ici. Commencez par [Soumettre une méthode](/docs/network/getting-started/submit-a-method), et lisez l'[Interface de méthode](/docs/network/specifications/methods) pour voir ce que vous remettrez éventuellement si vous gagnez.
:::

## Voir aussi

- [Translation Is Not Revitalization](/docs/network/perspectives/translation-is-not-revitalization) — pourquoi la porte humaine est le point, pas une limitation
- [Reporting Errors and Owning Corrections](/docs/network/perspectives/reporting-errors-and-owning-corrections) — ce qui se passe quand le texte publié est quand même incorrect
- [Benchmark Specification §7](/docs/network/specifications/benchmark#7-human-validation) — la porte de validation humaine, formellement
