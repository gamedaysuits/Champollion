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
    note: "How runs are scored, and why no score is a quality label"
  - label: "Translation Is Not Revitalization"
    to: /docs/network/perspectives/translation-is-not-revitalization
    kind: position
---

# Du benchmark à l'utilisation quotidienne : le chemin de la post-édition

> **En résumé.** Un score au classement n'est pas un produit. Le chemin qui mène de « cette méthode obtient un score chrF++ de 47,5 » à « le bureau de la bande publie chaque semaine des documents dans la langue » passe par un seul et unique flux de travail : la machine produit un premier jet, un locuteur fluide le corrige, et seul le texte corrigé est publié. Chaque seuil de qualité de nos spécifications est étalonné sur ce flux de travail — et non sur une production automatique non supervisée, que nous ne cautionnons pour aucune langue sur cette plateforme.

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

## Ce qu'un score au classement peut et ne peut pas vous révéler

Le classement hiérarchise les méthodes selon les usages du domaine de la TA : par le score **chrF++** (0–100) au niveau du corpus, accompagné de son intervalle de confiance à 95 % et de sa signature sacreBLEU, flanqué des métriques BLEU, spBLEU, TER et COMET, tandis que les diagnostics tels que l'acceptation FST sont rapportés séparément ([Spécification de l'évaluation](/docs/network/specifications/scoring#how-runs-are-scored)). Le fait qu'une méthode soit meilleure qu'une autre sur un même jeu d'évaluation est déterminé par un test de significativité apparié, et non en comparant deux chiffres à l'œil nu ([Tests de significativité](/docs/network/specifications/significance)).

Ce que cela indique à une communauté : quelles méthodes produisent des résultats plus proches de traductions de référence fiables, et si l'écart entre deux méthodes est réel. Ce que cela ne peut pas vous dire : si un brouillon vaut la peine qu'un locuteur y consacre son temps. Une même valeur chrF++ a des significations différentes selon les langues et les jeux d'évaluation ; aucun score automatique ne porte donc ici de label de qualité. Le Réseau appliquait auparavant un indice composite pondéré à des niveaux nommés (« fonctionnel », « déployable », …) ; ces dénominations ont été retirées, notamment parce qu'un système répétant une unique phrase valide pour chaque entrée s'était vu attribuer la mention « fonctionnel » ([pourquoi l'indice composite a été retiré](/docs/network/specifications/scoring#why-the-composite-was-retired)).

Deux règles d'honnêteté structurelle en découlent, issues de la [Spécification du benchmark §7](/docs/network/specifications/benchmark#7-human-validation) :

- **Un score est une présélection pour une revue humaine, pas un verdict.** Un score chrF++ élevé rend une méthode digne d'être testée avec des locuteurs ; il ne signifie pas qu'elle est prête.
- **Seule l'évaluation par la communauté détermine si une méthode est prête pour un flux de post-édition.** Un échantillon stratifié de ses productions est soumis à des locuteurs bilingues, qui évaluent chaque traduction : *rejet / idée générale / acceptable / excellent*. C'est l'organisation de gouvernance — et non le classement — qui décide si la méthode passe à l'étape suivante.

À titre de comparaison, les conditions du [Prix du fondateur](/docs/network/specifications/prizes) (un plancher chrF++, ≥ 99 % de mots morphologiquement valides comme critère éliminatoire, ≥ 70 % évalué comme acceptable ou supérieur par les locuteurs) décrivent une méthode dont les erreurs résiduelles sont de *véritables erreurs de langage* — une mauvaise inflexion, pas des mots inventés. C'est à cela que ressemble, en chiffres, « un brouillon qui vaut le temps d'un locuteur », et le verdict des locuteurs constitue la condition décisive.

## D'une méthode gagnante à un bureau fonctionnel

Supposons qu'une méthode franchisse ces portes. Les étapes restantes sont organisationnelles, et elles sont spécifiées plutôt qu'improvisées :

1. **La propriété est transférée.** Le code de la méthode devient la propriété de l'organisation de gouvernance de la communauté — le développeur conserve les droits d'attribution et de publication ([Ownership Transfer](/docs/network/sovereignty/ownership-transfer)).
2. **La méthode devient un service — le service de la communauté.** Elle est emballée en tant que plugin que l'organisation de gouvernance peut exécuter sur sa propre infrastructure, contrôlant l'accès et les utilisations autorisées ([Deploy to Production](/docs/network/getting-started/deploy-to-production)). Si la communauté choisit de l'offrir commercialement, c'est son affaire à tous les égards — Champollion ne prend aucune part ([How the Work Is Funded](/docs/network/sovereignty/economic-model)).
3. **Les traducteurs l'intègrent dans leur journée.** Un bureau de traduction pointe son flux de travail de document existant vers l'API de la méthode : texte source en, brouillon en sortie, post-édition, publication. Le texte publié porte le nom et l'autorité du traducteur — la machine est un outil sur son bureau, comme un dictionnaire.

## Où cela en est aujourd'hui

En clair : l'ensemble du parcours est spécifié de bout en bout, et partiellement construit. Le banc d'évaluation, les métriques, les fiches d'exécution et le classement public existent ; le bac à sable d'évaluation est opérationnel mais n'a été testé qu'avec une méthode fictive ; un corpus de développement en cri des plaines existe en amont ; un prix est proposé, mais aucun n'est actuellement ouvert ; la plateforme de déploiement existe. L'interface d'évaluation communautaire et la boucle de rétroaction sur les textes corrigés sont spécifiées mais pas encore fonctionnelles — les spécifications les indiquent comme prévues, et nous faisons de même. Aucune méthode n'a encore accompli l'intégralité du trajet, du benchmark à l'utilisation quotidienne par la communauté. Ce parcours constitue la définition même du succès pour ce projet, et c'est précisément la raison pour laquelle nous ne prétendrons pas l'avoir atteint prématurément.

---

## Ce que cela signifie pour vous

:::info[Si vous êtes membre d'une communauté]
Un score élevé au classement ne signifie jamais qu'une machine publiera dans votre langue sans supervision — cela signifie qu'un générateur d'ébauches peut être prêt à *passer une audition* devant vos traducteurs, selon vos conditions, avec vos locuteurs pour juges (rémunérés — voir [Comment les locuteurs sont rémunérés](/docs/network/perspectives/how-speakers-get-paid)). Si votre communauté dispose d'un service de traduction, la question pertinente à nous poser est : « à quoi ressemblerait un projet pilote, et qui révise les résultats ? »
:::

:::info[Si vous êtes chercheur]
Le cadrage autour de la post-édition redéfinit ce qui mérite d'être mesuré : le délai d'obtention d'un texte acceptable avec un locuteur dans la boucle, et pas seulement le score chrF++. Les métriques du Réseau en sont des approximations ([Spécification de l'évaluation §1](/docs/network/specifications/scoring)), et les études de post-édition par langue pour les langues à morphologie complexe constituent une lacune de recherche que cette infrastructure a vocation à combler.
:::

:::info[Si vous êtes un développeur]
Optimisez pour l'éditeur, non pour la métrique. Une méthode qui produit des mots réels avec des inflexions occasionnellement incorrectes est corrigeable en quelques secondes par un locuteur ; une méthode qui hallucine des formes plausibles empoisonne l'ensemble du flux de travail — c'est pourquoi la validité morphologique est si strictement contrôlée ici. Commencez par [Soumettre une méthode](/docs/network/getting-started/submit-a-method), et lisez l'[Interface de méthode](/docs/network/specifications/methods) pour voir ce que vous remettrez éventuellement si vous gagnez.
:::

## Voir aussi

- [Translation Is Not Revitalization](/docs/network/perspectives/translation-is-not-revitalization) — pourquoi la porte humaine est le point, pas une limitation
- [Reporting Errors and Owning Corrections](/docs/network/perspectives/reporting-errors-and-owning-corrections) — ce qui se passe quand le texte publié est quand même incorrect
- [Benchmark Specification §7](/docs/network/specifications/benchmark#7-human-validation) — la porte de validation humaine, formellement
