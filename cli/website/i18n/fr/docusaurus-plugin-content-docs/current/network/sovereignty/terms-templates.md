---
sidebar_position: 10
title: "Modèles de conditions"
slug: /network/sovereignty/terms-templates
description: "Idées de conditions adaptables et privilégiant la confiance minimale pour une communauté organisant un concours souverain — propriété, licences basées sur les scores uniquement, intégrité ancrée par hash, défauts fermés en cas d'échec, et un tour d'horizon honnête des risques de cheval de Troie."
related:
  - label: "Run a Sovereign Contest"
    to: /docs/network/sovereignty/run-a-sovereign-contest
    kind: doc
    note: "The runbook these terms attach to"
  - label: "Ownership & Terms"
    to: /docs/network/sovereignty/ownership-transfer
    kind: doc
  - label: "Data Stewardship"
    to: /docs/network/sovereignty/data-sovereignty
    kind: doc
  - label: "Prize Specification"
    to: /docs/network/specifications/prizes
    kind: spec
---

# Modèles de conditions

> **Résumé exécutif.** Conditions de départ qu'une communauté ou une organisation peut adapter lors de l'organisation d'un [concours souverain](/docs/network/sovereignty/run-a-sovereign-contest). Le parti pris de conception dans l'ensemble est **orienté vers l'absence de confiance** : autant que possible, une condition est soutenue par un mécanisme (un hash, une barrière, un journal immuable) plutôt que par une promesse. Chaque condition est un court paragraphe plus une explication en langage clair.

:::warning[Ceci n'est pas un avis juridique]
Il s'agit d'*idées* de rédaction provenant d'un projet de recherche non commercial, non d'un avis juridique, et nous ne sommes pas des avocats. Les lois varient selon la juridiction, et les cadres autochtones de gouvernance des données imposent des obligations qu'aucun modèle ne peut décharger. Faites examiner par vos propres conseillers juridiques — et par votre propre processus de gouvernance communautaire — tout élément avant de vous y fier.
:::

---

## Conditions fondamentales

### 1. Le corpus est et reste la propriété du propriétaire

*Condition.* Le corpus d'évaluation, toutes les entrées qu'il contient et toutes les métadonnées dérivées restent la propriété exclusive de la communauté/organisation qui s'enregistre. Aucune utilisation des mécanismes d'enregistrement, de concours ou d'évaluation du Réseau ne transfère aucun droit, titre ou intérêt dans le corpus à la plateforme, aux développeurs de méthodes ou à aucun sponsor. La plateforme ne détient aucune copie et ne revendique aucune licence au-delà du digest du blob chiffré.

*Langage clair :* organiser un concours contre votre corpus ne donne à personne une part de celui-ci. Champollion détient un hash, non une revendication.

### 2. L'évaluation accorde une licence limitée aux scores uniquement — rien d'autre

*Condition.* Une exécution d'évaluation autorisée accorde à la plateforme et au développeur de la méthode une licence pour recevoir et publier **uniquement les scores numériques et les statistiques agrégées**. Elle n'accorde **aucun** droit de conserver le contenu du corpus après l'exécution, **aucun** droit d'entraîner, d'affiner ou de coacher un modèle sur celui-ci, et **aucun** droit de construire des corpus dérivés, des exemples mémorisés ou des tables de consultation à partir de celui-ci. Toute conservation de contenu au-delà de l'exécution termine la licence et annule les résultats de l'exécution.

*Langage clair :* ce qui sort d'une exécution scellée est un nombre. Les phrases ne le font jamais — pas dans un classement, pas dans un ensemble d'entraînement, pas dans le cache de quiconque.

### 3. Intégrité épinglée par hash : le digest est publié, le contenu ne l'est jamais

*Condition.* Le corpus est identifié exclusivement par le digest SHA-256 publié de son blob chiffré et une étiquette de version. Seuls les blobs correspondant au digest comptent comme le corpus ; toute exécution contre des octets non correspondants est nulle. La publication du digest n'est pas la publication du contenu, et rien dans ces conditions n'oblige le propriétaire à jamais divulguer le contenu à quiconque.

*Langage clair :* tout le monde peut vérifier *quel* corpus a été utilisé ; personne ne peut le *lire*. Si les octets ne correspondent pas au hash, l'exécution ne compte pas.

### 4. Défauts fermés par défaut

*Condition.* Toute ambiguïté se résout vers aucun accès et aucune publication. Une demande qui n'est pas affirmativement autorisée par le seuil de gardiens est refusée ; une autorisation qui a expiré ou a été utilisée est morte ; un résultat dont la provenance ne peut pas être vérifiée n'est pas publié ; un corpus dont l'enregistrement expire cesse d'être exécutable. Le silence ne constitue jamais un consentement.

*Langage clair :* en cas de doute, la réponse est non. Rien ne s'ouvre par défaut.

### 5. L'autorisation des gardiens contrôle chaque exécution

*Condition.* Aucune évaluation ne peut s'exécuter contre le corpus scellé sans une autorisation enregistrée et approuvée par seuil, et une autorisation à usage unique, limitée dans le temps, liée à la méthode spécifique, à la version du corpus et à l'environnement d'évaluation. Tous les événements d'autorisation, y compris les refus et les tentatives bloquées, sont enregistrés dans un journal d'audit immuable, publiquement rejouable.

*Langage clair :* vos gardiens approuvent chaque exécution, une exécution à la fois, et tout l'historique est public et inviolable. (L'outillage de signature par seuil cryptographique est encore en développement — voir la [boîte de statut dans le manuel](/docs/network/sovereignty/run-a-sovereign-contest) — donc aujourd'hui cette condition est appliquée en tant que processus enregistré, pas encore en tant que mathématique.)

### 6. Les fonds de prix sont détenus par le sponsor et la règle d'attribution est publique

*Condition.* Les fonds de prix sont détenus par l'organisation sponsor nommée ou une fiducie communautaire désignée — jamais par la plateforme. Le seuil d'attribution est publié avant l'ouverture du concours, est vérifiable à partir des scores publiés plus le verdict de validation des locuteurs de la communauté, et la décision d'attribution appartient au détenteur des fonds seul.

*Langage clair :* l'argent reste avec celui qui l'a mis, la barre est publique, et si la barre a été franchie est vérifiable par quiconque. Champollion ne peut pas payer, retenir ou rediriger un prix parce que Champollion n'a jamais l'argent.

---

## Risques de cheval de Troie {#trojan-horse-risks}

Un document de conditions honnête nomme les façons dont l'arrangement peut être attaqué. Mettez-les dans le vôtre — un sponsor ou une communauté qui les a lus est plus difficile à tromper.

### Soumissions de méthodes malveillantes qui tentent d'exfiltrer les données de test

Une « méthode » est du code soumis. Une méthode hostile peut essayer de contrebander des phrases de test — en les codant dans ses sorties, en les écrivant dans des journaux ou en téléphonant à la maison. **Atténuations :** émission limitée aux scores (le texte de sortie par entrée des exécutions scellées n'est jamais publié — appliqué à la couche de données aujourd'hui) ; un **bac à sable sans sortie** pour l'exécution scellée (🔲 en développement — jusqu'à ce qu'il soit livré, traitez cette atténuation comme partielle et pondérez les approbations de vos gardiens en conséquence) ; et **budgets de requête/exécution par méthode par tour** — une méthode obtient un petit nombre fixe d'exécutions scellées, donc le corpus ne peut pas être reconstruit par sondage répété même via le canal des scores.

### Corpus soumis empoisonnés ou contaminés

L'attaque peut aussi fonctionner dans l'autre sens : quelqu'un offre à une communauté un corpus de test « prêt à l'emploi » qui est subtilement faux, offensant ou déjà public (donc les méthodes l'ont mémorisé et les scores sont sans sens).
**Atténuations :** exigences de provenance sur chaque entrée (qui l'a créée, quand, à partir de quelle source) ; [validation des locuteurs](/docs/network/specifications/speaker-validation) du corpus lui-même avant scellement ; et dépistage de la contamination contre les données publiques avant qu'un corpus soit accepté comme qualificatif ou étalon-or.

### Chevaux de Troie de licence dans les dépendances

Une méthode gagnante qui regroupe silencieusement du contenu ou du code dont la licence interdit l'utilisation prévue par la communauté (déploiement commercial, redistribution) empoisonne le transfert — vous gagnez un outil que vous ne pouvez pas légalement utiliser.
**Atténuations :** déclarations de classe de dépendance et une barrière de licence mécanique sur les soumissions (voir le [tableau de classe de dépendance de la Spécification des prix](/docs/network/specifications/prizes)) ; les dépendances non déclarées sont disqualifiantes.

### Hameçonnage des identifiants

Quiconque organise un concours devient une cible pour les attaques « collez votre jeton ici pour vérifier votre enregistrement ». **Atténuations :** ne collez jamais de jetons, de clés ou d'identifiants sur des pages tierces et ne les partagez pas dans le chat ; toute authentification dans ce projet se fait via le flux OAuth du CLI, et **aucun flux de jeton d'accès personnel du navigateur n'existe plus** — toute page en demandant un est hostile. Les décisions des gardiens doivent se faire sur des canaux que votre communauté fait déjà confiance.

### Défaut de paiement du côté du sponsor

Le mode d'échec silencieux : les méthodes franchissent la barre et le sponsor ne paie pas.
**Atténuations :** publiez l'identité du détenteur des fonds et l'arrangement de détention (compte org, fiducie, agent de séquestre) *avant* l'ouverture du concours ; rendez les conditions d'attribution vérifiables à partir des scores publiés afin qu'un défaut soit publiquement visible comme un défaut, non niable comme un jugement ; et préférez un détenteur ayant quelque chose à perdre sur le plan réputationnel. Champollion ne peut pas assurer ce risque — par conception, il ne détient jamais les fonds — donc la crédibilité d'un prix est exactement la crédibilité de son détenteur nommé.

---

## Utilisation de ceux-ci

Copiez ce qui convient, supprimez ce qui ne convient pas, ajoutez ce que votre gouvernance exige, et publiez le résultat aux côtés de votre concours afin que les participants acceptent *vos* conditions, non une ambiance. Les conditions par communauté — y compris le transfert de propriété de la méthode pour les prix sponsorisés — sont la norme ici, non l'exception : voir [Propriété et conditions](/docs/network/sovereignty/ownership-transfer).

