---
sidebar_position: 7
title: "Gouvernance des données"
description: "La position de Champollion sur les données linguistiques : les corpus restent avec leurs gestionnaires, chaque licence est respectée, et les conditions communautaires régissent les données communautaires."
related:
  - label: "The Derived-Artifacts Commitment"
    to: /docs/network/sovereignty/derived-artifacts
    kind: doc
    note: "The output side: models and derived artifacts belong to speakers"
  - label: "Registering Corpora & Exposure Lanes"
    to: /docs/network/sovereignty/registering-corpora
    kind: doc
    note: "The mechanics: benchmark a corpus without handing it over"
  - label: "How the Work Is Funded"
    to: /docs/network/sovereignty/economic-model
    kind: doc
  - label: "Reporting Errors and Owning Corrections"
    to: /docs/network/perspectives/reporting-errors-and-owning-corrections
    kind: position
  - label: "For Language Communities"
    to: /docs/network/community/for-language-communities
    kind: doc
---

# Intendance des données

> **Résumé analytique.** Champollion est un outil de recherche et
> développement en traduction automatique — dont le code source est disponible et gratuit pour un usage non commercial, et dont
> le harnais d'évaluation est open source. Cette page expose en détail sa position sur les données
> linguistiques : les corpus appartiennent aux personnes dont ils proviennent, chaque licence et condition
> communautaire est respectée de manière mécanique plutôt que par de simples promesses, et la plateforme n'impose
> aucune condition qui lui soit propre sur la langue de quiconque.

:::info[Les données linguistiques sont des données biologiques]
Les données linguistiques sont des **données biologiques**. Comme les données génétiques ou sanitaires, une langue porte l'identité, la parenté et les relations des personnes qui la parlent — et comme un génome, elle ne peut pas être anonymisée de manière significative : même en supprimant les noms, la langue encode toujours qui sont ses locuteurs. Ainsi, les personnes qui fournissent un corpus en détiennent les clés, et par extension, les clés de tout ce qui est mesuré par rapport à celui-ci. C'est le principe sur lequel repose tout ce qui suit.
:::

De cette prémisse découle la conception. Champollion traite chaque contributeur de corpus comme un **intendant** : le corpus reste le sien — légalement, physiquement et pratiquement — tandis que l'infrastructure le rend *mesurable*.

## Les engagements

1. **Nous ne détenons jamais les données.** Les corpus sont enregistrés sous forme de fiches de métadonnées avec hash épinglé et récupérés depuis l'hébergement propre de l'intendant au moment de l'évaluation. Rien n'est copié dans ce référentiel ni servi depuis notre infrastructure. Mettez votre archive hors ligne et l'évaluation par rapport à celle-ci s'arrête simplement. Voir [Registering Corpora](/docs/network/sovereignty/registering-corpora).

2. **Chaque licence est respectée — par portail, non par promesse.** Les corpus non commerciaux et réservés à la recherche sont mécaniquement exclus de tout usage que leur licence ne permet pas. Les restrictions affirmées par une communauté au-delà de la licence sont enregistrées avec leur source et honorées de la même manière. L'application réside dans les portails CI et les déclencheurs de base de données, non dans un code de conduite.

3. **Les conditions sont celles de l'intendant, et elles varient.** Différentes langues auront des accords différents — un corpus CC0 public, un corpus communautaire réservé à la recherche, et un ensemble de test scellé avec des exigences de déploiement souverain peuvent tous participer, chacun selon ses propres conditions. Il n'y a pas de contrat universel ici et aucune revendication par défaut sur quoi que ce soit. Voir le [Terms Framework](/docs/network/sovereignty/ownership-transfer).

4. **Les corpus secrets sont soutenus en tant qu'architecture, non exception.** Une communauté peut garder un ensemble de test scellé — détenu sur sa propre infrastructure, jamais vu par Champollion ou par les développeurs — et avoir néanmoins des méthodes évaluées par rapport à celui-ci. La mesurabilité sans extractibilité est un objectif de conception, non une solution de contournement.

5. **L'attribution et le crédit voyagent avec les données.** Le crédit du constructeur et du linguiste est obligatoire sur chaque surface où un corpus apparaît. Lorsqu'une communauté a appliqué les étiquettes [Local Contexts](https://localcontexts.org/) TK ou BC, nous les affichons et honorons le protocole qu'elles encodent. Nous portons les étiquettes ; nous ne les créons jamais.

6. **Les contributeurs sont rémunérés.** La construction et la validation de corpus sont un travail professionnel à des tarifs publiés — voir [How Speakers Get Paid](/docs/network/perspectives/how-speakers-get-paid). Le paiement n'achète pas le corpus : le constructeur est payé *et* reste l'intendant.

## Comment une licence devient une règle contraignante

L'Engagement 2 a une forme spécifique, et il vaut la peine d'être énoncé dans son intégralité — voici
comment le principe « chaque licence est respectée » fonctionne réellement, et non un simple résumé de bonnes
intentions.

**Chaque benchmark entre en rétention.** Un ensemble de tests nouvellement catalogué est mis en quarantaine par
défaut : visible dans l'index, exclu de la file d'attente d'évaluation, des
concours et de tout classement. Aucune supposition n'est faite sur un corpus lors de son intégration
— pas même s'il présente une licence d'apparence permissive — jusqu'à ce que ses conditions soient examinées par rapport
au texte réel de la licence à une révision en amont épinglée.

**Les verdicts d'examen sont mécaniques, et les cas complexes restent en rétention.** Une licence
permissive clairement énoncée autorise le corpus pour toutes les voies. Une licence
non commerciale clairement énoncée l'autorise dans une voie de recherche qui est exclue de
toute surface commerciale, de prix et d'API. Et une licence qui n'est pas énoncée,
modifiée, mixte ou sur mesure n'est **jamais interprétée au nom du titulaire des
droits** : le corpus reste catalogué mais en rétention — hors de la file d'attente, des concours
et des classements — jusqu'à ce que le titulaire des droits énonce des conditions ou enregistre une autorisation. Le
verdict, sa date, sa voie et son fondement sont estampillés de manière lisible par machine sur la
fiche du corpus et ses entrées de registre, de sorte que « pourquoi ceci est-il exécutable ? » ait toujours une
réponse citable, tout comme « pourquoi ceci ne l'est-il pas ? ».

**L'envoi de texte à un modèle est une transmission, et elle est contrôlée.** Évaluer un
modèle signifie lui envoyer des phrases sources — c'est-à-dire que le corpus quitte son environnement d'origine, et
cela est régi par sa licence. Les corpus sous licence permissive peuvent utiliser les canaux
standards. Les corpus sous une licence non commerciale explicite ne transitent que par
des canaux qui, contractuellement, ne s'entraînent pas sur les données d'entrée — formulé exactement ainsi : une
garantie de non-entraînement, et non de non-conservation. Les corpus sous des autorisations non énoncées ou
modifiées se voient refuser catégoriquement l'évaluation à distance jusqu'à ce que le consentement soit
enregistré, et les ensembles communautaires scellés ne quittent jamais l'infrastructure de leur
gestionnaire. Lorsque le point de contrôle refuse, son message de refus cite le
verdict de l'examen de la licence.

**L'application stricte se situe en dessous de chaque client.** Les rétentions sont appliquées par un
déclencheur de base de données qu'aucun client ne peut contourner, la règle de non-hébergement est appliquée par un
point de contrôle de dépôt qui analyse chaque chemin suivi à la recherche de contenu de corpus, et le
point de contrôle de transmission s'exécute à l'intérieur même du harnais d'évaluation. Chacun de ces éléments peut
nous dire non, ce qui est précisément le but.

## Ce que ce n'est pas

Champollion n'est pas un courtier de données, pas un fournisseur de traduction, et pas une plateforme commerciale. C'est un outil de recherche. Un score élevé au classement prouve qu'une méthode fonctionne techniquement ; ce n'est pas une licence pour publier des traductions, redistribuer un corpus, ou déployer quoi que ce soit contre les souhaits d'une communauté. Ces décisions appartiennent à l'intendant, toujours.

## Les cadres qui ont façonné cette conception

Cette posture n'a pas été inventée ici. Elle est informée par, et redevable à, le travail de gouvernance des données autochtones des deux dernières décennies :

- **Les principes de souveraineté des données des Premières Nations** — les Premières Nations au Canada ont articulé la propriété, le contrôle, l'accès et la possession communautaires de leurs propres informations ; le modèle d'intendance ici est conçu pour être compatible avec ces affirmations.
- **[CARE Principles](https://www.gida-global.org/care)** (Collective Benefit, Authority to Control, Responsibility, Ethics) — Global Indigenous Data Alliance.
- **[Te Mana Raraunga](https://www.temanararaunga.maori.nz/)** — le Māori Data Sovereignty Network.
- **La [Kaitiakitanga License](https://tehiku.nz/)** — la licence basée sur la garde de Te Hiku Media pour les données te reo Māori, une influence directe sur le modèle de garde où l'intendant détient les clés utilisé ici.

Nous orientons quiconque conçoit la gouvernance pour les données de sa propre langue vers ces sources directement — ce sont les autorités, pas nous. Lorsqu'une communauté adopte l'un de ces cadres pour son corpus, la fiche de corpus enregistre cette affirmation et l'outillage l'honore.

Champollion affiche l'avis **« Open to Collaborate »** de Local Contexts : nous construisons des relations avec les communautés dont les langues apparaissent ici, et les étiquettes rédigées par la communauté supplantent tout ce que nous disons sur leurs données.

## Voir aussi

- [Souveraineté des données, depuis zéro](/docs/learn/data-sovereignty) — la version d'introduction de cette page, pour les lecteurs qui découvrent le concept

- [Registering Corpora & Exposure Lanes](/docs/network/sovereignty/registering-corpora) — la mécanique
- [For Language Communities](/docs/network/community/for-language-communities) — un guide en langage clair
- [How Speakers Get Paid](/docs/network/perspectives/how-speakers-get-paid) — tarifs et conditions publiés
- [Translation Methods](https://champollion.dev/docs/guides/translation-methods) — la méthode `api`, qui garde les invites, dictionnaires et données de coaching d'une communauté sur ses propres serveurs
